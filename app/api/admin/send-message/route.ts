import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, message } = await req.json();
    if (!userId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Simpan ke field adminMessages (array) di dokumen user
    // Array ini sudah bisa dibaca karena ikut rule /users/{userId}
    await adminDb.collection('users').doc(userId).update({
      adminMessages: FieldValue.arrayUnion({
        message,
        from: 'Admin',
        createdAt: Date.now(),
      }),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}