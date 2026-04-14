'use client';

import React, { useEffect, useState } from 'react';
import {
  Send, MessageCircle, Youtube, Globe, RefreshCw,
  ShieldCheck, Zap, Smartphone, Info, AlertCircle,
  CheckCircle2, XCircle, Clock, ChevronDown, Megaphone,
  FileText, Loader2
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { CONTACT, BRAND, DOMAIN, EMAIL_CONTACT, WA_CONTACT, Card, THEME } from './ui';

// ── Firebase singleton ─────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let db: any = null;
if (typeof window !== 'undefined') {
  try {
    const _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(_app);
  } catch {}
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface SiteInfoData {
  serviceDescription?: string;
  refundPolicy?: string;
  refundNotes?: string;
  infoCards?: InfoCard[];
  extraChannels?: ExtraChannel[];
  lastUpdated?: string;
}

export interface InfoCard {
  id: string;
  title: string;
  content: string;
  icon: string;     // emoji atau nama ikon
  color: 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'yellow';
  visible: boolean;
}

export interface ExtraChannel {
  id: string;
  name: string;
  description: string;
  url: string;
  type: 'telegram_channel' | 'telegram_group' | 'whatsapp' | 'youtube' | 'website' | 'other';
  visible: boolean;
}

// ── Default content (fallback jika Firestore belum diisi) ──────────────────
const DEFAULT_SERVICE_DESCRIPTION = `
${BRAND} adalah platform penyedia nomor virtual sementara (OTP/SMS) untuk keperluan verifikasi akun di berbagai platform digital. Layanan kami bersumber dari penyedia pihak ketiga terpercaya dan bersifat sekali pakai.

Kami menyediakan nomor dari berbagai negara dengan harga terjangkau dan proses instan — mulai dari Rp 1.900 per nomor.
`.trim();

const DEFAULT_REFUND_POLICY = `
Saldo yang telah di-top up bersifat non-refundable, kecuali terjadi kesalahan teknis dari pihak kami.

Untuk pembelian nomor: jika OTP tidak masuk dalam waktu yang ditentukan (5–20 menit tergantung layanan), pesanan dapat dibatalkan dan saldo akan dikembalikan secara otomatis ke akun Anda.
`.trim();

// ── Channel type config ────────────────────────────────────────────────────
const CHANNEL_CONFIG: Record<string, { icon: React.ReactNode; color: string; borderColor: string; glowColor: string }> = {
  telegram_channel: {
    icon: <Send className="w-8 h-8 text-blue-400" />,
    color: 'bg-blue-500/10 border-blue-500/30',
    borderColor: 'border-blue-900/30',
    glowColor: 'bg-blue-500',
  },
  telegram_group: {
    icon: <MessageCircle className="w-8 h-8 text-sky-400" />,
    color: 'bg-sky-500/10 border-sky-500/30',
    borderColor: 'border-sky-900/30',
    glowColor: 'bg-sky-500',
  },
  whatsapp: {
    icon: <MessageCircle className="w-8 h-8 text-green-400" />,
    color: 'bg-green-500/10 border-green-500/30',
    borderColor: 'border-green-900/30',
    glowColor: 'bg-green-500',
  },
  youtube: {
    icon: <Youtube className="w-8 h-8 text-red-500" />,
    color: 'bg-red-500/10 border-red-500/30',
    borderColor: 'border-red-900/30',
    glowColor: 'bg-red-500',
  },
  website: {
    icon: <Globe className="w-8 h-8 text-purple-400" />,
    color: 'bg-purple-500/10 border-purple-500/30',
    borderColor: 'border-purple-900/30',
    glowColor: 'bg-purple-500',
  },
  other: {
    icon: <Globe className="w-8 h-8 text-gray-400" />,
    color: 'bg-gray-500/10 border-gray-500/30',
    borderColor: 'border-gray-900/30',
    glowColor: 'bg-gray-500',
  },
};

const ICON_COLOR_MAP: Record<string, string> = {
  red:    'text-red-400 bg-red-500/10 border-red-500/20',
  blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  green:  'text-green-400 bg-green-500/10 border-green-500/20',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

// ── Refund FAQ ─────────────────────────────────────────────────────────────
const REFUND_FAQ = [
  {
    q: 'Apakah saldo bisa ditarik (withdraw)?',
    a: 'Tidak. Saldo yang sudah di-top up tidak dapat ditarik ke rekening. Saldo hanya digunakan untuk pembelian nomor di platform.',
  },
  {
    q: 'Kapan saldo dikembalikan setelah cancel pesanan?',
    a: 'Saldo otomatis dikembalikan dalam hitungan detik setelah pesanan dibatalkan, selama status order masih AKTIF dan OTP belum masuk.',
  },
  {
    q: 'Bagaimana jika saldo terpotong tapi pesanan tidak muncul?',
    a: 'Segera hubungi CS kami via Telegram atau WhatsApp. Lampirkan tangkapan layar mutasi saldo, dan kami akan menyelesaikan dalam 1×24 jam.',
  },
  {
    q: 'Apakah ada biaya pembatalan?',
    a: 'Tidak ada biaya pembatalan. Seluruh saldo yang terpotong dikembalikan 100% jika pesanan memenuhi syarat pengembalian.',
  },
  {
    q: 'Bagaimana jika OTP sudah masuk tapi tidak bisa digunakan?',
    a: 'Jika OTP sudah dikirim, pesanan dianggap berhasil dari sisi kami. Pastikan OTP dimasukkan sebelum kadaluarsa (biasanya 5 menit) di platform tujuan.',
  },
];

// ── Refund Rules ───────────────────────────────────────────────────────────
const REFUND_RULES = {
  dikembalikan: [
    'Pesanan aktif yang dibatalkan sebelum OTP masuk',
    'Nomor tidak menerima OTP dalam batas waktu layanan (5–20 menit)',
    'Kesalahan teknis dari pihak Pusat Nokos yang terverifikasi',
  ],
  tidakDikembalikan: [
    'OTP sudah diterima dan ditampilkan di sistem kami',
    'Pengguna salah memasukkan nomor ke platform tujuan',
    'Platform tujuan menolak nomor (di luar kendali kami)',
    'Pelanggaran Syarat & Ketentuan yang mengakibatkan suspend',
  ],
};

// ── Sub-components ─────────────────────────────────────────────────────────
function SectionHeading({ label, title, accent }: { label: string; title: string; accent: string }) {
  return (
    <div className="mb-7">
      <p className="text-[11px] text-red-400/60 uppercase tracking-[0.25em] font-bold mb-1">{label}</p>
      <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
        {title} <span className="text-red-500">{accent}</span>
      </h2>
    </div>
  );
}

function AdminInfoBanner({ card }: { card: InfoCard }) {
  const colorClass = ICON_COLOR_MAP[card.color] || ICON_COLOR_MAP.red;
  return (
    <div className={`border rounded-2xl p-5 flex gap-4 bg-[#080000] ${colorClass.split(' ').find(c => c.startsWith('border')) || 'border-red-500/20'} mb-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 text-xl ${colorClass}`}>
        {card.icon}
      </div>
      <div>
        <p className="text-white font-bold text-sm mb-1">{card.title}</p>
        <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{card.content}</p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function InfoPage() {
  const [siteInfo, setSiteInfo] = useState<SiteInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Realtime listener ke Firestore settings/siteInfo
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const ref = doc(db, 'settings', 'siteInfo');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSiteInfo(snap.data() as SiteInfoData);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const serviceDesc  = siteInfo?.serviceDescription || DEFAULT_SERVICE_DESCRIPTION;
  const refundPolicy = siteInfo?.refundPolicy        || DEFAULT_REFUND_POLICY;
  const infoCards    = (siteInfo?.infoCards || []).filter(c => c.visible);
  const extraChannels= (siteInfo?.extraChannels || []).filter(c => c.visible);
  const lastUpdated  = siteInfo?.lastUpdated;

  // Channel resmi default (selalu tampil)
  const defaultChannels: (ExtraChannel & { isDefault?: boolean })[] = [
    {
      id: 'tg-cs',
      name: 'Telegram CS',
      description: 'Live support 24/7. Respon lebih cepat.',
      url: `https://t.me/${CONTACT.telegram}`,
      type: 'telegram_group',
      visible: true,
      isDefault: true,
    },
    {
      id: 'wa-cs',
      name: 'WhatsApp CS',
      description: 'Bantuan manual via WA resmi kami.',
      url: `https://wa.me/${CONTACT.whatsapp}`,
      type: 'whatsapp',
      visible: true,
      isDefault: true,
    },
    {
      id: 'website',
      name: 'Website Resmi',
      description: `Platform utama kami di ${DOMAIN}.`,
      url: `https://${DOMAIN}`,
      type: 'website',
      visible: true,
      isDefault: true,
    },
  ];

  const allChannels = [...defaultChannels, ...extraChannels];

  return (
    <div className="max-w-5xl mx-auto space-y-14">

      {/* ── Loading overlay saat pertama kali ─────────────────────────── */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memuat informasi terbaru...</span>
        </div>
      )}

      {/* ── Admin Info Cards (jika ada konten yang diupload admin) ────── */}
      {infoCards.length > 0 && (
        <section>
          <div className="mb-5 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-red-400" />
            <p className="text-[11px] text-red-400/60 uppercase tracking-[0.2em] font-bold">Pengumuman & Info</p>
          </div>
          <div className="space-y-3">
            {infoCards.map(card => (
              <AdminInfoBanner key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* ── Deskripsi Layanan ──────────────────────────────────────────── */}
      <section>
        <SectionHeading label="Tentang Kami" title="Deskripsi" accent="Layanan" />

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: <Zap className="w-6 h-6 text-yellow-400" />, title: 'Proses Instan', desc: 'Nomor langsung aktif setelah pembelian. Tidak perlu menunggu.', color: 'border-yellow-900/30' },
            { icon: <Smartphone className="w-6 h-6 text-blue-400" />, title: '90+ Layanan', desc: 'Tersedia untuk WhatsApp, Telegram, Google, dan banyak lainnya.', color: 'border-blue-900/30' },
            { icon: <ShieldCheck className="w-6 h-6 text-green-400" />, title: 'Aman & Terpercaya', desc: 'Data pribadi tidak digunakan. Transaksi terenkripsi penuh.', color: 'border-green-900/30' },
          ].map((item, i) => (
            <div
              key={i}
              className={`bg-[#080000] border ${item.color} rounded-2xl p-5 flex flex-col gap-3`}
            >
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <p className="text-white font-black text-sm uppercase tracking-wide mb-1">{item.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#080000] border border-red-900/20 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-3 mb-5">
            <Info className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-white font-black text-sm uppercase tracking-widest">Tentang {BRAND}</p>
              {lastUpdated && (
                <p className="text-[10px] text-gray-600 mt-0.5">Terakhir diperbarui: {lastUpdated}</p>
              )}
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{serviceDesc}</p>

          <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Harga mulai', value: 'Rp 1.900' },
              { label: 'OTP masuk', value: '< 1 menit' },
              { label: 'Layanan', value: '90+ aplikasi' },
              { label: 'Support', value: '24/7' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-white font-black text-lg">{stat.value}</p>
                <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Channel Resmi ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading label="Hubungi & Ikuti Kami" title="Channel" accent="Resmi" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allChannels.map((ch) => {
            const cfg = CHANNEL_CONFIG[ch.type] || CHANNEL_CONFIG.other;
            return (
              <div
                key={ch.id}
                className={`bg-[#080000] border ${cfg.borderColor} rounded-2xl p-6 flex flex-col gap-4 group hover:border-opacity-60 transition-all relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 ${cfg.glowColor} opacity-5 rounded-bl-full blur-2xl`} />
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${cfg.color} group-hover:scale-105 transition-transform`}>
                  {cfg.icon}
                </div>
                <div className="flex-1">
                  <p className="text-white font-black text-sm uppercase tracking-wide mb-1">{ch.name}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">{ch.description}</p>
                </div>
                <button
                  onClick={() => window.open(ch.url, '_blank', 'noopener,noreferrer')}
                  className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  Buka →
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Ketentuan Refund ──────────────────────────────────────────── */}
      <section>
        <SectionHeading label="Kebijakan Keuangan" title="Ketentuan" accent="Refund" />

        {/* Overview */}
        <div className="bg-[#080000] border border-red-900/20 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-white font-black text-sm uppercase tracking-widest">Kebijakan Umum</p>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{refundPolicy}</p>
          {siteInfo?.refundNotes && (
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-orange-300/70 text-xs leading-relaxed">{siteInfo.refundNotes}</p>
            </div>
          )}
        </div>

        {/* Kapan saldo dikembalikan / tidak */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Dikembalikan */}
          <div className="bg-[#030a04] border border-green-900/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <p className="text-green-400 font-black text-sm uppercase tracking-wide">Saldo Dikembalikan</p>
            </div>
            <ul className="space-y-2.5">
              {REFUND_RULES.dikembalikan.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Tidak dikembalikan */}
          <div className="bg-[#0a0303] border border-red-900/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 font-black text-sm uppercase tracking-wide">Tidak Dikembalikan</p>
            </div>
            <ul className="space-y-2.5">
              {REFUND_RULES.tidakDikembalikan.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Timeline proses refund */}
        <div className="bg-[#080000] border border-red-900/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-red-400" />
            <p className="text-white font-black text-xs uppercase tracking-widest">Proses Pengembalian Saldo</p>
          </div>
          <div className="space-y-0">
            {[
              { time: 'Instan', label: 'Batalkan pesanan aktif', desc: 'Klik Batalkan di halaman Riwayat Pesanan.' },
              { time: '< 5 detik', label: 'Saldo masuk otomatis', desc: 'Saldo dikembalikan langsung ke akun.' },
              { time: '1×24 jam', label: 'Klaim manual via CS', desc: 'Untuk kasus khusus yang perlu verifikasi admin.' },
            ].map((step, i, arr) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-red-600/10 border border-red-500/30 flex items-center justify-center text-[10px] font-black text-red-400 shrink-0">
                    {i + 1}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-red-900/30 my-1" />}
                </div>
                <div className="pb-5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-black text-sm">{step.label}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full uppercase tracking-widest">{step.time}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Refund ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading label="Pertanyaan Umum" title="FAQ" accent="Refund" />
        <div className="space-y-2">
          {REFUND_FAQ.map((faq, i) => (
            <div
              key={i}
              className={`bg-[#080000] border rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'border-red-500/30' : 'border-white/[0.07]'}`}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
              >
                <span className="text-sm text-white font-bold">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180 text-red-400' : ''}`}
                />
              </button>
              {openFaq === i && (
                <p className="text-xs text-gray-400 px-5 pb-4 pt-0 border-t border-white/[0.05] pt-3 leading-relaxed">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer mini ───────────────────────────────────────────────── */}
      <p className="text-gray-700 text-xs text-center pb-4">
        {BRAND} · {DOMAIN} · {EMAIL_CONTACT}
      </p>
    </div>
  );
}