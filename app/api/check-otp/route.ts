// /api/5sim/check-otp/route.ts

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── FIX #L4: TODO — pindahkan toMs ke lib/utils.ts agar tidak duplikat ──────
// Gunakan implementasi .toMillis() yang lebih akurat (bukan .toDate().getTime())
const toMs = (val: unknown): number => {
  if (!val) return 0;
  if (typeof (val as any).toMillis === 'function') return (val as any).toMillis();
  if (typeof (val as any).toDate === 'function') return (val as any).toDate().getTime();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ─── FIX #M2: Normalize status ke UPPERCASE ───────────────────────────────────
const normalizeStatus = (status: unknown): string => {
  if (!status || typeof status !== 'string') return 'PENDING';
  return status.toUpperCase();
};

// ─── FIX #M4: Regex OTP lebih ketat, pola spesifik diutamakan ────────────────
// Tambahan: exclude pola tahun (4 digit 19xx/20xx) agar tidak false match.
const extractOtp = (sms: any): string | null => {
  if (!sms) return null;

  if (sms.code && typeof sms.code === 'string' && sms.code.trim()) {
    return sms.code.trim();
  }

  const text: string = sms.text || sms.Text || '';
  if (typeof text !== 'string' || !text) return null;

  const patterns = [
    // Pola spesifik dengan kata kunci
    /(?:kode|code|otp|pin|verif(?:ication)?|your|adalah)[^\d]*(\d{4,8})/i,
    // 6 digit — umum, tapi hindari tahun (1900-2099)
    /\b(?!(?:19|20)\d{2}\b)(\d{6})\b/,
    /\b(\d{5})\b/,
    // 4 digit — hindari tahun juga
    /\b(?!(?:19|20)\d{2}\b)(\d{4})\b/,
    /\b(\d{7,8})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
};

// ─── FIX #L3: sanitizeSms dengan guard non-object entry ───────────────────────
const sanitizeSms = (sms: unknown): { text: string; code: string | null; createdAt?: string } => {
  if (!sms || typeof sms !== 'object') {
    // Jangan silent fail — log agar mudah debug
    console.warn('[check-otp] sanitizeSms menerima entry non-object:', typeof sms);
    return { text: '', code: null };
  }
  const s = sms as Record<string, unknown>;
  return {
    text:      typeof s.text === 'string' ? s.text : '',
    code:      s.code ? String(s.code) : null,
    createdAt: typeof s.created_at === 'string' ? s.created_at
             : typeof s.date       === 'string' ? s.date
             : undefined,
  };
};

// ─── FIX #M3: Sort SMS array berdasarkan waktu (terbaru di akhir) ─────────────
const sortSmsArray = (arr: any[]): any[] => {
  return [...arr].sort((a, b) => {
    const ta = a?.created_at ? new Date(a.created_at).getTime() : (a?.date ? new Date(a.date).getTime() : 0);
    const tb = b?.created_at ? new Date(b.created_at).getTime() : (b?.date ? new Date(b.date).getTime() : 0);
    return ta - tb; // ascending: terbaru di index terakhir
  });
};

const extractSmsArray = (data: any): any[] => {
  if (!data) return [];
  for (const key of ['sms', 'Sms', 'SMS', 'Data', 'data', 'messages', 'Messages']) {
    if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
  }
  return [];
};

// ─── FIX #M2: Status final UPPERCASE konsisten ───────────────────────────────
const FINAL_STATUSES = ['SUCCESS', 'COMPLETED', 'CANCELLED'];

export async function GET(request: Request) {
  try {
    // ── 1. Autentikasi ──────────────────────────────────────────────────────────
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

    // ── 2. Validasi orderId ─────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId || !/^\d{1,20}$/.test(orderId)) {
      return NextResponse.json({ error: 'Parameter orderId tidak valid.' }, { status: 400 });
    }

    // ── 3. Ambil order dari Firestore ──────────────────────────────────────────
    const userRef   = adminDb.collection('users').doc(uid);
    const orderRef  = userRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    // ─── FIX #C3: Validasi provider sebelum apapun ────────────────────────────
    // Mencegah order SA/provider lain masuk ke flow 5sim dan terkena refund/cancel ganda.
    if (orderData.provider !== '5sim') {
      return NextResponse.json({ error: 'Order ini bukan order 5sim.' }, { status: 400 });
    }

    // ─── FIX #H5: Validasi fiveSimOrderId — fallback ke null, bukan ke orderId ──
    // orderId = Firestore doc ID, BUKAN 5sim order ID. Fallback ke orderId sebelumnya
    // bisa menyebabkan request ke 5sim dengan ID yang salah atau milik user lain.
    const rawFiveSimId = orderData.id ?? null;
    const fiveSimOrderId: string | null = rawFiveSimId && /^\d{1,20}$/.test(String(rawFiveSimId))
      ? String(rawFiveSimId)
      : null;

    if (!fiveSimOrderId) {
      console.error('[check-otp] fiveSimOrderId tidak valid untuk orderId:', orderId, 'rawId:', rawFiveSimId);
      return NextResponse.json({ error: 'Data order tidak lengkap. Hubungi support.' }, { status: 500 });
    }

    if (orderData.status !== 'active') {
      return NextResponse.json({
        status: orderData.status,
        otp:    orderData.otp || null,
        number: orderData.number,
      });
    }

    // ── 4. Cek expiry di backend ────────────────────────────────────────────────
    const ORDER_DURATION_MS = 20 * 60 * 1000;
    const createdAtMs = toMs(orderData.createdAt || orderData.timestamp);

    // ─── FIX #H6: Gunakan ?? null bukan || untuk hindari falsy trap ──────────────
    // Jika expiresAt ada tapi bernilai 0 (falsy), || akan mengabaikannya dan
    // fallback ke perhitungan ulang — salah. Gunakan != null untuk cek eksistensi.
    const storedExpiresAt = orderData.expiresAt != null ? toMs(orderData.expiresAt) : null;
    const expiresAtMs     = storedExpiresAt !== null
      ? storedExpiresAt
      : (createdAtMs ? createdAtMs + ORDER_DURATION_MS : 0);

    const now = Date.now();

    if (expiresAtMs > 0 && now > expiresAtMs) {
      const mutasiRef = userRef.collection('transactions').doc(`${orderId}_refund`);

      try {
        await adminDb.runTransaction(async (t) => {
          const freshOrder = await t.get(orderRef);
          if (!freshOrder.exists || freshOrder.data()?.status !== 'active') {
            throw new Error('ORDER_ALREADY_PROCESSED');
          }

          const price = freshOrder.data()?.price || 0;
          if (price === 0) {
            console.warn(`[check-otp] price=0 untuk orderId=${orderId}, refund Rp0 akan diproses`);
          }

          t.update(orderRef, {
            status:       'canceled',
            cancelReason: 'expired_backend',
            updatedAt:    FieldValue.serverTimestamp(),
          });
          t.update(userRef, {
            balance:    FieldValue.increment(price),
            totalSpent: FieldValue.increment(-price),
          });
          t.set(mutasiRef, {
            type:      'refund',
            amount:    price,
            desc:      `Refund otomatis (expired) - ${(orderData.serviceId || '').toUpperCase()}`,
            status:    'success',
            orderId,
            timestamp: now,
          });
        });
      } catch (refundErr: any) {
        if (refundErr.message !== 'ORDER_ALREADY_PROCESSED') {
          console.error('[check-otp] Refund expired gagal:', refundErr.message);
        }
      }

      // Best-effort cancel ke 5sim
      try {
        const key = process.env.FIVESIM_API_KEY;
        if (key) {
          await fetch(`https://5sim.net/v1/user/cancel/${fiveSimOrderId}`, {
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

    // ── 5. Poll ke 5sim ─────────────────────────────────────────────────────────
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
      const checkRes = await fetch(`https://5sim.net/v1/user/check/${fiveSimOrderId}`, {
        headers: headers5sim,
        signal:  AbortSignal.timeout(10000),
      });

      if (!checkRes.ok) {
        const errText = await checkRes.text().catch(() => '');
        console.warn(`[check-otp] 5sim check HTTP ${checkRes.status}:`, errText.substring(0, 100));
        return NextResponse.json({
          status:      'active',
          otp:         null,
          remainingMs: expiresAtMs > 0 ? Math.max(0, expiresAtMs - now) : undefined,
          warning:     `5sim API error ${checkRes.status}, akan dicoba lagi.`,
        });
      }

      simData = await checkRes.json();
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      if (!isTimeout) console.error('[check-otp] Fetch error:', err?.message);
      return NextResponse.json({
        status:      'active',
        otp:         null,
        remainingMs: expiresAtMs > 0 ? Math.max(0, expiresAtMs - now) : undefined,
        warning:     isTimeout ? 'Timeout saat polling, akan dicoba lagi.' : undefined,
      });
    }

    const simStatus: string = normalizeStatus(simData?.status);

    if (process.env.NODE_ENV === 'development') {
      const smsCount = Array.isArray(simData?.sms) ? simData.sms.length : 0;
      console.log(`[check-otp] status=${simStatus} smsCount=${smsCount}`);
    }

    // ─── FIX #M3: Sort SMS array sebelum ambil OTP ───────────────────────────
    let smsArr    = sortSmsArray(extractSmsArray(simData));
    let latestOtp = smsArr.length > 0 ? extractOtp(smsArr[smsArr.length - 1]) : null;
    if (!latestOtp && simData?.code) latestOtp = String(simData.code).trim() || null;

    // ── 6. Handle TIMEOUT / CANCELED dari 5sim → refund ───────────────────────
    if (simStatus === 'TIMEOUT' || simStatus === 'CANCELED') {
      const mutasiRef = userRef.collection('transactions').doc(`${orderId}_refund`);

      try {
        await adminDb.runTransaction(async (t) => {
          const freshOrder = await t.get(orderRef);
          if (!freshOrder.exists || freshOrder.data()?.status !== 'active') {
            throw new Error('ORDER_ALREADY_PROCESSED');
          }

          const price = freshOrder.data()?.price || 0;
          if (price === 0) {
            console.warn(`[check-otp] price=0 untuk orderId=${orderId} saat ${simStatus}`);
          }

          const serviceId = freshOrder.data()?.serviceId || orderData.serviceId || '';

          t.update(orderRef, { status: 'canceled', updatedAt: FieldValue.serverTimestamp() });
          t.update(userRef, {
            balance:    FieldValue.increment(price),
            totalSpent: FieldValue.increment(-price),
          });
          t.set(mutasiRef, {
            type:      'refund',
            amount:    price,
            desc:      `Refund otomatis (${simStatus}) - ${serviceId.toUpperCase()}`,
            status:    'success',
            orderId,
            timestamp: Date.now(),
          });
        });
      } catch (refundErr: any) {
        if (refundErr.message !== 'ORDER_ALREADY_PROCESSED') {
          console.error('[check-otp] Refund gagal:', refundErr.message);
        }
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

    // ── 7. RECEIVED/FINISHED tapi SMS kosong → panggil /finish ────────────────
    if ((simStatus === 'RECEIVED' || simStatus === 'FINISHED') && !latestOtp) {
      // ─── FIX #M5: Re-check status Firestore sebelum panggil /finish ──────────
      // Hindari panggil /finish untuk order yang sudah final (canceled/success).
      const freshForFinish = await orderRef.get();
      const freshStatus    = freshForFinish.data()?.status;
      if (!freshForFinish.exists || (freshStatus && freshStatus !== 'active')) {
        console.log('[check-otp] Skip /finish — order sudah tidak active:', freshStatus);
      } else {
        try {
          const finishRes = await fetch(`https://5sim.net/v1/user/finish/${fiveSimOrderId}`, {
            method: 'GET', headers: headers5sim, signal: AbortSignal.timeout(10000),
          });
          if (finishRes.ok) {
            const finishData = await finishRes.json();
            const finishSms  = sortSmsArray(extractSmsArray(finishData)); // FIX #M3 juga
            latestOtp = finishSms.length > 0
              ? extractOtp(finishSms[finishSms.length - 1])
              : (finishData?.code ? String(finishData.code).trim() : null);
            if (finishSms.length > 0) smsArr = finishSms;
          }
        } catch { /* best effort */ }
      }
    }

    // ── 8. OTP ada → simpan ke Firestore ───────────────────────────────────────
    if (latestOtp) {
      if (latestOtp !== orderData.otp) {
        try {
          await adminDb.runTransaction(async (t) => {
            const freshOrder = await t.get(orderRef);
            if (freshOrder.data()?.status !== 'active') return;

            t.update(orderRef, {
              status:    'success',
              otp:       latestOtp,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
        } catch (updateErr: any) {
          console.warn('[check-otp] OTP update gagal:', updateErr?.message);
        }
      }

      return NextResponse.json({
        status: 'success',
        otp:    latestOtp,
        number: orderData.number,
        allSms: smsArr.map(sanitizeSms),
      });
    }

    // ── 9. Masih menunggu ───────────────────────────────────────────────────────
    return NextResponse.json({
      status:      'active',
      otp:         null,
      number:      orderData.number,
      allSms:      smsArr.map(sanitizeSms),
      ...(expiresAtMs > 0 && { remainingMs: Math.max(0, expiresAtMs - now) }),
    });

  } catch (error: any) {
    console.error('[check-otp] Error:', error.message);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}