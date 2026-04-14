// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

// Cache stats — max 1x query per 60 detik
let cache: { data: any; expiredAt: number } | null = null;
const CACHE_DURATION_MS = 60 * 1000;

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

  // ── 2. Kembalikan cache kalau masih valid ──────────────────────────────
  if (cache && Date.now() < cache.expiredAt) {
    return NextResponse.json(cache.data, { headers: { 'X-Cache': 'HIT' } });
  }

  // ── 3. Query Firestore (max 1x per menit) ─────────────────────────────
  try {
    const db = adminDb;
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const weekAgo = todayTs - 7 * 24 * 60 * 60 * 1000;

    const [usersSnap, recentTxSnap, recentOrdersSnap] = await Promise.all([
      db.collection('users').select('balance', 'totalSpent', 'createdAt', 'banned').get(),
      db.collectionGroup('transactions')
        .where('timestamp', '>=', weekAgo)
        .orderBy('timestamp', 'desc')
        .limit(500)
        .get(),
      db.collectionGroup('orders')
        .where('timestamp', '>=', todayTs)
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get(),
    ]);

    let totalBalance = 0, totalRevenue = 0, newUsersToday = 0, bannedCount = 0;
    const totalUsers = usersSnap.size;

    usersSnap.forEach(doc => {
      const d = doc.data();
      totalBalance += d.balance || 0;
      totalRevenue += d.totalSpent || 0;
      if (d.createdAt && d.createdAt >= todayTs) newUsersToday++;
      if (d.banned) bannedCount++;
    });

    let revenueThisWeek = 0, depositCountWeek = 0, purchaseCountWeek = 0;
    let pendingDepositsCount = 0, pendingDepositsTotal = 0;
    const revenueByDay: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayTs);
      d.setDate(d.getDate() - i);
      revenueByDay[d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })] = 0;
    }

    recentTxSnap.forEach(doc => {
      const d = doc.data();
      const dayKey = new Date(d.timestamp || 0).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      if (d.type === 'purchase' && d.status === 'success') {
        purchaseCountWeek++;
        const amount = Math.abs(d.amount || 0);
        revenueThisWeek += amount;
        if (revenueByDay[dayKey] !== undefined) revenueByDay[dayKey] += amount;
      }
      if (d.type === 'deposit') {
        depositCountWeek++;
        if (d.status === 'pending') { pendingDepositsCount++; pendingDepositsTotal += d.amount || 0; }
      }
    });

    let ordersToday = 0, ordersActive = 0, ordersSuccess = 0, ordersCanceled = 0;
    const servicePopularity: Record<string, number> = {};

    recentOrdersSnap.forEach(doc => {
      const d = doc.data();
      ordersToday++;
      if (d.status === 'active') ordersActive++;
      else if (d.status === 'success') ordersSuccess++;
      else if (d.status === 'canceled') ordersCanceled++;
      if (d.serviceId) servicePopularity[d.serviceId] = (servicePopularity[d.serviceId] || 0) + 1;
    });

    const result = {
      users: { total: totalUsers, newToday: newUsersToday, banned: bannedCount, totalBalance, totalRevenue },
      transactions: {
        revenueThisWeek,
        revenueToday: Object.values(revenueByDay).at(-1) || 0,
        depositCountWeek, purchaseCountWeek,
        pendingDepositsCount, pendingDepositsTotal,
        chartData: Object.entries(revenueByDay).map(([label, value]) => ({ label, value })),
      },
      orders: {
        today: ordersToday, active: ordersActive, success: ordersSuccess, canceled: ordersCanceled,
        successRate: ordersToday > 0 ? Math.round((ordersSuccess / ordersToday) * 100) : 0,
      },
      topServices: Object.entries(servicePopularity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([service, count]) => ({ service, count })),
      generatedAt: now,
    };

    // Simpan ke cache
    cache = { data: result, expiredAt: Date.now() + CACHE_DURATION_MS };

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });

  } catch (error: any) {
    console.error('[admin/stats] Error:', error.message);
    if (cache) return NextResponse.json(cache.data, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}