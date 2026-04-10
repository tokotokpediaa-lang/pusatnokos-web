import { NextResponse } from 'next/server';

// ==========================================
// GET /api/get-countries
//
// Fetch semua negara yang tersedia di 5sim secara real-time.
// Dipanggil sekali saat BuyNumberPage pertama load.
//
// Cara kerja:
// - Ambil harga untuk produk 'whatsapp' (ada di hampir semua negara 5sim)
// - Ekstrak semua country key dari response
// - Gabungkan dengan metadata (flag, nama, kode telp) dari lookup table
// - Cache 1 jam — daftar negara jarang berubah
// ==========================================

// Lookup: 5sim country id → metadata display
const COUNTRY_META: Record<string, { name: string; flag: string; code: string }> = {
  // Asia Tenggara
  indonesia:              { name: 'Indonesia',              flag: '🇮🇩', code: '+62'  },
  malaysia:               { name: 'Malaysia',               flag: '🇲🇾', code: '+60'  },
  thailand:               { name: 'Thailand',               flag: '🇹🇭', code: '+66'  },
  philippines:            { name: 'Philippines',            flag: '🇵🇭', code: '+63'  },
  vietnam:                { name: 'Vietnam',                flag: '🇻🇳', code: '+84'  },
  singapore:              { name: 'Singapore',              flag: '🇸🇬', code: '+65'  },
  myanmar:                { name: 'Myanmar',                flag: '🇲🇲', code: '+95'  },
  cambodia:               { name: 'Cambodia',               flag: '🇰🇭', code: '+855' },
  laos:                   { name: 'Laos',                   flag: '🇱🇦', code: '+856' },
  brunei:                 { name: 'Brunei',                 flag: '🇧🇳', code: '+673' },
  timor_leste:            { name: 'Timor-Leste',            flag: '🇹🇱', code: '+670' },
  // Asia Timur
  china:                  { name: 'China',                  flag: '🇨🇳', code: '+86'  },
  japan:                  { name: 'Japan',                  flag: '🇯🇵', code: '+81'  },
  south_korea:            { name: 'South Korea',            flag: '🇰🇷', code: '+82'  },
  taiwan:                 { name: 'Taiwan',                 flag: '🇹🇼', code: '+886' },
  hongkong:               { name: 'Hong Kong',              flag: '🇭🇰', code: '+852' },
  mongolia:               { name: 'Mongolia',               flag: '🇲🇳', code: '+976' },
  // Asia Selatan
  india:                  { name: 'India',                  flag: '🇮🇳', code: '+91'  },
  pakistan:               { name: 'Pakistan',               flag: '🇵🇰', code: '+92'  },
  bangladesh:             { name: 'Bangladesh',             flag: '🇧🇩', code: '+880' },
  srilanka:               { name: 'Sri Lanka',              flag: '🇱🇰', code: '+94'  },
  nepal:                  { name: 'Nepal',                  flag: '🇳🇵', code: '+977' },
  bhutan:                 { name: 'Bhutan',                 flag: '🇧🇹', code: '+975' },
  maldives:               { name: 'Maldives',               flag: '🇲🇻', code: '+960' },
  // Asia Tengah
  kazakhstan:             { name: 'Kazakhstan',             flag: '🇰🇿', code: '+7'   },
  uzbekistan:             { name: 'Uzbekistan',             flag: '🇺🇿', code: '+998' },
  kyrgyzstan:             { name: 'Kyrgyzstan',             flag: '🇰🇬', code: '+996' },
  tajikistan:             { name: 'Tajikistan',             flag: '🇹🇯', code: '+992' },
  turkmenistan:           { name: 'Turkmenistan',           flag: '🇹🇲', code: '+993' },
  azerbaijan:             { name: 'Azerbaijan',             flag: '🇦🇿', code: '+994' },
  armenia:                { name: 'Armenia',                flag: '🇦🇲', code: '+374' },
  georgia:                { name: 'Georgia',                flag: '🇬🇪', code: '+995' },
  // Timur Tengah
  saudi_arabia:           { name: 'Saudi Arabia',           flag: '🇸🇦', code: '+966' },
  uae:                    { name: 'UAE',                    flag: '🇦🇪', code: '+971' },
  turkey:                 { name: 'Turkey',                 flag: '🇹🇷', code: '+90'  },
  israel:                 { name: 'Israel',                 flag: '🇮🇱', code: '+972' },
  qatar:                  { name: 'Qatar',                  flag: '🇶🇦', code: '+974' },
  iran:                   { name: 'Iran',                   flag: '🇮🇷', code: '+98'  },
  iraq:                   { name: 'Iraq',                   flag: '🇮🇶', code: '+964' },
  jordan:                 { name: 'Jordan',                 flag: '🇯🇴', code: '+962' },
  lebanon:                { name: 'Lebanon',                flag: '🇱🇧', code: '+961' },
  kuwait:                 { name: 'Kuwait',                 flag: '🇰🇼', code: '+965' },
  bahrain:                { name: 'Bahrain',                flag: '🇧🇭', code: '+973' },
  oman:                   { name: 'Oman',                   flag: '🇴🇲', code: '+968' },
  yemen:                  { name: 'Yemen',                  flag: '🇾🇪', code: '+967' },
  palestine:              { name: 'Palestine',              flag: '🇵🇸', code: '+970' },
  syria:                  { name: 'Syria',                  flag: '🇸🇾', code: '+963' },
  afghanistan:            { name: 'Afghanistan',            flag: '🇦🇫', code: '+93'  },
  // Eropa
  england:                { name: 'United Kingdom',         flag: '🇬🇧', code: '+44'  },
  germany:                { name: 'Germany',                flag: '🇩🇪', code: '+49'  },
  france:                 { name: 'France',                 flag: '🇫🇷', code: '+33'  },
  italy:                  { name: 'Italy',                  flag: '🇮🇹', code: '+39'  },
  spain:                  { name: 'Spain',                  flag: '🇪🇸', code: '+34'  },
  netherlands:            { name: 'Netherlands',            flag: '🇳🇱', code: '+31'  },
  belgium:                { name: 'Belgium',                flag: '🇧🇪', code: '+32'  },
  switzerland:            { name: 'Switzerland',            flag: '🇨🇭', code: '+41'  },
  austria:                { name: 'Austria',                flag: '🇦🇹', code: '+43'  },
  portugal:               { name: 'Portugal',               flag: '🇵🇹', code: '+351' },
  ireland:                { name: 'Ireland',                flag: '🇮🇪', code: '+353' },
  luxembourg:             { name: 'Luxembourg',             flag: '🇱🇺', code: '+352' },
  sweden:                 { name: 'Sweden',                 flag: '🇸🇪', code: '+46'  },
  norway:                 { name: 'Norway',                 flag: '🇳🇴', code: '+47'  },
  finland:                { name: 'Finland',                flag: '🇫🇮', code: '+358' },
  denmark:                { name: 'Denmark',                flag: '🇩🇰', code: '+45'  },
  estonia:                { name: 'Estonia',                flag: '🇪🇪', code: '+372' },
  latvia:                 { name: 'Latvia',                 flag: '🇱🇻', code: '+371' },
  lithuania:              { name: 'Lithuania',              flag: '🇱🇹', code: '+370' },
  russia:                 { name: 'Russia',                 flag: '🇷🇺', code: '+7'   },
  ukraine:                { name: 'Ukraine',                flag: '🇺🇦', code: '+380' },
  poland:                 { name: 'Poland',                 flag: '🇵🇱', code: '+48'  },
  czech:                  { name: 'Czech Republic',         flag: '🇨🇿', code: '+420' },
  romania:                { name: 'Romania',                flag: '🇷🇴', code: '+40'  },
  hungary:                { name: 'Hungary',                flag: '🇭🇺', code: '+36'  },
  belarus:                { name: 'Belarus',                flag: '🇧🇾', code: '+375' },
  bulgaria:               { name: 'Bulgaria',               flag: '🇧🇬', code: '+359' },
  slovakia:               { name: 'Slovakia',               flag: '🇸🇰', code: '+421' },
  moldova:                { name: 'Moldova',                flag: '🇲🇩', code: '+373' },
  greece:                 { name: 'Greece',                 flag: '🇬🇷', code: '+30'  },
  croatia:                { name: 'Croatia',                flag: '🇭🇷', code: '+385' },
  serbia:                 { name: 'Serbia',                 flag: '🇷🇸', code: '+381' },
  slovenia:               { name: 'Slovenia',               flag: '🇸🇮', code: '+386' },
  albania:                { name: 'Albania',                flag: '🇦🇱', code: '+355' },
  north_macedonia:        { name: 'North Macedonia',        flag: '🇲🇰', code: '+389' },
  bosnia:                 { name: 'Bosnia & Herzegovina',   flag: '🇧🇦', code: '+387' },
  montenegro:             { name: 'Montenegro',             flag: '🇲🇪', code: '+382' },
  kosovo:                 { name: 'Kosovo',                 flag: '🇽🇰', code: '+383' },
  cyprus:                 { name: 'Cyprus',                 flag: '🇨🇾', code: '+357' },
  malta:                  { name: 'Malta',                  flag: '🇲🇹', code: '+356' },
  // Amerika
  usa:                    { name: 'United States',          flag: '🇺🇸', code: '+1'   },
  canada:                 { name: 'Canada',                 flag: '🇨🇦', code: '+1'   },
  mexico:                 { name: 'Mexico',                 flag: '🇲🇽', code: '+52'  },
  brazil:                 { name: 'Brazil',                 flag: '🇧🇷', code: '+55'  },
  argentina:              { name: 'Argentina',              flag: '🇦🇷', code: '+54'  },
  colombia:               { name: 'Colombia',              flag: '🇨🇴', code: '+57'  },
  peru:                   { name: 'Peru',                   flag: '🇵🇪', code: '+51'  },
  chile:                  { name: 'Chile',                  flag: '🇨🇱', code: '+56'  },
  venezuela:              { name: 'Venezuela',              flag: '🇻🇪', code: '+58'  },
  ecuador:                { name: 'Ecuador',                flag: '🇪🇨', code: '+593' },
  bolivia:                { name: 'Bolivia',                flag: '🇧🇴', code: '+591' },
  paraguay:               { name: 'Paraguay',               flag: '🇵🇾', code: '+595' },
  uruguay:                { name: 'Uruguay',                flag: '🇺🇾', code: '+598' },
  guatemala:              { name: 'Guatemala',              flag: '🇬🇹', code: '+502' },
  honduras:               { name: 'Honduras',              flag: '🇭🇳', code: '+504' },
  el_salvador:            { name: 'El Salvador',            flag: '🇸🇻', code: '+503' },
  nicaragua:              { name: 'Nicaragua',              flag: '🇳🇮', code: '+505' },
  costa_rica:             { name: 'Costa Rica',             flag: '🇨🇷', code: '+506' },
  panama:                 { name: 'Panama',                 flag: '🇵🇦', code: '+507' },
  cuba:                   { name: 'Cuba',                   flag: '🇨🇺', code: '+53'  },
  dominican_republic:     { name: 'Dominican Republic',     flag: '🇩🇴', code: '+1'   },
  haiti:                  { name: 'Haiti',                  flag: '🇭🇹', code: '+509' },
  jamaica:                { name: 'Jamaica',                flag: '🇯🇲', code: '+1'   },
  trinidad_tobago:        { name: 'Trinidad & Tobago',      flag: '🇹🇹', code: '+1'   },
  guyana:                 { name: 'Guyana',                 flag: '🇬🇾', code: '+592' },
  suriname:               { name: 'Suriname',               flag: '🇸🇷', code: '+597' },
  // Afrika
  egypt:                  { name: 'Egypt',                  flag: '🇪🇬', code: '+20'  },
  morocco:                { name: 'Morocco',                flag: '🇲🇦', code: '+212' },
  algeria:                { name: 'Algeria',                flag: '🇩🇿', code: '+213' },
  tunisia:                { name: 'Tunisia',                flag: '🇹🇳', code: '+216' },
  libya:                  { name: 'Libya',                  flag: '🇱🇾', code: '+218' },
  nigeria:                { name: 'Nigeria',                flag: '🇳🇬', code: '+234' },
  ghana:                  { name: 'Ghana',                  flag: '🇬🇭', code: '+233' },
  kenya:                  { name: 'Kenya',                  flag: '🇰🇪', code: '+254' },
  ethiopia:               { name: 'Ethiopia',               flag: '🇪🇹', code: '+251' },
  south_africa:           { name: 'South Africa',           flag: '🇿🇦', code: '+27'  },
  tanzania:               { name: 'Tanzania',               flag: '🇹🇿', code: '+255' },
  uganda:                 { name: 'Uganda',                 flag: '🇺🇬', code: '+256' },
  senegal:                { name: 'Senegal',                flag: '🇸🇳', code: '+221' },
  cameroon:               { name: 'Cameroon',               flag: '🇨🇲', code: '+237' },
  ivory_coast:            { name: 'Ivory Coast',            flag: '🇨🇮', code: '+225' },
  angola:                 { name: 'Angola',                 flag: '🇦🇴', code: '+244' },
  mozambique:             { name: 'Mozambique',             flag: '🇲🇿', code: '+258' },
  ghana:                  { name: 'Ghana',                  flag: '🇬🇭', code: '+233' },
  zimbabwe:               { name: 'Zimbabwe',               flag: '🇿🇼', code: '+263' },
  zambia:                 { name: 'Zambia',                 flag: '🇿🇲', code: '+260' },
  rwanda:                 { name: 'Rwanda',                 flag: '🇷🇼', code: '+250' },
  namibia:                { name: 'Namibia',                flag: '🇳🇦', code: '+264' },
  botswana:               { name: 'Botswana',               flag: '🇧🇼', code: '+267' },
  mali:                   { name: 'Mali',                   flag: '🇲🇱', code: '+223' },
  burkina_faso:           { name: 'Burkina Faso',           flag: '🇧🇫', code: '+226' },
  niger:                  { name: 'Niger',                  flag: '🇳🇪', code: '+227' },
  guinea:                 { name: 'Guinea',                 flag: '🇬🇳', code: '+224' },
  benin:                  { name: 'Benin',                  flag: '🇧🇯', code: '+229' },
  togo:                   { name: 'Togo',                   flag: '🇹🇬', code: '+228' },
  chad:                   { name: 'Chad',                   flag: '🇹🇩', code: '+235' },
  madagascar:             { name: 'Madagascar',             flag: '🇲🇬', code: '+261' },
  somalia:                { name: 'Somalia',                flag: '🇸🇴', code: '+252' },
  malawi:                 { name: 'Malawi',                 flag: '🇲🇼', code: '+265' },
  gabon:                  { name: 'Gabon',                  flag: '🇬🇦', code: '+241' },
  sierra_leone:           { name: 'Sierra Leone',           flag: '🇸🇱', code: '+232' },
  liberia:                { name: 'Liberia',                flag: '🇱🇷', code: '+231' },
  mauritania:             { name: 'Mauritania',             flag: '🇲🇷', code: '+222' },
  mauritius:              { name: 'Mauritius',              flag: '🇲🇺', code: '+230' },
  democratic_republic_congo: { name: 'DR Congo',           flag: '🇨🇩', code: '+243' },
  south_sudan:            { name: 'South Sudan',            flag: '🇸🇸', code: '+211' },
  sudan:                  { name: 'Sudan',                  flag: '🇸🇩', code: '+249' },
  gambia:                 { name: 'Gambia',                 flag: '🇬🇲', code: '+220' },
  // Oseania
  australia:              { name: 'Australia',              flag: '🇦🇺', code: '+61'  },
  new_zealand:            { name: 'New Zealand',            flag: '🇳🇿', code: '+64'  },
  papua_new_guinea:       { name: 'Papua New Guinea',       flag: '🇵🇬', code: '+675' },
  fiji:                   { name: 'Fiji',                   flag: '🇫🇯', code: '+679' },
};

