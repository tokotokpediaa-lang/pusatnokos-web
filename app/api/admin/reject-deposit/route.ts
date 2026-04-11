// app/api/admin/reject-deposit/route.ts
// FIXES APPLIED:
//  [MEDIUM] Validasi format txId dan userId dengan regex ketat
//  [BUG FIX] Pengecekan txData.userId dibuat opsional
//  [BUG FIX] Path transaksi dipindah ke root collection 'transactions'

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

const UID_PATTERN  = /^[a-zA-Z0-9]{20,128}$/;
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

    if (typeof txId !== 'string' || !TXID_PATTERN.test(txId)) {
      return NextResponse.json({ message: 'txId tidak valid.' }, { status: 400 });
    }
    if (typeof userId !== 'string' || !UID_PATTERN.test(userId)) {
      return NextResponse.json({ message: 'userId tidak valid.' }, { status: 400 });
    }

    // ✅ BUG FIX: Pakai root collection 'transactions', bukan subcollection user
    const txRef = adminDb.collection('transactions').doc(txId);

    // ── 4. Proses reject dalam Firestore Transaction (atomic) ─────────────────
    await adminDb.runTransaction(async (t) => {
      const txDoc = await t.get(txRef);

      if (!txDoc.exists) throw new Error('Transaksi tidak ditemukan.');

      const txData = txDoc.data()!;

      if (txData.status !== 'pending') {
        throw new Error('Transaksi ini sudah diproses sebelumnya.');
      }

      if (txData.userId !== undefined && txData.userId !== userId) {
        throw new Error('Mismatch: transaksi ini bukan milik user yang dimaksud.');
      }

      t.update(txRef, {
        status:     'failed',
        rejectedAt: Date.now(),
        rejectedBy: decodedToken.uid,
      });
    });

    return NextResponse.json({ success: true, message: 'Deposit berhasil ditolak.' });

  } catch (error: any) {
    const businessErrors = [
      'Transaksi tidak ditemukan.',
      'Transaksi ini sudah diproses sebelumnya.',
      'Mismatch: transaksi ini bukan milik user yang dimaksud.',
    ];
    if (businessErrors.includes(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error('[reject-deposit] Unhandled error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}