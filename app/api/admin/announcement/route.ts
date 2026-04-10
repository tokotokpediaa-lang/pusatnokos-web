// app/api/admin/announcement/route.ts
// FIXES APPLIED:
//  [CRITICAL] Ganti ADMIN_EMAILS hardcoded → JWT Custom Claim (admin: true)
//             Konsisten dengan seluruh admin route lain di codebase ini.
//             ADMIN_EMAILS rentan: jika email admin berubah, harus deploy ulang.
//             Custom Claim: diset server-side via Firebase Admin SDK, tidak bisa
//             dimanipulasi client, dan langsung aktif saat token di-refresh.
//  [HIGH]     Tambah checkRevoked: true pada verifyIdToken (POST)
//  [LOW]      Ganti admin.auth()/admin.firestore() langsung → gunakan singleton
//             adminAuth/adminDb dari firebaseAdmin.ts (konsisten, efisien)

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// GET — public endpoint, tidak perlu auth (hanya baca teks pengumuman)
export async function GET() {
  try {
    const snap = await adminDb.collection('settings').doc('announcement').get();

    if (!snap.exists) {
      return NextResponse.json({ text: '', isActive: false });
    }

    const data = snap.data()!;
    return NextResponse.json({
      text:      data.text      || '',
      isActive:  data.isActive  || false,
      updatedAt: data.updatedAt || null,
    });

  } catch (error: any) {
    console.error('[announcement GET] Error:', error.message);
    return NextResponse.json({ error: 'Gagal memuat pengumuman.' }, { status: 500 });
  }
}

// POST — admin only
export async function POST(request: Request) {
  // ── 1. Autentikasi ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
  }

  let adminUid: string;
  try {
    const token      = authHeader.split('Bearer ')[1];
    // ✅ FIX [HIGH]: checkRevoked: true — sesi yang dicabut tidak bisa pakai endpoint ini
    const decoded    = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);

    // ✅ FIX [CRITICAL]: Cek JWT Custom Claim, bukan ADMIN_EMAILS hardcoded
    if (decoded.admin !== true) {
      return NextResponse.json({ message: 'Hanya Admin yang diizinkan!' }, { status: 403 });
    }
    adminUid = decoded.uid;
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { message: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid.' },
      { status: 401 }
    );
  }

  try {
    // ── 2. Validasi body ──────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const { text, isActive } = body;

    // Sanitasi text — max 500 karakter
    const safeText = (text ?? '').toString().substring(0, 500);

    await adminDb.collection('settings').doc('announcement').set({
      text:      safeText,
      isActive:  Boolean(isActive),
      updatedAt: Date.now(),
      updatedBy: adminUid, // ✅ Simpan UID, bukan email — lebih stabil
    });

    return NextResponse.json({ success: true, message: 'Pengumuman berhasil disimpan.' });

  } catch (error: any) {
    console.error('[announcement POST] Error:', error.message);
    return NextResponse.json({ message: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}