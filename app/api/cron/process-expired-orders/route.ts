// app/api/cron/process-expired-orders/route.ts
//
// ─── SETUP WAJIB ─────────────────────────────────────────────────────────────
// 1. Tambahkan ke .env.local / Vercel Environment Variables:
//    CRON_SECRET=isi_random_string_rahasia
//
// 2. Tambahkan ke vercel.json (lihat file vercel.json yang disertakan):
//    { "crons": [{ "path": "/api/cron/process-expired-orders", "schedule": "*/2 * * * *" }] }
//
// 3. Pastikan Firestore collectionGroup index sudah dibuat:
//    Collection: orders | Fields: status (ASC), createdAt (ASC) | Scope: Collection group
//
// ─── CARA KERJA ──────────────────────────────────────────────────────────────
// Cron ini jalan setiap 2 menit di server Vercel (bukan browser).
// Artinya: walaupun user tutup Chrome, refund tetap berjalan otomatis.
//
// Alur per order:
//   1. Ambil semua order status 'active' yang sudah melewati ORDER_TTL_MS
//   2. Cek ke provider (5sim / SMS-Activate) apakah OTP sudah masuk
//   3. Kalau sudah ada OTP → skip (update status SUCCESS saja)
//   4. Kalau belum ada OTP → cancel di provider → refund saldo ke user
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const CRON_SECRET       = process.env.CRON_SECRET;
const FIVESIM_API_KEY   = process.env.FIVESIM_API_KEY;
const SA_API_KEY        = process.env.SMSACTIVATE_API_KEY; // ganti sesuai nama di .env kamu

// TTL order sebelum dianggap expired — sesuaikan dengan timer di UI kamu
const ORDER_TTL_MS = 20 * 60 * 1000; // 20 menit

// Batas maksimal order yang diproses per satu kali cron (hindari timeout Vercel)
const BATCH_LIMIT = 50;

// ─── Helper: toMs ─────────────────────────────────────────────────────────────
function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof (val as any).toMillis === 'function') return (val as any).toMillis();
  if (typeof (val as any).toDate === 'function') return (val as any).toDate().getTime();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ─── Cek OTP ke 5sim ──────────────────────────────────────────────────────────
