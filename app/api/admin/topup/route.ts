import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_TOPUP_PER_ACTION = 50_000_000;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Akses Ditolak' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ message: 'Token tidak valid atau kedaluwarsa.' }, { status: 401 });
    }

    if (decodedToken.admin !== true) {
      return NextResponse.json({ message: 'Hanya Admin yang diizinkan.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, amount } = body;

    if (typeof userId !== 'string' || !userId.trim()) {
      return NextResponse.json({ message: 'userId tidak valid.' }, { status: 400 });
    }

    if (
      typeof amount !== 'number'  ||
      !Number.isFinite(amount)    ||
      !Number.isInteger(amount)   ||
      amount <= 0                 ||
      amount > MAX_TOPUP_PER_ACTION
    ) {
      return NextResponse.json(
        { message: `Nominal tidak valid. Harus bilangan bulat positif, maks Rp ${MAX_TOPUP_PER_ACTION.toLocaleString('id-ID')}.` },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(userId);
    const txRef   = userRef.collection('transactions').doc();

    await adminDb.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

      if (!userSnap.exists) {
        throw new Error('Akun pengguna tidak ditemukan.');
      }

      if (userSnap.data()?.banned === true) {
        throw new Error('Akun pengguna ini telah dinonaktifkan. Tidak bisa suntik saldo.');
      }

      t.set(txRef, {
        type:       'deposit',
        amount:     amount,
        method:     'Suntik Admin',
        desc:       `Top Up Manual oleh Admin (${decodedToken.uid})`,
        status:     'success',
        timestamp:  Date.now(),
        addedBy:    decodedToken.uid,
      });

      t.update(userRef, {
        balance: FieldValue.increment(amount),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan Rp ${amount.toLocaleString('id-ID')} ke akun pengguna.`,
    });

  } catch (error: any) {
    console.error('[admin/topup] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Terjadi kesalahan server.' },
      { status: 400 }
    );
  }
}