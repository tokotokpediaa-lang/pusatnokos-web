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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
