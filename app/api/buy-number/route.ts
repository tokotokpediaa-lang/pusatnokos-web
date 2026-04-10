// app/api/buy-number/route.ts
// FIXES APPLIED:
//  [CRITICAL] Race condition double-spend: idempotency key sekarang ditulis
//             dalam transaction yang SAMA dengan pemotongan saldo (step 5).
//  [HIGH]     Tambah checkRevoked: true pada verifyIdToken
//  [BUG FIX]  totalSpent di refund sekarang atomic via FieldValue.increment
//             (sebelumnya: baca-hitung-tulis = race condition)
//  [BUG FIX]  Price query parsing diperbaiki — handle kedua format respons 5sim
//             dengan lebih eksplisit dan tidak ambigu
//  [BUG FIX]  Tambah production logging untuk 5sim buy failure agar mudah debug
//  [IMPROVE]  Tambah validasi simOrder.phone fallback lebih defensif

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const mapServiceTo5Sim = (serviceId: string): string => {
  const map: Record<string, string> = {
    twitter: 'twitterx', vkontakte: 'vk', ok: 'odnoklassniki',
    wechat: 'wechat', kakaotalk: 'kakaotalk', line: 'line', viber: 'viber',
    snapchat: 'snapchat', linkedin: 'linkedin', pinterest: 'pinterest',
    reddit: 'reddit', tumblr: 'tumblr', quora: 'quora', twitch: 'twitch',
    google: 'google', apple: 'apple', microsoft: 'microsoft', openai: 'openai',
    claude: 'anthropic', github: 'github', amazon: 'amazon', mailru: 'mailru',
    yandex: 'yandex', protonmail: 'protonmail', naver: 'naver', yahoo: 'yahoo',
    azure: 'azure', aws: 'amazon',
    shopee: 'shopee', gojek: 'gojek', grab: 'grab', tokopedia: 'tokopedia',
    lazada: 'lazada', alibaba: 'alibaba', taobao: 'taobao', ebay: 'ebay',
    uber: 'uber', foodpanda: 'foodpanda', doordash: 'doordash',
    ubereats: 'ubereats', grubhub: 'grubhub', shein: 'shein',
    ozon: 'ozon', wildberries: 'wildberries',
    netflix: 'netflix', spotify: 'spotify', steam: 'steam',
    blizzard: 'blizzard', playstation: 'playstation', nintendo: 'nintendo',
    roblox: 'roblox', faceit: 'faceit', ea: 'ea', ubisoft: 'ubisoft',
    tinder: 'tinder', bumble: 'bumble', badoo: 'badoo', pof: 'pof',
    grindr: 'grindr', match: 'match', okcupid: 'okcupid', hinge: 'hinge',
    paypal: 'paypal', binance: 'binance', coinbase: 'coinbase',
    kucoin: 'kucoin', bybit: 'bybit', payoneer: 'payoneer',
    revolut: 'revolut', monzo: 'monzo', transferwise: 'wise',
    skrill: 'skrill', neteller: 'neteller', webmoney: 'webmoney',
    payeer: 'payeer', crypto: 'crypto', kraken: 'kraken', huobi: 'huobi',
    okx: 'okx', disneyplus: 'disneyplus', hbo: 'hbo', hulu: 'hulu',
    paramount: 'paramount', amazon_video: 'amazon',
  };
  return map[serviceId] ?? serviceId;
};

const mapCountryTo5Sim = (countryId: string): string => {
  const map: Record<string, string> = {
    indonesia: 'indonesia', russia: 'russia', usa: 'usa', england: 'england',
    malaysia: 'malaysia', thailand: 'thailand', philippines: 'philippines',
    vietnam: 'vietnam', brazil: 'brazil', india: 'india', turkey: 'turkey',
    argentina: 'argentina', china: 'china', germany: 'germany',
    france: 'france', canada: 'canada', japan: 'japan',
    south_korea: 'south_korea', south_africa: 'south_africa',
    nigeria: 'nigeria', colombia: 'colombia', egypt: 'egypt',
    pakistan: 'pakistan', bangladesh: 'bangladesh', saudi_arabia: 'saudi_arabia',
    italy: 'italy', spain: 'spain', mexico: 'mexico',
    australia: 'australia', netherlands: 'netherlands',
  };
  return map[countryId] ?? countryId;
};

