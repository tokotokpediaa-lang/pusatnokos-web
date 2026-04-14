// app/api/auth/verify-otp/route.ts
// FIXES APPLIED:
//  [CRITICAL] Setelah OTP benar, dokumen TIDAK dihapus — ditandai verified:true
//             supaya reset-pin bisa membaca status verifikasi ini.
//             Sebelumnya tx.delete() menyebabkan reset-pin selalu gagal dengan
//             "Verifikasi email belum dilakukan" karena dokumennya sudah tidak ada.
//  [MEDIUM]   Perbandingan OTP menggunakan timingSafeEqual (bukan !== string biasa)
//  [MEDIUM]   otpHash dihapus dari dokumen setelah verifikasi berhasil (tidak perlu lagi)

import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { adminDb } from '../../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_OTP_ATTEMPTS = 5;

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

function safeCompareHash(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, otp } = body;

    if (typeof email !== 'string' || typeof otp !== 'string') {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Kode OTP harus 6 digit angka.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const inputOtpHash    = hashOtp(otp);
    const otpRef = adminDb.collection('otp_verifications').doc(normalizedEmail);

    const result = await adminDb.runTransaction(async (tx) => {
      const otpSnap = await tx.get(otpRef);

      if (!otpSnap.exists) {
        return { status: 404, error: 'Kode OTP tidak ditemukan. Minta ulang kode.' };
      }

      const otpData = otpSnap.data()!;

      // Jika sudah pernah verified sebelumnya (misalnya user tekan back lalu submit lagi)
      if (otpData.verified === true) {
        return { status: 400, error: 'Kode OTP sudah digunakan. Minta kode baru jika diperlukan.' };
      }

      if (Date.now() > otpData.expiresAt) {
        tx.delete(otpRef);
        return { status: 400, error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' };
      }

      const attempts = otpData.otpAttempts ?? 0;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        tx.delete(otpRef);
        return { status: 429, error: 'Terlalu banyak percobaan salah. Silakan minta kode OTP baru.' };
      }

      const storedHash = otpData.otpHash ?? '';
      const isMatch    = storedHash.length > 0 && safeCompareHash(storedHash, inputOtpHash);

      if (!isMatch) {
        const newAttempts = attempts + 1;
        const sisaCoba    = MAX_OTP_ATTEMPTS - newAttempts;

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          tx.delete(otpRef);
          return { status: 401, error: 'Kode OTP salah. Batas percobaan habis — silakan minta kode baru.' };
        }

        tx.update(otpRef, { otpAttempts: FieldValue.increment(1) });
        return {
          status: 401,
          error: `Kode OTP salah.${sisaCoba <= 2 ? ` Sisa ${sisaCoba} percobaan.` : ''}`,
          attemptsLeft: sisaCoba,
        };
      }

      // ✅ FIX [CRITICAL]: OTP benar → JANGAN hapus dokumen.
      // Tandai verified:true + catat waktu verifikasi untuk dicek oleh reset-pin.
      // Hapus otpHash karena sudah tidak diperlukan lagi (prinsip least privilege).
      // reset-pin akan menghapus dokumen ini setelah PIN berhasil direset.
      tx.update(otpRef, {
        verified:   true,
        verifiedAt: Date.now(),
        otpHash:    FieldValue.delete(), // Hapus hash — tidak dipakai lagi
        otpAttempts: FieldValue.delete(), // Bersihkan counter percobaan
      });

      return { status: 200, success: true };
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { error: result.error, attemptsLeft: result.attemptsLeft },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, message: 'Email berhasil diverifikasi.' });

  } catch (error: unknown) {
    console.error('[verify-otp] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}