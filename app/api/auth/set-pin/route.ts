// app/api/auth/set-pin/route.ts
// FIXES APPLIED:
//  [HIGH]   checkRevoked: true pada verifyIdToken — konsisten dengan verify-pin
//  [MEDIUM] Rate limiting per uid di Firestore — max 3 percobaan per jam

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

const PIN_REGEX         = /^\d{4}$/;
const MAX_ATTEMPTS_PER_HR = 3;
const WEAK_PINS = [
  '0000','1111','2222','3333','4444','5555','6666','7777',
  '8888','9999','1234','4321','0123','9876',
];

export async function POST(req: Request) {

  // ── 1. Autentikasi ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.split('Bearer ')[1];
    // ✅ FIX [HIGH]: checkRevoked: true — sebelumnya tidak ada argumen kedua, sehingga
    // session yang sudah di-revoke (mis. akun kena suspend/takeover) masih bisa
    // set PIN baru. Sekarang diblokir secara konsisten dengan verify-pin.
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
    // ── 2. Rate limiting per uid di Firestore ─────────────────────────────────
    // ✅ FIX [MEDIUM]: Sebelumnya tidak ada rate limiting sama sekali di endpoint ini.
    // Attacker dengan token valid (fresh account) bisa spam endpoint ini.
    // Sekarang: max 3 percobaan per jam per uid, dicatat di Firestore.
    const rlRef  = adminDb.collection('set_pin_attempts').doc(uid);
    const rlSnap = await rlRef.get();
    const rlData = rlSnap.exists ? rlSnap.data()! : null;
    const now    = Date.now();

    const history: number[] = rlData?.history ?? [];
    const recentAttempts = history.filter(t => now - t < 60 * 60 * 1000);

    if (recentAttempts.length >= MAX_ATTEMPTS_PER_HR) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 1 jam.' },
        { status: 429 }
      );
    }

    // Catat percobaan ini sebelum proses lebih lanjut
    await rlRef.set({ history: [...recentAttempts, now], updatedAt: now });

    // ── 3. Validasi PIN ───────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: 'PIN harus tepat 4 digit angka.' }, { status: 400 });
    }

    if (WEAK_PINS.includes(pin)) {
      return NextResponse.json(
        { error: 'PIN terlalu mudah ditebak. Gunakan kombinasi angka yang lebih unik.' },
        { status: 400 }
      );
    }

    // ── 4. Cek user ada & belum set PIN ──────────────────────────────────────
    const userRef  = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    if (userSnap.data()?.pinHash) {
      return NextResponse.json(
        { error: 'PIN sudah pernah dibuat. Gunakan fitur lupa PIN untuk menggantinya.' },
        { status: 409 }
      );
    }

    // ── 5. Hash PIN & simpan ──────────────────────────────────────────────────
    const pinHash = await bcrypt.hash(pin, 12);

    await userRef.update({ pinHash, pinSetAt: now });

    // Bersihkan rate limit record setelah berhasil
    await rlRef.delete();

    return NextResponse.json({ success: true, message: 'PIN berhasil dibuat.' });

  } catch (error: unknown) {
    console.error('[set-pin] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}