import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// Set variabel ini di .env.local:
// TELEGRAM_BOT_TOKEN=token_bot_telegram_kamu
// TELEGRAM_ADMIN_CHAT_ID=chat_id_admin_kamu

export async function POST(req: NextRequest) {
  try {
    // Verifikasi token admin
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN atau TELEGRAM_ADMIN_CHAT_ID belum diset di .env' }, { status: 500 });
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔔 *PUSAT NOKOS ADMIN ALERT*\n\n${message}`,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 502 });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('[send-alert]', err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}