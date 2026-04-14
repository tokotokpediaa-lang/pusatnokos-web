/**
 * ==========================================
 * lib/apiClient.ts
 * ==========================================
 * Drop-in replacement untuk secureApiCall di page.tsx.
 * 
 * Fitur baru:
 *   ✅ Rate Limiting  — mencegah spam request per endpoint
 *   ✅ Token Caching  — token disimpan di memori, hanya di-refresh jika
 *                       sudah expired / mendekati expiry (< 5 menit)
 * 
 * Cara pakai:
 *   1. Salin file ini ke /lib/apiClient.ts
 *   2. Di page.tsx, HAPUS fungsi secureApiCall lama (baris 1187–1234)
 *      lalu tambahkan di atasnya:
 *        import { secureApiCall } from '@/lib/apiClient';
 *      atau jika page.tsx belum mendukung import eksternal (semua dalam
 *      satu file), paste langsung blok kode di bawah menggantikan
 *      fungsi secureApiCall yang lama.
 */

import { getAuth } from 'firebase/auth';

// ==========================================
// TOKEN CACHE
// ==========================================
// Menyimpan token Firebase di memori agar tidak perlu hit network
// setiap kali secureApiCall dipanggil.
//
// Skenario refresh (salah satu terpenuhi):
//   • Token belum ada (first call setelah login)
//   • Token sudah expired
//   • Token akan expired dalam < TOKEN_REFRESH_BUFFER_MS (default 5 menit)
//   • Server mengembalikan 401 (token ditolak) → force-refresh sekali lagi

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 menit

interface TokenCache {
  token: string | null;
  expiresAt: number; // Unix ms
}

const tokenCache: TokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Mengembalikan Firebase ID token yang valid.
 * - Jika cache masih fresh → langsung pakai (tidak hit network).
 * - Jika cache expired / mendekati expiry → getIdTokenResult(forceRefresh=true).
 */
export const getCachedToken = async (): Promise<string> => {
  const auth = getAuth();
  if (!auth.currentUser) {
    throw new Error('Akses ditolak: Sesi tidak valid. Silakan login kembali.');
  }

  const now = Date.now();
  const isTokenFresh =
    tokenCache.token !== null &&
    tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > now;

  if (isTokenFresh) {
    return tokenCache.token!;
  }

  // Token perlu di-refresh
  const result = await auth.currentUser.getIdTokenResult(/* forceRefresh */ true);
  tokenCache.token = result.token;
  tokenCache.expiresAt = new Date(result.expirationTime).getTime();

  return tokenCache.token;
};

/** Invalidasi cache secara manual (mis: saat user logout) */
export const clearTokenCache = (): void => {
  tokenCache.token = null;
  tokenCache.expiresAt = 0;
};


// ==========================================
// RATE LIMITER
// ==========================================
// Sliding-window rate limiter berbasis timestamp di memori.
// Setiap endpoint bisa punya limit berbeda.
//
// Cara kerja:
//   • Setiap panggilan → simpan timestamp-nya.
//   • Sebelum eksekusi → buang timestamp yang sudah di luar window.
//   • Jika jumlah timestamp tersisa ≥ maxCalls → throw error dengan
//     info berapa detik lagi bisa coba.

interface RateLimitConfig {
  maxCalls: number;   // Maksimum panggilan dalam windowMs
  windowMs: number;   // Durasi window (ms)
}

interface RateLimitStore {
  timestamps: number[];
}

/**
 * Konfigurasi per-endpoint.
 * Key = path saja (tanpa query string), mis: '/api/order/buy'.
 * 'default' dipakai untuk endpoint yang tidak terdaftar.
 *
 * Sesuaikan nilai ini dengan kebutuhan bisnis kamu.
 */
const RATE_LIMIT_CONFIG: Record<string, RateLimitConfig> = {
  // Beli nomor — batasi ketat agar tidak spam order
  '/api/order/buy':          { maxCalls: 3,  windowMs: 60_000  }, // 3× / menit

  // Cek SMS / polling — bisa lebih longgar
  '/api/sms/check':          { maxCalls: 30, windowMs: 10_000  }, // 30× / 10 detik
  '/api/order/check':        { maxCalls: 20, windowMs: 10_000  }, // 20× / 10 detik

  // Cancel / ban / finish — aksi destruktif, batasi
  '/api/order/cancel':       { maxCalls: 5,  windowMs: 30_000  }, // 5× / 30 detik
  '/api/order/finish':       { maxCalls: 5,  windowMs: 30_000  },

  // Deposit & mutasi — sensitif keuangan
  '/api/deposit/create':     { maxCalls: 5,  windowMs: 60_000  }, // 5× / menit
  '/api/deposit/verify':     { maxCalls: 10, windowMs: 60_000  },

  // Update profil
  '/api/user/update-profile':{ maxCalls: 5,  windowMs: 60_000  },

  // Ambil produk / harga — operasi baca, cukup longgar
  '/api/products':           { maxCalls: 20, windowMs: 10_000  },

  // Default: semua endpoint lain
  'default':                 { maxCalls: 10, windowMs: 10_000  }, // 10× / 10 detik
};

