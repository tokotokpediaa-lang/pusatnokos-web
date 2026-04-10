/**
 * GET /api/paymenku/check-status?ref=INV-xxx
 * Cek status transaksi ke Paymenku API.
 * Jika sudah "paid" dan belum diproses → top-up saldo otomatis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAYMENKU_API_KEY = process.env.PAYMENKU_API_KEY!;

// ✅ FIX: Status Paymenku yang dianggap "berhasil dibayar"
const PAID_STATUSES = ['paid', 'PAID', 'settlement', 'completed', 'success'];

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('ref');
    if (!ref) {
      return NextResponse.json({ message: 'Parameter ref diperlukan.' }, { status: 400 });
    }

    // 1. Cek status ke Paymenku
    const res  = await fetch(`https://paymenku.com/api/v1/check-status/${ref}`, {
      headers: { Authorization: `Bearer ${PAYMENKU_API_KEY}` },
      cache: 'no-store',
    });
    const data = await res.json();
    console.log('[check-status] Paymenku response:', JSON.stringify(data));

    const rawStatus = data?.data?.status || data?.status || '';
    const isPaid    = PAID_STATUSES.includes(rawStatus);

    // 2. Kalau belum paid → kembalikan status saja
    // ✅ FIX: Return 'paid' ke client supaya frontend bisa trigger success flow
    if (!isPaid) {
      return NextResponse.json({ status: rawStatus || 'pending' });
    }

    // 3. Sudah paid → proses top-up jika belum
    const txRef  = adminDb.collection('transactions').doc(ref);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      return NextResponse.json({ status: 'paid', alreadyProcessed: false });
    }

    const tx = txSnap.data()!;

    // ✅ FIX: Cek kedua status (idempotency)
    if (tx.status === 'success' || tx.status === 'paid') {
      // Webhook sudah jalan duluan atau sudah diproses
      return NextResponse.json({ status: 'paid', alreadyProcessed: true });
    }

    // Proses top-up
    const userId = tx.userId as string;
    const amount = tx.amount as number;

    await adminDb.runTransaction(async (t) => {
      const userRef  = adminDb.collection('users').doc(userId);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new Error(`User ${userId} tidak ditemukan.`);
      t.update(userRef, { balance: FieldValue.increment(amount) });
      t.update(txRef, {
        // ✅ FIX: Simpan sebagai 'success' agar MutasiPage tampil "Berhasil"
        status:  'success',
        paidAt:  FieldValue.serverTimestamp(),
        paidVia: 'check-status',
        rawPaymenStatus: rawStatus, // simpan status asli Paymenku untuk audit
      });
    });

    console.info(`[check-status] ✅ +Rp${amount.toLocaleString('id-ID')} → ${userId}`);
    return NextResponse.json({ status: 'paid', alreadyProcessed: false, topedUp: true });

  } catch (err: any) {
    console.error('[check-status] Error:', err?.message || err);
    return NextResponse.json({ message: 'Gagal cek status.' }, { status: 500 });
  }
}