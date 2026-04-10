// app/api/timeout-order/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'; // ✅ FIX #1: import dari lib terpusat
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token); // ✅ FIX #1: pakai adminAuth
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId wajib diisi' }, { status: 400 });
    }

    // ✅ FIX #3: Validasi orderId — konsisten dengan endpoint lain
    if (!/^\d{1,20}$/.test(String(orderId))) {
      return NextResponse.json({ error: 'orderId tidak valid.' }, { status: 400 });
    }

    const orderRef  = adminDb.collection('users').doc(uid).collection('orders').doc(String(orderId)); // ✅ FIX #1: pakai adminDb
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    if (orderData.status !== 'active') {
      return NextResponse.json({ status: 'ignored', message: 'Order sudah tidak aktif' });
    }

    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      return NextResponse.json({ error: 'Konfigurasi server bermasalah' }, { status: 500 });
    }

    const fiveSimOrderId = orderData.fiveSimId || orderId;
    let cancelStatus = 'CANCELED';

    try {
      const cancelRes = await fetch(`https://5sim.net/v1/user/cancel/${fiveSimOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FIVE_SIM_API_KEY}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const rawText = await cancelRes.text();

      try {
        const cancelData = JSON.parse(rawText);
        cancelStatus = cancelData?.status || 'CANCELED';
      } catch {
        console.warn('[timeout-order] 5sim non-JSON:', rawText.substring(0, 100));
        if (rawText.toLowerCase().includes('order not found') || !cancelRes.ok) {
          cancelStatus = 'CANCELED';
        }
      }
    } catch (fetchErr: any) {
      console.warn('[timeout-order] Fetch 5sim gagal:', fetchErr.message);
      cancelStatus = 'CANCELED';
    }

    if (cancelStatus !== 'CANCELED' && cancelStatus !== 'TIMEOUT') {
      return NextResponse.json(
        { error: `Status dari 5sim tidak valid: ${cancelStatus}` },
        { status: 400 }
      );
    }

    const userRef   = adminDb.collection('users').doc(uid); // ✅ FIX #1: pakai adminDb
    const mutasiRef = userRef.collection('transactions').doc();

    await adminDb.runTransaction(async (t) => { // ✅ FIX #1: pakai adminDb
      const freshOrder = await t.get(orderRef);

      if (!freshOrder.exists || freshOrder.data()?.status !== 'active') {
        throw new Error('ORDER_ALREADY_PROCESSED');
      }

      const userSnap      = await t.get(userRef);
      const currentSpent  = userSnap.data()?.totalSpent || 0;
      const refundAmount  = orderData.price || 0;
      const newTotalSpent = Math.max(0, currentSpent - refundAmount); // ✅ FIX #2: hitung totalSpent baru

      t.update(orderRef, {
        status:    'canceled',
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.update(userRef, {
        balance:    FieldValue.increment(refundAmount),
        totalSpent: newTotalSpent, // ✅ FIX #2: sinkronkan totalSpent, tidak lagi terlewat
      });

      t.set(mutasiRef, {
        type:      'refund',
        amount:    refundAmount,
        desc:      `Refund otomatis (Timeout) - ${(orderData.serviceId || '').toUpperCase()}`,
        status:    'success',
        timestamp: Date.now(),
      });
    });

    return NextResponse.json({
      status:  'success',
      message: 'Timeout diproses, saldo dikembalikan.',
    });

  } catch (error: any) {
    if (error.message === 'ORDER_ALREADY_PROCESSED') {
      return NextResponse.json({ status: 'ignored', message: 'Order sudah diproses sebelumnya' });
    }
    console.error('[timeout-order] Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}