import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const TOP_N = 50;

// Cache in-memory — query Firestore max 1x per menit
let cache: { data: any[]; expiredAt: number } | null = null;
const CACHE_DURATION_MS = 60 * 1000; // 60 detik

export async function GET() {
  // Kembalikan cache kalau masih valid
  if (cache && Date.now() < cache.expiredAt) {
    return NextResponse.json(cache.data, {
      headers: { 'X-Cache': 'HIT' },
    });
  }

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
      name:       (doc.data().name as string) || 'Pengguna Rahasia',
      avatar:     (doc.data().avatar as string) ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.id}&backgroundColor=d1d5db`,
      totalSpent: (doc.data().totalSpent as number) || 0,
    }));

    cache = { data: leaderboard, expiredAt: Date.now() + CACHE_DURATION_MS };

    return NextResponse.json(leaderboard, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[/api/leaderboard] Firestore error:', err);

    // Kalau Firestore error, pakai cache lama daripada error
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { 'X-Cache': 'STALE' },
      });
    }

    return NextResponse.json({ error: 'Gagal memuat leaderboard.' }, { status: 500 });
  }
}