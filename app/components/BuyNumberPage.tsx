'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
// @ts-ignore
import { FixedSizeList } from 'react-window';
import {
  Search, Filter, ShoppingCart, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, ChevronDown,
  AlertCircle, AlertTriangle, Check, X,
  Key, Clock, Copy, Zap, Smartphone, Globe, Lock, Shield, Flame,
  Star, ArrowRight, CheckCircle2, XCircle, CreditCard, History,
  Gift, User, MessageCircle, Plus, Eye, EyeOff
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { secureApiCall } from '@/lib/apiClient';
import { Button } from './ui';

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

const copyToClipboardHelper = (text: string, showToastFn?: (msg: string, type: string) => void) => {
  const fallback = (t: string) => {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;top:0;left:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  };
  if (!navigator.clipboard || !window.isSecureContext) {
    fallback(text);
    if (showToastFn) showToastFn('Berhasil disalin!', 'success');
  } else {
    navigator.clipboard.writeText(text)
      .then(() => { if (showToastFn) showToastFn('Berhasil disalin!', 'success'); })
      .catch(() => { fallback(text); if (showToastFn) showToastFn('Berhasil disalin!', 'success'); });
  }
};

// ── Components + Data (extracted from page.tsx) ───────────────────────────
const _CARD_H = 220;
const _GAP    = 12;

function _cols(w) {
  if (w >= 1536) return 5;
  if (w >= 1024) return 4;
  if (w >= 640)  return 3;
  return 2;
}

const _CatalogRow = memo(function _CatalogRow({ index, style, data }) {
  const { rows, liveStocks, onBuyClick, getServiceMetaFn, getCountriesFn, getRealPriceFn } = data;
  const row = rows[index];
  if (!row) return null;
  return (
    <div style={{ ...style, display: 'flex', gap: _GAP, paddingBottom: _GAP, boxSizing: 'border-box' }}>
      {row.map(item => {
        const liveData      = liveStocks[item.serviceId];
        const stockCount    = liveData?.count != null ? Number(liveData.count) : null;
        const hasTier       = liveData?.prices && Object.keys(liveData.prices).length > 0;
        const isOutOfStock  = !liveData || stockCount === 0 || (stockCount === null && !hasTier);
        const startingPrice = liveData?.minPrice > 0
          ? liveData.minPrice
          : getRealPriceFn(item.countryId, item.serviceId, 'cheap');
        // ✅ FIX NAMA: Selalu gunakan saName dari provider sebagai nama tampilan karena
        // itulah nama ASLI yang dikembalikan API (InDriver, MoMo, dll).
        // Icon/styling tetap diambil dari baseMeta (SERVICES array kita) jika ada.
        // saName dikosongkan di-override hanya jika kita punya nama yang lebih baik
        // di SERVICES dan saName-nya adalah nama generik/tidak dikenal.
        // ✅ FIX ICON: getSAServiceMeta memprioritaskan saName dari API untuk
        // menentukan icon yang benar, bukan serviceId internal yang mungkin salah
        // hasil pemetaan SA (mis: hb→hbo padahal aslinya Hepsiburada).
        const serviceMeta = liveData?.saName
          ? getSAServiceMeta(item.serviceId, liveData.saName)
          : liveData?.saCode
            ? { ...getServiceMetaFn(item.serviceId), name: liveData.saCode.toUpperCase() }
            : getServiceMetaFn(item.serviceId);
        return (
          <div key={item.id} style={{ flex: 1, minWidth: 0 }}>
            <ServiceCard
              item={item}
              service={serviceMeta}
              stockCount={stockCount}
              isOutOfStock={isOutOfStock}
              startingPrice={startingPrice}
              countryMeta={getCountriesFn().find(c => String(c.id) === String(item.countryId) || c.id === item.countryId)}
              onBuyClick={onBuyClick}
            />
          </div>
        );
      })}
      {Array.from({ length: data.columnCount - row.length }).map((_, i) => (
        <div key={`pad-${i}`} style={{ flex: 1 }} />
      ))}
    </div>
  );
});

function _AutoSizedList({ rows, width, itemData }) {
  const wrapRef = useRef(null);
  const [h, setH] = useState(600);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setH(el.clientHeight || 600);
    const ro = new ResizeObserver(e => setH(e[0]?.contentRect.height || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrapRef} style={{ flex: 1, minHeight: 0, height: '100%' }}>
      <FixedSizeList height={h} itemCount={rows.length} itemSize={_CARD_H} width={width} itemData={itemData} overscanCount={3}>
        {_CatalogRow}
      </FixedSizeList>
    </div>
  );
}

const VirtualCatalogGrid = memo(function VirtualCatalogGrid({ items, liveStocks, onBuyClick, getServiceMetaFn, getCountriesFn, getRealPriceFn }) {
  const containerRef = useRef(null);
  const [cw, setCw] = useState(640);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setCw(el.clientWidth);
    const ro = new ResizeObserver(e => setCw(e[0]?.contentRect.width ?? 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columnCount = _cols(cw);
  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < items.length; i += columnCount) r.push(items.slice(i, i + columnCount));
    return r;
  }, [items, columnCount]);
  const itemData = { rows, liveStocks, columnCount, onBuyClick, getServiceMetaFn, getCountriesFn, getRealPriceFn };
  if (!items.length) return null;
  return (
    <div ref={containerRef} style={{ width: '100%', flex: 1 }}>
      <_AutoSizedList rows={rows} width={cw} itemData={itemData} />
    </div>
  );
});
// ---
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
// ---
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
// ---
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

// ---

