'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Save, User, Eye, EyeOff, Lock, Key, Loader2,
  Filter, ChevronLeft, ChevronRight, Trophy, CheckCircle,
  ShoppingCart, Zap, Clock, ArrowRight, Bell, AlertTriangle,
  TrendingUp, Activity, Star, Flame, CreditCard, Smartphone,
  Plus, RefreshCw, History, Gift, MessageCircle, Settings,
  Check, X, Shield, Download, Search, Copy, LogOut, CheckCircle2, XCircle, BarChart3
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, updateProfile, updatePassword } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, query, limit } from 'firebase/firestore';
import { secureApiCall } from '@/lib/apiClient';
import { Button, Card, THEME } from './ui';


const Badge = ({ children, variant = 'info' }: { children: React.ReactNode; variant?: string }) => {
  const variants: Record<string, string> = {
    info:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    premium: 'bg-red-500/20 text-red-300 border-red-500/30',
    admin:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
    failed:  'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${variants[variant] || variants.info}`}>
      {children}
    </span>
  );
};

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
let auth: any = null;
let db: any   = null;
if (typeof window !== 'undefined') {
  try {
    const _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(_app); db = getFirestore(_app);
  } catch {}
}

const getNumericId = (uid: string) => { if (!uid) return ''; let hash = 0; for (let i = 0; i < uid.length; i++) { hash = uid.charCodeAt(i) + ((hash << 5) - hash); hash = hash & hash; } return Math.abs(hash).toString().padStart(10,'0').slice(0,10); };
const formatRupiah = (v: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(isNaN(v)?0:v);
const FormatRupiah = ({ value }: { value: number }) => <>{formatRupiah(value)}</>;

// ── Skeletons ────────────────────────────────────────────────────────────────
const Shimmer: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    style={style}
    className={`relative overflow-hidden bg-white/[0.06] rounded-lg before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent ${className}`}
  />
);

