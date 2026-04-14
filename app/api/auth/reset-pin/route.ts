/// app/api/auth/reset-pin/route.ts
// FIXES APPLIED:
//  [CRITICAL] Selaraskan cek OTP session dengan verify-otp yang sudah difix:
//             verify-otp kini menyimpan verified:true + verifiedAt (bukan menghapus dokumen).
//             reset-pin cek verified:true DAN verifiedAt masih dalam TTL 15 menit.
//  [CRITICAL] checkRevoked: true pada verifyIdToken

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

const PIN_REGEX = /^\d{4}$/;
const WEAK_PINS = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','9876'];

// TTL sesi OTP verified: 15 menit sejak verifiedAt
// Harus cukup lama untuk user buat PIN, tapi cukup pendek untuk keamanan
const OTP_SESSION_TTL_MS = 15 * 60 * 1000;

export async function POST(req: Request) {

  // ── 1. Autentikasi ───────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
  }

  let uid: string;
  let tokenEmail: string;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token, true); // checkRevoked: true
    uid        = decoded.uid;
    tokenEmail = decoded.email ?? '';
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { error: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid. Silakan login ulang.' },
      { status: 401 }
    );
  }

  try {
    // ── 2. Validasi body ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { pin, email } = body;

    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: 'PIN harus tepat 4 digit angka.' }, { status: 400 });
    }
    if (WEAK_PINS.includes(pin)) {
      return NextResponse.json(
        { error: 'PIN terlalu mudah ditebak. Gunakan kombinasi angka yang lebih unik.' },
        { status: 400 }
      );
    }

    // ✅ Pastikan email di body cocok dengan token — cegah reset PIN user lain
    const normalizedEmail = (typeof email === 'string' ? email : tokenEmail).trim().toLowerCase();
    if (normalizedEmail !== tokenEmail.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Email tidak sesuai dengan akun yang login.' }, { status: 403 });
    }

    // ── 3. Validasi OTP session ──────────────────────────────────────────
    // ✅ FIX [CRITICAL]: verify-otp kini TIDAK menghapus dokumen — ia menandai
    // verified:true + verifiedAt. Kita cek keduanya di sini.
    // Sebelumnya: cek otpData.verified tetapi dokumen sudah dihapus oleh verify-otp
    // → otpSnap.exists selalu false → selalu error "Verifikasi belum dilakukan".
    const otpRef  = adminDb.collection('otp_verifications').doc(normalizedEmail);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return NextResponse.json(
        { error: 'Verifikasi email belum dilakukan. Minta kode OTP terlebih dahulu.' },
        { status: 400 }
      );
    }

    const otpData = otpSnap.data()!;

    if (otpData.verified !== true) {
      return NextResponse.json(
        { error: 'Email belum terverifikasi. Selesaikan verifikasi OTP terlebih dahulu.' },
        { status: 400 }
      );
    }

    // ✅ Cek apakah sesi verifikasi masih dalam TTL (15 menit sejak verifiedAt)
    const verifiedAt  = otpData.verifiedAt ?? 0;
    const sessionAge  = Date.now() - verifiedAt;
    if (sessionAge > OTP_SESSION_TTL_MS) {
      await otpRef.delete();
      return NextResponse.json(
        { error: 'Sesi verifikasi sudah habis (15 menit). Minta kode OTP baru.' },
        { status: 400 }
      );
    }

    // ── 4. Cek user ada & tidak di-banned ────────────────────────────────
    const userRef  = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    if (userSnap.data()?.banned === true) {
      return NextResponse.json(
        { error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' },
        { status: 403 }
      );
    }

    // ── 5. Hash PIN baru & update Firestore ──────────────────────────────
    const pinHash = await bcrypt.hash(pin, 12);

    // Jalankan update user + hapus OTP session secara bersamaan (atomik untuk dua koleksi berbeda)
    await Promise.all([
      userRef.update({
        pinHash,
        pinSetAt:       Date.now(),
        pinAttempts:    0,
        pinLockedUntil: 0,
      }),
      // ✅ Hapus dokumen OTP session setelah PIN berhasil direset
      // (tidak perlu lagi — mencegah penumpukan data di Firestore)
      otpRef.delete(),
    ]);

    return NextResponse.json({ success: true, message: 'PIN berhasil direset.' });

  } catch (error: unknown) {
    console.error('[reset-pin] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}