// Penyimpanan timestamp per endpoint di memori
const rateLimitStore: Record<string, RateLimitStore> = {};

/**
 * Memeriksa apakah request boleh dieksekusi.
 * Melempar Error jika rate limit terlampaui.
 */
const checkRateLimit = (endpoint: string): void => {
  // Normalisasi: ambil path saja, strip query string
  let path: string;
  try {
    path = new URL(endpoint, 'http://x').pathname;
  } catch {
    path = endpoint.split('?')[0];
  }

  const config: RateLimitConfig =
    RATE_LIMIT_CONFIG[path] ?? RATE_LIMIT_CONFIG['default'];

  if (!rateLimitStore[path]) {
    rateLimitStore[path] = { timestamps: [] };
  }

  const store = rateLimitStore[path];
  const now = Date.now();

  // Geser window: buang timestamp yang sudah kedaluwarsa
  store.timestamps = store.timestamps.filter(
    (ts) => now - ts < config.windowMs
  );

  if (store.timestamps.length >= config.maxCalls) {
    // Hitung sisa waktu hingga slot pertama tersedia
    const oldestTs = store.timestamps[0];
    const waitMs = config.windowMs - (now - oldestTs);
    const waitSec = Math.ceil(waitMs / 1000);

    throw new Error(
      `Terlalu banyak permintaan. Harap tunggu ${waitSec} detik sebelum mencoba lagi.`
    );
  }

  // Catat request ini
  store.timestamps.push(now);
};


// ==========================================
// SECURE API CALL (dengan Rate Limit + Token Cache)
// ==========================================
/**
 * Fungsi utama untuk memanggil API route Next.js secara aman.
 *
 * Perubahan vs versi lama:
 *   • Token tidak selalu di-refresh (menggunakan cache, hemat ~200ms/call)
 *   • Rate limiting per-endpoint (mencegah spam & abuse)
 *   • Auto-retry sekali jika server mengembalikan 401 (token sudah invalid
 *     di sisi server meski belum expired secara lokal — edge case race condition)
 *
 * @param endpoint  URL API route, mis: '/api/order/buy'
 * @param payload   Body JSON untuk POST request (null → GET)
 * @returns         Parsed JSON response
 * @throws          Error dengan pesan yang ramah pengguna
 */
export const secureApiCall = async (
  endpoint: string,
  payload: Record<string, unknown> | null = null
): Promise<any> => {
  // ── 1. RATE LIMIT CHECK ──────────────────────────────────────────────────
  checkRateLimit(endpoint);

  // ── 2. DAPATKAN TOKEN (dari cache atau refresh) ──────────────────────────
  let token = await getCachedToken();

  // ── 3. BUAT REQUEST ─────────────────────────────────────────────────────
  const makeRequest = async (bearerToken: string): Promise<Response> => {
    const headers: HeadersInit = {
      Authorization: `Bearer ${bearerToken}`,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    };

    return fetch(endpoint, {
      method: payload ? 'POST' : 'GET',
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  };

  let res = await makeRequest(token);

  // ── 4. AUTO-RETRY JIKA 401 (token revoked di sisi server) ───────────────
  // Ini menangani edge case: token belum expired secara lokal, tapi sudah
  // direvoke di Firebase (mis: user logout dari device lain, atau admin
  // merevoke session). Kita invalidasi cache lalu coba sekali lagi.
  if (res.status === 401) {
    clearTokenCache();
    token = await getCachedToken(); // force refresh
    res = await makeRequest(token);
  }

  // ── 5. HANDLE RESPONSE ───────────────────────────────────────────────────
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    throw new Error(
      'Respons bukan JSON. API Route mungkin belum dibuat atau ada error server (cek terminal).'
    );
  }

  const data = await res.json();

  if (!res.ok) {
    // Server mengembalikan error dengan pesan — teruskan ke UI
    throw new Error(
      data?.message ?? data?.error ?? `Gagal memanggil API: HTTP ${res.status}`
    );
  }

  return data;
};