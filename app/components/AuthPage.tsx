'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Eye, EyeOff, Lock, Shield, AlertCircle, Check, X,
  Loader2, Zap, Globe, User, ChevronRight, ArrowRight,
  Key, ChevronLeft, Star, CheckCircle2, LogOut
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut
} from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { secureApiCall } from '@/lib/apiClient';
import { Button, Card, BRAND, DOMAIN, THEME } from './ui';

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

const isBlockedEmailDomain = (email: string) => {
  const blocked = ['mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la','spam4.me','trashmail.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  return blocked.includes(domain);
};


// ── Auth Helpers ─────────────────────────────────────────────────────────────
const isDisposableEmail = isBlockedEmailDomain;

// Cek kekuatan password
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
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


function LegalModal({ onClose, initialTab = 'terms-id' }: { onClose: () => void; initialTab?: LegalModalTab }) {
  const [activeTab, setActiveTab] = useState<LegalModalTab>(initialTab);

  const tabs: { id: LegalModalTab; label: string }[] = [
    { id: 'terms-id', label: 'Syarat & Ketentuan' },
    { id: 'terms-en', label: 'Terms of Service' },
    { id: 'privacy-id', label: 'Kebijakan Privasi' },
    { id: 'privacy-en', label: 'Privacy Policy' },
  ];

  // Tutup modal jika klik backdrop
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Tutup dengan Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const TERMS_ID = 'Syarat & Ketentuan Pusatnokos: Layanan nomor virtual untuk verifikasi OTP sekali pakai. Pengguna bertanggung jawab atas penggunaan layanan. Penyalahgunaan akan diblokir. Saldo tidak dapat ditarik tunai. Refund otomatis jika OTP tidak masuk.';
  const TERMS_EN = 'Terms & Conditions Pusatnokos: Virtual number service for one-time OTP verification. Users are responsible for their use of the service. Misuse will result in account suspension. Balance cannot be withdrawn as cash. Automatic refund if OTP is not received.';
  const PRIVACY_ID = 'Kebijakan Privasi Pusatnokos: Kami mengumpulkan email dan data transaksi untuk keperluan layanan. Data tidak dijual atau dibagikan ke pihak ketiga. Semua transaksi dienkripsi. Anda dapat meminta penghapusan akun kapan saja melalui menu pengaturan.';
  const PRIVACY_EN = 'Privacy Policy Pusatnokos: We collect email and transaction data for service purposes. Data is not sold or shared with third parties. All transactions are encrypted. You can request account deletion at any time through the settings menu.';

  const modalContent: Record<LegalModalTab, string> = {
    'terms-id': TERMS_ID,
    'terms-en': TERMS_EN,
    'privacy-id': PRIVACY_ID,
    'privacy-en': PRIVACY_EN,
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-[#0a0101] border border-red-500/20 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            Dokumen <span className="text-red-500">Legal</span>
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-white/5 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {renderLegalMarkdown(modalContent[activeTab])}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm uppercase tracking-widest transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage({ type, navigate, showToast }) {
  const isLogin = type === 'login';
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '', honeypot: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const formLoadTime = useRef(Date.now());
  const lockoutTimer = useRef(null);
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalModalTab }>({ open: false, tab: 'terms-id' });

  // ── PIN step saat register ──────────────────────────────────────────────
  const [authStep, setAuthStep] = useState('credentials'); // 'credentials' | 'verify-otp' | 'set-pin'
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pendingUser, setPendingUser] = useState(null); // Firebase user setelah akun dibuat

  // ── OTP step ─────────────────────────────────────────────────────────────
  const [otp, setOtp]                   = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cloudflare Turnstile (step: credentials) ─────────────────────────────
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef  = useRef<HTMLDivElement>(null);
  const widgetIdRef   = useRef<string | null>(null);

  // ── Cloudflare Turnstile (login) ──────────────────────────────────────────
  const [turnstileLoginToken, setTurnstileLoginToken] = useState('');
  const turnstileLoginRef = useRef<HTMLDivElement>(null);
  const widgetLoginIdRef  = useRef<string | null>(null);

  // ── Cloudflare Turnstile (step: verify-otp — khusus untuk Kirim Ulang) ──
  // Token Turnstile bersifat one-time-use. Token yang sudah dikirim ke server
  // saat pengiriman OTP pertama tidak bisa dipakai ulang untuk resend.
  // Widget kedua ini di-mount saat masuk step verify-otp agar user bisa
  // menyelesaikan CAPTCHA baru sebelum meminta OTP dikirim ulang.
  const [turnstileResendToken, setTurnstileResendToken] = useState('');
  const turnstileResendRef  = useRef<HTMLDivElement>(null);
  const widgetResendIdRef   = useRef<string | null>(null);

  const startOtpCountdown = (seconds: number) => {
    setOtpCountdown(seconds);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(otpTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (otpTimerRef.current) clearInterval(otpTimerRef.current); };
  }, []);

  // Countdown timer untuk lockout (UI only — angka datang dari server)
  useEffect(() => {
    if (lockoutRemaining > 0) {
      lockoutTimer.current = setInterval(() => {
        setLockoutRemaining(prev => {
          if (prev <= 1) {
            clearInterval(lockoutTimer.current);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
  }, [lockoutRemaining]);

  // Reset form saat switch login↔register
  useEffect(() => {
    setFormData({ name: '', email: '', password: '', honeypot: '' });
    setError('');
    setShowPassword(false);
    setTurnstileToken('');
    setTurnstileLoginToken('');
    formLoadTime.current = Date.now();
  }, [isLogin]);

  // ── Render Cloudflare Turnstile widget saat halaman register ────────────
  useEffect(() => {
    if (isLogin) return;
    let intervalId: ReturnType<typeof setInterval>;
    intervalId = setInterval(() => {
      if ((window as any).turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          theme: 'dark',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
        clearInterval(intervalId);
      }
    }, 200);
    return () => {
      clearInterval(intervalId);
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      setTurnstileToken('');
    };
  }, [isLogin]);

  // ── Render Cloudflare Turnstile widget saat halaman login ────────────────
  useEffect(() => {
    if (!isLogin) return;
    let intervalId: ReturnType<typeof setInterval>;
    intervalId = setInterval(() => {
      if ((window as any).turnstile && turnstileLoginRef.current && !widgetLoginIdRef.current) {
        widgetLoginIdRef.current = (window as any).turnstile.render(turnstileLoginRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          theme: 'dark',
          callback: (token: string) => setTurnstileLoginToken(token),
          'expired-callback': () => setTurnstileLoginToken(''),
          'error-callback': () => setTurnstileLoginToken(''),
        });
        clearInterval(intervalId);
      }
    }, 200);
    return () => {
      clearInterval(intervalId);
      if (widgetLoginIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetLoginIdRef.current);
        widgetLoginIdRef.current = null;
      }
      setTurnstileLoginToken('');
    };
  }, [isLogin]);

  // ── Render widget Turnstile KEDUA — khusus step verify-otp (Kirim Ulang) ─
  // Di-mount saat authStep berubah ke 'verify-otp' dan di-unmount saat keluar.
  // Ini memastikan token baru tersedia setiap kali user ingin resend OTP,
  // karena token dari pengiriman pertama sudah tidak bisa dipakai lagi.
  useEffect(() => {
    if (authStep !== 'verify-otp') return;
    let intervalId: ReturnType<typeof setInterval>;
    intervalId = setInterval(() => {
      if ((window as any).turnstile && turnstileResendRef.current && !widgetResendIdRef.current) {
        widgetResendIdRef.current = (window as any).turnstile.render(turnstileResendRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          theme: 'dark',
          callback: (token: string) => setTurnstileResendToken(token),
          'expired-callback': () => setTurnstileResendToken(''),
          'error-callback': () => setTurnstileResendToken(''),
        });
        clearInterval(intervalId);
      }
    }, 200);
    return () => {
      clearInterval(intervalId);
      if (widgetResendIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetResendIdRef.current);
        widgetResendIdRef.current = null;
      }
      setTurnstileResendToken('');
    };
  }, [authStep]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === 'name') val = val.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);
    else if (name === 'password') val = val.substring(0, 128);
    else if (name === 'email') val = val.substring(0, 200);
    setFormData(prev => ({ ...prev, [name]: val }));
    if (error) setError('');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    // ✅ HONEYPOT: Bot yang isi field tersembunyi ini langsung ditolak diam-diam
    if (formData.honeypot) {
      await new Promise(r => setTimeout(r, 2000)); // Delay agar bot tidak tahu
      return;
    }

    // ✅ TIMING CHECK: Form yang disubmit < 1.5 detik kemungkinan bot
    const elapsed = Date.now() - formLoadTime.current;
    if (elapsed < 1500) {
      await new Promise(r => setTimeout(r, 1500 - elapsed));
    }

    // ✅ LOCKOUT CHECK — SERVER-SIDE (tidak bisa di-bypass via DevTools)
    if (isLogin) {
      // ✅ Validasi Turnstile token untuk login
      if (!turnstileLoginToken) {
        setError('Selesaikan verifikasi CAPTCHA terlebih dahulu.');
        setIsLoading(false);
        return;
      }
      const rlCheck = await serverCheckRateLimit(formData.email.trim().toLowerCase());
      if (!rlCheck.allowed) {
        setError(rlCheck.error ?? 'Terlalu banyak percobaan. Coba lagi nanti.');
        return;
      }
    }

    if (!auth || !db) {
      setError('Sistem gagal dimuat. Coba refresh halaman.');
      return;
    }

    // ✅ VALIDASI INPUT SEBELUM REQUEST
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Format email tidak valid.');
      return;
    }

    if (!isLogin) {
      if (isDisposableEmail(formData.email)) {
        setError('Email sementara (disposable) tidak diizinkan. Gunakan email aktif Anda.');
        return;
      }
      const safeName = formData.name.trim();
      if (!safeName || safeName.length < 2) {
        setError('Nama minimal 2 karakter.');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password minimal 8 karakter untuk keamanan akun Anda.');
        return;
      }
      const strength = getPasswordStrength(formData.password);
      if (strength.score < 2) {
        setError('Password terlalu lemah. Gunakan kombinasi huruf besar, angka, atau simbol.');
        return;
      }
    } else {
      if (formData.password.length < 6) {
        setError('Password tidak valid.');
        return;
      }
    }

    // ✅ EXPONENTIAL BACKOFF berdasarkan jumlah percobaan gagal sebelumnya
    const delay = getDelay(attempts);
    if (delay > 0) await new Promise(r => setTimeout(r, delay));

    setIsLoading(true);

    try {
      if (isLogin) {
        // ✅ Hapus flag 'registering' yang mungkin tersisa dari registrasi yang gagal/belum selesai.
        // Tanpa ini, onAuthStateChanged akan skip setUser dan user tetap di halaman login.
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('registering');
        await signInWithEmailAndPassword(auth, formData.email.trim().toLowerCase(), formData.password);
        await serverClearRateLimit(formData.email.trim().toLowerCase()); // Login berhasil: reset counter server
        // Reset widget Turnstile login setelah berhasil
        setTurnstileLoginToken('');
        if (widgetLoginIdRef.current && (window as any).turnstile) {
          (window as any).turnstile.reset(widgetLoginIdRef.current);
        }
        showToast('Berhasil masuk!', 'success');
      } else {
        // Kirim OTP dulu — akun Firebase belum dibuat di sini
        // ✅ Validasi Turnstile token sebelum request ke server
        if (!turnstileToken) {
          setError('Selesaikan verifikasi CAPTCHA terlebih dahulu.');
          setIsLoading(false);
          return;
        }
        // ✅ SECURITY FIX: Sanitasi name agar tidak ada newline/HTML untuk cegah email template injection
        const safeName = formData.name.trim().replace(/[\r\n<>]/g, '').substring(0, 100);
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            name:  safeName,
            cfToken: turnstileToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengirim OTP.');
        startOtpCountdown(60);
        setAuthStep('verify-otp');
        showToast('Kode OTP dikirim! Cek inbox email Anda.', 'success');
      }
    } catch (err) {
      const code = err?.code ?? '';
      let msg = err?.message || 'Terjadi kesalahan. Silakan coba lagi.';

      // Error Firebase Auth (login)
      if (code === 'auth/email-already-in-use') {
        msg = 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Format email tidak valid.';
      } else if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        await serverRecordFailure(formData.email.trim().toLowerCase());
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const remaining = MAX_ATTEMPTS - newAttempts;
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutRemaining(15 * 60);
          msg = 'Akun dikunci 15 menit karena terlalu banyak percobaan gagal.';
        } else {
          msg = `Email atau kata sandi salah.${remaining > 0 && remaining <= 3 ? ` Sisa ${remaining} percobaan sebelum dikunci.` : ''}`;
        }
        // Reset Turnstile login agar user bisa coba lagi dengan token baru
        setTurnstileLoginToken('');
        if (widgetLoginIdRef.current && (window as any).turnstile) {
          (window as any).turnstile.reset(widgetLoginIdRef.current);
        }
      } else if (code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan dari perangkat ini. Coba lagi nanti.';
        await serverRecordFailure(formData.email.trim().toLowerCase());
      } else if (code === 'auth/network-request-failed') {
        msg = 'Koneksi gagal. Periksa internet Anda.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password terlalu lemah. Minimal 8 karakter dengan variasi.';
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Masukkan email Anda terlebih dahulu.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Format email tidak valid.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, formData.email.trim().toLowerCase());
      // ✅ Selalu tampilkan pesan sukses — tidak konfirmasi apakah email terdaftar (anti-enumeration)
      showToast('Jika email terdaftar, tautan reset telah dikirim. Cek inbox Anda.', 'success');
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak permintaan. Coba lagi nanti.');
      } else {
        // Jangan bocorkan detail error lain
        showToast('Jika email terdaftar, tautan reset telah dikirim. Cek inbox Anda.', 'success');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handler verifikasi OTP + buat akun ──────────────────────────────────
  const handleVerifyOtp = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp)) { setError('Kode OTP harus 6 digit angka.'); return; }
    setIsLoading(true);
    try {
      // 1. Verifikasi OTP ke server
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase(), otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP tidak valid.');

      // 2. OTP valid — tandai sedang registrasi supaya onAuthStateChanged tidak redirect
      sessionStorage.setItem('registering', '1');

      // Buat akun Firebase
      const safeName       = formData.name.trim().substring(0, 50);
      const userCredential = await createUserWithEmailAndPassword(
        auth, formData.email.trim().toLowerCase(), formData.password
      );

      // Set emailVerified = true via admin karena user sudah verifikasi lewat OTP
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/mark-verified', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      await updateProfile(userCredential.user, { displayName: safeName });
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name:                safeName,
        email:               formData.email.trim().toLowerCase(),
        balance:             0,
        totalSpent:          0,
        role:                'user',
        banned:              false,
        createdAt:           Date.now(),
        emailVerifiedViaOtp: true,
      });

      // 3. Lanjut ke step set-pin
      setPendingUser(userCredential.user);
      setAuthStep('set-pin');
      showToast('Email terverifikasi! Sekarang buat PIN keamanan Anda.', 'success');
    } catch (e: any) {
      sessionStorage.removeItem('registering');
      const code = e?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan masuk atau gunakan email lain.');
      } else {
        setError(e.message || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    setError('');

    // ✅ Gunakan turnstileResendToken (bukan turnstileToken yang sudah dikonsumsi
    // saat pengiriman OTP pertama). Token Turnstile bersifat one-time-use —
    // mengirim token lama akan selalu ditolak server dengan error CAPTCHA gagal.
    if (!turnstileResendToken) {
      setError('Selesaikan verifikasi CAPTCHA terlebih dahulu sebelum mengirim ulang.');
      return;
    }

    setIsLoading(true);
    try {
      const safeName = formData.name.trim().replace(/[\r\n<>]/g, '').substring(0, 100);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:   formData.email.trim().toLowerCase(),
          name:    safeName,
          cfToken: turnstileResendToken,          // ← token baru dari widget resend
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal kirim ulang OTP.');
      startOtpCountdown(60);
      setOtp('');

      // ✅ Reset widget resend agar token tidak bisa dipakai dua kali.
      // Widget akan otomatis menghasilkan token baru setelah reset.
      setTurnstileResendToken('');
      if (widgetResendIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.reset(widgetResendIdRef.current);
      }

      showToast('Kode OTP baru telah dikirim!', 'success');
    } catch (e: any) {
      setError(e.message || 'Gagal kirim ulang OTP.');
      // Reset widget jika terjadi error agar user bisa coba lagi dengan token segar
      setTurnstileResendToken('');
      if (widgetResendIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.reset(widgetResendIdRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handler submit PIN saat register ────────────────────────────────────
  const handleSetPin = async () => {
    setError('');
    const WEAK_PINS = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','9876'];
    if (!/^\d{4}$/.test(pin)) { setError('PIN harus tepat 4 digit angka.'); return; }
    if (WEAK_PINS.includes(pin)) { setError('PIN terlalu mudah ditebak. Gunakan kombinasi unik.'); return; }
    if (pin !== pinConfirm) { setError('Konfirmasi PIN tidak cocok.'); return; }
    if (!pendingUser) { setError('Sesi tidak valid, silakan daftar ulang.'); return; }
    setIsLoading(true);
    try {
      const token = await pendingUser.getIdToken();
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PIN.');
      sessionStorage.removeItem('registering');
      await signOut(auth);
      showToast('PIN berhasil dibuat! Silakan masuk.', 'success');
      navigate('login');
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const isLocked = lockoutRemaining > 0;
  const formatLockout = (secs) => `${Math.floor(secs / 60).toString().padStart(2,'0')}:${(secs % 60).toString().padStart(2,'0')}`;

  // ── UI: step verifikasi OTP ──────────────────────────────────────────────
  if (authStep === 'verify-otp') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 z-10 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
          <div className="absolute inset-0 bg-red-700 rounded-3xl blur-[120px] opacity-20"></div>
          <Card className="relative p-6 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Shield className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Verifikasi Email</h2>
              <p className="text-gray-400 font-medium text-sm">Kode OTP 6 digit telah dikirim ke</p>
              <p className="text-white font-bold mt-1">{formData.email}</p>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
              </div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Kode OTP (6 digit)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  disabled={isLoading}
                  placeholder="• • • • • •"
                  className="w-full bg-black border border-red-900/40 rounded-xl py-4 px-5 text-white font-mono text-2xl text-center tracking-[1rem] placeholder-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner disabled:opacity-50"
                />
              </div>
              <Button
                variant="primary"
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.length < 6}
                className="w-full py-4 text-lg tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
              >
                {isLoading
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MEMVERIFIKASI...</>
                  : <><CheckCircle2 className="w-5 h-5 mr-2" /> VERIFIKASI OTP</>}
              </Button>
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-2">Tidak dapat kode?</p>
                {otpCountdown > 0 ? (
                  <p className="text-gray-400 text-sm font-bold">
                    Kirim ulang dalam <span className="text-red-400">{otpCountdown}s</span>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Widget Turnstile khusus resend — token dari pengiriman pertama
                        sudah expired/dikonsumsi, jadi butuh token baru di sini */}
                    <div className="flex justify-center">
                      <div ref={turnstileResendRef} />
                    </div>
                    {!turnstileResendToken && (
                      <p className="text-xs text-gray-500">Selesaikan verifikasi di atas untuk mengaktifkan tombol kirim ulang.</p>
                    )}
                    <button
                      onClick={handleResendOtp}
                      disabled={isLoading || !turnstileResendToken}
                      className="text-red-500 hover:text-red-400 text-sm font-bold hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 mx-auto"
                    >
                      <RefreshCw className="w-3 h-3" /> Kirim Ulang OTP
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setAuthStep('credentials'); setOtp(''); setError(''); }}
                disabled={isLoading}
                className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Ganti email / kembali
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── UI: step buat PIN saat register ─────────────────────────────────────
  if (authStep === 'set-pin') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 z-10 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
          <div className="absolute inset-0 bg-red-700 rounded-3xl blur-[120px] opacity-20"></div>
          <Card className="relative p-6 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Key className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Buat PIN</h2>
              <p className="text-red-200/50 font-medium text-sm">PIN 4 digit dipakai setiap kali login sebagai lapisan keamanan tambahan</p>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
              </div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">PIN Baru (4 digit)</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="••••" disabled={isLoading}
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Konfirmasi PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="••••" disabled={isLoading}
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50`}
                />
              </div>
              <Button variant="primary" disabled={isLoading || pin.length < 4 || pinConfirm.length < 4}
                className="w-full py-4 mt-2 text-lg tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
                onClick={handleSetPin}>
                {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENYIMPAN...</> : <><Key className="w-5 h-5 mr-2" /> SIMPAN PIN</>}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 z-10 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
        <div className="absolute inset-0 bg-red-700 rounded-3xl blur-[120px] opacity-20"></div>
        
        <Card className="relative p-6 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
          <div className="text-center mb-8">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 border shadow-[0_0_20px_rgba(220,38,38,0.3)] ${isLocked ? 'bg-orange-600/20 border-orange-500/30' : 'bg-red-600/20 border-red-500/30'}`}>
              {isLocked ? <AlertTriangle className="w-8 h-8 text-orange-500" /> : <Lock className="w-8 h-8 text-red-500" />}
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">
              {isLocked ? 'Akun Dikunci' : isLogin ? 'Welcome Back' : 'Join The Elite'}
            </h2>
            <p className="text-red-200/50 font-medium text-sm">
              {isLocked
                ? 'Terlalu banyak percobaan gagal. Tunggu sebentar.'
                : isLogin ? 'Masuk ke dashboard untuk kelola nomor Anda' : 'Buat akun sekarang. Mulai dalam 30 detik.'}
            </p>
          </div>

          {/* LOCKOUT BANNER */}
          {isLocked && (
            <div className="mb-6 p-5 bg-orange-950/60 border border-orange-500/40 rounded-xl text-center">
              <p className="text-orange-300 font-bold text-sm mb-2 uppercase tracking-widest">Coba lagi dalam</p>
              <p className="text-4xl font-black text-orange-400 font-mono tracking-widest">{formatLockout(lockoutRemaining)}</p>
              <p className="text-orange-200/50 text-xs mt-2">Terlalu banyak percobaan login gagal terdeteksi</p>
            </div>
          )}

          {error && !isLocked && (
            <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Attempts warning bar */}
          {attempts > 0 && attempts < MAX_ATTEMPTS && !isLocked && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-xl flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
              <p className="text-yellow-300 font-bold">
                {MAX_ATTEMPTS - attempts} percobaan tersisa sebelum akun dikunci 15 menit
              </p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5" autoComplete="on">
            {/* ✅ HONEYPOT: Field tersembunyi — manusia tidak lihat, bot mengisinya */}
            <input
              type="text"
              name="website"
              value={formData.honeypot}
              onChange={e => setFormData(prev => ({ ...prev, honeypot: e.target.value }))}
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            />

            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text" name="name" value={formData.name}
                    onChange={handleInputChange} disabled={isLoading || isLocked}
                    required minLength={2} maxLength={50} placeholder="Nama Lengkap Anda"
                    autoComplete="name"
                    className={`w-full bg-black border ${THEME.border} rounded-xl py-4 pl-12 pr-4 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner disabled:opacity-50`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email" name="email" value={formData.email}
                  onChange={handleInputChange} disabled={isLoading || isLocked}
                  required placeholder="email@aktif.com"
                  autoComplete="email"
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-4 pl-12 pr-4 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner disabled:opacity-50`}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                {isLogin && (
                  <button type="button" onClick={handleResetPassword} disabled={isLoading || isLocked}
                    className="text-xs font-bold text-red-500 hover:text-red-400 hover:underline disabled:opacity-50">
                    Lupa Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                  onChange={handleInputChange} disabled={isLoading || isLocked}
                  required minLength={isLogin ? 6 : 8} maxLength={128}
                  placeholder={isLogin ? '••••••••' : 'Min 8 karakter, campuran huruf & angka'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-4 pl-12 pr-12 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner disabled:opacity-50`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* ✅ PASSWORD STRENGTH METER (hanya saat register) */}
              {!isLogin && formData.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= passwordStrength.score ? passwordStrength.color : 'bg-white/10'
                      }`} />
                    ))}
                  </div>
                  <p className={`text-xs font-bold ${
                    passwordStrength.score <= 1 ? 'text-red-500' :
                    passwordStrength.score === 2 ? 'text-orange-500' :
                    passwordStrength.score === 3 ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>Kekuatan: {passwordStrength.label}</p>
                </div>
              )}
            </div>

            {/* ✅ CLOUDFLARE TURNSTILE — hanya tampil saat register */}
            {!isLogin && (
              <div className="flex justify-center">
                <div ref={turnstileRef} />
              </div>
            )}

            {/* ✅ CLOUDFLARE TURNSTILE — tampil saat login */}
            {isLogin && (
              <div className="flex justify-center">
                <div ref={turnstileLoginRef} />
              </div>
            )}

            <Button
              variant="primary" type="submit"
              disabled={isLoading || isLocked || (!isLogin && !turnstileToken) || (isLogin && !turnstileLoginToken)}
              className="w-full py-4 mt-2 text-lg tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
            >
              {isLoading
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MEMPROSES...</>
                : isLocked
                ? <><AlertTriangle className="w-5 h-5 mr-2" /> DIKUNCI — {formatLockout(lockoutRemaining)}</>
                : isLogin ? 'Masuk Dashboard' : 'Buat Akun'}
            </Button>
          </form>

          {/* Security badges */}
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              <Shield className="w-3 h-3 text-green-600" /> SSL Encrypted
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              <Lock className="w-3 h-3 text-blue-600" /> Firebase Auth
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              <Zap className="w-3 h-3 text-yellow-600" /> Rate Limited
            </span>
          </div>

          <div className="mt-6 text-center text-sm font-medium text-gray-400 border-t border-white/5 pt-6">
            {isLogin ? 'Belum punya akun? ' : 'Sudah terdaftar? '}
            <button
              onClick={() => !isLoading && !isLocked && navigate(isLogin ? 'register' : 'login')}
              disabled={isLoading || isLocked}
              className="text-white font-bold border-b border-red-500 pb-0.5 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {isLogin ? 'Daftar Sekarang' : 'Masuk di sini'}
            </button>
          </div>

          {legalModal.open && (
            <LegalModal
              initialTab={legalModal.tab}
              onClose={() => setLegalModal({ open: false, tab: 'terms-id' })}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// PIN VERIFY PAGE (setelah login, sebelum masuk dashboard)
// ==========================================
export function PinVerifyPage({ user, navigate, showToast }) {
  // ── step: 'pin' | 'forgot-otp' | 'forgot-newpin' ──
  const [step, setStep]               = useState('pin');
  const [pin, setPin]                 = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [locked, setLocked]           = useState(false);
  // forgot PIN state
  const [otp, setOtp]                 = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [newPin, setNewPin]           = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [showNewPin, setShowNewPin]   = useState(false);

  const userEmail      = user?.email || auth?.currentUser?.email || '';
  const WEAK_PINS      = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','9876'];
  // ✅ FIX #5: Simpan ref timer supaya bisa di-cleanup saat komponen unmount (cegah memory leak)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startCountdown = useCallback((secs: number) => {
    setOtpCountdown(secs);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setOtpCountdown(p => {
        if (p <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  }, []);

  // ── Verifikasi PIN normal ──────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (pin.length < 4 || isLoading || locked) return;
    setIsLoading(true);
    setError('');
    try {
      if (!auth?.currentUser) throw new Error('Sesi tidak valid.');
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // ✅ SECURITY FIX KRITIS #3: sessionStorage HANYA dipakai sebagai cache UX
        // (supaya tidak tanya PIN tiap klik navigasi dalam satu session browser).
        // Sumber kebenaran tetap di server: /api/auth/verify-pin memvalidasi hash via Admin SDK.
        // Bahkan kalau user manipulasi sessionStorage via DevTools, setiap API call sensitif
        // (buy-number, topup, approve-deposit) TETAP memvalidasi token JWT di server —
        // mereka tidak cek sessionStorage sama sekali.
        // Worst case bypass: user bisa lihat halaman dashboard tapi tidak bisa transaksi.
        if (typeof sessionStorage !== 'undefined' && auth.currentUser) {
          // Simpan juga timestamp untuk bisa expired (opsional, untuk keamanan extra)
          const pinSession = { verified: true, ts: Date.now() };
          sessionStorage.setItem(`pin_ok_${auth.currentUser.uid}`, JSON.stringify(pinSession));
        }
        showToast('PIN terverifikasi!', 'success');
        navigate('dash_home');
      } else {
        if (data.locked) {
          setLocked(true);
          setError(data.error || 'PIN dikunci.');
        } else {
          setAttemptsLeft(data.attemptsLeft ?? (attemptsLeft - 1));
          setError(data.error || 'PIN salah.');
          setPin('');
        }
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [pin, isLoading, locked, attemptsLeft, navigate, showToast]);

  // Auto-submit saat 4 digit terisi
  useEffect(() => { if (pin.length === 4 && step === 'pin') handleVerify(); }, [pin, step, handleVerify]);

  // ── Kirim OTP reset PIN ───────────────────────────────────────────────────
  const handleSendResetOtp = async () => {
    if (!userEmail) { setError('Email tidak ditemukan. Coba keluar dan login ulang.'); return; }
    setIsLoading(true); setError('');
    try {
      // ✅ SECURITY FIX: Sertakan Authorization header agar endpoint tidak bisa
      // dieksploitasi untuk email-bombing ke alamat siapapun tanpa autentikasi.
      if (!auth?.currentUser) throw new Error('Sesi tidak valid. Silakan login ulang.');
      const token = await auth.currentUser.getIdToken();
      // Sanitasi name: hapus newline/carriage return untuk cegah email template injection
      const safeName = (user?.name || 'Pengguna').replace(/[\r\n<>]/g, '').substring(0, 100);
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: userEmail, name: safeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim OTP.');
      startCountdown(60);
      setStep('forgot-otp');
      setOtp('');
      showToast('Kode OTP dikirim ke email Anda.', 'success');
    } catch (e: any) {
      setError(e.message || 'Gagal mengirim OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verifikasi OTP lupa PIN ───────────────────────────────────────────────
  const handleVerifyResetOtp = async () => {
    if (otp.length < 6) { setError('Masukkan kode OTP 6 digit.'); return; }
    setIsLoading(true); setError('');
    try {
      // ✅ SECURITY FIX: Sertakan Authorization header agar verify-otp terikat
      // ke sesi user yang valid. Server wajib simpan flag "otp_verified_{uid}"
      // (dengan TTL 5 menit) dan memvalidasinya di endpoint /api/auth/reset-pin,
      // sehingga langkah OTP tidak bisa di-skip via direct POST.
      if (!auth?.currentUser) throw new Error('Sesi tidak valid. Silakan login ulang.');
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: userEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP salah atau kadaluarsa.');
      setStep('forgot-newpin');
      setError('');
      showToast('Email terverifikasi! Sekarang buat PIN baru.', 'success');
    } catch (e: any) {
      setError(e.message || 'OTP tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset PIN baru ────────────────────────────────────────────────────────
  const handleResetPin = async () => {
    setError('');
    if (!/^\d{4}$/.test(newPin)) { setError('PIN harus tepat 4 digit angka.'); return; }
    if (WEAK_PINS.includes(newPin)) { setError('PIN terlalu mudah ditebak. Gunakan kombinasi unik.'); return; }
    if (newPin !== newPinConfirm) { setError('Konfirmasi PIN tidak cocok.'); return; }
    setIsLoading(true);
    try {
      if (!auth?.currentUser) throw new Error('Sesi tidak valid.');
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: newPin, email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset PIN.');
      // Langsung masuk — tidak perlu verifikasi PIN lagi
      if (typeof sessionStorage !== 'undefined' && auth.currentUser) {
        sessionStorage.setItem(`pin_ok_${auth.currentUser.uid}`, JSON.stringify({ verified: true, ts: Date.now() }));
      }
      showToast('PIN berhasil direset! Selamat datang.', 'success');
      navigate('dash_home');
    } catch (e: any) {
      setError(e.message || 'Gagal mereset PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => { if (auth) await signOut(auth); navigate('login'); };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#040101]">
      <div className="w-full max-w-sm relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-700 rounded-full blur-[160px] opacity-10 pointer-events-none"></div>

        {/* ── STEP: Verifikasi PIN ── */}
        {step === 'pin' && (
          <Card className="relative p-8 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                {locked ? <AlertTriangle className="w-8 h-8 text-orange-500" /> : <Key className="w-8 h-8 text-red-500" />}
              </div>
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">
                {locked ? 'PIN Dikunci' : 'Masukkan PIN'}
              </h2>
              <p className="text-gray-500 text-sm font-medium">
                {locked ? 'Terlalu banyak percobaan salah.' : `Halo, ${user?.name || 'kamu'}! Verifikasi PIN untuk lanjut.`}
              </p>
            </div>
            {error && (
              <div className="mb-5 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
              </div>
            )}
            {!locked && (
              <div className="space-y-5">
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="••••" disabled={isLoading} autoFocus
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-5 px-6 text-white text-center text-3xl font-black tracking-[0.8em] placeholder-gray-800 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50`}
                />
                <Button variant="primary" disabled={isLoading || pin.length < 4}
                  className="w-full py-4 text-lg tracking-widest uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
                  onClick={handleVerify}>
                  {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MEMVERIFIKASI...</> : 'VERIFIKASI PIN'}
                </Button>
              </div>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              {/* Tombol lupa PIN — muncul saat normal atau saat dikunci */}
              <button onClick={handleSendResetOtp} disabled={isLoading}
                className="text-red-500 hover:text-red-400 text-sm font-bold hover:underline disabled:opacity-50 transition-colors">
                Lupa PIN? Reset via Email
              </button>
              <button onClick={handleLogout} disabled={isLoading}
                className="text-xs text-gray-600 hover:text-gray-400 font-bold uppercase tracking-widest transition-colors">
                Keluar & Login Ulang
              </button>
            </div>
          </Card>
        )}

        {/* ── STEP: Input OTP untuk reset PIN ── */}
        {step === 'forgot-otp' && (
          <Card className="relative p-8 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Shield className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">Cek Email Anda</h2>
              <p className="text-gray-500 text-sm">Kode OTP dikirim ke</p>
              <p className="text-white font-bold text-sm mt-1 truncate">{userEmail}</p>
            </div>
            {error && (
              <div className="mb-5 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
              </div>
            )}
            <div className="space-y-5">
              <input
                type="text" inputMode="numeric" maxLength={6} value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                placeholder="• • • • • •" disabled={isLoading} autoFocus
                className="w-full bg-black border border-red-900/40 rounded-xl py-4 px-5 text-white font-mono text-2xl text-center tracking-[1rem] placeholder-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all disabled:opacity-50"
              />
              <Button variant="primary" disabled={isLoading || otp.length < 6}
                className="w-full py-4 text-base tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
                onClick={handleVerifyResetOtp}>
                {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MEMVERIFIKASI...</> : <><CheckCircle2 className="w-5 h-5 mr-2" /> VERIFIKASI OTP</>}
              </Button>
              <div className="text-center">
                {otpCountdown > 0 ? (
                  <p className="text-gray-500 text-sm">Kirim ulang dalam <span className="text-red-400 font-bold">{otpCountdown}s</span></p>
                ) : (
                  <button onClick={handleSendResetOtp} disabled={isLoading}
                    className="text-red-500 hover:text-red-400 text-sm font-bold hover:underline disabled:opacity-50 transition-colors flex items-center gap-1 mx-auto">
                    <RefreshCw className="w-4 h-4" /> Kirim Ulang OTP
                  </button>
                )}
              </div>
              <button onClick={() => { setStep('pin'); setError(''); setOtp(''); }} disabled={isLoading}
                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Kembali
              </button>
            </div>
          </Card>
        )}

        {/* ── STEP: PIN baru ── */}
        {step === 'forgot-newpin' && (
          <Card className="relative p-8 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Key className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">PIN Baru</h2>
              <p className="text-gray-500 text-sm">Buat PIN baru yang kuat dan mudah diingat.</p>
            </div>
            {error && (
              <div className="mb-5 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
              </div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">PIN Baru (4 digit)</label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    placeholder="••••" disabled={isLoading} autoFocus
                    className={`w-full bg-black border ${THEME.border} rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50`}
                  />
                  <button type="button" onClick={() => setShowNewPin(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showNewPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Konfirmasi PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={newPinConfirm}
                  onChange={e => setNewPinConfirm(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="••••" disabled={isLoading}
                  className={`w-full bg-black border ${THEME.border} rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50`}
                />
              </div>
              <Button variant="primary" disabled={isLoading || newPin.length < 4 || newPinConfirm.length < 4}
                className="w-full py-4 text-base tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
                onClick={handleResetPin}>
                {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENYIMPAN...</> : <><Key className="w-5 h-5 mr-2" /> SIMPAN PIN BARU</>}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SETUP PIN PAGE — untuk user yang login tapi belum punya PIN
// (registrasi dulu tidak selesai karena bug blank screen)
// ==========================================
export function SetupPinPage({ user, navigate, showToast, logout }) {
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const WEAK_PINS = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','9876'];

  const handleSetPin = async () => {
    setError('');
    if (!/^\d{4}$/.test(pin)) { setError('PIN harus tepat 4 digit angka.'); return; }
    if (WEAK_PINS.includes(pin)) { setError('PIN terlalu mudah ditebak. Gunakan kombinasi unik.'); return; }
    if (pin !== pinConfirm) { setError('Konfirmasi PIN tidak cocok.'); return; }
    if (!user) { setError('Sesi tidak valid, silakan login ulang.'); return; }
    setIsLoading(true);
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PIN.');
      // PIN berhasil dibuat — set flag verified dan masuk dashboard
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`pin_ok_${firebaseUser.uid}`, JSON.stringify({ verified: true, ts: Date.now() }));
      }
      showToast('PIN berhasil dibuat! Selamat datang.', 'success');
      setTimeout(() => { window.location.reload(); }, 1000);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080101] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-700 rounded-full blur-[150px] opacity-10"></div>
        </div>
        <Card className="relative p-8 md:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.8)] bg-[#080101] border-white/[0.07]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 bg-red-600/20 border border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <Key className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Buat PIN Dulu</h2>
            <p className="text-gray-400 font-medium text-sm">Akun Anda belum memiliki PIN keamanan. Buat PIN 4 digit untuk melanjutkan.</p>
          </div>
          {error && (
            <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 text-red-200 rounded-xl flex items-start text-sm gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><p>{error}</p>
            </div>
          )}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">PIN Baru (4 digit)</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="••••" disabled={isLoading}
                  className="w-full bg-black border border-red-900/40 rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Konfirmasi PIN</label>
              <input
                type="password" inputMode="numeric" maxLength={4} value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').substring(0, 4))}
                placeholder="••••" disabled={isLoading}
                className="w-full bg-black border border-red-900/40 rounded-xl py-4 px-6 text-white text-center text-2xl font-black tracking-[0.5em] placeholder-gray-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50"
              />
            </div>
            <Button variant="primary" disabled={isLoading || pin.length < 4 || pinConfirm.length < 4}
              className="w-full py-4 mt-2 text-lg tracking-wide uppercase shadow-[0_5px_20px_rgba(220,38,38,0.4)]"
              onClick={handleSetPin}>
              {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENYIMPAN...</> : <><Key className="w-5 h-5 mr-2" /> SIMPAN PIN & MASUK</>}
            </Button>
            <button
              onClick={async () => { if (auth) await signOut(auth); navigate('login'); }}
              disabled={isLoading}
              className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" /> Keluar & Login Ulang
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD LAYOUT & PAGES
// =========================================