'use client';

import dynamic from 'next/dynamic';
const LegalPage      = dynamic(() => import('@/app/components/LegalPage'));
const ContactPage    = dynamic(() => import('@/app/components/ContactPage'));
const AdminPanelPage = dynamic(() => import('@/app/components/AdminPanelPage'), { ssr: false });
const DepositPage     = dynamic(() => import('@/app/components/DepositPage'),     { ssr: false });
const BuyNumberPage      = dynamic(() => import('@/app/components/BuyNumberPage'),      { ssr: false });
const OrderHistoryPage   = dynamic(() => import('@/app/components/OrderHistoryPage'),   { ssr: false });
const DashHome       = dynamic(() => import('@/app/components/DashComponents'),                                        { ssr: false });
const SettingsPage   = dynamic(() => import('@/app/components/DashComponents').then(m => ({ default: m.SettingsPage })), { ssr: false });
const MutasiPage     = dynamic(() => import('@/app/components/DashComponents').then(m => ({ default: m.MutasiPage })),   { ssr: false });
const AuthPage           = dynamic(() => import('@/app/components/AuthPage'),           { ssr: false });
const PinVerifyPage      = dynamic(() => import('@/app/components/AuthPage').then(m => ({ default: m.PinVerifyPage })),  { ssr: false });
const SetupPinPage       = dynamic(() => import('@/app/components/AuthPage').then(m => ({ default: m.SetupPinPage })),   { ssr: false });

import React, { useState, useEffect, useMemo, useRef, useCallback, memo, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle2, ChevronRight, Globe, Lock, Shield, Zap, 
  Menu, X, Smartphone, User, CreditCard, Clock, 
  Search, Filter, ShoppingCart, LogOut, Copy, RefreshCw,
  Gift, Settings, Bell, ChevronDown, Check, AlertCircle,
  PlayCircle, Star, ArrowRight, Flame, Scale, HelpCircle,
  Eye, EyeOff, Loader2, MessageCircle, ChevronLeft,
  Users, Database, Plus, Save, Key, TrendingUp, CheckSquare,
  Activity, BarChart3, AlertTriangle, Trophy, History, CheckCircle, XCircle,
  Download, Ban, RotateCcw, Megaphone
} from 'lucide-react';

// ==========================================
// APP CONTEXT
// ==========================================
const AppContext = createContext(null);
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside App');
  return ctx;
}


// =========================================================
// VirtualCatalogGrid → dipindah ke app/components/BuyNumberPage.tsx
// =========================================================


// ==========================================
// SKELETON LOADER COMPONENTS
// ==========================================
const Shimmer: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    style={style}
    className={`relative overflow-hidden bg-white/[0.06] rounded-lg before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent ${className}`}
  />
);

const ShimmerStyle: React.FC = () => (
  <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
);

const CatalogSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
    <ShimmerStyle />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="relative overflow-hidden rounded-2xl p-4 md:p-5 flex flex-col bg-white/[0.04] border border-white/[0.06]">
        <div className="flex justify-between items-start mb-3">
          <Shimmer className="w-11 h-11 rounded-xl" />
          <Shimmer className="w-6 h-6 rounded-md" />
        </div>
        <Shimmer className="h-4 w-3/4 mb-2 rounded-md" />
        <Shimmer className="h-3 w-1/2 mb-5 rounded-md" />
        <div className="border-t border-white/5 pt-3 mt-auto flex flex-col gap-2">
          <Shimmer className="h-3 w-1/3 rounded-md" />
          <Shimmer className="h-5 w-1/2 rounded-md" />
          <Shimmer className="h-9 w-full rounded-xl mt-1" />
        </div>
      </div>
    ))}
  </div>
);

const HistorySkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="grid gap-4">
    <ShimmerStyle />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Shimmer className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Shimmer className="h-4 w-40 rounded-md" />
              <Shimmer className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <div className="text-right space-y-2 shrink-0">
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-3 w-16 rounded-md ml-auto" />
          </div>
        </div>
        <Shimmer className="h-12 w-full rounded-xl" />
        <div className="flex gap-2">
          <Shimmer className="h-9 flex-1 rounded-xl" />
          <Shimmer className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

const MutasiSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="bg-[#0f0202] border border-red-900/30 rounded-2xl overflow-hidden">
    <ShimmerStyle />
    <div className="flex items-center gap-4 py-4 px-6 bg-[#140505] border-b border-red-900/30">
      {['w-24', 'w-24', 'w-20', 'w-16'].map((w, i) => (
        <Shimmer key={i} className={`h-3 ${w} rounded-md`} />
      ))}
    </div>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-4 px-6 border-b border-white/5 last:border-0">
        <Shimmer className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-48 rounded-md" />
          <Shimmer className="h-3 w-28 rounded-md" />
        </div>
        <Shimmer className="h-4 w-20 rounded-md" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

const LeaderboardSkeleton: React.FC = () => (
  <div className="divide-y divide-white/5">
    <ShimmerStyle />
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Shimmer className="w-8 h-8 rounded-full" />
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-full" />
            <Shimmer className="h-4 w-24 rounded-md" />
          </div>
        </div>
        <Shimmer className="h-4 w-20 rounded-md" />
      </div>
    ))}
  </div>
);

const ActiveOrderSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid gap-4">
    <ShimmerStyle />
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 flex gap-4 items-center">
        <Shimmer className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-32 rounded-md" />
          <Shimmer className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2 shrink-0">
          <Shimmer className="h-3 w-16 rounded-md" />
          <Shimmer className="h-8 w-20 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

// ==========================================
// PROVIDER TOGGLE COMPONENT
// ==========================================

// Logo kecil untuk provider dengan fallback emoji jika gambar gagal load
function ProviderLogo({ src, fallbackEmoji, alt }: { src: string; fallbackEmoji: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-sm leading-none">{fallbackEmoji}</span>;
  return (
    <img
      src={src}
      alt={alt}
      width={18}
      height={18}
      className="w-[18px] h-[18px] object-contain rounded-sm shrink-0"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
}

function ProviderToggle({ provider, onChange }: { provider: '5sim' | 'smsactivate'; onChange: (p: '5sim' | 'smsactivate') => void }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-1.5 w-fit">
      <button
        onClick={() => onChange('5sim')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
          provider === '5sim'
            ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
            : 'text-gray-500 hover:text-white hover:bg-white/5'
        }`}
      >
        <ProviderLogo
          src="https://logo.clearbit.com/5sim.net"
          fallbackEmoji="🔴"
          alt="5sim"
        />
        SERVER 1
      </button>
      <button
        onClick={() => onChange('smsactivate')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
          provider === 'smsactivate'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
            : 'text-gray-500 hover:text-white hover:bg-white/5'
        }`}
      >
        <ProviderLogo
          src="https://logo.clearbit.com/sms-activate.org"
          fallbackEmoji="🔵"
          alt="SMS-Activate"
        />
        SERVER 2
      </button>
    </div>
  );
}

// ==========================================
// APP-LEVEL SKELETON (saat auth loading / refresh)
// ==========================================
const AppSkeleton: React.FC = () => (
  <div className="flex h-[100dvh] overflow-hidden bg-[#040101]">
    <ShimmerStyle />
    {/* Sidebar skeleton – desktop only */}
    <aside className="hidden md:flex flex-col w-72 bg-[#070101]/95 border-r border-white/[0.05]">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <Shimmer className="w-9 h-9 rounded-xl" />
        <Shimmer className="h-5 w-32 rounded-md" />
      </div>
      {/* Balance card */}
      <div className="px-4 pt-5 pb-2">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <Shimmer className="h-3 w-20 rounded-md" />
          <Shimmer className="h-7 w-36 rounded-md" />
          <Shimmer className="h-9 w-full rounded-xl" />
        </div>
      </div>
      {/* Menu items */}
      <div className="px-3 pt-4 space-y-1">
        {/* FIX PERF: Math.random() di render bikin React re-render terus — pakai nilai statis */}
      {[72, 85, 65, 90, 78, 68, 82].map((w, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
            <Shimmer className="h-4 flex-1 rounded-md" style={{ maxWidth: `${w}%` }} />
          </div>
        ))}
      </div>
    </aside>

    {/* Main content area */}
    <main className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="hidden md:flex items-center justify-between px-10 py-5 border-b border-white/[0.05] bg-[#040101]/80 backdrop-blur-xl">
        <div className="space-y-2">
          <Shimmer className="h-3 w-28 rounded-md" />
          <Shimmer className="h-6 w-48 rounded-md" />
        </div>
        <div className="flex items-center gap-6">
          <Shimmer className="w-9 h-9 rounded-xl" />
          <div className="flex items-center gap-4 pl-8 border-l border-red-900/30">
            <Shimmer className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Shimmer className="h-4 w-24 rounded-md" />
              <Shimmer className="h-3 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 border-b border-white/[0.05] bg-[#040101]/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-30" style={{paddingTop:'calc(env(safe-area-inset-top,0px) + 12px)',paddingBottom:'12px'}}>
        <div className="flex items-center gap-3">
          <Shimmer className="w-8 h-8 rounded-xl" />
          <Shimmer className="h-5 w-28 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Shimmer className="w-8 h-8 rounded-xl" />
          <Shimmer className="w-9 h-9 rounded-full" />
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 p-4 pt-20 md:pt-8 md:p-10 pb-32 md:pb-10 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex justify-between">
                <Shimmer className="h-3 w-20 rounded-md" />
                <Shimmer className="w-8 h-8 rounded-lg" />
              </div>
              <Shimmer className="h-7 w-28 rounded-md" />
              <Shimmer className="h-3 w-16 rounded-md" />
            </div>
          ))}
        </div>
        {/* Content cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <Shimmer className="h-5 w-36 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-3/4 rounded-md" />
                  <Shimmer className="h-3 w-1/2 rounded-md" />
                </div>
                <Shimmer className="h-8 w-20 rounded-xl" />
              </div>
            ))}
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <Shimmer className="h-5 w-36 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-3/4 rounded-md" />
                  <Shimmer className="h-3 w-1/2 rounded-md" />
                </div>
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav skeleton */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#040101]/98 border-t border-white/[0.05]">
        <div className="flex items-stretch">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5">
              <Shimmer className="w-5 h-5 rounded-md" />
              <Shimmer className="h-2 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </nav>
    </main>
  </div>
);

// ==========================================
// COPY BUTTON — micro-animation checkmark
// ==========================================
function CopyButton({ value, showToast, size = 'sm', className = '' }: {
  value: string;
  showToast: (msg: string, type?: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleCopy = async () => {
    if (copied) return;
    // ✅ FIX: Guard jika value kosong/undefined (mis: order.number & order.phone keduanya null)
    if (!value) return showToast('Tidak ada teks untuk disalin.', 'error');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast('Disalin ke clipboard!', 'success');
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };
  const iconClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const padClass  = size === 'md' ? 'p-3' : 'p-2';
  return (
    <button
      onClick={handleCopy}
      className={`${padClass} rounded-lg transition-all duration-200 border shrink-0 ${
        copied
          ? 'bg-green-500/15 border-green-500/30 text-green-400'
          : 'bg-white/[0.04] hover:bg-white/10 border-white/[0.06] text-gray-500 hover:text-white'
      } ${className}`}
      title={copied ? 'Tersalin!' : 'Salin'}
    >
      {copied
        ? <Check className={`${iconClass} transition-all`} />
        : <Copy className={`${iconClass} transition-all`} />
      }
    </button>
  );
}

// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  updatePassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, collectionGroup, getDocs,
  updateDoc, increment, runTransaction, getDoc,
  query, where, orderBy, limit
} from 'firebase/firestore'; 
import { secureApiCall, clearTokenCache } from '@/lib/apiClient';

// ✅ MAINTAINABILITY: Konstanta endpoint admin terpusat — ubah path cukup di sini.
const API_ADMIN = {
  BAN_USER:          '/api/admin/ban-user',
  APPROVE_DEPOSIT:   '/api/admin/approve-deposit',
  REJECT_DEPOSIT:    '/api/admin/reject-deposit',
  TOPUP:             '/api/admin/topup',
  ANNOUNCEMENT:      '/api/admin/announcement',
  RESET_LEADERBOARD: '/api/admin/reset-leaderboard',
} as const;

// ✅ SECURITY FIX #1: Semua kredensial Firebase HARUS dari environment variable.
// Tidak ada fallback hardcoded — jika .env tidak diset, app akan gagal secara eksplisit
// daripada membocorkan kredensial ke dalam bundle produksi.
// Pastikan file .env.local kamu berisi semua variabel NEXT_PUBLIC_FIREBASE_* ini.
//
// ✅ SECURITY FIX #14: Tambahkan Content Security Policy di next.config.js:
//   headers: [{ source:'/(.*)', headers:[{
//     key:'Content-Security-Policy',
//     value:"default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; " +
//           "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com " +
//           "https://*.googleapis.com https://api.5sim.net; " +
//           "img-src 'self' data: https://api.dicebear.com https://logo.clearbit.com " +
//           "https://www.google.com https://api.iconify.design https://placehold.co; " +
//           "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
//           "font-src 'self' https://fonts.gstatic.com;"
//   }]}]
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app;
let auth = null;
let db = null;

if (typeof window !== 'undefined') {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    // ✅ SECURITY FIX #8: Jangan log detail error Firebase ke console di produksi —
    // bisa membocorkan informasi konfigurasi. Gunakan monitoring service (Sentry, dsb)
    // untuk menangkap error ini di server side.
    if (process.env.NODE_ENV === 'development') {
      console.error("Firebase init error:", error);
    }
  }
}

