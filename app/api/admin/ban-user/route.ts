// app/api/admin/ban-user/route.ts
// ============================================================
// SECURITY FIX: ADMIN_EMAILS dihapus → JWT Custom Claim admin:true + checkRevoked
// ============================================================

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

// ✅ FIX [CRITICAL]: Regex ketat untuk userId — konsisten dengan reject-deposit.
// Validasi sebelumnya hanya typeof + trim() sehingga string apapun bisa lolos.
const UID_PATTERN = /^[a-zA-Z0-9]{20,128}$/;

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
      { message: isRevoked ? 'Sesi telah berakhir. Login ulang.' : 'Token tidak valid.' },
      { status: 401 }
    );
  }

  // ✅ JWT Custom Claim — tidak bisa dimanipulasi client
  if (decodedToken.admin !== true) {
    return NextResponse.json({ message: 'Hanya Admin yang diizinkan!' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userId, banned, reason } = body;

    // ✅ FIX [CRITICAL]: Ganti validasi lemah (typeof + trim) dengan regex ketat.
    if (typeof userId !== 'string' || !UID_PATTERN.test(userId)) {
      return NextResponse.json({ message: 'userId tidak valid.' }, { status: 400 });
    }
    if (typeof banned !== 'boolean') {
      return NextResponse.json({ message: 'Parameter banned harus boolean.' }, { status: 400 });
    }

    // Cegah admin ban dirinya sendiri
    if (userId === decodedToken.uid) {
      return NextResponse.json({ message: 'Tidak bisa suspend akun sendiri!' }, { status: 400 });
    }

    const db     = adminDb;
    const auth   = adminAuth;
    const userRef = db.collection('users').doc(userId);

    await Promise.all([
      userRef.update({
        banned,
        banReason: banned ? (typeof reason === 'string' ? reason.substring(0, 200) : 'Pelanggaran kebijakan layanan') : null,
        bannedAt:  banned ? Date.now() : null,
        bannedBy:  decodedToken.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      auth.updateUser(userId, { disabled: banned }),
    ]);

    // Jika ban → batalkan order aktif + refund
    if (banned) {
      try {
        const activeOrders = await userRef.collection('orders').where('status', '==', 'active').get();
        if (!activeOrders.empty) {
          const batch = db.batch();
          let totalRefund = 0;
          activeOrders.forEach(orderDoc => {
            const orderData = orderDoc.data();
            batch.update(orderDoc.ref, {
              status: 'canceled',
              cancelReason: 'Akun ditangguhkan oleh admin',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            totalRefund += orderData.price || 0;
          });
          if (totalRefund > 0) {
            batch.update(userRef, { balance: admin.firestore.FieldValue.increment(totalRefund) });
            // ✅ FIX [CRITICAL]: Simpan userId di dokumen transaksi agar riwayat
            // tidak broken dan konsisten dengan cara reject-deposit membaca data.
            batch.set(userRef.collection('transactions').doc(), {
              type: 'refund', amount: totalRefund, userId,
              desc: 'Refund otomatis akibat akun ditangguhkan',
              status: 'success', timestamp: Date.now(),
            });
          }
          await batch.commit();
        }
      } catch (refundErr: any) {
        console.warn('[ban-user] Gagal refund order aktif:', refundErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: banned ? 'Akun berhasil ditangguhkan. Order aktif telah direfund.' : 'Akun berhasil dipulihkan.',
    });

  } catch (error: any) {
    console.error('[ban-user] Error:', error.message);
    return NextResponse.json({ message: error.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}