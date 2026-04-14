// app/api/admin/reset-leaderboard/route.ts
// ==========================================
// POST /api/admin/reset-leaderboard
// Reset totalSpent semua user menjadi 0.
// Hanya admin yang bisa akses.
// ==========================================

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import '@/lib/firebaseAdmin';

const ADMIN_EMAILS = ['tokotokpediaa@gmail.com'];

export async function POST(request: Request) {
  try {
    const auth = admin.auth();
    const db = admin.firestore();

    // ------------------------------------------
    // 1. VERIFIKASI TOKEN + CEK ROLE ADMIN
    // ------------------------------------------
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.email || !ADMIN_EMAILS.includes(decodedToken.email)) {
      return NextResponse.json({ message: 'Hanya Admin yang diizinkan!' }, { status: 403 });
    }

    // ------------------------------------------
    // 2. RESET totalSpent SEMUA USER
    // ------------------------------------------
    const usersSnap = await db.collection('users').get();

    // Firestore batch max 500 operasi per batch
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let opCount = 0;
    let totalReset = 0;

    for (const docSnap of usersSnap.docs) {
      batch.update(docSnap.ref, { totalSpent: 0 });
      opCount++;
      totalReset++;

      // Commit batch jika sudah mendekati limit, lalu buat batch baru
      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    // Commit sisa operasi yang belum di-commit
    if (opCount > 0) {
      await batch.commit();
    }

    console.log(`[reset-leaderboard] Reset ${totalReset} users oleh ${decodedToken.email}`);

    return NextResponse.json({
      success: true,
      message: `Papan peringkat berhasil di-reset. ${totalReset} pengguna terdampak.`,
    });

  } catch (error: any) {
    console.error('[reset-leaderboard] Error:', error.message);
    return NextResponse.json({ message: error.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}