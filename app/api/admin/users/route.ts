// app/api/admin/users/route.ts
// ============================================================
// GET /api/admin/users?page=1&limit=20&search=xxx
// Daftar user dengan pagination — menghindari onSnapshot semua user di client.
//
// SECURITY FIX: ADMIN_EMAILS dihapus → JWT Custom Claim admin:true
// ✅ select() memastikan pinHash, role, dll TIDAK pernah dikirim ke browser.
// ============================================================

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

export async function GET(request: Request) {
  // ── 1. Autentikasi & otorisasi ─────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    const token = authHeader.split('Bearer ')[1];
    decodedToken = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);
  } catch (err: any) {
    const isRevoked = err?.code === 'auth/id-token-revoked';
    return NextResponse.json(
      { error: isRevoked ? 'Sesi telah berakhir. Login ulang.' : 'Token tidak valid.' },
      { status: 401 }
    );
  }

  // ✅ JWT Custom Claim — tidak bisa dimanipulasi client
  if (decodedToken.admin !== true) {
    return NextResponse.json({ error: 'Hanya Admin yang diizinkan.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const perPage = Math.min(200, Math.max(5, parseInt(searchParams.get('limit') || '20')));
    const search  = (searchParams.get('search') || '').trim().toLowerCase();
    const sortBy  = searchParams.get('sort') || 'createdAt';
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

    const validSorts = ['createdAt', 'balance', 'totalSpent'];
    let query: FirebaseFirestore.Query = adminDb.collection('users');

    // ✅ select() — hanya field yang dibutuhkan UI, bukan seluruh dokumen
    // pinHash, role internal, dan field sensitif lain TIDAK pernah meninggalkan server
    query = query.select('name', 'email', 'balance', 'totalSpent', 'banned', 'createdAt');

    if (validSorts.includes(sortBy)) {
      query = query.orderBy(sortBy, sortDir as 'asc' | 'desc');
    }

    // Fetch lebih banyak jika ada search (filter di memory — Firestore tidak support LIKE)
    const fetchLimit = search ? 500 : page * perPage + 10;
    const snapshot   = await query.limit(fetchLimit).get();

    let users = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:         doc.id,
        name:       typeof d.name  === 'string' ? d.name.substring(0, 100)  : 'Tanpa Nama',
        email:      typeof d.email === 'string' ? d.email.substring(0, 200) : '',
        balance:    typeof d.balance    === 'number' ? d.balance    : 0,
        totalSpent: typeof d.totalSpent === 'number' ? d.totalSpent : 0,
        banned:     d.banned === true,
        createdAt:  typeof d.createdAt  === 'number' ? d.createdAt  : 0,
        // pinHash, role internal, dll → TIDAK ADA di sini
      };
    });

    if (search) {
      users = users.filter(u =>
        u.name.toLowerCase().includes(search)  ||
        u.email.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search)
      );
    }

    const totalCount = users.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIdx   = (page - 1) * perPage;

    return NextResponse.json({
      users: users.slice(startIdx, startIdx + perPage),
      pagination: {
        page, limit: perPage, totalCount, totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    console.error('[admin/users] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}