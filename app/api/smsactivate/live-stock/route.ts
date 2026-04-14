// /api/smsactivate/live-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SA_BASE = 'https://hero-sms.com/stubs/handler_api.php';
const SA_KEY  = process.env.SMSACTIVATE_API_KEY!;

// Cache nama service agar tidak fetch ulang setiap request
let serviceNamesCache: Record<string, string> = {};
let serviceNamesCacheTime = 0;
const SERVICE_NAMES_TTL = 60 * 60 * 1000; // 1 jam

// Fetch nama service dari getServicesList API (sesuai screenshot HeroSMS)
// Response: { status: "success", services: [{ code: "wa", name: "WhatsApp" }, ...] }
async function getServiceNames(): Promise<Record<string, string>> {
  const now = Date.now();
  if (serviceNamesCacheTime > 0 && now - serviceNamesCacheTime < SERVICE_NAMES_TTL) {
    return serviceNamesCache;
  }

  try {
    const res = await fetch(
      `${SA_BASE}?action=getServicesList&api_key=${SA_KEY}&lang=en`,
      { cache: 'no-store' }
    );
    if (!res.ok) return serviceNamesCache;

    const json = await res.json();

    // Format respon: { status: "success", services: [{ code: "wa", name: "WhatsApp" }] }
    if (json?.status !== 'success' || !Array.isArray(json?.services)) {
      return serviceNamesCache;
    }

    const names: Record<string, string> = {};
    for (const item of json.services as { code: string; name: string }[]) {
      if (item?.code && item?.name) {
        names[item.code.toLowerCase()] = item.name;
      }
    }

    if (Object.keys(names).length > 0) {
      serviceNamesCache = names;
      serviceNamesCacheTime = now;
    }

    return serviceNamesCache;
  } catch {
    return serviceNamesCache;
  }
}

// Fallback mapping untuk kode yang tidak ada di getServicesList
const SA_FALLBACK_NAMES: Record<string, string> = {
  'wa':  'WhatsApp',        'tg':  'Telegram',        'ig':  'Instagram',
  'fb':  'Facebook',        'tw':  'Twitter / X',      'ds':  'Discord',
  'wc':  'WeChat',          'vk':  'VKontakte',        'ok':  'OK.ru',
  'li':  'LinkedIn',        'go':  'Google',            'am':  'Amazon',
  'oi':  'OpenAI/ChatGPT',  'ya':  'Yahoo',             'pm':  'ProtonMail',
  'nv':  'Naver',           'ub':  'Uber',              'gj':  'Gojek',
  'wb':  'Wildberries',     'ue':  'Uber Eats',         'pa':  'PayPal',
  'bn':  'Binance',         'cb':  'Coinbase',          'hu':  'Huobi',
  'oj':  'OVO',             'nf':  'Netflix',            'bl':  'Bumble',
  'ep':  'Epic Games',      'gr':  'Garena',             'dp':  'Disney+',
  'hb':  'HBO Max',         'tc':  'Twitch',             'tm':  'Tumblr',
  'vk2': 'VKontakte',       'xx':  'Any Service',        'kl':  'KakaoTalk',
  'gp':  'Google Pay',      'mm':  'MoMo',               'us':  'US Number',
  'nz':  'New Zealand',     'bw':  'Bandwidth',          'lc':  'Line Corp',
  'mo':  'Movistar',        'jx':  'JD.com',             'zr':  'Zara',
  'wx':  'WeChat (WX)',     'sv':  'Skype/VoIP',         'aq':  'AliPay',
  'gq':  'Google (GQ)',     'byp': 'BytePlus',           'acm': 'Acorn Media',
  'ang': 'Angle',           'bxy': 'Boxy',               'df':  'DoorDash Food',
  'dl':  'DailyHunt',       'dr':  'DrChrono',           'uf':  'Ulta Beauty',
  'uu':  'UU Game',         'wg':  'WeGame',             'fz':  'Fazz',
  'fs':  'FoodSaver',       'fd':  'FoodDelivery',       'auh': 'Auth0',
  'adt': 'ADT',             'agd': 'AgriDoc',            'api': 'API Service',
  'apg': 'APG',             'app': 'AppStore',           'aps': 'APS',
  'baq': 'Baqala',          'bfr': 'Buffer',             'blp': 'Bluepay',
  'bpt': 'Blueprint',       'ie':  'Internet Explorer',  'gx':  'Grab Express',
  'ti':  'TikTok Indonesia','afp': 'AFP',                'ac':  'AC Market',
  'abk': 'ABK',             'ts':  'Tokocrypto',         'kt':  'Kakao T',
  'sw':  'Swvl',            'ka':  'Kapital Bank',        'za':  'Zalo',
  'aqt': 'AquaTest',        'vr':  'Viber',              'ok2': 'OK.ru Alt',
  're':  'Rakuten',         'gm':  'Gmail',              'sg':  'Snapchat',
  'rl':  'Roblox',          'sn':  'Snapchat',           'sp':  'Spotify',
  'vb':  'Viber',           'ww':  'Wildberries',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get('country') ?? '';
  const service = searchParams.get('service') ?? '';

  try {
    // Fetch prices & service names secara paralel
    const [pricesRes, serviceNames] = await Promise.all([
      fetch(
        `${SA_BASE}?action=getPrices&api_key=${SA_KEY}${country ? `&country=${country}` : ''}${service ? `&service=${service}` : ''}`,
        { cache: 'no-store' }
      ),
      getServiceNames(),
    ]);

    if (!pricesRes.ok) throw new Error(`SA error: ${pricesRes.status}`);

    const raw = await pricesRes.json();

    const normalized: Record<string, { cost: number; minPrice: number; count: number; name?: string; saName?: string }> = {};

    const countryData: Record<string, any> | null =
      raw[country] ?? raw[Number(country)] ?? null;

    if (countryData && typeof countryData === 'object') {
      for (const [serviceCode, info] of Object.entries(countryData)) {
        if (!info || typeof info !== 'object') continue;
        const cnt = Number((info as any).count ?? 0);
        if (cnt === 0) continue;

        const rawCost   = Number((info as any).cost ?? 0);
        const lowerCode = serviceCode.toLowerCase();

        // Prioritas nama:
        // 1. Nama dari SA response langsung (info.name)
        // 2. Nama dari getServicesList API  ← sekarang lengkap dari HeroSMS
        // 3. Fallback mapping manual
        // 4. Kode SA sebagai nama (uppercase)
        const saDirectName = (info as any).name as string | undefined;
        const resolvedName =
          saDirectName ||
          serviceNames[lowerCode] ||
          SA_FALLBACK_NAMES[lowerCode] ||
          serviceCode.toUpperCase();

        normalized[serviceCode] = {
          cost:     rawCost,
          minPrice: rawCost,
          count:    cnt,
          name:     resolvedName,
          saName:   saDirectName,
        };
      }
    }

    return NextResponse.json({ provider: 'smsactivate', services: normalized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}