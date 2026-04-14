import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (hanya sekali)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

export async function POST(req: NextRequest) {
  try {
    // Verifikasi Firebase Auth token
    const authHeader = req.headers.get('Authorization');
    const idToken = authHeader?.replace('Bearer ', '');
    if (!idToken) {
      return NextResponse.json({ error: 'Token tidak ada' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token tidak valid atau expired' }, { status: 401 });
    }

    // Cek apakah user adalah admin di Firestore
    const adminSnap = await db.doc(`users/${decodedToken.uid}`).get();
    const adminData = adminSnap.data();
    if (!adminData || adminData.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Bukan admin.' }, { status: 403 });
    }

    const { orderId, userId } = await req.json();
    if (!orderId || !userId) {
      return NextResponse.json({ error: 'orderId dan userId wajib diisi' }, { status: 400 });
    }

    // Ambil order dari users/{userId}/orders/{orderId}
    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderSnap.data()!;

    // Jangan cancel yang sudah cancelled
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Order sudah di-cancel sebelumnya' }, { status: 400 });
    }

    // ⚠️ Cek OTP — kalau sudah masuk, BATALKAN force cancel
    if (order.otp !== null && order.otp !== undefined) {
      return NextResponse.json(
        { hasOtp: true, otp: order.otp, number: order.number },
        { status: 409 }
      );
    }

    // Jalankan cancel + refund secara atomic (batch)
    const userRef = db.doc(`users/${userId}`);
    const batch = db.batch();

    // Update status order jadi CANCELLED
    batch.update(orderRef, {
      status: 'CANCELLED',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Refund balance ke user (kalau harga > 0)
    if (order.price && order.price > 0) {
      batch.update(userRef, {
        balance: FieldValue.increment(order.price),
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Force cancel error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}