// /api/smsactivate/otp-stream/route.ts
// Polling OTP dari hero-sms (SMS-Activate) — adaptasi dari otp-stream 5sim
// Endpoint: GET /api/smsactivate/otp-stream?token=JWT&orderId=FIRESTORE_ORDER_ID&mode=poll

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

const SA_BASE = 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY!;

// ── Helper: fetch ke SA dengan cache: no-store ────────────────────────────────
const fetchSA = (activationId: string, timeoutMs = 8000) =>
  fetch(
    `${SA_BASE}?action=getStatus&api_key=${SA_KEY}&id=${activationId}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

// ── Helper: parse response SA ─────────────────────────────────────────────────
// SA mengembalikan plain text, bukan JSON:
//   STATUS_WAIT_CODE        → belum ada SMS
//   STATUS_WAIT_RETRY:text  → SMS masuk, tapi minta retry
//   STATUS_OK:code          → OTP diterima ✅
//   STATUS_CANCEL           → dibatalkan
//   STATUS_WAIT_RESEND      → minta kirim ulang
function parseSAResponse(text: string): { status: string; otp: string | null; sms: string | null } {
  const raw = text.trim();

  if (raw.startsWith('STATUS_OK:')) {
    const otp = raw.replace('STATUS_OK:', '').trim();
    return { status: 'STATUS_OK', otp, sms: otp };
  }
  if (raw.startsWith('STATUS_WAIT_RETRY:')) {
    const sms = raw.replace('STATUS_WAIT_RETRY:', '').trim();
    // Coba ekstrak angka 4-8 digit dari teks SMS
    const match = sms.match(/\b(\d{4,8})\b/);
    return { status: 'STATUS_WAIT_RETRY', otp: match?.[1] ?? null, sms };
  }
  if (raw === 'STATUS_CANCEL')      return { status: 'STATUS_CANCEL',      otp: null, sms: null };
  if (raw === 'STATUS_WAIT_CODE')   return { status: 'STATUS_WAIT_CODE',   otp: null, sms: null };
  if (raw === 'STATUS_WAIT_RESEND') return { status: 'STATUS_WAIT_RESEND', otp: null, sms: null };

  return { status: raw, otp: null, sms: null };
}

// ── Mode: single poll ─────────────────────────────────────────────────────────
async function handlePollMode(
  activationId: string,
  orderRef: FirebaseFirestore.DocumentReference,
): Promise<Response> {
  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return Response.json({ status: 'canceled', otp: null });

    const orderData = orderSnap.data()!;

    if (orderData.status === 'success')   return Response.json({ status: 'success',  otp: orderData.otp,  phone: orderData.phone, allSms: orderData.allSms ?? [] });
    // ✅ FIX BUG #2: Backend menyimpan 'cancelled' (lowercase) tapi frontend cek 'CANCELLED'.
    // Normalisasi keduanya agar frontend selalu terima 'CANCELLED'.
    if (orderData.status === 'cancelled' || orderData.status === 'CANCELLED') return Response.json({ status: 'CANCELLED', otp: null, phone: orderData.phone, allSms: [] });

    // Cek expired
    const expiresAt = orderData.expiresAt ? new Date(orderData.expiresAt).getTime() : 0;
    if (expiresAt > 0 && Date.now() > expiresAt) {
      return Response.json({ status: 'CANCELLED', otp: null, expired: true, phone: orderData.phone, allSms: [] });
    }

    // Poll ke SA
    const saRes = await fetchSA(activationId);
    if (!saRes.ok) {
      console.warn(`[sa-poll] HTTP ${saRes.status} activationId=${activationId}`);
      return Response.json({ status: 'active', otp: null, remainingMs: Math.max(0, expiresAt - Date.now()) });
    }

    const saText = await saRes.text();
    console.log(`[sa-poll] activationId=${activationId} response=${saText}`);

    const { status: saStatus, otp, sms } = parseSAResponse(saText);

    if (saStatus === 'STATUS_CANCEL') {
      try { await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
      return Response.json({ status: 'CANCELLED', otp: null, phone: orderData.phone, allSms: [] });
    }

    if (otp) {
      // ✅ FIX BUG #3: Kirim allSms agar frontend bisa tampilkan riwayat SMS lengkap.
      const newSmsEntry = { text: sms ?? otp, otp, receivedAt: Date.now() };
      const allSms = [...(orderData.allSms ?? []), newSmsEntry];
      try { await orderRef.update({ status: 'success', otp, sms, allSms, updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
      console.log(`[sa-poll] OTP ditemukan activationId=${activationId} otp=${otp}`);
      return Response.json({ status: 'success', otp, phone: orderData.phone, allSms });
    }

    return Response.json({
      status: 'active',
      otp: null,
      saStatus,
      allSms: orderData.allSms ?? [],
      remainingMs: Math.max(0, expiresAt - Date.now()),
    });

  } catch (err: any) {
    console.error(`[sa-poll] error activationId=${activationId}:`, err?.message);
    return Response.json({ status: 'active', otp: null });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId'); // Firestore order doc ID
  const mode    = searchParams.get('mode');

  if (!orderId) return new Response('orderId wajib diisi.', { status: 400 });

  // ✅ FIX BUG #1 KRITIS: Baca token dari Authorization header (cara aman — page.tsx
  // mengirim via header sejak security fix). Fallback ke query param untuk SSE
  // (EventSource tidak support custom header secara native).
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    ?? searchParams.get('token');

  if (!token) return new Response('Token wajib diisi.', { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return new Response('Token tidak valid.', { status: 401 });
  }

  const orderRef = adminDb.collection('users').doc(uid).collection('orders').doc(orderId);

  // Ambil activationId dari Firestore
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return new Response('Order tidak ditemukan.', { status: 404 });

  const orderData    = orderSnap.data()!;
  const activationId = orderData.activationId;

  if (!activationId) return new Response('activationId tidak ditemukan di order.', { status: 400 });

  // ── Mode poll ─────────────────────────────────────────────────────────────
  if (mode === 'poll') {
    return handlePollMode(activationId, orderRef);
  }

  // ── Mode SSE stream ───────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: object) => {
        if (closed) return;
        try { controller.enqueue(`data: ${JSON.stringify(data)}\n\n`); } catch { closed = true; }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      let intervalId: NodeJS.Timeout;
      let lastOtp: string | null = null;

      const poll = async () => {
        if (closed) { clearInterval(intervalId); return; }

        try {
          const snap = await orderRef.get();
          if (!snap.exists) { send({ status: 'canceled', otp: null }); clearInterval(intervalId); close(); return; }

          const data = snap.data()!;

          if (data.status === 'success') {
            send({ status: 'success', otp: data.otp, phone: data.phone, allSms: data.allSms ?? [] });
            clearInterval(intervalId); close(); return;
          }
          if (data.status === 'cancelled' || data.status === 'CANCELLED') {
            send({ status: 'CANCELLED', otp: null, phone: data.phone, allSms: [] });
            clearInterval(intervalId); close(); return;
          }

          const expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
          if (expiresAt > 0 && Date.now() > expiresAt) {
            send({ status: 'CANCELLED', otp: null, expired: true, phone: data.phone, allSms: [] });
            clearInterval(intervalId); close(); return;
          }

          // Poll ke SA
          const saRes = await fetchSA(activationId);
          if (!saRes.ok) {
            console.warn(`[sa-sse] HTTP ${saRes.status} activationId=${activationId}`);
            send({ status: 'active', otp: null, allSms: data.allSms ?? [] });
            return;
          }

          const saText = await saRes.text();
          console.log(`[sa-sse] activationId=${activationId} response=${saText}`);

          const { status: saStatus, otp, sms } = parseSAResponse(saText);

          if (saStatus === 'STATUS_CANCEL') {
            try { await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
            send({ status: 'CANCELLED', otp: null, phone: data.phone, allSms: [] });
            clearInterval(intervalId); close(); return;
          }

          if (otp && otp !== lastOtp) {
            lastOtp = otp;
            const newSmsEntry = { text: sms ?? otp, otp, receivedAt: Date.now() };
            const allSms = [...(data.allSms ?? []), newSmsEntry];
            try { await orderRef.update({ status: 'success', otp, sms, allSms, updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
            console.log(`[sa-sse] OTP ditemukan activationId=${activationId} otp=${otp}`);
            send({ status: 'success', otp, phone: data.phone, allSms });
            clearInterval(intervalId); close(); return;
          }

          send({ status: 'active', otp: null, saStatus, allSms: data.allSms ?? [], remainingMs: Math.max(0, expiresAt - Date.now()) });

        } catch (err: any) {
          console.error('[sa-sse] poll error:', err?.message);
          if (!closed) send({ status: 'active', otp: null });
        }
      };

      await poll();
      intervalId = setInterval(poll, 3000); // poll setiap 3 detik

      // Hard timeout 22 menit
      setTimeout(() => {
        clearInterval(intervalId);
        if (!closed) send({ status: 'canceled', otp: null, expired: true });
        close();
      }, 22 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}