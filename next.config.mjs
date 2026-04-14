/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development';

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://challenges.cloudflare.com",
  [
    "connect-src 'self'",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://*.googleapis.com",
    "https://firestore.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://5sim.net",
    "https://api.iconify.design",
    "https://api.sms-activate.guru",
    "https://paymenku.com",
  ].join(' '),
  [
    "img-src 'self' data: blob:",
    "https://api.dicebear.com",
    "https://logo.clearbit.com",
    "https://www.google.com",
    "https://api.iconify.design",
    "https://placehold.co",
    "https://www.transparenttextures.com",
    "https://cdnjs.cloudflare.com",
    "https://*.gstatic.com",
    "https://t0.gstatic.com",
    "https://t8.gstatic.com",
  ].join(' '),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-src 'self' https://*.firebaseapp.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  ...(isDev ? [] : [{
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  }]),
  { key: 'X-Frame-Options',        value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  }]),
];

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Optimasi bundle — tree-shake lucide-react & firebase agar hanya
  // komponen/fungsi yang benar-benar dipakai yang masuk ke bundle client.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'firebase/auth',
      'firebase/firestore',
      'firebase/app',
    ],
  },

  // ✅ Kompresi aktif
  compress: true,

  // ✅ Powered-by header dihapus (security + ukuran response)
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // ✅ Cache agresif untuk static assets (JS, CSS, font, gambar)
      // Vercel otomatis kasih hash di filename jadi aman di-cache selamanya
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ✅ Cache untuk public assets (favicon, logo, og-image)
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|webp|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
