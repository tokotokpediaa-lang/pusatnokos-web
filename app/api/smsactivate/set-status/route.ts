// /api/smsactivate/set-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const SA_BASE = 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid     = decoded.uid;

    const { orderId, status } = await req.json();
    if (!orderId || status === undefined) {
      return NextResponse.json({ error: 'orderId & status required' }, { status: 400 });
    }

    const orderRef  = adminDb.collection('users').doc(uid).collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

    const order = orderSnap.data()!;
    if (order.userId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (order.provider !== 'smsactivate') return NextResponse.json({ error: 'Provider mismatch' }, { status: 400 });

    // ── Kirim status ke HeroSms ──────────────────────────────────
    const saRes  = await fetch(`${SA_BASE}?action=setStatus&api_key=${SA_KEY}&id=${order.activationId}&status=${status}`);
    const saText = await saRes.text();

    const userRef = adminDb.collection('users').doc(uid);
    const now     = Date.now();

    if (status === 8) {
      // ── CANCEL: kembalikan saldo + catat refund ke mutasi ──────
      const refundPrice   = order.price ?? 0;
      const displayName   = order.saName || order.serviceId || order.service || 'Nomor';
      const mutasiRefRef  = adminDb.collection('users').doc(uid).collection('transactions').doc();

      // ✅ FIX #1: Gunakan FieldValue.increment — atomic, tidak ada race condition
      // ✅ FIX #2: Catat transaksi refund ke mutasi agar muncul di Mutasi Saldo
      await adminDb.runTransaction(async (t) => {
        t.update(orderRef, {
          status:    'CANCELLED',
          updatedAt: new Date(now).toISOString(),
        });

        t.update(userRef, {
          balance: FieldValue.increment(refundPrice),
        });

        t.set(mutasiRefRef, {
          type:      'refund',
          amount:    refundPrice,   // ✅ positif = saldo masuk
          desc:      `Refund: Beli nomor ${displayName.toUpperCase()} (Server 2) dibatalkan`,
          status:    'success',
          orderId:   orderId,
          timestamp: now,
        });
      });

    } else if (status === 6) {
      // ── COMPLETE: tandai order selesai ────────────────────────
      await orderRef.update({
        status:    'COMPLETED',
        updatedAt: new Date(now).toISOString(),
      });
    }

    return NextResponse.json({ success: true, saResponse: saText });
  } catch (err: any) {
    console.error('[smsactivate/set-status]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}