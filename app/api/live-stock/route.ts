// app/api/live-stock/route.ts
// Proxy ke 5sim untuk ambil harga & stok (tanpa auth, endpoint guest)
// FIX: timeout lebih panjang, filter produk yang relevan saja

import { NextResponse } from 'next/server';

// Daftar service yang ditampilkan di web kita (sama dengan SERVICES di page.tsx)
// Dipakai untuk filter response 5sim agar response tidak terlalu besar
const OUR_SERVICES = new Set([
  'whatsapp','telegram','instagram','facebook','tiktok','twitterx','discord','line',
  'wechat','viber','kakaotalk','snapchat','vk','odnoklassniki','linkedin','pinterest',
  'reddit','tumblr','quora','twitch','google','apple','microsoft','yahoo','openai',
  'anthropic','github','amazon','mailru','yandex','protonmail','naver','azure',
  'shopee','gojek','grab','tokopedia','lazada','alibaba','taobao','ebay','uber',
  'foodpanda','doordash','ubereats','grubhub','shein','ozon','wildberries',
  'netflix','spotify','steam','blizzard','playstation','nintendo','roblox',
  'faceit','ea','ubisoft','tinder','bumble','badoo','pof','grindr','match',
  'okcupid','hinge','paypal','binance','coinbase','kucoin','bybit','payoneer',
  'revolut','monzo','wise','skrill','neteller','webmoney','payeer','crypto',
  'kraken','gemini','huobi','okx','mexc','gate','bitget','bingx',
  'disneyplus','hbo','hulu','paramount','deezer','crunchyroll','xbox',
  'epicgames','supercell','garena','zoom','slack','dropbox','stripe',
  'airbnb','lyft','bolt','ovo','dana','linkaja','truemoney','gcash','paymaya','momo',
  // alias tambahan
  'linode','vultr','perfectmoney','advcash','deliveroo','gopay',
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');

  if (!country) {
    return NextResponse.json({ error: 'Parameter country wajib diisi' }, { status: 400 });
  }

  const safeCountry = country.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!safeCountry) {
    return NextResponse.json({ error: 'Nama negara tidak valid' }, { status: 400 });
  }

  try {
    // Timeout 30 detik - Russia & negara besar butuh waktu lebih lama
    const res = await fetch(`https://5sim.net/v1/guest/prices?country=${safeCountry}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PusatNokos/1.0)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[live-stock] 5sim error ${res.status} negara="${safeCountry}":`, errText.slice(0, 200));
      return NextResponse.json({ error: `5sim error ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Respons 5sim bukan JSON' }, { status: 502 });
    }

    const rawData = await res.json();

    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      return NextResponse.json({ error: 'Format data 5sim tidak dikenali' }, { status: 502 });
    }

    if (Object.keys(rawData).length === 0) {
      return NextResponse.json({ error: `Tidak ada stok untuk negara: ${safeCountry}` }, { status: 404 });
    }

    // Filter: hanya kirim service yang ada di web kita
    // Ini mengurangi ukuran response secara drastis (Russia punya 500+ service)
    const filteredData: Record<string, any> = {};
    for (const serviceName of Object.keys(rawData)) {
      if (OUR_SERVICES.has(serviceName)) {
        filteredData[serviceName] = rawData[serviceName];
      }
    }

    // Jika tidak ada satupun yang match, kirim semua (jangan kirim kosong)
    const finalData = Object.keys(filteredData).length > 0 ? filteredData : rawData;

    return NextResponse.json(finalData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120', // cache 2 menit
        'X-Country': safeCountry,
        'X-Services-Count': String(Object.keys(finalData).length),
      },
    });

  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error(`[live-stock] Error negara="${safeCountry}":`, error?.message);
    return NextResponse.json(
      { error: isTimeout ? `Timeout 30s: 5sim tidak merespons untuk negara ${safeCountry}` : (error?.message || 'Internal error') },
      { status: 500 }
    );
  }
}