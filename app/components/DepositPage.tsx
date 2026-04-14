'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Clock, Copy, RefreshCw, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, CreditCard,
  Shield, User, Gift, History, Zap,
  MessageCircle, X
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, Button, CONTACT } from './ui';
import { secureApiCall } from '@/lib/apiClient';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore, doc, collection, onSnapshot,
  query, where, orderBy, limit, updateDoc, getDocs
} from 'firebase/firestore';

// ── Firebase singleton ────────────────────────────────────────────────────
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
    auth = getAuth(_app);
    db   = getFirestore(_app);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────
const formatRupiah = (value: number): string => {
  const safeValue = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(safeValue);
};
const FormatRupiah = ({ value }: { value: number }) => <>{formatRupiah(value)}</>;

export const copyToClipboardHelper = (text: string, showToastFn?: (msg: string, type: string) => void) => {
  const fallbackCopy = (textToCopy: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    textArea.style.cssText = 'position:fixed;top:0;left:0';
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(textArea);
  };
  if (!navigator.clipboard || !window.isSecureContext) {
    fallbackCopy(text);
    if (showToastFn) showToastFn('Berhasil disalin!', 'success');
  } else {
    navigator.clipboard.writeText(text)
      .then(() => { if (showToastFn) showToastFn('Berhasil disalin!', 'success'); })
      .catch(() => { fallbackCopy(text); if (showToastFn) showToastFn('Berhasil disalin!', 'success'); });
  }
};

