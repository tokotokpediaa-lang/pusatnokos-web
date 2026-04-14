// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

// Cache seluruh user list — pagination & search dilakukan di memory
let cache: { data: any[]; expiredAt: number } | null = null;
const CACHE_DURATION_MS = 60 * 1000; // 60 detik

export async function GET(request: Request) {
  // ── 1. Auth & otorisasi (tetap dipertahankan) ──────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1], true);
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { error: isRevoked ? 'Sesi telah berakhir. Login ulang.' : 'Token tidak valid.' },
      { status: 401 }
    );
  }

  if (decodedToken.admin !== true) {
    return NextResponse.json({ error: 'Hanya Admin yang diizinkan.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'));
  const perPage = Math.min(200, Math.max(5, parseInt(searchParams.get('limit') || '20')));
  const search  = (searchParams.get('search') || '').trim().toLowerCase();
  const sortBy  = searchParams.get('sort') || 'createdAt';
  const sortDir = searchParams.get('dir') === 'asc' ? 1 : -1;

  // ── 2. Pakai cache kalau masih valid ───────────────────────────────────
  if (!cache || Date.now() >= cache.expiredAt) {
    try {
      const validSorts = ['createdAt', 'balance', 'totalSpent'];
      let query: FirebaseFirestore.Query = adminDb.collection('users')
        .select('name', 'email', 'balance', 'totalSpent', 'banned', 'createdAt');

      if (validSorts.includes(sortBy)) {
        query = query.orderBy(sortBy, 'desc');
      }

      const snapshot = await query.limit(500).get();

      const users = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id:         doc.id,
          name:       typeof d.name  === 'string' ? d.name.substring(0, 100)  : 'Tanpa Nama',
          email:      typeof d.email === 'string' ? d.email.substring(0, 200) : '',
          balance:    typeof d.balance    === 'number' ? d.balance    : 0,
          totalSpent: typeof d.totalSpent === 'number' ? d.totalSpent : 0,
          banned:     d.banned === true,
          createdAt:  typeof d.createdAt  === 'number' ? d.createdAt  : 0,
        };
      });

      cache = { data: users, expiredAt: Date.now() + CACHE_DURATION_MS };
    } catch (error: any) {
      console.error('[admin/users] Error:', error.message);
      if (cache) {
        // Pakai cache lama kalau Firestore error
      } else {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
      }
    }
  }

  // ── 3. Filter & paginate dari cache (tidak hit Firestore) ─────────────
  let users = cache!.data;

  if (search) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(search)  ||
      u.email.toLowerCase().includes(search) ||
      u.id.toLowerCase().includes(search)
    );
  }

  // Sort di memory
  const validSorts = ['createdAt', 'balance', 'totalSpent'];
  if (validSorts.includes(sortBy)) {
    users = [...users].sort((a, b) => (a[sortBy] - b[sortBy]) * sortDir);
  }

  const totalCount = users.length;
  const totalPages = Math.ceil(totalCount / perPage);
  const startIdx   = (page - 1) * perPage;

  return NextResponse.json({
    users: users.slice(startIdx, startIdx + perPage),
    pagination: { page, limit: perPage, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
}