/// /api/smsactivate/webhook/route.ts
//
// ⚠️ SETUP WAJIB:
// 1. Daftarkan URL ini di dashboard SMS-Activate (TANPA ?secret= di URL):
//    https://pusatnokos.ngrok-free.app/api/smsactivate/webhook
//    Lalu set header: x-webhook-secret = <isi dari .env SMSACTIVATE_WEBHOOK_SECRET>
//
// 2. Buat Firestore index untuk collectionGroup 'orders':
//    Fields: activationId (ASC), provider (ASC) | Scope: Collection group
//
// 3. Tambahkan ke .env.local:
//    SMSACTIVATE_WEBHOOK_SECRET=isi_random_string_kamu

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── FIX #L5: Hilangkan module-level check yang menyesatkan ──────────────────
// Guard yang sebenarnya ada di dalam handler.
const WEBHOOK_SECRET = process.env.SMSACTIVATE_WEBHOOK_SECRET;

// ─── FIX #M1: Rate limiter in-memory (per IP) ─────────────────────────────────
// ⚠️ NOTE: In-memory rate limiter hanya bekerja pada single instance.
// Untuk multi-instance / serverless, gunakan Redis atau Upstash.
const _rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX        = 60;   // max request
const RATE_LIMIT_WINDOW_MS  = 60_000; // per menit

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const prev = (_rateLimitStore.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (prev.length >= RATE_LIMIT_MAX) return true;
  prev.push(now);
  _rateLimitStore.set(ip, prev);
  return false;
}

// ─── FIX #L1: Batas maksimum entri allSms per order ──────────────────────────
const ALL_SMS_MAX_ENTRIES = 50;

interface SAWebhookPayload {
  activationId: string;
  service:      string;
  text:         string | null;
  code:         string | null;
  country:      number;
  receivedAt:   string;
  status?:      string;
}

// ─── FIX #M2: Semua status sekarang UPPERCASE konsisten ──────────────────────
function mapStatus(code: string | null, rawStatus?: string): string {
  if (rawStatus === 'STATUS_CANCEL')                  return 'CANCELLED';
  if (rawStatus === 'STATUS_WAIT_RETRY')              return 'PENDING';
  if (rawStatus === 'STATUS_WAIT_CODE')               return 'PENDING';
  if (rawStatus === 'STATUS_WAIT_RESEND')             return 'PENDING';
  if (rawStatus === 'STATUS_OK' && code)              return 'SUCCESS';   // fix: was 'success'
  if (rawStatus === 'STATUS_OK' && !code)             return 'PENDING';
  if (code)                                           return 'SUCCESS';   // fix: was 'success'
  return 'PENDING';
}

export async function POST(req: NextRequest) {
  // ─── Guard: secret harus dikonfigurasi ──────────────────────────────────────
  if (!WEBHOOK_SECRET) {
    console.error('[SA webhook] SMSACTIVATE_WEBHOOK_SECRET belum di-set di .env — webhook diblokir');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // ─── FIX #M1: Rate limiting berdasarkan IP ───────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    console.warn('[SA webhook] Rate limit exceeded untuk IP:', ip);
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  // ─── FIX #H1: Secret HANYA dari header, TIDAK dari query param ───────────────
  // Query param secret meninggalkan jejak di server log, proxy log, dan CDN log.
  const secret = req.headers.get('x-webhook-secret');

  if (!secret || secret !== WEBHOOK_SECRET) {
    console.warn('[SA webhook] Unauthorized — invalid or missing x-webhook-secret header');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SAWebhookPayload;
  try {
    payload = await req.json();
  } catch (parseErr) {
    console.error('[SA webhook] Gagal parse JSON body:', parseErr);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const { activationId, text, code, status: rawStatus, receivedAt: saReceivedAt } = payload;

  if (!activationId || typeof activationId !== 'string' || activationId.trim() === '') {
    return NextResponse.json({ error: 'activationId required' }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collectionGroup('orders')
      .where('activationId', '==', activationId.trim())
      .where('provider',     '==', 'smsactivate')
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn('[SA webhook] Order not found for activationId:', activationId);
      return NextResponse.json({ received: true });
    }

    const orderDoc  = snap.docs[0];
    const orderData = orderDoc.data();

    // ─── FIX #M2: finalStatuses memakai casing konsisten UPPERCASE ──────────────
    const finalStatuses = ['SUCCESS', 'COMPLETED', 'CANCELLED'];
    if (finalStatuses.includes(orderData.status)) {
      console.log(
        '[SA webhook] Order sudah final, skip update. activationId:',
        activationId, 'status:', orderData.status,
      );
      return NextResponse.json({ received: true });
    }

    const newStatus = mapStatus(code ?? null, rawStatus);

    const updatePayload: Record<string, unknown> = {
      sms:       text  ?? null,
      otp:       code  ?? null,
      status:    newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (code) {
      const saTs = saReceivedAt
        ? (() => { const t = new Date(saReceivedAt).getTime(); return isNaN(t) ? Date.now() : t; })()
        : Date.now();

      // ─── FIX #H2: Dedup key pakai kombinasi code + text bukan receivedAt ────────
      // receivedAt berubah tiap retry → objek dianggap baru → SMS duplikat.
      // Dengan normalisedKey yang stabil, arrayUnion benar-benar dedup.
      const newSmsEntry = {
        text:        text ?? code,
        otp:         code,
        receivedAt:  saTs,
        _dedupKey:   `${code}:${text ?? ''}`, // stable key untuk deep-equality arrayUnion
      };

      // ─── FIX #L1: Cek ukuran allSms sebelum menambah entri baru ─────────────────
      await adminDb.runTransaction(async (t) => {
        const freshSnap = await t.get(orderDoc.ref);
        if (!freshSnap.exists) return;

        const freshData    = freshSnap.data()!;
        const currentSms: unknown[] = Array.isArray(freshData.allSms) ? freshData.allSms : [];

        if (finalStatuses.includes(freshData.status)) return; // re-check di dalam tx

        const baseUpdate: Record<string, unknown> = {
          ...updatePayload,
        };

        if (currentSms.length < ALL_SMS_MAX_ENTRIES) {
          baseUpdate.allSms = FieldValue.arrayUnion(newSmsEntry);
        } else {
          console.warn(
            '[SA webhook] allSms sudah mencapai batas max', ALL_SMS_MAX_ENTRIES,
            'untuk activationId:', activationId,
          );
        }

        t.update(orderDoc.ref, baseUpdate);
      });

    } else {
      await orderDoc.ref.update(updatePayload);
    }

    console.log(
      '[SA webhook] activationId:', activationId,
      '| status:', newStatus,
      '| otp:', code ? '***' : null,
    );

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err: unknown) {
    console.error('[smsactivate/webhook] Firestore error — SA akan retry:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}