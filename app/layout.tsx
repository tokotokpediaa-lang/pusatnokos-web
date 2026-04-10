import type { Metadata } from "next";
import Script from "next/script";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Pusat Nokos - Platform OTP Tercepat",
  description: "Nomor virtual dari 170+ negara untuk verifikasi OTP. Instan, murah, auto-refund jika gagal.",
  keywords: "nomor virtual, OTP, verifikasi, WhatsApp, Telegram, TikTok, Indonesia",
  openGraph: {
    title: "Pusat Nokos - Platform OTP Tercepat",
    description: "Nomor virtual dari 170+ negara. OTP instan, auto-refund jika gagal.",
    url: "https://pusatnokos.my.id",
    siteName: "PusatNokos",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={sora.variable}>
      <head>
        <link rel="preconnect" href="https://api.iconify.design" />
        <link rel="preconnect" href="https://logo.clearbit.com" />
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          id="cf-turnstile-script"
        />
      </head>
      <body className={`antialiased bg-[#0a0000] text-gray-300 min-h-screen ${sora.className}`}>
        {children}
      </body>
    </html>
  );
}