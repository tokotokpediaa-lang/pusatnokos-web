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
//   1. Ambil semua order status 'active' yang createdAt <= (now - ORDER_TTL_MS)
//   2. Cek ke provider (5sim / Web Hero SMS) apakah OTP sudah masuk
//   3. Kalau sudah ada OTP → skip (update status SUCCESS saja)
//   4. Kalau belum ada OTP → cancel di provider → refund saldo ke user
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const CRON_SECRET       = process.env.CRON_SECRET;
const FIVESIM_API_KEY   = process.env.FIVESIM_API_KEY;
const SA_API_KEY        = process.env.SMSACTIVATE_API_KEY;

// Base URL Web Hero SMS — kompatibel dengan format SMS-Activate
const HERO_SMS_BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

// TTL order sebelum dianggap expired — sesuaikan dengan timer di UI kamu
const ORDER_TTL_MS = 20 * 60 * 1000; // 20 menit

// Batas maksimal order yang diproses per satu kali cron (hindari timeout Vercel)
const BATCH_LIMIT = 50;

// ─── Helper: deteksi apakah order ini dari Web Hero SMS ──────────────────────
// Menangkap semua kemungkinan: field provider tidak ada, atau hanya ada operator
function isHeroSmsOrder(data: FirebaseFirestore.DocumentData): boolean {
  const provider = (data.provider ?? '').toLowerCase();
  const operator = (data.operator ?? '').toLowerCase();

  // Eksplisit dari field provider
  if (['smsactivate', 'webhero', 'hero-sms', 'herosms'].includes(provider)) return true;

  // Fallback: cek field operator — HeroSMS selalu pakai format "virtualXX"
  if (operator.startsWith('virtual')) return true;

  return false;
}

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
  shouldCancel: boolean;
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
      if (res.status === 404) return { hasOtp: false, otp: null, shouldCancel: true };
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

// ─── Cek OTP ke Web Hero SMS ──────────────────────────────────────────────────
async function checkOtpHeroSms(activationId: string): Promise<{
  hasOtp: boolean;
  otp: string | null;
  shouldCancel: boolean;
  alreadyCancelled: boolean;
}> {
  if (!SA_API_KEY) return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: false };

  try {
    const url = `${HERO_SMS_BASE_URL}?api_key=${SA_API_KEY}&action=getStatus&id=${activationId}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = (await res.text()).trim();

    console.log(`[cron][HeroSMS] getStatus activationId: ${activationId}, response: ${text}`);

    // OTP sudah masuk
    if (text.startsWith('STATUS_OK:')) {
      const otp = text.split(':')[1] ?? null;
      return { hasOtp: true, otp, shouldCancel: false, alreadyCancelled: false };
    }

    // Sudah dicancel sebelumnya
    if (text === 'STATUS_CANCEL') {
      return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: true };
    }

    // Masih menunggu kode
    if (['STATUS_WAIT_CODE', 'STATUS_WAIT_RETRY', 'STATUS_WAIT_RESEND'].includes(text)) {
      return { hasOtp: false, otp: null, shouldCancel: true, alreadyCancelled: false };
    }

    // Response tidak dikenal → skip, coba lagi cron berikutnya
    console.warn('[cron][HeroSMS] Response getStatus tidak dikenal:', text, 'activationId:', activationId);
    return { hasOtp: false, otp: null, shouldCancel: false, alreadyCancelled: false };

  } catch (err: any) {
    console.warn('[cron] Gagal cek OTP Hero SMS, skip order ini:', err.message);
    return { hasOtp: false, otp: null, shouldCancel: false, alreadyCancelled: false };
  }
}

// ─── Cancel order ke Web Hero SMS (best-effort) ───────────────────────────────
async function cancelAtHeroSms(activationId: string): Promise<void> {
  if (!SA_API_KEY) return;
  try {
    const url = `${HERO_SMS_BASE_URL}?api_key=${SA_API_KEY}&action=cancelActivation&id=${activationId}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = (await res.text()).trim();
    console.log(`[cron][HeroSMS] cancelActivation activationId: ${activationId}, response: ${text}`);
  } catch (err: any) {
    console.warn('[cron] Hero SMS cancel error (Firestore tetap diproses):', err.message);
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
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now             = Date.now();
  const cutoff          = now - ORDER_TTL_MS;
  const cutoffTimestamp = Timestamp.fromMillis(cutoff);

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;

  try {
    const snap = await adminDb
      .collectionGroup('orders')
      .where('status', '==', 'active')
      .where('createdAt', '<=', cutoffTimestamp)
      .orderBy('createdAt', 'asc')
      .limit(BATCH_LIMIT)
      .get();

    console.log(`[cron] Total order 'active' expired ditemukan: ${snap.size}`);

    for (const doc of snap.docs) {
      const data    = doc.data();
      const orderId = doc.id;
      const provider = (data.provider ?? '').toLowerCase();

      try {
        // ── SERVER 1: 5sim ──────────────────────────────────────────────────
        if (provider === '5sim') {
          const fiveSimOrderId = String(data.id ?? orderId);

          const { hasOtp, otp, shouldCancel } = await checkOtp5sim(fiveSimOrderId);

          if (hasOtp && otp) {
            await processOtpFound(doc, otp);
            console.log(`[cron][5sim] OTP ditemukan, update SUCCESS. orderId: ${orderId}`);
            processed++;
            continue;
          }

          if (!shouldCancel) {
            skipped++;
            continue;
          }

          await cancelAt5sim(fiveSimOrderId);
          await processRefund(doc, 'cron-timeout-5sim');
          console.log(`[cron][5sim] Timeout, refund diproses. orderId: ${orderId}`);
          processed++;
          continue;
        }

        // ── SERVER 2: Web Hero SMS ──────────────────────────────────────────
        // FIX: deteksi via isHeroSmsOrder() — menangkap operator "virtualXX"
        // walaupun field "provider" tidak ada di dokumen Firestore
        if (isHeroSmsOrder(data)) {
          const activationId = String(data.activationId ?? data.id ?? orderId);

          console.log(`[cron][HeroSMS] Memproses orderId: ${orderId}, activationId: ${activationId}, operator: ${data.operator ?? '-'}`);

          const { hasOtp, otp, shouldCancel, alreadyCancelled } =
            await checkOtpHeroSms(activationId);

          if (hasOtp && otp) {
            await processOtpFound(doc, otp);
            console.log(`[cron][HeroSMS] OTP ditemukan, update SUCCESS. orderId: ${orderId}`);
            processed++;
            continue;
          }

          if (!shouldCancel) {
            skipped++;
            continue;
          }

          if (!alreadyCancelled) {
            await cancelAtHeroSms(activationId);
          }

          await processRefund(doc, 'cron-timeout-herosms');
          console.log(`[cron][HeroSMS] Timeout, cancel + refund diproses. orderId: ${orderId}`);
          processed++;
          continue;
        }

        // Provider tidak dikenal → langsung refund tanpa cancel ke provider
        console.warn(`[cron] Provider tidak dikenal untuk orderId: ${orderId}, provider: "${provider}", operator: "${data.operator ?? '-'}"`);
        await processRefund(doc, 'cron-timeout-unknown-provider');
        console.log(`[cron] Order tanpa provider dikenal, refund diproses. orderId: ${orderId}`);
        processed++;

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
    console.error('[cron] Fatal error:', err.message, err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 });
  }
}