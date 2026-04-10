// app/api/auth/verify-pin/route.ts
// FIXES APPLIED:
//  [CRITICAL] Race condition pada lockout — bungkus baca+tulis dalam Firestore transaction

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

const PIN_REGEX       = /^\d{4}$/;
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: Request) {

  // ── 1. Autentikasi ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.split('Bearer ')[1];
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
    // ── 2. Validasi input PIN ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: 'PIN harus tepat 4 digit angka.' }, { status: 400 });
    }

    // ── 3. Ambil pinHash di luar transaction (read-only, untuk bcrypt) ────────
    // bcrypt.compare tidak bisa dijalankan di dalam Firestore transaction karena
    // transaction tidak boleh ada operasi async non-Firestore di dalamnya.
    // Solusinya: baca pinHash dulu, lakukan bcrypt di luar, lalu update
    // counter di dalam transaction terpisah.
    const userRef  = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    const userData = userSnap.data()!;

    if (userData.banned === true) {
      return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' }, { status: 403 });
    }

    if (!userData.pinHash) {
      return NextResponse.json({ error: 'PIN belum dibuat. Silakan buat PIN terlebih dahulu.' }, { status: 400 });
    }

    // ── 4. Cek lockout awal (pre-check, sebelum bcrypt) ───────────────────────
    // Ini hanya early-return untuk user experience — penjaga utama ada di transaction.
    const pinLockedUntil = userData.pinLockedUntil ?? 0;
    if (pinLockedUntil > Date.now()) {
      const sisaMenit = Math.ceil((pinLockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `PIN dikunci. Coba lagi dalam ${sisaMenit} menit.`, locked: true },
        { status: 429 }
      );
    }

    // ── 5. Verifikasi PIN (bcrypt — timing-safe secara native) ───────────────
    const isMatch = await bcrypt.compare(pin, userData.pinHash);

    // ── 6. Update counter dalam Firestore Transaction (atomic) ────────────────
    // ✅ FIX [CRITICAL]: Sebelumnya baca pinAttempts dan tulis increment-nya adalah
    // dua operasi terpisah. Attacker bisa kirim 10 request paralel saat attempts=4:
    //   - Semua baca nilai 4
    //   - Semua hitung newAttempts=5
    //   - Semua tulis 5 (bukan 14)
    //   - Semua mendapat giliran mencoba PIN → jauh melampaui batas 5 percobaan
    //
    // Sekarang baca+increment+lock dibungkus dalam satu transaction:
    //   - Hanya satu request yang bisa baca-tulis dalam satu waktu
    //   - Request berikutnya akan membaca nilai yang sudah diupdate
    //   - Tidak bisa dapat lebih dari MAX_ATTEMPTS percobaan meski pakai script paralel
    type TxResult =
      | { ok: true }
      | { ok: false; status: number; error: string; locked?: boolean; attemptsLeft?: number };

    const txResult: TxResult = await adminDb.runTransaction(async (t) => {
      const freshSnap = await t.get(userRef);
      if (!freshSnap.exists) return { ok: false, status: 404, error: 'Akun tidak ditemukan.' };

      const fresh          = freshSnap.data()!;
      const freshLocked    = fresh.pinLockedUntil ?? 0;
      const freshAttempts  = fresh.pinAttempts    ?? 0;

      // Re-check lockout di dalam transaction (cegah bypass dengan parallel requests)
      if (freshLocked > Date.now()) {
        const sisaMenit = Math.ceil((freshLocked - Date.now()) / 60000);
        return { ok: false, status: 429, error: `PIN dikunci. Coba lagi dalam ${sisaMenit} menit.`, locked: true };
      }

      if (!isMatch) {
        const newAttempts = freshAttempts + 1;
        const shouldLock  = newAttempts >= MAX_ATTEMPTS;
        const lockedUntil = shouldLock ? Date.now() + LOCKOUT_MINUTES * 60 * 1000 : 0;
        const sisaCoba    = MAX_ATTEMPTS - newAttempts;

        t.update(userRef, {
          pinAttempts:    newAttempts,
          pinLockedUntil: lockedUntil,
          pinLastFail:    Date.now(),
        });

        if (shouldLock) {
          return {
            ok: false, status: 429, locked: true,
            error: `PIN salah ${MAX_ATTEMPTS} kali. Akun dikunci selama ${LOCKOUT_MINUTES} menit.`,
          };
        }

        return {
          ok: false, status: 401,
          error: `PIN salah.${sisaCoba > 0 && sisaCoba <= 3 ? ` Sisa ${sisaCoba} percobaan sebelum dikunci.` : ''}`,
          attemptsLeft: sisaCoba,
        };
      }

      // PIN benar — reset semua counter
      t.update(userRef, {
        pinAttempts:    0,
        pinLockedUntil: 0,
        pinLastSuccess: Date.now(),
      });

      return { ok: true };
    });

    if (!txResult.ok) {
      return NextResponse.json(
        { error: txResult.error, locked: txResult.locked, attemptsLeft: txResult.attemptsLeft },
        { status: txResult.status }
      );
    }

    return NextResponse.json({ success: true, message: 'PIN terverifikasi.' });

  } catch (error: unknown) {
    console.error('[verify-pin] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}