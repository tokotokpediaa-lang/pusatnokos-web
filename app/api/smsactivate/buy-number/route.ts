// /api/smsactivate/buy-number/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const SA_BASE = 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY!;

// ── Konstanta harga ───────────────────────────────────────────────────────────
//
// ✅ FIX: Formula sekarang IDENTIK dengan calcPriceFromUsd di page.tsx agar
// harga yang di-charge backend selalu sama dengan harga yang ditampilkan
// di frontend. Sebelumnya backend pakai persentase markup (×1.35) sementara
// frontend pakai flat margin (+1000/1500/2000), sehingga saldo terpotong
// dengan harga yang berbeda dari yang ditampilkan ke user.
//
// Sumber kebenaran satu: USD_TO_IDR dari env (sama dengan NEXT_PUBLIC_USD_TO_IDR).
// ─────────────────────────────────────────────────────────────────────────────

function calcSellPrice(costUsd: number): number {
  // Ambil kurs dari env — harus sama dengan NEXT_PUBLIC_USD_TO_IDR di frontend
  const USD_TO_IDR = Math.max(15000, Number(process.env.USD_TO_IDR ?? 16990));

  // Guard minimum $0.05 — identik dengan frontend
  const validCost = Math.max(0.05, costUsd || 0);
  const costIdr   = validCost * USD_TO_IDR;

  // Flat margin — identik dengan frontend
  let margin: number;
  if (validCost < 0.20)       margin = 1000;  // Layanan murah
  else if (validCost <= 0.50) margin = 1500;  // Sweet spot
  else                        margin = 2000;  // Premium

  // Bulatkan ke Rp 100 terdekat — identik dengan frontend
  return Math.ceil((costIdr + margin) / 100) * 100;
}

// Toleransi selisih harga (Rp) antara hitungan client dan server.
// Jika lebih dari ini → harga berubah di tengah jalan, tolak transaksi.
const PRICE_TOLERANCE_IDR = 500;

