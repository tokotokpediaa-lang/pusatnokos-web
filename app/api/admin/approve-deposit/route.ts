// app/api/admin/approve-deposit/route.ts
// FIXES APPLIED:
//  [MEDIUM] Validasi format txId dan userId dengan regex ketat
//  [LOW]    Komentar diselaraskan dengan kode (totalSpent → totalDeposited)

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

// ✅ FIX [MEDIUM]: Regex untuk validasi format ID dari request body.
// Firestore UID Firebase selalu 28 karakter alphanumeric.
// txId bisa lebih panjang (mis. timestamp-based) tapi tetap dibatasi.
const UID_PATTERN = /^[a-zA-Z0-9]{20,128}$/;
const TXID_PATTERN = /^[a-zA-Z0-9_\-]{1,128}$/;

export async function POST(request: Request) {
  // ── 1. Autentikasi ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    const token = authHeader.split('Bearer ')[1];
    decodedToken = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { message: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid.' },
      { status: 401 }
    );
  }

  // ── 2. Otorisasi: JWT Custom Claim ───────────────────────────────────────────
  if (decodedToken.admin !== true) {
    return NextResponse.json(
      { message: 'Hanya Admin yang diizinkan mengakses endpoint ini.' },
      { status: 403 }
    );
  }

  try {
    // ── 3. Validasi body ──────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const { txId, userId } = body;

    // ✅ FIX [MEDIUM]: Validasi format dengan regex ketat, bukan hanya typeof + trim.
    // Sebelumnya string panjang sembarang atau karakter aneh bisa masuk ke Firestore path.
    if (typeof txId !== 'string' || !TXID_PATTERN.test(txId)) {
      return NextResponse.json({ message: 'txId tidak valid.' }, { status: 400 });
    }
    if (typeof userId !== 'string' || !UID_PATTERN.test(userId)) {
      return NextResponse.json({ message: 'userId tidak valid.' }, { status: 400 });
    }

    const txRef   = adminDb.collection('users').doc(userId).collection('transactions').doc(txId);
    const userRef = adminDb.collection('users').doc(userId);

    // ── 4. Proses approve dalam Firestore Transaction (atomic) ───────────────
    await adminDb.runTransaction(async (t) => {
      const [txDoc, userDoc] = await Promise.all([t.get(txRef), t.get(userRef)]);

      if (!txDoc.exists)   throw new Error('Transaksi tidak ditemukan.');
      if (!userDoc.exists) throw new Error('Akun user tidak ditemukan.');

      const txData   = txDoc.data()!;
      const userData = userDoc.data()!;

      // Idempotency — cegah double-approve
      if (txData.status !== 'pending') {
        throw new Error('Transaksi ini sudah diproses sebelumnya.');
      }

      // Verifikasi kepemilikan transaksi
      if (txData.userId !== userId) {
        throw new Error('Mismatch: transaksi ini bukan milik user yang dimaksud.');
      }

      const amount = txData.amount;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Amount pada transaksi tidak valid.');
      }

      t.update(txRef, {
        status:     'success',
        approvedAt: Date.now(),
        approvedBy: decodedToken.uid,
      });

      t.update(userRef, {
        balance: admin.firestore.FieldValue.increment(amount),
        // ✅ FIX [LOW]: Komentar header menyebut totalSpent tapi deposit bukan belanja.
        // Diganti dengan totalDeposited untuk tracking akumulasi deposit secara terpisah.
        totalDeposited: admin.firestore.FieldValue.increment(amount),
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Deposit disetujui & saldo berhasil ditambahkan.',
    });

  } catch (error: any) {
    const businessErrors = [
      'Transaksi tidak ditemukan.',
      'Akun user tidak ditemukan.',
      'Transaksi ini sudah diproses sebelumnya.',
      'Mismatch: transaksi ini bukan milik user yang dimaksud.',
      'Amount pada transaksi tidak valid.',
    ];

    if (businessErrors.includes(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error('[approve-deposit] Unhandled error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}