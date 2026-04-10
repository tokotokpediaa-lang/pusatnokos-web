import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebaseAdmin'; // ✅ FIX #1: import dari lib terpusat
import { FieldValue } from 'firebase-admin/firestore';

const CANCELLABLE_STATUSES = ['active', 'pending', 'PENDING'];

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Akses ditolak.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token); // ✅ FIX #1: pakai adminAuth
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ message: 'Token tidak valid. Silakan login ulang.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ message: 'orderId wajib diisi.' }, { status: 400 });
    }

    // ✅ FIX #3: Validasi orderId — samakan dengan check-otp (hanya angka)
    if (!/^\d{1,20}$/.test(String(orderId))) {
      return NextResponse.json({ message: 'orderId tidak valid.' }, { status: 400 });
    }

    const userRef   = adminDb.collection('users').doc(uid); // ✅ FIX #1: pakai adminDb
    const orderRef  = userRef.collection('orders').doc(String(orderId));
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    if (!CANCELLABLE_STATUSES.includes(orderData.status)) {
      return NextResponse.json({
        message: `Pesanan tidak bisa dibatalkan (status: ${orderData.status}).`,
      }, { status: 400 });
    }

    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      return NextResponse.json({ message: 'Konfigurasi server bermasalah.' }, { status: 500 });
    }

    try {
      const fiveSimOrderId = orderData.id ?? orderId;
      const cancelRes = await fetch(`https://5sim.net/v1/user/cancel/${fiveSimOrderId}`, {
        headers: {
          'Authorization': `Bearer ${FIVE_SIM_API_KEY}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const rawText = await cancelRes.text();
      let simData: any = {};
      try { simData = JSON.parse(rawText); } catch { /* ok */ }

      if (!cancelRes.ok && simData?.message !== 'already canceled') {
        console.warn(`[cancel-order] 5sim cancel ${cancelRes.status}:`, rawText.substring(0, 100));
      }
    } catch (err: any) {
      console.warn('[cancel-order] 5sim cancel error (lanjut refund):', err?.message);
    }

    const refundAmount = orderData.price || 0;
    const now = Date.now();

    await adminDb.runTransaction(async (t) => { // ✅ FIX #1: pakai adminDb
      const userSnap     = await t.get(userRef);
      const currentSpent = userSnap.data()?.totalSpent || 0;
      const newTotalSpent = Math.max(0, currentSpent - refundAmount); // ✅ FIX #2: sinkronkan totalSpent

      t.update(userRef, {
        balance:    FieldValue.increment(refundAmount),
        totalSpent: newTotalSpent, // ✅ FIX #2: update totalSpent
      });

      t.update(orderRef, {
        status:    'canceled',
        updatedAt: now,
      });

      const mutasiRef = userRef.collection('transactions').doc(`${orderId}_refund`);
      t.set(mutasiRef, {
        type:      'refund',
        amount:    refundAmount,
        desc:      `Refund pembatalan - ${(orderData.serviceId || '').toUpperCase()}`,
        status:    'success',
        orderId:   String(orderId),
        timestamp: now,
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Pesanan dibatalkan. Saldo telah dikembalikan.',
      refundAmount,
    });

  } catch (error: any) {
    console.error('[cancel-order] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Terjadi kesalahan server.' },
      { status: 500 },
    );
  }
}