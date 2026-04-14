// app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

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
      .orderBy('totalSpent', 'desc')
      .limit(50)
      .get();

    const leaderboard = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const totalSpent = data.totalSpent ?? 0;
        if (totalSpent <= 0) return null;
        return {
          userId: doc.id,
          name: data.name || data.displayName || 'Pengguna',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name || doc.id)}&backgroundColor=dc2626`,
          totalSpent,
        };
      })
      .filter(Boolean);

    cache = { data: leaderboard, expiredAt: Date.now() + CACHE_DURATION_MS };

    return NextResponse.json(leaderboard, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err: any) {
    console.error('[leaderboard] Error:', err.message);

    // Kalau Firestore error, pakai cache lama daripada error
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { 'X-Cache': 'STALE' },
      });
    }

    return NextResponse.json({ error: 'Gagal memuat leaderboard.' }, { status: 500 });
  }
}