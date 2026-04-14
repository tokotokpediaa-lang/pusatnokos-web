// app/api/auth/login-ratelimit/route.ts
// ============================================================
// POST /api/auth/login-ratelimit
// Server-side rate limiter untuk percobaan login.
//
// Dipanggil DUA kali dari AuthPage:
//   1. SEBELUM signInWithEmailAndPassword   → body: { email }
//      → cek apakah email/IP boleh mencoba login
//   2. SETELAH Firebase balas credential error → body: { email, failed: true }
//      → increment counter gagal di server
//
// Mengapa perlu ini?
//   Client-side rate limit (localStorage) bisa di-bypass dalam 3 detik:
//   DevTools → Application → Storage → hapus key pn_auth_rl → refresh.
//   Counter di Firestore tidak bisa dimanipulasi browser.
//
// Strategi:
//   - Per EMAIL  : max 10 gagal per 15 menit, lockout 15 menit
//   - Per IP     : max 30 gagal per 15 menit (cegah spray dari satu IP)
//   - Dokumen    : disimpan di Firestore koleksi `login_ratelimits`
//   - TTL        : dokumen otomatis bersih via Firestore TTL policy
//                  (set TTL field "expireAt" di Firestore Console)
// ============================================================

import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';

const WINDOW_MS       = 15 * 60 * 1000; // Window 15 menit
const MAX_PER_EMAIL   = 10;             // Maks gagal per email per window
const MAX_PER_IP      = 30;             // Maks gagal per IP per window
const LOCKOUT_MS      = 15 * 60 * 1000; // Lockout 15 menit setelah limit

// Ambil IP dari header (works behind Vercel / Cloudflare proxy)
function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Bersihkan email & IP agar aman sebagai Firestore document ID
function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9@._\-]/g, '_').substring(0, 200);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, failed } = body;

    // Validasi email dasar
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true }); // Jangan bocorkan info, cukup lanjut
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp        = getClientIp(req);
    const now             = Date.now();
    const windowStart     = now - WINDOW_MS;

    const emailDocId = `email_${safeId(normalizedEmail)}`;
    const ipDocId    = `ip_${safeId(clientIp)}`;

    const emailRef = adminDb.collection('login_ratelimits').doc(emailDocId);
    const ipRef    = adminDb.collection('login_ratelimits').doc(ipDocId);

    // ── Mode: catat percobaan GAGAL (dipanggil setelah Firebase balas error) ──
    if (failed === true) {
      await adminDb.runTransaction(async (tx) => {
        const [emailSnap, ipSnap] = await Promise.all([tx.get(emailRef), tx.get(ipRef)]);

        const eData     = emailSnap.exists ? emailSnap.data()! : { attempts: [], lockedUntil: 0 };
        const iData     = ipSnap.exists    ? ipSnap.data()!    : { attempts: [], lockedUntil: 0 };

        // Hanya simpan timestamp dalam window terakhir (auto-clean lama)
        const eAttempts: number[] = (eData.attempts as number[] ?? []).filter(ts => ts > windowStart);
        const iAttempts: number[] = (iData.attempts as number[] ?? []).filter(ts => ts > windowStart);

        eAttempts.push(now);
        iAttempts.push(now);

        const eLockedUntil = eAttempts.length >= MAX_PER_EMAIL ? now + LOCKOUT_MS : (eData.lockedUntil ?? 0);
        const iLockedUntil = iAttempts.length >= MAX_PER_IP    ? now + LOCKOUT_MS : (iData.lockedUntil ?? 0);

        // expireAt dipakai Firestore TTL policy untuk hapus dokumen lama otomatis
        const expireAt = new Date(now + WINDOW_MS * 2);

        tx.set(emailRef, { attempts: eAttempts, lockedUntil: eLockedUntil, expireAt }, { merge: true });
        tx.set(ipRef,    { attempts: iAttempts, lockedUntil: iLockedUntil, expireAt }, { merge: true });
      });

      return NextResponse.json({ ok: true });
    }

    // ── Mode: CEK apakah boleh mencoba login ──────────────────────────────────
    const [emailSnap, ipSnap] = await Promise.all([emailRef.get(), ipRef.get()]);

    const eData = emailSnap.exists ? emailSnap.data()! : null;
    const iData = ipSnap.exists    ? ipSnap.data()!    : null;

    // Cek lockout email
    if (eData?.lockedUntil && eData.lockedUntil > now) {
      const sisaMenit = Math.ceil((eData.lockedUntil - now) / 60000);
      return NextResponse.json(
        { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.` },
        { status: 429 }
      );
    }

    // Cek lockout IP
    if (iData?.lockedUntil && iData.lockedUntil > now) {
      const sisaMenit = Math.ceil((iData.lockedUntil - now) / 60000);
      return NextResponse.json(
        { error: `Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam ${sisaMenit} menit.` },
        { status: 429 }
      );
    }

    // Cek jumlah percobaan dalam window tanpa lockout (warning dini)
    const eAttempts: number[] = (eData?.attempts as number[] ?? []).filter(t => t > windowStart);
    const iAttempts: number[] = (iData?.attempts as number[] ?? []).filter(t => t > windowStart);

    if (eAttempts.length >= MAX_PER_EMAIL) {
      // Tandai lockout sekarang
      await emailRef.set(
        { lockedUntil: now + LOCKOUT_MS, expireAt: new Date(now + WINDOW_MS * 2) },
        { merge: true }
      );
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan gagal. Akun sementara dikunci 15 menit.' },
        { status: 429 }
      );
    }

    if (iAttempts.length >= MAX_PER_IP) {
      await ipRef.set(
        { lockedUntil: now + LOCKOUT_MS, expireAt: new Date(now + WINDOW_MS * 2) },
        { merge: true }
      );
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan dari jaringan ini. Coba lagi nanti.' },
        { status: 429 }
      );
    }

    // Boleh lanjut login
    return NextResponse.json({ ok: true });

  } catch (err) {
    // Jika rate limit endpoint error, jangan blokir login — fallback ke Firebase guard
    if (process.env.NODE_ENV === 'development') console.error('[login-ratelimit]', err);
    return NextResponse.json({ ok: true });
  }
}