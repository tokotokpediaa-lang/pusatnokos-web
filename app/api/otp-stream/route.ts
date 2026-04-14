// app/api/otp-stream/route.ts
// FIXES APPLIED:
//  [CRITICAL] Tambah cache: 'no-store' di SEMUA fetch ke 5sim — tanpa ini
//             Next.js 13+ meng-cache response pertama (sms:[]) dan terus
//             mengembalikannya meski SMS sudah masuk di 5sim. Ini penyebab
//             utama OTP tidak pernah terdeteksi.
//  [BUG FIX]  SSE mode sekarang punya fallback inbox + retry saat
//             status=RECEIVED tapi sms[] kosong — sebelumnya hanya poll
//             mode yang punya fallback ini.

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

// ── Helper: ekstrak OTP dari objek SMS ───────────────────────────────────────
const extractOtp = (sms: any): string | null => {
  if (!sms) return null;

  // Coba field 'code' dulu (5sim kadang langsung isi ini)
  if (sms.code && typeof sms.code === 'string' && sms.code.trim()) {
    const c = sms.code.trim();
    if (/^\d{4,8}$/.test(c)) return c;
  }

  // Semua field teks yang mungkin berisi isi SMS
  const textFields = ['text', 'Text', 'body', 'Body', 'message', 'Message', 'content'];
  for (const field of textFields) {
    const text = sms[field];
    if (typeof text === 'string' && text.trim()) {
      const match = text.match(/\b(\d{4,8})\b/);
      if (match) return match[1];
    }
  }

  return null;
};

// ── Helper: ekstrak array SMS dari berbagai format response 5sim ──────────────
const extractSmsArray = (data: any): any[] => {
  if (!data) return [];

  const keys = ['sms', 'Sms', 'SMS', 'Data', 'data', 'messages', 'Messages', 'codes'];
  for (const key of keys) {
    if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
  }

  if (Array.isArray(data) && data.length > 0) return data;

  if (data.text || data.code || data.body) return [data];

  return [];
};

// ── Helper: fetch ke 5sim dengan cache: no-store ─────────────────────────────
// WAJIB cache: 'no-store' — Next.js 13+ meng-cache fetch secara default.
// Tanpa ini, setiap poll mengembalikan response lama (sms:[]) dari cache
// meski SMS sudah masuk di 5sim.
const fetchFiveSim = (url: string, apiKey: string, timeoutMs = 8000) =>
  fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    cache: 'no-store',   // ← FIX UTAMA: paksa fresh setiap request
    signal: AbortSignal.timeout(timeoutMs),
  });

// ── Helper: coba ambil SMS dari inbox + retry check ───────────────────────────
// Dipakai di KEDUA mode (poll & SSE) saat status=RECEIVED tapi sms[] kosong.
async function tryFetchSmsFromInboxAndRetry(
  orderId: string,
  apiKey: string,
): Promise<any[]> {
  // 1. Coba inbox endpoint
  try {
    const inboxRes = await fetchFiveSim(
      `https://5sim.net/v1/user/sms/inbox/${orderId}`,
      apiKey,
      5000,
    );
    if (inboxRes.ok) {
      const inboxData = await inboxRes.json();
      console.log(`[5sim] inbox orderId=${orderId}:`, JSON.stringify(inboxData).substring(0, 300));
      const inboxSms = extractSmsArray(inboxData);
      if (inboxSms.length > 0) return inboxSms;
    }
  } catch (err: any) {
    console.warn(`[5sim] inbox fetch gagal orderId=${orderId}:`, err?.message);
  }

  // 2. Jika inbox kosong, retry check endpoint
  try {
    const retryRes = await fetchFiveSim(
      `https://5sim.net/v1/user/check/${orderId}`,
      apiKey,
      5000,
    );
    if (retryRes.ok) {
      const retryData = await retryRes.json();
      console.log(`[5sim] retry orderId=${orderId}:`, JSON.stringify(retryData).substring(0, 300));
      const retrySms = extractSmsArray(retryData);
      if (retrySms.length > 0) return retrySms;
    }
  } catch (err: any) {
    console.warn(`[5sim] retry fetch gagal orderId=${orderId}:`, err?.message);
  }

  return [];
}