// --- DATA MASTER NEGARA (STATIC FALLBACK) ---
// Digunakan sebagai fallback jika API 5sim tidak bisa diakses.
// BuyNumberPage akan fetch negara secara DINAMIS dari 5sim (180+ negara).
const COUNTRIES_STATIC = [
  // Asia Tenggara
  { id: 'indonesia', name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { id: 'malaysia', name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { id: 'thailand', name: 'Thailand', code: '+66', flag: '🇹🇭' },
  { id: 'philippines', name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { id: 'vietnam', name: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { id: 'singapore', name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { id: 'myanmar', name: 'Myanmar', code: '+95', flag: '🇲🇲' },
  { id: 'cambodia', name: 'Cambodia', code: '+855', flag: '🇰🇭' },
  { id: 'laos', name: 'Laos', code: '+856', flag: '🇱🇦' },
  { id: 'brunei', name: 'Brunei', code: '+673', flag: '🇧🇳' },
  { id: 'timor_leste', name: 'Timor-Leste', code: '+670', flag: '🇹🇱' },
  // Asia Timur
  { id: 'china', name: 'China', code: '+86', flag: '🇨🇳' },
  { id: 'japan', name: 'Japan', code: '+81', flag: '🇯🇵' },
  { id: 'south_korea', name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { id: 'taiwan', name: 'Taiwan', code: '+886', flag: '🇹🇼' },
  { id: 'hongkong', name: 'Hong Kong', code: '+852', flag: '🇭🇰' },
  { id: 'mongolia', name: 'Mongolia', code: '+976', flag: '🇲🇳' },
  // Asia Selatan
  { id: 'india', name: 'India', code: '+91', flag: '🇮🇳' },
  { id: 'pakistan', name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { id: 'bangladesh', name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { id: 'srilanka', name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { id: 'nepal', name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { id: 'bhutan', name: 'Bhutan', code: '+975', flag: '🇧🇹' },
  { id: 'maldives', name: 'Maldives', code: '+960', flag: '🇲🇻' },
  // Asia Tengah
  { id: 'kazakhstan', name: 'Kazakhstan', code: '+7', flag: '🇰🇿' },
  { id: 'uzbekistan', name: 'Uzbekistan', code: '+998', flag: '🇺🇿' },
  { id: 'kyrgyzstan', name: 'Kyrgyzstan', code: '+996', flag: '🇰🇬' },
  { id: 'tajikistan', name: 'Tajikistan', code: '+992', flag: '🇹🇯' },
  { id: 'turkmenistan', name: 'Turkmenistan', code: '+993', flag: '🇹🇲' },
  { id: 'azerbaijan', name: 'Azerbaijan', code: '+994', flag: '🇦🇿' },
  { id: 'armenia', name: 'Armenia', code: '+374', flag: '🇦🇲' },
  { id: 'georgia', name: 'Georgia', code: '+995', flag: '🇬🇪' },
  // Asia Barat / Timur Tengah
  { id: 'saudi_arabia', name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { id: 'uae', name: 'UAE', code: '+971', flag: '🇦🇪' },
  { id: 'turkey', name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { id: 'israel', name: 'Israel', code: '+972', flag: '🇮🇱' },
  { id: 'qatar', name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { id: 'iran', name: 'Iran', code: '+98', flag: '🇮🇷' },
  { id: 'iraq', name: 'Iraq', code: '+964', flag: '🇮🇶' },
  { id: 'jordan', name: 'Jordan', code: '+962', flag: '🇯🇴' },
  { id: 'lebanon', name: 'Lebanon', code: '+961', flag: '🇱🇧' },
  { id: 'kuwait', name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { id: 'bahrain', name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { id: 'oman', name: 'Oman', code: '+968', flag: '🇴🇲' },
  { id: 'yemen', name: 'Yemen', code: '+967', flag: '🇾🇪' },
  { id: 'palestine', name: 'Palestine', code: '+970', flag: '🇵🇸' },
  { id: 'syria', name: 'Syria', code: '+963', flag: '🇸🇾' },
  { id: 'afghanistan', name: 'Afghanistan', code: '+93', flag: '🇦🇫' },
  // Eropa Barat
  { id: 'england', name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { id: 'germany', name: 'Germany', code: '+49', flag: '🇩🇪' },
  { id: 'france', name: 'France', code: '+33', flag: '🇫🇷' },
  { id: 'italy', name: 'Italy', code: '+39', flag: '🇮🇹' },
  { id: 'spain', name: 'Spain', code: '+34', flag: '🇪🇸' },
  { id: 'netherlands', name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { id: 'belgium', name: 'Belgium', code: '+32', flag: '🇧🇪' },
  { id: 'switzerland', name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { id: 'austria', name: 'Austria', code: '+43', flag: '🇦🇹' },
  { id: 'portugal', name: 'Portugal', code: '+351', flag: '🇵🇹' },
  { id: 'ireland', name: 'Ireland', code: '+353', flag: '🇮🇪' },
  { id: 'luxembourg', name: 'Luxembourg', code: '+352', flag: '🇱🇺' },
  // Eropa Utara
  { id: 'sweden', name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { id: 'norway', name: 'Norway', code: '+47', flag: '🇳🇴' },
  { id: 'finland', name: 'Finland', code: '+358', flag: '🇫🇮' },
  { id: 'denmark', name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { id: 'estonia', name: 'Estonia', code: '+372', flag: '🇪🇪' },
  { id: 'latvia', name: 'Latvia', code: '+371', flag: '🇱🇻' },
  { id: 'lithuania', name: 'Lithuania', code: '+370', flag: '🇱🇹' },
  // Eropa Timur
  { id: 'russia', name: 'Russia', code: '+7', flag: '🇷🇺' },
  { id: 'ukraine', name: 'Ukraine', code: '+380', flag: '🇺🇦' },
  { id: 'poland', name: 'Poland', code: '+48', flag: '🇵🇱' },
  { id: 'czech', name: 'Czech Republic', code: '+420', flag: '🇨🇿' },
  { id: 'romania', name: 'Romania', code: '+40', flag: '🇷🇴' },
  { id: 'hungary', name: 'Hungary', code: '+36', flag: '🇭🇺' },
  { id: 'belarus', name: 'Belarus', code: '+375', flag: '🇧🇾' },
  { id: 'bulgaria', name: 'Bulgaria', code: '+359', flag: '🇧🇬' },
  { id: 'slovakia', name: 'Slovakia', code: '+421', flag: '🇸🇰' },
  { id: 'moldova', name: 'Moldova', code: '+373', flag: '🇲🇩' },
  // Eropa Selatan & Balkan
  { id: 'greece', name: 'Greece', code: '+30', flag: '🇬🇷' },
  { id: 'croatia', name: 'Croatia', code: '+385', flag: '🇭🇷' },
  { id: 'serbia', name: 'Serbia', code: '+381', flag: '🇷🇸' },
  { id: 'slovenia', name: 'Slovenia', code: '+386', flag: '🇸🇮' },
  { id: 'albania', name: 'Albania', code: '+355', flag: '🇦🇱' },
  { id: 'north_macedonia', name: 'North Macedonia', code: '+389', flag: '🇲🇰' },
  { id: 'bosnia', name: 'Bosnia & Herzegovina', code: '+387', flag: '🇧🇦' },
  { id: 'montenegro', name: 'Montenegro', code: '+382', flag: '🇲🇪' },
  { id: 'kosovo', name: 'Kosovo', code: '+383', flag: '🇽🇰' },
  { id: 'cyprus', name: 'Cyprus', code: '+357', flag: '🇨🇾' },
  { id: 'malta', name: 'Malta', code: '+356', flag: '🇲🇹' },
  // Amerika Utara
  { id: 'usa', name: 'United States', code: '+1', flag: '🇺🇸' },
  { id: 'canada', name: 'Canada', code: '+1', flag: '🇨🇦' },
  { id: 'mexico', name: 'Mexico', code: '+52', flag: '🇲🇽' },
  // Amerika Tengah & Karibia
  { id: 'guatemala', name: 'Guatemala', code: '+502', flag: '🇬🇹' },
  { id: 'honduras', name: 'Honduras', code: '+504', flag: '🇭🇳' },
  { id: 'el_salvador', name: 'El Salvador', code: '+503', flag: '🇸🇻' },
  { id: 'nicaragua', name: 'Nicaragua', code: '+505', flag: '🇳🇮' },
  { id: 'costa_rica', name: 'Costa Rica', code: '+506', flag: '🇨🇷' },
  { id: 'panama', name: 'Panama', code: '+507', flag: '🇵🇦' },
  { id: 'cuba', name: 'Cuba', code: '+53', flag: '🇨🇺' },
  { id: 'dominican_republic', name: 'Dominican Republic', code: '+1', flag: '🇩🇴' },
  { id: 'haiti', name: 'Haiti', code: '+509', flag: '🇭🇹' },
  { id: 'jamaica', name: 'Jamaica', code: '+1', flag: '🇯🇲' },
  { id: 'trinidad_tobago', name: 'Trinidad & Tobago', code: '+1', flag: '🇹🇹' },
  // Amerika Selatan
  { id: 'brazil', name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { id: 'argentina', name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { id: 'colombia', name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { id: 'peru', name: 'Peru', code: '+51', flag: '🇵🇪' },
  { id: 'chile', name: 'Chile', code: '+56', flag: '🇨🇱' },
  { id: 'venezuela', name: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { id: 'ecuador', name: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { id: 'bolivia', name: 'Bolivia', code: '+591', flag: '🇧🇴' },
  { id: 'paraguay', name: 'Paraguay', code: '+595', flag: '🇵🇾' },
  { id: 'uruguay', name: 'Uruguay', code: '+598', flag: '🇺🇾' },
  { id: 'guyana', name: 'Guyana', code: '+592', flag: '🇬🇾' },
  { id: 'suriname', name: 'Suriname', code: '+597', flag: '🇸🇷' },
  // Afrika Utara
  { id: 'egypt', name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { id: 'morocco', name: 'Morocco', code: '+212', flag: '🇲🇦' },
  { id: 'algeria', name: 'Algeria', code: '+213', flag: '🇩🇿' },
  { id: 'tunisia', name: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { id: 'libya', name: 'Libya', code: '+218', flag: '🇱🇾' },
  { id: 'sudan', name: 'Sudan', code: '+249', flag: '🇸🇩' },
  // Afrika Barat
  { id: 'nigeria', name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { id: 'ghana', name: 'Ghana', code: '+233', flag: '🇬🇭' },
  { id: 'senegal', name: 'Senegal', code: '+221', flag: '🇸🇳' },
  { id: 'ivory_coast', name: 'Ivory Coast', code: '+225', flag: '🇨🇮' },
  { id: 'mali', name: 'Mali', code: '+223', flag: '🇲🇱' },
  { id: 'guinea', name: 'Guinea', code: '+224', flag: '🇬🇳' },
  { id: 'cameroon', name: 'Cameroon', code: '+237', flag: '🇨🇲' },
  { id: 'burkina_faso', name: 'Burkina Faso', code: '+226', flag: '🇧🇫' },
  { id: 'benin', name: 'Benin', code: '+229', flag: '🇧🇯' },
  { id: 'togo', name: 'Togo', code: '+228', flag: '🇹🇬' },
  { id: 'niger', name: 'Niger', code: '+227', flag: '🇳🇪' },
  { id: 'sierra_leone', name: 'Sierra Leone', code: '+232', flag: '🇸🇱' },
  { id: 'gambia', name: 'Gambia', code: '+220', flag: '🇬🇲' },
  { id: 'guinea_bissau', name: 'Guinea-Bissau', code: '+245', flag: '🇬🇼' },
  { id: 'cape_verde', name: 'Cape Verde', code: '+238', flag: '🇨🇻' },
  { id: 'liberia', name: 'Liberia', code: '+231', flag: '🇱🇷' },
  { id: 'mauritania', name: 'Mauritania', code: '+222', flag: '🇲🇷' },
  // Afrika Timur
  { id: 'kenya', name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { id: 'ethiopia', name: 'Ethiopia', code: '+251', flag: '🇪🇹' },
  { id: 'tanzania', name: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { id: 'uganda', name: 'Uganda', code: '+256', flag: '🇺🇬' },
  { id: 'rwanda', name: 'Rwanda', code: '+250', flag: '🇷🇼' },
  { id: 'somalia', name: 'Somalia', code: '+252', flag: '🇸🇴' },
  { id: 'djibouti', name: 'Djibouti', code: '+253', flag: '🇩🇯' },
  { id: 'eritrea', name: 'Eritrea', code: '+291', flag: '🇪🇷' },
  { id: 'south_sudan', name: 'South Sudan', code: '+211', flag: '🇸🇸' },
  { id: 'madagascar', name: 'Madagascar', code: '+261', flag: '🇲🇬' },
  { id: 'mauritius', name: 'Mauritius', code: '+230', flag: '🇲🇺' },
  { id: 'comoros', name: 'Comoros', code: '+269', flag: '🇰🇲' },
  // Afrika Tengah
  { id: 'democratic_republic_congo', name: 'DR Congo', code: '+243', flag: '🇨🇩' },
  { id: 'gabon', name: 'Gabon', code: '+241', flag: '🇬🇦' },
  { id: 'chad', name: 'Chad', code: '+235', flag: '🇹🇩' },
  { id: 'central_african_republic', name: 'Central African Republic', code: '+236', flag: '🇨🇫' },
  { id: 'equatorial_guinea', name: 'Equatorial Guinea', code: '+240', flag: '🇬🇶' },
  { id: 'burundi', name: 'Burundi', code: '+257', flag: '🇧🇮' },
  // Afrika Selatan
  { id: 'south_africa', name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { id: 'zimbabwe', name: 'Zimbabwe', code: '+263', flag: '🇿🇼' },
  { id: 'zambia', name: 'Zambia', code: '+260', flag: '🇿🇲' },
  { id: 'mozambique', name: 'Mozambique', code: '+258', flag: '🇲🇿' },
  { id: 'angola', name: 'Angola', code: '+244', flag: '🇦🇴' },
  { id: 'namibia', name: 'Namibia', code: '+264', flag: '🇳🇦' },
  { id: 'botswana', name: 'Botswana', code: '+267', flag: '🇧🇼' },
  { id: 'malawi', name: 'Malawi', code: '+265', flag: '🇲🇼' },
  { id: 'lesotho', name: 'Lesotho', code: '+266', flag: '🇱🇸' },
  { id: 'swaziland', name: 'Eswatini', code: '+268', flag: '🇸🇿' },
  // Oseania
  { id: 'australia', name: 'Australia', code: '+61', flag: '🇦🇺' },
  { id: 'new_zealand', name: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { id: 'papua_new_guinea', name: 'Papua New Guinea', code: '+675', flag: '🇵🇬' },
  { id: 'fiji', name: 'Fiji', code: '+679', flag: '🇫🇯' },
  { id: 'vanuatu', name: 'Vanuatu', code: '+678', flag: '🇻🇺' },
];

// Lookup cepat id → metadata negara
const COUNTRY_META: Record<string, { name: string; flag: string; code: string }> = {};
COUNTRIES_STATIC.forEach(c => { COUNTRY_META[c.id] = { name: c.name, flag: c.flag, code: c.code }; });

// Fungsi helper: dapatkan tampilan negara (nama + flag) untuk id apapun
// Menerima opsional daftar negara dinamis (untuk SMS-Activate yang pakai numeric ID)
const getCountryDisplay = (countryId: string, dynamicCountries?: Array<{id: any; name: string; flag?: string}>) => {
  // Cek di COUNTRY_META dulu (5sim)
  if (COUNTRY_META[countryId]) return COUNTRY_META[countryId];
  // Cek di dynamicCountries (SMS-Activate)
  if (dynamicCountries) {
    const found = dynamicCountries.find(c => String(c.id) === String(countryId));
    if (found) return { name: found.name, flag: found.flag || '🌐', code: '' };
  }
  return {
    name: countryId.split('_').map((w:string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    flag: '🌐',
    code: '',
  };
};

// COUNTRIES tetap untuk backward compat di luar BuyNumberPage
const COUNTRIES = COUNTRIES_STATIC;

const mapCountryTo5Sim = (countryId) => {
  const map = {
    'indonesia': 'indonesia', 'russia': 'russia', 'usa': 'usa', 'england': 'england',
    'malaysia': 'malaysia', 'thailand': 'thailand', 'philippines': 'philippines', 'vietnam': 'vietnam',
    'brazil': 'brazil', 'india': 'india', 'turkey': 'turkey', 'argentina': 'argentina',
    'china': 'china', 'germany': 'germany', 'france': 'france', 'canada': 'canada',
    'japan': 'japan', 'south_korea': 'south_korea', 'south_africa': 'south_africa', 'nigeria': 'nigeria',
    'colombia': 'colombia', 'egypt': 'egypt', 'pakistan': 'pakistan', 'bangladesh': 'bangladesh',
    'saudi_arabia': 'saudi_arabia', 'italy': 'italy', 'spain': 'spain', 'mexico': 'mexico',
    'australia': 'australia', 'netherlands': 'netherlands'
  };
  return map[countryId] || countryId;
};

// Mapping country name/id kita → numeric ID SMS-Activate
const mapCountryToSmsActivate = (countryId: string): number => {
  const map: Record<string, number> = {
    'indonesia': 6,    'russia': 0,     'usa': 187,       'england': 16,
    'malaysia': 62,    'thailand': 52,  'philippines': 63, 'vietnam': 10,
    'brazil': 73,      'india': 22,     'turkey': 62,      'argentina': 32,
    'china': 1,        'germany': 43,   'france': 78,      'canada': 36,
    'japan': 69,       'south_korea': 75, 'south_africa': 40, 'nigeria': 39,
    'colombia': 55,    'egypt': 31,     'pakistan': 92,    'bangladesh': 36,
    'saudi_arabia': 26,'italy': 86,     'spain': 85,       'mexico': 54,
    'australia': 61,   'netherlands': 88,
  };
  const asNum = Number(countryId);
  if (!isNaN(asNum)) return asNum;
  return map[countryId] ?? 6;
};

// ✅ FIX BUG #1: Mapping serviceId kita → nama service di API 5sim
// Tanpa ini, banyak produk tampil "Stok Habis" padahal stoknya ada
const mapServiceTo5Sim = (serviceId) => {
  const map = {
    // Sosial Media
    'twitter':        'twitterx',       // 5sim pakai 'twitterx' bukan 'twitter'
    'vkontakte':      'vk',             // 5sim pakai 'vk'
    'ok':             'odnoklassniki',  // 5sim pakai 'odnoklassniki'
    'wechat':         'wechat',
    'kakaotalk':      'kakaotalk',
    'line':           'line',
    'viber':          'viber',
    'snapchat':       'snapchat',
    'linkedin':       'linkedin',
    'pinterest':      'pinterest',
    'reddit':         'reddit',
    'tumblr':         'tumblr',
    'quora':          'quora',
    'twitch':         'twitch',
    // Tech
    'google':         'google',
    'apple':          'apple',
    'microsoft':      'microsoft',
    'openai':         'openai',
    'claude':         'anthropic',
    'github':         'github',
    'amazon':         'amazon',
    'mailru':         'mailru',
    'yandex':         'yandex',
    'protonmail':     'protonmail',
    'naver':          'naver',
    'yahoo':          'yahoo',
    'azure':          'azure',
    'aws':            'amazon',
    // E-Commerce
    'shopee':         'shopee',
    'gojek':          'gojek',
    'grab':           'grab',
    'tokopedia':      'tokopedia',
    'lazada':         'lazada',
    'alibaba':        'alibaba',
    'taobao':         'taobao',
    'ebay':           'ebay',
    'uber':           'uber',
    'foodpanda':      'foodpanda',
    'doordash':       'doordash',
    'ubereats':       'ubereats',
    'grubhub':        'grubhub',
    'shein':          'shein',
    'ozon':           'ozon',
    'wildberries':    'wildberries',
    // Hiburan & Game
    'netflix':        'netflix',
    'spotify':        'spotify',
    'steam':          'steam',
    'blizzard':       'blizzard',
    'playstation':    'playstation',
    'nintendo':       'nintendo',
    'roblox':         'roblox',
    'faceit':         'faceit',
    'ea':             'ea',
    'ubisoft':        'ubisoft',
    // Dating
    'tinder':         'tinder',
    'bumble':         'bumble',
    'badoo':          'badoo',
    'pof':            'pof',
    'grindr':         'grindr',
    'match':          'match',
    'okcupid':        'okcupid',
    'hinge':          'hinge',
    // Finance
    'paypal':         'paypal',
    'binance':        'binance',
    'coinbase':       'coinbase',
    'kucoin':         'kucoin',
    'bybit':          'bybit',
    'payoneer':       'payoneer',
    'revolut':        'revolut',
    'monzo':          'monzo',
    'transferwise':   'wise',
    'skrill':         'skrill',
    'neteller':       'neteller',
    'webmoney':       'webmoney',
    'payeer':         'payeer',
    'crypto':         'crypto',
    'kraken':         'kraken',
    'huobi':          'huobi',
    'okx':            'okx',
    // Streaming
    'disneyplus':     'disneyplus',
    'hbo':            'hbo',
    'hulu':           'hulu',
    'paramount':      'paramount',
    'amazon_video':   'amazon',
    'deezer':         'deezer',
    'crunchyroll':    'crunchyroll',
    'xbox':           'xbox',
    'epicgames':      'epicgames',
    'supercell':      'supercell',
    'garena':         'garena',
    // Produktivitas
    'zoom':           'zoom',
    'slack':          'slack',
    'dropbox':        'dropbox',
    'stripe':         'stripe',
    'airbnb':         'airbnb',
    'lyft':           'lyft',
    'bolt':           'bolt',
    // Fintech Lokal
    'ovo':            'ovo',
    'gopay':          'gojek',
    'dana_app':       'dana',
    'linkaja':        'linkaja',
    'truemoney':      'truemoney',
    'gcash':          'gcash',
    'paymaya':        'paymaya',
    'momo':           'momo',
    // Finance tambahan
    'gate':           'gate',
    'bitget':         'bitget',
    'bingx':          'bingx',
    'mexc':           'mexc',
    // Tambahan baru
    'alipay':         'alipay',
    'baidu':          'baidu',
    'youtube':        'youtube',
    'bukalapak':      'bukalapak',
    'bilibili':       'bilibili',
    'meituan':        'meituan',
    'jd':             'jd',
    'pinduoduo':      'pinduoduo',
    'xiaohongshu':    'xiaohongshu',
    'douyin':         'douyin',
    'kwai':           'kwai',
    'kuaishou':       'kuaishou',
    'capcut':         'capcut',
    'neteller':       'neteller',
    'perfectmoney':   'perfectmoney',
    'payeer':         'payeer',
  };
  return map[serviceId] || serviceId;
};

// Reverse map: nama 5sim → serviceId kita (untuk lookup di liveStocks)
// PENTING: Hanya perlu entry yang BERBEDA antara nama 5sim dan id kita.
// Semua mapping lain (google→google, paypal→paypal, dst) otomatis pakai fallback (simKey → simKey)
const mapServiceFrom5Sim = (() => {
  const forward = {
    'twitterx':       'twitter',
    'vk':             'vkontakte',
    'odnoklassniki':  'ok',
    'anthropic':      'claude',
    'wise':           'transferwise',
    'cryptocom':      'cryptocom',
    'crypto.com':     'cryptocom',
  };
  return (simKey) => forward[simKey] || simKey;
})();

// Mapping service code SMS-Activate → service ID kita
const mapServiceFromSmsActivate = (() => {
  const map: Record<string, string> = {
    // Sosial Media
    'wa':   'whatsapp',   'tg':   'telegram',   'ig':   'instagram',
    'fb':   'facebook',   'tt':   'tiktok',      'tw':   'twitter',
    'ds':   'discord',    'ln':   'line',        'wc':   'wechat',
    'vb':   'viber',      'kk':   'kakaotalk',   'sc':   'snapchat',
    'vk':   'vkontakte',  'ok':   'ok',          'li':   'linkedin',
    'pt':   'pinterest',  'rd':   'reddit',      'yt':   'youtube',
    'tm':   'tumblr',     'tw2':  'twitch',      'qr':   'quora',
    'tc':   'twitch',     'ti':   'tiktok',      'wx':   'wechat',
    'kl':   'kakaotalk',  'kt':   'kakaotalk',   'za':   'zalo',
    // Tech & Akun
    'go':   'google',     'ap':   'apple',       'ms':   'microsoft',
    'am':   'amazon',     'oi':   'openai',      'cl':   'claude',      'gh':   'github',
    'zi':   'zoom',       'ya':   'yahoo',       'ml':   'mailru',
    'yd':   'yandex',     'pm':   'protonmail',  'nv':   'naver',
    'sl':   'slack',      'db':   'dropbox',
    'gp':   'google',     'gq':   'google',      'go2':  'google',
    'cp':   'capcut',
    // E-Commerce & Transportasi
    'ub':   'uber',       'gg':   'grab',        'sh':   'shopee',
    'tk':   'tokopedia',  'bk':   'bukalapak',   'gj':   'gojek',
    'lz':   'lazada',     'al':   'alibaba',     'tb':   'taobao',
    'eb':   'ebay',       'oz':   'ozon',        'wb':   'wildberries',
    'fp':   'foodpanda',  'dd':   'doordash',    'ue':   'ubereats',
    'ali':  'alipay',     'aq':   'alipay',      'jd':   'jd',
    'jx':   'jd',         'pdd':  'pinduoduo',   'mtt':  'meituan',
    'xhs':  'xiaohongshu','dy':   'douyin',      'kwai': 'kwai',
    'kss':  'kuaishou',   'blbl': 'bilibili',
    'gx':   'grab',       'mo':   'movistar',    'nz':   'newzealand',
    'lc':   'line',       'bw':   'bandwidth',   'zr':   'zara',
    'us':   'usnumber',   'df':   'doordash',    'dl':   'dailyhunt',
    // Finance & Crypto
    'pa':   'paypal',     'cb':   'coinbase',
    // ⚠️  TODO: Cari kode SA yang benar untuk Binance.
    //     Cara cek: lihat response /api/smsactivate/live-stock, cari entry dengan name='Binance'
    //     atau cari di dokumentasi API provider. Setelah tahu kodenya, tambahkan di sini:
    //     'KODE_BINANCE': 'binance',
    'kc':   'kucoin',     'bb':   'bybit',       'py':   'payoneer',
    'rv':   'revolut',    'sk':   'skrill',      'kr':   'kraken',
    'hu':   'huobi',      'ox':   'okx',         'mx':   'mexc',
    'gt':   'gate',       'bg':   'bitget',      'bx':   'bingx',
    'oj':   'ovo',        'da':   'dana',        'bca':  'bca',
    'ne':   'neteller',   'pfm':  'perfectmoney','pe':   'payeer',
    'ts':   'tokocrypto', 'fz':   'fazz',
    // Hiburan & Game
    'nf':   'netflix',    'sp':   'spotify',     'st':   'steam',
    'td':   'tinder',     'bl':   'bumble',      'bd':   'badoo',
    'ps':   'playstation','nt':   'nintendo',    'rb':   'roblox',
    'ea':   'ea',         'ub2':  'ubisoft',     'hi':   'hinge',
    'gd':   'grindr',     'mc':   'match',       'oc':   'okcupid',
    'gr':   'garena',     'ep':   'epicgames',
    // Streaming & Lainnya
    'dp':   'disneyplus', 'hb':   'hbo',         'xb':   'xbox',
    'ep':   'epicgames',  'ab':   'airbnb',      'sr':   'stripe',
    // Fintech Lokal
    'mm':   'momo',       'gp2':  'gopay',
    // Layanan Indonesia lokal (Alfagift dll)
    // ⚠️  VERIFIKASI kode SA aktual dari API SMS-Activate untuk negara Indonesia
    //     Jika 'ag' bukan kode Alfagift yang benar, ganti sesuai response API.
    'ag':   'alfagift',   'agft': 'alfagift',  'bn': 'alfagift',  // 'bn' di SA = Alfagift (bukan Binance!)
    // Kode SA yang tidak dikenal — tampil apa adanya
    'xx':   'anyservice',
  };
  return (saKey: string) => map[saKey.toLowerCase()] || saKey;
})();

// --- DATA MASTER LAYANAN ---
const SERVICES = [
  // Sosial Media & Chat
  { id: 'whatsapp', name: 'WhatsApp', image: 'https://api.iconify.design/logos:whatsapp-icon.svg', icon: '💬', color: 'bg-green-500/20 text-green-400', category: 'social' },
  { id: 'telegram', name: 'Telegram', image: 'https://api.iconify.design/logos:telegram.svg', icon: '✈️', color: 'bg-blue-500/20 text-blue-400', category: 'social' },
  { id: 'instagram', name: 'Instagram', image: 'https://api.iconify.design/skill-icons:instagram.svg', icon: '📸', color: 'bg-pink-500/20 text-pink-400', category: 'social' },
  { id: 'facebook', name: 'Facebook', image: 'https://api.iconify.design/logos:facebook.svg', icon: '📘', color: 'bg-blue-600/20 text-blue-500', category: 'social' },
  { id: 'tiktok', name: 'TikTok', image: 'https://api.iconify.design/logos:tiktok-icon.svg', icon: '🎵', color: 'bg-gray-800 text-white border border-gray-700', category: 'social' },
  { id: 'twitter', name: 'Twitter / X', image: 'https://api.iconify.design/simple-icons:x.svg?color=white', icon: '🐦', color: 'bg-blue-400/20 text-blue-400', category: 'social' },
  { id: 'discord', name: 'Discord', image: 'https://api.iconify.design/logos:discord-icon.svg', icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
  { id: 'line', name: 'LINE', image: 'https://api.iconify.design/logos:line.svg', icon: '💬', color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'wechat', name: 'WeChat', image: 'https://api.iconify.design/uiw:wechat.svg?color=%2307C160', icon: '💬', color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'viber', name: 'Viber', image: 'https://api.iconify.design/fa-brands:viber.svg?color=%23665CAC', icon: '📞', color: 'bg-purple-500/20 text-purple-500', category: 'social' },
  { id: 'kakaotalk', name: 'KakaoTalk', image: 'https://api.iconify.design/ri:kakao-talk-fill.svg?color=%23FEE500', icon: '💬', color: 'bg-yellow-500/20 text-yellow-500', category: 'social' },
  { id: 'snapchat', name: 'Snapchat', image: 'https://api.iconify.design/fa-brands:snapchat-ghost.svg?color=%23FFFC00', icon: '👻', color: 'bg-yellow-400/20 text-yellow-400', category: 'social' },
  { id: 'vkontakte', name: 'VKontakte (VK)', image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  { id: 'ok', name: 'Odnoklassniki (OK)', image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  { id: 'linkedin', name: 'LinkedIn', image: 'https://api.iconify.design/logos:linkedin-icon.svg', icon: '💼', color: 'bg-blue-700/20 text-blue-600', category: 'social' },
  { id: 'pinterest', name: 'Pinterest', image: 'https://api.iconify.design/logos:pinterest.svg', icon: '📌', color: 'bg-red-600/20 text-red-600', category: 'social' },
  { id: 'reddit', name: 'Reddit', image: 'https://api.iconify.design/logos:reddit-icon.svg', icon: '🤖', color: 'bg-orange-600/20 text-orange-500', category: 'social' },
  { id: 'tumblr', name: 'Tumblr', image: 'https://api.iconify.design/logos:tumblr-icon.svg', icon: 'T', color: 'bg-indigo-800/20 text-indigo-700', category: 'social' },
  { id: 'quora', name: 'Quora', image: 'https://api.iconify.design/simple-icons:quora.svg?color=%23B92B27', icon: 'Q', color: 'bg-red-800/20 text-red-700', category: 'social' },
  { id: 'twitch', name: 'Twitch', image: 'https://api.iconify.design/logos:twitch.svg', icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'social' },
  { id: 'youtube', name: 'YouTube', image: 'https://api.iconify.design/logos:youtube-icon.svg', icon: '▶️', color: 'bg-red-600/20 text-red-500', category: 'social' },
  { id: 'bilibili', name: 'Bilibili', image: 'https://api.iconify.design/simple-icons:bilibili.svg?color=%2300A1D6', icon: '📺', color: 'bg-cyan-500/20 text-cyan-400', category: 'social' },
  { id: 'kwai', name: 'Kwai', image: 'https://api.iconify.design/simple-icons:kwai.svg?color=%23FFCC00', icon: '🎬', color: 'bg-yellow-500/20 text-yellow-400', category: 'social' },
  { id: 'douyin', name: 'Douyin (TikTok CN)', image: 'https://api.iconify.design/logos:tiktok-icon.svg', icon: '🎵', color: 'bg-gray-800 text-white border border-gray-700', category: 'social' },
  { id: 'xiaohongshu', name: 'Xiaohongshu (RED)', image: 'https://api.iconify.design/simple-icons:xiaohongshu.svg?color=%23FF2442', icon: '📕', color: 'bg-red-500/20 text-red-400', category: 'social' },
  { id: 'kuaishou', name: 'Kuaishou', image: 'https://api.iconify.design/simple-icons:kuaishou.svg?color=%23FF4906', icon: '🎥', color: 'bg-orange-500/20 text-orange-400', category: 'social' },
  
  // Tech & Akun Utama
  { id: 'google', name: 'Google / Gmail', image: 'https://api.iconify.design/logos:google-icon.svg', icon: '✉️', color: 'bg-red-500/20 text-red-400', category: 'tech' },
  { id: 'apple', name: 'Apple ID', image: 'https://api.iconify.design/mdi:apple.svg?color=white', icon: '🍎', color: 'bg-gray-500/20 text-gray-400', category: 'tech' },
  { id: 'microsoft', name: 'Microsoft / Outlook', image: 'https://api.iconify.design/logos:microsoft-icon.svg', icon: '🪟', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'yahoo', name: 'Yahoo', image: 'https://api.iconify.design/logos:yahoo.svg', icon: 'Y!', color: 'bg-purple-500/20 text-purple-500', category: 'tech' },
  { id: 'openai', name: 'ChatGPT / OpenAI', image: 'https://api.iconify.design/simple-icons:openai.svg?color=white', icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  { id: 'claude', name: 'Claude / Anthropic', image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65', icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'github', name: 'GitHub', image: 'https://api.iconify.design/mdi:github.svg?color=white', icon: '💻', color: 'bg-gray-700/50 text-white', category: 'tech' },
  { id: 'amazon', name: 'Amazon Web Services', image: 'https://api.iconify.design/ri:amazon-fill.svg?color=%23FF9900', icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'mailru', name: 'Mail.ru', image: 'https://api.iconify.design/simple-icons:maildotru.svg?color=%23168DE2', icon: '@', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  { id: 'yandex', name: 'Yandex', image: 'https://api.iconify.design/logos:yandex-ru.svg', icon: 'Y', color: 'bg-red-600/20 text-red-500', category: 'tech' },
  { id: 'protonmail', name: 'ProtonMail', image: 'https://api.iconify.design/logos:protonmail.svg', icon: '🔒', color: 'bg-purple-700/20 text-purple-600', category: 'tech' },
  { id: 'naver', name: 'Naver', image: 'https://api.iconify.design/simple-icons:naver.svg?color=%2303C75A', icon: 'N', color: 'bg-green-600/20 text-green-500', category: 'tech' },
  { id: 'baidu', name: 'Baidu', image: 'https://api.iconify.design/simple-icons:baidu.svg?color=%232932E1', icon: '🔍', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  { id: 'capcut', name: 'CapCut', image: 'https://api.iconify.design/simple-icons:capcut.svg?color=white', icon: '✂️', color: 'bg-gray-800 text-white', category: 'tech' },
  { id: 'aws', name: 'AWS (Amazon)', image: 'https://api.iconify.design/logos:aws.svg', icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  { id: 'azure', name: 'Microsoft Azure', image: 'https://api.iconify.design/logos:microsoft-azure.svg', icon: '☁️', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'linode', name: 'Linode / Akamai', image: 'https://api.iconify.design/logos:linode.svg', icon: '☁️', color: 'bg-green-500/20 text-green-400', category: 'tech' },
  { id: 'vultr', name: 'Vultr', image: 'https://api.iconify.design/simple-icons:vultr.svg?color=%23007BFC', icon: '☁️', color: 'bg-blue-600/20 text-blue-500', category: 'tech' },
  
  // E-Commerce & Transportasi
  { id: 'shopee', name: 'Shopee', image: 'https://api.iconify.design/simple-icons:shopee.svg?color=white', icon: '🛍️', color: 'bg-orange-500 text-white', category: 'ecommerce' },
  { id: 'alipay', name: 'Alipay / Alibaba / 1688', image: 'https://api.iconify.design/simple-icons:alipay.svg?color=%231677FF', icon: '💙', color: 'bg-blue-500/20 text-blue-400', category: 'ecommerce' },
  { id: 'bukalapak', name: 'Bukalapak', image: 'https://api.iconify.design/simple-icons:bukalapak.svg?color=%23E11F26', icon: '🛒', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'alfagift', name: 'Alfagift', image: 'https://logo.clearbit.com/alfagift.id', icon: '🏪', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'jd', name: 'JD.com', image: 'https://api.iconify.design/simple-icons:jd.svg?color=%23E1251B', icon: '📦', color: 'bg-red-500/20 text-red-400', category: 'ecommerce' },
  { id: 'pinduoduo', name: 'Pinduoduo / Temu', image: 'https://api.iconify.design/simple-icons:pinduoduo.svg?color=%23E02020', icon: '🛒', color: 'bg-red-600/20 text-red-500', category: 'ecommerce' },
  { id: 'meituan', name: 'Meituan', image: 'https://api.iconify.design/simple-icons:meituan.svg?color=%23FFD100', icon: '🚴', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  { id: 'gojek', name: 'Gojek', image: 'https://api.iconify.design/simple-icons:gojek.svg?color=white', icon: '🏍️', color: 'bg-green-600 text-white', category: 'ecommerce' },
  { id: 'grab', name: 'Grab', image: 'https://api.iconify.design/simple-icons:grab.svg?color=%2300B14F', icon: '🚗', color: 'bg-green-400/20 text-green-400', category: 'ecommerce' },
  { id: 'tokopedia', name: 'Tokopedia', image: 'https://api.iconify.design/tabler:shopping-bag.svg?color=%2342B549', icon: '🦉', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  { id: 'lazada', name: 'Lazada', image: 'https://api.iconify.design/simple-icons:lazada.svg?color=%23F53C80', icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  { id: 'alibaba', name: 'Alibaba / AliExpress', image: 'https://api.iconify.design/simple-icons:alibaba.svg?color=%23FF6A00', icon: '📦', color: 'bg-orange-600/20 text-orange-500', category: 'ecommerce' },
  { id: 'taobao', name: 'Taobao', image: 'https://api.iconify.design/simple-icons:taobao.svg?color=%23FF5000', icon: '🛒', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  { id: 'ebay', name: 'eBay', image: 'https://api.iconify.design/logos:ebay.svg', icon: '🛒', color: 'bg-blue-500/20 text-blue-500', category: 'ecommerce' },
  { id: 'uber', name: 'Uber', image: 'https://api.iconify.design/fa-brands:uber.svg?color=white', icon: '🚕', color: 'bg-gray-800 text-white', category: 'ecommerce' },
  { id: 'foodpanda', name: 'Foodpanda', image: 'https://api.iconify.design/simple-icons:foodpanda.svg?color=%23D70F64', icon: '🐼', color: 'bg-pink-600/20 text-pink-500', category: 'ecommerce' },
  { id: 'deliveroo', name: 'Deliveroo', image: 'https://api.iconify.design/simple-icons:deliveroo.svg?color=%2300CCBC', icon: '🚲', color: 'bg-teal-500/20 text-teal-400', category: 'ecommerce' },
  { id: 'doordash', name: 'DoorDash', image: 'https://api.iconify.design/simple-icons:doordash.svg?color=%23FF3008', icon: '🍔', color: 'bg-red-500/20 text-red-500', category: 'ecommerce' },
  { id: 'ubereats', name: 'Uber Eats', image: 'https://api.iconify.design/simple-icons:ubereats.svg?color=%2306C167', icon: '🍔', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  { id: 'grubhub', name: 'Grubhub', image: 'https://api.iconify.design/simple-icons:grubhub.svg?color=%23F63440', icon: '🍕', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  { id: 'shein', name: 'SHEIN', image: 'https://api.iconify.design/simple-icons:shein.svg?color=white', icon: '👗', color: 'bg-gray-800/50 text-white', category: 'ecommerce' },
  { id: 'ozon', name: 'Ozon', image: 'https://api.iconify.design/simple-icons:ozon.svg?color=%23005BFF', icon: '📦', color: 'bg-blue-500/20 text-blue-400', category: 'ecommerce' },
  { id: 'wildberries', name: 'Wildberries', image: 'https://api.iconify.design/simple-icons:wildberries.svg?color=%23CB11AB', icon: '🛍️', color: 'bg-purple-600/20 text-purple-500', category: 'ecommerce' },

  // Hiburan & Kencan
  { id: 'netflix', name: 'Netflix', image: 'https://api.iconify.design/logos:netflix-icon.svg', icon: '🎬', color: 'bg-red-600/20 text-red-500', category: 'game' },
  { id: 'spotify', name: 'Spotify', image: 'https://api.iconify.design/logos:spotify-icon.svg', icon: '🎧', color: 'bg-green-500/20 text-green-500', category: 'game' },
  { id: 'steam', name: 'Steam', image: 'https://api.iconify.design/mdi:steam.svg?color=white', icon: '🎮', color: 'bg-blue-800/50 text-white', category: 'game' },
  { id: 'blizzard', name: 'Battle.net / Blizzard', image: 'https://api.iconify.design/simple-icons:battledotnet.svg?color=%2300AEFF', icon: '⚔️', color: 'bg-blue-600/20 text-blue-400', category: 'game' },
  { id: 'playstation', name: 'PlayStation Network', image: 'https://api.iconify.design/logos:playstation.svg', icon: '🎮', color: 'bg-blue-700/20 text-blue-600', category: 'game' },
  { id: 'nintendo', name: 'Nintendo', image: 'https://api.iconify.design/simple-icons:nintendo.svg?color=%23E60012', icon: '🍄', color: 'bg-red-600/20 text-red-500', category: 'game' },
  { id: 'roblox', name: 'Roblox', image: 'https://api.iconify.design/simple-icons:roblox.svg?color=white', icon: '🧱', color: 'bg-gray-700/50 text-white', category: 'game' },
  { id: 'faceit', name: 'Faceit', image: 'https://api.iconify.design/simple-icons:faceit.svg?color=%23FF5500', icon: '🎯', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  { id: 'ea', name: 'EA / Origin', image: 'https://api.iconify.design/simple-icons:ea.svg?color=white', icon: '🎮', color: 'bg-gray-800/50 text-white', category: 'game' },
  { id: 'ubisoft', name: 'Ubisoft Connect', image: 'https://api.iconify.design/simple-icons:ubisoft.svg?color=white', icon: '🌀', color: 'bg-blue-500/20 text-blue-500', category: 'game' },
  { id: 'tinder', name: 'Tinder', image: 'https://api.iconify.design/logos:tinder-icon.svg', icon: '🔥', color: 'bg-rose-500/20 text-rose-400', category: 'dating' },
  { id: 'bumble', name: 'Bumble', image: 'https://api.iconify.design/simple-icons:bumble.svg?color=%23FFC629', icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  { id: 'badoo', name: 'Badoo', image: 'https://api.iconify.design/simple-icons:badoo.svg?color=%23783BF9', icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  { id: 'pof', name: 'Plenty of Fish', image: 'https://api.iconify.design/simple-icons:plentyoffish.svg?color=%2300B2E2', icon: '🐟', color: 'bg-blue-500/20 text-blue-400', category: 'dating' },
  { id: 'grindr', name: 'Grindr', image: 'https://api.iconify.design/simple-icons:grindr.svg?color=%23F5D600', icon: '🎭', color: 'bg-yellow-600/20 text-yellow-500', category: 'dating' },
  { id: 'match', name: 'Match.com', image: 'https://api.iconify.design/simple-icons:matchdotcom.svg?color=%2300A5F1', icon: '❤️', color: 'bg-blue-600/20 text-blue-500', category: 'dating' },
  { id: 'okcupid', name: 'OkCupid', image: 'https://api.iconify.design/simple-icons:okcupid.svg?color=%2342B2FA', icon: '💘', color: 'bg-blue-400/20 text-blue-400', category: 'dating' },
  { id: 'hinge', name: 'Hinge', image: 'https://api.iconify.design/simple-icons:hinge.svg?color=white', icon: 'H', color: 'bg-black border border-white/20 text-white', category: 'dating' },

  // Keuangan & Crypto
  { id: 'paypal', name: 'PayPal', image: 'https://api.iconify.design/logos:paypal.svg', icon: '💳', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'binance', name: 'Binance', image: 'https://api.iconify.design/simple-icons:binance.svg?color=%23F3BA2F', icon: '🪙', color: 'bg-yellow-500/20 text-yellow-500', category: 'finance' },
  { id: 'coinbase', name: 'Coinbase', image: 'https://api.iconify.design/logos:coinbase.svg', icon: '🔵', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'kucoin', name: 'KuCoin', image: 'https://api.iconify.design/simple-icons:kucoin.svg?color=%2324AE8F', icon: '🟢', color: 'bg-green-500/20 text-green-500', category: 'finance' },
  { id: 'bybit', name: 'Bybit', image: 'https://api.iconify.design/simple-icons:bybit.svg?color=%23F7A600', icon: '📈', color: 'bg-yellow-600/20 text-yellow-500', category: 'finance' },
  { id: 'payoneer', name: 'Payoneer', image: 'https://api.iconify.design/logos:payoneer.svg', icon: '💳', color: 'bg-orange-500/20 text-orange-500', category: 'finance' },
  { id: 'revolut', name: 'Revolut', image: 'https://api.iconify.design/simple-icons:revolut.svg?color=white', icon: '💳', color: 'bg-gray-800 text-white', category: 'finance' },
  { id: 'monzo', name: 'Monzo', image: 'https://api.iconify.design/simple-icons:monzo.svg?color=%2314233C', icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  { id: 'transferwise', name: 'Wise (TransferWise)', image: 'https://api.iconify.design/logos:wise.svg', icon: '💸', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'skrill', name: 'Skrill', image: 'https://api.iconify.design/simple-icons:skrill.svg?color=%23821C4F', icon: '💳', color: 'bg-purple-800/20 text-purple-700', category: 'finance' },
  { id: 'neteller', name: 'Neteller', image: 'https://api.iconify.design/simple-icons:neteller.svg?color=%238BB031', icon: '💳', color: 'bg-green-600/20 text-green-500', category: 'finance' },
  { id: 'perfectmoney', name: 'PerfectMoney', image: 'https://logo.clearbit.com/perfectmoney.com', icon: 'PM', color: 'bg-red-600/20 text-red-500', category: 'finance' },
  { id: 'webmoney', name: 'WebMoney', image: 'https://api.iconify.design/simple-icons:webmoney.svg?color=%2300569C', icon: 'WM', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'payeer', name: 'Payeer', image: 'https://api.iconify.design/simple-icons:payeer.svg?color=%23008DE4', icon: 'P', color: 'bg-blue-400/20 text-blue-400', category: 'finance' },
  { id: 'advcash', name: 'AdvCash', image: 'https://logo.clearbit.com/advcash.com', icon: 'A', color: 'bg-green-500/20 text-green-500', category: 'finance' },
  { id: 'crypto', name: 'Crypto.com', image: 'https://api.iconify.design/logos:crypto-com.svg', icon: '🦁', color: 'bg-blue-800/50 text-blue-300', category: 'finance' },
  { id: 'kraken', name: 'Kraken', image: 'https://api.iconify.design/logos:kraken.svg', icon: '🦑', color: 'bg-purple-600/20 text-purple-500', category: 'finance' },
  { id: 'gemini', name: 'Gemini', image: 'https://api.iconify.design/logos:gemini.svg', icon: '♊', color: 'bg-blue-400/20 text-blue-400', category: 'finance' },
  { id: 'huobi', name: 'Huobi', image: 'https://api.iconify.design/simple-icons:huobi.svg?color=%23005A98', icon: 'H', color: 'bg-blue-600/20 text-blue-500', category: 'finance' },
  { id: 'okx', name: 'OKX', image: 'https://api.iconify.design/simple-icons:okx.svg?color=white', icon: 'O', color: 'bg-gray-800/50 text-white', category: 'finance' },
  { id: 'mexc', name: 'MEXC', image: 'https://api.iconify.design/simple-icons:mexc.svg?color=%2303B9EB', icon: 'M', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'gate', name: 'Gate.io', image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B', icon: 'G', color: 'bg-red-500/20 text-red-400', category: 'finance' },
  { id: 'bitget', name: 'Bitget', image: 'https://api.iconify.design/simple-icons:bitget.svg?color=%2326A17B', icon: 'B', color: 'bg-teal-500/20 text-teal-400', category: 'finance' },
  { id: 'bingx', name: 'BingX', image: 'https://api.iconify.design/simple-icons:bingx.svg?color=%231DA2D8', icon: 'BX', color: 'bg-blue-600/20 text-blue-400', category: 'finance' },

  // Streaming & Hiburan Tambahan
  { id: 'disneyplus', name: 'Disney+', image: 'https://api.iconify.design/logos:disney.svg', icon: '🏰', color: 'bg-blue-900/50 text-blue-300', category: 'game' },
  { id: 'hbo', name: 'HBO Max', image: 'https://api.iconify.design/simple-icons:hbo.svg?color=%23A855F7', icon: '🎬', color: 'bg-purple-600/20 text-purple-400', category: 'game' },
  { id: 'hulu', name: 'Hulu', image: 'https://api.iconify.design/simple-icons:hulu.svg?color=%231CE783', icon: '📺', color: 'bg-green-500/20 text-green-400', category: 'game' },
  { id: 'paramount', name: 'Paramount+', image: 'https://api.iconify.design/simple-icons:paramount.svg?color=%230064FF', icon: '⭐', color: 'bg-blue-700/20 text-blue-400', category: 'game' },
  { id: 'amazon_video', name: 'Amazon Prime Video', image: 'https://api.iconify.design/logos:prime.svg', icon: '🎥', color: 'bg-sky-500/20 text-sky-400', category: 'game' },
  { id: 'deezer', name: 'Deezer', image: 'https://api.iconify.design/simple-icons:deezer.svg?color=%23FEAA2D', icon: '🎵', color: 'bg-yellow-500/20 text-yellow-400', category: 'game' },
  { id: 'crunchyroll', name: 'Crunchyroll', image: 'https://api.iconify.design/simple-icons:crunchyroll.svg?color=%23F47521', icon: '⛩️', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  { id: 'xbox', name: 'Xbox', image: 'https://api.iconify.design/logos:xbox.svg', icon: '🎮', color: 'bg-green-600/20 text-green-500', category: 'game' },
  { id: 'epicgames', name: 'Epic Games', image: 'https://api.iconify.design/simple-icons:epicgames.svg?color=white', icon: '🎮', color: 'bg-gray-700/50 text-white', category: 'game' },
  { id: 'supercell', name: 'Supercell (Clash)', image: 'https://logo.clearbit.com/supercell.com', icon: '⚔️', color: 'bg-red-500/20 text-red-400', category: 'game' },
  { id: 'garena', name: 'Garena / Free Fire', image: 'https://api.iconify.design/simple-icons:garena.svg?color=%23F11E24', icon: '🔥', color: 'bg-red-600/20 text-red-500', category: 'game' },

  // Produktivitas & Bisnis
  { id: 'zoom', name: 'Zoom', image: 'https://api.iconify.design/logos:zoom.svg', icon: '📹', color: 'bg-blue-500/20 text-blue-400', category: 'tech' },
  { id: 'slack', name: 'Slack', image: 'https://api.iconify.design/logos:slack-icon.svg', icon: '💬', color: 'bg-purple-500/20 text-purple-400', category: 'tech' },
  { id: 'dropbox', name: 'Dropbox', image: 'https://api.iconify.design/logos:dropbox.svg', icon: '📂', color: 'bg-blue-600/20 text-blue-400', category: 'tech' },
  { id: 'stripe', name: 'Stripe', image: 'https://api.iconify.design/logos:stripe.svg', icon: '💳', color: 'bg-indigo-600/20 text-indigo-400', category: 'finance' },
  { id: 'airbnb', name: 'Airbnb', image: 'https://api.iconify.design/logos:airbnb.svg', icon: '🏠', color: 'bg-pink-500/20 text-pink-400', category: 'ecommerce' },
  { id: 'lyft', name: 'Lyft', image: 'https://api.iconify.design/logos:lyft.svg', icon: '🚕', color: 'bg-pink-600/20 text-pink-400', category: 'ecommerce' },
  { id: 'bolt', name: 'Bolt', image: 'https://api.iconify.design/simple-icons:bolt.svg?color=%2334D186', icon: '⚡', color: 'bg-green-500/20 text-green-400', category: 'ecommerce' },

  // Service SA yang tidak ada di list sebelumnya
  { id: 'newzealand',  name: 'New Zealand',       icon: '🇳🇿', color: 'bg-blue-500/20 text-blue-400',   category: 'other' },
  { id: 'usnumber',    name: 'US Number',          icon: '🇺🇸', color: 'bg-red-500/20 text-red-400',     category: 'other' },
  { id: 'bandwidth',   name: 'Bandwidth',          icon: '📡',  color: 'bg-gray-500/20 text-gray-400',   category: 'other' },
  { id: 'momo',        name: 'MoMo',               image: 'https://api.iconify.design/mdi:wallet.svg?color=%23A50064',            icon: '🌸',  color: 'bg-pink-500/20 text-pink-400',   category: 'finance' },
  { id: 'zalo',        name: 'Zalo',               image: 'https://logo.clearbit.com/zalo.me',                                    icon: '💬',  color: 'bg-blue-400/20 text-blue-400',   category: 'social' },
  { id: 'linecorp',    name: 'Line Corp',          image: 'https://api.iconify.design/logos:line.svg',                            icon: '💬',  color: 'bg-green-500/20 text-green-500', category: 'social' },
  { id: 'movistar',    name: 'Movistar',           icon: '📱',  color: 'bg-blue-600/20 text-blue-500',   category: 'other' },
  { id: 'zara',        name: 'Zara',               image: 'https://logo.clearbit.com/zara.com',                                   icon: '👗',  color: 'bg-gray-700/50 text-white',      category: 'ecommerce' },
  { id: 'tokocrypto',  name: 'Tokocrypto',         image: 'https://logo.clearbit.com/tokocrypto.com',                             icon: '🪙',  color: 'bg-blue-500/20 text-blue-400',   category: 'finance' },
  { id: 'fazz',        name: 'Fazz',               image: 'https://logo.clearbit.com/fazz.com',                                   icon: '💰',  color: 'bg-green-500/20 text-green-400', category: 'finance' },
  { id: 'anyservice',  name: 'Any Service',        icon: '📱',  color: 'bg-gray-500/20 text-gray-400',   category: 'other' },
  { id: 'kakaot',      name: 'Kakao T',            image: 'https://logo.clearbit.com/kakaomobility.com',                          icon: '🚕',  color: 'bg-yellow-500/20 text-yellow-400', category: 'other' },
  // Fintech Lokal Asia
  { id: 'ovo', name: 'OVO', image: 'https://api.iconify.design/simple-icons:ovo.svg?color=%234C3494', icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  { id: 'gopay', name: 'GoPay', image: 'https://api.iconify.design/simple-icons:gojek.svg?color=%2300AA13', icon: '💚', color: 'bg-green-500/20 text-green-400', category: 'finance' },
  { id: 'dana_app', name: 'DANA', image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5', icon: '💙', color: 'bg-blue-500/20 text-blue-400', category: 'finance' },
  { id: 'linkaja', name: 'LinkAja', image: 'https://api.iconify.design/mdi:wallet.svg?color=%23E82529', icon: '❤️', color: 'bg-red-500/20 text-red-400', category: 'finance' },
  { id: 'truemoney', name: 'TrueMoney', image: 'https://api.iconify.design/mdi:wallet.svg?color=%23FF7200', icon: '💰', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  { id: 'gcash', name: 'GCash', image: 'https://api.iconify.design/simple-icons:gcash.svg?color=%230033A0', icon: '🔵', color: 'bg-blue-700/20 text-blue-400', category: 'finance' },
  { id: 'paymaya', name: 'Maya / PayMaya', image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0', icon: '🟢', color: 'bg-green-600/20 text-green-400', category: 'finance' },
];

// ==========================================
// MASTER ICON MAP — covers 500+ layanan dari 5sim
// Key = nama service di 5sim (sudah di-mapServiceFrom5Sim)
// Jika tidak ada di SERVICES hardcoded, fallback ke sini
// ==========================================
const SERVICE_ICON_MAP: Record<string, { name: string; image: string; icon: string; color: string; category: string }> = {
  // Iconify CDN: gratis, 200k+ icon, tidak perlu install package
  'whatsapp':      { name: 'WhatsApp',           image: 'https://api.iconify.design/logos:whatsapp-icon.svg',                    icon: '💬', color: 'bg-green-500/20 text-green-400',   category: 'social' },
  'telegram':      { name: 'Telegram',            image: 'https://api.iconify.design/logos:telegram.svg',                         icon: '✈️', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'instagram':     { name: 'Instagram',           image: 'https://api.iconify.design/skill-icons:instagram.svg',                  icon: '📸', color: 'bg-pink-500/20 text-pink-400',    category: 'social' },
  'facebook':      { name: 'Facebook',            image: 'https://api.iconify.design/logos:facebook.svg',                         icon: '📘', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'tiktok':        { name: 'TikTok',              image: 'https://api.iconify.design/logos:tiktok-icon.svg',                      icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'twitterx':      { name: 'Twitter / X',         image: 'https://api.iconify.design/simple-icons:x.svg?color=white',             icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'twitter':       { name: 'Twitter / X',         image: 'https://api.iconify.design/simple-icons:x.svg?color=white',             icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'discord':       { name: 'Discord',             image: 'https://api.iconify.design/logos:discord-icon.svg',                     icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
  'snapchat':      { name: 'Snapchat',            image: 'https://api.iconify.design/fa-brands:snapchat-ghost.svg?color=%23FFFC00',icon: '👻', color: 'bg-yellow-400/20 text-yellow-400', category: 'social' },
  'viber':         { name: 'Viber',               image: 'https://api.iconify.design/fa-brands:viber.svg?color=%23665CAC',        icon: '📞', color: 'bg-purple-500/20 text-purple-500', category: 'social' },
  'wechat':        { name: 'WeChat',              image: 'https://api.iconify.design/uiw:wechat.svg?color=%2307C160',             icon: '💬', color: 'bg-green-500/20 text-green-500',   category: 'social' },
  'line':          { name: 'LINE',                image: 'https://api.iconify.design/logos:line.svg',                             icon: '💬', color: 'bg-green-500/20 text-green-500',   category: 'social' },
  'kakaotalk':     { name: 'KakaoTalk',           image: 'https://api.iconify.design/ri:kakao-talk-fill.svg?color=%23FEE500',     icon: '💬', color: 'bg-yellow-500/20 text-yellow-500', category: 'social' },
  'vk':            { name: 'VKontakte',           image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  'vkontakte':     { name: 'VKontakte',           image: 'https://api.iconify.design/entypo-social:vk-with-circle.svg?color=%234C75A3', icon: 'V', color: 'bg-blue-500/20 text-blue-500', category: 'social' },
  'odnoklassniki': { name: 'Odnoklassniki',       image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  'ok':            { name: 'Odnoklassniki',       image: 'https://api.iconify.design/simple-icons:odnoklassniki.svg?color=%23EE8208', icon: '🟠', color: 'bg-orange-500/20 text-orange-500', category: 'social' },
  'linkedin':      { name: 'LinkedIn',            image: 'https://api.iconify.design/logos:linkedin-icon.svg',                    icon: '💼', color: 'bg-blue-700/20 text-blue-600',    category: 'social' },
  'pinterest':     { name: 'Pinterest',           image: 'https://api.iconify.design/logos:pinterest.svg',                        icon: '📌', color: 'bg-red-600/20 text-red-600',       category: 'social' },
  'reddit':        { name: 'Reddit',              image: 'https://api.iconify.design/logos:reddit-icon.svg',                      icon: '🤖', color: 'bg-orange-600/20 text-orange-500', category: 'social' },
  'tumblr':        { name: 'Tumblr',              image: 'https://api.iconify.design/logos:tumblr-icon.svg',                      icon: 'T',  color: 'bg-indigo-800/20 text-indigo-700', category: 'social' },
  'quora':         { name: 'Quora',               image: 'https://api.iconify.design/simple-icons:quora.svg?color=%23B92B27',     icon: 'Q',  color: 'bg-red-800/20 text-red-700',       category: 'social' },
  'twitch':        { name: 'Twitch',              image: 'https://api.iconify.design/logos:twitch.svg',                           icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'social' },
  'threads':       { name: 'Threads',             image: 'https://api.iconify.design/simple-icons:threads.svg?color=white',       icon: '🧵', color: 'bg-gray-800/50 text-white',        category: 'social' },
  'signal':        { name: 'Signal',              image: 'https://api.iconify.design/simple-icons:signal.svg?color=%23316FF6',    icon: '🔒', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'skype':         { name: 'Skype',               image: 'https://api.iconify.design/logos:skype.svg',                            icon: '💬', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'zalo':          { name: 'Zalo',                image: 'https://api.iconify.design/simple-icons:zalo.svg?color=%230068FF',      icon: '💬', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'imo':           { name: 'IMO',                 image: 'https://api.iconify.design/mdi:message-video.svg?color=%2300A8FF',      icon: '📹', color: 'bg-blue-400/20 text-blue-300',    category: 'social' },
  'clubhouse':     { name: 'Clubhouse',           image: 'https://api.iconify.design/simple-icons:clubhouse.svg?color=white',     icon: '🎙️', color: 'bg-gray-700/50 text-white',      category: 'social' },
  'badoo':         { name: 'Badoo',               image: 'https://api.iconify.design/simple-icons:badoo.svg?color=%23FF4B7C',     icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  // Tech & Cloud
  'google':        { name: 'Google / Gmail',      image: 'https://api.iconify.design/logos:google-icon.svg',                     icon: '✉️', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'apple':         { name: 'Apple ID',            image: 'https://api.iconify.design/mdi:apple.svg?color=white',                 icon: '🍎', color: 'bg-gray-500/20 text-gray-400',    category: 'tech' },
  'microsoft':     { name: 'Microsoft',           image: 'https://api.iconify.design/logos:microsoft-icon.svg',                   icon: '🪟', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'yahoo':         { name: 'Yahoo',               image: 'https://api.iconify.design/logos:yahoo.svg',                           icon: 'Y!', color: 'bg-purple-500/20 text-purple-500', category: 'tech' },
  'openai':        { name: 'ChatGPT / OpenAI',    image: 'https://api.iconify.design/simple-icons:openai.svg?color=white',       icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'anthropic':     { name: 'Claude / Anthropic',  image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65',icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'github':        { name: 'GitHub',              image: 'https://api.iconify.design/mdi:github.svg?color=white',                icon: '💻', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'amazon':        { name: 'Amazon / AWS',        image: 'https://api.iconify.design/ri:amazon-fill.svg?color=%23FF9900',        icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'mailru':        { name: 'Mail.ru',             image: 'https://api.iconify.design/simple-icons:maildotru.svg?color=%23168DE2',icon: '@',  color: 'bg-blue-600/20 text-blue-500',    category: 'tech' },
  'yandex':        { name: 'Yandex',              image: 'https://api.iconify.design/logos:yandex-ru.svg',                       icon: 'Y',  color: 'bg-red-600/20 text-red-500',       category: 'tech' },
  'protonmail':    { name: 'ProtonMail',          image: 'https://api.iconify.design/logos:protonmail.svg',                       icon: '🔒', color: 'bg-purple-700/20 text-purple-600', category: 'tech' },
  'naver':         { name: 'Naver',               image: 'https://api.iconify.design/simple-icons:naver.svg?color=%2303C75A',    icon: 'N',  color: 'bg-green-600/20 text-green-500',   category: 'tech' },
  'azure':         { name: 'Microsoft Azure',     image: 'https://api.iconify.design/logos:microsoft-azure.svg',                 icon: '☁️', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'wise':          { name: 'Wise',                image: 'https://api.iconify.design/simple-icons:wise.svg?color=%2300B9FF',      icon: '💸', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'zoom':          { name: 'Zoom',                image: 'https://api.iconify.design/logos:zoom-icon.svg',                       icon: '📹', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'dropbox':       { name: 'Dropbox',             image: 'https://api.iconify.design/logos:dropbox.svg',                         icon: '📦', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'slack':         { name: 'Slack',               image: 'https://api.iconify.design/logos:slack-icon.svg',                      icon: '💬', color: 'bg-purple-500/20 text-purple-400', category: 'tech' },
  'notion':        { name: 'Notion',              image: 'https://api.iconify.design/simple-icons:notion.svg?color=white',       icon: '📝', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'figma':         { name: 'Figma',               image: 'https://api.iconify.design/logos:figma.svg',                           icon: '🎨', color: 'bg-pink-500/20 text-pink-400',    category: 'tech' },
  'adobe':         { name: 'Adobe',               image: 'https://api.iconify.design/logos:adobe.svg',                           icon: '🎨', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'canva':         { name: 'Canva',               image: 'https://api.iconify.design/logos:canva.svg',                           icon: '🎨', color: 'bg-blue-400/20 text-blue-300',    category: 'tech' },
  'chatgpt':       { name: 'ChatGPT',             image: 'https://api.iconify.design/simple-icons:openai.svg?color=white',       icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'gemini':        { name: 'Gemini / Google AI',  image: 'https://api.iconify.design/logos:google-icon.svg',                     icon: '✨', color: 'bg-blue-400/20 text-blue-300',    category: 'tech' },
  // E-Commerce
  'shopee':        { name: 'Shopee',              image: 'https://api.iconify.design/simple-icons:shopee.svg?color=white',       icon: '🛍️', color: 'bg-orange-500 text-white',        category: 'ecommerce' },
  'gojek':         { name: 'Gojek',               image: 'https://api.iconify.design/simple-icons:gojek.svg?color=white',        icon: '🏍️', color: 'bg-green-600 text-white',         category: 'ecommerce' },
  'grab':          { name: 'Grab',                image: 'https://api.iconify.design/simple-icons:grab.svg?color=%2300B14F',     icon: '🚗', color: 'bg-green-400/20 text-green-400',   category: 'ecommerce' },
  'tokopedia':     { name: 'Tokopedia',           image: 'https://api.iconify.design/tabler:shopping-bag.svg?color=%2342B549',   icon: '🦉', color: 'bg-green-500/20 text-green-500',   category: 'ecommerce' },
  'lazada':        { name: 'Lazada',              image: 'https://api.iconify.design/simple-icons:lazada.svg?color=%23F53C80',   icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  'alibaba':       { name: 'Alibaba / AliExpress',image: 'https://api.iconify.design/simple-icons:alibaba.svg?color=%23FF6A00', icon: '📦', color: 'bg-orange-600/20 text-orange-500', category: 'ecommerce' },
  'aliexpress':    { name: 'AliExpress',          image: 'https://api.iconify.design/simple-icons:aliexpress.svg?color=%23FF4747', icon: '📦', color: 'bg-red-500/20 text-red-400',   category: 'ecommerce' },
  'taobao':        { name: 'Taobao',              image: 'https://api.iconify.design/simple-icons:taobao.svg?color=%23FF5000',   icon: '🛒', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  'ebay':          { name: 'eBay',                image: 'https://api.iconify.design/logos:ebay.svg',                            icon: '🛒', color: 'bg-blue-500/20 text-blue-500',    category: 'ecommerce' },
  'uber':          { name: 'Uber',                image: 'https://api.iconify.design/fa-brands:uber.svg?color=white',            icon: '🚕', color: 'bg-gray-800 text-white',           category: 'ecommerce' },
  'airbnb':        { name: 'Airbnb',              image: 'https://api.iconify.design/logos:airbnb.svg',                          icon: '🏠', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'booking':       { name: 'Booking.com',         image: 'https://api.iconify.design/logos:booking-com.svg',                    icon: '🏨', color: 'bg-blue-600/20 text-blue-500',    category: 'ecommerce' },
  'shein':         { name: 'SHEIN',               image: 'https://api.iconify.design/simple-icons:shein.svg?color=white',        icon: '👗', color: 'bg-gray-800/50 text-white',       category: 'ecommerce' },
  'ozon':          { name: 'Ozon',                image: 'https://api.iconify.design/simple-icons:ozon.svg?color=%23005BFF',     icon: '📦', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'wildberries':   { name: 'Wildberries',         image: 'https://api.iconify.design/simple-icons:wildberries.svg?color=%23CB11AB', icon: '🛍️', color: 'bg-purple-600/20 text-purple-500', category: 'ecommerce' },
  'avito':         { name: 'Avito',               image: 'https://api.iconify.design/simple-icons:avito.svg?color=%2300AAFF',    icon: '📋', color: 'bg-blue-400/20 text-blue-300',    category: 'ecommerce' },
  'foodpanda':     { name: 'Foodpanda',           image: 'https://api.iconify.design/simple-icons:foodpanda.svg?color=%23D70F64',icon: '🐼', color: 'bg-pink-600/20 text-pink-500',    category: 'ecommerce' },
  'doordash':      { name: 'DoorDash',            image: 'https://api.iconify.design/simple-icons:doordash.svg?color=%23FF3008',  icon: '🍔', color: 'bg-red-500/20 text-red-500',     category: 'ecommerce' },
  'ubereats':      { name: 'Uber Eats',           image: 'https://api.iconify.design/simple-icons:ubereats.svg?color=%2306C167',  icon: '🍔', color: 'bg-green-500/20 text-green-500', category: 'ecommerce' },
  // Finance & Crypto
  'paypal':        { name: 'PayPal',              image: 'https://api.iconify.design/logos:paypal.svg',                          icon: '💳', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'binance':       { name: 'Binance',             image: 'https://api.iconify.design/logos:binance.svg',                         icon: '₿',  color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'coinbase':      { name: 'Coinbase',            image: 'https://api.iconify.design/logos:coinbase.svg',                        icon: '₿',  color: 'bg-blue-600/20 text-blue-500',    category: 'finance' },
  'bybit':         { name: 'Bybit',               image: 'https://api.iconify.design/simple-icons:bybit.svg?color=%23F7A600',    icon: '💰', color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'kucoin':        { name: 'KuCoin',              image: 'https://api.iconify.design/simple-icons:kucoin.svg?color=%2300A478',   icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'okx':           { name: 'OKX',                 image: 'https://api.iconify.design/simple-icons:okx.svg?color=white',          icon: '📈', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'kraken':        { name: 'Kraken',              image: 'https://api.iconify.design/simple-icons:kraken.svg?color=%235741D9',   icon: '🦑', color: 'bg-purple-600/20 text-purple-500', category: 'finance' },
  'mexc':          { name: 'MEXC',                image: 'https://api.iconify.design/simple-icons:mexc.svg?color=%2303B9EB',     icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bitget':        { name: 'Bitget',              image: 'https://api.iconify.design/simple-icons:bitget.svg?color=%2300F0FF',   icon: '📊', color: 'bg-cyan-500/20 text-cyan-400',    category: 'finance' },
  'gate':          { name: 'Gate.io',             image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B',   icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'huobi':         { name: 'HTX / Huobi',         image: 'https://api.iconify.design/simple-icons:huobi.svg?color=%232ED8A3',    icon: '📊', color: 'bg-teal-500/20 text-teal-400',    category: 'finance' },
  'bingx':         { name: 'BingX',               image: 'https://api.iconify.design/simple-icons:bingx.svg?color=%231DA2D8',    icon: '📊', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  'payoneer':      { name: 'Payoneer',            image: 'https://api.iconify.design/simple-icons:payoneer.svg?color=%23FF4800', icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'revolut':       { name: 'Revolut',             image: 'https://api.iconify.design/simple-icons:revolut.svg?color=white',      icon: '💳', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'skrill':        { name: 'Skrill',              image: 'https://api.iconify.design/simple-icons:skrill.svg?color=%23862165',   icon: '💸', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'crypto':        { name: 'Crypto.com',          image: 'https://api.iconify.design/simple-icons:cryptocom.svg?color=%2302317C',icon: '₿',  color: 'bg-blue-800/20 text-blue-700',    category: 'finance' },
  'stripe':        { name: 'Stripe',              image: 'https://api.iconify.design/logos:stripe.svg',                          icon: '💳', color: 'bg-indigo-500/20 text-indigo-400', category: 'finance' },
  'ovo':           { name: 'OVO',                 image: 'https://api.iconify.design/simple-icons:ovo.svg?color=%234C3494',      icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'dana':          { name: 'DANA',                image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5',     icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'gcash':         { name: 'GCash',               image: 'https://api.iconify.design/simple-icons:gcash.svg?color=%230078D0',    icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'truemoney':     { name: 'TrueMoney',           image: 'https://api.iconify.design/mdi:wallet.svg?color=%23FF7200',            icon: '💰', color: 'bg-orange-400/20 text-orange-400', category: 'finance' },
  'momo':          { name: 'MoMo',                image: 'https://api.iconify.design/mdi:wallet.svg?color=%23A50064',            icon: '🌸', color: 'bg-pink-500/20 text-pink-400',    category: 'finance' },
  'linkaja':       { name: 'LinkAja',             image: 'https://api.iconify.design/mdi:wallet.svg?color=%23E82529',            icon: '🔗', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'webmoney':      { name: 'WebMoney',            image: 'https://api.iconify.design/simple-icons:webmoney.svg?color=%230080FF', icon: '💰', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'qiwi':          { name: 'QIWI',                image: 'https://api.iconify.design/simple-icons:qiwi.svg?color=%23FF8C00',     icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'paymaya':       { name: 'Maya / PayMaya',      image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0',            icon: '💙', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  // Streaming & Gaming
  'netflix':       { name: 'Netflix',             image: 'https://api.iconify.design/logos:netflix-icon.svg',                    icon: '🎬', color: 'bg-red-600/20 text-red-500',      category: 'game' },
  'spotify':       { name: 'Spotify',             image: 'https://api.iconify.design/logos:spotify-icon.svg',                    icon: '🎵', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'steam':         { name: 'Steam',               image: 'https://api.iconify.design/logos:steam.svg',                           icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'epicgames':     { name: 'Epic Games',          image: 'https://api.iconify.design/simple-icons:epicgames.svg?color=white',    icon: '🎮', color: 'bg-gray-800 text-white',           category: 'game' },
  'xbox':          { name: 'Xbox',                image: 'https://api.iconify.design/logos:xbox.svg',                            icon: '🎮', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'playstation':   { name: 'PlayStation',         image: 'https://api.iconify.design/logos:playstation.svg',                     icon: '🕹️', color: 'bg-blue-600/20 text-blue-500',   category: 'game' },
  'nintendo':      { name: 'Nintendo',            image: 'https://api.iconify.design/logos:nintendo.svg',                        icon: '🕹️', color: 'bg-red-500/20 text-red-400',     category: 'game' },
  'blizzard':      { name: 'Blizzard',            image: 'https://api.iconify.design/simple-icons:blizzard.svg?color=%0074D1FF', icon: '❄️', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'roblox':        { name: 'Roblox',              image: 'https://api.iconify.design/logos:roblox.svg',                          icon: '🧱', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'disneyplus':    { name: 'Disney+',             image: 'https://api.iconify.design/logos:disney-plus.svg',                     icon: '🏰', color: 'bg-blue-700/20 text-blue-600',    category: 'game' },
  'hulu':          { name: 'Hulu',                image: 'https://api.iconify.design/simple-icons:hulu.svg?color=%231CE783',     icon: '📺', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'hbo':           { name: 'HBO / Max',           image: 'https://api.iconify.design/simple-icons:hbo.svg?color=%23A020F0',      icon: '📺', color: 'bg-purple-600/20 text-purple-500', category: 'game' },
  'deezer':        { name: 'Deezer',              image: 'https://api.iconify.design/simple-icons:deezer.svg?color=%23EF5466',   icon: '🎵', color: 'bg-pink-500/20 text-pink-400',    category: 'game' },
  'crunchyroll':   { name: 'Crunchyroll',         image: 'https://api.iconify.design/simple-icons:crunchyroll.svg?color=%23F47521', icon: '⛩️', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  'tidal':         { name: 'Tidal',               image: 'https://api.iconify.design/simple-icons:tidal.svg?color=white',        icon: '🎵', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'garena':        { name: 'Garena / Free Fire',  image: 'https://api.iconify.design/simple-icons:garena.svg?color=%23EF2929',   icon: '🔥', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'supercell':     { name: 'Supercell',           image: 'https://api.iconify.design/mdi:gamepad-variant.svg?color=%2300B3F0',   icon: '🏆', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'ea':            { name: 'EA / Origin',         image: 'https://api.iconify.design/simple-icons:ea.svg?color=%23FF4747',       icon: '🎮', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'ubisoft':       { name: 'Ubisoft',             image: 'https://api.iconify.design/simple-icons:ubisoft.svg?color=white',      icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'faceit':        { name: 'FACEIT',              image: 'https://api.iconify.design/simple-icons:faceit.svg?color=%23FF5500',   icon: '🎮', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  // Dating
  'tinder':        { name: 'Tinder',              image: 'https://api.iconify.design/logos:tinder.svg',                          icon: '🔥', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  'bumble':        { name: 'Bumble',              image: 'https://api.iconify.design/simple-icons:bumble.svg?color=%23F1CB00',   icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'hinge':         { name: 'Hinge',               image: 'https://api.iconify.design/simple-icons:hinge.svg?color=%23E8503A',    icon: '❤️', color: 'bg-red-500/20 text-red-400',     category: 'dating' },
  'match':         { name: 'Match.com',           image: 'https://api.iconify.design/mdi:heart.svg?color=%23E8503A',             icon: '💕', color: 'bg-red-400/20 text-red-400',      category: 'dating' },
  'okcupid':       { name: 'OkCupid',             image: 'https://api.iconify.design/mdi:heart-multiple.svg?color=%234BB3E8',    icon: '💙', color: 'bg-blue-400/20 text-blue-300',    category: 'dating' },
  'grindr':        { name: 'Grindr',              image: 'https://api.iconify.design/simple-icons:grindr.svg?color=%23F5821F',   icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'pof':           { name: 'POF',                 image: 'https://api.iconify.design/mdi:fish.svg?color=%231E88E5',              icon: '🐟', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'meetic':        { name: 'Meetic',              image: 'https://api.iconify.design/mdi:heart.svg?color=%23E8253A',             icon: '💗', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  // Alibaba Group & China Platform
  'alipay':        { name: 'Alipay / Alibaba / 1688', image: 'https://api.iconify.design/simple-icons:alipay.svg?color=%231677FF', icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'baidu':         { name: 'Baidu',              image: 'https://api.iconify.design/simple-icons:baidu.svg?color=%232932E1',        icon: '🔍', color: 'bg-blue-600/20 text-blue-500',    category: 'tech' },
  'youtube':       { name: 'YouTube',            image: 'https://api.iconify.design/logos:youtube-icon.svg',                        icon: '▶️', color: 'bg-red-600/20 text-red-500',      category: 'social' },
  'bukalapak':     { name: 'Bukalapak',          image: 'https://api.iconify.design/simple-icons:bukalapak.svg?color=%23E11F26',    icon: '🛒', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'alfagift':      { name: 'Alfagift',           image: 'https://logo.clearbit.com/alfagift.id',                                        icon: '🏪', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  // Layanan SA Indonesia yang sering muncul di katalog
  'kfc':           { name: 'KFC',                 image: 'https://logo.clearbit.com/kfc.co.id',                                             icon: '🍗', color: 'bg-red-600/20 text-red-500',      category: 'ecommerce' },
  'starbucks':     { name: 'Starbucks',           image: 'https://logo.clearbit.com/starbucks.co.id',                                       icon: '☕', color: 'bg-green-700/20 text-green-500',   category: 'ecommerce' },
  'ukrnet':        { name: 'Ukrnet',              image: 'https://logo.clearbit.com/ukr.net',                                               icon: '📧', color: 'bg-blue-600/20 text-blue-400',    category: 'tech' },
  'bazos':         { name: 'Bazos',               image: 'https://logo.clearbit.com/bazos.cz',                                              icon: '🛒', color: 'bg-orange-500/20 text-orange-400', category: 'ecommerce' },
  'jd':            { name: 'JD.com',             image: 'https://api.iconify.design/simple-icons:jd.svg?color=%23E1251B',           icon: '📦', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'pinduoduo':     { name: 'Pinduoduo / Temu',   image: 'https://api.iconify.design/simple-icons:pinduoduo.svg?color=%23E02020',    icon: '🛒', color: 'bg-red-600/20 text-red-500',      category: 'ecommerce' },
  'meituan':       { name: 'Meituan',            image: 'https://api.iconify.design/simple-icons:meituan.svg?color=%23FFD100',      icon: '🚴', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'xiaohongshu':   { name: 'Xiaohongshu (RED)',  image: 'https://api.iconify.design/simple-icons:xiaohongshu.svg?color=%23FF2442',  icon: '📕', color: 'bg-red-500/20 text-red-400',      category: 'social' },
  'douyin':        { name: 'Douyin (TikTok CN)', image: 'https://api.iconify.design/logos:tiktok-icon.svg',                         icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'kwai':          { name: 'Kwai',               image: 'https://api.iconify.design/simple-icons:kwai.svg?color=%23FFCC00',         icon: '🎬', color: 'bg-yellow-500/20 text-yellow-400', category: 'social' },
  'kuaishou':      { name: 'Kuaishou',           image: 'https://api.iconify.design/simple-icons:kuaishou.svg?color=%23FF4906',     icon: '🎥', color: 'bg-orange-500/20 text-orange-400', category: 'social' },
  'bilibili':      { name: 'Bilibili',           image: 'https://api.iconify.design/simple-icons:bilibili.svg?color=%2300A1D6',     icon: '📺', color: 'bg-cyan-500/20 text-cyan-400',    category: 'social' },
  'capcut':        { name: 'CapCut',             image: 'https://api.iconify.design/simple-icons:capcut.svg?color=white',           icon: '✂️', color: 'bg-gray-800 text-white',           category: 'tech' },
  // Finance tambahan
  'neteller':      { name: 'Neteller',           image: 'https://api.iconify.design/simple-icons:neteller.svg?color=%238BB031',     icon: '💳', color: 'bg-green-600/20 text-green-500',   category: 'finance' },
  'perfectmoney':  { name: 'PerfectMoney',       image: 'https://logo.clearbit.com/perfectmoney.com', icon: 'PM', color: 'bg-red-600/20 text-red-500',                                                                                           category: 'finance' },
  'payeer':        { name: 'Payeer',             image: 'https://api.iconify.design/simple-icons:payeer.svg?color=%23008DE4',       icon: 'P',  color: 'bg-blue-400/20 text-blue-400',    category: 'finance' },
  // Transport & Ride-hailing
  'indriver':      { name: 'InDrive',            image: 'https://logo.clearbit.com/indrive.com',                                    icon: '🚗', color: 'bg-yellow-400/20 text-yellow-400', category: 'ecommerce' },
  'indrive':       { name: 'InDrive',            image: 'https://logo.clearbit.com/indrive.com',                                    icon: '🚗', color: 'bg-yellow-400/20 text-yellow-400', category: 'ecommerce' },
  // Trading
  'tradingview':   { name: 'TradingView',        image: 'https://logo.clearbit.com/tradingview.com',                                icon: '📈', color: 'bg-blue-500/20 text-blue-400',    category: 'finance'   },
  // AI
  'claudeai':      { name: 'Claude AI',          image: 'https://api.iconify.design/simple-icons:anthropic.svg?color=%23D18B65',    icon: '🧠', color: 'bg-orange-500/20 text-orange-400', category: 'tech'      },
  // Alias & entri tambahan untuk SA provider names
  'dana_app':      { name: 'DANA',              image: 'https://api.iconify.design/simple-icons:dana.svg?color=%231A8EE5',     icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'advcash':       { name: 'AdvCash',           image: 'https://logo.clearbit.com/advcash.com',                               icon: 'A',  color: 'bg-green-500/20 text-green-500',   category: 'finance' },
  'tokocrypto':    { name: 'Tokocrypto',        image: 'https://logo.clearbit.com/tokocrypto.com',                            icon: '🪙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'fazz':          { name: 'Fazz',             image: 'https://logo.clearbit.com/fazz.com',                                   icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'kakaot':        { name: 'Kakao T',           image: 'https://logo.clearbit.com/kakaomobility.com',                         icon: '🚕', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'zara':          { name: 'Zara',              image: 'https://logo.clearbit.com/zara.com',                                  icon: '👗', color: 'bg-gray-700/50 text-white',        category: 'ecommerce' },
  'zalo':          { name: 'Zalo',              image: 'https://logo.clearbit.com/zalo.me',                                   icon: '💬', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'gopay':         { name: 'GoPay',             image: 'https://api.iconify.design/simple-icons:gojek.svg?color=%2300AA13',   icon: '💚', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'maya':          { name: 'Maya / PayMaya',    image: 'https://api.iconify.design/mdi:wallet.svg?color=%2300A8E0',           icon: '🟢', color: 'bg-green-600/20 text-green-400',   category: 'finance' },
  'gate_io':       { name: 'Gate.io',           image: 'https://api.iconify.design/simple-icons:gateio.svg?color=%23E40C5B', icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  // ── Alias & entri baru untuk service yang sering muncul dari live API ──
  'cryptocom':     { name: 'Crypto.com',        image: 'https://logo.clearbit.com/crypto.com',                             icon: '🔵', color: 'bg-blue-600/20 text-blue-400',    category: 'finance' },
  'crypto.com':    { name: 'Crypto.com',        image: 'https://logo.clearbit.com/crypto.com',                             icon: '🔵', color: 'bg-blue-600/20 text-blue-400',    category: 'finance' },
  'subito':        { name: 'Subito.it',         image: 'https://logo.clearbit.com/subito.it',                              icon: '🛒', color: 'bg-orange-500/20 text-orange-400', category: 'ecommerce' },
  'swiggy':        { name: 'Swiggy',            image: 'https://logo.clearbit.com/swiggy.com',                             icon: '🍔', color: 'bg-orange-500/20 text-orange-500', category: 'ecommerce' },
  'papara':        { name: 'Papara',            image: 'https://logo.clearbit.com/papara.com',                             icon: '💜', color: 'bg-purple-600/20 text-purple-400', category: 'finance' },
  'mcdonalds':     { name: "McDonald's",        image: 'https://logo.clearbit.com/mcdonalds.com',                          icon: '🍟', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'mcdonald':      { name: "McDonald's",        image: 'https://logo.clearbit.com/mcdonalds.com',                          icon: '🍟', color: 'bg-yellow-500/20 text-yellow-400', category: 'ecommerce' },
  'clubhouse':     { name: 'Clubhouse',         image: 'https://logo.clearbit.com/clubhouse.com',                          icon: '🎙️', color: 'bg-yellow-400/20 text-yellow-300', category: 'social' },
  'fiverr':        { name: 'Fiverr',            image: 'https://logo.clearbit.com/fiverr.com',                             icon: '💚', color: 'bg-green-500/20 text-green-400',   category: 'ecommerce' },
  'freelancer':    { name: 'Freelancer',        image: 'https://logo.clearbit.com/freelancer.com',                         icon: '💼', color: 'bg-blue-500/20 text-blue-400',    category: 'ecommerce' },
  'foodora':       { name: 'Foodora',           image: 'https://logo.clearbit.com/foodora.com',                            icon: '🍱', color: 'bg-pink-600/20 text-pink-400',    category: 'ecommerce' },
  'oldubil':       { name: 'Oldubil',           image: 'https://logo.clearbit.com/oldubil.com',                            icon: '📱', color: 'bg-blue-400/20 text-blue-300',    category: 'other' },
  'iqos':          { name: 'IQOS',             image: 'https://logo.clearbit.com/iqos.com',                               icon: '🔵', color: 'bg-teal-500/20 text-teal-400',    category: 'other' },
  'vfsglobal':     { name: 'VFS Global',        image: 'https://logo.clearbit.com/vfsglobal.com',                          icon: '🌍', color: 'bg-blue-700/20 text-blue-500',    category: 'other' },
  'vfs':           { name: 'VFS Global',        image: 'https://logo.clearbit.com/vfsglobal.com',                          icon: '🌍', color: 'bg-blue-700/20 text-blue-500',    category: 'other' },
  'protonmail':    { name: 'ProtonMail',        image: 'https://logo.clearbit.com/proton.me',                              icon: '🔒', color: 'bg-purple-700/20 text-purple-500', category: 'tech' },
  'steam':         { name: 'Steam',            image: 'https://logo.clearbit.com/steampowered.com',                       icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'netflix':       { name: 'Netflix',          image: 'https://logo.clearbit.com/netflix.com',                            icon: '🎬', color: 'bg-red-600/20 text-red-500',      category: 'game' },
  'spotify':       { name: 'Spotify',          image: 'https://logo.clearbit.com/spotify.com',                            icon: '🎵', color: 'bg-green-500/20 text-green-400',   category: 'game' },
  'blizzard':      { name: 'Blizzard',         image: 'https://logo.clearbit.com/blizzard.com',                           icon: '🎮', color: 'bg-blue-500/20 text-blue-400',    category: 'game' },
  'roblox':        { name: 'Roblox',           image: 'https://logo.clearbit.com/roblox.com',                             icon: '🧱', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'nintendo':      { name: 'Nintendo',         image: 'https://logo.clearbit.com/nintendo.com',                           icon: '🎮', color: 'bg-red-500/20 text-red-400',      category: 'game' },
  'playstation':   { name: 'PlayStation',      image: 'https://logo.clearbit.com/playstation.com',                        icon: '🎮', color: 'bg-blue-600/20 text-blue-500',    category: 'game' },
  'disneyplus':    { name: 'Disney+',          image: 'https://logo.clearbit.com/disneyplus.com',                         icon: '🏰', color: 'bg-blue-700/20 text-blue-500',    category: 'game' },
  'hbo':           { name: 'HBO / Max',        image: 'https://logo.clearbit.com/hbomax.com',                             icon: '🎬', color: 'bg-purple-700/20 text-purple-500', category: 'game' },
  'epicgames':     { name: 'Epic Games',       image: 'https://logo.clearbit.com/epicgames.com',                          icon: '🎮', color: 'bg-gray-700/50 text-white',       category: 'game' },
  'supercell':     { name: 'Supercell',        image: 'https://logo.clearbit.com/supercell.com',                          icon: '🎮', color: 'bg-blue-400/20 text-blue-300',    category: 'game' },
  'garena':        { name: 'Garena',           image: 'https://logo.clearbit.com/garena.com',                             icon: '🎮', color: 'bg-orange-500/20 text-orange-400', category: 'game' },
  'uber':          { name: 'Uber',             image: 'https://logo.clearbit.com/uber.com',                               icon: '🚕', color: 'bg-gray-800 text-white',           category: 'ecommerce' },
  'lyft':          { name: 'Lyft',             image: 'https://logo.clearbit.com/lyft.com',                               icon: '🚗', color: 'bg-pink-500/20 text-pink-400',    category: 'ecommerce' },
  'airbnb':        { name: 'Airbnb',           image: 'https://logo.clearbit.com/airbnb.com',                             icon: '🏠', color: 'bg-red-500/20 text-red-400',      category: 'ecommerce' },
  'booking':       { name: 'Booking.com',      image: 'https://logo.clearbit.com/booking.com',                            icon: '🏨', color: 'bg-blue-600/20 text-blue-500',    category: 'ecommerce' },
  'payoneer':      { name: 'Payoneer',         image: 'https://logo.clearbit.com/payoneer.com',                           icon: '💳', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'revolut':       { name: 'Revolut',          image: 'https://logo.clearbit.com/revolut.com',                            icon: '💳', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'wise':          { name: 'Wise',             image: 'https://logo.clearbit.com/wise.com',                               icon: '💸', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'stripe':        { name: 'Stripe',           image: 'https://logo.clearbit.com/stripe.com',                             icon: '💳', color: 'bg-indigo-500/20 text-indigo-400', category: 'finance' },
  'kraken':        { name: 'Kraken',           image: 'https://logo.clearbit.com/kraken.com',                             icon: '🐙', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'kucoin':        { name: 'KuCoin',           image: 'https://logo.clearbit.com/kucoin.com',                             icon: '💰', color: 'bg-green-500/20 text-green-400',   category: 'finance' },
  'okx':           { name: 'OKX',              image: 'https://logo.clearbit.com/okx.com',                                icon: '📊', color: 'bg-gray-700/50 text-white',       category: 'finance' },
  'mexc':          { name: 'MEXC',             image: 'https://logo.clearbit.com/mexc.com',                               icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bitget':        { name: 'Bitget',           image: 'https://logo.clearbit.com/bitget.com',                             icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'gate':          { name: 'Gate.io',          image: 'https://logo.clearbit.com/gate.io',                                icon: '📊', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'huobi':         { name: 'HTX (Huobi)',      image: 'https://logo.clearbit.com/htx.com',                                icon: '📊', color: 'bg-blue-400/20 text-blue-300',    category: 'finance' },
  'bingx':         { name: 'BingX',            image: 'https://logo.clearbit.com/bingx.com',                              icon: '📊', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'bybit':         { name: 'Bybit',            image: 'https://logo.clearbit.com/bybit.com',                              icon: '💰', color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'binance':       { name: 'Binance',          image: 'https://logo.clearbit.com/binance.com',                            icon: '₿',  color: 'bg-yellow-500/20 text-yellow-400', category: 'finance' },
  'coinbase':      { name: 'Coinbase',         image: 'https://logo.clearbit.com/coinbase.com',                           icon: '₿',  color: 'bg-blue-600/20 text-blue-500',    category: 'finance' },
  'paypal':        { name: 'PayPal',           image: 'https://logo.clearbit.com/paypal.com',                             icon: '💳', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'dana':          { name: 'DANA',             image: 'https://logo.clearbit.com/dana.id',                                icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'ovo':           { name: 'OVO',              image: 'https://logo.clearbit.com/ovo.id',                                 icon: '💜', color: 'bg-purple-500/20 text-purple-400', category: 'finance' },
  'gcash':         { name: 'GCash',            image: 'https://logo.clearbit.com/gcash.com',                              icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'finance' },
  'truemoney':     { name: 'TrueMoney',        image: 'https://logo.clearbit.com/truemoney.com',                          icon: '💰', color: 'bg-orange-500/20 text-orange-400', category: 'finance' },
  'momo':          { name: 'MoMo',             image: 'https://logo.clearbit.com/momo.vn',                                icon: '💜', color: 'bg-pink-500/20 text-pink-400',    category: 'finance' },
  'linkaja':       { name: 'LinkAja',          image: 'https://logo.clearbit.com/linkaja.com',                            icon: '❤️', color: 'bg-red-500/20 text-red-400',      category: 'finance' },
  'tinder':        { name: 'Tinder',           image: 'https://logo.clearbit.com/tinder.com',                             icon: '🔥', color: 'bg-orange-500/20 text-orange-400', category: 'dating' },
  'bumble':        { name: 'Bumble',           image: 'https://logo.clearbit.com/bumble.com',                             icon: '🐝', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'hinge':         { name: 'Hinge',            image: 'https://logo.clearbit.com/hinge.co',                               icon: '💗', color: 'bg-rose-500/20 text-rose-400',    category: 'dating' },
  'badoo':         { name: 'Badoo',            image: 'https://logo.clearbit.com/badoo.com',                              icon: '🟣', color: 'bg-purple-500/20 text-purple-400', category: 'dating' },
  'okcupid':       { name: 'OkCupid',          image: 'https://logo.clearbit.com/okcupid.com',                            icon: '💙', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'match':         { name: 'Match',            image: 'https://logo.clearbit.com/match.com',                              icon: '💗', color: 'bg-red-500/20 text-red-400',      category: 'dating' },
  'grindr':        { name: 'Grindr',           image: 'https://logo.clearbit.com/grindr.com',                             icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400', category: 'dating' },
  'pof':           { name: 'POF',              image: 'https://logo.clearbit.com/pof.com',                                icon: '🐟', color: 'bg-blue-500/20 text-blue-400',    category: 'dating' },
  'google':        { name: 'Google / Gmail',   image: 'https://logo.clearbit.com/google.com',                             icon: '✉️', color: 'bg-red-500/20 text-red-400',      category: 'tech' },
  'apple':         { name: 'Apple ID',         image: 'https://logo.clearbit.com/apple.com',                              icon: '🍎', color: 'bg-gray-500/20 text-gray-400',    category: 'tech' },
  'microsoft':     { name: 'Microsoft',        image: 'https://logo.clearbit.com/microsoft.com',                          icon: '🪟', color: 'bg-blue-500/20 text-blue-400',    category: 'tech' },
  'openai':        { name: 'ChatGPT / OpenAI', image: 'https://logo.clearbit.com/openai.com',                             icon: '🤖', color: 'bg-emerald-500/20 text-emerald-400', category: 'tech' },
  'github':        { name: 'GitHub',           image: 'https://logo.clearbit.com/github.com',                             icon: '💻', color: 'bg-gray-700/50 text-white',       category: 'tech' },
  'amazon':        { name: 'Amazon',           image: 'https://logo.clearbit.com/amazon.com',                             icon: '☁️', color: 'bg-orange-500/20 text-orange-400', category: 'tech' },
  'shopee':        { name: 'Shopee',           image: 'https://logo.clearbit.com/shopee.co.id',                           icon: '🛍️', color: 'bg-orange-500 text-white',        category: 'ecommerce' },
  'gojek':         { name: 'Gojek',            image: 'https://logo.clearbit.com/gojek.com',                              icon: '🏍️', color: 'bg-green-600 text-white',         category: 'ecommerce' },
  'grab':          { name: 'Grab',             image: 'https://logo.clearbit.com/grab.com',                               icon: '🚗', color: 'bg-green-400/20 text-green-400',   category: 'ecommerce' },
  'tokopedia':     { name: 'Tokopedia',        image: 'https://logo.clearbit.com/tokopedia.com',                          icon: '🦉', color: 'bg-green-500/20 text-green-500',   category: 'ecommerce' },
  'lazada':        { name: 'Lazada',           image: 'https://logo.clearbit.com/lazada.com',                             icon: '🛍️', color: 'bg-indigo-500/20 text-indigo-400', category: 'ecommerce' },
  'whatsapp':      { name: 'WhatsApp',         image: 'https://logo.clearbit.com/whatsapp.com',                           icon: '💬', color: 'bg-green-500/20 text-green-400',   category: 'social' },
  'telegram':      { name: 'Telegram',         image: 'https://logo.clearbit.com/telegram.org',                           icon: '✈️', color: 'bg-blue-500/20 text-blue-400',    category: 'social' },
  'instagram':     { name: 'Instagram',        image: 'https://logo.clearbit.com/instagram.com',                          icon: '📸', color: 'bg-pink-500/20 text-pink-400',    category: 'social' },
  'facebook':      { name: 'Facebook',         image: 'https://logo.clearbit.com/facebook.com',                           icon: '📘', color: 'bg-blue-600/20 text-blue-500',    category: 'social' },
  'tiktok':        { name: 'TikTok',           image: 'https://logo.clearbit.com/tiktok.com',                             icon: '🎵', color: 'bg-gray-800 text-white',           category: 'social' },
  'twitter':       { name: 'Twitter / X',      image: 'https://logo.clearbit.com/x.com',                                  icon: '🐦', color: 'bg-blue-400/20 text-blue-400',    category: 'social' },
  'discord':       { name: 'Discord',          image: 'https://logo.clearbit.com/discord.com',                            icon: '🎮', color: 'bg-indigo-500/20 text-indigo-400', category: 'social' },
};

// ==========================================
// DOMAIN MAP — serviceId → domain website
// Dipakai untuk auto-fetch logo via Clearbit
// Tambah entry baru kapan saja tanpa ubah UI
// ==========================================
const SERVICE_DOMAIN_MAP: Record<string, string> = {
  // Social
  'whatsapp':'whatsapp.com','telegram':'telegram.org','instagram':'instagram.com',
  'facebook':'facebook.com','tiktok':'tiktok.com','twitterx':'x.com','twitter':'x.com',
  'discord':'discord.com','snapchat':'snapchat.com','viber':'viber.com','wechat':'wechat.com',
  'line':'line.me','kakaotalk':'kakao.com','vk':'vk.com','vkontakte':'vk.com',
  'odnoklassniki':'ok.ru','ok':'ok.ru','linkedin':'linkedin.com','pinterest':'pinterest.com',
  'reddit':'reddit.com','tumblr':'tumblr.com','quora':'quora.com','twitch':'twitch.tv',
  'threads':'threads.net','signal':'signal.org','skype':'skype.com','zalo':'zalo.me',
  'imo':'imo.im','clubhouse':'clubhouse.com','badoo':'badoo.com','meetme':'meetme.com',
  'tagged':'tagged.com','mamba':'mamba.ru','lovoo':'lovoo.com','happn':'happn.com',
  // Tech
  'google':'google.com','apple':'apple.com','microsoft':'microsoft.com','yahoo':'yahoo.com',
  'openai':'openai.com','anthropic':'anthropic.com','github':'github.com','amazon':'amazon.com',
  'mailru':'mail.ru','yandex':'yandex.ru','protonmail':'proton.me','naver':'naver.com',
  'azure':'azure.microsoft.com','zoom':'zoom.us','dropbox':'dropbox.com','slack':'slack.com',
  'notion':'notion.so','figma':'figma.com','adobe':'adobe.com','canva':'canva.com',
  'chatgpt':'chat.openai.com','gemini':'gemini.google.com','stripe':'stripe.com',
  'shopify':'shopify.com','wordpress':'wordpress.com','wix':'wix.com','squarespace':'squarespace.com',
  'godaddy':'godaddy.com','namecheap':'namecheap.com','cloudflare':'cloudflare.com',
  'digitalocean':'digitalocean.com','linode':'linode.com','vultr':'vultr.com',
  'twilio':'twilio.com','sendgrid':'sendgrid.com','mailchimp':'mailchimp.com',
  'hubspot':'hubspot.com','salesforce':'salesforce.com','zendesk':'zendesk.com',
  'intercom':'intercom.com','freshdesk':'freshdesk.com','jira':'atlassian.com',
  'trello':'trello.com','asana':'asana.com','monday':'monday.com',
  // E-Commerce
  'shopee':'shopee.co.id','gojek':'gojek.com','grab':'grab.com','tokopedia':'tokopedia.com',
  'lazada':'lazada.com','alibaba':'alibaba.com','aliexpress':'aliexpress.com',
  'taobao':'taobao.com','ebay':'ebay.com','uber':'uber.com','airbnb':'airbnb.com',
  'booking':'booking.com','shein':'shein.com','ozon':'ozon.ru','wildberries':'wildberries.ru',
  'avito':'avito.ru','foodpanda':'foodpanda.com','doordash':'doordash.com',
  'ubereats':'ubereats.com','grubhub':'grubhub.com','deliveroo':'deliveroo.com',
  'lyft':'lyft.com','bolt':'bolt.eu','rappi':'rappi.com','ifood':'ifood.com.br',
  'swiggy':'swiggy.com','zomato':'zomato.com','meituan':'meituan.com',
  'mercadolibre':'mercadolibre.com','flipkart':'flipkart.com','meesho':'meesho.com',
  'amazon_video':'primevideo.com','jd':'jd.com','pinduoduo':'pinduoduo.com',
  'alipay':'alipay.com','alfagift':'alfagift.id','bukalapak':'bukalapak.com','meituan':'meituan.com',
  'xiaohongshu':'xiaohongshu.com','douyin':'douyin.com','kwai':'kwai.com',
  'kuaishou':'kuaishou.com','bilibili':'bilibili.com','capcut':'capcut.com',
  'baidu':'baidu.com','youtube':'youtube.com','neteller':'neteller.com',
  'perfectmoney':'perfectmoney.com','payeer':'payeer.com',
  // Finance & Crypto  
  'paypal':'paypal.com','binance':'binance.com','coinbase':'coinbase.com',
  'bybit':'bybit.com','kucoin':'kucoin.com','okx':'okx.com','kraken':'kraken.com',
  'mexc':'mexc.com','bitget':'bitget.com','gate':'gate.io','huobi':'huobi.com',
  'bingx':'bingx.com','payoneer':'payoneer.com','revolut':'revolut.com',
  'skrill':'skrill.com','crypto':'crypto.com','wise':'wise.com',
  'transferwise':'wise.com','webmoney':'webmoney.ru','qiwi':'qiwi.com',
  'ovo':'ovo.id','dana':'dana.id','gcash':'gcash.com','truemoney':'truemoney.com',
  'momo':'momo.vn','linkaja':'linkaja.com','paymaya':'maya.ph','gopay':'gojek.com',
  'dana_app':'dana.id','neteller':'neteller.com','payeer':'payeer.com',
  'skrill':'skrill.com','perfectmoney':'perfectmoney.com','paxful':'paxful.com',
  'remitly':'remitly.com','moneygram':'moneygram.com','westernunion':'westernunion.com',
  'monzo':'monzo.com','n26':'n26.com','chime':'chime.com','cash_app':'cash.app',
  'venmo':'venmo.com','zelle':'zellepay.com','robinhood':'robinhood.com',
  'etoro':'etoro.com','trading212':'trading212.com','plus500':'plus500.com',
  // Streaming & Gaming
  'netflix':'netflix.com','spotify':'spotify.com','steam':'store.steampowered.com',
  'epicgames':'epicgames.com','xbox':'xbox.com','playstation':'playstation.com',
  'nintendo':'nintendo.com','blizzard':'blizzard.com','roblox':'roblox.com',
  'disneyplus':'disneyplus.com','hulu':'hulu.com','hbo':'hbomax.com','deezer':'deezer.com',
  'crunchyroll':'crunchyroll.com','tidal':'tidal.com','garena':'garena.com',
  'supercell':'supercell.com','ea':'ea.com','ubisoft':'ubisoft.com','faceit':'faceit.com',
  'twitch':'twitch.tv','youtube':'youtube.com','vimeo':'vimeo.com',
  'soundcloud':'soundcloud.com','bandcamp':'bandcamp.com','apple_music':'music.apple.com',
  'amazon_music':'music.amazon.com','pandora':'pandora.com','iheart':'iheart.com',
  'paramount':'paramountplus.com','peacock':'peacocktv.com','discovery':'discoveryplus.com',
  'funimation':'funimation.com','vrv':'vrv.co','aniwatch':'aniwatch.to',
  'valorant':'playvalorant.com','leagueoflegends':'leagueoflegends.com',
  'dota2':'dota2.com','csgo':'store.steampowered.com','minecraft':'minecraft.net',
  'fortnite':'epicgames.com','pubg':'pubg.com','freefire':'ff.garena.com',
  'mobilelegends':'mobilelegends.com','genshin':'genshin.hoyoverse.com',
  'cococ':'coccoc.com','wattpad':'wattpad.com',
  // Dating
  'tinder':'tinder.com','bumble':'bumble.com','hinge':'hinge.co','match':'match.com',
  'okcupid':'okcupid.com','grindr':'grindr.com','pof':'pof.com','meetic':'meetic.com',
  'lovoo':'lovoo.com','happn':'happn.com','zoosk':'zoosk.com','eharmony':'eharmony.com',
  'meetme':'meetme.com','mamba':'mamba.ru',
  // Alias & tambahan baru
  'cryptocom':'crypto.com','crypto.com':'crypto.com',
  'subito':'subito.it','swiggy':'swiggy.com','papara':'papara.com',
  'mcdonalds':'mcdonalds.com','mcdonald':'mcdonalds.com',
  'clubhouse':'clubhouse.com','fiverr':'fiverr.com','freelancer':'freelancer.com',
  'foodora':'foodora.com','oldubil':'oldubil.com','iqos':'iqos.com',
  'vfsglobal':'vfsglobal.com','vfs':'vfsglobal.com',
  'bazos':'bazos.cz','indrive':'indrive.com','indriver':'indrive.com',
  'tradingview':'tradingview.com','zara':'zara.com','kakaot':'kakaomobility.com',
  'advcash':'advcash.com','tokocrypto':'tokocrypto.com','fazz':'fazz.com',
  'kfc':'kfc.com','starbucks':'starbucks.com','alfagift':'alfagift.id',
  'dana_app':'dana.id','gopay':'gojek.com','momo':'momo.vn',
  'ovo':'ovo.id','dana':'dana.id','gcash':'gcash.com','truemoney':'truemoney.com',
  'linkaja':'linkaja.com','paymaya':'maya.ph',
};

// ==========================================
// Helper: dapatkan URL logo terbaik untuk suatu service
// Urutan: Clearbit (kualitas tinggi) → Google Favicon (fallback)
// ==========================================
const getLogoUrl = (serviceId: string): string | null => {
  const domain = SERVICE_DOMAIN_MAP[serviceId];
  if (!domain) return null;
  // Clearbit Logo API: gratis, kualitas tinggi, cover ribuan brand
  return `https://logo.clearbit.com/${domain}`;
};

// Fungsi helper: ambil metadata layanan lengkap
const getServiceMeta = (serviceId: string) => {
  // 1. Coba dari SERVICES hardcoded (prioritas tertinggi)
  const known = SERVICES.find(s => s.id === serviceId);
  if (known) return known;
  // 2. Coba dari SERVICE_ICON_MAP
  const mapped = SERVICE_ICON_MAP[serviceId];
  if (mapped) return { id: serviceId, ...mapped };
  // 3. Auto-generate: nama cantik + logo dari domain map
  const logoUrl = getLogoUrl(serviceId);
  return {
    id: serviceId,
    name: serviceId.split('_').map((w:string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    icon: '📱',
    color: 'bg-gray-700/50 text-gray-300',
    category: 'other',
    image: logoUrl, // null jika domain tidak diketahui
  };
};

// Fungsi helper: ambil metadata layanan untuk produk Server 2 (SMS-Activate).
// Prioritaskan saName dari API untuk menghindari mismatch icon akibat pemetaan
// kode SA yang ambigu (mis: "hb" → "hbo" padahal nama aslinya Hepsiburada.com).
const getSAServiceMeta = (serviceId: string, saName?: string) => {
  if (!saName) return getServiceMeta(serviceId);

  const saNameLower = saName.toLowerCase();

  // 1. Exact name match di SERVICES
  const exactMatch = SERVICES.find(s => s.name.toLowerCase() === saNameLower);
  if (exactMatch) return { ...exactMatch, name: saName };

  // 2. Partial match: saName contains a known service name or vice-versa
  const partialMatch = SERVICES.find(s =>
    saNameLower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(saNameLower)
  );
  if (partialMatch) return { ...partialMatch, name: saName };

  // 3. Coba Clearbit dari domain yang ada di saName (mis: "Hepsiburada.com" → logo.clearbit.com/hepsiburada.com)
  const domainMatch = saName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
  const clearbitLogo = domainMatch
    ? `https://logo.clearbit.com/${domainMatch[1].toLowerCase()}`
    : null;

  // 4. Fallback ke baseMeta, ganti nama + logo jika ada domain di saName
  const baseMeta = getServiceMeta(serviceId);
  return {
    ...baseMeta,
    name: saName,
    image: clearbitLogo ?? baseMeta.image,
  };
};

const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'social', label: 'Sosial Media' },
  { id: 'tech', label: 'Tech & Akun' },
  { id: 'ecommerce', label: 'E-Commerce' },
  { id: 'game', label: 'Gaming & Hiburan' },
  { id: 'finance', label: 'Keuangan & Crypto' },
  { id: 'dating', label: 'Dating' },
  { id: 'other', label: 'Lainnya' }, // Layanan dari 5sim yang belum dikategorikan
];

const getIsTrending = (countryId, serviceId) => {
  const todayStr = new Date().toLocaleDateString('id-ID');
  let demandHash = 0;
  const demandStr = todayStr + "-" + serviceId + "-" + countryId;
  for (let i = 0; i < demandStr.length; i++) demandHash = demandStr.charCodeAt(i) + ((demandHash << 5) - demandHash);
  return Math.abs(demandHash) % 100 > 80;
};

// ==========================================
// ==========================================
// RUMUS HARGA JUAL - KOMPETITIF & MENGUNTUNGKAN
// ==========================================
//
// Sumber harga: API 5sim (real-time, dalam USD)
// Kurs:         USD_TO_IDR = 16.300 (safe buffer terhadap fluktuasi)
//
// STRATEGI MARGIN — menarik pembeli sekaligus tetap untung:
//   Modal < $0.20   → flat +Rp 1.000  (layanan sangat murah, cukup Rp 1.000)
//   Modal $0.20–0.5 → flat +Rp 1.500  (sweet spot paling laku)
//   Modal > $0.5    → flat +Rp 2.000  (layanan premium, masih kompetitif)
//
// Hasil: harga SELALU lebih murah dari kompetitor yang pakai margin 30–50%,
//        tapi admin tetap dapat untung bersih setiap transaksi.
//
// Contoh nyata:
//   WhatsApp Indo $0.20 → Rp 3.260 + Rp 1.500 = Rp 4.760 → dibulatkan Rp 4.800
//   Telegram US   $1.00 → Rp 16.300 + Rp 2.000 = Rp 18.300 → dibulatkan Rp 18.500

// ✅ SECURITY FIX #9: Kurs dikonfigurasi via env var.
// ⚠️ PERFORMA FIX: NEXT_PUBLIC_* di-embed saat BUILD TIME di Next.js — bukan runtime.
// Mengubah nilai di .env TETAP butuh rebuild/redeploy. Komentar lama menyesatkan.
// Jika ingin update kurs TANPA rebuild: buat endpoint /api/config yang membaca dari
// server-side env var (tanpa prefix NEXT_PUBLIC_) dan fetch nilainya saat app mount.
// Kurs per 06 Apr 2025 (Wise mid-market): $1 = Rp 16.990
const USD_TO_IDR = Number(process.env.NEXT_PUBLIC_USD_TO_IDR) || 16990;

const calcPriceFromUsd = (costUsd) => {
  const validCost = Math.max(0.05, costUsd || 0);   // Guard: minimum $0.05
  const costIdr   = validCost * USD_TO_IDR;

  // ✅ MINIMUM PROFIT GUARANTEE — tidak pernah rugi:
  //   $0.05 × 16300 = Rp 815  + Rp 1.000  = Rp 1.815  → dibulatkan Rp 1.900  (untung Rp 1.085)
  //   $0.20 × 16300 = Rp 3.260 + Rp 1.500  = Rp 4.760  → dibulatkan Rp 4.800  (untung Rp 1.540)
  //   $0.50 × 16300 = Rp 8.150 + Rp 1.500  = Rp 9.650  → dibulatkan Rp 9.700  (untung Rp 1.550)
  //   $1.00 × 16300 = Rp 16.300 + Rp 2.000 = Rp 18.300 → dibulatkan Rp 18.300 (untung Rp 2.000)
  //   WORST CASE (kurs naik 10% ke 18.000): $0.20 modal jadi Rp 3.600 → jual Rp 4.800 → untung Rp 1.200 ✅
  let margin;
  if (validCost < 0.20)       margin = 1000;  // Layanan murah: +Rp 1.000
  else if (validCost <= 0.50) margin = 1500;  // Sweet spot:    +Rp 1.500
  else                        margin = 2000;  // Premium:       +Rp 2.000

  // Bulatkan ke Rp 100 terdekat — harga terlihat lebih tajam vs kompetitor yang bulatkan ke Rp 500/1000
  return Math.ceil((costIdr + margin) / 100) * 100;
};

// ✅ SECURITY FIX: Alias calcPriceFromUsd dihapus — nama menyesatkan (input-nya USD bukan RUB).
// Semua pemanggil kini menggunakan calcPriceFromUsd secara eksplisit.

// TIER PRICING FALLBACK (digunakan saat 5sim tidak bisa diakses)
// Nilai dalam USD — sesuai harga pasar 5sim yang sesungguhnya
const getRealPrice = (countryId, serviceId, tier = 'reguler') => {
  // Harga dasar dalam USD per kategori layanan
  let baseModalUsd = 0.30; // default ~$0.30 USD

  // Layanan premium (demand tinggi)
  if (['whatsapp', 'telegram', 'apple', 'openai', 'paypal', 'binance', 'tinder', 'google'].includes(serviceId)) baseModalUsd = 0.50;
  // Layanan populer menengah
  else if (['instagram', 'facebook', 'twitter', 'tiktok', 'discord', 'gojek', 'shopee', 'grab', 'microsoft', 'github', 'amazon', 'netflix', 'spotify'].includes(serviceId)) baseModalUsd = 0.35;
  // Layanan crypto & finance
  else if (['bybit', 'kucoin', 'coinbase', 'kraken', 'okx', 'mexc', 'bitget', 'huobi', 'gate', 'bingx'].includes(serviceId)) baseModalUsd = 0.42;
  // Layanan dating
  else if (['bumble', 'hinge', 'match', 'okcupid', 'badoo', 'pof', 'grindr'].includes(serviceId)) baseModalUsd = 0.40;

  // Penyesuaian per negara (dalam USD)
  if (['usa', 'england', 'canada', 'germany', 'france', 'japan', 'south_korea', 'australia'].includes(countryId)) baseModalUsd += 0.30;
  else if (['russia', 'vietnam', 'philippines', 'india', 'nigeria', 'kenya'].includes(countryId)) baseModalUsd -= 0.04;
  else if (['indonesia', 'malaysia', 'thailand', 'cambodia', 'myanmar', 'laos'].includes(countryId)) baseModalUsd -= 0.05;

  baseModalUsd = Math.max(0.13, baseModalUsd); // Minimum $0.13 USD

  let finalUsd = baseModalUsd;
  if (tier === 'reguler') finalUsd = baseModalUsd * 1.05;
  if (tier === 'vip') finalUsd = baseModalUsd * 1.38;

  return calcPriceFromUsd(finalUsd);
};

// ==========================================
// 2. FUNGSI API CALL TERLINDUNGI
// ==========================================
// secureApiCall dan clearTokenCache diimpor dari @/lib/apiClient
// Fitur baru: Token Cache otomatis + Rate Limiting per endpoint

// ==========================================
// 3. KONFIGURASI UMUM & HELPER
// ==========================================
// ✅ FIX #3: ADMIN_EMAILS dihapus — tidak aman disimpan di NEXT_PUBLIC_ (terekspos di JS bundle).
// isAdmin sekarang ditentukan dari field `role: 'admin'` di dokumen Firestore user.
// Server API route tetap wajib verifikasi token secara independen.
//
// ⚠️  WAJIB DIPASANG — Firestore Security Rules:
// Tanpa rule ini, user bisa menulis role:'admin' ke dokumen mereka sendiri!
//
//   match /users/{userId} {
//     allow read: if request.auth != null && request.auth.uid == userId;
//     allow create: if request.auth != null && request.auth.uid == userId;
//     allow update: if request.auth != null && request.auth.uid == userId
//       && !request.resource.data.diff(resource.data)
//           .affectedKeys().hasAny(['role', 'balance', 'banned', 'pinHash']);
//   }
//
// Field sensitif (role, balance, banned, pinHash) hanya boleh diubah via
// server-side Admin SDK di dalam API route yang sudah verifikasi token.

const CONTACT = {
  telegram: "PusatNokosCS",
  whatsapp: "6287862306726"
};

export const copyToClipboardHelper = (text, showToastFn) => {
  const fallbackCopy = (textToCopy) => {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (err) { console.error('Fallback Copy gagal', err); }
    document.body.removeChild(textArea);
  };

  if (!navigator.clipboard || !window.isSecureContext) {
    fallbackCopy(text);
    if(showToastFn) showToastFn('Berhasil disalin!', 'success');
  } else {
    navigator.clipboard.writeText(text).then(() => {
      if(showToastFn) showToastFn('Berhasil disalin!', 'success');
    }).catch(() => {
      fallbackCopy(text);
      if(showToastFn) showToastFn('Berhasil disalin!', 'success');
    });
  }
};

const downloadCSV = (data, filename) => {
  if (!data || !data.length) return;
  // ✅ SECURITY FIX #6: CSV Injection — karakter formula Excel (=, +, -, @, tab, CR)
  // di awal nilai bisa dieksekusi sebagai formula saat file dibuka di Excel/Sheets.
  // Solusi: tambahkan prefix kutip tunggal agar diperlakukan sebagai teks biasa.
  const sanitizeCell = (val) => {
    const str = String(val == null ? '' : val);
    // Jika dimulai dengan karakter formula berbahaya, awali dengan apostrof
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  };
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => `"${sanitizeCell(val).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

// --- THEME & CONFIG ---
const THEME = {
  bg: 'bg-[#050000]', 
  panel: 'bg-[#0a0202]/95', 
  panelSolid: 'bg-[#0a0202]',
  border: 'border-red-500/20',
  text: 'text-gray-300',
  textMuted: 'text-red-100/40',
  heading: 'text-white',
  accentPrimary: 'text-red-500',
  accentSecondary: 'text-white',
  gradientPrimary: 'bg-gradient-to-r from-red-600 via-red-700 to-rose-900',
  gradientText: 'bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-orange-200 to-red-300',
  glass: 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
};

const AppLogo = ({ className = "w-10 h-10", size, iconSize }: { className?: string; size?: string; iconSize?: string }) => {
  const resolvedClass = size || className;
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${resolvedClass} rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.5)]`}>
      <rect width="100" height="100" fill="#ba1111" />
      <path d="M 45 25 L 65 35 L 65 55 L 45 45 Z" fill="white" />
      <path d="M 35 45 L 45 50 L 45 75 L 35 65 Z" fill="white" />
    </svg>
  );
};

// --- REUSABLE COMPONENTS ---

// ✅ PERF: React.memo — tidak re-render kecuali service/className berubah
// ✅ LOGO: fallback chain via useRef supaya tidak trigger render loop
// ✅ FIX: Clearbit diprioritaskan sebagai sumber utama (PNG, lebih stabil dari SVG iconify)
//         urutan: clearbit → iconify (image field) → google favicon → emoji
const ServiceIcon = React.memo(function ServiceIcon({ service, className = "w-12 h-12 text-xl" }: { service: any; className?: string }) {
  // Tentukan sumber pertama: kalau ada domain di map, langsung pakai clearbit (lebih reliable)
  const getInitialSrc = (svc: any): string | null => {
    const domain = SERVICE_DOMAIN_MAP[svc?.id];
    if (domain) return `https://logo.clearbit.com/${domain}`;
    return svc?.image || null; // fallback ke iconify SVG jika tidak ada di domain map
  };

  const [imgSrc, setImgSrc] = useState<string | null>(() => getInitialSrc(service));
  const fallbackStage = useRef<number>(0);

  React.useEffect(() => {
    setImgSrc(getInitialSrc(service));
    fallbackStage.current = 0;
  }, [service?.id, service?.image]);

  const handleImgError = useCallback(() => {
    const domain = SERVICE_DOMAIN_MAP[service?.id];
    if (fallbackStage.current === 0 && service?.image) {
      // Stage 1: Coba iconify/image URL asli (sudah skip clearbit karena itu stage-0)
      fallbackStage.current = 1;
      setImgSrc(service.image);
      return;
    }
    if (fallbackStage.current <= 1 && domain) {
      // Stage 2: Google Favicon (selalu ada untuk domain valid)
      fallbackStage.current = 2;
      setImgSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      return;
    }
    // Stage 3: Tampilkan emoji icon
    fallbackStage.current = 3;
    setImgSrc(null);
  }, [service?.id, service?.image]);

  return (
    <div className={`${className} rounded-xl flex items-center justify-center border border-white/5 overflow-hidden ${service?.color || 'bg-gray-800'} p-2`}>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={service?.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain filter drop-shadow-md"
          onError={handleImgError}
        />
      ) : (
        <span className="text-xl leading-none select-none">{service?.icon || '📱'}</span>
      )}
    </div>
  );
});

const Button = ({ children, variant = 'primary', className = '', onClick, disabled, type = 'button' }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96] select-none text-sm";
  const variants = {
    primary: `${THEME.gradientPrimary} text-white shadow-[0_2px_20px_rgba(220,38,38,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.55)] hover:brightness-110 px-5 py-2.5 border border-red-400/20`,
    secondary: `bg-white/95 text-red-900 font-black hover:bg-white shadow-[0_2px_15px_rgba(255,255,255,0.08)] px-5 py-2.5`,
    outline: `border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 px-5 py-2.5 backdrop-blur-sm`,
    telegram: `border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:border-blue-600 hover:text-white px-5 py-2.5 backdrop-blur-sm`,
    ghost: "text-gray-400 hover:text-white hover:bg-white/[0.06] px-4 py-2 rounded-xl",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 px-4 py-2 rounded-xl",
    whatsapp: "bg-gradient-to-r from-[#25D366] to-[#1ab557] text-white shadow-[0_2px_20px_rgba(37,211,102,0.25)] hover:brightness-110 px-5 py-2.5 border border-[#25D366]/20"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '', hover = false }) => (
  <div className={`${THEME.glass} shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] ${hover ? 'hover:border-red-500/25 hover:shadow-[0_12px_48px_rgba(0,0,0,0.6),0_0_20px_rgba(220,38,38,0.06),inset_0_1px_0_rgba(255,255,255,0.07)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer' : ''} rounded-2xl p-5 md:p-6 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'info' }) => {
  const variants = {
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    premium: 'bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(220,38,38,0.2)]',
    admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${variants[variant]}`}>
      {children}
    </span>
  );
};

const formatRupiah = (value: number): string => {
  const safeValue = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(safeValue);
};

const FormatRupiah = ({ value }: { value: number }) => <>{formatRupiah(value)}</>;

const getNumericId = (uid) => {
  if (!uid) return '';
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; 
  }
  const positiveHash = Math.abs(hash);
  return positiveHash.toString().padStart(10, '0').slice(0, 10);
};

const useCountdown = (expiresAt, isActive, onExpire) => {
  const [seconds, setSeconds] = useState(0);
  const onExpireRef = useRef(onExpire);
  const hasExpired = useRef(false); 

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // ✅ FIX: Normalize expiresAt ke number (ms) agar React deps tidak
  // terus berubah setiap Firestore snapshot kirim Timestamp object baru.
  const expiresAtMs = useMemo(() => {
    if (!expiresAt) return 0;
    if (typeof expiresAt === 'number') return expiresAt;
    if (typeof expiresAt === 'string') return new Date(expiresAt).getTime();
    // Firestore Timestamp object
    if (typeof expiresAt?.toMillis === 'function') return expiresAt.toMillis();
    // Plain object { seconds, nanoseconds } — Firestore serialized
    if (expiresAt?.seconds) return expiresAt.seconds * 1000 + Math.floor((expiresAt.nanoseconds || 0) / 1e6);
    return 0;
  }, [
    typeof expiresAt === 'number' ? expiresAt
    : typeof expiresAt === 'string' ? expiresAt
    : expiresAt?.seconds ?? 0
  ]);

  useEffect(() => {
    if (!isActive || !expiresAtMs) {
      setSeconds(0);
      hasExpired.current = false;
      return;
    }

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
      setSeconds(remaining);
      if (remaining <= 0 && !hasExpired.current) {
        hasExpired.current = true;
        if (onExpireRef.current) onExpireRef.current();
      }
    };

    hasExpired.current = false;
    tick(); 
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAtMs, isActive]);

  const formatTime = () => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  return { seconds, formatTime };
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-[#140505] border-t border-white/5">
      <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">
        Halaman {currentPage} dari {totalPages}
      </span>
      <div className="flex gap-2">
        <button 
          disabled={currentPage === 1} 
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          disabled={currentPage === totalPages} 
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentPage, setCurrentPage] = useState(() => { try { return sessionStorage.getItem('pn_current_page') || 'landing'; } catch { return 'landing'; } });
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true); // true sampai Firebase confirm session
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inventory, setInventory] = useState([]); 
  
  // State Pengumuman
  const [announcement, setAnnouncement] = useState({ text: '', isActive: false });
  const [maintenance, setMaintenance] = useState({ isActive: false, message: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Inject premium fonts
    const ids = ['pn-font-preconnect','pn-font-gstatic','pn-font-link','pn-font-style'];
    if (!document.getElementById(ids[0])) {
      const lp = document.createElement('link'); lp.id=ids[0]; lp.rel='preconnect'; lp.href='https://fonts.googleapis.com'; document.head.appendChild(lp);
      const lg = document.createElement('link'); lg.id=ids[1]; lg.rel='preconnect'; lg.href='https://fonts.gstatic.com'; lg.crossOrigin='anonymous'; document.head.appendChild(lg);
      const lf = document.createElement('link'); lf.id=ids[2]; lf.rel='stylesheet'; lf.href='https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap'; document.head.appendChild(lf);
      const st = document.createElement('style'); st.id=ids[3];
      st.textContent = `*,button,input{font-family:'Sora',sans-serif!important}.mono-code,.font-mono{font-family:'JetBrains Mono',monospace!important}.scrollbar-custom::-webkit-scrollbar,.custom-scrollbar::-webkit-scrollbar{width:3px}.scrollbar-custom::-webkit-scrollbar-thumb,.custom-scrollbar::-webkit-scrollbar-thumb{background:rgba(220,38,38,.25);border-radius:9px}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.animate-float{animation:float 4s ease-in-out infinite}@keyframes pn-pulse{0%,100%{opacity:.6}50%{opacity:1}}.animate-pn-pulse{animation:pn-pulse 2s ease-in-out infinite}@keyframes marquee{0%{transform:translateX(0%)}100%{transform:translateX(-50%)}}.animate-marquee{animation:marquee 18s linear infinite;will-change:transform}.animate-marquee:hover{animation-play-state:paused}.announcement-track{display:flex;width:max-content}`;
      document.head.appendChild(st);
    }
  }, []);

  // FIX PERF: Inactivity timer — hapus mousemove & scroll (terpanggil ratusan kali/detik)
  // Gunakan throttle 5 detik agar resetTimer tidak dipanggil terus-menerus
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
    let lastCall = 0;
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastCall < 5000) return; // throttle 5 detik
      lastCall = now;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (auth && auth.currentUser) {
          signOut(auth);
          showToast('Sesi berakhir karena tidak ada aktivitas selama 60 menit.', 'error');
        }
      }, 3600000);
    };

    // HAPUS 'mousemove' dan 'scroll' — terlalu banyak event, bikin scroll lag
    const events = ['mousedown', 'keydown', 'touchstart'];
    if (typeof window !== 'undefined' && user) {
      events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
      resetTimer();
    }
    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (typeof window !== 'undefined') {
        events.forEach(e => document.removeEventListener(e, resetTimer));
      }
    };
  }, [user]);

  // FIX PERF: Lazy inventory — dulu precompute 13.000 item (130×100) saat mount
  // Sekarang generate tanpa isTrending, hitung isTrending saat item di-render saja
  useEffect(() => {
    const fallbackData = [];
    COUNTRIES.forEach(c => {
      SERVICES.forEach(s => {
        fallbackData.push({
          id: `${c.id}-${s.id}`,
          countryId: c.id,
          serviceId: s.id,
          // isTrending dihitung lazy saat render, bukan di sini
        });
      });
    });
    setInventory(fallbackData);
  }, []);

  useEffect(() => {
    if (!auth || !db) return; 

    let unsubscribeUser;
    let unsubscribeOrders;
    let unsubscribeTransactions;
    let unsubscribeAnnouncement;

    const clearAllListeners = () => {
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeTransactions) unsubscribeTransactions();
      if (unsubscribeAnnouncement) unsubscribeAnnouncement();
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      clearAllListeners();

      if (firebaseUser) {
        // ✅ FIX BLANK SCREEN: Cek flag registrasi SEBELUM setUser dipanggil.
        // Kalau user masih di tahap set-PIN setelah OTP, jangan ubah state user dulu —
        // supaya kondisi render '!user && currentPage === register' tetap TRUE
        // dan AuthPage dengan step 'set-pin' tetap tampil (bukan DashboardLayout yang kosong).
        const isRegistering = typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('registering') === '1';
        if (isRegistering) return;

        // ✅ SECURITY FIX KRITIS #1: isAdmin diambil dari JWT Custom Claim (server-side),
        // BUKAN dari field `role` di Firestore yang bisa dimanipulasi client.
        // Cara set custom claim: admin.auth().setCustomUserClaims(uid, { admin: true })
        // via Firebase Admin SDK di server. Setelah di-set, user perlu login ulang
        // atau tunggu token refresh (~1 jam) agar claim aktif.
        const tokenResult = await firebaseUser.getIdTokenResult(/* forceRefresh */ true);
        const isAdminFromClaim = tokenResult.claims?.admin === true;

        setUser({ 
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Pengguna', 
          email: firebaseUser.email,
          // role hanya dipakai untuk display label — keputusan akses TIDAK boleh dari sini
          role: isAdminFromClaim ? 'admin' : 'user',
          isAdmin: isAdminFromClaim, // ✅ sumber kebenaran untuk akses admin di UI
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.displayName || 'User'}&backgroundColor=dc2626` 
        });

        // 1. Listen User Profile
        unsubscribeUser = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
             const data = docSnap.data();
             if (data.banned) {
                showToast('Akun Anda telah ditangguhkan oleh Admin.', 'error');
                signOut(auth);
                return;
             }
             setBalance(data.balance || 0);
             // ✅ SECURITY: hasPinHash dari Firestore (untuk UX/redirect saja, bukan auth decision)
             // isAdmin tetap dari JWT claim yang sudah di-set saat login di atas — TIDAK dioverride dari Firestore
             setUser(prev => prev ? {
               ...prev,
               hasPinHash: !!data.pinHash, // dipakai oleh navigate() guard
               // SENGAJA tidak mengambil role/isAdmin dari data Firestore di sini
             } : prev);
          }
        }, (error) => { if (process.env.NODE_ENV === 'development') console.warn("Firebase (Profile):", error.message); });

        // 2. Listen Orders
        const ordersRef = collection(db, "users", firebaseUser.uid, "orders");
        const ordersQuery = query(ordersRef, orderBy("timestamp", "desc"), limit(100));
        const handleOrdersSnapshot = (snapshot) => {
          const fetchedOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOrders.sort((a, b) => {
            const timeA = a.timestamp ?? (a.createdAt?.toMillis?.() ?? 0);
            const timeB = b.timestamp ?? (b.createdAt?.toMillis?.() ?? 0);
            return timeB - timeA;
          });
          setOrders(fetchedOrders);
          setIsLoadingOrders(false);
        };
        const handleOrdersError = (error) => {
          if (process.env.NODE_ENV === 'development') console.warn("Firebase (Orders):", error.message);
          // Fallback tanpa orderBy jika index belum dibuat
          unsubscribeOrders = onSnapshot(ordersRef, handleOrdersSnapshot);
        };
        unsubscribeOrders = onSnapshot(ordersQuery, handleOrdersSnapshot, handleOrdersError);

        // 3. Listen Transactions (subcollection: OTP purchases, refunds, dll)
        let subTx = [];
        let rootDepositTx = [];
        const mergeTx = () => {
          const merged = [...subTx];
          for (const dep of rootDepositTx) {
            if (!merged.find(t => t.id === dep.id)) merged.push(dep);
          }
          merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setTransactions(merged);
          setIsLoadingTransactions(false);
        };
        const unsubscribeTxSub = onSnapshot(collection(db, "users", firebaseUser.uid, "transactions"), (snapshot) => {
          subTx = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          mergeTx();
        }, (error) => { if (process.env.NODE_ENV === 'development') console.warn("Firebase (Transactions):", error.message); });
        const depositQuery = query(
          collection(db, "transactions"),
          where("userId", "==", firebaseUser.uid),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        const unsubscribeDeposits = onSnapshot(depositQuery, (snapshot) => {
          rootDepositTx = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              type: data.type || 'deposit',
              desc: data.desc || ('Top Up ' + (data.method || 'QRIS') + ' — ' + d.id),
              amount: data.amount || 0,
              timestamp: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
              status: data.status || 'pending',
            };
          });
          mergeTx();
        }, (error) => {
          // FIX: Jika index belum dibuat, fallback query tanpa orderBy + tampilkan hint di console
          if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn('[Firestore] Composite index belum dibuat. Buka link di error message untuk auto-create.', error.message);
            // Fallback: fetch tanpa orderBy (tidak perlu index)
            const fallbackQ = query(collection(db, "transactions"), where("userId", "==", firebaseUser.uid), limit(50));
            const unsubscribeFallback = onSnapshot(fallbackQ, (snap) => {
              rootDepositTx = snap.docs.map(d => {
                const data = d.data();
                return {
                  id: d.id, ...data,
                  type: data.type || 'deposit',
                  desc: data.desc || ('Top Up ' + (data.method || 'QRIS') + ' — ' + d.id),
                  amount: data.amount || 0,
                  timestamp: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
                  status: data.status || 'pending',
                };
              });
              mergeTx();
            });
            unsubscribeTransactions = () => { unsubscribeTxSub(); unsubscribeDeposits(); unsubscribeFallback(); };
          } else if (process.env.NODE_ENV === 'development') {
            console.warn("Firebase (Deposits):", error.message);
          }
        });
        unsubscribeTransactions = () => { unsubscribeTxSub(); unsubscribeDeposits(); };

        // 4. Listen Announcement Global
        unsubscribeAnnouncement = onSnapshot(doc(db, "settings", "announcement"), (docSnap) => {
          if (docSnap.exists()) {
             setAnnouncement(docSnap.data());
          }
        }, (error) => { if (process.env.NODE_ENV === 'development') console.warn("Firebase (Announcement):", error.message); });

        // 5. Listen Maintenance Mode
        onSnapshot(doc(db, "settings", "maintenance"), (docSnap) => {
          if (docSnap.exists()) setMaintenance(docSnap.data() as any);
          else setMaintenance({ isActive: false, message: '' });
        }, () => {});

        // ✅ PIN CHECK: cek apakah user perlu verifikasi PIN dulu

        try {
          // ✅ FIX: Baca format JSON baru (ada timestamp)
          let pinAlreadyVerified = false;
          if (typeof sessionStorage !== 'undefined') {
            try {
              const raw = sessionStorage.getItem(`pin_ok_${firebaseUser.uid}`);
              if (raw === '1') {
                pinAlreadyVerified = true;
              } else if (raw) {
                const parsed = JSON.parse(raw);
                const AGE_LIMIT = 8 * 60 * 60 * 1000;
                pinAlreadyVerified = parsed?.verified === true && (Date.now() - (parsed?.ts || 0)) < AGE_LIMIT;
                if (!pinAlreadyVerified) sessionStorage.removeItem(`pin_ok_${firebaseUser.uid}`);
              }
            } catch { pinAlreadyVerified = false; }
          }
          const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const hasPinHash = userDocSnap.exists() && !!userDocSnap.data()?.pinHash;
          setCurrentPage(curr => {
            if (['landing', 'login', 'register'].includes(curr)) {
              if (!hasPinHash) return 'pin_setup'; // Akun belum punya PIN, harus buat dulu
              return !pinAlreadyVerified ? 'pin_verify' : 'dash_home';
            }
            return curr;
          });
        } catch {
          setCurrentPage(curr =>
            ['landing', 'login', 'register'].includes(curr) ? 'dash_home' : curr
          );
        } finally {
          setAuthLoading(false);
        }
      } else {
        setUser(null);
        setBalance(0);
        setOrders([]);
        setIsLoadingOrders(true);
        setTransactions([]);
        setIsLoadingTransactions(true);
        try { sessionStorage.removeItem('pn_current_page'); sessionStorage.removeItem('pn_qr_state'); } catch {}
        setCurrentPage(curr => curr.startsWith('dash_') ? 'landing' : curr);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      clearAllListeners();
    };
  }, []); 

  const showToast = useCallback((msg: string, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const logout = async () => {
    try {
      // Hapus flag PIN verified saat logout
      if (typeof sessionStorage !== 'undefined' && auth?.currentUser) {
        sessionStorage.removeItem(`pin_ok_${auth.currentUser.uid}`);
      }
      if(auth) await signOut(auth);
      clearTokenCache(); // ✅ Invalidasi token cache agar sesi lama tidak bocor
      showToast('Berhasil keluar dari akun.', 'info');
    } catch (error) {
      showToast('Gagal keluar akun', 'error');
    }
  };

  // ✅ SECURITY: navigate() memvalidasi status PIN sebelum mengizinkan akses ke
  // halaman dashboard. Ini lapisan UX — bukan lapisan keamanan final.
  // Keamanan final ada di setiap server API route yang verifikasi JWT.
  const navigate = (page) => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });

    const publicPages = ['landing', 'login', 'register', 'pin_verify', 'pin_setup'];
    if (user && !publicPages.includes(page)) {
      const uid = user?.uid || '';
      let pinVerified = false;
      if (uid && typeof sessionStorage !== 'undefined') {
        try {
          // ✅ FIX: Baca format JSON baru (ada timestamp), fallback ke format lama '1'
          const raw = sessionStorage.getItem(`pin_ok_${uid}`);
          if (raw === '1') {
            // Format lama — migrasi ke format baru sekalian
            pinVerified = true;
            sessionStorage.setItem(`pin_ok_${uid}`, JSON.stringify({ verified: true, ts: Date.now() }));
          } else if (raw) {
            const parsed = JSON.parse(raw);
            // Opsional: expired setelah 8 jam (28800000 ms) untuk keamanan extra
            const AGE_LIMIT = 8 * 60 * 60 * 1000;
            pinVerified = parsed?.verified === true && (Date.now() - (parsed?.ts || 0)) < AGE_LIMIT;
            if (!pinVerified) sessionStorage.removeItem(`pin_ok_${uid}`); // Bersihkan yang expired
          }
        } catch {
          pinVerified = false;
        }
      }
      if (user?.hasPinHash && !pinVerified) {
        setCurrentPage('pin_verify');
        return;
      }
    }
    setCurrentPage(page);
    try { if (page.startsWith('dash_')) sessionStorage.setItem('pn_current_page', page); } catch {}
  };

  const _appCtxValue = {
    currentPage, navigate, user, authLoading, logout,
    balance, orders, isLoadingOrders,
    transactions, isLoadingTransactions,
    inventory, announcement, maintenance, toast, showToast,
  };

  return (
    <AppContext.Provider value={_appCtxValue}>
    <div className={`min-h-screen ${THEME.bg} text-gray-300 selection:bg-red-500/30 selection:text-white overflow-x-hidden flex flex-col`} style={{fontFamily:"'Sora',sans-serif"}}>
      
      {/* GLOBAL ANNOUNCEMENT BANNER — fixed, above everything */}
      {user && announcement?.isActive && announcement?.text && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-800 text-white py-2 flex items-center gap-3 z-[70] shadow-md border-b border-red-500/50 overflow-hidden">
          <div className="shrink-0 pl-4 pr-2 flex items-center">
            <Megaphone className="w-4 h-4 animate-pulse shrink-0" />
          </div>
          {/* Scrolling marquee — duplikat teks agar loop mulus */}
          <div className="overflow-hidden flex-1">
            <div className="announcement-track animate-marquee">
              {[0, 1].map(i => (
                <span key={i} className="text-xs md:text-sm font-bold tracking-wide whitespace-nowrap pr-24">
                  {announcement.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`${THEME.glass} ${toast.type === 'error' ? 'border-red-500/80 bg-red-950/90' : 'border-red-500/50 bg-[#140505]/90'} px-6 py-4 rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
            {toast.type === 'error' ? <AlertCircle className="text-red-400 shrink-0" /> : <CheckCircle2 className="text-red-400 shrink-0" />}
            <p className="text-white font-bold text-sm">{toast.msg}</p>
          </div>
        </div>
      )}

      <div className="flex-1 w-full h-full relative">
        {authLoading ? (
          <AppSkeleton />
        ) : currentPage === 'pin_verify' ? (
          <PinVerifyPage user={user} navigate={navigate} showToast={showToast} />
        ) : currentPage === 'pin_setup' ? (
          // Jika user sudah punya PIN, arahkan ke pin_verify bukan pin_setup
          user?.hasPinHash
            ? (() => { setTimeout(() => navigate('pin_verify'), 0); return <AppSkeleton />; })()
            : <SetupPinPage user={user} navigate={navigate} showToast={showToast} logout={logout} />
        ) : !user && (currentPage === 'landing' || currentPage === 'login' || currentPage === 'register') ? (
          <PublicLayout currentPage={currentPage} navigate={navigate} showToast={showToast} inventory={inventory} />
        ) : (
          <DashboardLayout 
            user={user} balance={balance} currentPage={currentPage} navigate={navigate} logout={logout}
            orders={orders} isLoadingOrders={isLoadingOrders}
            transactions={transactions} isLoadingTransactions={isLoadingTransactions}
            showToast={showToast} inventory={inventory} maintenance={maintenance}
          />
        )}
      </div>
    </div>
    </AppContext.Provider>
  );
}

// ==========================================
// PUBLIC LAYOUT & PAGES
// ==========================================

// ── LegalModal ──────────────────────────────────────────────────────────────
type LegalModalTabType = 'terms-id' | 'terms-en' | 'privacy-id' | 'privacy-en';
function LegalModal({ initialTab, onClose }: { initialTab: LegalModalTabType; onClose: () => void }) {
  const [tab, setTab] = React.useState<LegalModalTabType>(initialTab);
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-0 sm:px-4" onClick={onClose}>
      <div className="bg-[#080000] border border-red-500/20 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)]" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {([['terms-id','Syarat (ID)'],['terms-en','Terms (EN)'],['privacy-id','Privasi (ID)'],['privacy-en','Privacy (EN)']] as [LegalModalTabType,string][]).map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all ${tab===t?'bg-red-600 text-white':'bg-white/5 text-gray-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-2 shrink-0"><X className="w-5 h-5"/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 text-gray-400 text-sm leading-relaxed space-y-4">
          {(tab==='terms-id'||tab==='terms-en') ? (
            <>
              <h2 className="text-white font-black text-lg">{tab==='terms-id'?'Syarat & Ketentuan':'Terms & Conditions'}</h2>
              <p>{tab==='terms-id'?'PusatNokos menyediakan nomor virtual untuk verifikasi OTP. Dengan menggunakan layanan ini, Anda menyetujui ketentuan berikut.':'PusatNokos provides virtual numbers for OTP verification. By using this service, you agree to the following terms.'}</p>
              <p>{tab==='terms-id'?'Layanan hanya boleh digunakan untuk tujuan yang sah. Penyalahgunaan akan mengakibatkan pemblokiran akun.':'Service may only be used for lawful purposes. Misuse will result in account suspension.'}</p>
              <p>{tab==='terms-id'?'Saldo yang sudah diisi tidak dapat dikembalikan kecuali karena kegagalan sistem.':'Topped-up balance is non-refundable except due to system failure.'}</p>
              <p>{tab==='terms-id'?'Refund otomatis diberikan jika OTP tidak masuk dalam batas waktu yang ditentukan.':'Automatic refund is provided if OTP is not received within the specified time limit.'}</p>
            </>
          ) : (
            <>
              <h2 className="text-white font-black text-lg">{tab==='privacy-id'?'Kebijakan Privasi':'Privacy Policy'}</h2>
              <p>{tab==='privacy-id'?'Kami mengumpulkan data yang diperlukan untuk menyediakan layanan, termasuk email dan riwayat transaksi.':'We collect data necessary to provide the service, including email and transaction history.'}</p>
              <p>{tab==='privacy-id'?'Data Anda tidak dijual atau dibagikan kepada pihak ketiga tanpa persetujuan Anda.':'Your data is not sold or shared with third parties without your consent.'}</p>
              <p>{tab==='privacy-id'?'Kami menggunakan enkripsi untuk melindungi informasi pribadi Anda.':'We use encryption to protect your personal information.'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicLayout({ currentPage, navigate, showToast, inventory }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalModalTab }>({ open: false, tab: 'terms-id' });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative bg-[#060001]">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent pointer-events-none"></div>

      <nav className={`fixed top-0 w-full z-40 transition-all duration-500 border-b ${isScrolled ? 'bg-[#060001]/98 backdrop-blur-xl border-red-900/40 py-3 shadow-[0_4px_50px_rgba(0,0,0,0.8)]' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('landing')}>
            <AppLogo size="w-10 h-10" iconSize="w-6 h-6" />
            <span className="text-2xl font-extrabold text-white tracking-tight">PUSAT<span className="text-red-500">NOKOS</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('landing')} className="text-sm font-bold tracking-wide hover:text-white transition-colors">BERANDA</button>
            <button onClick={() => document.getElementById('harga')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-bold tracking-wide hover:text-white transition-colors">HARGA</button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-bold tracking-wide hover:text-white transition-colors">KETENTUAN</button>
            <div className="flex items-center gap-4 border-l border-white/10 pl-8">
              <Button variant="ghost" onClick={() => navigate('login')}>Masuk</Button>
              <Button variant="primary" onClick={() => navigate('register')}>Daftar Gratis</Button>
            </div>
          </div>

          <button className="md:hidden text-white p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenu && (
          <div className={`md:hidden absolute top-full left-0 w-full ${THEME.panelSolid} border-b border-red-500/20 py-4 px-6 flex flex-col gap-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-200`}>
            <button onClick={() => {navigate('landing'); setMobileMenu(false)}} className="text-left text-lg font-bold text-white tracking-wide">BERANDA</button>
            <button onClick={() => {document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenu(false);}} className="text-left text-lg font-bold text-white tracking-wide">KETENTUAN</button>
            <hr className="border-red-500/20" />
            <Button variant="ghost" className="justify-start w-full text-lg" onClick={() => {navigate('login'); setMobileMenu(false);}}>Masuk</Button>
            <Button variant="primary" className="w-full text-lg py-3" onClick={() => {navigate('register'); setMobileMenu(false);}}>Daftar Sekarang</Button>
          </div>
        )}
      </nav>

      <div className="pt-16 sm:pt-24 min-h-screen">
        {currentPage === 'landing' && <LandingPage navigate={navigate} inventory={inventory} />}
        {(currentPage === 'login' || currentPage === 'register') && <AuthPage type={currentPage} navigate={navigate} showToast={showToast} />}
      </div>
      
      {currentPage === 'landing' && (
        <footer className="border-t border-red-500/20 mt-10 py-12 bg-black/60 relative overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-red-600 blur-[150px] opacity-10 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 relative z-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <AppLogo size="w-8 h-8" iconSize="w-5 h-5" />
                <span className="text-xl font-extrabold text-white tracking-tight">PUSAT<span className="text-red-500">NOKOS</span></span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">Platform penyedia nomor virtual termurah, tercepat, dan terpercaya di Indonesia dengan kualitas kelas dunia.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 tracking-wide">LAYANAN</h4>
              <ul className="space-y-2 text-sm text-gray-400 font-medium">
                <li><a href="#harga" onClick={(e) => { e.preventDefault(); document.getElementById('harga')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-red-400 transition-colors cursor-pointer">Nomor Indonesia</a></li>
                <li><a href="#harga" onClick={(e) => { e.preventDefault(); document.getElementById('harga')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-red-400 transition-colors cursor-pointer">Nomor Internasional</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 tracking-wide">LEGAL & BANTUAN</h4>
              <ul className="space-y-2 text-sm text-gray-400 font-medium">
                <li><a href="#faq" className="hover:text-red-400 transition-colors">Penafian (Disclaimer)</a></li>
                <li><a href="#faq" className="hover:text-red-400 transition-colors">FAQ</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setLegalModal({ open: true, tab: 'terms-id' }); }} className="hover:text-red-400 transition-colors cursor-pointer">Syarat & Ketentuan</a></li>
              </ul>
            </div>
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-white font-bold mb-4 tracking-wide">HUBUNGI KAMI</h4>
              <p className="text-sm text-gray-400 mb-4 font-medium">Tim support kami siap membantu Anda 24/7.</p>
              <Button variant="telegram" className="w-full text-sm py-3 mb-3" onClick={() => window.open(`https://t.me/${CONTACT.telegram}`, '_blank', 'noopener,noreferrer')}>Hubungi via Telegram</Button>
              <Button variant="whatsapp" className="w-full text-sm py-3" onClick={() => window.open(`https://wa.me/${CONTACT.whatsapp}`, '_blank', 'noopener,noreferrer')}>Hubungi via WhatsApp</Button>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center text-sm font-bold text-gray-600 relative z-10">
            &copy; {new Date().getFullYear()} PUSATNOKOS. ALL RIGHTS RESERVED.
          </div>
        </footer>
      )}
      {legalModal.open && (
        <LegalModal
          initialTab={legalModal.tab}
          onClose={() => setLegalModal({ open: false, tab: 'terms-id' })}
        />
      )}
    </div>
  );
}





function LandingPage({ navigate, inventory }) {
  const [selectedCountry, setSelectedCountry] = React.useState('indonesia');
  const [countryDropdownOpen, setCountryDropdownOpen] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState(null);
  const [liveStocks, setLiveStocks] = React.useState({});
  const [isFetchingStock, setIsFetchingStock] = React.useState(false);
  const [legalModal, setLegalModal] = React.useState({ open: false, tab: 'terms-id' });
  const [tick, setTick] = React.useState(0);

  // Fake live OTP codes cycling
  const otpExamples = [
    { app: 'WhatsApp', code: '847 291', flag: '🇮🇩' },
    { app: 'Telegram', code: '593 014', flag: '🇺🇸' },
    { app: 'TikTok',   code: '261 837', flag: '🇮🇩' },
    { app: 'Shopee',   code: '904 153', flag: '🇲🇾' },
    { app: 'Gojek',    code: '738 620', flag: '🇮🇩' },
    { app: 'Discord',  code: '445 088', flag: '🇯🇵' },
  ];
  React.useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2500);
    return () => clearInterval(t);
  }, []);
  const currentOtp = otpExamples[tick % otpExamples.length];

  useEffect(() => {
    const controller = new AbortController();
    const go = async () => {
      setIsFetchingStock(true);
      try {
        const simCountry = mapCountryTo5Sim(selectedCountry);
        const res = await fetch(`/api/live-stock?country=${simCountry}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('');
        const data = await res.json();
        const firstKey = Object.keys(data)[0];
        const firstVal = firstKey ? data[firstKey] : null;
        const firstInner = firstVal && typeof firstVal === 'object' ? Object.keys(firstVal)[0] : null;
        const firstInnerVal = firstInner ? firstVal[firstInner] : null;
        const hasWrapper = firstInnerVal && typeof firstInnerVal === 'object' && !('cost' in firstInnerVal);
        const svc = hasWrapper ? firstVal : data;
        if (!svc) throw new Error('');
        const s = {};
        Object.keys(svc).forEach(n => {
          const id = mapServiceFrom5Sim(n);
          let cnt = 0, min = Infinity;
          const op = svc[n];
          if (op && typeof op === 'object') {
            Object.keys(op).forEach(k => {
              const e = op[k];
              if (!e) return;
              cnt += e.count || 0;
              if ((e.count||0) > 0 && e.cost && e.cost < min) min = e.cost;
            });
            s[id] = { count: cnt, minPrice: min !== Infinity ? calcPriceFromUsd(min) : 0 };
          }
        });
        setLiveStocks(s);
      } catch { setLiveStocks({}); }
      finally { setIsFetchingStock(false); }
    };
    go();
    return () => controller.abort();
  }, [selectedCountry]);

  const publicInventory = inventory.filter(i => i.countryId === selectedCountry).slice(0, 8);

  const FAQS = [
    { q: 'Cara kerjanya gimana?', a: 'Deposit → pilih app & negara → bayar → nomor muncul. Masukkan ke aplikasi, OTP masuk dalam hitungan detik ke dashboard kamu.', icon: '01' },
    { q: 'Nomor aktif berapa lama?', a: 'Sekali pakai, aktif 10–20 menit. Cukup untuk terima 1 kode OTP, habis itu nomor otomatis hangus.', icon: '02' },
    { q: 'Kalau OTP ga masuk gimana?', a: 'Auto-Refund. Kalau OTP tidak masuk sampai timeout, pesanan dibatalkan dan saldo kembali 100% otomatis tanpa perlu chat admin.', icon: '03' },
    { q: 'Aman ga buat akun utama?', a: 'Aman. Nomor virtual hanya untuk verifikasi sekali pakai — setelah OTP diterima, nomor tidak bisa digunakan lagi oleh siapapun.', icon: '04' },
  ];

  return (
    <div className="bg-[#000000] overflow-x-hidden">
      <style>{`
        @keyframes mq { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .mq { animation: mq 30s linear infinite; width:max-content; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor { animation: blink 1s step-end infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .float { animation: float 6s ease-in-out infinite; }
      `}</style>

      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-16 overflow-hidden">
        {/* Background: subtle dot grid */}
        <div className="absolute inset-0 bg-[#000000]" />
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
        <div className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] bg-red-700/20 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 left-[-100px] w-[400px] h-[400px] bg-red-900/10 blur-[120px] rounded-full" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2.5 mb-10 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-full">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            <span className="text-[11px] text-gray-400 font-bold tracking-[0.25em] uppercase">Server aktif · 24/7</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Headline */}
            <div>
              <h1 className="font-black uppercase tracking-tighter leading-[0.82] mb-10">
                <span className="block text-white" style={{fontSize:'clamp(52px,9vw,120px)'}}>NOMOR</span>
                <span className="block text-white" style={{fontSize:'clamp(52px,9vw,120px)'}}>VIRTUAL</span>
                <span className="block" style={{fontSize:'clamp(52px,9vw,120px)',WebkitTextStroke:'2px #ef4444',color:'transparent'}}>OTP</span>
                <span className="block bg-gradient-to-r from-red-500 via-red-400 to-orange-400 bg-clip-text text-transparent" style={{fontSize:'clamp(52px,9vw,120px)'}}>INSTAN.</span>
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-md">
                Beli nomor virtual dari <strong className="text-white">170+ negara</strong>, terima kode OTP dalam detik.
                Kalau gagal, saldo balik otomatis — <strong className="text-white">no drama</strong>.
              </p>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate('register')} className="group inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black text-sm px-8 py-4 rounded-2xl uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)]">
                  Mulai Sekarang
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => document.getElementById('harga')?.scrollIntoView({behavior:'smooth'})} className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white font-bold text-sm px-8 py-4 rounded-2xl uppercase tracking-widest transition-all">
                  Lihat Harga
                </button>
              </div>

              {/* Trust line */}
              <div className="flex flex-wrap gap-2 mt-8">
                {['✓ Gratis daftar','✓ Bayar saat pakai','✓ Auto-refund'].map((t,i) => (
                  <span key={i} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>

            {/* OTP Terminal */}
            <div className="hidden lg:block float">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden font-mono shadow-[0_32px_80px_rgba(0,0,0,0.8),0_0_40px_rgba(220,38,38,0.08)]">
                {/* Terminal bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                    <div className="w-3 h-3 rounded-full bg-green-500/40" />
                  </div>
                  <span className="text-gray-600 text-xs ml-2">pusatnokos — otp-terminal</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-[10px] font-bold">LIVE</span>
                  </div>
                </div>

                {/* Terminal content */}
                <div className="p-6 space-y-4">
                  <div className="text-gray-600 text-xs">
                    <span className="text-green-400">$</span> pusatnokos buy --app <span className="text-yellow-300">{currentOtp.app}</span> --country <span className="text-cyan-400">ID</span>
                  </div>

                  <div className="text-xs space-y-1.5 fade-up" key={tick}>
                    <div className="text-gray-500">→ Mencari nomor tersedia...</div>
                    <div className="text-gray-400">→ Nomor ditemukan: <span className="text-white">+62 821-xxxx-xxxx</span></div>
                    <div className="text-gray-400">→ Menunggu OTP<span className="cursor">_</span></div>
                  </div>

                  {/* OTP Display */}
                  <div className="bg-red-500/[0.06] backdrop-blur-xl border border-red-500/20 rounded-2xl p-4 fade-up" key={`otp-${tick}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">✓ OTP DITERIMA</span>
                      <span className="text-gray-600 text-[10px]">{currentOtp.flag} {currentOtp.app}</span>
                    </div>
                    <div className="text-4xl font-black text-white tracking-[0.25em]">{currentOtp.code}</div>
                    <div className="text-gray-600 text-[10px] mt-2">Berlaku 5 menit · Jangan bagikan ke siapapun</div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <span className="text-green-400">✓</span> Selesai dalam <span className="text-white font-bold">4.2 detik</span>
                    <span className="mx-2">·</span>
                    <span className="text-green-400">$</span> <span className="cursor text-gray-500">_</span>
                  </div>
                </div>
              </div>

              {/* Below terminal */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                {[
                  { val: '28K+', label: 'Pengguna' },
                  { val: '98%', label: 'Sukses Rate' },
                  { val: '<30s', label: 'Rata OTP' },
                ].map((s, i) => (
                  <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] rounded-2xl py-4 text-center hover:bg-white/[0.06] transition-all">
                    <p className="text-white font-black text-lg">{s.val}</p>
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-16">
            {[
              {v:'28K+', l:'Pengguna aktif'},
              {v:'1300+', l:'Produk tersedia'},
              {v:'170+', l:'Negara'},
              {v:'Rp 1.900', l:'Harga mulai dari'},
            ].map((s,i) => (
              <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.06] transition-all">
                <div className="text-3xl font-black text-white tracking-tight mb-1">{s.v}</div>
                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE ════════════════════════════════════════════════ */}
      <div className="border-y border-white/[0.06] py-4 overflow-hidden bg-white/[0.01] backdrop-blur-sm">
        <div className="mq flex gap-10 whitespace-nowrap">
          {['WhatsApp','Telegram','TikTok','Instagram','Shopee','Gojek','OVO','Dana','LINE','Discord','Twitter/X','Binance','Tokopedia','Netflix','Grab','Steam','Roblox','Airbnb',
            'WhatsApp','Telegram','TikTok','Instagram','Shopee','Gojek','OVO','Dana','LINE','Discord','Twitter/X','Binance','Tokopedia','Netflix','Grab','Steam','Roblox','Airbnb'].map((s,i) => (
            <span key={i} className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] inline-flex items-center gap-6">
              {s} <span className="w-1 h-1 bg-red-600/40 rounded-full" />
            </span>
          ))}
        </div>
      </div>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════════ */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-900/[0.08] blur-[150px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-16 flex items-center gap-3">
            <span className="w-6 h-px bg-red-500 inline-block" /> Cara Kerja
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {n:'01', emoji:'', title:'Isi Saldo', copy:'Top up via QRIS, transfer bank, atau e-wallet. Saldo masuk dalam hitungan menit.'},
              {n:'02', emoji:'', title:'Pilih & Beli', copy:'Pilih aplikasi dan negara yang kamu butuhkan. 1300+ produk tersedia dengan stok live.'},
              {n:'03', emoji:'', title:'Terima OTP', copy:'Kode masuk ke dashboard kamu dalam detik. Kalau tidak masuk? Saldo balik 100% otomatis.'},
            ].map((s,i) => (
              <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] hover:border-red-500/20 hover:bg-white/[0.05] rounded-3xl p-8 transition-all duration-300 group cursor-default">
                <div className="flex items-start justify-between mb-8">
                  <span className="text-[72px] leading-none font-black text-white/25 group-hover:text-white/40 transition-colors select-none tabular-nums">{s.n}</span>
                  
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.copy}</p>
                <div className="mt-8 w-5 h-px bg-red-500/30 group-hover:w-10 group-hover:bg-red-500 transition-all duration-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE LIST ════════════════════════════════════════════ */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-start">
            <div>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                <span className="w-6 h-px bg-red-500 inline-block" /> Kenapa Pusatnokos
              </p>
              <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[0.85] mb-8">
                Beda dari<br/>yang lain.
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">
                Bukan sekadar reseller. Kami punya sistem sendiri, harga transparan, dan auto-refund yang benar-benar jalan.
              </p>
              <button onClick={() => navigate('register')} className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 font-black text-xs uppercase tracking-widest border border-red-500/20 hover:border-red-500/50 px-5 py-2.5 rounded-full transition-all">
                Coba gratis <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {[
                { icon:'01', title:'OTP dalam 30 detik', desc:'Rata-rata OTP masuk dalam 4–30 detik. Bukan menit — detik.', accent:'text-yellow-400' },
                { icon:'02', title:'Auto-Refund, beneran', desc:'Bukan janji. Sistemnya otomatis — kalau OTP tidak masuk, saldo balik sendiri. Tidak perlu minta.', accent:'text-green-400' },
                { icon:'03', title:'170+ negara, 90+ layanan', desc:'WhatsApp, Telegram, TikTok, Shopee, Gojek, dan banyak lagi — dari Indonesia sampai Eropa.', accent:'text-cyan-400' },
                { icon:'04', title:'Data kamu aman', desc:'Tidak dijual, tidak dibagikan. Enkripsi end-to-end di setiap transaksi.', accent:'text-purple-400' },
              ].map((f,i) => (
                <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] hover:border-red-500/15 hover:bg-white/[0.05] rounded-2xl p-5 flex gap-4 group transition-all duration-300">
                  <span className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 text-[10px] font-black shrink-0">{f.icon}</span>
                  <div>
                    <h3 className={`font-black ${f.accent} text-sm uppercase tracking-wide mb-1.5`}>{f.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CATALOG ══════════════════════════════════════════════════ */}
      <section className="py-20 md:py-32 relative overflow-hidden" id="harga">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                <span className="w-6 h-px bg-red-500 inline-block" /> Harga Live
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-[0.85]">
                Update tiap saat.<br/><span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">Transparan.</span>
              </h2>
            </div>
            <div className="relative w-full max-w-[220px] z-20">
              <button onClick={() => setCountryDropdownOpen(!countryDropdownOpen)} className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] hover:bg-white/[0.07] rounded-2xl py-2.5 px-4 flex items-center gap-2.5 text-sm transition-all">
                <span className="text-base">{COUNTRIES.find(c => c.id === selectedCountry)?.flag}</span>
                <span className="text-white font-bold text-xs">{COUNTRIES.find(c => c.id === selectedCountry)?.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-600 ml-auto transition-transform ${countryDropdownOpen?'rotate-180':''}`} />
              </button>
              {countryDropdownOpen && (
                <div className="absolute top-full left-0 w-52 mt-2 bg-[#0a0000]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-56 overflow-y-auto z-50">
                  {COUNTRIES.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCountry(c.id); setCountryDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-xs font-bold border-b border-white/5 last:border-0 transition-colors ${selectedCountry===c.id?'text-red-400 bg-red-600/10':'text-gray-400 hover:text-white hover:bg-white/3'}`}>
                      <span className="text-base">{c.flag}</span>{c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isFetchingStock ? (
            <div className="flex items-center gap-3 py-20">
              <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
              <span className="text-gray-600 text-xs font-bold uppercase tracking-widest">Memuat harga live...</span>
            </div>
          ) : (
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.07] rounded-3xl overflow-hidden divide-y divide-white/[0.06]">
              {publicInventory.map(item => {
                const svc = getServiceMeta(item.serviceId) || { name: item.serviceId, icon: '📱', color: 'bg-gray-800' };
                const live = liveStocks[item.serviceId];
                const out = !live || live.count === 0;
                const price = (live && live.minPrice > 0) ? live.minPrice : getRealPrice(item.countryId, item.serviceId, 'cheap');
                const hot = item.isTrending ?? getIsTrending(item.countryId, item.serviceId);
                return (
                  <div key={item.id} className={`flex items-center justify-between py-4 px-5 group ${out?'opacity-40':'hover:bg-white/[0.04] cursor-pointer transition-all'}`}
                    onClick={() => !out && navigate('register')}>
                    <div className="flex items-center gap-4">
                      <ServiceIcon service={svc} className="w-9 h-9 text-sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-black text-sm uppercase tracking-wide">{svc.name}</span>
                          {hot && !out && <span className="text-[9px] text-red-400 font-black bg-red-500/10 px-1.5 py-0.5 rounded-full">HOT</span>}
                          {out && <span className="text-[9px] text-gray-600 font-black">KOSONG</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-600">{COUNTRIES.find(c => c.id === item.countryId)?.flag}</span>
                          <span className="text-[10px] text-gray-600">{COUNTRIES.find(c => c.id === item.countryId)?.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-base font-black ${out?'text-gray-600 line-through':'text-white'}`}><FormatRupiah value={price}/></p>
                        {!out && <p className="text-[10px] text-gray-600">per nomor</p>}
                      </div>
                      {!out && <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-red-400 transition-colors" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-8 border-t border-white/5 flex justify-between items-center">
            <span className="text-gray-700 text-xs font-bold uppercase tracking-widest">{publicInventory.length} dari 1300+ produk</span>
            <button onClick={() => navigate('register')} className="text-red-400 hover:text-red-300 font-black text-xs uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors">
              Lihat semua <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF — chat style ═══════════════════════════════ */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-16 flex items-center gap-3">
            <span className="w-6 h-px bg-red-500 inline-block" /> Kata Pengguna
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name:'Rizky', role:'Freelancer', time:'kemarin', text:'udah 3 bulan pakai, ga pernah kecewa. OTP selalu cepet masuk, kalau gagal langsung auto-refund tanpa drama 🔥', rating:5 },
              { name:'Sinta', role:'Reseller Online', time:'2 hari lalu', text:'harganya murah banget dibanding tempat lain. stok WA selalu ada. proses beli juga gampang, ga ribet', rating:5 },
              { name:'Budi', role:'Developer', time:'seminggu lalu', text:'tool wajib buat semua project butuh verifikasi. dashboard simple, responsive, no bullshit', rating:5 },
            ].map((t,i) => (
              <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] hover:border-red-500/20 hover:bg-white/[0.05] rounded-3xl p-6 transition-all duration-300 group">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-[0_0_20px_rgba(220,38,38,0.3)]">{t.name[0]}</div>
                  <div>
                    <p className="text-white font-black text-sm">{t.name}</p>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest">{t.role} · {t.time}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 fill-yellow-400 text-yellow-400"/>)}
                  </div>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-black to-black" />
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(220,38,38,0.06) 1px,transparent 1px)',backgroundSize:'32px 32px'}} />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/15 blur-[150px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-red-500/20 rounded-[2.5rem] p-10 md:p-16 shadow-[0_32px_80px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Gratis daftar · bayar saat pakai</span>
              </div>
              <h2 className="text-6xl md:text-[90px] font-black text-white uppercase tracking-tighter leading-[0.82]">
                Mulai<br/><span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">sekarang.</span>
              </h2>
            </div>
            <div className="flex flex-col gap-3 md:items-end shrink-0">
              <button onClick={() => navigate('register')} className="group inline-flex items-center gap-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-base px-10 py-5 rounded-2xl uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)]">
                Daftar Gratis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate('login')} className="text-gray-500 hover:text-white text-sm font-bold transition-colors text-center">
                Sudah punya akun? Masuk di sini
              </button>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-32 relative" id="faq">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-[280px,1fr] gap-16">
            <div>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                <span className="w-6 h-px bg-red-500 inline-block" /> FAQ
              </p>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-[0.85] mb-6">Yang sering ditanyain.</h2>
              <div className="border-l-2 border-white/5 pl-4">
                <p className="text-gray-600 text-xs leading-relaxed">
                  <span className="text-red-400/70">Disclaimer:</span> PusatNokos hanya menyediakan nomor virtual untuk keperluan verifikasi. Penyalahgunaan adalah tanggung jawab pengguna.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq,i) => (
                <div key={i} className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] hover:border-red-500/20 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${openFaq===i?'border-red-500/20 bg-white/[0.05]':''}`} onClick={() => setOpenFaq(openFaq===i?null:i)}>
                  <div className="flex items-center gap-4 p-5">
                    <span className="w-6 h-6 rounded-md bg-red-600/15 border border-red-500/20 flex items-center justify-center text-red-400 text-[9px] font-black shrink-0">{faq.icon}</span>
                    <h4 className="text-sm font-bold text-white flex-1">{faq.q}</h4>
                    <span className={`text-gray-500 font-black text-lg shrink-0 transition-transform duration-300 ${openFaq===i?'rotate-45 text-red-400':''}`}>+</span>
                  </div>
                  {openFaq===i && (
                    <div className="pb-5 px-5 pl-14">
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {legalModal.open && <LegalModal initialTab={legalModal.tab} onClose={() => setLegalModal({open:false,tab:'terms-id'})} />}
    </div>
  );
}


const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Sangat Lemah', color: 'bg-red-600' };
  if (score === 2) return { score, label: 'Lemah', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Cukup', color: 'bg-yellow-500' };
  if (score === 4) return { score, label: 'Kuat', color: 'bg-green-500' };
  return { score, label: 'Sangat Kuat', color: 'bg-emerald-400' };
};

// ─── Rate Limiter — SERVER-SIDE (via /api/auth/login-ratelimit, Firestore) ──
// Tidak bisa di-bypass lewat DevTools karena state disimpan di server.
// localStorage hanya dipakai untuk menyimpan sisa countdown di UI (bukan penentu blokir).
const MAX_ATTEMPTS  = 5;
const BASE_DELAY_MS = 1000;

// Cek apakah email/IP boleh mencoba login (dipanggil SEBELUM Firebase signIn)
const serverCheckRateLimit = async (email: string): Promise<{ allowed: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/auth/login-ratelimit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.status === 429) return { allowed: false, error: data.error };
    return { allowed: true };
  } catch {
    // Jika endpoint error, jangan blokir — biarkan Firebase guard yang kerja
    return { allowed: true };
  }
};

// Catat percobaan gagal ke Firestore (dipanggil SETELAH Firebase balas credential error)
const serverRecordFailure = async (email: string): Promise<void> => {
  try {
    await fetch('/api/auth/login-ratelimit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, failed: true }),
    });
  } catch { /* non-critical */ }
};

// Login berhasil — tidak perlu reset manual, Firestore TTL bersihkan otomatis
const serverClearRateLimit = async (_email: string): Promise<void> => { /* TTL handled by Firestore */ };

const getDelay = (attempts: number) => {
  if (attempts <= 0) return 0;
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempts - 1), 8000);
};

// ─── Legal Modal ────────────────────────────────────────────────────────────


// =========================================================
// LegalModal, AuthPage, PinVerifyPage, SetupPinPage
// → dipindah ke app/components/AuthPage.tsx
// =========================================================

function DashboardLayout({ user, balance, currentPage, navigate, logout, orders, isLoadingOrders, transactions, isLoadingTransactions, showToast, inventory, maintenance = null }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const { announcement } = useAppContext();

  const MENUS = [
    { id: 'dash_home', label: 'Dashboard', icon: Menu },
    { id: 'dash_buy', label: 'Beli Nomor', icon: ShoppingCart },
    { id: 'dash_history', label: 'Riwayat Pesanan', icon: Clock },
    { id: 'dash_mutasi', label: 'Mutasi Saldo', icon: Activity },
    { id: 'dash_deposit', label: 'Isi Saldo', icon: CreditCard },
    { id: 'dash_contact', label: 'Hubungi Kami', icon: MessageCircle },
    { id: 'dash_legal', label: 'Legal', icon: Scale },
    { id: 'dash_settings', label: 'Pengaturan', icon: Settings },
    { id: 'dash_admin', label: 'Admin Panel', icon: Shield, adminOnly: true },
  ];

  // ✅ SECURITY FIX KRITIS #1: isAdmin dari JWT Custom Claim yang di-set saat onAuthStateChanged.
  // user.isAdmin = tokenResult.claims?.admin === true (server-side JWT, tidak bisa dimanipulasi).
  // Server API route TETAP WAJIB verifikasi token secara independen — UI hanya untuk tampilan.
  const isAdmin = user?.isAdmin === true;
  const visibleMenus = MENUS.filter(m => !m.adminOnly || isAdmin);

  const recentActivities = [...transactions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  const hasUnread = recentActivities.length > 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#040101]"> 
      {/* DESKTOP SIDEBAR – Glassmorphism, Rapi, Profesional */}
      <aside className={`hidden md:flex flex-col w-72 bg-[#070101]/95 backdrop-blur-xl border-r border-white/[0.05] z-20 relative shadow-[4px_0_40px_rgba(0,0,0,0.6)]`}>
        {/* Ambient glow di sidebar */}
        <div className="absolute top-0 left-0 w-full h-48 bg-red-600/5 pointer-events-none"></div>
        
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <AppLogo size="w-9 h-9" iconSize="w-5 h-5" />
          <span className="text-xl font-black text-white tracking-tight">PUSAT<span className="text-red-500">NOKOS</span></span>
        </div>
        
        {/* Balance card */}
        <div className="px-4 pt-5 pb-3">
          <div className="relative rounded-2xl overflow-hidden border border-red-700/20 bg-[#0f0101]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-600/18 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-14 h-14 bg-red-900/15 rounded-full blur-xl -ml-4 -mb-4 pointer-events-none"></div>
            <div className="relative p-5">
              <p className="text-[9px] text-red-400/50 uppercase tracking-[0.15em] font-bold mb-1">Saldo Aktif</p>
              <p className="text-3xl font-black text-white tracking-tight leading-none mb-1"><FormatRupiah value={balance} /></p>
              <p className="text-[10px] text-gray-600 mb-5">Tersedia untuk pembelian</p>
              <button
                onClick={() => navigate('dash_deposit')}
                className="w-full py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors shadow-[0_4px_18px_rgba(220,38,38,0.32)] flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Isi Saldo
              </button>
            </div>
          </div>
        </div>

        <p className="text-[9px] text-gray-600 uppercase tracking-widest font-black px-6 pt-4 pb-2">Navigasi</p>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {visibleMenus.map(m => {
            const active = currentPage === m.id;
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 text-sm font-bold tracking-wide group ${
                  active 
                    ? m.adminOnly 
                      ? 'bg-purple-600/15 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                      : 'bg-red-600/15 text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  active 
                    ? m.adminOnly ? 'bg-purple-500/20' : 'bg-red-500/20' 
                    : 'bg-white/5 group-hover:bg-white/10'
                }`}>
                  <m.icon className={`w-4 h-4 ${active ? (m.adminOnly ? 'text-purple-400' : 'text-red-400') : 'text-gray-400 group-hover:text-gray-200'}`} />
                </div>
                <span className="truncate">{m.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500"></div>}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-bold border border-transparent hover:border-red-500/20">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER — compact & premium */}
      {(()=>{
        const ann = announcement;
        const bannerH = ann?.isActive && ann?.text ? 32 : 0;
        return (
          <div
            className="md:hidden fixed w-full z-[65] bg-[#050000]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 flex justify-between items-center shadow-[0_2px_24px_rgba(0,0,0,0.7)] transition-all duration-300"
            style={{
              top: `calc(env(safe-area-inset-top, 0px) + ${bannerH}px)`,
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
          >
            <div className="flex items-center gap-2.5">
              <AppLogo size="w-7 h-7" iconSize="w-4 h-4" />
              <div className="flex flex-col leading-tight">
                <span className="text-base font-black text-white tracking-tight">PUSAT<span className="text-red-500">NOKOS</span></span>
                <span className="text-[10px] text-gray-500 font-medium">Halo, <span className="text-red-400 font-bold">{user?.name?.split(' ')[0] || 'Kamu'}</span> 👋</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('dash_deposit')} className="bg-red-950/60 border border-red-500/25 px-3 py-1.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform">
                <span className="text-[11px] font-black text-red-400 tracking-tight"><FormatRupiah value={balance}/></span>
                <Plus className="w-3 h-3 text-red-500" />
              </button>
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 p-2 bg-white/[0.05] rounded-xl border border-white/[0.06] active:scale-95 transition-transform">
                <Menu className="w-5 h-5"/>
              </button>
            </div>
          </div>
        );
      })()}

      {/* MOBILE SLIDE MENU — full screen premium */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[80] bg-black/70 backdrop-blur-md animate-in fade-in duration-150" onClick={() => setSidebarOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-[#080101]/98 backdrop-blur-xl border-l border-white/[0.07] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.8)] animate-in slide-in-from-right-8 duration-250" onClick={e => e.stopPropagation()}>
            <div className="px-6 pb-5 flex justify-between items-center border-b border-white/[0.06]"
              style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${announcement?.isActive && announcement?.text ? 32 : 0}px + 56px)` }}
            >
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Saldo Kamu</p>
                <p className="text-xl font-black text-white"><FormatRupiah value={balance}/></p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 bg-white/[0.06] rounded-xl border border-white/[0.06]"><X className="text-gray-400 w-5 h-5"/></button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-2 custom-scrollbar">
              {visibleMenus.map(m => {
                const active = currentPage === m.id;
                return (
                  <button key={m.id} onClick={() => {navigate(m.id); setSidebarOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${active ? (m.adminOnly ? 'bg-purple-600/15 text-purple-400 border border-purple-500/20' : 'bg-red-600/15 text-red-400 border border-red-500/20') : 'text-gray-400 border border-transparent hover:bg-white/[0.04] hover:text-gray-200'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${active ? (m.adminOnly ? 'bg-purple-500/20' : 'bg-red-500/20') : 'bg-white/[0.05]'}`}>
                      <m.icon className={`w-4 h-4 ${active ? (m.adminOnly ? 'text-purple-400' : 'text-red-400') : 'text-gray-500'}`} />
                    </div>
                    <span>{m.label}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/[0.06]" style={{paddingBottom:'max(env(safe-area-inset-bottom,0px),16px)'}}>
              <button onClick={() => { logout(); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-400 bg-red-500/10 border border-red-500/15 font-bold text-sm transition-all active:scale-[0.98]">
                <LogOut className="w-4 h-4" /> Keluar Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pb-[env(safe-area-inset-bottom,0px)]">
        <header className="hidden md:flex h-24 items-center justify-between px-10 border-b border-red-900/20 bg-transparent relative z-30">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">{MENUS.find(m => m.id === currentPage)?.label.replace('dash_', '')}</h2>
          <div className="flex items-center gap-8">
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="relative text-gray-400 hover:text-white transition-colors bg-white/5 p-3 rounded-full border border-white/5">
                <Bell className="w-6 h-6" />
                {hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 border-2 border-[#0a0000] rounded-full"></span>}
              </button>

              {showNotif && (
                <div className="absolute top-full right-0 mt-4 w-80 bg-[#140505] border border-red-500/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-2 z-[200] animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="p-3 border-b border-white/5 flex justify-between items-center">
                    <span className="font-bold text-white uppercase tracking-widest text-sm">Notifikasi</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {recentActivities.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">Belum ada notifikasi</div>
                    ) : (
                      recentActivities.map(tx => (
                        <div key={tx.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-default last:border-0 flex gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'deposit' || tx.type === 'refund' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                             {tx.type === 'deposit' ? <CreditCard className="w-4 h-4" /> : tx.type === 'refund' ? <RefreshCw className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-gray-200">{tx.desc}</p>
                             <p className={`text-xs font-black mt-0.5 ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                               {tx.amount > 0 ? '+' : ''}<FormatRupiah value={tx.amount}/>
                             </p>
                             <p className="text-[10px] text-gray-500 mt-1">{new Date(tx.timestamp).toLocaleString('id-ID')}</p>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                  {recentActivities.length > 0 && (
                    <button onClick={() => { setShowNotif(false); navigate('dash_mutasi'); }} className="w-full text-center p-3 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl mt-2 transition-colors uppercase tracking-widest">
                      Lihat Semua Mutasi
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pl-8 border-l border-red-900/30 cursor-pointer group">
              <img src={user.avatar} alt="Avatar" className="w-12 h-12 rounded-full bg-red-950 border-2 border-red-500/50 group-hover:border-red-500 transition-colors" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white uppercase tracking-wider">{user.name}</span>
                <span className="text-xs text-red-400 font-bold uppercase tracking-widest mt-0.5">{isAdmin ? 'Admin' : 'VIP Member'}</span>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:pt-8 md:p-10 pb-32 md:pb-10 relative z-10 custom-scrollbar"
          style={{
            paddingTop: `calc(${announcement?.isActive && announcement?.text ? 32 : 0}px + 56px + env(safe-area-inset-top, 0px) + 16px)`,
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)'
          }}
          onClick={() => showNotif && setShowNotif(false)}
        >
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-red-700 rounded-full filter blur-[300px] opacity-[0.05] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900 rounded-full filter blur-[200px] opacity-[0.04] pointer-events-none"></div>

          {currentPage === 'dash_home' && <DashHome user={user} navigate={navigate} orders={orders} isLoadingOrders={isLoadingOrders} balance={balance} inventory={inventory} showToast={showToast} transactions={transactions} maintenance={maintenance} />}
          {currentPage === 'dash_buy' && <BuyNumberPage user={user} balance={balance} showToast={showToast} navigate={navigate} inventory={inventory} maintenance={maintenance} />}
          {currentPage === 'dash_history' && <OrderHistoryPage orders={orders} isLoadingOrders={isLoadingOrders} showToast={showToast} />}
          {currentPage === 'dash_mutasi' && <MutasiPage transactions={transactions} isLoadingTransactions={isLoadingTransactions} />}
          {currentPage === 'dash_deposit' && <DepositPage user={user} showToast={showToast} />}
          {currentPage === 'dash_settings' && <SettingsPage user={user} showToast={showToast} />}
          {currentPage === 'dash_admin' && isAdmin && <AdminPanelPage showToast={showToast} isAdmin={isAdmin} />}
          {currentPage === 'dash_contact' && <ContactPage />}
          {currentPage === 'dash_legal' && <LegalPage />}
        </div>

        {/* ✅ BOTTOM NAVBAR MOBILE – Tampilan seperti aplikasi profesional */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#040101]/98 backdrop-blur-xl border-t border-white/[0.05] shadow-[0_-4px_30px_rgba(0,0,0,0.8)]">
          <style>{`@keyframes navbounce{0%{transform:scale(1)}40%{transform:scale(1.25)}70%{transform:scale(0.92)}100%{transform:scale(1)}}`}</style>
          <div className="flex items-stretch" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
            {[
              { id: 'dash_home',     label: 'Beranda', icon: Menu },
              { id: 'dash_buy',      label: 'Beli',    icon: ShoppingCart },
              { id: 'dash_history',  label: 'Riwayat', icon: History },
              { id: 'dash_deposit',  label: 'Top Up',  icon: CreditCard },
              { id: 'dash_settings', label: 'Akun',    icon: User },
            ].map(m => {
              const active = currentPage === m.id;
              const isTopUp = m.id === 'dash_deposit';
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(m.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 relative min-h-[56px] ${isTopUp ? 'active:scale-95' : 'active:opacity-70'}`}
                >
                  {active && !isTopUp && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-500 rounded-full" />
                  )}
                  {isTopUp ? (
                    <div className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-all ${active ? 'bg-red-600 shadow-[0_4px_14px_rgba(220,38,38,0.4)]' : 'bg-red-900/40 border border-red-700/30'}`}>
                      <m.icon className="w-4 h-4 text-white" />
                      <span className="text-[9px] font-black text-white uppercase tracking-wide">{m.label}</span>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${active ? 'bg-red-500/15' : ''}`}
                        style={active ? {animation:'navbounce 0.4s ease forwards'} : undefined}
                      >
                        <m.icon className={`w-5 h-5 transition-colors ${active ? 'text-red-400' : 'text-gray-600'}`} />
                      </div>
                      <span className={`text-[10px] font-bold transition-colors ${active ? 'text-red-400' : 'text-gray-600'}`}>{m.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}

// --- DASHBOARD SUB-PAGES ---


// =========================================================
// SettingsPage, MutasiPage, DashHome
// → dipindah ke app/components/DashComponents.tsx
// =========================================================