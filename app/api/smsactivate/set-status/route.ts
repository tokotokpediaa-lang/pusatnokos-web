/// /api/smsactivate/webhook/route.ts
//
// FIXES APPLIED:
//  [BUG FIX #1] STATUS_CANCEL sekarang trigger refund saldo otomatis ke user
//               (sebelumnya: status berubah CANCELLED tapi saldo tidak dikembalikan)
//  [IMPROVE]    Refund dijalankan dalam Firestore transaction untuk keamanan
//  [IMPROVE]    Mutasi refund dicatat di subcollection transactions user
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

const WEBHOOK_SECRET = process.env.SMSACTIVATE_WEBHOOK_SECRET;

// ─── Rate limiter in-memory (per IP) ──────────────────────────────────────────
// ⚠️ NOTE: Hanya bekerja pada single instance.
// Untuk multi-instance / serverless, gunakan Redis atau Upstash.
const _rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX       = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const prev = (_rateLimitStore.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (prev.length >= RATE_LIMIT_MAX) return true;
  prev.push(now);
  _rateLimitStore.set(ip, prev);
  return false;
}

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

// Status final — UPPERCASE konsisten
const FINAL_STATUSES = ['SUCCESS', 'COMPLETED', 'CANCELLED'];

function mapStatus(code: string | null, rawStatus?: string): string {
  if (rawStatus === 'STATUS_CANCEL')                  return 'CANCELLED';
  if (rawStatus === 'STATUS_WAIT_RETRY')              return 'PENDING';
  if (rawStatus === 'STATUS_WAIT_CODE')               return 'PENDING';
  if (rawStatus === 'STATUS_WAIT_RESEND')             return 'PENDING';
  if (rawStatus === 'STATUS_OK' && code)              return 'SUCCESS';
  if (rawStatus === 'STATUS_OK' && !code)             return 'PENDING';
  if (code)                                           return 'SUCCESS';
  return 'PENDING';
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[SA webhook] SMSACTIVATE_WEBHOOK_SECRET belum di-set di .env — webhook diblokir');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    console.warn('[SA webhook] Rate limit exceeded untuk IP:', ip);
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

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

    if (FINAL_STATUSES.includes(orderData.status)) {
      console.log(
        '[SA webhook] Order sudah final, skip update. activationId:',
        activationId, 'status:', orderData.status,
      );
      return NextResponse.json({ received: true });
    }

    const newStatus = mapStatus(code ?? null, rawStatus);

    // ✅ FIX #1: Jika status CANCELLED, proses refund saldo ke user
    if (newStatus === 'CANCELLED') {
      // userRef adalah parent dari subcollection orders (users/{uid})
      const userRef = orderDoc.ref.parent.parent!;

      await adminDb.runTransaction(async (t) => {
        const freshSnap = await t.get(orderDoc.ref);
        if (!freshSnap.exists) return;

        const freshData = freshSnap.data()!;

        // Re-check di dalam tx — hindari double refund
        if (FINAL_STATUSES.includes(freshData.status)) {
          console.log('[SA webhook] Order sudah final di dalam tx, skip refund. activationId:', activationId);
          return;
        }

        const refundAmount = freshData.price ?? 0;

        // Update status order ke CANCELLED
        t.update(orderDoc.ref, {
          status:    'CANCELLED',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ✅ Kembalikan saldo hanya jika ada nilai yang valid
        if (refundAmount > 0) {
          t.update(userRef, {
            balance:    FieldValue.increment(refundAmount),
            totalSpent: FieldValue.increment(-refundAmount),
          });

          // Catat mutasi refund
          // Key unik pakai activationId agar tidak duplikat jika webhook dikirim ulang
          const mutasiRef = userRef.collection('transactions').doc(`${activationId}_cancel_refund`);
          t.set(mutasiRef, {
            type:      'refund',
            amount:    refundAmount,
            desc:      `Refund otomatis - ${(freshData.serviceId ?? freshData.service ?? 'Nomor').toUpperCase()} (Server 2) dibatalkan`,
            status:    'success',
            orderId:   orderDoc.id,
            activationId,
            timestamp: Date.now(),
          });

          console.log(
            '[SA webhook] Refund berhasil. activationId:', activationId,
            '| orderId:', orderDoc.id,
            '| refundAmount:', refundAmount,
          );
        } else {
          // Tetap update status meski harga 0 (edge case)
          console.warn(
            '[SA webhook] refundAmount 0 atau tidak ada. activationId:', activationId,
            'orderId:', orderDoc.id,
          );
        }
      });

      return NextResponse.json({ received: true });
    }

    // ─── Handle status SUCCESS / PENDING (logika asli, tidak berubah) ─────────
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

      const newSmsEntry = {
        text:       text ?? code,
        otp:        code,
        receivedAt: saTs,
        _dedupKey:  `${code}:${text ?? ''}`,
      };

      await adminDb.runTransaction(async (t) => {
        const freshSnap = await t.get(orderDoc.ref);
        if (!freshSnap.exists) return;

        const freshData    = freshSnap.data()!;
        const currentSms: unknown[] = Array.isArray(freshData.allSms) ? freshData.allSms : [];

        if (FINAL_STATUSES.includes(freshData.status)) return;

        const baseUpdate: Record<string, unknown> = { ...updatePayload };

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