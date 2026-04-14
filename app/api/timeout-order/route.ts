// app/api/timeout-order/route.ts
// FIXES APPLIED:
//  [BUG FIX #1] fiveSimId → pakai field 'id' (sesuai yang disimpan buy-number)
//  [BUG FIX #2] Status 'canceled' → 'CANCELLED' (uppercase konsisten dengan semua route lain)
//  [BUG FIX #3] Race condition totalSpent → pakai FieldValue.increment (atomic)
//  [BUG FIX #4] refundAmount dibaca dari freshOrder di dalam tx, bukan dari orderData di luar tx
//  [IMPROVE]    Tambah orderId di mutasi untuk traceability
//  [IMPROVE]    Tambah checkRevoked pada verifyIdToken

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// Status final konsisten UPPERCASE — harus sama dengan semua route lain
const FINAL_STATUSES = ['SUCCESS', 'COMPLETED', 'CANCELLED'];

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      // ✅ Tambah checkRevoked agar sesi yang sudah logout tidak bisa dipakai
      const decoded = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);
      uid = decoded.uid;
    } catch (err: any) {
      const isRevoked = err?.code === 'auth/id-token-revoked';
      return NextResponse.json(
        { error: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId wajib diisi' }, { status: 400 });
    }

    if (!/^\d{1,20}$/.test(String(orderId))) {
      return NextResponse.json({ error: 'orderId tidak valid.' }, { status: 400 });
    }

    const orderIdStr = String(orderId);
    const userRef    = adminDb.collection('users').doc(uid);
    const orderRef   = userRef.collection('orders').doc(orderIdStr);
    const orderSnap  = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    // ✅ Cek final status pakai array konsisten (termasuk 'CANCELLED' uppercase)
    if (FINAL_STATUSES.includes(orderData.status) || orderData.status === 'canceled') {
      return NextResponse.json({ status: 'ignored', message: 'Order sudah tidak aktif' });
    }

    if (orderData.status !== 'active') {
      return NextResponse.json({ status: 'ignored', message: 'Order sudah tidak aktif' });
    }

    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      return NextResponse.json({ error: 'Konfigurasi server bermasalah' }, { status: 500 });
    }

    // ✅ FIX #1: buy-number menyimpan field 'id', bukan 'fiveSimId'
    // Sebelumnya: orderData.fiveSimId → selalu undefined → cancel pakai orderId yang salah
    const fiveSimOrderId = orderData.id || orderIdStr;

    let cancelSuccess = false;

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
        const cancelData  = JSON.parse(rawText);
        const cancelStatus = (cancelData?.status ?? '').toUpperCase();

        // 5sim mengembalikan 'CANCELED' atau 'TIMEOUT' sebagai status berhasil
        cancelSuccess = ['CANCELED', 'TIMEOUT'].includes(cancelStatus);

        // Jika sudah canceled sebelumnya di 5sim, tetap anggap sukses
        if (!cancelSuccess && (
          rawText.toLowerCase().includes('already cancel') ||
          rawText.toLowerCase().includes('order is cancel')
        )) {
          cancelSuccess = true;
        }
      } catch {
        console.warn('[timeout-order] 5sim non-JSON response:', rawText.substring(0, 100));
        // Jika tidak bisa parse JSON tapi HTTP ok, anggap berhasil
        if (cancelRes.ok || rawText.toLowerCase().includes('order not found')) {
          cancelSuccess = true;
        }
      }
    } catch (fetchErr: any) {
      // Jika fetch gagal (timeout, network error), tetap proses refund di Firestore
      // agar user tidak stuck. Catat warning untuk investigasi manual.
      console.warn('[timeout-order] Fetch cancel 5sim gagal (refund tetap diproses):', fetchErr.message);
      cancelSuccess = true;
    }

    if (!cancelSuccess) {
      console.error('[timeout-order] 5sim menolak cancel. orderId:', orderIdStr, 'fiveSimOrderId:', fiveSimOrderId);
      return NextResponse.json(
        { error: 'Gagal membatalkan nomor di provider. Silakan coba lagi atau hubungi support.' },
        { status: 502 },
      );
    }

    const mutasiRef = userRef.collection('transactions').doc(`${orderIdStr}_timeout_refund`);

    try {
      await adminDb.runTransaction(async (t) => {
        const freshOrder = await t.get(orderRef);

        // ✅ Re-check di dalam tx untuk hindari race condition
        if (!freshOrder.exists) throw new Error('ORDER_ALREADY_PROCESSED');

        const freshStatus = freshOrder.data()?.status;
        if (FINAL_STATUSES.includes(freshStatus) || freshStatus === 'canceled') {
          throw new Error('ORDER_ALREADY_PROCESSED');
        }

        // ✅ FIX #4: Baca price dari freshOrder di dalam tx, bukan dari orderData di luar tx
        const refundAmount = freshOrder.data()?.price || 0;

        if (refundAmount <= 0) {
          console.warn('[timeout-order] refundAmount 0 atau tidak ada. orderId:', orderIdStr);
        }

        // ✅ FIX #2: Status UPPERCASE konsisten — 'CANCELLED' bukan 'canceled'
        t.update(orderRef, {
          status:    'CANCELLED',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ✅ FIX #3: Atomic increment — tidak ada read-compute-write race condition
        t.update(userRef, {
          balance:    FieldValue.increment(refundAmount),
          totalSpent: FieldValue.increment(-refundAmount),
        });

        // ✅ FIX: Tambah orderId di mutasi untuk traceability
        t.set(mutasiRef, {
          type:      'refund',
          amount:    refundAmount,
          desc:      `Refund otomatis (Timeout) - ${(orderData.serviceId || '').toUpperCase()}`,
          status:    'success',
          orderId:   orderIdStr,
          timestamp: Date.now(),
        });
      });
    } catch (txErr: any) {
      if (txErr.message === 'ORDER_ALREADY_PROCESSED') {
        return NextResponse.json({ status: 'ignored', message: 'Order sudah diproses sebelumnya' });
      }
      throw txErr;
    }

    return NextResponse.json({
      status:  'success',
      message: 'Timeout diproses, saldo dikembalikan.',
    });

  } catch (error: any) {
    console.error('[timeout-order] Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}