// ── Mode: single poll ─────────────────────────────────────────────────────────
async function handlePollMode(
  orderId: string,
  uid: string,
  orderRef: FirebaseFirestore.DocumentReference,
  FIVE_SIM_API_KEY: string,
): Promise<Response> {
  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return Response.json({ status: 'canceled', otp: null });
    }

    const orderData = orderSnap.data()!;

    if (orderData.status === 'success') {
      return Response.json({ status: 'success', otp: orderData.otp, number: orderData.number });
    }
    if (orderData.status === 'canceled') {
      return Response.json({ status: 'canceled', otp: null, number: orderData.number });
    }

    const expiresAt: number = orderData.expiresAt || 0;
    if (expiresAt > 0 && Date.now() > expiresAt) {
      return Response.json({ status: 'canceled', otp: null, expired: true, number: orderData.number });
    }

    // ── Poll ke 5sim ──────────────────────────────────────────────────────
    const checkRes = await fetchFiveSim(
      `https://5sim.net/v1/user/check/${orderId}`,
      FIVE_SIM_API_KEY,
      8000,
    );

    if (!checkRes.ok) {
      console.warn(`[poll] 5sim HTTP ${checkRes.status} for orderId=${orderId} uid=${uid}`);
      if (checkRes.status === 404 || checkRes.status === 494) {
        try { await orderRef.update({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
        return Response.json({ status: 'canceled', otp: null });
      }
      return Response.json({ status: 'active', otp: null, remainingMs: Math.max(0, expiresAt - Date.now()) });
    }

    const simData = await checkRes.json();
    console.log(`[poll] 5sim raw orderId=${orderId}:`, JSON.stringify(simData).substring(0, 500));

    const simStatus: string = (simData?.status || 'PENDING').toUpperCase();

    if (simStatus === 'TIMEOUT' || simStatus === 'CANCELED') {
      try {
        await orderRef.update({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() });
      } catch { /* best effort */ }
      return Response.json({ status: 'canceled', otp: null, number: orderData.number });
    }

    let smsArr = extractSmsArray(simData);
    let otp: string | null = null;

    // Jika RECEIVED/FINISHED tapi sms[] kosong — coba inbox + retry
    if ((simStatus === 'RECEIVED' || simStatus === 'FINISHED') && smsArr.length === 0) {
      smsArr = await tryFetchSmsFromInboxAndRetry(orderId, FIVE_SIM_API_KEY);
    }

    for (let i = smsArr.length - 1; i >= 0; i--) {
      otp = extractOtp(smsArr[i]);
      if (otp) break;
    }

    if (!otp && simData?.code) otp = String(simData.code).trim() || null;

    if (otp) {
      try {
        await orderRef.update({ status: 'success', otp, updatedAt: FieldValue.serverTimestamp() });
      } catch { /* best effort */ }
      console.log(`[poll] OTP ditemukan orderId=${orderId} otp=${otp}`);
      return Response.json({ status: 'success', otp, number: orderData.number, allSms: smsArr });
    }

    return Response.json({
      status: 'active',
      otp: null,
      allSms: smsArr,
      simStatus,
      remainingMs: Math.max(0, expiresAt - Date.now()),
    });

  } catch (err: any) {
    console.error(`[poll] Unhandled error orderId=${orderId}:`, err?.message);
    return Response.json({ status: 'active', otp: null });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId  = searchParams.get('orderId');
  const mode     = searchParams.get('mode');

  if (!orderId) {
    return new Response('orderId tidak valid.', { status: 400 });
  }

  // ✅ FIX BUG KRITIS: Baca token dari Authorization header (page.tsx mengirim
  // via header sejak security fix). Fallback ke query param untuk SSE
  // (EventSource tidak support custom header secara native).
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    ?? searchParams.get('token');

  if (!token) {
    return new Response('Token wajib diisi.', { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return new Response('Token tidak valid.', { status: 401 });
  }

  const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
  if (!FIVE_SIM_API_KEY) {
    console.error('[otp-stream] FIVESIM_API_KEY tidak di-set!');
    return new Response('Konfigurasi server bermasalah.', { status: 500 });
  }

  const orderRef = adminDb
    .collection('users').doc(uid)
    .collection('orders').doc(orderId);

  // ── Mode poll (non-SSE) ───────────────────────────────────────────────────
  if (mode === 'poll') {
    return handlePollMode(orderId, uid, orderRef, FIVE_SIM_API_KEY);
  }

  // ── Buat SSE stream ───────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      let intervalId: NodeJS.Timeout;
      let lastOtp: string | null = null;

      const poll = async () => {
        if (closed) {
          clearInterval(intervalId);
          return;
        }

        try {
          const orderSnap = await orderRef.get();
          if (!orderSnap.exists) {
            send({ status: 'canceled', otp: null });
            clearInterval(intervalId);
            close();
            return;
          }

          const orderData = orderSnap.data()!;

          if (orderData.status === 'success') {
            send({ status: 'success', otp: orderData.otp, number: orderData.number });
            clearInterval(intervalId);
            close();
            return;
          }
          if (orderData.status === 'canceled') {
            send({ status: 'canceled', otp: null, number: orderData.number });
            clearInterval(intervalId);
            close();
            return;
          }

          const expiresAt: number = orderData.expiresAt || 0;
          if (expiresAt > 0 && Date.now() > expiresAt) {
            send({ status: 'canceled', otp: null, expired: true, number: orderData.number });
            clearInterval(intervalId);
            close();
            return;
          }

          const checkRes = await fetchFiveSim(
            `https://5sim.net/v1/user/check/${orderId}`,
            FIVE_SIM_API_KEY,
            8000,
          );

          if (!checkRes.ok) {
            console.warn(`[sse] 5sim HTTP ${checkRes.status} orderId=${orderId}`);
            if (checkRes.status === 404 || checkRes.status === 494) {
              try { await orderRef.update({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() }); } catch { /* best effort */ }
              send({ status: 'canceled', otp: null });
              clearInterval(intervalId);
              close();
              return;
            }
            send({ status: 'active', otp: null });
            return;
          }

          const simData = await checkRes.json();
          console.log(`[sse] 5sim raw orderId=${orderId}:`, JSON.stringify(simData).substring(0, 400));

          const simStatus: string = (simData?.status || 'PENDING').toUpperCase();

          if (simStatus === 'RECEIVED' || simStatus === 'FINISHED') {
            let smsArr = extractSmsArray(simData);

            // ── FIX: SSE juga coba inbox + retry saat sms[] kosong ─────────
            // Sebelumnya hanya poll mode yang punya fallback ini.
            if (smsArr.length === 0) {
              smsArr = await tryFetchSmsFromInboxAndRetry(orderId, FIVE_SIM_API_KEY);
            }

            let otp: string | null = null;
            for (let i = smsArr.length - 1; i >= 0; i--) {
              otp = extractOtp(smsArr[i]);
              if (otp) break;
            }
            if (!otp && simData?.code) otp = String(simData.code).trim() || null;

            if (otp && otp !== lastOtp) {
              lastOtp = otp;
              try {
                await orderRef.update({ status: 'success', otp, updatedAt: FieldValue.serverTimestamp() });
              } catch { /* best effort */ }
              console.log(`[sse] OTP ditemukan orderId=${orderId} otp=${otp}`);
              send({ status: 'success', otp, number: orderData.number, allSms: smsArr });
              clearInterval(intervalId);
              close();
              return;
            }

            send({
              status: 'active',
              otp: null,
              allSms: smsArr,
              remainingMs: Math.max(0, expiresAt - Date.now()),
              simStatus,
            });
            return;
          }

          if (simStatus === 'TIMEOUT' || simStatus === 'CANCELED') {
            try {
              await orderRef.update({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() });
            } catch { /* best effort */ }

            send({
              status: 'canceled',
              otp: null,
              number: orderData.number,
              message: simStatus === 'TIMEOUT' ? 'Waktu habis.' : 'Pesanan dibatalkan.',
            });
            clearInterval(intervalId);
            close();
            return;
          }

          // PENDING: cek sms[] juga, siapa tahu 5sim kirim SMS duluan
          const smsArr = extractSmsArray(simData);

          if (smsArr.length > 0) {
            console.log(`[sse] smsArr PENDING orderId=${orderId}:`, JSON.stringify(smsArr).substring(0, 200));
          }

          let otp: string | null = null;
          for (let i = smsArr.length - 1; i >= 0; i--) {
            otp = extractOtp(smsArr[i]);
            if (otp) break;
          }
          if (!otp && simData?.code) otp = String(simData.code).trim() || null;

          if (otp && otp !== lastOtp) {
            lastOtp = otp;
            try {
              await orderRef.update({ status: 'success', otp, updatedAt: FieldValue.serverTimestamp() });
            } catch { /* best effort */ }
            console.log(`[sse] OTP dari PENDING orderId=${orderId} otp=${otp}`);
            send({ status: 'success', otp, number: orderData.number, allSms: smsArr });
            clearInterval(intervalId);
            close();
            return;
          }

          send({
            status: 'active',
            otp: null,
            allSms: smsArr,
            remainingMs: Math.max(0, expiresAt - Date.now()),
            simStatus,
          });

        } catch (err: any) {
          console.error('[sse] poll error:', err.message);
          if (!closed) send({ status: 'active', otp: null });
        }
      };

      await poll();
      intervalId = setInterval(poll, 2000);

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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}