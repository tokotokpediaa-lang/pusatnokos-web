import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
  variable: "--font-sora",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-mono",
});

const BASE_URL = "https://www.pusatnokos.my.id";

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: "Pusat Nokos – Platform OTP Tercepat & Termurah di Indonesia",
    template: "%s | Pusat Nokos",
  },

  description:
    "Beli nomor OTP virtual tercepat dan termurah di Indonesia. Mendukung 100+ layanan seperti WhatsApp, Telegram, Tokopedia, Shopee, TikTok dan lainnya. Proses instan, aman, auto-refund jika gagal.",

  keywords: [
    "beli nomor OTP",
    "OTP virtual Indonesia",
    "nomor OTP murah",
    "platform OTP Indonesia",
    "beli OTP WhatsApp",
    "beli OTP Telegram",
    "OTP Tokopedia",
    "OTP Shopee",
    "OTP TikTok",
    "virtual number Indonesia",
    "nomor sementara Indonesia",
    "receive SMS online Indonesia",
    "pusat nokos",
    "pusatnokos",
    "OTP tercepat",
    "OTP terpercaya",
    "nomor virtual 170 negara",
  ],

  authors: [{ name: "Pusat Nokos", url: BASE_URL }],
  creator: "Pusat Nokos",
  publisher: "Pusat Nokos",
  applicationName: "Pusat Nokos",
  category: "technology",

  alternates: {
    canonical: BASE_URL,
  },

  openGraph: {
    type: "website",
    locale: "id_ID",
    url: BASE_URL,
    siteName: "Pusat Nokos",
    title: "Pusat Nokos – Platform OTP Tercepat & Termurah di Indonesia",
    description:
      "Beli nomor OTP virtual tercepat dan termurah di Indonesia. Mendukung 100+ layanan. Proses instan, aman, auto-refund jika gagal.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pusat Nokos – Platform OTP Tercepat di Indonesia",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Pusat Nokos – Platform OTP Tercepat & Termurah di Indonesia",
    description:
      "Beli nomor OTP virtual tercepat dan termurah di Indonesia. Proses instan, aman, auto-refund jika gagal.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${sora.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.iconify.design" />
        <link rel="preconnect" href="https://logo.clearbit.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Pusat Nokos",
              url: BASE_URL,
              description:
                "Platform OTP virtual tercepat dan termurah di Indonesia. Mendukung 100+ layanan populer.",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: BASE_URL + "/?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
              publisher: {
                "@type": "Organization",
                name: "Pusat Nokos",
                url: BASE_URL,
                logo: {
                  "@type": "ImageObject",
                  url: BASE_URL + "/logo.png",
                },
              },
            }),
          }}
        />
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          id="cf-turnstile-script"
        />
      </head>
      <body className={"antialiased bg-[#0a0000] text-gray-300 min-h-screen " + sora.className}>
        {children}
      </body>
    </html>
  );
}