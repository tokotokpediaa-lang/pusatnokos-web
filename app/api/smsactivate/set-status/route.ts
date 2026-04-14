// /api/smsactivate/set-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const SA_BASE = process.env.SMSACTIVATE_API_BASE ?? 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY;

// ─── FIX #L5: Hapus module-level console.error yang menyesatkan ──────────────
// Guard sebenarnya ada di dalam handler (return 500 di bawah).

const ALLOWED_STATUSES = [6, 8]; // 6 = complete, 8 = cancel

// ─── FIX #M2 / shared: Status final memakai casing UPPERCASE konsisten ────────
const FINAL_STATUSES = ['SUCCESS', 'COMPLETED', 'CANCELLED'];

function parseTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toDate().getTime();
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  const ms = new Date(value as any).getTime();
  return isNaN(ms) ? 0 : ms;
}

const SA_SUCCESS_RESPONSES: Record<number, string[]> = {
  6: ['ACCESS_ACTIVATION'],
  8: ['ACCESS_CANCEL'],
};

function isSASuccess(statusCode: number, saText: string): boolean {
  const valid = SA_SUCCESS_RESPONSES[statusCode] ?? [];
  return valid.some(v => saText.trim().toUpperCase().includes(v));
}

export async function POST(req: NextRequest) {
  // ─── FIX #L5: Guard yang bermakna ─────────────────────────────────────────
  if (!SA_KEY) {
    console.error('[set-status] SMSACTIVATE_API_KEY belum di-set di .env!');
    return NextResponse.json({ error: 'Server tidak terkonfigurasi dengan benar' }, { status: 500 });
  }

  try {
    // ─── FIX #L2: Validasi Content-Type ──────────────────────────────────────
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid     = decoded.uid;

    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      return NextResponse.json({ error: 'orderId harus berupa string yang valid' }, { status: 400 });
    }

    if (status === undefined || status === null) {
      return NextResponse.json({ error: 'orderId & status required' }, { status: 400 });
    }

    const statusNum = Number(status);
    if (!Number.isInteger(statusNum) || !ALLOWED_STATUSES.includes(statusNum)) {
      return NextResponse.json(
        { error: `Status tidak valid. Hanya boleh: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const orderRef  = adminDb.collection('users').doc(uid).collection('orders').doc(orderId.trim());
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

    const order = orderSnap.data()!;

    // ─── FIX #C1: Ownership check ketat — tidak bergantung pada field userId ──
    // Sebelumnya: `if (order.userId && order.userId !== uid)` → bisa di-bypass
    // jika field userId tidak ada (dokumen lama). Sekarang: kepemilikan
    // dibuktikan murni dari posisi dokumen di subcollection users/{uid}/orders.
    // Jika dokumen ada di sana, user sudah terbukti pemiliknya melalui Firestore path.
    // Untuk double-check dokumen lama yang punya userId, tetap validasi:
    if (order.userId !== undefined && order.userId !== uid) {
      console.error('[set-status] userId mismatch! uid:', uid, 'order.userId:', order.userId);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.provider !== 'smsactivate') {
      return NextResponse.json({ error: 'Provider mismatch' }, { status: 400 });
    }

    if (!order.activationId) {
      return NextResponse.json({ error: 'activationId tidak ditemukan di order' }, { status: 400 });
    }

    if (FINAL_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: `Order sudah final (${order.status}), tidak bisa diubah lagi.` },
        { status: 400 },
      );
    }

    if (statusNum === 8) {
      const createdAt    = parseTimestamp(order.createdAt);
      const threeMinutes = 3 * 60 * 1000;
      const elapsed      = Date.now() - createdAt;

      if (createdAt > 0 && elapsed < threeMinutes) {
        const sisaMs        = threeMinutes - elapsed;
        const sisaDetik     = Math.ceil(sisaMs / 1000);
        const sisaMenit     = Math.floor(sisaDetik / 60);
        const sisaDetikSisa = sisaDetik % 60;
        const sisaLabel     = sisaMenit > 0
          ? `${sisaMenit} menit ${sisaDetikSisa} detik`
          : `${sisaDetik} detik`;

        return NextResponse.json(
          {
            error:       `Pesanan baru bisa dibatalkan setelah 3 menit. Tunggu ${sisaLabel} lagi.`,
            remainingMs: sisaMs,
          },
          { status: 400 },
        );
      }
    }

    // ─── CEK OTP DULU sebelum cancel (status 8) ──────────────────────────────
    // Kalau OTP sudah masuk di provider, jangan cancel — tampilkan OTP ke user
    if (statusNum === 8) {
      try {
        const checkRes  = await fetch(
          `${SA_BASE}?action=getStatus&api_key=${SA_KEY}&id=${order.activationId}`,
        );
        const checkText = (await checkRes.text()).trim();

        // HeroSMS mengembalikan "STATUS_OK:KODE" kalau OTP sudah masuk
        if (checkText.startsWith('STATUS_OK:')) {
          const otp = checkText.split(':')[1] ?? '';
          // Simpan OTP ke Firestore supaya langsung tampil di UI user
          await orderRef.update({
            otp:       otp,
            status:    'SUCCESS',
            updatedAt: FieldValue.serverTimestamp(),
          });
          return NextResponse.json(
            {
              error:  '⚠️ OTP sudah masuk sebelum dibatalkan. Pesanan tidak jadi dibatalkan.',
              hasOtp: true,
              otp,
            },
            { status: 409 },
          );
        }
      } catch (checkErr) {
        // Kalau cek gagal, lanjutkan cancel — lebih aman daripada stuck
        console.warn('[set-status] Gagal cek OTP sebelum cancel, lanjutkan cancel:', checkErr);
      }
    }

    // ─── FIX #H3: Fresh read tepat sebelum panggil SA untuk mempersempit window ─
    // Tidak bisa eliminasi race condition 100% tanpa distributed lock,
    // tapi fresh read di sini memastikan kita tidak salah panggil SA
    // jika order sudah berubah final sejak pre-read di atas.
    const freshPreCheckSnap = await orderRef.get();
    if (!freshPreCheckSnap.exists || FINAL_STATUSES.includes(freshPreCheckSnap.data()?.status)) {
      return NextResponse.json(
        { error: 'Order sudah berubah status final, tidak bisa diubah lagi.' },
        { status: 409 },
      );
    }

    // ── Panggil SA API ─────────────────────────────────────────────────────────
    const saRes  = await fetch(
      `${SA_BASE}?action=setStatus&api_key=${SA_KEY}&id=${order.activationId}&status=${statusNum}`,
    );
    const saText = await saRes.text();

    if (!isSASuccess(statusNum, saText)) {
      console.error(
        '[set-status] SA menolak request. activationId:', order.activationId,
        'status:', statusNum, 'saResponse:', saText,
      );
      // ─── FIX #H4: Jangan kirim raw saText ke client — bisa mengandung info internal SA ──
      return NextResponse.json(
        { error: 'Gagal mengubah status di provider. Silakan coba lagi.' },
        { status: 502 },
      );
    }

    const userRef = adminDb.collection('users').doc(uid);

    if (statusNum === 8) {
      // ── CANCEL: kembalikan saldo + catat refund ke mutasi ──────────────────
      const displayName  = order.saName || order.serviceId || order.service || 'Nomor';
      const mutasiRefRef = adminDb.collection('users').doc(uid).collection('transactions').doc();

      try {
        await adminDb.runTransaction(async (t) => {
          const freshSnap = await t.get(orderRef);
          if (!freshSnap.exists) throw new Error('ORDER_NOT_FOUND');

          const freshData = freshSnap.data()!;
          if (FINAL_STATUSES.includes(freshData.status)) {
            throw new Error('ORDER_ALREADY_FINAL');
          }

          const refundPrice = freshData.price ?? 0;

          if (refundPrice === 0) {
            console.warn(
              '[set-status] PERINGATAN: freshData.price tidak ada atau 0, refund akan Rp 0. orderId:',
              orderId,
            );
          }

          t.update(orderRef, {
            status:    'CANCELLED',
            updatedAt: FieldValue.serverTimestamp(),
          });

          t.update(userRef, {
            balance: FieldValue.increment(refundPrice),
          });

          t.set(mutasiRefRef, {
            type:      'refund',
            amount:    refundPrice,
            desc:      `Refund: Beli nomor ${displayName.toUpperCase()} (Server 2) dibatalkan`,
            status:    'success',
            orderId,
            timestamp: Date.now(),
          });
        });
      } catch (txErr: any) {
        if (txErr.message === 'ORDER_ALREADY_FINAL') {
          // ─── FIX #C2: SA sudah cancel, tapi order di Firestore sudah final ────────
          // Ini bisa berarti:
          // - Status 'CANCELLED' → refund sudah berjalan, tidak perlu lagi
          // - Status 'SUCCESS'/'COMPLETED' → user sudah dapat OTP sebelum cancel
          // Log sebagai KRITIS agar bisa di-review manual.
          console.error(
            '[set-status] ⚠️ KRITIS C2: SA berhasil CANCEL tapi order sudah FINAL di Firestore.',
            'Perlu review manual! orderId:', orderId,
            'activationId:', order.activationId,
            'currentStatus:', freshPreCheckSnap.data()?.status,
          );
          // Kembalikan 200 — dari sisi SA sudah cancel, tidak ada yang bisa di-retry.
          // Tim perlu review log ini secara manual.
          return NextResponse.json({
            success:  true,
            warning:  'Order sudah di status final sebelum cancel diproses. Silakan hubungi support jika ada masalah saldo.',
            saResponse: 'ok',
          });
        }
        console.error(
          '[set-status] KRITIS: SA berhasil cancel tapi Firestore transaction gagal!',
          'orderId:', orderId, 'activationId:', order.activationId, txErr,
        );
        throw txErr;
      }

    } else if (statusNum === 6) {
      // ── COMPLETE: tandai order selesai ────────────────────────────────────
      try {
        await adminDb.runTransaction(async (t) => {
          const freshSnap = await t.get(orderRef);
          if (!freshSnap.exists) throw new Error('ORDER_NOT_FOUND');

          const freshData = freshSnap.data()!;
          if (FINAL_STATUSES.includes(freshData.status)) {
            throw new Error('ORDER_ALREADY_FINAL');
          }

          t.update(orderRef, {
            status:    'COMPLETED',
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (txErr: any) {
        if (txErr.message === 'ORDER_ALREADY_FINAL') {
          // ─── FIX #C2 (complete variant): Log kritis untuk review manual ─────────
          console.error(
            '[set-status] ⚠️ KRITIS C2: SA berhasil COMPLETE tapi order sudah FINAL di Firestore.',
            'orderId:', orderId, 'activationId:', order.activationId,
          );
          return NextResponse.json(
            { error: 'Order sudah final di sistem kami.' },
            { status: 409 },
          );
        }
        console.error(
          '[set-status] KRITIS: SA berhasil complete tapi Firestore transaction gagal!',
          'orderId:', orderId, 'activationId:', order.activationId, txErr,
        );
        throw txErr;
      }
    }

    // ─── FIX #H4: Tidak mengembalikan saText ke client ────────────────────────
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[smsactivate/set-status]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}