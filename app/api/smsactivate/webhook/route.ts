// /api/smsactivate/webhook/route.ts
// Daftarkan URL ini di dashboard SMS-Activate:
// https://pusatnokos.ngrok-free.app/api/smsactivate/webhook?secret=pnokos$7xK!mQ2w
// ⚠️ WAJIB: Buat Firestore index untuk collectionGroup 'orders':
//   Fields  : activationId (ASC), provider (ASC)
//   Scope   : Collection group
//
// ⚠️ WAJIB: Tambahkan ke .env.local:
//   SMSACTIVATE_WEBHOOK_SECRET=isi_random_string_kamu

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

const WEBHOOK_SECRET = process.env.SMSACTIVATE_WEBHOOK_SECRET;

interface SAWebhookPayload {
  activationId: string;
  service:      string;
  text:         string | null;
  code:         string | null;
  country:      number;
  receivedAt:   string;
  status?:      string; // STATUS_OK | STATUS_WAIT_CODE | STATUS_CANCEL | STATUS_WAIT_RETRY
}

function mapStatus(code: string | null, rawStatus?: string): string {
  if (rawStatus === 'STATUS_CANCEL')     return 'cancelled';
  if (rawStatus === 'STATUS_WAIT_RETRY') return 'PENDING';
  if (rawStatus === 'STATUS_WAIT_CODE')  return 'PENDING';
  if (rawStatus === 'STATUS_OK' || code) return 'success';
  return 'PENDING';
}

export async function POST(req: NextRequest) {
  // ✅ Validasi secret via query param atau header
  const url    = new URL(req.url);
  const secret = url.searchParams.get('secret')
    ?? req.headers.get('x-webhook-secret');

  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    console.warn('[SA webhook] Unauthorized — invalid secret');
    // Tetap return 200 agar SA tidak retry terus-menerus
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const payload: SAWebhookPayload = await req.json();
    const { activationId, text, code, status: rawStatus } = payload;

    if (!activationId) {
      return NextResponse.json({ error: 'activationId required' }, { status: 400 });
    }

    // collectionGroup agar bisa query subcollection users/{uid}/orders
    const snap = await adminDb
      .collectionGroup('orders')
      .where('activationId', '==', String(activationId))
      .where('provider',     '==', 'smsactivate')
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn('[SA webhook] Order not found for activationId:', activationId);
      return NextResponse.json({ received: true });
    }

    // ✅ Status mapping yang benar berdasarkan rawStatus dari SA
    const newStatus = mapStatus(code ?? null, rawStatus);

    await snap.docs[0].ref.update({
      sms:       text      ?? null,
      otp:       code      ?? null,
      status:    newStatus,
      updatedAt: new Date().toISOString(),
    });

    console.log('[SA webhook] activationId:', activationId, '| status:', newStatus, '| otp:', code ? '***' : null);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[smsactivate/webhook]', err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}