// ✅ Server-side price calculation — tidak percaya nilai dari client
const USD_TO_IDR = Number(process.env.USD_TO_IDR) || 16990;

const calcPriceFromUsd = (costUsd: number): number => {
  const validCost = Math.max(0.05, costUsd || 0);
  const costIdr   = validCost * USD_TO_IDR;
  let margin: number;
  if (validCost < 0.20)       margin = 1000;
  else if (validCost <= 0.50) margin = 1500;
  else                        margin = 2000;
  return Math.ceil((costIdr + margin) / 100) * 100;
};

// ✅ FIX: Helper price extractor yang eksplisit — handle 2 format respons 5sim:
//   Format A (dengan filter): { "product": { "country": { "operator": {cost,count,rate} } } }
//   Format B (tanpa filter):  { "country": { "product": { "operator": {cost,count,rate} } } }
const extractPriceFromResponse = (
  data: any,
  simService: string,
  simCountry: string,
  operator: string,
): number | null => {
  if (!data || typeof data !== 'object') return null;

  // Format A: data[service][country][operator]
  const formatA = data?.[simService]?.[simCountry]?.[operator];
  if (formatA?.cost && typeof formatA.cost === 'number' && formatA.cost > 0) {
    return formatA.cost;
  }

  // Format B: data[country][service][operator]
  const formatB = data?.[simCountry]?.[simService]?.[operator];
  if (formatB?.cost && typeof formatB.cost === 'number' && formatB.cost > 0) {
    return formatB.cost;
  }

  // Fallback: jika operator 'any' tidak cocok, cari harga minimum dari semua operator
  // yang tersedia (kadang 5sim pakai nama operator berbeda dari yang dikirim client)
  const tryRoot = data?.[simService]?.[simCountry] ?? data?.[simCountry]?.[simService];
  if (tryRoot && typeof tryRoot === 'object') {
    let minCost: number | null = null;
    for (const opKey of Object.keys(tryRoot)) {
      const entry = tryRoot[opKey];
      if (entry?.cost && typeof entry.cost === 'number' && entry.cost > 0) {
        if (minCost === null || entry.cost < minCost) minCost = entry.cost;
      }
    }
    if (minCost !== null) return minCost;
  }

  return null;
};

