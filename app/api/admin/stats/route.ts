// app/api/admin/stats/route.ts
// ============================================================
// GET /api/admin/stats
// Dashboard statistik real-time untuk admin panel.
//
// SECURITY FIX: ADMIN_EMAILS dihapus → JWT Custom Claim admin:true
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
    const db  = adminDb;
    const now = Date.now();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const weekAgo = todayTs - 7 * 24 * 60 * 60 * 1000;

    // Query paralel
    const [usersSnap, recentTxSnap, recentOrdersSnap] = await Promise.all([
      // ✅ select() membatasi field yang dikirim lewat wire — pinHash dll tidak pernah keluar server
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

    // Hitung statistik users
    let totalBalance = 0;
    let totalRevenue = 0;
    let newUsersToday = 0;
    let bannedCount = 0;
    const totalUsers = usersSnap.size;

    usersSnap.forEach(doc => {
      const d = doc.data();
      totalBalance += d.balance || 0;
      totalRevenue += d.totalSpent || 0;
      if (d.createdAt && d.createdAt >= todayTs) newUsersToday++;
      if (d.banned) bannedCount++;
    });

    // Hitung statistik transaksi
    let revenueThisWeek = 0;
    let depositCountWeek = 0;
    let purchaseCountWeek = 0;
    let pendingDepositsCount = 0;
    let pendingDepositsTotal = 0;

    const revenueByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayTs);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      revenueByDay[key] = 0;
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
        if (d.status === 'pending') {
          pendingDepositsCount++;
          pendingDepositsTotal += d.amount || 0;
        }
      }
    });

    // Hitung statistik orders
    let ordersToday = 0;
    let ordersActive = 0;
    let ordersSuccess = 0;
    let ordersCanceled = 0;
    const servicePopularity: Record<string, number> = {};

    recentOrdersSnap.forEach(doc => {
      const d = doc.data();
      ordersToday++;
      if (d.status === 'active')    ordersActive++;
      else if (d.status === 'success')  ordersSuccess++;
      else if (d.status === 'canceled') ordersCanceled++;
      if (d.serviceId) servicePopularity[d.serviceId] = (servicePopularity[d.serviceId] || 0) + 1;
    });

    const topServices = Object.entries(servicePopularity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    return NextResponse.json({
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
      topServices,
      generatedAt: now,
    });

  } catch (error: any) {
    console.error('[admin/stats] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}