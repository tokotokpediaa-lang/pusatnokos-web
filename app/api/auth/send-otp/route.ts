// app/api/auth/send-otp/route.ts
// FIXES APPLIED:
//  [CRITICAL] Validasi JWT token jika Authorization header disertakan.
//             Untuk flow register (belum login) token tidak wajib — tapi jika
//             token disertakan (flow reset PIN), server memverifikasinya dan
//             memastikan email di body cocok dengan email di token.
//  [CRITICAL] Cloudflare Turnstile — token wajib diverifikasi server-side sebelum
//             OTP dikirim. Mencegah bot flood endpoint ini meski tanpa autentikasi.
//  [HIGH]     HTML injection — safeName di-escape sebelum interpolasi ke template email
//  [MEDIUM]   OTP di-hash (SHA-256) sebelum disimpan ke Firestore
//  [MEDIUM]   IP 'unknown' di-skip — tidak masuk ke Firestore rate limit

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { randomInt, createHash } from 'crypto';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

const OTP_EXPIRY_MS   = 10 * 60 * 1000;
const MAX_SEND_PER_HR = 5;
const RESEND_COOLDOWN = 60_000;

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, cfToken } = body;

    if (
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ FIX [CRITICAL]: Verifikasi Cloudflare Turnstile token sebelum proses apapun.
    // Ini adalah lapisan pertama sebelum rate limit — bot yang tidak punya token valid
    // langsung ditolak tanpa membebani Firestore sama sekali.
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      console.error('[send-otp] TURNSTILE_SECRET_KEY tidak dikonfigurasi.');
      return NextResponse.json(
        { error: 'Konfigurasi server tidak lengkap.' },
        { status: 500 }
      );
    }

    if (!cfToken || typeof cfToken !== 'string') {
      return NextResponse.json(
        { error: 'Verifikasi CAPTCHA diperlukan.' },
        { status: 400 }
      );
    }

    const cfVerifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          secret:   turnstileSecret,
          response: cfToken,
          remoteip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
        }),
      }
    );
    const cfData = await cfVerifyRes.json();

    if (!cfData.success) {
      return NextResponse.json(
        { error: 'Verifikasi CAPTCHA gagal. Selesaikan tantangan dan coba lagi.' },
        { status: 403 }
      );
    }

    // ✅ FIX [CRITICAL]: Jika Authorization header disertakan (flow reset PIN dari user
    // yang sudah login), verifikasi token dan pastikan email di body cocok dengan
    // email di JWT. Ini mencegah user yang sudah login mem-spam OTP ke email orang lain.
    // Untuk flow register (belum ada token), header tidak wajib — rate limit IP/email
    // sudah menjadi penjaga utama.
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token   = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token, true);
        const tokenEmail = (decoded.email ?? '').trim().toLowerCase();

        if (tokenEmail !== normalizedEmail) {
          return NextResponse.json(
            { error: 'Email tidak sesuai dengan akun yang sedang login.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Token tidak valid. Silakan login ulang.' },
          { status: 401 }
        );
      }
    }

    const clientIp = getClientIp(req);
    const now      = Date.now();

    // ── Rate limit per EMAIL ───────────────────────────────────────────────
    const otpRef  = adminDb.collection('otp_verifications').doc(normalizedEmail);
    const otpSnap = await otpRef.get();
    const otpData = otpSnap.exists ? otpSnap.data()! : null;

    const sendHistory: number[] = otpData?.sendHistory ?? [];
    const recentSends = sendHistory.filter(t => now - t < 60 * 60 * 1000);

    if (recentSends.length >= MAX_SEND_PER_HR) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.' },
        { status: 429 }
      );
    }

    const lastSent = otpData?.createdAt ?? 0;
    if (now - lastSent < RESEND_COOLDOWN) {
      const sisaDetik = Math.ceil((RESEND_COOLDOWN - (now - lastSent)) / 1000);
      return NextResponse.json(
        { error: `Tunggu ${sisaDetik} detik sebelum kirim ulang OTP.` },
        { status: 429 }
      );
    }

    // ── Rate limit per IP ──────────────────────────────────────────────────
    let ipWrites: Promise<any> = Promise.resolve();
    if (clientIp !== 'unknown') {
      const safeIpKey = clientIp.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
      const ipRef     = adminDb.collection('otp_ip_limits').doc(safeIpKey);
      const ipSnap    = await ipRef.get();
      const ipData    = ipSnap.exists ? ipSnap.data()! : null;

      const ipHistory: number[]  = ipData?.history ?? [];
      const recentIpSends = ipHistory.filter(t => now - t < 60 * 60 * 1000);

      if (recentIpSends.length >= 10) {
        return NextResponse.json(
          { error: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti.' },
          { status: 429 }
        );
      }

      ipWrites = ipRef.set({ history: [...recentIpSends, now], updatedAt: now });
    }

    // ── Generate OTP & hash sebelum simpan ────────────────────────────────
    const otp       = generateOtp();
    const otpHash   = hashOtp(otp);
    const expiresAt = now + OTP_EXPIRY_MS;

    await Promise.all([
      otpRef.set({
        otpHash,
        email:        normalizedEmail,
        expiresAt,
        createdAt:    now,
        verified:     false,
        otpAttempts:  0,
        sendHistory:  [...recentSends, now],
      }),
      ipWrites,
    ]);

    // ── Kirim email ────────────────────────────────────────────────────────
    const transporter = createTransporter();
    const rawName  = typeof name === 'string' ? name.trim().substring(0, 50) : 'Pengguna';
    const safeName = escapeHtml(rawName);

    await transporter.sendMail({
      from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to:      normalizedEmail,
      subject: `Kode Verifikasi Akun — ${otp}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
                <tr><td style="background:#dc2626;padding:28px 32px;text-align:center;">
                  <p style="margin:0;font-size:24px;font-weight:900;color:#fff;letter-spacing:2px;text-transform:uppercase;">Verifikasi Email</p>
                </td></tr>
                <tr><td style="padding:36px 32px;">
                  <p style="margin:0 0 12px;color:#d1d5db;font-size:15px;">Halo, <strong style="color:#fff;">${safeName}</strong>!</p>
                  <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;line-height:1.6;">
                    Gunakan kode OTP berikut. Berlaku selama <strong style="color:#fff;">10 menit</strong> dan hanya bisa digunakan sekali.
                  </p>
                  <div style="background:#0a0a0a;border:2px solid #dc2626;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:3px;text-transform:uppercase;">Kode OTP</p>
                    <p style="margin:0;font-size:42px;font-weight:900;color:#dc2626;letter-spacing:12px;font-family:monospace;">${otp}</p>
                  </div>
                  <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                    Jika kamu tidak merasa mendaftar, abaikan email ini. Jangan bagikan kode ini ke siapapun.
                  </p>
                </td></tr>
                <tr><td style="padding:20px 32px;border-top:1px solid #1f1f1f;text-align:center;">
                  <p style="margin:0;color:#4b5563;font-size:11px;">Email otomatis — jangan balas email ini.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success:   true,
      message:   'Kode OTP telah dikirim ke email Anda.',
      expiresIn: OTP_EXPIRY_MS / 1000,
    });

  } catch (error: unknown) {
    console.error('[send-otp] Error:', error);
    return NextResponse.json(
      { error: 'Gagal mengirim OTP. Periksa konfigurasi email server.' },
      { status: 500 }
    );
  }
}