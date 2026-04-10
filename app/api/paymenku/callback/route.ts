/**
 * POST /api/paymenku/callback
 * Menerima webhook dari Paymenku saat status transaksi berubah.
 *
 * Webhook Payload dari Paymenku:
 * {
 *   "event": "payment.status_updated",
 *   "trx_id": "IDP202602271039768990",
 *   "reference_id": "INV-001",
 *   "status": "paid",
 *   "amount": "100000.00",
 *   "total_fee": "4000.00",
 *   "amount_received": "96000.00",
 *   "payment_channel": "bca_va",
 *   "customer_name": "...",
 *   "customer_email": "...",
 *   "paid_at": "...",
 *   "created_at": "..."
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ✅ FIX: Status Paymenku yang dianggap "berhasil dibayar"
const PAID_STATUSES = ['paid', 'PAID', 'settlement', 'completed', 'success'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.info('[paymenku/callback] Received:', {
      trx_id:       body.trx_id,
      reference_id: body.reference_id,
      status:       body.status,
      amount:       body.amount,
    });

    // ✅ FIX: Tangkap semua kemungkinan status "paid" dari Paymenku
    const rawStatus = body.status as string;
    const isPaid    = PAID_STATUSES.includes(rawStatus);

    if (!isPaid) {
      console.info('[paymenku/callback] Status bukan paid, skip. Status:', rawStatus);
      return NextResponse.json({ message: 'Bukan status paid, diabaikan.' }, { status: 200 });
    }

    const referenceId = body.reference_id as string;
    if (!referenceId) {
      return NextResponse.json({ message: 'reference_id tidak ada.' }, { status: 400 });
    }

    const txRef  = adminDb.collection('transactions').doc(referenceId);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      console.error('[paymenku/callback] Transaksi tidak ditemukan:', referenceId);
      // Return 200 agar Paymenku tidak retry terus
      return NextResponse.json({ message: 'Transaksi tidak ditemukan.' }, { status: 200 });
    }

    const tx = txSnap.data()!;

    // Idempotency — cegah double top-up
    // ✅ FIX: Cek juga 'success' supaya idempotency tetap jalan
    if (tx.status === 'success' || tx.status === 'paid') {
      console.info('[paymenku/callback] Sudah diproses sebelumnya:', referenceId);
      return NextResponse.json({ message: 'Already processed.' }, { status: 200 });
    }

    const userId = tx.userId as string;
    const amount = tx.amount as number;

    // Atomic: tambah saldo + update status transaksi
    await adminDb.runTransaction(async (t) => {
      const userRef  = adminDb.collection('users').doc(userId);
      const userSnap = await t.get(userRef);

      if (!userSnap.exists) {
        throw new Error(`User ${userId} tidak ditemukan.`);
      }

      t.update(userRef, { balance: FieldValue.increment(amount) });

      t.update(txRef, {
        // ✅ FIX: Simpan sebagai 'success' agar MutasiPage tampil "Berhasil"
        status:         'success',
        paidAt:         FieldValue.serverTimestamp(),
        paymentChannel: body.payment_channel || '',
        amountReceived: body.amount_received  || amount,
        paidVia:        'webhook',
        rawPaymenStatus: rawStatus, // simpan status asli Paymenku untuk audit
      });
    });

    console.info(`[paymenku/callback] ✅ +Rp${amount.toLocaleString('id-ID')} untuk user ${userId}`);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: any) {
    console.error('[paymenku/callback] Error:', err?.message || err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// Paymenku kadang GET untuk verifikasi endpoint
export async function GET() {
  return NextResponse.json({ message: 'Paymenku callback aktif.' }, { status: 200 });
}