async function checkOtp5sim(fiveSimOrderId: string): Promise<{
  hasOtp: boolean;
  otp: string | null;
  shouldCancel: boolean; // true = boleh cancel, false = jangan diapa-apain
}> {
  if (!FIVESIM_API_KEY) return { hasOtp: false, otp: null, shouldCancel: true };

  try {
    const res = await fetch(`https://5sim.net/v1/user/check/${fiveSimOrderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FIVESIM_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // Kalau 404 = order tidak ada di 5sim, boleh cancel di Firestore saja
      if (res.status === 404) return { hasOtp: false, otp: null, shouldCancel: true };
      // Error lain → skip dulu, coba lagi di cron berikutnya
      return { hasOtp: false, otp: null, shouldCancel: false };
    }

    const data   = await res.json();
    const smsArr = data?.sms ?? [];

    if (smsArr.length > 0) {
      const otp = smsArr[0]?.code ?? smsArr[0]?.text ?? null;
      return { hasOtp: true, otp, shouldCancel: false };
    }

    return { hasOtp: false, otp: null, shouldCancel: true };
  } catch (err: any) {
    console.warn('[cron] Gagal cek OTP 5sim, skip order ini:', err.message);
    // Kalau tidak bisa cek, jangan cancel — lebih aman tunggu cron berikutnya
    return { hasOtp: false, otp: null, shouldCancel: false };
  }
}

// ─── Cancel order ke 5sim (best-effort) ───────────────────────────────────────
async function cancelAt5sim(fiveSimOrderId: string): Promise<void> {
  if (!FIVESIM_API_KEY) return;
  try {
    await fetch(`https://5sim.net/v1/user/cancel/${fiveSimOrderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${FIVESIM_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err: any) {
    console.warn('[cron] 5sim cancel error (Firestore tetap diproses):', err.message);
  }
}

// ─── Cek OTP ke SMS-Activate ──────────────────────────────────────────────────
async function checkOtpSmsActivate(activationId: string): Promise<{
  hasOtp: boolean;
  otp: string | null;
  shouldCancel: boolean;
  alreadyCancelled: boolean;
}> {
  if (!SA_API_KEY) return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: false };

  try {
    const url = `https://api.sms-activate.org/stubs/handler_api.php?api_key=${SA_API_KEY}&action=getStatus&id=${activationId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = (await res.text()).trim();

    // STATUS_OK:123456 → OTP sudah masuk
    if (text.startsWith('STATUS_OK:')) {
      const otp = text.split(':')[1] ?? null;
      return { hasOtp: true, otp, shouldCancel: false, alreadyCancelled: false };
    }

    // Sudah dicancel sebelumnya di SA
    if (text === 'STATUS_CANCEL') {
      return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: true };
    }

    // Masih menunggu kode
    if (['STATUS_WAIT_CODE', 'STATUS_WAIT_RETRY', 'STATUS_WAIT_RESEND'].includes(text)) {
      return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: false };
    }

    // Tidak diketahui / error dari SA → skip dulu
    console.warn('[cron] SA getStatus response tidak dikenal:', text, 'activationId:', activationId);
    return { hasOtp: false, otp: null, shouldCancel: false, alreadyCancelled: false };

  } catch (err: any) {
    console.warn('[cron] Gagal cek OTP SA, skip order ini:', err.message);
    return { hasOtp: false, otp: null, shouldCancel: false, alreadyCancelled: false };
  }
}

// ─── Cancel order ke SMS-Activate (best-effort) ───────────────────────────────
async function cancelAtSmsActivate(activationId: string): Promise<void> {
  if (!SA_API_KEY) return;
  try {
    const url = `https://api.sms-activate.org/stubs/handler_api.php?api_key=${SA_API_KEY}&action=setStatus&id=${activationId}&status=8`;
    await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err: any) {
    console.warn('[cron] SA cancel error (Firestore tetap diproses):', err.message);
  }
}

