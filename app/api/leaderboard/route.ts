// app/api/leaderboard/route.ts
// GET /api/leaderboard
// Mengembalikan top spender — hanya field publik, tidak ada data sensitif.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── 1. Verifikasi token ──────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 401 });
  }

  // ── 2. Query top 50 user berdasarkan totalSpent ──────────────────────────
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
        if (totalSpent <= 0) return null; // skip user yang belum pernah beli
        return {
          userId:     doc.id,
          name:       data.name || data.displayName || 'Pengguna',
          avatar:     `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name || doc.id)}&backgroundColor=dc2626`,
          totalSpent,
        };
      })
      .filter(Boolean);

    return NextResponse.json(leaderboard);
  } catch (err: any) {
    console.error('[leaderboard] Error:', err.message);
    return NextResponse.json({ error: 'Gagal memuat leaderboard.' }, { status: 500 });
  }
}