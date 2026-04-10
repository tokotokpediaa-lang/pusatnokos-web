import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const TOP_N = 50;

export async function GET(req: NextRequest) {
  // ── 1. Verifikasi token ──────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ✅ FIX: Pakai adminAuth dari firebaseAdmin.ts (singleton), bukan inisialisasi manual
    // ✅ FIX: checkRevoked: true
    await adminAuth.verifyIdToken(token, true);
  } catch {
    return NextResponse.json({ error: 'Token tidak valid atau kadaluarsa.' }, { status: 401 });
  }

  // ── 2. Query Firestore ───────────────────────────────────────────────────
  try {
    const snapshot = await adminDb
      .collection('users')
      .where('totalSpent', '>', 0)
      .orderBy('totalSpent', 'desc')
      .limit(TOP_N)
      .select('name', 'avatar', 'totalSpent')
      .get();

    const leaderboard = snapshot.docs.map(doc => ({
      userId:     doc.id,
      name:       (doc.data().name  as string) || 'Pengguna Rahasia',
      avatar:     (doc.data().avatar as string) ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.id}&backgroundColor=d1d5db`,
      totalSpent: (doc.data().totalSpent as number) || 0,
    }));

    return NextResponse.json(leaderboard, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });

  } catch (err) {
    console.error('[/api/leaderboard] Firestore error:', err);
    return NextResponse.json({ error: 'Gagal memuat leaderboard.' }, { status: 500 });
  }
}