const SAFE_ID_REGEX = /^[a-z0-9_]{1,40}$/;
const UUID_REGEX    = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // ── 1. Verifikasi Token ────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;
    let emailVerified: boolean;
    try {
      const decoded = await adminAuth.verifyIdToken(token, /* checkRevoked= */ true);
      uid           = decoded.uid;
      emailVerified = decoded.email_verified ?? false;
    } catch (err: any) {
      const isRevoked = err?.code === 'auth/id-token-revoked';
      return NextResponse.json(
        { error: isRevoked ? 'Sesi telah berakhir. Silakan login ulang.' : 'Token tidak valid.' },
        { status: 401 }
      );
    }

    if (!emailVerified) {
      return NextResponse.json(
        { error: 'Email belum diverifikasi. Silakan klik link verifikasi di inbox kamu.' },
        { status: 403 },
      );
    }

    // ── 2. Parse & Validasi Payload ────────────────────────────────────────
    let body: any;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Body request tidak valid.' }, { status: 400 }); }

    const { countryId, serviceId, operator, idempotencyKey } = body ?? {};

    if (!countryId || !serviceId || !operator || !idempotencyKey) {
      return NextResponse.json(
        { error: 'Field countryId, serviceId, operator, idempotencyKey wajib diisi.' },
        { status: 400 },
      );
    }
    if (!SAFE_ID_REGEX.test(countryId)) {
      return NextResponse.json({ error: 'countryId tidak valid.' }, { status: 400 });
    }
    if (!SAFE_ID_REGEX.test(serviceId)) {
      return NextResponse.json({ error: 'serviceId tidak valid.' }, { status: 400 });
    }
    if (typeof operator !== 'string' || !/^[a-z0-9_\-]{1,30}$/.test(operator)) {
      return NextResponse.json({ error: 'operator tidak valid.' }, { status: 400 });
    }
    if (typeof idempotencyKey !== 'string' || !UUID_REGEX.test(idempotencyKey)) {
      return NextResponse.json(
        { error: 'idempotencyKey harus berformat UUID v4.' },
        { status: 400 },
      );
    }

    // ── 3. Query Harga Terkini ke 5sim ─────────────────────────────────────
    const FIVE_SIM_API_KEY = process.env.FIVESIM_API_KEY;
    if (!FIVE_SIM_API_KEY) {
      console.error('[buy-number] FIVESIM_API_KEY tidak di-set di environment!');
      return NextResponse.json({ error: 'Konfigurasi server bermasalah.' }, { status: 500 });
    }

    const simCountry = mapCountryTo5Sim(countryId);
    const simService = mapServiceTo5Sim(serviceId);

    let priceUsd: number | null = null;
    try {
      const priceRes = await fetch(
        `https://5sim.net/v1/guest/prices?country=${encodeURIComponent(simCountry)}&product=${encodeURIComponent(simService)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
      );
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        // ✅ FIX: Gunakan helper eksplisit — tidak lagi ambigu dengan `??` fallback
        priceUsd = extractPriceFromResponse(priceData, simService, simCountry, operator);
        if (!priceUsd) {
          // Log raw response untuk membantu debug jika format berubah
          console.warn(
            `[buy-number] Harga tidak ditemukan untuk ${simService}/${simCountry}/${operator}.`,
            `Raw: ${JSON.stringify(priceData).substring(0, 300)}`,
          );
        }
      } else {
        console.warn(`[buy-number] 5sim price API HTTP ${priceRes.status}`);
      }
    } catch (err: any) {
      console.warn('[buy-number] Gagal query harga 5sim:', err?.message);
    }

    if (!priceUsd) {
      return NextResponse.json(
        { error: 'Tidak dapat mengambil harga terkini. Silakan coba lagi.' },
        { status: 503 },
      );
    }

    const priceIdr = calcPriceFromUsd(priceUsd);

    // ── 4. Cek Idempotency + Potong Saldo dalam SATU Transaction ──────────
    const userRef  = adminDb.collection('users').doc(uid);
    const idempRef = adminDb.collection('users').doc(uid)
                            .collection('idempotency').doc(idempotencyKey);

    let isDuplicate = false;
    let prevOrderId: string | undefined;
    let prevNumber:  string | undefined;

    try {
      await adminDb.runTransaction(async (t) => {
        const [idempSnap, userSnap] = await Promise.all([
          t.get(idempRef),
          t.get(userRef),
        ]);

        if (idempSnap.exists) {
          const prev  = idempSnap.data()!;
          isDuplicate = true;
          prevOrderId = prev.orderId;
          prevNumber  = prev.number;
          return;
        }

        if (!userSnap.exists) throw new Error('Data user tidak ditemukan.');
        const userData = userSnap.data()!;
        if (userData.banned === true) throw new Error('Akun kamu telah dinonaktifkan.');

        const balance = userData.balance ?? 0;
        if (balance < priceIdr) throw new Error('Saldo tidak cukup untuk melakukan pembelian ini.');

        t.update(userRef, {
          balance:    FieldValue.increment(-priceIdr),
          totalSpent: FieldValue.increment(priceIdr),
        });
        t.set(idempRef, {
          status:    'processing',
          priceIdr,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (isDuplicate) {
      return NextResponse.json({ orderId: prevOrderId, number: prevNumber, isDuplicate: true });
    }

    // ── 5. Beli Nomor di 5sim ──────────────────────────────────────────────
    let simOrder: any;
    try {
      const buyUrl = `https://5sim.net/v1/user/buy/activation/${encodeURIComponent(simCountry)}/${encodeURIComponent(operator)}/${encodeURIComponent(simService)}`;
      const buyRes = await fetch(buyUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${FIVE_SIM_API_KEY}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      const rawText = await buyRes.text();
      let parsed: any;
      try { parsed = JSON.parse(rawText); }
      catch {
        throw new Error(`Response tidak valid dari 5sim: ${rawText.substring(0, 100)}`);
      }

      // ✅ FIX: Log detail 5sim response di production agar mudah debug
      if (!buyRes.ok || parsed?.message || !parsed?.id) {
        const errMsg = parsed?.message || `5sim HTTP ${buyRes.status}`;
        console.error(
          `[buy-number] 5sim buy gagal — uid=${uid} country=${simCountry}`,
          `service=${simService} operator=${operator}`,
          `status=${buyRes.status} message="${errMsg}"`,
          `raw=${rawText.substring(0, 200)}`,
        );
        throw new Error(errMsg);
      }

      simOrder = parsed;
      console.log(
        `[buy-number] 5sim buy sukses — orderId=${simOrder.id}`,
        `phone=${simOrder.phone} uid=${uid}`,
      );
    } catch (err: any) {
      // Refund saldo karena pembelian ke 5sim gagal
      try {
        const mutasiRef = userRef.collection('transactions').doc();
        await adminDb.runTransaction(async (t) => {
          // ✅ FIX: Gunakan FieldValue.increment — TIDAK baca dulu, hitung, lalu tulis.
          // Sebelumnya: read currentSpent → compute → write → race condition di refund paralel.
          t.update(userRef, {
            balance:    FieldValue.increment(priceIdr),
            totalSpent: FieldValue.increment(-priceIdr),
          });
          t.set(mutasiRef, {
            type:      'refund',
            amount:    priceIdr,
            desc:      `Refund otomatis (gagal beli nomor) - ${serviceId.toUpperCase()}`,
            status:    'success',
            timestamp: Date.now(),
          });
          // Hapus idempotency placeholder agar user bisa coba lagi
          t.delete(idempRef);
        });
      } catch (refundErr: any) {
        console.error('[buy-number] KRITIS — Refund gagal! uid:', uid, 'amount:', priceIdr, refundErr.message);
      }
      throw err;
    }

    // ── 6. Simpan Order ke Firestore ──────────────────────────────────────
    // ✅ PENTING: orderId = String(simOrder.id) — HARUS sama dengan Firestore doc ID
    // agar route /api/otp-stream bisa poll 5sim dengan ID yang benar.
    const orderId   = String(simOrder.id);
    // ✅ FIX: Ambil nomor telepon dari semua field yang mungkin dikembalikan 5sim
    const number    = simOrder.phone || simOrder.number || simOrder.phoneNumber || '';
    const now       = Date.now();
    const orderRef  = userRef.collection('orders').doc(orderId);
    const mutasiRef = userRef.collection('transactions').doc();

    if (!number) {
      // Log warning tapi tetap lanjut — number mungkin belum tersedia saat beli
      console.warn(`[buy-number] simOrder tidak memiliki field phone/number. orderId=${orderId}`, JSON.stringify(simOrder).substring(0, 200));
    }

    await adminDb.runTransaction(async (t) => {
      t.set(orderRef, {
        id:        orderId,
        countryId,
        serviceId,
        operator,
        number,
        price:     priceIdr,
        priceUsd,
        status:    'active',
        otp:       null,
        timestamp: now,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        // ✅ expiresAt disimpan sebagai NUMBER (milliseconds) — BUKAN Firestore Timestamp.
        // Route otp-stream membandingkan: Date.now() > expiresAt
        // Jika ini Timestamp object, perbandingan akan salah → order selalu expired.
        expiresAt: now + 20 * 60 * 1000,
      });
      t.set(mutasiRef, {
        type:      'purchase',
        amount:    -priceIdr,
        desc:      `Beli nomor ${serviceId.toUpperCase()} (${simCountry})`,
        status:    'success',
        orderId,
        timestamp: now,
      });
      t.set(idempRef, {
        orderId,
        number,
        status:    'done',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      orderId,
      number,
      price: priceIdr,
      message: 'Nomor berhasil dibeli. Silakan tunggu OTP.',
    });

  } catch (error: any) {
    console.error('[buy-number] Unhandled error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan server.' },
      { status: 500 },
    );
  }
}