import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ✅ FIX: Ganti import * as admin dengan adminAuth/adminDb dari lib terpusat
// ✅ FIX: Hapus semua console.log yang memuat OTP atau raw response dari 5sim
//         — log ini bocorkan kode OTP user ke server log yang bisa diakses tim infra

export async function GET(request: Request) {
  try {
    // ── 1. Autentikasi ─────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    // ── 2. Validasi orderId — cegah path traversal ─────────────────────────────
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    // ✅ FIX: Whitelist karakter orderId — hanya angka (ID dari 5sim selalu numeric)
    if (!orderId || !/^\d{1,20}$/.test(orderId)) {
      return NextResponse.json({ error: 'Parameter orderId tidak valid.' }, { status: 400 });
    }

    // ── 3. Ambil order dari Firestore — HANYA milik uid ini ───────────────────
    const orderRef  = adminDb.collection('users').doc(uid).collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    if (orderData.status !== 'active') {
      return NextResponse.json({
        status: orderData.status,
        otp:    orderData.otp || null,
        number: orderData.number,
      });
    }

    // ── 4. Cek expiry di backend ───────────────────────────────────────────────
    const ORDER_DURATION_MS = 20 * 60 * 1000;
    const createdAt: number = orderData.createdAt || orderData.timestamp || 0;
    const expiresAt: number = orderData.expiresAt || (createdAt + ORDER_DURATION_MS);
    const now               = Date.now();

    if (expiresAt > 0 && now > expiresAt) {
      const userRef   = adminDb.collection('users').doc(uid);
      const mutasiRef = userRef.collection('transactions').doc();

      try {
        await adminDb.runTransaction(async (t) => {
          const userSnap      = await t.get(userRef);
          const currentSpent  = userSnap.data()?.totalSpent || 0;
          const newTotalSpent = Math.max(0, currentSpent - (orderData.price || 0));

          t.update(orderRef, {
            status:       'canceled',
            cancelReason: 'expired_backend',
            updatedAt:    FieldValue.serverTimestamp(),
          });
          t.update(userRef, {
            balance:    FieldValue.increment(orderData.price),
            totalSpent: newTotalSpent,
          });
          t.set(mutasiRef, {
            type:      'refund',
            amount:    orderData.price,
            desc:      `Refund otomatis (expired) - ${(orderData.serviceId || '').toUpperCase()}`,
            status:    'success',
            timestamp: now,
          });
        });
      } catch (refundErr: any) {
        console.error('[check-otp] Refund expired gagal:', refundErr.message);
      }

      try {
        const key = process.env.FIVESIM_API_KEY;
        if (key) {
          await fetch(`https://5sim.net/v1/user/cancel/${orderId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch { /* best effort */ }

      return NextResponse.json({
        status:  'canceled',
        otp:     null,
        number:  orderData.number,
        message: 'Waktu habis. Saldo telah dikembalikan otomatis.',
      });
    }

    // ── 5. Poll ke 5sim ────────────────────────────────────────────────────────
    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      return NextResponse.json({ error: 'Konfigurasi server bermasalah.' }, { status: 500 });
    }

    const headers5sim = {
      Authorization: `Bearer ${FIVE_SIM_API_KEY}`,
      Accept:        'application/json',
    };

    let simData: any;
    try {
      const checkRes = await fetch(`https://5sim.net/v1/user/check/${orderId}`, {
        headers: headers5sim,
        signal:  AbortSignal.timeout(10000),
      });
      simData = await checkRes.json();
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      // ✅ FIX: Log hanya status/error, bukan raw response yang mungkin berisi OTP
      if (!isTimeout) console.error('[check-otp] Fetch error:', err?.message);
      return NextResponse.json({
        status:  'active',
        otp:     null,
        warning: isTimeout ? 'Timeout saat polling, akan dicoba lagi.' : undefined,
      });
    }

    const simStatus: string = simData?.status || 'PENDING';

    // ✅ FIX: Tidak log raw response atau OTP ke console
    // Log hanya status dan count SMS (tidak berisi data sensitif)
    if (process.env.NODE_ENV === 'development') {
      const smsCount = Array.isArray(simData?.sms) ? simData.sms.length : 0;
      console.log(`[check-otp] status=${simStatus} smsCount=${smsCount}`);
    }

    // ── Helper: ekstrak OTP dari SMS object ───────────────────────────────────
    const extractOtp = (sms: any): string | null => {
      if (!sms) return null;
      if (sms.code && typeof sms.code === 'string' && sms.code.trim()) return sms.code.trim();
      const text = sms.text || sms.Text || '';
      if (typeof text === 'string') {
        const match = text.match(/\b(\d{4,8})\b/);
        if (match) return match[1];
      }
      return null;
    };

    const extractSmsArray = (data: any): any[] => {
      if (!data) return [];
      for (const key of ['sms', 'Sms', 'SMS', 'Data', 'data', 'messages', 'Messages']) {
        if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
      }
      return [];
    };

    let smsArr    = extractSmsArray(simData);
    let latestOtp = smsArr.length > 0 ? extractOtp(smsArr[smsArr.length - 1]) : null;
    if (!latestOtp && simData?.code) latestOtp = String(simData.code).trim() || null;

    // ── 6. Handle TIMEOUT / CANCELED dari 5sim → refund ──────────────────────
    if (simStatus === 'TIMEOUT' || simStatus === 'CANCELED') {
      const userRef   = adminDb.collection('users').doc(uid);
      const mutasiRef = userRef.collection('transactions').doc();

      try {
        await adminDb.runTransaction(async (t) => {
          const userSnap      = await t.get(userRef);
          const currentSpent  = userSnap.data()?.totalSpent || 0;
          const newTotalSpent = Math.max(0, currentSpent - (orderData.price || 0));

          t.update(orderRef, { status: 'canceled', updatedAt: FieldValue.serverTimestamp() });
          t.update(userRef, {
            balance:    FieldValue.increment(orderData.price),
            totalSpent: newTotalSpent,
          });
          t.set(mutasiRef, {
            type:      'refund',
            amount:    orderData.price,
            desc:      `Refund otomatis (${simStatus}) - ${(orderData.serviceId || '').toUpperCase()}`,
            status:    'success',
            timestamp: Date.now(),
          });
        });
      } catch (refundErr: any) {
        console.error('[check-otp] Refund gagal:', refundErr.message);
      }

      return NextResponse.json({
        status:  'canceled',
        otp:     null,
        number:  orderData.number,
        message: simStatus === 'TIMEOUT'
          ? 'Waktu habis. Saldo telah dikembalikan otomatis.'
          : 'Pesanan dibatalkan. Saldo telah dikembalikan.',
      });
    }

    // ── 7. RECEIVED tapi SMS kosong → panggil /finish ─────────────────────────
    if ((simStatus === 'RECEIVED' || simStatus === 'FINISHED') && !latestOtp) {
      try {
        const finishRes  = await fetch(`https://5sim.net/v1/user/finish/${orderId}`, {
          method: 'GET', headers: headers5sim, signal: AbortSignal.timeout(10000),
        });
        if (finishRes.ok) {
          const finishData = await finishRes.json();
          const finishSms  = extractSmsArray(finishData);
          latestOtp = finishSms.length > 0
            ? extractOtp(finishSms[finishSms.length - 1])
            : (finishData?.code ? String(finishData.code).trim() : null);
          if (finishSms.length > 0) smsArr = finishSms;
        }
      } catch { /* best effort */ }
    }

    // ── 8. OTP ada → simpan ke Firestore ──────────────────────────────────────
    if (latestOtp) {
      if (latestOtp !== orderData.otp) {
        await orderRef.update({
          status:    'success',
          otp:       latestOtp,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({
        status: 'success',
        otp:    latestOtp,
        number: orderData.number,
        allSms: smsArr,
      });
    }

    // ── 9. Masih menunggu ──────────────────────────────────────────────────────
    return NextResponse.json({
      status:      'active',
      otp:         null,
      number:      orderData.number,
      allSms:      smsArr,
      remainingMs: Math.max(0, expiresAt - now),
    });

  } catch (error: any) {
    console.error('[check-otp] Error:', error.message);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}