const ShimmerStyle: React.FC = () => (
  <style suppressHydrationWarning>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
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

// ── PaginationControls ──────────────────────────────────────────────────────
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

function SettingsPageInner({ user, showToast }) {
  const [name, setName] = useState(user.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    const safeName = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().substring(0, 50);
    if (!safeName) return showToast('Nama tidak valid atau mengandung karakter ilegal', 'error');

    setIsSavingProfile(true);
    try {
      if (auth && auth.currentUser && db) {
        await updateProfile(auth.currentUser, { displayName: safeName });
        await secureApiCall('/api/user/update-profile', { name: safeName });
        showToast('Profil berhasil diperbarui!');
        setName(safeName);
      }
    } catch (error) { showToast('Gagal menyimpan profil', 'error'); } 
    finally { setIsSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6 || newPassword.length > 50) return showToast('Kata sandi harus 6-50 karakter', 'error');
    setIsSavingPassword(true);
    try {
      if (auth && auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword('');
        showToast('Kata sandi berhasil diubah!');
      }
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') showToast('Sesi kedaluwarsa. Silakan login ulang.', 'error');
      else showToast('Gagal mengubah kata sandi', 'error');
    } finally { setIsSavingPassword(false); }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase tracking-tight">Pengaturan <span className="text-red-500">Akun</span></h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-[#0f0202] border-red-900/40 p-8 rounded-[2rem] relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8 border-b border-red-900/30 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 flex items-center justify-center border border-red-500/30">
              <User className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-wide">Profil Anda</h3>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-5 bg-black border border-white/5 p-4 rounded-2xl">
              <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full bg-red-950 border-2 border-red-500/50" />
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">MEMBER ID</p>
                <p className="text-gray-300 font-mono text-lg font-black tracking-widest break-all">{getNumericId(user.uid)}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Nama Lengkap</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isSavingProfile} maxLength={50} className="w-full bg-black border border-red-900/50 rounded-xl py-4 px-5 text-white font-medium focus:outline-none focus:border-red-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email (Terlisensi)</label>
              <input type="email" value={user.email} disabled className="w-full bg-[#140505] border border-white/5 rounded-xl py-4 px-5 text-gray-500 font-medium cursor-not-allowed" />
            </div>
            <Button variant="primary" className="w-full py-4 text-sm tracking-widest mt-4 flex items-center justify-center gap-2" onClick={handleSaveProfile} disabled={isSavingProfile || name === user.name}>
              {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} SIMPAN PROFIL
            </Button>
          </div>
        </Card>

        <Card className="bg-[#0f0202] border-red-900/40 p-8 rounded-[2rem] relative overflow-hidden h-fit">
          <div className="flex items-center gap-4 mb-8 border-b border-red-900/30 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/30">
              <Key className="w-7 h-7 text-orange-500" />
            </div>
            <div><h3 className="text-2xl font-black text-white uppercase tracking-wide">Keamanan</h3></div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Kata Sandi Baru</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isSavingPassword} maxLength={128} placeholder="Minimal 8 karakter, campuran huruf & angka" className="w-full bg-black border border-red-900/50 rounded-xl py-4 pl-12 pr-12 text-white font-medium focus:outline-none focus:border-orange-500 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button variant="outline" className="w-full py-4 text-sm tracking-widest text-orange-500 border-orange-500/50 hover:bg-orange-500 hover:text-white hover:border-orange-500" onClick={handleChangePassword} disabled={isSavingPassword || newPassword.length < 8}>
              {isSavingPassword ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'PERBARUI KATA SANDI'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export const SettingsPage = SettingsPageInner;
function MutasiPageInner({ transactions, isLoadingTransactions = false }) {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'purchase' | 'refund'>('all');
  const itemsPerPage = 10;
  // ✅ FIX: Tampilkan SEMUA transaksi termasuk topup/deposit — dulu deposit disembunyikan
  const filteredTx = filterType === 'all'
    ? transactions
    : filterType === 'deposit'
      ? transactions.filter(tx => tx.type === 'deposit')
      : filterType === 'refund'
        ? transactions.filter(tx => tx.type === 'refund')
        : transactions.filter(tx => tx.type !== 'deposit' && tx.type !== 'refund');
  const totalPages = Math.ceil(filteredTx.length / itemsPerPage);
  const displayedTx = filteredTx.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-lg md:text-4xl font-black text-white mb-1 uppercase tracking-tighter">Mutasi <span className="text-red-500">Saldo</span></h2>
        <p className="text-gray-400 font-medium text-sm md:text-lg">Catatan aliran dana, top-up, dan pengeluaran akun Anda.</p>
      </div>

      {/* Filter Tab */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { key: 'all',      label: 'Semua' },
          { key: 'deposit',  label: '💳 Top-up' },
          { key: 'purchase', label: '🛒 Pembelian' },
          { key: 'refund',   label: '🔄 Refund' },
        ] as { key: typeof filterType; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => { setFilterType(f.key); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              filterType === f.key
                ? 'bg-red-600 text-white shadow-[0_2px_12px_rgba(220,38,38,0.4)]'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoadingTransactions ? (
        <MutasiSkeleton count={8} />
      ) : (
        <>
          {/* ── MOBILE CARD VIEW ──────────────────────────── */}
          <div className="md:hidden space-y-3">
            {displayedTx.length === 0 ? (
              <div className="text-center py-16 bg-[#0f0202] border border-dashed border-red-900/30 rounded-2xl">
                <p className="text-gray-500 font-bold">Belum ada riwayat mutasi saldo.</p>
              </div>
            ) : (
              displayedTx.map((tx) => (
                <div key={tx.id} className="bg-[#060000] border border-red-900/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    tx.type === 'deposit' || tx.type === 'refund'
                      ? 'bg-green-500/10 text-green-500 border-green-500/30'
                      : 'bg-red-500/10 text-red-500 border-red-500/30'
                  }`}>
                    {tx.type === 'deposit' ? <Plus className="w-5 h-5" /> : tx.type === 'refund' ? <RefreshCw className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{tx.desc}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(tx.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-base ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}<FormatRupiah value={Math.abs(tx.amount)} />
                    </p>
                    <div className="mt-1 flex justify-end">
                      {tx.status === 'pending' ? <Badge variant="warning">Menunggu</Badge>
                        : tx.status === 'success' ? <Badge variant="success">Berhasil</Badge>
                        : <Badge variant="failed">Gagal</Badge>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── DESKTOP TABLE VIEW ────────────────────────── */}
          <Card className="hidden md:block bg-[#060000] border-red-900/20 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-red-900/20 bg-[#080000]">
                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Transaksi</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Tanggal</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Nominal</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTx.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-gray-500 font-medium">Belum ada riwayat mutasi saldo.</td>
                    </tr>
                  ) : (
                    displayedTx.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              tx.type === 'deposit' || tx.type === 'refund'
                                ? 'bg-green-500/10 text-green-500 border-green-500/30'
                                : 'bg-red-500/10 text-red-500 border-red-500/30'
                            }`}>
                              {tx.type === 'deposit' ? <Plus className="w-5 h-5" /> : tx.type === 'refund' ? <RefreshCw className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{tx.desc}</p>
                              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">ID: {tx.id.substring(0, 10)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-400">{new Date(tx.timestamp).toLocaleString('id-ID')}</td>
                        <td className={`py-4 px-6 font-black text-lg ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}<FormatRupiah value={Math.abs(tx.amount)} />
                        </td>
                        <td className="py-4 px-6 text-right">
                          {tx.status === 'pending' ? <Badge variant="warning">Menunggu</Badge>
                            : tx.status === 'success' ? <Badge variant="success">Berhasil</Badge>
                            : <Badge variant="failed">Gagal</Badge>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </Card>

          {/* Mobile pagination */}
          {totalPages > 1 && (
            <div className="md:hidden mt-4">
              <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}


// =========================================================
// AdminPanelPage → dipindah ke app/components/AdminPanelPage.tsx
// Di-load via dynamic import di baris atas
// =========================================================

export const MutasiPage = MutasiPageInner;

// ── ActiveOrderItem (dipindah dari OrderHistoryPage) ────────────────────────
function ActiveOrderItem({ order, compact = false, showToast }) {
  // ✅ State utama — sinkron dari Firestore (order prop), bukan override mandiri
  const [otpData, setOtpData] = useState<{
    status: string;
    otp: string | null;
    allSms?: any[];
  }>({
    status: order.status || 'active',
    otp: order.otp || null,
  });

  const [isCanceling, setIsCanceling] = useState(false);
  const esRef           = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs agar callback async tidak stale
  const statusRef = useRef(otpData.status);
  const otpRef    = useRef<string | null>(otpData.otp);

  useEffect(() => { statusRef.current = otpData.status; }, [otpData.status]);
  useEffect(() => { otpRef.current    = otpData.otp;    }, [otpData.otp]);

  // ✅ Sync saat order prop berubah dari Firestore real-time
  useEffect(() => {
    setOtpData(prev => {
      const newStatus = order.status || prev.status;
      const newOtp    = order.otp || prev.otp;
      // Jangan override status final — 'success' dan 'canceled' tidak boleh
      // ditimpa balik ke 'active' jika Firestore belum sync sempurna
      if (prev.status === 'success' && newStatus === 'active') return prev;
      if (prev.status === 'canceled' || prev.status === 'CANCELLED') return prev;
      return { ...prev, status: newStatus, otp: newOtp };
    });
  }, [order.status, order.otp]);

  // ──────────────────────────────────────────────────────────────────────────
  // Strategi dual-track:
  //  1. POLLING  — setInterval setiap 3 detik via ?mode=poll (reliable di semua platform)
  //  2. SSE      — EventSource sebagai bonus kecepatan (jika platform support)
  // Polling SELALU jalan dari awal. SSE hanya pelengkap.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // ✅ FIX BUG POLLING: Sertakan 'pending' agar order yang baru dibeli
    // (status awal dari backend bisa 'pending') tetap di-poll sampai OTP masuk.
    if (otpData.status !== 'active' && otpData.status !== 'pending') {
      if (esRef.current)           { esRef.current.close(); esRef.current = null; }
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      return;
    }

    let isMounted = true;

    // ── Helper: proses data dari poll atau SSE ────────────────────────────
    const handleData = (data: any) => {
      if (!isMounted || !data) return;

      // ✅ FIX BUG STATUS: Normalisasi status mentah dari provider sebelum disimpan.
      // 5SIM mengembalikan 'RECEIVED', SA mengembalikan 'STATUS_OK' — keduanya = sukses.
      // Tanpa normalisasi ini polling tidak pernah berhenti dan status tidak ter-update.
      const normalizeStatus = (s: string) => {
        if (s === 'RECEIVED' || s === 'STATUS_OK')    return 'success';
        if (s === 'TIMEOUT'  || s === 'STATUS_CANCEL') return 'canceled';
        if (s === 'BANNED')                            return 'canceled';
        return s;
      };

      const incomingStatus = normalizeStatus(data.status || 'active');

      if (data.otp && data.otp !== otpRef.current) {
        showToast(
          `OTP diterima untuk ${order.saName || order.serviceId?.toUpperCase()}: ${data.otp}`,
          'success'
        );
      }

      setOtpData(prev => ({
        status: incomingStatus === 'active' && prev.status === 'success'
          ? 'success'
          : incomingStatus,
        otp:    data.otp || prev.otp || null,
        allSms: data.allSms || prev.allSms || [],
      }));

      if (incomingStatus === 'success' || incomingStatus === 'canceled' || incomingStatus === 'CANCELLED' || incomingStatus === 'finished') {
        if (esRef.current)           { esRef.current.close(); esRef.current = null; }
        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      }
    };

    // ── TRACK 1: Polling via HTTP (selalu aktif, backbone utama) ──────────

    const runPoll = async () => {
      if (!isMounted || (statusRef.current !== 'active' && statusRef.current !== 'pending')) return;
      if (!auth || !auth.currentUser) return;
      try {
        const token    = await auth.currentUser.getIdToken();
        // ✅ SECURITY FIX: Token dipindah dari URL query string ke Authorization header.
        // Token di URL bocor ke server access log, CDN log, dan browser history.
        const endpoint = order.provider === 'smsactivate'
          ? `/api/smsactivate/otp-stream?orderId=${order.id}&mode=poll`
          : `/api/otp-stream?orderId=${order.id}&mode=poll`;
        const res   = await fetch(
          endpoint,
          {
            signal: AbortSignal.timeout(12000),
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        // ✅ FIX: Jangan silent ignore — log error agar bisa debug di DevTools
        if (!res.ok) {
          console.error(
            `[poll] Error ${res.status} untuk orderId=${order.id}.`,
            'Cek Vercel Function Logs untuk detail.',
          );
          // Jika 401 (token expired) — refresh token di poll berikutnya, jangan stop
          return;
        }
        const data = await res.json();
        // Uncomment baris di bawah saat debug, comment kembali di production:
        // console.log(`[poll] Response orderId=${order.id}:`, data);
        handleData(data);
      } catch (err: any) {
        // Hanya log jika bukan AbortError (timeout normal)
        if (err?.name !== 'AbortError') {
          console.warn(`[poll] Network error orderId=${order.id}:`, err?.message);
        }
      }
    };

    // Jalankan sekali langsung, lalu setiap 3 detik
    runPoll();
    pollIntervalRef.current = setInterval(runPoll, 3000);

    // ── TRACK 2: SSE (bonus kecepatan — tidak wajib berhasil) ─────────────
    const openSSE = async () => {
      if (!isMounted || !auth || !auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdToken();
        if (!isMounted) return;

        // ✅ FIX BUG SSE: Gunakan endpoint yang sesuai provider (bukan selalu 5sim)
        const sseEndpoint = order.provider === 'smsactivate'
          ? `/api/smsactivate/otp-stream?orderId=${order.id}&token=${encodeURIComponent(token)}`
          : `/api/otp-stream?orderId=${order.id}&token=${encodeURIComponent(token)}`;
        const es = new EventSource(sseEndpoint);
        esRef.current = es;

        es.onmessage = (event) => {
          try { handleData(JSON.parse(event.data)); } catch { /* abaikan parse error */ }
        };

        // SSE error/timeout — tutup saja, polling sudah handle sebagai backbone
        es.onerror = () => {
          es.close();
          esRef.current = null;
        };
      } catch { /* SSE tidak tersedia — polling sudah cukup */ }
    };

    // SSE dimatikan di production — Vercel timeout 5 menit menyebabkan error.
    // Polling via ?mode=poll sudah cukup dan reliable di semua platform.
    // ⚠️ SECURITY NOTE: Jika SSE diaktifkan kembali, token di URL (baris openSSE) harus
    // diganti ke header — EventSource tidak support custom header secara native,
    // solusinya: pakai @microsoft/fetch-event-source atau kirim token via cookie HttpOnly.
    // openSSE();

    return () => {
      isMounted = false;
      if (esRef.current)           { esRef.current.close(); esRef.current = null; }
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, otpData.status]);

  // ✅ FIX: onExpire sekarang update Firestore secara langsung agar order
  // hilang dari Status Live segera setelah waktu habis, tanpa tunggu polling.
  const onExpire = useCallback(async () => {
    if (statusRef.current !== 'active' && statusRef.current !== 'pending') return; // sudah di-cancel/sukses
    try {
      if (!auth?.currentUser) return;
      // Update status lokal dulu agar UI langsung responsif
      const expiredStatus = order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled';
      setOtpData(prev => ({ ...prev, status: expiredStatus }));
      statusRef.current = expiredStatus;
      // Sync ke Firestore agar hilang dari activeOrders filter
      await updateDoc(
        doc(db, 'users', auth.currentUser.uid, 'orders', order.id),
        { status: expiredStatus }
      );
    } catch {
      // Jika Firestore gagal, UI sudah update — tidak perlu error toast
    }
  }, [order.id, order.provider]);

  // ✅ FIX: Jika order tidak punya expiresAt (umum pada Server 2/smsactivate),
  // gunakan timestamp order + 20 menit sebagai fallback standar SA.
  // Normalisasi timestamp dulu karena bisa berupa number, Firestore Timestamp,
  // atau plain object { seconds, nanoseconds } — ketiganya harus dikonversi ke ms.
  const orderTimestampMs = (() => {
    const t = order.timestamp;
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (typeof t?.toMillis === 'function') return t.toMillis();
    if (t?.seconds) return t.seconds * 1000;
    return 0;
  })();

  const effectiveExpiresAt = order.expiresAt
    ?? (orderTimestampMs ? orderTimestampMs + 20 * 60 * 1000 : null);

  const { formatTime, seconds } = useCountdown(
    effectiveExpiresAt,
    otpData.status === 'active',
    onExpire
  );

  const handleCancel = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      if (!auth || !auth.currentUser) throw new Error('Sesi tidak valid');
      const token = await auth.currentUser.getIdToken();

      if (order.provider === 'smsactivate') {
        // SMS-Activate: cancel via set-status endpoint
        // ✅ SECURITY FIX: Tambahkan pengecekan res.ok — sebelumnya error diabaikan diam-diam.
        const saRes = await fetch('/api/smsactivate/set-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderId: order.id, status: 8 }),
        });
        if (!saRes.ok) {
          const saData = await saRes.json().catch(() => ({}));
          throw new Error(saData.message || `Gagal membatalkan pesanan (${saRes.status})`);
        }
      } else {
        // 5sim: cancel via cancel-order endpoint
        const res = await fetch('/api/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderId: order.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal membatalkan pesanan');
      }

      // ✅ FIX: Update Firestore langsung agar activeOrders filter di DashHome
      // ikut berubah via real-time listener. Tanpa ini, order tetap muncul di
      // "Status Live" karena Firestore masih menyimpan status 'active'.
      // Error permission di-silent karena status lokal sudah diupdate via setOtpData.
      if (db) {
        try {
          await updateDoc(
            doc(db, 'users', auth.currentUser.uid, 'orders', order.id),
            { status: order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled' }
          );
        } catch (_) { /* silent — tidak ganggu user jika Firestore rules belum allow */ }
      }

      showToast('Pesanan dibatalkan. Saldo dikembalikan.', 'info');
      setOtpData(prev => ({ ...prev, status: order.provider === 'smsactivate' ? 'CANCELLED' : 'canceled', otp: null }));
    } catch (err: any) {
      showToast(err.message || 'Gagal membatalkan.', 'error');
    } finally {
      setIsCanceling(false);
    }
  };

  const displayStatus = otpData.status;
  const displayOtp = otpData.otp;
  const isActive = displayStatus === 'active';
  const isSuccess = displayStatus === 'success' || displayStatus === 'finished';
  const isCanceled = displayStatus === 'canceled' || displayStatus === 'CANCELLED';

  // ✅ FIX: Gunakan getSAServiceMeta untuk Server 2 (smsactivate) agar logo tampil benar.
  // Sebelumnya selalu pakai getServiceMeta() sehingga logo Server 2 tidak match.
  const service = order.saName
    ? getSAServiceMeta(order.serviceId, order.saName)
    : getServiceMeta(order.serviceId);
  const serviceName = order.saName || service?.name || order.serviceId?.toUpperCase();
  const urgentTime = seconds <= 120 && seconds > 0 && isActive;

  if (compact) {
    // ✅ Sembunyikan order yang sudah dibatalkan dari Status Live
    if (isCanceled) return null;
    // ✅ FIX: Sembunyikan juga order yang timer-nya sudah habis (expired) tapi
    // Firestore belum sync — tanpa ini order stuck 00:00 terus muncul.
    if (isActive && seconds === 0 && effectiveExpiresAt && Date.now() > effectiveExpiresAt) return null;

    return (
      <Card className={`p-4 flex items-center justify-between gap-4 ${
        isSuccess ? 'border-green-500/30 bg-green-500/5' :
        urgentTime ? 'border-orange-500/30 bg-orange-500/5 animate-pulse' :
        'border-red-500/20'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <ServiceIcon service={service} className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <p className="font-black text-white uppercase text-sm truncate">{serviceName}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{order.number || order.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isActive && (
            <span className={`text-sm font-black font-mono ${urgentTime ? 'text-orange-400' : 'text-gray-400'}`}>
              {formatTime()}
            </span>
          )}
          {isSuccess && displayOtp && (
            <span className="text-green-400 font-black text-lg font-mono tracking-widest">{displayOtp}</span>
          )}
          {isSuccess && !displayOtp && (
            <span className="text-xs text-green-400 font-bold uppercase">Sukses</span>
          )}
          {isCanceled && (
            <span className="text-xs text-red-400 font-bold uppercase">Dibatalkan</span>
          )}
          {isActive && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              <span className="text-xs text-gray-500 font-bold">Menunggu OTP</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden p-0 transition-all ${
      isSuccess  ? 'border-green-500/30 bg-[#020f04]' :
      isCanceled ? 'border-white/[0.05] opacity-60' :
      urgentTime ? 'border-orange-500/40 bg-[#100600]' :
      'border-red-900/25 bg-[#0a0202]'
    }`}>
      {/* Timer progress bar (aktif only) */}
      {isActive && (
        <div className={`relative h-1.5 w-full overflow-hidden ${urgentTime ? 'bg-orange-900/40' : 'bg-red-900/20'}`}>
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-1000 ${urgentTime ? 'bg-orange-500' : 'bg-red-600/70'}`}
            style={{ width: `${Math.max(0, Math.min(100, (seconds / 600) * 100))}%` }}
          />
        </div>
      )}

      <div className="p-5 md:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <ServiceIcon service={service} className="w-10 h-10 md:w-12 md:h-12 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">{serviceName}</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                {order.countryId?.toUpperCase()} · {order.operator?.toUpperCase()}
              </p>
            </div>
          </div>

          {isActive && (
            <div className={`shrink-0 text-right ${urgentTime ? 'text-orange-400' : 'text-gray-400'}`}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 opacity-70">Sisa Waktu</p>
              <p className={`text-2xl font-black font-mono tabular-nums leading-none ${urgentTime ? 'text-orange-400' : 'text-white'}`}>
                {formatTime()}
              </p>
              {urgentTime && <p className="text-[9px] text-orange-400/70 font-bold mt-0.5">Segera gunakan!</p>}
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 px-3 py-1.5 rounded-xl shrink-0">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-bold text-xs hidden sm:block">OTP Diterima</span>
            </div>
          )}
          {isCanceled && (
            <div className="flex items-center gap-1.5 bg-red-500/8 border border-red-500/15 px-3 py-1.5 rounded-xl shrink-0">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-bold text-xs hidden sm:block">Dibatalkan</span>
            </div>
          )}
        </div>

        {/* Nomor Virtual */}
        <div className="bg-black/60 border border-white/[0.07] rounded-xl p-4 mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Nomor Virtual</p>
            <p className="text-white font-black text-lg font-mono tracking-widest">{order.number || order.phone}</p>
          </div>
          <CopyButton value={order.number || order.phone || ''} showToast={showToast} size="sm" />
        </div>

        {/* OTP Display */}
        {isSuccess && displayOtp && (
          <div className="bg-green-950/40 border-2 border-green-500/40 rounded-xl p-5 mb-3 flex items-center justify-between gap-4 shadow-[0_0_30px_rgba(34,197,94,0.08)]">
            <div>
              <p className="text-[9px] text-green-400/60 font-bold uppercase tracking-widest mb-1">Kode OTP</p>
              <p className="text-green-400 font-black text-3xl font-mono tracking-[0.2em]">{displayOtp}</p>
            </div>
            <CopyButton value={displayOtp} showToast={showToast} size="md" className="bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/30" />
          </div>
        )}

        {/* Semua SMS */}
        {isSuccess && otpData.allSms && otpData.allSms.length > 1 && (
          <div className="space-y-2 mb-3">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Semua SMS Masuk</p>
            {otpData.allSms.map((sms, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-sm text-gray-300 font-mono">
                {sms.text || sms.code || '-'}
              </div>
            ))}
          </div>
        )}

        {/* Waiting state */}
        {isActive && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 mb-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Menunggu SMS OTP...</p>
              <p className="text-gray-500 text-xs mt-0.5">Masukkan nomor di atas ke layanan {service?.name} untuk menerima SMS</p>
            </div>
          </div>
        )}

        {/* Action buttons — dibedakan secara visual */}
        {isActive && (
          <div className="flex gap-3">
            {/* Salin Nomor — secondary, full width */}
            <button
              onClick={() => copyToClipboardHelper(order.number || order.phone || '', showToast)}
              className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Salin Nomor
            </button>
            {/* Batalkan — danger outline, hanya ikon + label pendek */}
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="px-4 py-3 rounded-xl border border-red-900/40 text-red-500/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/30 transition-all font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Batal</>}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
export default function DashHome({ user, navigate, orders, isLoadingOrders = false, balance, inventory, showToast, transactions = [], maintenance = null }) {
  // Guard: tunggu sebentar setelah navigate agar orders tidak flicker tampil order lama
  const [isStable, setIsStable] = React.useState(false);
  React.useEffect(() => {
    if (!isLoadingOrders) {
      const t = setTimeout(() => setIsStable(true), 120);
      return () => clearTimeout(t);
    } else {
      setIsStable(false);
    }
  }, [isLoadingOrders]);

  // ✅ FIX: Helper normalisasi expiresAt ke ms (sama dengan useCountdown)
  const normalizeExpiresAtMs = (o: any): number => {
    const raw = o.expiresAt;
    if (raw) {
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') return new Date(raw).getTime();
      if (typeof raw?.toMillis === 'function') return raw.toMillis();
      if (raw?.seconds) return raw.seconds * 1000;
    }
    // Fallback: timestamp order + 20 menit (standar SA), atau 10 menit (5sim)
    if (o.timestamp) {
      const maxMs = o.provider === 'smsactivate' ? 20 * 60 * 1000 : 10 * 60 * 1000;
      return o.timestamp + maxMs;
    }
    return 0;
  };

  const activeOrders = (isStable && !isLoadingOrders)
    ? orders.filter(o => {
        if (o.status !== 'active' && o.status !== 'pending') return false;
        // ✅ FIX: Sembunyikan order zombie yang sudah expired (waktu habis tapi status Firestore belum terupdate)
        const expiryMs = normalizeExpiresAtMs(o);
        if (expiryMs > 0 && Date.now() > expiryMs) return false;
        return true;
      })
    : [];
  
  // Peringkat hanya dihitung dari orderan yang SUKSES
  // ✅ FIX: Sertakan 'finished' (status sukses dari Server 2/smsactivate) agar leaderboard akurat
  const userTotalSpent = orders.filter(o => o.status === 'success' || o.status === 'finished').reduce((sum, o) => sum + (o.price || 0), 0);
  
  const [topSpenders, setTopSpenders] = useState([]);
  const [userRank, setUserRank] = useState('-');
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  const last7Days = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        timestamp: d.getTime(),
        amount: 0
      });
    }

    if (orders && orders.length > 0) {
       orders.forEach(o => {
         if (o.status === 'success') {
           const oDate = new Date(o.timestamp);
           oDate.setHours(0, 0, 0, 0);
           const oTime = oDate.getTime();
           const dayObj = days.find(d => d.timestamp === oTime);
           
           if (dayObj) {
              dayObj.amount += (o.price || 0); 
           }
         }
       });
    }

    const maxAmount = Math.max(...days.map(d => d.amount), 1000);

    return days.map(d => ({
      ...d,
      percentage: (d.amount / maxAmount) * 100
    }));
  }, [orders]);

  useEffect(() => {
    if (!auth) return;

    const fetchLeaderboard = async () => {
      try {
        // ✅ SECURITY FIX: Tidak lagi pakai getDocs(collection(db,"users")) langsung dari browser
        // — itu mengirimkan SELURUH dokumen user (termasuk pinHash, balance, banned) ke client.
        // Sekarang pakai API route server-side yang hanya mengembalikan field publik:
        //   userId, name, avatar, totalSpent  ← tidak ada field sensitif
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/leaderboard', {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Gagal memuat leaderboard');
        const leaderboard: { userId: string; name: string; avatar: string; totalSpent: number }[] = await res.json();

        setTopSpenders(leaderboard.slice(0, 3));

        // Cek Peringkat Asli User Saat Ini
        if (user && user.uid) {
          const myIndex = leaderboard.findIndex(s => s.userId === user.uid);
          setUserRank(myIndex !== -1 ? myIndex + 1 : '-');
        }

      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.warn("Gagal memuat leaderboard:", e);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
  }, [user]);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className={`relative overflow-hidden rounded-3xl ${THEME.gradientPrimary} p-6 md:p-12 shadow-[0_10px_40px_rgba(220,38,38,0.2)]`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white opacity-20 rounded-full blur-[80px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-8">
          <div>
            {maintenance?.isActive ? (
              <>
                <h1 className="text-2xl md:text-5xl font-black text-orange-400 mb-2 md:mb-3 tracking-tight uppercase">🔧 Maintenance</h1>
                <p className="text-orange-300/80 font-medium text-sm md:text-lg max-w-lg">{maintenance.message || 'Sistem sedang dalam perbaikan. Coba lagi beberapa saat.'}</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl md:text-5xl font-black text-white mb-2 md:mb-3 tracking-tight uppercase">Ready for action? ⚡</h1>
                <p className="text-white/80 font-medium text-sm md:text-lg max-w-lg">Sistem sedang optimal. Akses 2000+ kombinasi layanan siap memberikan OTP instan untukmu.</p>
              </>
            )}
          </div>
          <Button variant="secondary"
            className={`w-full md:w-auto px-6 md:px-8 py-3 md:py-4 text-base md:text-lg whitespace-nowrap ${maintenance?.isActive ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 cursor-not-allowed' : 'bg-white text-red-900 border-none hover:bg-gray-100 shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}
            onClick={() => !maintenance?.isActive && navigate('dash_buy')}
            disabled={maintenance?.isActive}>
            {maintenance?.isActive ? '🔧 TIDAK TERSEDIA' : 'BELI NOMOR SEKARANG'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div onClick={() => navigate('dash_mutasi')} className="group cursor-pointer relative overflow-hidden rounded-2xl md:rounded-3xl border border-red-900/30 hover:border-red-500/50 transition-all duration-300 bg-[#080101] p-4 md:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-600/10 rounded-full blur-2xl group-hover:bg-red-600/20 transition-all"></div>
          <p className="text-[9px] md:text-[11px] text-red-300/40 font-black uppercase tracking-[0.3em] mb-2 md:mb-3">Saldo</p>
          <p className="text-sm md:text-3xl font-black text-white tracking-tighter truncate leading-none"><FormatRupiah value={balance}/></p>
          <div className="mt-2 md:mt-4 w-6 h-0.5 bg-red-600 rounded-full group-hover:w-12 transition-all duration-300"></div>
        </div>
        {/* AKTIF */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/5 bg-[#080101] p-4 md:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
          <p className="text-[9px] md:text-[11px] text-red-300/40 font-black uppercase tracking-[0.3em] mb-2 md:mb-3">Aktif</p>
          <p className="text-sm md:text-3xl font-black text-white tracking-tighter leading-none">{activeOrders.length}</p>
          <div className="mt-2 md:mt-4 w-6 h-0.5 bg-white/20 rounded-full"></div>
        </div>
        {/* SUKSES */}
        <div onClick={() => navigate('dash_history')} className="group cursor-pointer relative overflow-hidden rounded-2xl md:rounded-3xl border border-green-900/20 hover:border-green-500/40 transition-all duration-300 bg-[#080101] p-4 md:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-600/10 rounded-full blur-2xl group-hover:bg-green-600/20 transition-all"></div>
          <p className="text-[9px] md:text-[11px] text-red-300/40 font-black uppercase tracking-[0.3em] mb-2 md:mb-3">Sukses</p>
          <p className="text-sm md:text-3xl font-black text-white tracking-tighter leading-none">{orders.filter(o => o.status === 'success' || o.status === 'finished').length}</p>
          <div className="mt-2 md:mt-4 w-6 h-0.5 bg-green-600 rounded-full group-hover:w-12 transition-all duration-300"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2">
          
          <Card className="mb-8 p-6 md:p-8 bg-[#060000] border-red-900/20 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-lg md:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                  <BarChart3 className="text-red-500 w-5 h-5"/> Analitik Pengeluaran
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-1">Total belanja nomor Anda dalam 7 hari terakhir.</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total 7 Hari</p>
                <p className="text-2xl font-black text-red-400"><FormatRupiah value={last7Days.reduce((a,b)=>a+b.amount,0)}/></p>
              </div>
            </div>

            <div className="flex items-end gap-2 md:gap-4 h-48">
              {last7Days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full">
                  <div className="w-full flex-1 flex items-end bg-black/50 border border-white/5 rounded-t-xl overflow-hidden">
                    <div
                      className="w-full bg-gradient-to-t from-red-900 to-red-500 rounded-t-xl group-hover:to-red-400 transition-all duration-700 ease-in-out relative cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.2)] group-hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                      style={{ height: `${day.percentage}%`, minHeight: day.amount > 0 ? '8%' : '0%' }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-black py-1.5 px-3 rounded-lg pointer-events-none transition-opacity duration-300 shadow-xl whitespace-nowrap z-10">
                        <FormatRupiah value={day.amount}/>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${i === 6 ? 'text-red-400' : 'text-gray-500'}`}>
                    {i === 6 ? 'HARI INI' : day.dateStr}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter">Status Live <span className="text-red-500">(Menunggu OTP)</span></h3>
            {activeOrders.length > 0 && <button onClick={() => navigate('dash_history')} className="text-sm font-bold text-red-500 hover:text-white uppercase tracking-wider transition-colors">Lihat Semua →</button>}
          </div>
          
          {isLoadingOrders ? (
            <ActiveOrderSkeleton count={2} />
          ) : activeOrders.length === 0 ? (
            <Card className="border-dashed border-2 border-red-900/40 text-center py-16 bg-transparent">
              <Smartphone className="w-16 h-16 text-red-900/50 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-lg">Tidak ada pesanan aktif.</p>
              <p className="text-red-200/40 text-sm mt-1">Mulai eksplorasi 2000+ layanan kami.</p>
              <Button variant="outline" className="mt-6" onClick={() => navigate('dash_buy')}>BUKA KATALOG</Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeOrders.slice(0, 3).map(order => (
                <ActiveOrderItem key={order.id} order={order} compact showToast={showToast} />
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3"><Trophy className="text-yellow-500 w-7 h-7" /> Peringkat</h3>
          </div>
          <Card className="bg-[#060000] border-red-900/20 p-0 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between">
              <span className="text-yellow-400 font-bold text-sm tracking-widest uppercase">Top Spender (Sultan Nokos)</span>
            </div>
            
            <div className="divide-y divide-white/5">
              {isLoadingLeaderboard ? (
                <LeaderboardSkeleton />
              ) : topSpenders.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 font-bold">Belum ada Sultan bulan ini.</div>
              ) : (
                topSpenders.map((sp, index) => {
                  const colors = ['bg-yellow-500 text-black', 'bg-gray-300 text-black', 'bg-amber-600 text-black'];
                  const textColors = ['text-yellow-500', 'text-gray-300', 'text-amber-600'];
                  
                  return (
                    <div key={sp.userId} className={`flex items-center justify-between p-4 ${index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${colors[index] || 'bg-white/10 text-white'}`}>
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-3">
                          <img src={sp.avatar} className={`w-10 h-10 rounded-full border ${index === 0 ? 'border-yellow-500/50' : 'border-transparent opacity-80'}`} alt="avatar" />
                          <span className={`font-bold ${index === 0 ? 'text-white' : 'text-gray-300'}`}>
                            {sp.name.length > 12 ? sp.name.substring(0, 12) + '...' : sp.name}
                          </span>
                        </div>
                      </div>
                      <span className={`font-black ${textColors[index] || 'text-white'}`}><FormatRupiah value={sp.totalSpent} /></span>
                    </div>
                  );
                })
              )}
              
              {/* Kolom Peringkat "Anda" */}
              <div className="flex items-center justify-between p-4 bg-red-900/20 border-t border-red-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-950 border border-red-500/50 flex items-center justify-center text-red-500 font-black">
                     {userRank}
                  </div>
                  <div className="flex items-center gap-3"><img src={user?.avatar} className="w-10 h-10 rounded-full border border-red-500/50" alt="avatar" /><span className="font-bold text-red-400">Anda</span></div>
                </div>
                <span className="font-black text-red-400"><FormatRupiah value={Math.max(0, userTotalSpent)} /></span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ✅ PERF FIX: ServiceCard di-memo → tidak re-render saat parent state berubah
// (misal: saat modal buka/tutup, semua card tidak ikut re-render)

// =========================================================
// ServiceCard + BuyNumberPage → dipindah ke app/components/BuyNumberPage.tsx
// Di-load via dynamic import di baris atas
// =========================================================

// DepositPage → dipindah ke app/components/DepositPage.tsx
// Di-load via dynamic import di baris atas
// =========================================================

// =========================================================
// LegalPage   → dipindah ke app/components/LegalPage.tsx
// ContactPage → dipindah ke app/components/ContactPage.tsx
// Di-load via dynamic import di baris atas
// ==============================================