// ---
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
const ServiceCard = React.memo(function ServiceCard({ item, service, stockCount, isOutOfStock, startingPrice, countryMeta, onBuyClick }: {
  item: any; service: any; stockCount: number | null; isOutOfStock: boolean;
  startingPrice: number; countryMeta: any; onBuyClick: (item: any) => void;
}) {
  return (
    <div
      onClick={() => !isOutOfStock && onBuyClick(item)}
      style={{ contain: 'layout style paint' }} // ✅ CSS containment → GPU-accelerated scroll
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-200 group flex flex-col border select-none
        ${isOutOfStock
          ? 'bg-white/[0.02] border-white/[0.04] opacity-50 cursor-not-allowed grayscale'
          : 'bg-[#0d0202] border-red-900/20 hover:border-red-500/40 hover:shadow-[0_12px_40px_rgba(220,38,38,0.15)] cursor-pointer active:scale-[0.98]'
        }
      `}
    >
      {/* Glow hover */}
      {!isOutOfStock && (
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
      )}

      {/* Top strip: flag + badge */}
      <div className="relative px-3.5 pt-3.5">
        <div className="flex justify-between items-start">
          <span className="text-lg leading-none" title={countryMeta?.name}>
            {countryMeta?.flag || '🌐'}
          </span>
          {isOutOfStock ? (
            <span className="text-[9px] font-black text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Habis</span>
          ) : (item.isTrending ?? getIsTrending(item.countryId, item.serviceId)) ? (
            <span className="text-[9px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
              <Flame className="w-2.5 h-2.5" /> HOT
            </span>
          ) : stockCount !== null && stockCount < 50 ? (
            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-widest">Sedikit</span>
          ) : null}
        </div>
      </div>

      {/* Card body */}
      <div className="px-3.5 pt-3 pb-4 flex flex-col flex-1">
        <div className="flex items-center gap-2.5 mb-3">
          <ServiceIcon service={service} className="w-9 h-9 shrink-0 text-base" />
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{service.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 mb-4">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOutOfStock ? 'bg-red-600' : stockCount !== null && stockCount < 50 ? 'bg-amber-400' : 'bg-green-500'}`} />
          <span className={`text-[10px] font-bold ${isOutOfStock ? 'text-red-500/70' : stockCount !== null && stockCount < 50 ? 'text-amber-400/80' : 'text-green-500/80'}`}>
            {isOutOfStock ? 'Stok Habis' : stockCount !== null ? `${stockCount.toLocaleString('id-ID')} tersedia` : 'Tersedia'}
          </span>
        </div>
        <div className="mt-auto pt-3 border-t border-white/[0.06] flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-0.5">Mulai dari</p>
            <p className={`text-base font-black tracking-tight leading-none ${isOutOfStock ? 'text-gray-600 line-through' : 'text-white'}`}>
              <FormatRupiah value={startingPrice} />
            </p>
          </div>
          {!isOutOfStock && (
            <div className="shrink-0 w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center group-hover:bg-red-500 transition-colors shadow-[0_4px_12px_rgba(220,38,38,0.4)]">
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isOutOfStock === next.isOutOfStock &&
  prev.stockCount === next.stockCount &&
  prev.startingPrice === next.startingPrice
);

// ---
export default memo(function BuyNumberPage({ user, balance, showToast, navigate, inventory, maintenance }) {
  // ✅ RATE LIMIT: Cegah spam beli nomor — cooldown 30 detik antar pembelian
  const lastBuyRef = useRef<number>(0);
  const [search, setSearch] = useState('');

  // ✅ Provider selection — disimpan ke localStorage agar tidak reset
  const [provider, setProvider] = useState<'5sim' | 'smsactivate'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pn_provider') as '5sim' | 'smsactivate') || '5sim';
    }
    return '5sim';
  });
  const handleProviderChange = (p: '5sim' | 'smsactivate') => {
    setProvider(p);
    localStorage.setItem('pn_provider', p);
    setLiveStocks({});
    setStockApiError(false);
    // Reset negara ke default masing-masing provider
    const defaultCountry = p === '5sim' ? 'indonesia' : '6';
    setSelectedCountry(defaultCountry);
    localStorage.setItem('pn_selected_country', defaultCountry);
  };

  // ✅ FIX: Pilihan negara disimpan ke localStorage — tidak reset saat cancel/refresh
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pn_selected_country') || 'indonesia';
    }
    return 'indonesia';
  });
  const [selectedCategory, setSelectedCategory] = useState('all'); 
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef(null);

  // ✅ Daftar negara DINAMIS dari 5sim (default: COUNTRIES_STATIC sebagai fallback)
  const [availableCountries, setAvailableCountries] = useState(COUNTRIES_STATIC);
  const [isFetchingCountries, setIsFetchingCountries] = useState(true);

  // Fetch daftar negara dari provider aktif saat pertama load
  useEffect(() => {
    const fetchCountries = async () => {
      setIsFetchingCountries(true);
      try {
        const endpoint = provider === '5sim' ? '/api/get-countries' : '/api/smsactivate/get-countries';
        const res2 = await fetch(endpoint, { cache: 'no-store' });
        if (res2.ok) {
          const data = await res2.json();
          if (data.countries && Array.isArray(data.countries) && data.countries.length > 0) {
            let countries = data.countries;
            // ✅ FIX: Pastikan Indonesia selalu ada untuk SMS-Activate (SA id: 6)
            if (provider === 'smsactivate') {
              const hasIndonesia = countries.some(c => String(c.id) === '6' || c.id === 'indonesia');
              if (!hasIndonesia) {
                countries = [
                  { id: '6', name: 'Indonesia', flag: '🇮🇩', code: '+62' },
                  ...countries
                ];
              }
            }
            setAvailableCountries(countries);
          }
        }
      } catch {
        // Gagal fetch? Tetap pakai COUNTRIES_STATIC — tidak masalah
      } finally {
        setIsFetchingCountries(false);
      }
    };
    fetchCountries();
  }, [provider]);
  
  // State untuk Live Stock dari 5sim
  const [liveStocks, setLiveStocks] = useState({});
  const [isFetchingStock, setIsFetchingStock] = useState(false);
  const [stockApiError, setStockApiError] = useState(false); // true = API gagal, data tidak real

  const [showModal, setShowModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState(null);
  const [selectedTier, setSelectedTier] = useState('reguler'); 
  const [isProcessing, setIsProcessing] = useState(false);
  // Swipe-to-dismiss state
  const [swipeDelta, setSwipeDelta] = useState(0);
  const swipeTouchStartY = useRef(0);
  const swipeScrollRef = useRef<HTMLDivElement>(null);

  // ✅ FIX BUG DROPDOWN: Gunakan mousedown + ref untuk deteksi klik di luar
  // Sebelumnya pakai { capture: true } yang menangkap klik SEBELUM onClick item negara selesai
  // Akibatnya item negara tidak pernah terpilih karena DOM sudah di-unmount duluan
  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handler = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryDropdownOpen]);

  // FUNGSI UNTUK MENARIK STOK LIVE DARI FRONTEND
  useEffect(() => {
    const controller = new AbortController();
    const fetchStock = async () => {
      setIsFetchingStock(true);
      try {
        // ── 5SIM ─────────────────────────────────────────────────────────────
        if (provider === '5sim') {
          const simCountry = mapCountryTo5Sim(selectedCountry);
          const res = await fetch(`/api/live-stock?country=${simCountry}`, { cache: 'no-store', signal: controller.signal });
          if (!res.ok) throw new Error("Gagal mengambil data live dari 5sim");
          const data = await res.json();

          if (typeof data === 'string' && (data.includes('no free phones') || data.includes('service_not_available') || data.includes('no product') || data.includes('not found'))) {
            throw new Error("Layanan tidak tersedia sementara");
          }
          if (data?.error) {
            const errMsg = String(data.error).toLowerCase();
            if (errMsg.includes('no_balance') || errMsg.includes('not enough') || errMsg.includes('insufficient') || errMsg.includes('saldo')) {
              throw new Error('__SILENT_FALLBACK__');
            }
            throw new Error(data.error);
          }

          const firstKey = Object.keys(data)[0];
          const firstVal = firstKey ? data[firstKey] : null;
          const firstInnerKey = firstVal && typeof firstVal === 'object' ? Object.keys(firstVal)[0] : null;
          const firstInnerVal = firstInnerKey ? firstVal[firstInnerKey] : null;
          const hasCountryWrapper = firstInnerVal && typeof firstInnerVal === 'object'
            && !('cost' in firstInnerVal) && !('count' in firstInnerVal);
          const servicesData = hasCountryWrapper ? firstVal : data;

          if (!servicesData || typeof servicesData !== 'object' || Object.keys(servicesData).length === 0) {
            throw new Error("Data negara tidak ditemukan di 5sim");
          }

          const stocks = {};
          Object.keys(servicesData).forEach(simServiceName => {
            const ourServiceId = mapServiceFrom5Sim(simServiceName);
            let totalCount = 0;
            let minCostUsd = Infinity;
            const pricesObj = {};
            const opData = servicesData[simServiceName];
            if (opData && typeof opData === 'object') {
              Object.keys(opData).forEach(operator => {
                const entry = opData[operator];
                if (!entry || typeof entry !== 'object') return;
                const opCount = entry.count || 0;
                totalCount += opCount;
                if (opCount > 0 && entry.cost && entry.cost < minCostUsd) minCostUsd = entry.cost;
              });
              const tierMapOp = {
                'any':'cheap','virtual1':'cheap','virtual3':'cheap','virtual4':'cheap','virtual14':'cheap',
                'virtual53':'reguler','virtual21':'reguler','virtual11':'reguler','virtual36':'reguler','virtual5':'reguler','virtual7':'reguler',
                'virtual58':'vip','virtual60':'vip','virtual62':'vip',
              } as {[k:string]:string};
              const availableOps = Object.keys(opData)
                .filter(op => opData[op] && typeof opData[op] === 'object' && (opData[op].count || 0) > 0)
                .sort((a, b) => (opData[a].cost || 9999) - (opData[b].cost || 9999));
              availableOps.forEach((op, idx) => {
                const entry = opData[op];
                const tierName = tierMapOp[op] || (idx === 0 ? 'cheap' : idx === 1 ? 'reguler' : 'vip');
                if (!pricesObj[tierName]) {
                  pricesObj[tierName] = { price: calcPriceFromUsd(entry.cost), rate: entry.rate || 0, nameOp: op };
                }
              });
              const cheapestTierPrice = Object.values(pricesObj).length > 0
                ? Math.min(...Object.values(pricesObj).map(p => p.price))
                : (minCostUsd !== Infinity ? calcPriceFromUsd(minCostUsd) : 0);
              stocks[ourServiceId] = { count: totalCount, minPrice: cheapestTierPrice, prices: pricesObj, rawOps: opData };
            }
          });

          setLiveStocks(stocks);
          setStockApiError(false);

        // ── SMS-ACTIVATE ─────────────────────────────────────────────────────
        } else {
          const countryId = mapCountryToSmsActivate(selectedCountry);

          const res = await fetch(`/api/smsactivate/live-stock?country=${countryId}`, { cache: 'no-store', signal: controller.signal });
          if (!res.ok) throw new Error("Gagal mengambil data live dari SMS-Activate");
          const data = await res.json();

          if (data?.error) throw new Error(data.error);

          // data.services: { [serviceCode]: { cost, count } }
          const stocks = {};
          Object.entries(data.services || {}).forEach(([serviceCode, info]: [string, any]) => {
            if (!info || !info.count || Number(info.count) === 0) return;
            const ourServiceId = mapServiceFromSmsActivate(serviceCode);
            const priceIdr = calcPriceFromUsd(Number(info.cost));
            stocks[ourServiceId] = {
              count:    Number(info.count),
              minPrice: priceIdr,
              prices:   { reguler: { price: priceIdr, rate: 90, nameOp: 'SA' } },
              rawOps:   {},
              saName:   info.name || null, // nama asli dari SA jika tersedia
              saCode:   serviceCode,       // kode asli SA untuk fallback display
            };
          });

          setLiveStocks(stocks);
          setStockApiError(false);
        }

      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err.message !== '__SILENT_FALLBACK__') {
          if (process.env.NODE_ENV === 'development') console.warn("Stok live tidak tersedia:", err.message);
        }
        setStockApiError(true);
        setLiveStocks({});
      } finally {
        setIsFetchingStock(false);
      }
    };
    
    fetchStock();
    return () => controller.abort();
  }, [selectedCountry, provider]);

  // ✅ BUILD KATALOG LANGSUNG DARI DATA LIVE
  // Untuk SMS-Activate: semua service dari liveStocks ditampilkan,
  // termasuk yang kodenya tidak dikenal (fallback ke raw key).
  // SERVICES hanya dipakai untuk metadata (nama cantik, ikon, warna).
  const filteredInventory = useMemo(() => {
    const baseServiceIds = Object.keys(liveStocks).length > 0
      ? Object.keys(liveStocks)
      : SERVICES.map(s => s.id); // fallback jika API belum load

    let list = baseServiceIds.map(serviceId => ({
      id: selectedCountry + '-' + serviceId,
      countryId: selectedCountry,
      serviceId,
      isTrending: getIsTrending(selectedCountry, serviceId),
    }));

    // Filter kategori
    // LOGIKA PENTING: SA sering memakai kode yang sama untuk layanan berbeda di tiap negara.
    // Mis: kode 'bn' di SA Indonesia = Alfagift (bukan Binance).
    // Maka kategori harus ditentukan dari saName (nama asli SA) dulu, bukan dari serviceId.
    if (selectedCategory !== 'all') {
      list = list.filter(item => {
        const liveData = liveStocks[item.serviceId];

        // PRIORITAS 1: Cari kategori berdasarkan saName (nama asli dari SA)
        if (liveData?.saName) {
          const saNameLower = liveData.saName.toLowerCase().trim();
          // Cek di SERVICES berdasarkan nama
          const byName = SERVICES.find(s => s.name.toLowerCase() === saNameLower);
          if (byName) return byName.category === selectedCategory;
          // Cek di SERVICE_ICON_MAP (normalize saName → potential key)
          const saKey = saNameLower.replace(/[\s\/\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '');
          if (SERVICE_ICON_MAP[saKey]) return SERVICE_ICON_MAP[saKey].category === selectedCategory;
          if (SERVICE_ICON_MAP[saNameLower]) return SERVICE_ICON_MAP[saNameLower].category === selectedCategory;
          // saName tidak dikenal → tampilkan di 'Lainnya' saja
          return selectedCategory === 'other';
        }

        // PRIORITAS 2: Fallback ke kategori serviceId (untuk SERVER 1 / 5sim)
        const srv = SERVICES.find(s => s.id === item.serviceId);
        if (srv) return srv.category === selectedCategory;
        const mapped = SERVICE_ICON_MAP[item.serviceId];
        return mapped ? mapped.category === selectedCategory : false;
      });
    }

    // Filter pencarian by nama atau serviceId (termasuk saName dari SA)
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item => {
        const liveData = liveStocks[item.serviceId];
        const srv = SERVICES.find(s => s.id === item.serviceId);
        const displayName = liveData?.saName || srv?.name || item.serviceId.replace(/_/g, ' ');
        return displayName.toLowerCase().includes(q) || item.serviceId.toLowerCase().includes(q);
      });
    }

    // Sort: stok terbanyak di atas, habis di bawah
    list.sort((a, b) => {
      const aCount = liveStocks[a.serviceId]?.count ?? -1;
      const bCount = liveStocks[b.serviceId]?.count ?? -1;
      if (aCount > 0 && bCount <= 0) return -1;
      if (bCount > 0 && aCount <= 0) return 1;
      return bCount - aCount;
    });

    return list;
  }, [liveStocks, selectedCountry, search, selectedCategory]);

  const handleBuyClick = (item) => {
    setItemToBuy(item);
    // ✅ FIX BUG #3: Pilih tier default yang benar-benar tersedia, bukan selalu 'reguler'
    const liveData = liveStocks[item.serviceId];
    const availablePrices = liveData?.prices || {};
    const preferredOrder = ['reguler', 'vip', 'cheap'];
    const defaultTier = preferredOrder.find(t => availablePrices[t]) || Object.keys(availablePrices)[0] || 'reguler';
    setSelectedTier(defaultTier);
    setShowModal(true);
  };

  const currentTiers = useMemo(() => {
    if (!itemToBuy) return null;
    const liveInfo = liveStocks[itemToBuy.serviceId];

    if (!liveInfo || Object.keys(liveInfo.prices || {}).length === 0) return null;

    const tiers = {} as any;
    if (liveInfo.prices?.cheap) {
      tiers.cheap = { id: 'cheap', name: 'Server Random (Any)', desc: 'Operator Acak', success: Math.max(75, liveInfo.prices.cheap.rate || 75) + '%', price: liveInfo.prices.cheap.price, opKey: liveInfo.prices.cheap.nameOp || 'any', recommended: false };
    }
    if (liveInfo.prices?.reguler) {
      const isCustomOp = liveInfo.prices.reguler.nameOp;
      tiers.reguler = { id: 'reguler', name: isCustomOp === 'SA' ? 'Server 2' : isCustomOp ? `Server ${isCustomOp.toUpperCase()}` : 'Server VIRTUAL53', desc: 'Standar & Stabil', success: Math.max(88, liveInfo.prices.reguler.rate || 88) + '%', price: liveInfo.prices.reguler.price, opKey: isCustomOp || 'virtual53', recommended: true };
    }
    if (liveInfo.prices?.vip) {
      tiers.vip = { id: 'vip', name: 'Server VIP (V58)', desc: 'Prioritas Tertinggi, Anti-Delay', success: Math.max(99, liveInfo.prices.vip.rate || 99) + '%', price: liveInfo.prices.vip.price, opKey: liveInfo.prices.vip.nameOp || 'virtual58', recommended: false };
    }
    // Sembunyikan cheap jika harganya >= reguler (any lebih mahal/sama = tidak ada nilai tambah)
    if (tiers.cheap && tiers.reguler && tiers.cheap.price >= tiers.reguler.price) {
      delete tiers.cheap;
    }
    // Sembunyikan cheap jika harganya >= vip (tidak masuk akal ditampilkan)
    if (tiers.cheap && tiers.vip && tiers.cheap.price >= tiers.vip.price) {
      delete tiers.cheap;
    }
    // Kalau hanya cheap yang tersisa (tidak ada reguler/vip), beri nama lebih netral
    if (tiers.cheap && !tiers.reguler && !tiers.vip) {
      tiers.cheap.name = 'Server Standar';
      tiers.cheap.recommended = true;
    }
    return tiers;
  }, [itemToBuy, liveStocks]);

  // Jika tier yang diplih default ('reguler') ternyata tidak tersedia, otomatis pilih tier pertama yang tersedia
  useEffect(() => {
      if (currentTiers && !currentTiers[selectedTier]) {
          const availableKeys = Object.keys(currentTiers);
          if (availableKeys.length > 0) setSelectedTier(availableKeys[0]);
      }
  }, [currentTiers, selectedTier]);

  const confirmPurchase = async () => {
    // ✅ SECURITY: Double-submit guard — cegah dua transaksi dari klik cepat
    if (isProcessing) return;
    if (!currentTiers || !currentTiers[selectedTier]) return;
    const finalPriceToPay = currentTiers[selectedTier].price;
    const exactOperator = currentTiers[selectedTier].opKey;

    // ✅ MAINTENANCE CHECK: Blokir pembelian saat maintenance aktif
    if (maintenance?.isActive) {
      showToast(maintenance.message || 'Sistem sedang maintenance. Coba lagi nanti.', 'error');
      return;
    }

    // ✅ RATE LIMIT: Cooldown 30 detik antar pembelian untuk cegah spam
    const now = Date.now();
    const elapsed = now - lastBuyRef.current;
    const COOLDOWN_MS = 30_000;
    if (lastBuyRef.current > 0 && elapsed < COOLDOWN_MS) {
      const sisa = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      showToast(`Tunggu ${sisa} detik sebelum beli lagi.`, 'error');
      return;
    }

    // ✅ FIX: Gunakan Math.floor untuk menghindari masalah floating point
    const currentBalance = Math.floor(balance);
    const priceNeeded = Math.ceil(finalPriceToPay);
    if (currentBalance < priceNeeded) {
      const kekurangan = priceNeeded - currentBalance;
      showToast(
        `Saldo tidak cukup! Butuh Rp ${priceNeeded.toLocaleString('id-ID')} — Saldo kamu Rp ${currentBalance.toLocaleString('id-ID')} (kurang Rp ${kekurangan.toLocaleString('id-ID')}).`,
        'error'
      );
      setShowModal(false);
      navigate('dash_deposit');
      return;
    }

    // ✅ VALIDASI STOK + HARGA REAL-TIME sebelum potong saldo
    setIsProcessing(true);
    try {
      if (provider === '5sim') {
        const simCountry = mapCountryTo5Sim(itemToBuy.countryId);
        const simServiceName = mapServiceTo5Sim(itemToBuy.serviceId);
        const stockCheck = await fetch(`/api/live-stock?country=${simCountry}`, { cache: 'no-store' });
        if (stockCheck.ok) {
          const stockData = await stockCheck.json();
          const fk = Object.keys(stockData)[0];
          const fv = fk ? stockData[fk] : null;
          const fik = fv && typeof fv === 'object' ? Object.keys(fv)[0] : null;
          const fiv = fik ? fv[fik] : null;
          const hasWrapper = fiv && typeof fiv === 'object' && !('cost' in fiv) && !('count' in fiv);
          const svcMap = hasWrapper ? fv : stockData;

          if (svcMap && typeof svcMap === 'object') {
            const svcData = svcMap[simServiceName];
            if (svcData) {
              const opData = svcData[exactOperator];
              const opStock = opData?.count || 0;
              const totalCount = Object.values(svcData).reduce((s, op) => {
                if (!op || typeof op !== 'object') return s;
                return s + (op.count || 0);
              }, 0);

              if (opStock === 0 || totalCount === 0) {
                showToast(
                  opStock === 0
                    ? `Operator "${exactOperator}" sudah habis. Coba tier lain.`
                    : 'Stok habis! Layanan ini sedang tidak tersedia.',
                  'error'
                );
                setShowModal(false);
                setLiveStocks(prev => ({
                  ...prev,
                  [itemToBuy.serviceId]: {
                    ...(prev[itemToBuy.serviceId] || {}),
                    count: totalCount,
                    prices: totalCount === 0
                      ? {}
                      : Object.fromEntries(
                          Object.entries(prev[itemToBuy.serviceId]?.prices || {})
                            .filter(([key]) => {
                              const p = prev[itemToBuy.serviceId]?.prices?.[key];
                              return p?.opKey !== exactOperator;
                            })
                        )
                  }
                }));
                setIsProcessing(false);
                return;
              }

              if (opData?.cost) {
                const currentLivePrice = calcPriceFromUsd(opData.cost);
                const priceDiff = Math.abs(currentLivePrice - finalPriceToPay);
                if (priceDiff > 200) {
                  showToast(
                    `Harga berubah! Sekarang ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(currentLivePrice)}. Silakan cek ulang.`,
                    'error'
                  );
                  setLiveStocks(prev => {
                    const prevSvc = prev[itemToBuy.serviceId] || {};
                    const updatedPrices = { ...prevSvc.prices };
                    const tierKey = Object.keys(updatedPrices).find(k => updatedPrices[k].opKey === exactOperator);
                    if (tierKey) updatedPrices[tierKey] = { ...updatedPrices[tierKey], price: currentLivePrice };
                    return { ...prev, [itemToBuy.serviceId]: { ...prevSvc, prices: updatedPrices, minPrice: currentLivePrice } };
                  });
                  setShowModal(false);
                  setIsProcessing(false);
                  return;
                }
              }
            }
          }
        }
      }
      // SMS-Activate: skip stock re-check (realtime sudah dari fetchStock)
    } catch (_) {
      // Jika validasi ulang gagal, lanjutkan dan biarkan backend menangani
    }

    try {
      const buyEndpoint = provider === '5sim' ? '/api/buy-number' : '/api/smsactivate/buy-number';

      if (provider === '5sim') {
        // ✅ SECURITY: TIDAK mengirim `price` dari client ke backend.
        await secureApiCall(buyEndpoint, {
          countryId:       itemToBuy.countryId,
          serviceId:       itemToBuy.serviceId,
          operator:        exactOperator,
          idempotencyKey:  crypto.randomUUID(),
        });
      } else {
        // SMS-Activate: kirim kode SA asli (bukan serviceId kita)
        // liveStocks[serviceId].saCode menyimpan kode asli SA (mis: 'wa', 'tg', 'go')
        // yang di-mapping saat fetch catalog. Tanpa ini SA tolak request
        // karena tidak mengenal 'whatsapp', 'telegram', dsb.
        // Kirim kode SA asli (mis: 'wa') sebagai service,
        // dan internal serviceId kita (mis: 'whatsapp') agar route.ts
        // bisa simpan nama yang benar untuk display di UI
        const saServiceCode = liveStocks[itemToBuy.serviceId]?.saCode || itemToBuy.serviceId;
        const saDisplayName = liveStocks[itemToBuy.serviceId]?.saName || null;
        // ✅ FIX: Kirim clientPrice (harga yang ditampilkan ke user) ke backend.
        // Backend TIDAK pakai nilai ini langsung — hanya digunakan untuk
        // validasi bahwa harga server-side tidak bergeser lebih dari Rp 500.
        // Ini memastikan user selalu bayar harga yang mereka lihat di modal.
        await secureApiCall(buyEndpoint, {
          service:     saServiceCode,            // kode SA untuk API call
          serviceId:   itemToBuy.serviceId,      // ID internal untuk display UI
          country:     mapCountryToSmsActivate(itemToBuy.countryId),
          saName:      saDisplayName,            // nama asli dari SA untuk mutasi
          clientPrice: finalPriceToPay,          // harga yg terlihat user → untuk validasi backend
        });
      }

      setShowModal(false);
      lastBuyRef.current = Date.now(); // ✅ RATE LIMIT: catat waktu beli terakhir
      showToast('Nomor berhasil diamankan! Menunggu OTP...', 'success');
      navigate('dash_history');
    } catch (error) {
      setShowModal(false);
      // Terjemahkan error teknis dari 5sim ke pesan yang lebih ramah
      let friendlyMsg = error.message || 'Terjadi kesalahan sistem.';

      // ✅ FIX: Handle 409 harga berubah dari backend SA.
      // Backend membatalkan order SA secara otomatis dan mengembalikan harga terbaru.
      // Refresh harga di liveStocks agar modal langsung tunjukkan harga baru jika user buka lagi.
      if (friendlyMsg.includes('Harga berubah')) {
        // Coba ekstrak harga baru dari error jika tersedia (format: "Harga terbaru: Rp X")
        const priceMatch = friendlyMsg.match(/Rp\s*([\d.]+)/);
        if (priceMatch && itemToBuy) {
          const newPrice = parseInt(priceMatch[1].replace(/\./g, ''), 10);
          if (!isNaN(newPrice) && newPrice > 0) {
            setLiveStocks(prev => {
              const prevSvc = prev[itemToBuy.serviceId] || {};
              const updatedPrices = { ...prevSvc.prices };
              // Update semua tier dengan harga baru (estimasi — backend akan konfirmasi saat reload)
              Object.keys(updatedPrices).forEach(k => {
                updatedPrices[k] = { ...updatedPrices[k], price: newPrice };
              });
              return { ...prev, [itemToBuy.serviceId]: { ...prevSvc, prices: updatedPrices, minPrice: newPrice } };
            });
          }
        }
        showToast(friendlyMsg, 'error');
        setIsProcessing(false);
        return;
      }

      if (
        friendlyMsg.includes('no product') ||
        friendlyMsg.includes('Response tidak valid dari 5sim') ||
        friendlyMsg.includes('not found')
      ) {
        const isEst = !liveStocks[itemToBuy?.serviceId];
        friendlyMsg = isEst
          ? `Layanan ${SERVICES.find(s => s.id === itemToBuy?.serviceId)?.name || ''} tidak tersedia di negara ini. Coba negara lain (Rusia, Vietnam, India biasanya tersedia). Saldo tidak terpotong.`
          : 'Stok habis mendadak. Silakan coba lagi atau ganti negara.';
      }
      // Sembunyikan pesan teknis internal dari user biasa
      if (
        friendlyMsg.toLowerCase().includes('saldo pusat') ||
        friendlyMsg.toLowerCase().includes('5sim') ||
        friendlyMsg.toLowerCase().includes('no_balance') ||
        friendlyMsg.toLowerCase().includes('not enough') ||
        friendlyMsg.toLowerCase().includes('insufficient')
      ) {
        friendlyMsg = 'Layanan sedang dalam pemeliharaan sementara. Silakan coba beberapa saat lagi atau hubungi support kami.';
      }
      showToast(friendlyMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-160px)]">
      <div className="mb-4 md:mb-8 space-y-4 md:space-y-6 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight">Katalog <span className="text-red-500">Nomor</span></h2>
          <ProviderToggle provider={provider} onChange={handleProviderChange} />
        </div>
        
        <div className="flex flex-col gap-4 bg-[#140505] p-4 rounded-2xl border border-red-900/30">
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari dari 90+ layanan (cth: PayPal, Binance, Gojek)..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full bg-black border border-red-900/30 rounded-xl py-4 pl-14 pr-4 text-white font-bold placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all`}
              />
            </div>
            
            <div ref={countryDropdownRef} className="relative w-full xl:w-72 shrink-0 z-20">
              <button 
                onClick={() => setCountryDropdownOpen(prev => !prev)}
                className="w-full bg-black border border-red-900/30 hover:border-red-500/50 transition-colors rounded-xl py-4 px-5 flex items-center justify-between shadow-inner"
              >
                <span className="flex items-center gap-3 text-white font-bold">
                  <span className="text-xl">{getCountryDisplay(selectedCountry, availableCountries).flag}</span>
                  <span className="truncate">{getCountryDisplay(selectedCountry, availableCountries).name}</span>
                </span>
                <div className="flex items-center gap-2">
                  {isFetchingCountries && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${countryDropdownOpen ? 'rotate-180 text-red-500' : ''}`} />
                </div>
              </button>

              {countryDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#140505] border border-red-500/30 rounded-xl shadow-[0_10px_40px_rgba(220,38,38,0.2)] max-h-72 overflow-y-auto z-50 custom-scrollbar">
                  <div className="px-3 pt-2 pb-1 sticky top-0 bg-[#140505] border-b border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{availableCountries.length} negara tersedia</p>
                  </div>
                  {availableCountries.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => {
                        const cid = String(c.id);
                        setSelectedCountry(cid);
                        if (typeof window !== 'undefined') localStorage.setItem('pn_selected_country', cid);
                        setCountryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors border-b border-white/5 last:border-0 ${String(selectedCountry) === String(c.id) ? 'bg-red-600/20 text-red-400' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span className="text-xl">{c.flag || '🌐'}</span>
                      <span className="font-bold">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pt-2 border-t border-white/5 scroll-smooth snap-x snap-mandatory" style={{WebkitOverflowScrolling:'touch'}}>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 snap-start px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                    selectedCategory === cat.id 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                    : 'bg-black text-gray-500 border border-white/10 hover:border-white/20 hover:text-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* fade right edge — hints there's more to scroll */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#040101] to-transparent" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 pb-24 md:pb-4">
        {/* Banner peringatan ketika API 5sim tidak bisa diakses */}
        {stockApiError && !isFetchingStock && (
          <div className="mb-4 flex items-start gap-3 bg-yellow-950/60 border border-yellow-500/40 text-yellow-300 px-5 py-4 rounded-2xl">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-400" />
            <div>
              <p className="font-bold text-sm">Data stok tidak tersedia untuk negara ini</p>
              <p className="text-xs text-yellow-300/70 mt-1">Coba pilih negara lain seperti Indonesia, Rusia, atau India. Jika masalah berlanjut, hubungi Admin.</p>
            </div>
          </div>
        )}
        {filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-900/30 flex items-center justify-center mb-5">
              <Search className="w-7 h-7 text-red-800/60" />
            </div>
            <p className="text-lg font-bold text-gray-400 mb-1">
              {search ? `Tidak ada hasil untuk "${search}"` : 'Layanan Tidak Tersedia'}
            </p>
            <p className="text-sm text-gray-600 mb-6 max-w-xs">
              {search
                ? 'Coba kata kunci lain seperti nama lengkap aplikasi (cth: "WhatsApp", "Google")'
                : 'Stok sedang kosong untuk negara dan kategori ini'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 font-bold hover:bg-white/10 transition-colors"
                >
                  Hapus Pencarian
                </button>
              )}
              <button
                onClick={() => { setSelectedCategory('all'); setSearch(''); }}
                className="px-4 py-2 bg-red-600/15 border border-red-500/30 rounded-xl text-sm text-red-400 font-bold hover:bg-red-600/25 transition-colors"
              >
                Lihat Semua Layanan
              </button>
            </div>
          </div>
        ) : isFetchingStock ? (
          <CatalogSkeleton count={12} />
        ) : (
          <VirtualCatalogGrid
            items={filteredInventory}
            liveStocks={liveStocks}
            onBuyClick={handleBuyClick}
            getServiceMetaFn={getServiceMeta}
            getCountriesFn={() => availableCountries}
            getRealPriceFn={getRealPrice}
          />
        )}
      </div>

      {showModal && itemToBuy && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-end md:items-center justify-center px-0 md:px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => { setShowModal(false); setSwipeDelta(0); }}
        >
          <div
            className="bg-[#080101] border border-red-800/40 rounded-t-3xl md:rounded-2xl w-full md:max-w-md shadow-[0_0_60px_rgba(220,38,38,0.15)] relative flex flex-col animate-in slide-in-from-bottom-4 duration-250"
            style={{
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 72px)',
              transform: swipeDelta > 0 ? `translateY(${swipeDelta}px)` : undefined,
              transition: swipeDelta === 0 ? 'transform 0.3s ease' : 'none',
              opacity: swipeDelta > 0 ? Math.max(0.4, 1 - swipeDelta / 300) : 1,
            }}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => {
              swipeTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchMove={e => {
              const scrollEl = swipeScrollRef.current;
              const atTop = !scrollEl || scrollEl.scrollTop === 0;
              const delta = e.touches[0].clientY - swipeTouchStartY.current;
              if (delta > 0 && atTop) setSwipeDelta(delta);
            }}
            onTouchEnd={() => {
              if (swipeDelta > 110) {
                setShowModal(false);
              }
              setSwipeDelta(0);
            }}
          >
            {/* Drag handle – mobile only */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* Top accent line */}
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-60 shrink-0" />

            {/* Scrollable content — button NOT inside here */}
            <div ref={swipeScrollRef} className="overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div className="p-5 md:p-8 pb-3">
              {/* Header */}
              <div className="flex justify-between items-center mb-5">
                <div>
                  <p className="text-[10px] text-red-400/60 uppercase tracking-widest font-bold mb-0.5">Konfirmasi Pembelian</p>
                  <h3 className="text-xl font-black text-white">Pilih Paket Server</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 bg-white/5 active:bg-white/15 rounded-xl flex items-center justify-center transition-colors border border-white/[0.06]"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Service + Country summary */}
              <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
                <ServiceIcon
                  service={getSAServiceMeta(itemToBuy.serviceId, liveStocks[itemToBuy.serviceId]?.saName)}
                  className="w-10 h-10 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">
                    {(() => {
                      const saName = liveStocks[itemToBuy.serviceId]?.saName;
                      const mappedName = getServiceMeta(itemToBuy.serviceId)?.name;
                      const isRaw = !saName || saName.toLowerCase() === itemToBuy.serviceId.toLowerCase();
                      return isRaw ? (mappedName || itemToBuy.serviceId) : saName;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <span>{COUNTRIES.find(c => c.id === itemToBuy.countryId)?.flag}</span>
                    <span>{COUNTRIES.find(c => c.id === itemToBuy.countryId)?.name}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Saldo kamu</p>
                  <p className="text-sm font-black text-white"><FormatRupiah value={balance} /></p>
                </div>
              </div>

              {/* Tier selection */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pilih Server</p>
                  <div className="flex gap-4 text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                    <span>Sukses</span>
                    <span>Harga</span>
                  </div>
                </div>

                {currentTiers && Object.keys(currentTiers).length > 0 ? (
                  Object.values(currentTiers).map((tier: any) => {
                    const isSelected = selectedTier === tier.id;
                    return (
                      <div
                        key={tier.id}
                        onClick={() => setSelectedTier(tier.id)}
                        className={`relative rounded-xl border cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'border-red-500/60 bg-red-500/[0.08] shadow-[0_0_20px_rgba(220,38,38,0.12)]'
                            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        {tier.recommended && (
                          <div className="absolute -top-2.5 left-4">
                            <span className="text-[9px] font-black bg-green-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-[0_2px_8px_rgba(34,197,94,0.35)]">
                              Rekomendasi
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 px-4 py-4 md:py-3.5">
                          {/* Radio */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-red-500' : 'border-gray-600'}`}>
                            {isSelected && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-300'}`}>{tier.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{tier.desc}</p>
                          </div>
                          {/* Success rate */}
                          <div className="text-right shrink-0 mr-3">
                            <p className={`text-xs font-black ${
                              parseInt(tier.success) >= 95 ? 'text-green-400'
                              : parseInt(tier.success) >= 85 ? 'text-amber-400'
                              : 'text-gray-400'
                            }`}>{tier.success}</p>
                          </div>
                          {/* Price */}
                          <div className="text-right shrink-0 min-w-[68px]">
                            <p className={`text-sm font-black ${isSelected ? 'text-red-400' : 'text-gray-300'}`}>
                              <FormatRupiah value={tier.price} />
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-5 text-center border border-red-500/20 rounded-xl bg-red-500/5">
                    <AlertCircle className="w-8 h-8 text-red-500/50 mx-auto mb-2" />
                    <p className="text-sm text-red-400 font-bold">Data server tidak tersedia</p>
                    <p className="text-xs text-gray-500 mt-1">Coba pilih negara lain</p>
                  </div>
                )}

                {currentTiers && Object.keys(currentTiers).length === 1 && currentTiers.cheap && (
                  <p className="text-xs text-amber-500/80 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                    Hanya server random tersedia. Tingkat sukses lebih rendah dari biasanya.
                  </p>
                )}
              </div>

              {/* Total + saldo warning */}
              {currentTiers && currentTiers[selectedTier] && (
                <>
                  <div className="flex items-center justify-between bg-red-950/30 border border-red-800/30 rounded-xl px-5 py-4 mb-3">
                    <span className="text-sm font-bold text-gray-400">Total Tagihan</span>
                    <span className="text-2xl font-black text-white"><FormatRupiah value={currentTiers[selectedTier].price} /></span>
                  </div>
                  {balance < currentTiers[selectedTier].price && (
                    <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-600/30 rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-300">Saldo tidak cukup</p>
                        <p className="text-[11px] text-amber-400/70 mt-0.5">
                          Kurang <span className="font-black text-amber-300"><FormatRupiah value={currentTiers[selectedTier].price - balance} /></span>. Isi saldo dulu?
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>{/* end scrollable */}

            {/* ✅ STICKY BUTTON — always visible, never behind bottom nav */}
            <div className="shrink-0 px-5 pt-3 pb-4 border-t border-white/[0.06] bg-[#080101]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
              <Button
                variant="primary"
                className="w-full py-4 text-base tracking-wide shadow-[0_8px_25px_rgba(220,38,38,0.35)] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                onClick={confirmPurchase}
                disabled={isProcessing || !currentTiers || !currentTiers[selectedTier]}
              >
                {isProcessing
                  ? <><Loader2 className="animate-spin w-4 h-4" /> Memproses...</>
                  : <><ShoppingCart className="w-4 h-4" /> Beli Sekarang</>
                }
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
);