export async function POST(req: NextRequest) {
  try {
    // ── Verifikasi JWT user ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid     = decoded.uid;

    const {
      service,
      country,
      serviceId: clientServiceId,
      saName,
      // ✅ FIX: Frontend sekarang mengirim harga yang ditampilkan ke user.
      // Backend WAJIB validasi ini vs hitungan server-side sebelum memotong saldo.
      // Backend TIDAK PERNAH memakai clientPrice langsung — hanya untuk validasi.
      clientPrice,
    } = await req.json();

    if (!service || country === undefined) {
      return NextResponse.json({ error: 'service & country required' }, { status: 400 });
    }

    // Nama display untuk mutasi — prioritas: saName > clientServiceId > service code
    const displayName = saName || clientServiceId || service;

    // ── Cek saldo user ───────────────────────────────────────────
    const userRef  = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const balance  = userSnap.data()?.balance ?? 0;

    // ── Request nomor ke HeroSms ─────────────────────────────────
    // maxPrice ke SA = estimasi modal dalam USD agar SA tidak memberi nomor
    // yang terlalu mahal. Dihitung mundur dari clientPrice yang dikirim frontend.
    // Ini bukan harga jual — hanya cap untuk SA agar kita tidak rugi.
    const USD_TO_IDR = Math.max(15000, Number(process.env.USD_TO_IDR ?? 16990));
    const maxCostUsdForSA = clientPrice
      ? ((clientPrice - 1000) / USD_TO_IDR).toFixed(4)  // kurangi margin minimum agar ada buffer
      : undefined;

    let url = `${SA_BASE}?action=getNumberV2&api_key=${SA_KEY}&service=${service}&country=${country}`;
    if (maxCostUsdForSA) url += `&maxPrice=${maxCostUsdForSA}`;

    const saRes = await fetch(url);

    // ✅ FIX KRITIS: HeroSMS kadang return plain text untuk error, bukan JSON.
    // Contoh: "NO_NUMBERS", "NO_BALANCE", "BAD_SERVICE" → langsung crash kalau pakai saRes.json()
    const saRaw = await saRes.text();
    console.log(`[sa-buy] raw response: ${saRaw}`);

    const SA_PLAIN_ERRORS: Record<string, string> = {
      NO_NUMBERS:  'Stok nomor habis untuk layanan ini. Coba layanan atau negara lain.',
      NO_BALANCE:  'Stok nomor sedang tidak tersedia. Hubungi admin.',
      BAD_SERVICE: 'Kode layanan tidak dikenal. Coba layanan lain.',
      BAD_KEY:     'Terjadi kesalahan konfigurasi. Hubungi admin.',
      BAD_ACTION:  'Aksi tidak dikenal. Hubungi admin.',
      BAD_COUNTRY: 'Kode negara tidak valid.',
      ERROR_SQL:   'Terjadi kesalahan di server. Coba beberapa saat lagi.',
      BANNED:      'Layanan tidak tersedia. Hubungi admin.',
      WAIT_AGAIN:  'Server sibuk. Coba lagi dalam beberapa detik.',
    };

    const trimmed = saRaw.trim();
    if (SA_PLAIN_ERRORS[trimmed]) {
      console.warn(`[sa-buy] HeroSMS plain error: ${trimmed}`);
      return NextResponse.json({ error: SA_PLAIN_ERRORS[trimmed] }, { status: 400 });
    }

    let saData: any;
    try {
      saData = JSON.parse(saRaw);
    } catch {
      console.error(`[sa-buy] Response tidak dikenal: "${trimmed}"`);
      return NextResponse.json(
        { error: `Gagal mendapatkan nomor. Hubungi admin jika masalah berlanjut.` },
        { status: 502 }
      );
    }

    if (!saData.activationId) {
      return NextResponse.json(
        { error: saData.error ?? saData.message ?? 'Gagal mendapatkan nomor. Coba lagi atau pilih layanan lain.' },
        { status: 400 }
      );
    }

    // ── Hitung harga jual server-side (AUTHORITATIVE) ───────────
    const costUsd   = Number(saData.activationCost ?? 0);
    const sellPrice = calcSellPrice(costUsd);   // ← selalu pakai hitungan backend

    // ✅ SECURITY: Log hanya di server — TIDAK di-return ke client
    console.log(`[sa-pricing] uid=${uid} service=${service} costUsd=$${costUsd} → sellPrice=Rp${sellPrice}`);

    // ── Validasi harga: bandingkan server vs client ──────────────
    // Jika clientPrice dikirim dan selisihnya > PRICE_TOLERANCE_IDR,
    // berarti harga berubah di antara tampilan modal dan konfirmasi.
    // Cancel order di SA dan kembalikan error ke user agar mereka tahu.
    if (clientPrice !== undefined && Math.abs(sellPrice - clientPrice) > PRICE_TOLERANCE_IDR) {
      await fetch(`${SA_BASE}?action=setStatus&api_key=${SA_KEY}&id=${saData.activationId}&status=8`);
      return NextResponse.json(
        {
          error: `Harga berubah! Harga terbaru: Rp ${sellPrice.toLocaleString('id-ID')}. Silakan coba lagi.`,
          newPrice: sellPrice,
        },
        { status: 409 }
      );
    }

    // ── Cek saldo cukup (pakai sellPrice yang sudah divalidasi) ──
    if (balance < sellPrice) {
      // Cancel order di SA agar saldo SA tidak terpotong
      await fetch(`${SA_BASE}?action=setStatus&api_key=${SA_KEY}&id=${saData.activationId}&status=8`);
      return NextResponse.json({ error: 'Saldo tidak cukup' }, { status: 402 });
    }

    // ── Simpan order + transaksi ke Firestore (atomic) ───────────
    const orderRef  = adminDb.collection('users').doc(uid).collection('orders').doc();
    const mutasiRef = adminDb.collection('users').doc(uid).collection('transactions').doc();

    const now = Date.now();
    const order = {
      id:           orderRef.id,
      userId:       uid,
      provider:     'smsactivate',
      activationId: String(saData.activationId),
      phone:        saData.phoneNumber,
      service,
      serviceId:    clientServiceId || service,
      countryId:    String(country),
      saCode:       service,
      saName:       saName || null,
      operator:     'virtual',
      price:        sellPrice,   // ← selalu pakai harga server-side
      // ✅ SECURITY: costUsd TIDAK disimpan ke Firestore
      // agar harga modal tidak bisa dibaca dari client.
      status:       'active',
      sms:          null,
      otp:          null,
      timestamp:    now,
      // ✅ FIX: Simpan sebagai Firestore Timestamp agar query cron bisa match
      createdAt:    Timestamp.fromMillis(now),
      expiresAt:    Timestamp.fromMillis(now + 20 * 60 * 1000),
    };

    await adminDb.runTransaction(async (t) => {
      t.set(orderRef, order);

      t.update(userRef, {
        balance:    FieldValue.increment(-sellPrice),
        totalSpent: FieldValue.increment(sellPrice),
      });

      t.set(mutasiRef, {
        type:      'purchase',
        amount:    -sellPrice,
        desc:      `Beli nomor ${displayName.toUpperCase()}`,
        status:    'success',
        orderId:   orderRef.id,
        timestamp: now,
      });
    });

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error('[smsactivate/buy-number]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}