// ─── Proses satu order: refund ke Firestore ───────────────────────────────────
async function processRefund(
  orderDoc: FirebaseFirestore.QueryDocumentSnapshot,
  note: string,
): Promise<void> {
  const data    = orderDoc.data();
  const orderId = orderDoc.id;
  const userRef = orderDoc.ref.parent.parent!;
  const price   = data.price ?? 0;

  const mutasiRef = userRef
    .collection('transactions')
    .doc(`${orderId}_timeout_refund`);

  await adminDb.runTransaction(async (t) => {
    const fresh = await t.get(orderDoc.ref);
    if (!fresh.exists) return;

    const freshStatus = fresh.data()?.status;
    // Sudah diproses sebelumnya (misal oleh webhook)
    if (['SUCCESS', 'COMPLETED', 'CANCELLED'].includes(freshStatus) || freshStatus === 'canceled') {
      return;
    }

    t.update(orderDoc.ref, {
      status:    'CANCELLED',
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (price > 0) {
      t.update(userRef, {
        balance:    FieldValue.increment(price),
        totalSpent: FieldValue.increment(-price),
      });

      t.set(mutasiRef, {
        type:      'refund',
        amount:    price,
        desc:      `Refund otomatis (Timeout) - ${(data.serviceId ?? data.service ?? '').toUpperCase()}`,
        status:    'success',
        orderId,
        note,
        timestamp: Date.now(),
      });
    }
  });
}

// ─── Proses satu order: update SUCCESS karena OTP sudah masuk ─────────────────
async function processOtpFound(
  orderDoc: FirebaseFirestore.QueryDocumentSnapshot,
  otp: string,
): Promise<void> {
  await adminDb.runTransaction(async (t) => {
    const fresh = await t.get(orderDoc.ref);
    if (!fresh.exists) return;

    const freshStatus = fresh.data()?.status;
    if (['SUCCESS', 'COMPLETED', 'CANCELLED'].includes(freshStatus)) return;

    t.update(orderDoc.ref, {
      otp,
      status:    'SUCCESS',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Proteksi: hanya Vercel Cron atau caller dengan CRON_SECRET yang boleh akses
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now    = Date.now();
  const cutoff = now - ORDER_TTL_MS;

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;

  try {
    // Ambil order yang masih 'active' — filter expired dilakukan di bawah
    // karena Firestore tidak bisa filter berdasarkan computed value (now - createdAt)
    const snap = await adminDb
      .collectionGroup('orders')
      .where('status', '==', 'active')
      .limit(BATCH_LIMIT)
      .get();

    console.log(`[cron] Total order 'active' ditemukan: ${snap.size}`);

    for (const doc of snap.docs) {
      const data      = doc.data();
      const createdAt = toMs(data.createdAt ?? data.timestamp);
      const orderId   = doc.id;
      const provider  = (data.provider ?? '').toLowerCase(); // '5sim' atau 'smsactivate'

      // Belum expired — lewati
      if (!createdAt || createdAt > cutoff) {
        skipped++;
        continue;
      }

      try {
        // ── SERVER 1: 5sim ──────────────────────────────────────────────────
        if (provider === '5sim') {
          const fiveSimOrderId = String(data.id ?? orderId);

          const { hasOtp, otp, shouldCancel } = await checkOtp5sim(fiveSimOrderId);

          if (hasOtp && otp) {
            // OTP sudah masuk → update SUCCESS, jangan cancel
            await processOtpFound(doc, otp);
            console.log(`[cron][5sim] OTP ditemukan, update SUCCESS. orderId: ${orderId}`);
            processed++;
            continue;
          }

          if (!shouldCancel) {
            // Tidak bisa cek → skip, coba lagi nanti
            skipped++;
            continue;
          }

          // Tidak ada OTP → cancel di 5sim lalu refund
          await cancelAt5sim(fiveSimOrderId);
          await processRefund(doc, 'cron-timeout-5sim');
          console.log(`[cron][5sim] Timeout, refund diproses. orderId: ${orderId}`);
          processed++;
          continue;
        }

        // ── SERVER 2: SMS-Activate ──────────────────────────────────────────
        if (provider === 'smsactivate') {
          const activationId = String(data.activationId ?? data.id ?? orderId);

          const { hasOtp, otp, shouldCancel, alreadyCancelled } =
            await checkOtpSmsActivate(activationId);

          if (hasOtp && otp) {
            await processOtpFound(doc, otp);
            console.log(`[cron][SA] OTP ditemukan, update SUCCESS. orderId: ${orderId}`);
            processed++;
            continue;
          }

          if (!shouldCancel) {
            skipped++;
            continue;
          }

          // Kalau belum dicancel di SA → cancel dulu
          if (!alreadyCancelled) {
            await cancelAtSmsActivate(activationId);
          }

          await processRefund(doc, 'cron-timeout-smsactivate');
          console.log(`[cron][SA] Timeout, refund diproses. orderId: ${orderId}`);
          processed++;
          continue;
        }

        // Provider tidak dikenal
        console.warn(`[cron] Provider tidak dikenal untuk orderId: ${orderId}, provider: ${provider}`);
        skipped++;

      } catch (err: any) {
        console.error(`[cron] Error saat proses orderId: ${orderId}:`, err.message);
        errors++;
      }
    }

    console.log(`[cron] Selesai. processed: ${processed}, skipped: ${skipped}, errors: ${errors}`);

    return NextResponse.json({
      ok: true,
      processed,
      skipped,
      errors,
      checkedAt: new Date(now).toISOString(),
    });

  } catch (err: any) {
    console.error('[cron] Fatal error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}