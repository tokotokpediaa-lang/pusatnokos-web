// app/api/smsactivate/cancel/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const SA_API_KEY = process.env.SMSACTIVATE_API_KEY;

export async function POST(req: NextRequest) {
  // Validasi Firebase token dari frontend
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
  }

  let body: { activationId?: string; orderId?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { activationId, orderId, userId } = body;

  if (!activationId || !orderId || !userId) {
    return NextResponse.json({ error: 'activationId, orderId, userId wajib diisi' }, { status: 400 });
  }

  // Pastikan userId dari body sama dengan token — anti manipulasi
  if (uid !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const userRef   = adminDb.collection('users').doc(userId);
    const orderRef  = userRef.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    if (['SUCCESS', 'COMPLETED', 'CANCELLED'].includes(orderData.status)) {
      return NextResponse.json({ error: 'Order sudah final' }, { status: 400 });
    }

    // Cancel di SMS-Activate (status=8)
    if (SA_API_KEY) {
      try {
        const url = `https://api.sms-activate.org/stubs/handler_api.php?api_key=${SA_API_KEY}&action=setStatus&id=${activationId}&status=8`;
        const saRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
        console.log('[cancel-sa] SA response:', await saRes.text());
      } catch (err: any) {
        console.warn('[cancel-sa] Gagal cancel di SA:', err.message);
      }
    }

    // Refund Firestore dalam transaction
    const refundAmount = orderData.price ?? 0;
    const mutasiRef = userRef.collection('transactions').doc(`${activationId}_cancel_refund`);

    await adminDb.runTransaction(async (t) => {
      const fresh = await t.get(orderRef);
      if (!fresh.exists) return;

      const freshStatus = fresh.data()?.status;
      if (['SUCCESS', 'COMPLETED', 'CANCELLED'].includes(freshStatus)) return;

      const mutasiSnap = await t.get(mutasiRef);
      if (mutasiSnap.exists) return; // Anti double-refund

      t.update(orderRef, {
        status:    'CANCELLED',
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (refundAmount > 0) {
        t.update(userRef, {
          balance:    FieldValue.increment(refundAmount),
          totalSpent: FieldValue.increment(-refundAmount),
        });

        t.set(mutasiRef, {
          type:        'refund',
          amount:      refundAmount,
          desc:        `Refund manual - ${(orderData.serviceId ?? orderData.service ?? 'Nomor').toUpperCase()} (Server 2) dibatalkan user`,
          status:      'success',
          orderId,
          activationId,
          timestamp:   Date.now(),
        });
      }
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('[cancel-sa] Error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}