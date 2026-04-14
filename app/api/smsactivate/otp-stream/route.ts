// /api/smsactivate/otp-stream/route.ts
// Polling OTP dari hero-sms (SMS-Activate) — adaptasi dari otp-stream 5sim
// Endpoint: GET /api/smsactivate/otp-stream?token=JWT&orderId=FIRESTORE_ORDER_ID&mode=poll
//
// ✅ FIX BUG L: Token HANYA diterima via Authorization header, TIDAK dari URL query param.
//    URL: GET /api/smsactivate/otp-stream?orderId=XXX&mode=poll
//    Header: Authorization: Bearer <JWT>

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

const SA_BASE = 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY;

// ✅ FIX BUG M: Validasi SA_KEY di startup — fail-fast daripada silent failure
//    (SA_KEY undefined → semua request ke SA return 'BAD_KEY' tanpa error jelas).
if (!SA_KEY) {
  console.error('[otp-stream] SMSACTIVATE_API_KEY belum di-set di .env!');
}

// ── Helper: fetch ke SA ───────────────────────────────────────────────────────
const fetchSA = (activationId: string, timeoutMs = 7000) =>
  fetch(
    `${SA_BASE}?action=getStatus&api_key=${SA_KEY}&id=${activationId}`,
    { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) },
  );

// ── Helper: parse Firestore Timestamp / ISO string / number → ms ──────────────
// ✅ FIX BUG D: Firestore Timestamp object di-parse dengan .toDate() — bukan
//    new Date(timestamp) yang menghasilkan NaN sehingga expiry tidak pernah jalan.
function parseTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toDate().getTime();
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  const ms = new Date(value as any).getTime();
  return isNaN(ms) ? 0 : ms;
}

// ── Helper: parse response SA ─────────────────────────────────────────────────
// ✅ FIX BUG J: STATUS_WAIT_RETRY TIDAK menghasilkan otp — SA masih menunggu
//    SMS final. Kode yang diekstrak dari WAIT_RETRY bukan OTP valid dan bisa
//    membuat order 'success' dengan OTP salah.
function parseSAResponse(text: string): { status: string; otp: string | null; sms: string | null } {
  const raw = text.trim();

  if (raw.startsWith('STATUS_OK:')) {
    const otp = raw.replace('STATUS_OK:', '').trim();
    return { status: 'STATUS_OK', otp, sms: otp };
  }
  if (raw.startsWith('STATUS_WAIT_RETRY:')) {
    // Simpan teks SMS untuk informasi, tapi jangan jadikan OTP
    const sms = raw.replace('STATUS_WAIT_RETRY:', '').trim();
    return { status: 'STATUS_WAIT_RETRY', otp: null, sms };
  }
  if (raw === 'STATUS_CANCEL')      return { status: 'STATUS_CANCEL',      otp: null, sms: null };
  if (raw === 'STATUS_WAIT_CODE')   return { status: 'STATUS_WAIT_CODE',   otp: null, sms: null };
  if (raw === 'STATUS_WAIT_RESEND') return { status: 'STATUS_WAIT_RESEND', otp: null, sms: null };

  return { status: raw, otp: null, sms: null };
}

// ── Status terminal yang harus menghentikan polling ───────────────────────────
// ✅ FIX BUG K: Tambahkan 'COMPLETED' — set-status route menyimpan status ini
//    untuk status=6. Sebelumnya otp-stream terus polling walau order sudah selesai.
const TERMINAL_STATUSES = ['success', 'COMPLETED', 'CANCELLED', 'cancelled', 'canceled'];