export async function GET() {
  try {
    // Fetch harga WhatsApp untuk semua negara sekaligus
    // Response: { "indonesia": { "whatsapp": {...} }, "russia": {...}, ... }
    const res = await fetch('https://5sim.net/v1/guest/prices?product=whatsapp', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // cache 1 jam
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal fetch dari 5sim' }, { status: 502 });
    }

    const data = await res.json();

    // data = { "whatsapp": { "indonesia": {...}, "russia": {...}, ... } }
    // atau  = { "indonesia": { "whatsapp": {...} }, ... }
    // Deteksi struktur dan ambil country keys

    let countryIds: string[] = [];

    const firstKey = Object.keys(data)[0];
    if (firstKey === 'whatsapp' || firstKey === 'facebook' || firstKey === 'telegram') {
      // Struktur: { "whatsapp": { "country1": {...}, "country2": {...} } }
      countryIds = Object.keys(data[firstKey] || {});
    } else {
      // Struktur: { "country1": { "whatsapp": {...} }, "country2": {...} }
      countryIds = Object.keys(data);
    }

    if (countryIds.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data negara dari 5sim' }, { status: 404 });
    }

    // Konversi ke format yang dipakai frontend
    const countries = countryIds
      .map(id => {
        const meta = COUNTRY_META[id];
        return {
          id,
          name: meta?.name || id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          flag: meta?.flag || '🌐',
          code: meta?.code || '',
        };
      })
      // Urutkan: Indonesia dulu, lalu alphabetical
      .sort((a, b) => {
        if (a.id === 'indonesia') return -1;
        if (b.id === 'indonesia') return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(
      { countries, total: countries.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );

  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('[get-countries] Error:', error?.message);
    return NextResponse.json(
      { error: isTimeout ? 'Timeout' : error.message },
      { status: 500 }
    );
  }
}