/**
 * POST /api/paymenku/create
 * Membuat transaksi QRIS ke Paymenku dan mengembalikan qr_url langsung.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAYMENKU_API_KEY = process.env.PAYMENKU_API_KEY!;
const BASE_URL         = process.env.NEXT_PUBLIC_BASE_URL || 'https://pusatnokos.my.id';

export async function POST(req: NextRequest) {
  try {
    if (!PAYMENKU_API_KEY) {
      return NextResponse.json(
        { message: 'API Key payment gateway belum dikonfigurasi. Hubungi admin.' },
        { status: 503 }
      );
    }

    const { amount, userId, userName, userEmail } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: 'User tidak terautentikasi.' }, { status: 401 });
    }
    if (typeof amount !== 'number' || amount < 1000 || amount > 50_000_000) {
      return NextResponse.json(
        { message: 'Nominal tidak valid (Min: 1.000, Max: 50.000.000).' },
        { status: 400 }
      );
    }

    const shortUid    = (userId as string).slice(0, 6).toUpperCase();
    const referenceId = `INV-${shortUid}-${Date.now()}`;

    const paymenku = await fetch('https://paymenku.com/api/v1/transaction/create', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${PAYMENKU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_id:   referenceId,
        amount:         amount,
        customer_name:  userName  || 'User',
        customer_email: userEmail || '',
        customer_phone: '',
        channel_code:   'qris',
        // ✅ FIX: Pastikan callback URL mengarah ke /api/paymenku/callback
        callback_url:   `${BASE_URL}/api/paymenku/callback`,
        return_url:     `${BASE_URL}/dashboard?deposit=success&ref=${referenceId}`,
      }),
    });

    const data = await paymenku.json();
    console.log('[paymenku/create] Response:', JSON.stringify(data));

    if (data?.status !== 'success' || !data?.data?.pay_url) {
      return NextResponse.json(
        { message: data?.message || 'Gagal membuat invoice. Coba lagi.' },
        { status: 400 }
      );
    }

    const { trx_id, pay_url, payment_info } = data.data;

    const qrString = payment_info?.qr_string || data.data.qr_string || null;
    const qrUrl    = payment_info?.qr_url    || data.data.qr_url    || null;
    const qrExpiry = payment_info?.expiration_date || data.data.expiration_date || null;

    // ✅ FIX: Tambah field `desc` agar MutasiPage tampil label yang benar
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(amount);

    try {
      await adminDb.collection('transactions').doc(referenceId).set({
        id:         referenceId,
        trxId:      trx_id,
        userId,
        userName:   userName  || '',
        userEmail:  userEmail || '',
        type:       'deposit',
        status:     'pending',
        amount,
        // ✅ FIX: Field `desc` wajib ada agar MutasiPage tampil nama yang benar
        desc:       `Deposit via PAYMENKU (QRIS)`,
        method:     'PAYMENKU (QRIS)',
        paymentUrl: pay_url,
        qrUrl:      qrUrl,
        qrString:   qrString,
        createdAt:  FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error('[paymenku/create] Firestore error (non-fatal):', dbErr);
    }

    return NextResponse.json({
      success:    true,
      paymentUrl: pay_url,
      reference:  referenceId,
      qrUrl,
      qrString,
      qrExpiry,
    });

  } catch (err: any) {
    console.error('[paymenku/create] Unhandled error:', err);
    return NextResponse.json(
      { message: 'Terjadi kesalahan internal. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}