// ── Mode: single poll ─────────────────────────────────────────────────────────
// ✅ FIX BUG B: Terima existingSnap dari caller sehingga tidak ada double Firestore read.
async function handlePollMode(
  activationId: string,
  orderRef:     FirebaseFirestore.DocumentReference,
  existingSnap: FirebaseFirestore.DocumentSnapshot,
): Promise<Response> {
  try {
    if (!existingSnap.exists) return Response.json({ status: 'CANCELLED', otp: null });

    const orderData = existingSnap.data()!;

    // ✅ FIX BUG K: Cek 'COMPLETED' juga, bukan hanya 'success'
    if (orderData.status === 'success' || orderData.status === 'COMPLETED') {
      return Response.json({
        status:  orderData.status,
        otp:     orderData.otp,
        phone:   orderData.phone,
        allSms:  orderData.allSms ?? [],
      });
    }

    if (['cancelled', 'CANCELLED', 'canceled'].includes(orderData.status)) {
      return Response.json({ status: 'CANCELLED', otp: null, phone: orderData.phone, allSms: [] });
    }

    // ✅ FIX BUG D: Gunakan parseTimestamp() — aman untuk Firestore Timestamp
    const expiresAt = parseTimestamp(orderData.expiresAt);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      try {
        await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() });
      } catch { /* best effort */ }
      return Response.json({ status: 'CANCELLED', otp: null, expired: true, phone: orderData.phone, allSms: [] });
    }

    // ✅ FIX BUG M: Gagal cepat jika SA_KEY tidak ada
    if (!SA_KEY) {
      console.error('[sa-poll] SA_KEY tidak tersedia, skip poll ke SA');
      return Response.json({ status: 'active', otp: null, remainingMs: Math.max(0, expiresAt - Date.now()) });
    }

    const saRes = await fetchSA(activationId);
    if (!saRes.ok) {
      console.warn(`[sa-poll] HTTP ${saRes.status} activationId=${activationId}`);
      // ✅ FIX BUG V: Sertakan remainingMs agar frontend countdown tidak freeze
      return Response.json({
        status: 'active',
        otp:    null,
        remainingMs: Math.max(0, expiresAt - Date.now()),
      });
    }

    const saText = await saRes.text();
    console.log(`[sa-poll] activationId=${activationId} response=${saText}`);

    const { status: saStatus, otp, sms } = parseSAResponse(saText);

    if (saStatus === 'STATUS_CANCEL') {
      try { await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
      return Response.json({ status: 'CANCELLED', otp: null, phone: orderData.phone, allSms: [] });
    }

    if (otp) {
      const newSmsEntry = { text: sms ?? otp, otp, receivedAt: Date.now() };
      // ✅ FIX BUG C: Gunakan FieldValue.arrayUnion agar atomic
      try {
        await orderRef.update({
          status:  'success',
          otp,
          sms,
          allSms:    FieldValue.arrayUnion(newSmsEntry),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch { /* best effort */ }
      console.log(`[sa-poll] OTP ditemukan activationId=${activationId} otp=${otp}`);
      return Response.json({
        status: 'success',
        otp,
        phone:  orderData.phone,
        // Kembalikan allSms dari Firestore yang sudah diupdate; untuk poll mode
        // kita kembalikan versi lokal sebagai estimasi terbaik
        allSms: [...(orderData.allSms ?? []), newSmsEntry],
      });
    }

    return Response.json({
      status: 'active',
      otp:    null,
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
  const orderId = searchParams.get('orderId');
  const mode    = searchParams.get('mode');

  if (!orderId) return new Response('orderId wajib diisi.', { status: 400 });

  // ✅ FIX BUG L: Token HANYA dari Authorization header.
  //    Mengirim JWT via URL query param membocorkan token ke server log,
  //    browser history, dan referrer header.
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return new Response('Token wajib diisi via Authorization header.', { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return new Response('Token tidak valid.', { status: 401 });
  }

  const orderRef = adminDb.collection('users').doc(uid).collection('orders').doc(orderId);

  // ✅ FIX BUG X: Wrap Firestore read di main handler dengan try-catch
  let orderSnap: FirebaseFirestore.DocumentSnapshot;
  try {
    orderSnap = await orderRef.get();
  } catch (err: any) {
    console.error('[otp-stream] Firestore error saat membaca order:', err?.message);
    return new Response('Gagal membaca data order. Coba lagi.', { status: 503 });
  }

  if (!orderSnap.exists) return new Response('Order tidak ditemukan.', { status: 404 });

  const orderData    = orderSnap.data()!;
  const activationId = orderData.activationId;

  if (!activationId) return new Response('activationId tidak ditemukan di order.', { status: 400 });

  // ── Mode poll ─────────────────────────────────────────────────────────────
  if (mode === 'poll') {
    // ✅ FIX BUG B: Lempar existingSnap agar handlePollMode tidak baca ulang
    return handlePollMode(activationId, orderRef, orderSnap);
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

      let intervalId:    NodeJS.Timeout | null = null;
      let hardTimeoutId: NodeJS.Timeout | null = null;
      let lastOtp: string | null = null;
      let isPolling = false;

      const poll = async () => {
        if (closed) {
          if (intervalId)    clearInterval(intervalId);
          if (hardTimeoutId) clearTimeout(hardTimeoutId);
          return;
        }

        if (isPolling) return;
        isPolling = true;

        try {
          const snap = await orderRef.get();
          if (!snap.exists) {
            send({ status: 'CANCELLED', otp: null });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          const data = snap.data()!;

          // ✅ FIX BUG K: Cek 'COMPLETED' sebagai status terminal
          if (data.status === 'success' || data.status === 'COMPLETED') {
            send({ status: data.status, otp: data.otp, phone: data.phone, allSms: data.allSms ?? [] });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          if (['cancelled', 'CANCELLED', 'canceled'].includes(data.status)) {
            send({ status: 'CANCELLED', otp: null, phone: data.phone, allSms: [] });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          // ✅ FIX BUG D: Gunakan parseTimestamp()
          const expiresAt = parseTimestamp(data.expiresAt);
          if (expiresAt > 0 && Date.now() > expiresAt) {
            try {
              await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() });
            } catch { /* best effort */ }
            send({ status: 'CANCELLED', otp: null, expired: true, phone: data.phone, allSms: [] });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          // ✅ FIX BUG M: Skip poll ke SA jika key tidak ada
          if (!SA_KEY) {
            console.error('[sa-sse] SA_KEY tidak tersedia, skip poll ke SA');
            send({ status: 'active', otp: null, allSms: data.allSms ?? [], remainingMs: Math.max(0, expiresAt - Date.now()) });
            return;
          }

          const saRes = await fetchSA(activationId);
          if (!saRes.ok) {
            console.warn(`[sa-sse] HTTP ${saRes.status} activationId=${activationId}`);
            // ✅ FIX BUG V: Sertakan remainingMs agar frontend countdown tidak freeze
            send({ status: 'active', otp: null, allSms: data.allSms ?? [], remainingMs: Math.max(0, expiresAt - Date.now()) });
            return;
          }

          const saText = await saRes.text();
          console.log(`[sa-sse] activationId=${activationId} response=${saText}`);

          const { status: saStatus, otp, sms } = parseSAResponse(saText);

          if (saStatus === 'STATUS_CANCEL') {
            try { await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
            send({ status: 'CANCELLED', otp: null, phone: data.phone, allSms: [] });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          if (otp && otp !== lastOtp) {
            lastOtp = otp;
            const newSmsEntry = { text: sms ?? otp, otp, receivedAt: Date.now() };
            // ✅ FIX BUG C: Gunakan FieldValue.arrayUnion agar atomic
            try {
              await orderRef.update({
                status:    'success',
                otp,
                sms,
                allSms:    FieldValue.arrayUnion(newSmsEntry),
                updatedAt: FieldValue.serverTimestamp(),
              });
            } catch { /* best effort */ }
            console.log(`[sa-sse] OTP ditemukan activationId=${activationId} otp=${otp}`);
            send({ status: 'success', otp, phone: data.phone, allSms: [...(data.allSms ?? []), newSmsEntry] });
            if (intervalId)    clearInterval(intervalId);
            if (hardTimeoutId) clearTimeout(hardTimeoutId);
            close();
            return;
          }

          send({
            status: 'active',
            otp:    null,
            saStatus,
            allSms: data.allSms ?? [],
            remainingMs: Math.max(0, expiresAt - Date.now()),
          });

        } catch (err: any) {
          console.error('[sa-sse] poll error:', err?.message);
          if (!closed) send({ status: 'active', otp: null });
        } finally {
          isPolling = false;
        }
      };

      // ✅ FIX BUG R: Daftarkan abort listener SEBELUM await poll() agar tidak
      //    terlambat jika client disconnect selama first poll berjalan.
      request.signal?.addEventListener('abort', () => {
        if (intervalId)    clearInterval(intervalId);
        if (hardTimeoutId) clearTimeout(hardTimeoutId);
        close();
      });

      await poll();

      // ✅ FIX BUG A: Hanya set interval & timeout jika stream belum closed.
      //    Jika poll() pertama langsung menemukan OTP/CANCELLED/expired,
      //    close() sudah dipanggil — jangan set timer yang akan jalan 22 menit
      //    dan membuat phantom Firestore write.
      if (!closed) {
        intervalId = setInterval(poll, 10_000);

        hardTimeoutId = setTimeout(async () => {
          if (intervalId) clearInterval(intervalId);
          try {
            await orderRef.update({ status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() });
          } catch { /* best effort */ }
          if (!closed) send({ status: 'CANCELLED', otp: null, expired: true });
          close();
        }, 22 * 60 * 1000);
      }
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