// ── Component ─────────────────────────────────────────────────────────────
export default memo(function DepositPage({ user, showToast }) {
  // Restore QR state dari sessionStorage supaya tidak hilang saat refresh
  // FIX: gunakan useRef agar hanya dibaca sekali saat mount, tidak tiap render
  const savedQr = useRef(
    typeof window !== 'undefined'
      ? (() => { try { return JSON.parse(sessionStorage.getItem('pn_qr_state') || 'null'); } catch { return null; } })()
      : null
  ).current;
  const [step, setStep] = useState<number>(savedQr?.step || 1);
  const [amount, setAmount] = useState<string>(savedQr?.amount || '');
  const [method, setMethod] = useState('paymenku');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(savedQr?.paymentUrl || null);
  const [paymentRef, setPaymentRef] = useState<string | null>(savedQr?.paymentRef || null);
  const [qrUrl,            setQrUrl]            = useState<string | null>(savedQr?.qrUrl || null);
  const [qrString,         setQrString]         = useState<string | null>(savedQr?.qrString || null);
  const [qrExpiry,         setQrExpiry]         = useState<string | null>(savedQr?.qrExpiry || null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  // countdown timer
  const [secondsLeft,   setSecondsLeft]   = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // auto-refresh status
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // riwayat deposit
  const [depositHistory, setDepositHistory] = useState<any[]>([]);

  const presets = [10000, 25000, 50000, 100000, 500000];

  // ── fee QRIS Paymenku 0.7% ──────────────────────────────────────
  const QRIS_FEE_RATE = 0.007;
  const numericAmount = parseInt(amount, 10) || 0;
  const estimatedFee  = method === 'paymenku' && numericAmount >= 5000
    ? Math.ceil(numericAmount * QRIS_FEE_RATE) + 200
    : 0;
  const totalBayar = numericAmount + estimatedFee;

  // ── Fetch riwayat deposit dari Firestore ────────────────────────
  useEffect(() => {
    if (!user?.uid || !db) return;
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('type', '==', 'deposit'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setDepositHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [user?.uid]);

  // ── Cleanup interval saat unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current)   clearInterval(countdownRef.current);
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  // ── Mulai countdown + auto-refresh saat QR muncul ──────────────
  // FIX: Restore countdown timer jika QR masih aktif setelah refresh
  useEffect(() => {
    if (savedQr?.step === 2 && savedQr?.qrExpiry && savedQr?.paymentRef) {
      const endMs = new Date(savedQr.qrExpiry).getTime();
      const remaining = Math.floor((endMs - Date.now()) / 1000);
      if (remaining > 0) {
        startQrTimers(savedQr.qrExpiry, savedQr.paymentRef);
      } else {
        // QR sudah expired saat restore — langsung reset
        resetQrState();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQrTimers = (expiryStr: string | null, ref: string) => {
    if (countdownRef.current)   clearInterval(countdownRef.current);
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);

    // Countdown timer
    if (expiryStr) {
      const endMs = new Date(expiryStr).getTime();
      const tick = () => {
        const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
        setSecondsLeft(diff);
        if (diff <= 0) {
          clearInterval(countdownRef.current!);
          clearInterval(autoRefreshRef.current!); // FIX: stop auto-refresh saat expired
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
    }

    // Auto-refresh status setiap 5 detik — FIX: cek expiry sebelum fetch
    autoRefreshRef.current = setInterval(async () => {
      // Stop jika QR sudah expired
      if (expiryStr && Date.now() > new Date(expiryStr).getTime()) {
        clearInterval(autoRefreshRef.current!);
        return;
      }
      try {
        const token = await auth?.currentUser?.getIdToken();
        const res  = await fetch(`/api/paymenku/check-status?ref=${ref}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.status === 'paid') {
          clearInterval(autoRefreshRef.current!);
          clearInterval(countdownRef.current!);
          // FIX: Clear sessionStorage setelah bayar berhasil
          sessionStorage.removeItem('pn_qr_state');
          showToast('🎉 Pembayaran berhasil! Saldo sudah masuk ke akun kamu ⚡', 'success');
          setTimeout(() => resetQrState(), 1500); // delay biar toast kebaca dulu
        }
      } catch { /* silent */ }
    }, 5000);
  };

  const resetQrState = () => {
    sessionStorage.removeItem('pn_qr_state');
    setStep(1); setAmount('');
    setPaymentUrl(null); setQrUrl(null); setQrString(null);
    setPaymentRef(null); setQrExpiry(null);
    setSecondsLeft(null);
    if (countdownRef.current)   { clearInterval(countdownRef.current);   countdownRef.current = null; }
    if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
  };

  // ✅ SECURITY FIX #10: Nomor rekening TIDAK boleh hardcoded di JS bundle produksi.
  // Pindahkan ke env var (NEXT_PUBLIC_DANA_NUMBER, NEXT_PUBLIC_SEABANK_NUMBER)
  // atau fetch dari server-side API agar tidak terekspos di DevTools.
  // NEXT_PUBLIC_ masih terekspos di bundle, tapi lebih mudah dirotasi tanpa ubah kode.
  // Idealnya: fetch dari /api/payment-info (dengan auth) agar tidak di bundle sama sekali.
  const PAYMENT_DETAILS = {
    paymenku: {
      name: 'QRIS OTOMATIS',
      info: 'Scan QR Code yang muncul menggunakan aplikasi bank atau e-wallet apapun.',
      auto: true,
    },
    qris:    { name: 'QRIS (Semua Pembayaran)', info: 'Scan QR Code di bawah ini menggunakan aplikasi E-Wallet atau M-Banking Anda.' },
    dana:    { name: 'DANA E-WALLET', number: process.env.NEXT_PUBLIC_DANA_NUMBER || '***TIDAK DIKONFIGURASI***', accountName: '-' },
    seabank: { name: 'SEABANK', number: process.env.NEXT_PUBLIC_SEABANK_NUMBER || '***TIDAK DIKONFIGURASI***', accountName: '-' }
  };

  const MIN_AMOUNT = 10000;

  const handleNext = () => {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num < MIN_AMOUNT || num > 50000000) {
      showToast(`Nominal tidak valid (Min: Rp ${MIN_AMOUNT.toLocaleString('id-ID')}, Max: Rp 50.000.000)`, 'error');
      return;
    }
    if (method === 'paymenku') {
      handlePaymenku(num);
      return;
    }
    setStep(2); 
  };

  // ===== HANDLER PAYMENKU — buat transaksi otomatis via payment gateway =====
  const handlePaymenku = async (numericAmount: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPaymentUrl(null);
    setPaymentRef(null);

    try {
      // Panggil API route kita sendiri (server-side) yang menghubungi Paymenku API.
      // Ini menjaga API key Paymenku tetap aman di server, tidak terekspos ke client.
      const res = await secureApiCall('/api/paymenku/create', {
        amount: numericAmount,
        userId: user?.uid,
        userEmail: user?.email || '',
        userName: user?.name || 'User',
      });

      // res.paymentUrl → URL redirect ke halaman pembayaran Paymenku
      // res.reference  → ID transaksi dari Paymenku (disimpan untuk cek status)
      if (res?.paymentUrl) {
        setPaymentUrl(res.paymentUrl);
        setPaymentRef(res.reference || null);
        const qrState = {
          step: 2,
          amount,
          paymentUrl: res.paymentUrl,
          paymentRef: res.reference || null,
          qrUrl: res.qrUrl || null,
          qrString: res.qrString || null,
          qrExpiry: res.qrExpiry || null,
        };
        sessionStorage.setItem('pn_qr_state', JSON.stringify(qrState));
        setQrUrl(qrState.qrUrl);
        setQrString(qrState.qrString);
        setQrExpiry(qrState.qrExpiry);
        setStep(2);
        // mulai countdown & auto-refresh
        startQrTimers(res.qrExpiry || null, res.reference);

        // ✅ FIX B: Simpan expiresAt ke dokumen Firestore agar admin panel bisa filter
        // transaksi QRIS expired secara akurat (tidak bergantung hanya pada timestamp + 30 menit).
        // Non-blocking — jika gagal, tidak mengganggu alur pembayaran user.
        if (res.qrExpiry && res.reference && user?.uid && db) {
          (async () => {
            try {
              const txQuery = query(
                collection(db, 'transactions'),
                where('userId', '==', user.uid),
                where('reference', '==', res.reference),
                limit(1)
              );
              const snap = await getDocs(txQuery);
              if (!snap.empty) {
                await updateDoc(snap.docs[0].ref, { expiresAt: res.qrExpiry });
              }
            } catch (err) {
              // Non-critical: log saja, jangan blokir user
              console.warn('[FixB] Gagal simpan expiresAt ke Firestore:', err);
            }
          })();
        }
      } else {
        throw new Error(res?.message || 'Gagal membuat invoice Paymenku.');
      }
    } catch (e) {
      showToast(e.message || 'Gagal menghubungi payment gateway. Coba metode manual.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== HANDLER DEPOSIT MANUAL (QRIS statis, DANA, SeaBank) =====
  const handleCreateDeposit = async () => {
    // ✅ SECURITY FIX #7b: Re-validasi nominal sebelum submit — mencegah manipulasi
    // nilai antara step 1 dan step 2 (misalnya via DevTools console).
    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount < MIN_AMOUNT || numericAmount > 50000000) {
      showToast('Nominal tidak valid. Mohon ulangi dari awal.', 'error');
      setStep(1);
      return;
    }

    if (isSubmitting) return; // ✅ guard double-submit
    setIsSubmitting(true);
    const gatewayName = method === 'qris' ? 'QRIS (INSTANT)' : method === 'dana' ? 'DANA E-WALLET' : 'SEABANK';

    try {
      await secureApiCall('/api/deposit', {
        amount: numericAmount,
        method: gatewayName
      });

      showToast('Permintaan deposit dikirim! Menunggu konfirmasi admin.', 'success');
      
      const USERNAME = user?.name || "Pengguna";
      const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(numericAmount);
      // ✅ SECURITY FIX #11: encodeURIComponent pada setiap field agar karakter
      // spesial WA (*_~[]) dari username tidak bisa memformat pesan (WA text injection).
      const safeUser   = encodeURIComponent(USERNAME);
      const safeAmount = encodeURIComponent(formattedAmount);
      const safeMethod = encodeURIComponent(gatewayName);
      const textMessage = `Halo Admin PusatNokos, saya ingin melakukan konfirmasi Top Up Saldo.%0A%0A*Detail Top Up:*%0A- Username: *${safeUser}*%0A- Nominal: *${safeAmount}*%0A- Metode Pembayaran: *${safeMethod}*%0A%0ABerikut saya lampirkan bukti transfernya.`;
      window.open(`https://wa.me/${CONTACT.whatsapp}?text=${textMessage}`, '_blank', 'noopener,noreferrer');
      
      setStep(1);
      setAmount('');
    } catch (e) {
      showToast(e.message || 'Gagal memproses tiket deposit', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text) => copyToClipboardHelper(text, showToast);

  // ===== CEK STATUS PEMBAYARAN MANUAL =====
  const handleCheckStatus = async () => {
    if (!paymentRef || isCheckingStatus) return;
    setIsCheckingStatus(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res  = await fetch(`/api/paymenku/check-status?ref=${paymentRef}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.status === 'paid') {
        showToast('Pembayaran berhasil! Saldo sudah masuk ke akun kamu ⚡', 'success');
        resetQrState();
      } else if (data.status === 'expired') {
        showToast('QR sudah kadaluarsa. Silakan buat transaksi baru.', 'error');
        resetQrState();
      } else {
        showToast('Pembayaran belum diterima. Coba lagi setelah scan QR.', 'info');
      }
    } catch {
      showToast('Gagal cek status. Coba lagi.', 'error');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Label tampil untuk setiap metode
  const methodLabel = (m: string) => {
    if (m === 'paymenku') return 'BAYAR OTOMATIS (PAYMENKU)';
    if (m === 'qris')     return 'QRIS MANUAL';
    if (m === 'dana')     return 'DANA E-WALLET';
    return 'SEABANK';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-lg md:text-4xl font-black text-white mb-1 uppercase tracking-tight">Isi <span className="text-red-500">Saldo</span></h2>
        <p className="text-gray-400 font-medium text-xs md:text-lg">Tambah amunisi untuk mulai eksekusi pesanan tanpa henti.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        <Card className="lg:col-span-3 flex flex-col h-full relative overflow-hidden bg-[#080101] border-white/[0.07] p-4 md:p-10 rounded-2xl md:rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          
          {step === 1 ? (
            <>
              <div className="mb-5 animate-in fade-in slide-in-from-left-4 duration-300">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Pilih Paket Cepat</label>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {presets.map(p => (
                    <button 
                      key={p} 
                      onClick={() => setAmount(p.toString())}
                      className={`py-2 md:py-3 px-4 md:px-6 rounded-xl border-2 font-black transition-all text-sm md:text-base ${amount === p.toString() ? 'border-red-500 bg-red-600/10 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-red-900/30 bg-black text-gray-400 hover:border-red-500/50 hover:text-white'}`}
                    >
                      <FormatRupiah value={p} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Atau Ketik Manual</label>
                <div className="relative">
                  <span className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-red-500 font-black text-base md:text-xl">Rp</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10000"
                    className={`w-full bg-black border-2 border-red-900/50 rounded-2xl py-3 md:py-5 pl-10 md:pl-16 pr-3 md:pr-6 text-lg md:text-3xl font-black text-white focus:outline-none focus:border-red-500 focus:shadow-[0_0_20px_rgba(220,38,38,0.2)] transition-all`}
                  />
                </div>
              </div>

              <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Pilih Metode Pembayaran</label>
                <div className="space-y-3">
                  {/* ── Paymenku (payment gateway otomatis) ── */}
                  <div 
                    onClick={() => setMethod('paymenku')}
                    className={`flex items-center gap-4 md:gap-5 p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${method === 'paymenku' ? 'border-green-500 bg-green-600/10' : 'border-green-900/30 bg-black hover:bg-white/5'}`}
                  >
                    {/* "OTOMATIS" badge */}
                    <span className="absolute top-2 right-3 text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">⚡ OTOMATIS</span>
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${method === 'paymenku' ? 'border-green-500' : 'border-gray-600'}`}>
                      {method === 'paymenku' && <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]"></div>}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white font-black uppercase tracking-widest text-sm md:text-lg truncate">QRIS OTOMATIS</span>
                      <span className="text-gray-400 text-xs font-medium mt-0.5">QRIS Otomatis · Saldo Langsung Masuk</span>
                    </div>
                  </div>

                  {/* ── Separator ── */}
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-white/5"></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">atau transfer manual</span>
                    <div className="flex-1 h-px bg-white/5"></div>
                  </div>

                  {/* ── Metode manual tetap ada ── */}
                  {['qris', 'dana', 'seabank'].map(m => (
                    <div 
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`flex items-center gap-4 md:gap-5 p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all ${method === m ? 'border-red-500 bg-red-600/10' : 'border-red-900/30 bg-black hover:bg-white/5'}`}
                    >
                      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${method === m ? 'border-red-500' : 'border-gray-600'}`}>
                        {method === m && <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"></div>}
                      </div>
                      <span className="text-white font-black uppercase tracking-widest text-sm md:text-lg truncate">{methodLabel(m)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Estimasi fee Paymenku (hanya tampil jika nominal valid & metode paymenku) ── */}
              {method === 'paymenku' && numericAmount >= MIN_AMOUNT && (
                <div className="mb-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estimasi Biaya</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Nominal deposit</span>
                    <span className="text-white font-bold"><FormatRupiah value={numericAmount} /></span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Biaya QRIS (0.7%)</span>
                    <span className="text-yellow-400 font-bold">+ <FormatRupiah value={estimatedFee} /></span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                    <span className="text-white font-black">Total dibayar</span>
                    <span className="text-green-400 font-black"><FormatRupiah value={totalBayar} /></span>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full py-4 md:py-5 text-lg md:text-xl tracking-widest mt-auto shadow-[0_10px_30px_rgba(220,38,38,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-300 disabled:opacity-50"
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> MEMBUAT INVOICE...</>
                  : method === 'paymenku'
                    ? <><Zap className="mr-2 w-5 h-5" /> BAYAR SEKARANG</>
                    : <>LANJUT <ChevronRight className="ml-2 w-5 h-5 md:w-6 md:h-6" /></>
                }
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300 relative z-10">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Selesaikan Pembayaran</h3>
                  <p className="text-gray-400 mt-2 text-sm md:text-base">{(PAYMENT_DETAILS[method] as any)?.info || 'Silakan transfer sesuai dengan instruksi di bawah ini'}</p>
                </div>

                <div className="bg-black border-2 border-red-900/50 rounded-2xl py-6 px-4 text-center mb-8 shadow-inner">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Total Tagihan</p>
                  <p className="text-3xl md:text-4xl font-black text-red-500"><FormatRupiah value={totalBayar} /></p>
                </div>

                {/* ── PAYMENKU: tampilkan QR langsung di dalam app ── */}
                {method === 'paymenku' && (
                  <div className="flex flex-col items-center gap-4 mb-8 animate-in fade-in duration-300">
                    {(qrString || qrUrl) ? (
                      <>
                        {/* Countdown timer */}
                        {secondsLeft !== null && (
                          <div className={`w-full rounded-2xl px-4 py-2.5 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${
                            secondsLeft <= 60
                              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                              : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            {secondsLeft <= 0
                              ? 'QR Kadaluarsa — Buat transaksi baru'
                              : `QR berlaku: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                            }
                          </div>
                        )}

                        {/* QR Code */}
                        <div className={`bg-white p-4 rounded-3xl relative transition-all ${secondsLeft !== null && secondsLeft <= 0 ? 'opacity-30 grayscale' : 'shadow-[0_0_40px_rgba(34,197,94,0.2)]'}`}>
                          <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-green-400 rounded-[2rem] opacity-20 blur-lg"></div>
                          {qrString ? (
                            <QRCodeCanvas
                              value={qrString}
                              size={260}
                              className="rounded-xl relative z-10"
                            />
                          ) : (
                            <img
                              src={qrUrl!}
                              alt="QRIS Paymenku"
                              className="w-full max-w-[220px] md:max-w-[260px] h-auto rounded-xl relative z-10 bg-white"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/260x260?text=QR+Error'; }}
                            />
                          )}
                        </div>

                        {secondsLeft !== null && secondsLeft <= 0 ? (
                          <Button variant="primary" className="w-full py-3" onClick={() => { resetQrState(); }}>
                            <RefreshCw className="mr-2 w-4 h-4" /> Buat QR Baru
                          </Button>
                        ) : (
                          <>
                            <div className="w-full bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center space-y-1">
                              <p className="text-green-400 font-black text-sm uppercase tracking-widest">Scan QRIS untuk Bayar</p>
                              <p className="text-gray-400 text-xs">Gunakan aplikasi bank atau e-wallet apapun</p>
                              <p className="text-gray-500 text-xs flex items-center justify-center gap-1 mt-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Menunggu pembayaran...
                              </p>
                            </div>

                            {paymentRef && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 text-xs font-mono">Ref: {paymentRef}</span>
                                <button onClick={() => copyToClipboard(paymentRef)} className="text-gray-600 hover:text-white transition-colors">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <p className="text-gray-600 text-xs text-center">Saldo otomatis masuk setelah pembayaran dikonfirmasi ⚡</p>

                            <button
                              onClick={handleCheckStatus}
                              disabled={isCheckingStatus}
                              className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50 mt-1"
                            >
                              {isCheckingStatus
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengecek...</>
                                : <><RefreshCw className="w-3.5 h-3.5" /> Sudah bayar tapi saldo belum masuk?</>
                              }
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center space-y-2">
                          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                          <p className="text-white font-black text-lg uppercase tracking-wide">Invoice Dibuat!</p>
                          {paymentRef && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-gray-500 text-xs font-mono">Ref: {paymentRef}</span>
                              <button onClick={() => copyToClipboard(paymentRef)} className="text-gray-500 hover:text-white"><Copy className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                        {paymentUrl && (
                          <Button variant="primary" className="w-full py-4 text-lg tracking-widest bg-green-600 hover:bg-green-500 border-green-500"
                            onClick={() => window.open(paymentUrl, '_blank', 'noopener,noreferrer')}>
                            <Zap className="mr-2 w-5 h-5" /> BUKA HALAMAN PEMBAYARAN
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── QRIS Statis manual ── */}
                {method === 'qris' && (
                  <div className="flex justify-center mb-8">
                    <div className="bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.15)] relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-400 rounded-[2rem] opacity-20 blur-lg"></div>
                      <img src="/image_978f29.jpg" onError={(e) => { e.target.src = 'https://placehold.co/250x250?text=QRIS+Mock'; }} alt="QRIS Barcode" className="w-full max-w-[200px] md:max-w-[250px] h-auto rounded-xl relative z-10 bg-white" />
                    </div>
                  </div>
                )}

                {/* ── DANA / SeaBank manual ── */}
                {(method === 'dana' || method === 'seabank') && (
                  <div className="bg-[#140505] border border-red-900/30 rounded-2xl p-5 md:p-6 mb-8 text-left space-y-5">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Bank / E-Wallet</p>
                      <p className="font-black text-white text-base md:text-lg tracking-wide">{PAYMENT_DETAILS[method].name}</p>
                    </div>
                    
                    <div className="bg-black border border-white/5 rounded-xl p-3 md:p-4 flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                         <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Nomor Rekening</p>
                         <p className="font-bold text-white text-lg md:text-xl tracking-wider font-mono truncate">{PAYMENT_DETAILS[method].number}</p>
                      </div>
                      <button onClick={() => copyToClipboard(PAYMENT_DETAILS[method].number.replace(/\s/g, ''))} className="p-2 md:p-3 bg-red-600/20 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-colors shrink-0">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>

                    {PAYMENT_DETAILS[method].accountName !== '-' && (
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Atas Nama</p>
                        <p className="font-bold text-gray-300 text-sm md:text-base">{PAYMENT_DETAILS[method].accountName}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-auto">
                  <Button variant="outline" className="sm:w-1/3 py-3 md:py-4 border-gray-700 text-gray-400 hover:text-white hover:bg-white/5 text-sm md:text-base" onClick={resetQrState}>
                    <ChevronLeft className="mr-2 w-4 h-4 md:w-5 md:h-5" /> KEMBALI
                  </Button>

                  {/* Tombol konfirmasi manual hanya muncul untuk metode NON-Paymenku */}
                  {method !== 'paymenku' && (
                    <Button variant="whatsapp" disabled={isSubmitting} className="sm:w-2/3 py-3 md:py-4 text-sm md:text-base tracking-wide flex items-center justify-center gap-2 disabled:opacity-50" onClick={handleCreateDeposit}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />}
                      SAYA SUDAH TRANSFER
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6 hidden lg:flex lg:flex-col">
          <Card className="bg-gradient-to-br from-[#140505] to-black border-red-900/40 p-8 rounded-[2rem] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <h3 className="text-xl font-black text-white mb-5 uppercase tracking-wide flex items-center gap-3 relative z-10"><Shield className="text-green-500 w-6 h-6"/> KONFIRMASI OTOMATIS</h3>
            <p className="text-gray-400 leading-relaxed mb-6 font-medium relative z-10">
              Gunakan <strong className="text-white">Paymenku</strong> untuk deposit otomatis — saldo langsung masuk tanpa perlu konfirmasi ke admin!
            </p>
            <ul className="space-y-4 text-sm text-gray-300 font-bold tracking-wide relative z-10">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500"/> PILIH NOMINAL & METODE</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500"/> KLIK "BAYAR SEKARANG"</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500"/> SELESAIKAN DI HALAMAN PAYMENKU</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500"/> SALDO MASUK OTOMATIS ⚡</li>
            </ul>
          </Card>

          <Card className="bg-red-600/10 border-red-500/30 p-8 rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 opacity-20 rounded-bl-full blur-xl"></div>
            <h3 className="text-xl font-black text-white mb-3 uppercase tracking-wide flex items-center gap-3 relative z-10"><Gift className="w-6 h-6 text-red-400"/> VIP REWARD</h3>
            <p className="text-red-200/80 font-medium relative z-10">Dapatkan bonus top-up <strong className="text-white text-lg">5%</strong> instan untuk setiap akumulasi deposit di atas Rp 500.000!</p>
          </Card>
        </div>
      </div>

      {/* ── Riwayat 5 Deposit Terakhir ── */}
      {depositHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> Riwayat Deposit Terakhir
          </h3>
          <div className="space-y-2">
            {depositHistory.map(tx => {
              const isPaid    = tx.status === 'paid';
              const isPending = tx.status === 'pending';
              return (
                <div key={tx.id} className="bg-white/[0.03] border border-white/[0.05] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isPaid ? 'bg-green-500/10' : isPending ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                      {isPaid    ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                       isPending ? <Clock className="w-4 h-4 text-yellow-500" /> :
                                   <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{tx.method || 'Deposit'}</p>
                      <p className="text-gray-600 text-xs font-mono truncate">{tx.id}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-sm ${isPaid ? 'text-green-400' : isPending ? 'text-yellow-400' : 'text-gray-500'}`}>
                      +<FormatRupiah value={tx.amount} />
                    </p>
                    <span className={`text-xs font-bold uppercase ${isPaid ? 'text-green-600' : isPending ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {isPaid ? 'Berhasil' : isPending ? 'Menunggu' : 'Gagal'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
);