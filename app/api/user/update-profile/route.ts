// app/api/user/update-profile/route.ts
// FIXES APPLIED:
//  [MEDIUM] Tambah checkRevoked: true pada verifyIdToken
//  [MEDIUM] Tambah banned check — user yang di-suspend tidak bisa ganti nama

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  // ── 1. Autentikasi ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.split('Bearer ')[1];
    // ✅ FIX [MEDIUM]: Tambah checkRevoked: true — konsisten dengan route lain
    const decoded = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);
    uid = decoded.uid;
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { error: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid. Silakan login ulang.' },
      { status: 401 }
    );
  }

  try {
    // ── 2. Cek user & banned status ──────────────────────────────────────
    // ✅ FIX [MEDIUM]: Sebelumnya tidak ada banned check — user yang di-suspend
    // masih bisa mengubah nama profil mereka.
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }
    if (userSnap.data()?.banned === true) {
      return NextResponse.json(
        { error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' },
        { status: 403 }
      );
    }

    // ── 3. Validasi & sanitasi nama ──────────────────────────────────────
    const body    = await req.json().catch(() => ({}));
    const rawName = (body.name ?? '').toString().trim();

    const safeName = rawName
      .replace(/[^\p{L}\p{N} .\-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);

    if (!safeName || safeName.length < 2) {
      return NextResponse.json(
        { error: 'Nama minimal 2 karakter dan tidak boleh mengandung karakter ilegal.' },
        { status: 400 }
      );
    }

    // ── 4. Update Firestore + Firebase Auth ──────────────────────────────
    await Promise.all([
      adminDb.collection('users').doc(uid).update({
        name:      safeName,
        updatedAt: Date.now(),
      }),
      adminAuth.updateUser(uid, { displayName: safeName }),
    ]);

    return NextResponse.json({ success: true, name: safeName });

  } catch (error: unknown) {
    console.error('[update-profile] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}