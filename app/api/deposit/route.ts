import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const COOLDOWN_MS = 10_000; // 10 detik antar submit

const ALLOWED_METHODS = ['QRIS (INSTANT)', 'DANA E-WALLET', 'SEABANK'] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

// ── Baca env var di dalam fungsi, bukan module level ──────────────────────────
// Supaya perubahan env var langsung terbaca tanpa harus rebuild.
function getTelegramConfig() {
  const token  = process.env.TG_BOT_TOKEN ?? '';
  const chatId = process.env.TG_CHAT_ID   ?? '';
  return { token, chatId };
}

function escapeTgMd(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ── Kirim pesan plain text (fallback jika MarkdownV2 gagal) ──────────────────
async function sendTelegramRaw(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error('[deposit/tg] plain-text fallback gagal:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[deposit/tg] network error (plain-text):', err);
    return false;
  }
}

async function sendTelegramNotification(
  userName: string, userEmail: string, userId: string,
  amount: number, method: AllowedMethod, ticketId: string,
): Promise<void> {
  // ── 1. Cek konfigurasi ─────────────────────────────────────────────────────
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    console.warn(
      '[deposit/tg] SKIP — TG_BOT_TOKEN atau TG_CHAT_ID belum diset di environment variable.',
      '| token:', token ? '✓' : '✗ KOSONG',
      '| chatId:', chatId ? '✓' : '✗ KOSONG',
    );
    return;
  }

  // ── 2. Format nominal ──────────────────────────────────────────────────────
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);

  // ── 3. Coba kirim MarkdownV2 dulu ─────────────────────────────────────────
  const safeName   = escapeTgMd(userName);
  const safeEmail  = escapeTgMd(userEmail);
  const safeUid    = escapeTgMd(userId);
  const safeTicket = escapeTgMd(ticketId);
  const safeMethod = escapeTgMd(method);
  const safeAmount = escapeTgMd(formattedAmount);

  const mdMessage = [
    '🏧 *TIKET DEPOSIT MASUK*', '',
    `👤 *Nama:*    ${safeName}`,
    `📧 *Email:*   ${safeEmail}`,
    `🆔 *UID:*     \`${safeUid}\``,
    `💳 *Metode:*  ${safeMethod}`,
    `💰 *Nominal:* ${safeAmount}`,
    `🎫 *Tiket:*   \`${safeTicket}\``, '',
    '⏳ Mohon segera proses dan konfirmasi saldo\\.',
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mdMessage, parse_mode: 'MarkdownV2' }),
    });

    if (res.ok) {
      console.log('[deposit/tg] Notifikasi terkirim ✓ | tiket:', ticketId);
      return;
    }

    // ── 4. MarkdownV2 gagal → log detail & coba plain text ──────────────────
    const errBody = await res.text();
    console.error(
      '[deposit/tg] MarkdownV2 gagal — status:', res.status,
      '| body:', errBody,
      '| message preview:', mdMessage.slice(0, 200),
    );

    // Fallback: kirim ulang tanpa formatting agar notif tetap sampai
    console.warn('[deposit/tg] Mencoba fallback plain-text...');
    const plainMessage = [
      '🏧 TIKET DEPOSIT MASUK',
      '',
      `Nama   : ${userName}`,
      `Email  : ${userEmail}`,
      `UID    : ${userId}`,
      `Metode : ${method}`,
      `Nominal: ${formattedAmount}`,
      `Tiket  : ${ticketId}`,
      '',
      'Mohon segera proses dan konfirmasi saldo.',
    ].join('\n');

    const fallbackOk = await sendTelegramRaw(token, chatId, plainMessage);
    if (fallbackOk) {
      console.log('[deposit/tg] Fallback plain-text berhasil ✓ | tiket:', ticketId);
    } else {
      console.error('[deposit/tg] Semua upaya pengiriman gagal | tiket:', ticketId);
    }
  } catch (err) {
    console.error('[deposit/tg] Network error saat kirim MarkdownV2:', err);

    // Tetap coba fallback meski koneksi sempat error
    try {
      const plainMessage = [
        '🏧 TIKET DEPOSIT MASUK',
        `Nama: ${userName} | Email: ${userEmail}`,
        `Metode: ${method} | Nominal: ${formattedAmount}`,
        `UID: ${userId} | Tiket: ${ticketId}`,
      ].join('\n');
      await sendTelegramRaw(token, chatId, plainMessage);
    } catch { /* sudah dicatat di sendTelegramRaw */ }
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    const token = authHeader.split('Bearer ')[1];
    decodedToken = await adminAuth.verifyIdToken(token, true);
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { message: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid atau sudah kedaluwarsa.' },
      { status: 401 }
    );
  }

  const userId    = decodedToken.uid;
  const userEmail = decodedToken.email ?? '';
  const userRef   = adminDb.collection('users').doc(userId);

  try {
    const body = await request.json();
    const { amount, method } = body;

    // ── 1. Validasi amount & method ──────────────────────────────────────────
    if (
      typeof amount !== 'number' || !Number.isFinite(amount) ||
      !Number.isInteger(amount)  || amount < 10000 || amount > 50000000
    ) {
      return NextResponse.json(
        { message: 'Nominal tidak valid. Harus bilangan bulat antara 10.000 – 50.000.000.' },
        { status: 400 }
      );
    }
    if (!ALLOWED_METHODS.includes(method as AllowedMethod)) {
      return NextResponse.json({ message: 'Metode pembayaran tidak dikenali.' }, { status: 400 });
    }

    // ── 2. Cek user & banned ─────────────────────────────────────────────────
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ message: 'Akun tidak ditemukan.' }, { status: 404 });
    }
    const userData = userSnap.data()!;
    if (userData.banned === true) {
      return NextResponse.json(
        { message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' },
        { status: 403 }
      );
    }

    // ── 3. Rate limit Firestore (10 detik, persist di server) ────────────────
    const rateLimitRef  = adminDb.collection('rateLimits').doc(`deposit_${userId}`);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
      const lastTimestamp: number = rateLimitSnap.data()?.timestamp ?? 0;
      const elapsed = Date.now() - lastTimestamp;
      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { message: `Terlalu cepat. Tunggu ${remaining} detik lagi sebelum submit ulang.` },
          { status: 429 }
        );
      }
    }

    // ── 4. Catat timestamp rate limit ────────────────────────────────────────
    await rateLimitRef.set({ timestamp: Date.now() });

    // ── 5. Buat tiket deposit ────────────────────────────────────────────────
    const newTicketRef = adminDb.collection('users').doc(userId).collection('transactions').doc();
    await newTicketRef.set({
      userId, type: 'deposit', amount,
      method: method as AllowedMethod,
      desc: 'Deposit via ' + method,
      status: 'pending',
      timestamp: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── 6. Notifikasi Telegram ke admin (non-blocking) ───────────────────────
    // Dijalankan tanpa await agar tidak delay response ke user jika Telegram lambat.
    // Error tetap dicatat di console server log.
    const userName = userData.name ?? userData.displayName ?? userEmail;
    sendTelegramNotification(userName, userEmail, userId, amount, method as AllowedMethod, newTicketRef.id)
      .catch(err => console.error('[deposit/tg] Uncaught error:', err));

    return NextResponse.json({
      success: true, ticketId: newTicketRef.id,
      message: 'Tiket deposit berhasil dibuat. Admin akan segera memproses.',
    });

  } catch (error: unknown) {
    console.error('[deposit] Unhandled error:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.' },
      { status: 500 }
    );
  }
}