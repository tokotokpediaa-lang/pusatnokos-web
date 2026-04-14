// app/api/5sim-balance/route.ts
// FIXES APPLIED:
//  [CRITICAL] Ganti ADMIN_EMAILS hardcoded → JWT Custom Claim (admin: true)
//  [HIGH]     Tambah checkRevoked: true pada verifyIdToken
//  [LOW]      Hapus field `raw` dari error response — bisa bocorkan info internal
//  [LOW]      Ganti admin.auth() langsung → singleton adminAuth/adminDb

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
  try {
    // ── 1. Autentikasi — hanya admin ──────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      // ✅ FIX [HIGH]: checkRevoked: true
      const decoded = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);

      // ✅ FIX [CRITICAL]: Cek JWT Custom Claim, bukan ADMIN_EMAILS hardcoded
      if (decoded.admin !== true) {
        return NextResponse.json({ error: 'Hanya Admin yang diizinkan' }, { status: 403 });
      }
    } catch (err: any) {
      const isRevoked = err?.code === 'auth/id-token-revoked';
      return NextResponse.json(
        { error: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid' },
        { status: 401 }
      );
    }

    // ── 2. Ambil Saldo dari 5sim ───────────────────────────────────────────
    const apiKey = process.env.FIVESIM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FIVESIM_API_KEY belum dikonfigurasi.' },
        { status: 500 }
      );
    }

    const res = await fetch('https://5sim.net/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    const rawText = await res.text();

    let profileData: any;
    try {
      profileData = JSON.parse(rawText);
    } catch {
      console.error('[5sim-balance] Non-JSON dari 5sim:', rawText.substring(0, 100));
      // ✅ FIX [LOW]: Jangan bocorkan `raw` response ke client — bisa ada info sensitif
      return NextResponse.json(
        { error: 'Respons tidak valid dari 5sim.' },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: profileData?.message || `5sim error: ${res.status}` },
        { status: res.status }
      );
    }

    const balance = profileData?.balance ?? profileData?.Balance ?? null;

    return NextResponse.json(
      {
        Balance: balance,
        balance,
        email:  profileData?.email  ?? null,
        rating: profileData?.rating ?? null,
        status: balance === null ? 'error' : balance < 5 ? 'low' : 'ok',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('[5sim-balance] Error:', error?.message);
    return NextResponse.json(
      { error: isTimeout ? 'Timeout: 5sim tidak merespons dalam 10 detik.' : 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}