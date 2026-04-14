import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN ?? '';
const TG_CHAT_ID   = process.env.TG_CHAT_ID   ?? '';

const ALLOWED_METHODS = ['QRIS (INSTANT)', 'DANA E-WALLET', 'SEABANK'] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

function escapeTgMd(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function sendTelegramNotification(
  userName: string,
  userEmail: string,
  userId: string,
  amount: number,
  method: AllowedMethod,
  ticketId: string,
): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn('[deposit] TG_BOT_TOKEN atau TG_CHAT_ID belum diset, notifikasi dilewati.');
    return;
  }
  const safeName   = escapeTgMd(userName);
  const safeEmail  = escapeTgMd(userEmail);
  const safeUid    = escapeTgMd(userId);
  const safeTicket = escapeTgMd(ticketId);
  const safeMethod = escapeTgMd(method);
  const safeAmount = escapeTgMd(
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  );
  const message = [
    '🏧 *TIKET DEPOSIT MASUK*', '',
    `👤 *Nama:*    ${safeName}`,
    `📧 *Email:*   ${safeEmail}`,
    `🆔 *UID:*     \`${safeUid}\``,
    `💳 *Metode:*  ${safeMethod}`,
    `💰 *Nominal:* ${safeAmount}`,
    `🎫 *Tiket:*   \`${safeTicket}\``, '',
    '⏳ Mohon segera proses dan konfirmasi saldo\\.',
  ].join('\n');
  const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: 'MarkdownV2' }),
  });
  if (!res.ok) console.error('[deposit] Telegram API error:', res.status, await res.text());
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
    const pendingSnap = await adminDb
      .collection('users').doc(userId)
      .collection('transactions')
      .where('status', '==', 'pending')
      .where('type',   '==', 'deposit')
      .limit(4).get();
    if (pendingSnap.size >= 3) {
      return NextResponse.json(
        { message: 'Kamu sudah memiliki 3 tiket deposit yang menunggu. Tunggu admin memproses dulu.' },
        { status: 429 }
      );
    }
    const newTicketRef = adminDb.collection('users').doc(userId).collection('transactions').doc();
    await newTicketRef.set({
      userId, type: 'deposit', amount,
      method: method as AllowedMethod,
      desc: 'Deposit via ' + method,
      status: 'pending',
      timestamp: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const userName = userData.name ?? userData.displayName ?? userEmail;
    await sendTelegramNotification(userName, userEmail, userId, amount, method as AllowedMethod, newTicketRef.id);
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