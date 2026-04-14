// /api/5sim/cancel-order/route.ts

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── FIX #L4: TODO — pindahkan toMs ke lib/utils.ts agar tidak duplikat ──────
// Implementasi harus konsisten dengan check-otp/route.ts
const toMs = (val: unknown): number => {
  if (!val) return 0;
  if (typeof (val as any).toMillis === 'function') return (val as any).toMillis();
  if (typeof (val as any).toDate === 'function') return (val as any).toDate().getTime();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ─── FIX #H7: Status yang bisa di-cancel dinormalisasi ke lowercase dulu ──────
// Root fix: pastikan semua write ke Firestore pakai casing konsisten.
// Sementara ini, normalize saat read agar tidak perlu maintain dua versi.
const CANCELLABLE_STATUSES_NORMALIZED = ['active', 'pending'];

function isCancellable(status: unknown): boolean {
  if (!status || typeof status !== 'string') return false;
  return CANCELLABLE_STATUSES_NORMALIZED.includes(status.toLowerCase());
}

const CANCEL_WAIT_MS = 5 * 60 * 1000; // 5 menit

// ─── FIX #M2: Status final UPPERCASE konsisten ───────────────────────────────
// ─── FIX: Tambah 'canceled' (lowercase) sebagai fallback untuk dokumen lama ──
const FINAL_STATUSES = ['SUCCESS', 'COMPLETED', 'CANCELLED', 'canceled'];

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Akses ditolak.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ message: 'Token tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (orderId === undefined || orderId === null || orderId === '') {
      return NextResponse.json({ message: 'orderId wajib diisi.' }, { status: 400 });
    }

    if (!/^\d{1,20}$/.test(String(orderId))) {
      return NextResponse.json({ message: 'orderId tidak valid.' }, { status: 400 });
    }

    const orderIdStr = String(orderId);

    const userRef   = adminDb.collection('users').doc(uid);
    const orderRef  = userRef.collection('orders').doc(orderIdStr);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    const createdAtMs = toMs(orderData.createdAt || orderData.timestamp);
    if (!createdAtMs) {
      return NextResponse.json({ message: 'Data pesanan tidak lengkap.' }, { status: 400 });
    }

    // ─── FIX #H7: Gunakan isCancellable() dengan normalisasi ─────────────────
    if (!isCancellable(orderData.status)) {
      return NextResponse.json({
        message: `Pesanan tidak bisa dibatalkan (status: ${orderData.status}).`,
      }, { status: 400 });
    }

    const now         = Date.now();
    const canCancelAt = createdAtMs + CANCEL_WAIT_MS;

    if (now < canCancelAt) {
      const sisaMs        = canCancelAt - now;
      const sisaDetik     = Math.ceil(sisaMs / 1000);
      const sisaMenit     = Math.floor(sisaDetik / 60);
      const sisaDetikSisa = sisaDetik % 60;

      const sisaLabel = sisaMenit > 0
        ? `${sisaMenit} menit ${sisaDetikSisa > 0 ? `${sisaDetikSisa} detik` : ''} lagi`
        : `${sisaDetik} detik lagi`;

      return NextResponse.json({
        message:     `Pesanan baru bisa dibatalkan setelah 5 menit. Tunggu ${sisaLabel.trim()} lagi.`,
        canCancelAt,
        remainingMs: sisaMs,
      }, { status: 400 });
    }

    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      return NextResponse.json({ message: 'Konfigurasi server bermasalah.' }, { status: 500 });
    }

    // ─── FIX #H5: Validasi fiveSimOrderId — fallback ke null, bukan ke orderId ─
    const rawFiveSimId   = orderData.id ?? null;
    const fiveSimOrderId: string | null = rawFiveSimId && /^\d{1,20}$/.test(String(rawFiveSimId))
      ? String(rawFiveSimId)
      : null;

    if (!fiveSimOrderId) {
      console.error('[cancel-order] fiveSimOrderId tidak valid untuk orderId:', orderIdStr, 'rawId:', rawFiveSimId);
      return NextResponse.json({ message: 'Data order tidak lengkap. Hubungi support.' }, { status: 500 });
    }

    // ─── CEK OTP ke 5sim sebelum refund ─────────────────────────────────────
    // Kalau OTP sudah masuk, batalkan proses cancel — jangan refund
    try {
      const checkRes  = await fetch(`https://5sim.net/v1/user/check/${fiveSimOrderId}`, {
        method:  'GET',
        headers: { Authorization: `Bearer ${FIVE_SIM_API_KEY}`, Accept: 'application/json' },
        signal:  AbortSignal.timeout(8000),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const smsArr    = checkData?.sms ?? [];

        if (smsArr.length > 0) {
          // OTP sudah masuk — simpan ke Firestore & tolak cancel
          const otp = smsArr[0]?.code ?? smsArr[0]?.text ?? '';
          await orderRef.update({
            otp:       otp,
            status:    'SUCCESS',
            updatedAt: FieldValue.serverTimestamp(),
          });

          return NextResponse.json(
            {
              message: '⚠️ OTP sudah masuk sebelum dibatalkan. Pesanan tidak jadi dibatalkan.',
              hasOtp:  true,
              otp,
            },
            { status: 409 },
          );
        }
      }
    } catch (checkErr: any) {
      // Kalau cek gagal, lanjutkan cancel — lebih aman daripada stuck
      console.warn('[cancel-order] Gagal cek OTP sebelum cancel, lanjutkan:', checkErr?.message);
    }

    // ─── FIX #M6: Kembalikan refundAmount dari transaction, bukan via closure ──
    let refundAmount = 0;

    try {
      const txResult = await adminDb.runTransaction(async (t) => {
        const freshOrder = await t.get(orderRef);

        // ─── FIX #H7: Pakai isCancellable() di dalam tx juga ─────────────────
        if (!freshOrder.exists || !isCancellable(freshOrder.data()?.status)) {
          throw new Error('ORDER_NOT_CANCELLABLE');
        }

        const freshData  = freshOrder.data()!;
        const freshPrice = freshData.price ?? 0;

        if (freshPrice <= 0) {
          console.error(`[cancel-order] price tidak valid (${freshPrice}) untuk orderId=${orderIdStr}`);
          throw new Error('INVALID_PRICE');
        }

        const serviceId = freshData.serviceId || '';

        t.update(orderRef, {
          status:    'CANCELLED', // ─── FIX: Konsisten UPPERCASE dengan smsactivate route
          updatedAt: FieldValue.serverTimestamp(),
        });

        t.update(userRef, {
          balance:    FieldValue.increment(freshPrice),
          totalSpent: FieldValue.increment(-freshPrice),
        });

        const mutasiRef = userRef.collection('transactions').doc(`${orderIdStr}_refund`);
        t.set(mutasiRef, {
          type:      'refund',
          amount:    freshPrice,
          desc:      `Refund pembatalan - ${serviceId.toUpperCase()}`,
          status:    'success',
          orderId:   orderIdStr,
          timestamp: now,
        });

        // ─── FIX #M6: Return nilai dari dalam transaction ─────────────────────
        return { refundAmount: freshPrice };
      });

      refundAmount = txResult.refundAmount;

    } catch (err: any) {
      if (err.message === 'ORDER_NOT_CANCELLABLE') {
        return NextResponse.json({
          message: 'Pesanan tidak bisa dibatalkan (sudah diproses atau statusnya berubah).',
        }, { status: 400 });
      }
      if (err.message === 'INVALID_PRICE') {
        return NextResponse.json({
          message: 'Gagal membatalkan pesanan: data harga tidak valid. Hubungi support.',
        }, { status: 500 });
      }
      throw err;
    }

    // ── Best-effort cancel ke 5sim (setelah Firestore berhasil) ───────────────
    try {
      const cancelRes = await fetch(`https://5sim.net/v1/user/cancel/${fiveSimOrderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${FIVE_SIM_API_KEY}`,
          Accept:        'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const rawText = await cancelRes.text();
      let simData: any = {};
      try { simData = JSON.parse(rawText); } catch { /* ok */ }

      // ─── FIX #M7: Perluas deteksi "already canceled" dari 5sim ───────────────
      const isAlreadyCanceled = !cancelRes.ok && (
        rawText.toLowerCase().includes('already cancel') ||
        rawText.toLowerCase().includes('order is cancel') ||
        simData?.status?.toUpperCase() === 'CANCELED'
      );

      if (!cancelRes.ok && !isAlreadyCanceled) {
        console.warn(`[cancel-order] 5sim cancel ${cancelRes.status}:`, rawText.substring(0, 100));
      }
    } catch (err: any) {
      console.warn('[cancel-order] 5sim cancel error (refund sudah aman):', err?.message);
    }

    return NextResponse.json({
      success:      true,
      message:      'Pesanan dibatalkan. Saldo telah dikembalikan.',
      refundAmount,
    });

  } catch (error: any) {
    console.error('[cancel-order] Error:', error.message);
    return NextResponse.json(
      { message: 'Terjadi kesalahan server.' },
      { status: 500 },
    );
  }
}