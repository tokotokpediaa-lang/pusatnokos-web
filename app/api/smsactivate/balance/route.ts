import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    // Verifikasi token — pastikan user sudah login
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verifikasi token valid (tidak perlu cek email admin — cukup sudah login)
    await adminAuth.verifyIdToken(token);

    const apiKey = process.env.SMSACTIVATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SMSACTIVATE_API_KEY not set' }, { status: 500 });
    }

    // Hit hero-sms.com
    const res = await fetch(
      `https://hero-sms.com/stubs/handler_api.php?api_key=${apiKey}&action=getBalance`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    );

    const text = await res.text();

    // Format: "ACCESS_BALANCE:1.565"
    if (text.includes('ACCESS_BALANCE:')) {
      const balance = parseFloat(text.split('ACCESS_BALANCE:')[1].trim());
      return NextResponse.json({ balance });
    }

    console.error('[smsactivate/balance] Unexpected:', text);
    return NextResponse.json({ error: 'Unexpected response', raw: text }, { status: 502 });

  } catch (err: any) {
    console.error('[smsactivate/balance]', err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}