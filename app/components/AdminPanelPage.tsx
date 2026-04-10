'use client';

import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import {
  Shield, Zap, Smartphone, CreditCard, Clock, ChevronLeft, ChevronRight,
  RefreshCw, Settings, Users, Database,
  Plus, Key, TrendingUp, CheckSquare,
  Activity, BarChart3, AlertTriangle, Trophy, History,
  CheckCircle, XCircle, CheckCircle2,
  Download, Ban, RotateCcw, Megaphone,
  Loader2, MessageCircle, X, Search, Filter,
  Star, Save
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, collection, onSnapshot, collectionGroup,
  query, where, orderBy, limit, getDoc
} from 'firebase/firestore';
import { secureApiCall } from '@/lib/apiClient';

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

// ── API endpoints ─────────────────────────────────────────────────────────
const API_ADMIN = {
  BAN_USER:          '/api/admin/ban-user',
  APPROVE_DEPOSIT:   '/api/admin/approve-deposit',
  REJECT_DEPOSIT:    '/api/admin/reject-deposit',
  TOPUP:             '/api/admin/topup',
  ANNOUNCEMENT:      '/api/admin/announcement',
  RESET_LEADERBOARD: '/api/admin/reset-leaderboard',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────
const formatRupiah = (value: number): string => {
  const safeValue = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(safeValue);
};
const FormatRupiah = ({ value }: { value: number }) => <>{formatRupiah(value)}</>;

const getNumericId = (uid: string) => {
  if (!uid) return '';
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash).toString().padStart(10, '0').slice(0, 10);
};

const downloadCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;
  const sanitizeCell = (val: any) => {
    const str = String(val == null ? '' : val);
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  };
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => `"${sanitizeCell(val).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
};


const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-[#140505] border-t border-white/5">
      <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">
        Halaman {currentPage} dari {totalPages}
      </span>
      <div className="flex gap-2">
        <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}
          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}
          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────
export default memo(function AdminPanelPage({ showToast, isAdmin }) {
  const [activeTab, setActiveTab] = useState<'overview'|'users'|'deposits'|'orders'|'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Announcement
  const [announceText, setAnnounceText] = useState('');
  const [isAnnounceActive, setIsAnnounceActive] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [tgAlertLoading, setTgAlertLoading] = useState(false);

  // API Balances
  const [fiveSimBalance, setFiveSimBalance] = useState<number | null>(null);
  const [fiveSimLoading, setFiveSimLoading] = useState(true);
  const [fiveSimStatus, setFiveSimStatus] = useState<'ok'|'low'|'error'|null>(null);
  const [smsHubBalance, setSmsHubBalance] = useState<number | null>(null);
  const [smsHubLoading, setSmsHubLoading] = useState(true);
  const [smsHubStatus, setSmsHubStatus] = useState<'ok'|'low'|'error'|'unconfigured'|null>(null);

  const [dbUsers, setDbUsers] = useState([]);
  const [dbTransactions, setDbTransactions] = useState([]);
  const [dbOrders, setDbOrders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const approvingIds = useRef<Set<string>>(new Set());
  const [userPage, setUserPage] = useState(1);
  const [depositPage, setDepositPage] = useState(1);
  const itemsPerPage = 10;

  const getToken = async (): Promise<string | null> => {
    try { return auth?.currentUser ? await auth.currentUser.getIdToken() : null; }
    catch { return null; }
  };

  const fetch5SimBalance = async () => {
    setFiveSimLoading(true);
    try {
      const token = await getToken();
      if (!token) { setFiveSimStatus('error'); return; }
      const res = await fetch('/api/5sim-balance', { cache: 'no-store', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFiveSimStatus('error'); return; }
      const bal = typeof data === 'object' ? (data.Balance ?? data.balance ?? null) : null;
      setFiveSimBalance(bal);
      setFiveSimStatus(bal === null ? 'error' : bal < 5 ? 'low' : 'ok');
    } catch { setFiveSimStatus('error'); }
    finally { setFiveSimLoading(false); }
  };

  const fetchSmsHubBalance = async () => {
    setSmsHubLoading(true);
    try {
      const token = await getToken();
      if (!token) { setSmsHubStatus('error'); return; }
      // ✅ SMS Hub = SMS-Activate — pakai endpoint yang sama karena API key sama
      const res = await fetch('/api/smsactivate/balance', { cache: 'no-store', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 404 || res.status === 405) { setSmsHubStatus('unconfigured'); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSmsHubStatus('error'); return; }
      const bal = typeof data === 'object' ? (data.balance ?? data.Balance ?? data.sum ?? null) : null;
      setSmsHubBalance(bal !== null ? Number(bal) : null);
      setSmsHubStatus(bal === null ? 'error' : Number(bal) < 5 ? 'low' : 'ok');
    } catch { setSmsHubStatus('error'); }
    finally { setSmsHubLoading(false); }
  };

  useEffect(() => {
    if (!db || !isAdmin) return;
    fetch5SimBalance();
    fetchSmsHubBalance();

    const usersRef = collection(db, "users");
    const unsubscribeUsers = onSnapshot(usersRef, (snap) => {
      setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => { if (process.env.NODE_ENV === 'development') console.warn("Admin users:", err.message); });

    const announceRef = doc(db, "settings", "announcement");
    getDoc(announceRef).then((docSnap) => {
      if (docSnap.exists()) {
        setAnnounceText(docSnap.data().text || '');
        setIsAnnounceActive(docSnap.data().isActive || false);
      }
    }).catch(() => {});

    // Load maintenance state
    getDoc(doc(db, "settings", "maintenance")).then((docSnap) => {
      if (docSnap.exists()) {
        setMaintenanceMsg(docSnap.data().message || '');
        setIsMaintenanceActive(docSnap.data().isActive || false);
      }
    }).catch(() => {});

    let unsubscribeTx: (() => void) | undefined;
    try {
      const txGroupRef = collectionGroup(db, "transactions");
      const txQuery = query(txGroupRef, where("type","==","deposit"), where("status","==","pending"), limit(100));
      unsubscribeTx = onSnapshot(txQuery, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, userId: d.ref.parent.parent?.id, ...d.data() }));
          list.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
          setDbTransactions(list);
      }, () => {
        try {
          const fb = query(txGroupRef, where("type","==","deposit"), where("status","==","pending"), limit(100));
          unsubscribeTx = onSnapshot(fb, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, userId: d.ref.parent.parent?.id, ...d.data() }));
            list.sort((a:any,b:any)=>(b.timestamp||0)-(a.timestamp||0));
            setDbTransactions(list);
          }, (e) => { console.error('[Admin] TX fallback gagal:', e.message); });
        } catch(e:any) { console.error('[Admin] TX setup gagal:', e?.message); }
      });
    } catch(e) { if (process.env.NODE_ENV==='development') console.error("Admin TX:", e); }

    let unsubscribeOrders: (() => void) | undefined;
    try {
      const weekAgo = Date.now() - 30*24*60*60*1000;
      const ordGroupRef = collectionGroup(db, "orders");
      const ordQuery = query(ordGroupRef, where("timestamp",">=",weekAgo), orderBy("timestamp","desc"), limit(300));
      unsubscribeOrders = onSnapshot(ordQuery, (snap) => {
        setDbOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {
        try {
          const fb = query(ordGroupRef, limit(300));
          unsubscribeOrders = onSnapshot(fb, (snap) => {
            setDbOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }, (e) => { console.error('[Admin] Orders fallback gagal:', e.message); });
        } catch(e:any) { console.error('[Admin] Orders setup gagal:', e?.message); }
      });
    } catch(e) { if (process.env.NODE_ENV==='development') console.error("Admin Orders:", e); }

    return () => {
      unsubscribeUsers();
      if (unsubscribeTx) unsubscribeTx();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [isAdmin]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const safeTs = (ts: any): number => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    const n = Number(ts); return isNaN(n) ? 0 : n;
  };
  const fmtTs = (ts: any): string => {
    const ms = safeTs(ts);
    if (!ms) return '—';
    return new Date(ms).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };
  const depositAgeMinutes = (ts: any): number => {
    const ms = safeTs(ts); if (!ms) return 0;
    return Math.floor((Date.now()-ms)/60000);
  };

  const QRIS_EXPIRY_MS = 30*60*1000;
  const pendingDeposits = dbTransactions.filter(tx => {
    if (tx.type !== 'deposit' || tx.status !== 'pending') return false;
    const isAuto = tx.method?.toLowerCase().includes('paymenku') || tx.method?.toLowerCase().includes('otomatis') || tx.isAuto === true;
    if (isAuto) {
      if (tx.expiresAt) return Date.now() < new Date(tx.expiresAt).getTime();
      const txTime = safeTs(tx.timestamp) || safeTs(tx.createdAt);
      return txTime ? Date.now() < txTime + QRIS_EXPIRY_MS : false;
    }
    return true;
  }).sort((a:any,b:any) => safeTs(b.timestamp)-safeTs(a.timestamp));

  const filteredUsers = dbUsers.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const displayedUsers   = filteredUsers.slice((userPage-1)*itemsPerPage, userPage*itemsPerPage);
  const displayedDeposits = pendingDeposits.slice((depositPage-1)*itemsPerPage, depositPage*itemsPerPage);

  const totalBalance = dbUsers.reduce((s,u) => s+(u.balance||0), 0);
  const totalRevenue = useMemo(() =>
    dbOrders.filter(o=>o.status==='success'||o.status==='finished').reduce((s,o)=>s+(o.price||0),0),
  [dbOrders]);
  const activeOrdersCount = dbOrders.filter(o=>o.status==='active'||o.status==='pending').length;
  const bannedCount = dbUsers.filter(u=>u.banned).length;

  const globalLast7Days = useMemo(() => {
    const days = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i=6;i>=0;i--) {
      const d = new Date(today); d.setDate(d.getDate()-i);
      days.push({ dateStr: d.toLocaleDateString('id-ID',{weekday:'short'}), timestamp: d.getTime(), amount: 0 });
    }
    dbOrders.forEach(o => {
      if (o.status==='success'||o.status==='finished') {
        const oDate = new Date(safeTs(o.timestamp)||o.timestamp); oDate.setHours(0,0,0,0);
        const dayObj = days.find(d=>d.timestamp===oDate.getTime());
        if (dayObj) dayObj.amount += (o.price||0);
      }
    });
    const maxAmount = Math.max(...days.map(d=>d.amount), 1000);
    return days.map(d=>({ ...d, percentage: (d.amount/maxAmount)*100 }));
  }, [dbOrders]);

  // ── Actions ──────────────────────────────────────────────────────────
  const openTopUpModal = (user) => { setSelectedUser(user); setAddAmount(''); setShowTopUpModal(true); };
  const handleProcessTopUp = async () => {
    if (!isAdmin) return showToast('Akses Ditolak!','error');
    const numericAmount = parseInt(addAmount, 10);
    if (isNaN(numericAmount)||numericAmount<=0) return showToast('Masukkan nominal positif yang valid','error');
    if (numericAmount > 50_000_000) return showToast('Nominal maks Rp 50.000.000','error');
    setIsProcessing(true);
    try {
      await secureApiCall(API_ADMIN.TOPUP, { userId: selectedUser.id, amount: numericAmount });
      showToast(`Berhasil tambah Rp ${numericAmount.toLocaleString('id-ID')} ke ${selectedUser.name}`,'success');
      setShowTopUpModal(false);
    } catch(err) { showToast(err.message||'Gagal.','error'); }
    finally { setIsProcessing(false); }
  };
  const handleToggleBan = async (user) => {
    if (!isAdmin) return;
    const action = user.banned ? 'Membuka Suspend' : 'Suspend';
    setConfirmDialog({ isOpen: true, title: `${action} Akun`, message: `${action} akun ${user.name}?${!user.banned?' Order aktif akan dicancel & saldo direfund.':''}`,
      onConfirm: async () => {
        setIsProcessing(true);
        try { await secureApiCall(API_ADMIN.BAN_USER,{userId:user.id,banned:!user.banned}); showToast(`Akun ${user.name} berhasil di-${!user.banned?'banned':'unbanned'}.`,'success'); }
        catch(e) { showToast(e.message||'Gagal.','error'); }
        finally { setIsProcessing(false); setConfirmDialog({isOpen:false,title:'',message:'',onConfirm:null}); }
      }
    });
  };
  const handleSaveAnnouncement = async () => {
    if (!isAdmin) return;
    setIsProcessing(true);
    try { await secureApiCall(API_ADMIN.ANNOUNCEMENT,{text:announceText,isActive:isAnnounceActive}); showToast('Pengumuman diperbarui!','success'); }
    catch(e) { showToast(e.message||'Gagal.','error'); }
    finally { setIsProcessing(false); }
  };

  // ✅ MAINTENANCE MODE: Simpan ke Firestore settings/maintenance
  const handleSaveMaintenance = async () => {
    if (!isAdmin || !db) return;
    setIsProcessing(true);
    try {
      await setDoc(doc(db, 'settings', 'maintenance'), { isActive: isMaintenanceActive, message: maintenanceMsg, updatedAt: Date.now() });
      showToast(isMaintenanceActive ? '🔧 Maintenance aktif — pembelian diblokir!' : '✅ Maintenance dinonaktifkan.', isMaintenanceActive ? 'error' : 'success');
    } catch(e: any) { showToast(e.message||'Gagal simpan maintenance.','error'); }
    finally { setIsProcessing(false); }
  };

  // ✅ TELEGRAM ALERT: Kirim notifikasi manual ke admin via Telegram
  const handleSendTelegramAlert = async (msg: string) => {
    if (!isAdmin) return;
    setTgAlertLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await fetch('/api/admin/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      showToast('Alert Telegram terkirim!', 'success');
    } catch { showToast('Gagal kirim alert.', 'error'); }
    finally { setTgAlertLoading(false); }
  };
  const handleResetLeaderboard = async () => {
    if (!isAdmin) return;
    setConfirmDialog({ isOpen: true, title: 'Reset Papan Peringkat', message: 'PERINGATAN: Reset totalSpent SELURUH pengguna jadi 0. Lanjutkan?',
      onConfirm: async () => {
        setIsProcessing(true);
        try { await secureApiCall(API_ADMIN.RESET_LEADERBOARD,{}); showToast('Leaderboard berhasil di-reset!','success'); }
        catch(e) { showToast(e.message||'Gagal.','error'); }
        finally { setIsProcessing(false); setConfirmDialog({isOpen:false,title:'',message:'',onConfirm:null}); }
      }
    });
  };
  const handleApproveDeposit = async (tx) => {
    if (!isAdmin) return;
    if (approvingIds.current.has(tx.id)) return showToast('Sedang diproses.','error');
    approvingIds.current.add(tx.id); setIsProcessing(true);
    try { await secureApiCall(API_ADMIN.APPROVE_DEPOSIT,{txId:tx.id,userId:tx.userId}); showToast('Deposit disetujui!','success'); }
    catch(e) { showToast(e.message||'Gagal.','error'); }
    finally { approvingIds.current.delete(tx.id); setIsProcessing(false); }
  };
  const handleRejectDeposit = async (tx) => {
    if (!isAdmin) return;
    if (!tx.userId) return showToast('userId tidak ditemukan.','error');
    if (approvingIds.current.has('reject_'+tx.id)) return showToast('Sedang diproses.','error');
    approvingIds.current.add('reject_'+tx.id); setIsProcessing(true);
    try {
      await secureApiCall(API_ADMIN.REJECT_DEPOSIT,{txId:tx.id,userId:tx.userId});
      const isAuto = tx.method?.toLowerCase().includes('otomatis')||tx.method?.toLowerCase().includes('paymenku');
      showToast(isAuto?'Deposit QRIS dibatalkan.':'Deposit ditolak.','info');
    } catch(e) { showToast(e.message||'Gagal.','error'); }
    finally { approvingIds.current.delete('reject_'+tx.id); setIsProcessing(false); }
  };
  const handleExportUsersCSV = () => {
    const data = dbUsers.map(u => ({'Member ID':getNumericId(u.id),'Nama':u.name,'Email':u.email,'Saldo':u.balance||0,'Total Belanja':u.totalSpent||0,'Status':u.banned?'Banned':'Aktif','Daftar':new Date(u.createdAt).toLocaleDateString('id-ID')}));
    downloadCSV(data,`Data_Pengguna_${new Date().toLocaleDateString('id-ID')}.csv`);
    showToast('Data pengguna diunduh.','success');
  };
  const handleExportTransactionsCSV = () => {
    const data = dbTransactions.map(tx=>({'ID':tx.id,'Member ID':getNumericId(tx.userId),'Tipe':tx.type,'Deskripsi':tx.desc||tx.method,'Nominal':tx.amount,'Status':tx.status,'Tanggal':new Date(tx.timestamp).toLocaleString('id-ID')}));
    downloadCSV(data,`Laporan_Transaksi_${new Date().toLocaleDateString('id-ID')}.csv`);
    showToast('Laporan transaksi diunduh.','success');
  };

  // ── API Balance Card ──────────────────────────────────────────────────
  const ApiBalanceCard = ({ label, balance, loading, status, onRefresh, prefix='$', icon: Icon, color }: any) => {
    const colors = {
      ok:           { bg:'from-[#051828] to-[#030a12]', border:'border-cyan-500/30', text:'text-cyan-400', muted:'text-cyan-300/60', glow:'rgba(34,211,238,0.25)', blob:'bg-cyan-500/15', iconBg:'bg-cyan-500/20 border-cyan-500/40' },
      low:          { bg:'from-[#1a1000] to-[#0a0600]', border:'border-orange-500/30', text:'text-orange-400', muted:'text-orange-300/60', glow:'rgba(251,146,60,0.25)', blob:'bg-orange-500/15', iconBg:'bg-orange-500/20 border-orange-500/40' },
      error:        { bg:'from-[#180808] to-[#0a0000]', border:'border-red-500/20', text:'text-red-400', muted:'text-red-300/60', glow:'rgba(239,68,68,0.2)', blob:'bg-red-500/15', iconBg:'bg-red-500/20 border-red-500/30' },
      unconfigured: { bg:'from-[#0f0f0f] to-[#0a0a0a]', border:'border-gray-700/40', text:'text-gray-400', muted:'text-gray-500', glow:'transparent', blob:'bg-gray-700/10', iconBg:'bg-gray-700/20 border-gray-700/30' },
      null:         { bg:'from-[#0f0202] to-[#0a0000]', border:'border-white/10', text:'text-gray-400', muted:'text-gray-500', glow:'transparent', blob:'bg-white/5', iconBg:'bg-white/10 border-white/10' },
    };
    const c = colors[status || 'null'];
    return (
      <div className={`relative rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} p-5 overflow-hidden group hover:-translate-y-0.5 transition-all`}
        style={{ boxShadow: `0 8px 30px ${c.glow}` }}>
        <div className={`absolute -right-4 -top-4 w-20 h-20 ${c.blob} blur-2xl rounded-full`} />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className={`w-9 h-9 rounded-xl ${c.iconBg} border flex items-center justify-center`}>
            {loading ? <Loader2 className={`w-4 h-4 animate-spin ${c.text}`}/> : <Icon className={`w-4 h-4 ${c.text}`}/>}
          </div>
          <button onClick={onRefresh} disabled={loading}
            className={`p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white transition-all disabled:opacity-40`}>
            <RefreshCw className={`w-3 h-3 ${loading?'animate-spin':''}`}/>
          </button>
        </div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${c.muted} mb-1 relative z-10`}>{label}</p>
        {loading ? (
          <div className="relative z-10">
            <div className="h-7 w-24 bg-white/5 rounded-lg animate-pulse mb-1"/>
            <div className="h-3 w-16 bg-white/5 rounded animate-pulse"/>
          </div>
        ) : status === 'unconfigured' ? (
          <div className="relative z-10">
            <p className="text-base font-black text-gray-500">Belum Dikonfigurasi</p>
            <p className="text-[10px] text-gray-600 font-bold mt-0.5">Endpoint /api/smsactivate/balance</p>
          </div>
        ) : status === 'error' || (balance === null && status !== null) ? (
          <div className="relative z-10">
            <p className="text-lg font-black text-red-400">Gagal Membaca</p>
            <p className="text-[10px] text-red-400/60 font-bold mt-0.5">Cek koneksi & API key</p>
          </div>
        ) : balance !== null ? (
          <div className="relative z-10">
            <p className={`text-2xl font-black ${c.text} tracking-tight`}
              style={{textShadow:`0 0 16px ${c.glow}`}}>
              {prefix}{typeof balance==='number'?balance.toFixed(2):balance}
            </p>
            {status==='low'&&<p className="text-[10px] text-orange-400/80 font-bold flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3"/>Saldo Menipis</p>}
            {status==='ok'&&<p className={`text-[10px] ${c.muted} font-bold mt-0.5`}>Saldo Normal ✓</p>}
          </div>
        ) : (
          <div className="relative z-10">
            <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse"/>
          </div>
        )}
      </div>
    );
  };

  // ── TABS ─────────────────────────────────────────────────────────────
  const tabs = [
    { id:'overview',  label:'Overview',  icon: BarChart3 },
    { id:'deposits',  label:'Deposit',   icon: CreditCard, badge: pendingDeposits.length || null },
    { id:'users',     label:'Pengguna',  icon: Users },
    { id:'orders',    label:'Pesanan',   icon: History },
    { id:'settings',  label:'Pengaturan',icon: Settings },
  ];

  return (
    <div className="max-w-[90rem] mx-auto space-y-6">

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#160820] via-[#0a0000] to-[#050512] border border-purple-500/25 p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]"/>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/10 rounded-full blur-[60px]"/>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-400"/>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Panel</span>
              </h2>
              <p className="text-gray-400 text-sm font-medium">Superuser dashboard · Real-time monitoring</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleExportTransactionsCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all">
              <Download className="w-3.5 h-3.5"/> EXPORT CSV
            </button>
            <button onClick={handleExportUsersCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all">
              <Users className="w-3.5 h-3.5"/> EXPORT USER
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
              </span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label:'Total Pengguna', value: dbUsers.length, icon: Users, color:'purple', sub: `${bannedCount} banned` },
          { label:'Saldo Member', value: <FormatRupiah value={totalBalance}/>, icon: Database, color:'blue', sub:'total aset' },
          { label:'Pendapatan 30 Hari', value: <FormatRupiah value={totalRevenue}/>, icon: TrendingUp, color:'emerald', sub:'dari order sukses' },
          { label:'Order Aktif', value: activeOrdersCount, icon: Activity, color:'orange', sub:'menunggu OTP' },
          { label:'Deposit Pending', value: pendingDeposits.length, icon: Clock, color: pendingDeposits.length>0?'red':'gray', sub:'perlu konfirmasi' },
          { label:'Total Order', value: dbOrders.length, icon: CheckSquare, color:'cyan', sub:'30 hari terakhir' },
        ].map((card,i) => {
          const colorMap = {
            purple:'bg-purple-500/15 border-purple-500/30 text-purple-400',
            blue:'bg-blue-500/15 border-blue-500/30 text-blue-400',
            emerald:'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
            orange:'bg-orange-500/15 border-orange-500/30 text-orange-400',
            red:'bg-red-500/15 border-red-500/30 text-red-400',
            cyan:'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
            gray:'bg-white/5 border-white/10 text-gray-400',
          };
          const cc = colorMap[card.color];
          return (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:-translate-y-0.5 transition-all">
              <div className={`w-8 h-8 rounded-lg ${cc} border flex items-center justify-center mb-3`}>
                <card.icon className="w-4 h-4"/>
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{card.label}</p>
              <p className={`text-xl font-black text-white`}>{card.value}</p>
              <p className="text-[10px] text-gray-600 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── API BALANCE ROW ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ApiBalanceCard label="Saldo API 5SIM" balance={fiveSimBalance} loading={fiveSimLoading} status={fiveSimStatus}
          onRefresh={fetch5SimBalance} prefix="$" icon={Zap} color="cyan"/>
        <ApiBalanceCard label="Saldo API SMS Hub" balance={smsHubBalance} loading={smsHubLoading} status={smsHubStatus}
          onRefresh={fetchSmsHubBalance} prefix="$" icon={Smartphone} color="blue"/>
      </div>

      {/* ── TELEGRAM ALERT BUTTON ────────────────────────────────────── */}
      {(fiveSimStatus === 'low' || smsHubStatus === 'low') && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0"/>
          <p className="text-xs text-orange-300 font-bold flex-1">Saldo API menipis! Segera top up agar pembelian tidak terganggu.</p>
          <button onClick={() => handleSendTelegramAlert(
            `⚠️ SALDO API MENIPIS!\n5SIM: $${fiveSimBalance?.toFixed(2) ?? '?'}\nSMS Hub: $${smsHubBalance?.toFixed(2) ?? '?'}\n\nSegera top up saldo API.`
          )} disabled={tgAlertLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white text-[10px] font-black transition-all disabled:opacity-50 shrink-0">
            {tgAlertLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <MessageCircle className="w-3 h-3"/>}
            KIRIM ALERT TG
          </button>
        </div>
      )}

      {/* ── TABS NAV ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5 w-fit flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${
              activeTab===tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}>
            <tab.icon className="w-3.5 h-3.5"/>
            {tab.label}
            {tab.badge ? (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==='overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400"/>
                <h3 className="font-black text-white uppercase tracking-wide text-sm">Pendapatan 30 Hari</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 font-bold uppercase">Total</p>
                <p className="text-lg font-black text-emerald-400"><FormatRupiah value={globalLast7Days.reduce((a,b)=>a+b.amount,0)}/></p>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {globalLast7Days.map((day,i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative h-full">
                  <div className="w-full flex-1 flex items-end rounded-t-lg overflow-hidden bg-black/30 border border-white/5">
                    <div className="w-full bg-gradient-to-t from-emerald-900 to-emerald-500 rounded-t-lg group-hover:to-emerald-300 transition-all duration-500 relative cursor-pointer"
                      style={{ height:`${day.percentage}%`, minHeight: day.amount>0?'6%':'0%' }}>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-black py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10 shadow-lg">
                        <FormatRupiah value={day.amount}/>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase ${i===6?'text-emerald-400':'text-gray-600'}`}>
                    {i===6?'HARI INI':day.dateStr}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-purple-400"/>
              <h3 className="font-black text-white uppercase tracking-wide text-sm">Order Terbaru</h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-custom">
              {dbOrders.slice(0,8).map((o,i) => {
                const isOk = o.status==='success'||o.status==='finished';
                const isCanceled = o.status==='canceled'||o.status==='CANCELLED';
                const isActive = o.status==='active'||o.status==='pending';
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOk?'bg-emerald-400':isCanceled?'bg-red-400':isActive?'bg-blue-400':'bg-gray-500'}`}/>
                      <p className="text-xs text-white font-bold truncate">{o.serviceId?.toUpperCase()}</p>
                      <p className="text-[10px] text-gray-500 truncate">{o.countryId}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-white"><FormatRupiah value={o.price||0}/></span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isOk?'bg-emerald-500/15 text-emerald-400':isCanceled?'bg-red-500/15 text-red-400':isActive?'bg-blue-500/15 text-blue-400':'bg-gray-500/15 text-gray-400'}`}>
                        {isOk?'SUKSES':isCanceled?'BATAL':isActive?'AKTIF':o.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
              {dbOrders.length===0&&<p className="text-center text-gray-600 text-sm py-8">Belum ada data order.</p>}
            </div>
          </div>

          {/* Top users by spending */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400"/>
              <h3 className="font-black text-white uppercase tracking-wide text-sm">Top Member</h3>
            </div>
            <div className="space-y-2">
              {[...dbUsers].sort((a:any,b:any)=>(b.totalSpent||0)-(a.totalSpent||0)).slice(0,5).map((u:any,i) => (
                <div key={u.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i===0?'bg-yellow-500 text-black':i===1?'bg-gray-300 text-black':i===2?'bg-amber-600 text-black':'bg-white/10 text-white'}`}>{i+1}</span>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}&backgroundColor=a855f7`} className="w-7 h-7 rounded-full border border-purple-500/20" alt="av"/>
                  <p className="text-xs font-bold text-white flex-1 truncate">{u.name}</p>
                  <p className="text-xs font-black text-purple-400"><FormatRupiah value={u.totalSpent||0}/></p>
                </div>
              ))}
              {dbUsers.length===0&&<p className="text-center text-gray-600 text-sm py-8">Belum ada data.</p>}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-400"/>
              <h3 className="font-black text-white uppercase tracking-wide text-sm">Statistik Cepat</h3>
            </div>
            <div className="space-y-3">
              {[
                { label:'Avg. saldo per member', value: <FormatRupiah value={dbUsers.length?Math.floor(totalBalance/dbUsers.length):0}/> },
                { label:'Total order sukses', value: dbOrders.filter(o=>o.status==='success'||o.status==='finished').length },
                { label:'Total order batal', value: dbOrders.filter(o=>o.status==='canceled'||o.status==='CANCELLED').length },
                { label:'Deposit pending', value: pendingDeposits.length },
                { label:'Member aktif (tdk banned)', value: dbUsers.filter((u:any)=>!u.banned).length },
              ].map((s,i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-xs font-black text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: DEPOSITS                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==='deposits' && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-purple-400"/>
              <h3 className="font-black text-white uppercase tracking-wide text-sm">Permintaan Deposit</h3>
              {pendingDeposits.length>0&&<span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">{pendingDeposits.length} PENDING</span>}
            </div>
            <p className="text-xs text-gray-500">Hanya deposit manual perlu konfirmasi. QRIS diproses otomatis.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {['Pengguna','Nominal','Metode','Waktu','Aksi'].map(h=>(
                    <th key={h} className="text-left py-3 px-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedDeposits.length===0?(
                  <tr><td colSpan={5} className="py-16 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-900/50 mx-auto mb-2"/>
                    <p className="text-gray-500 font-bold text-sm">Tidak ada deposit pending.</p>
                  </td></tr>
                ):displayedDeposits.map((tx:any) => {
                  const ageMin = depositAgeMinutes(tx.timestamp);
                  const isOld = ageMin > 60;
                  const isAuto = tx.method?.toLowerCase().includes('paymenku')||tx.method?.toLowerCase().includes('otomatis')||tx.isAuto;
                  return (
                    <tr key={tx.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-sm font-black text-purple-400">
                            {(tx.userName||'?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{tx.userName||'Unknown'}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{getNumericId(tx.userId)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <p className="font-black text-white text-sm"><FormatRupiah value={tx.amount}/></p>
                      </td>
                      <td className="py-4 px-5">
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAuto?'bg-blue-500/10 border-blue-500/20 text-blue-400':'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                            {tx.method||'Manual'}
                          </span>
                          {isAuto&&<p className="text-[9px] text-blue-400/60 mt-0.5">↓ OTOMATIS</p>}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-xs text-gray-400">{fmtTs(tx.timestamp)}</p>
                        <p className={`text-[10px] font-bold ${isOld?'text-orange-400':'text-gray-500'}`}>
                          {isOld?'⚠️ ':''}{ageMin<1?'Baru saja':ageMin<60?`${ageMin} mnt lalu`:Math.floor(ageMin/60)+' jam lalu'}
                        </p>
                      </td>
                      <td className="py-4 px-5">
                        {isAuto?(
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-400/70 font-bold uppercase">Auto-Process</span>
                            <button disabled={isProcessing} onClick={()=>handleRejectDeposit(tx)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-black transition-all disabled:opacity-50">
                              <XCircle className="w-3 h-3"/> TOLAK
                            </button>
                          </div>
                        ):(
                          <div className="flex items-center gap-2">
                            <button disabled={isProcessing} onClick={()=>handleApproveDeposit(tx)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-black transition-all disabled:opacity-50">
                              <CheckCircle className="w-3 h-3"/> TERIMA
                            </button>
                            <button disabled={isProcessing} onClick={()=>handleRejectDeposit(tx)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-black transition-all disabled:opacity-50">
                              <XCircle className="w-3 h-3"/> TOLAK
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.06]">
            <PaginationControls currentPage={depositPage} totalPages={Math.ceil(pendingDeposits.length/itemsPerPage)} onPageChange={setDepositPage}/>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: USERS                                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==='users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
              <input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setUserPage(1);}}
                placeholder="Cari nama atau email…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold">{filteredUsers.length} pengguna</span>
              <button onClick={handleExportUsersCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white text-xs font-black transition-all">
                <Download className="w-3.5 h-3.5"/> EXPORT
              </button>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {['Pengguna','Email / ID','Saldo','Total Belanja','Bergabung','Aksi'].map(h=>(
                      <th key={h} className="text-left py-3 px-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.length===0?(
                    <tr><td colSpan={6} className="py-16 text-center">
                      <Users className="w-10 h-10 text-gray-700 mx-auto mb-2"/>
                      <p className="text-gray-500 font-bold text-sm">Pengguna tidak ditemukan.</p>
                    </td></tr>
                  ):displayedUsers.map((u:any)=>(
                    <tr key={u.id} className={`border-b border-white/[0.04] transition-colors group ${u.banned?'bg-red-950/10':'hover:bg-white/[0.02]'}`}>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}&backgroundColor=a855f7`}
                              className={`w-9 h-9 rounded-full border ${u.banned?'border-red-500/40 grayscale':'border-purple-500/30'}`} alt="av"/>
                            {u.banned&&<div className="absolute -bottom-0.5 -right-0.5 bg-red-600 p-0.5 rounded-full"><Ban className="w-2.5 h-2.5 text-white"/></div>}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${u.banned?'text-gray-500 line-through':'text-white'}`}>{u.name}</p>
                            {u.banned&&<p className="text-[9px] text-red-500 font-black uppercase">SUSPENDED</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-xs text-gray-300">{u.email}</p>
                        <p className="text-[10px] text-gray-600 font-mono mt-0.5">ID: {getNumericId(u.id)}</p>
                      </td>
                      <td className="py-4 px-5">
                        <p className={`text-sm font-black ${u.banned?'text-gray-600':'text-purple-400'}`}><FormatRupiah value={u.balance||0}/></p>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-sm font-black text-white"><FormatRupiah value={u.totalSpent||0}/></p>
                      </td>
                      <td className="py-4 px-5">
                        <p className="text-xs text-gray-400">{u.createdAt?new Date(u.createdAt).toLocaleDateString('id-ID'):'-'}</p>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <button disabled={isProcessing} onClick={()=>handleToggleBan(u)}
                            className={`p-2 rounded-xl border transition-all ${u.banned?'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white':'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'}`}
                            title={u.banned?'Unban':'Suspend'}>
                            {u.banned?<CheckCircle2 className="w-3.5 h-3.5"/>:<Ban className="w-3.5 h-3.5"/>}
                          </button>
                          <button disabled={isProcessing||u.banned} onClick={()=>openTopUpModal(u)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-black transition-all disabled:opacity-40">
                            <Plus className="w-3 h-3"/> SUNTIK
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-white/[0.06]">
              <PaginationControls currentPage={userPage} totalPages={Math.ceil(filteredUsers.length/itemsPerPage)} onPageChange={setUserPage}/>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: ORDERS                                                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==='orders' && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <History className="w-5 h-5 text-blue-400"/>
            <h3 className="font-black text-white text-sm uppercase tracking-wide">Pesanan 30 Hari Terakhir</h3>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400 font-bold">{dbOrders.length} order</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {['Layanan','Nomor','Harga','Server','Status','Waktu'].map(h=>(
                    <th key={h} className="text-left py-3 px-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbOrders.slice(0,50).map((o:any,i) => {
                  const isOk=o.status==='success'||o.status==='finished';
                  const isCanceled=o.status==='canceled'||o.status==='CANCELLED';
                  const isActive=o.status==='active'||o.status==='pending';
                  return (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5">
                        <p className="text-xs font-bold text-white">{o.saName||o.serviceId?.toUpperCase()}</p>
                        <p className="text-[10px] text-gray-500">{o.countryId?.toUpperCase()}</p>
                      </td>
                      <td className="py-3 px-5">
                        <p className="text-xs font-mono text-gray-300">{o.number||o.phone||'—'}</p>
                      </td>
                      <td className="py-3 px-5">
                        <p className="text-xs font-black text-white"><FormatRupiah value={o.price||0}/></p>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${o.provider==='smsactivate'?'bg-blue-500/15 text-blue-400':'bg-red-500/15 text-red-400'}`}>
                          {o.provider==='smsactivate'?'Server 2':'Server 1'}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isOk?'bg-emerald-500/15 text-emerald-400':isCanceled?'bg-red-500/15 text-red-400':isActive?'bg-blue-500/15 text-blue-400 animate-pulse':'bg-gray-500/15 text-gray-400'}`}>
                          {isOk?'SUKSES':isCanceled?'BATAL':isActive?'AKTIF':o.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <p className="text-xs text-gray-400">{fmtTs(o.timestamp)}</p>
                      </td>
                    </tr>
                  );
                })}
                {dbOrders.length===0&&(
                  <tr><td colSpan={6} className="py-16 text-center text-gray-500 text-sm">Belum ada order dalam 30 hari terakhir.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: SETTINGS                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab==='settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Pengumuman */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <Megaphone className="w-4 h-4 text-blue-400"/>
              </div>
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wide">Pengumuman Global</h3>
                <p className="text-gray-500 text-xs">Tampil sebagai banner berjalan untuk semua user.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Teks Pengumuman</label>
                <textarea value={announceText} onChange={e=>setAnnounceText(e.target.value)} rows={4}
                  placeholder="Tulis pengumuman di sini…"
                  maxLength={300}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all resize-none font-medium"/>
                <p className="text-[10px] text-gray-600 mt-1 text-right">{announceText.length}/300</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`relative w-11 h-6 rounded-full transition-all ${isAnnounceActive?'bg-blue-600':'bg-white/10'}`}
                  onClick={()=>setIsAnnounceActive(!isAnnounceActive)}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isAnnounceActive?'left-[22px]':'left-0.5'}`}/>
                </div>
                <span className="text-sm font-bold text-white">Aktifkan Banner</span>
                {isAnnounceActive&&<span className="text-[10px] bg-blue-500/15 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">AKTIF</span>}
              </label>
              <button disabled={isProcessing} onClick={handleSaveAnnouncement}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isProcessing?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} SIMPAN PENGUMUMAN
              </button>
            </div>
          </div>

          {/* Maintenance Mode */}
          <div className={`bg-white/[0.03] border rounded-2xl p-6 ${isMaintenanceActive ? 'border-orange-500/40' : 'border-white/[0.06]'}`}>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${isMaintenanceActive ? 'bg-orange-500/20 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
                <Settings className={`w-4 h-4 ${isMaintenanceActive ? 'text-orange-400' : 'text-gray-400'}`}/>
              </div>
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wide flex items-center gap-2">
                  Maintenance Mode
                  {isMaintenanceActive && <span className="text-[9px] bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-black animate-pulse">AKTIF</span>}
                </h3>
                <p className="text-gray-500 text-xs">Blokir semua pembelian nomor sementara.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Pesan ke User</label>
                <input value={maintenanceMsg} onChange={e=>setMaintenanceMsg(e.target.value)}
                  placeholder="Sistem sedang maintenance. Coba lagi nanti."
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-all font-medium"/>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-all ${isMaintenanceActive ? 'bg-orange-500' : 'bg-white/10'}`}
                  onClick={()=>setIsMaintenanceActive(!isMaintenanceActive)}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isMaintenanceActive ? 'left-[22px]' : 'left-0.5'}`}/>
                </div>
                <span className="text-sm font-bold text-white">Aktifkan Maintenance</span>
              </label>
              <button disabled={isProcessing} onClick={handleSaveMaintenance}
                className={`w-full font-black py-3 rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${isMaintenanceActive ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Settings className="w-4 h-4"/>}
                {isMaintenanceActive ? 'AKTIFKAN MAINTENANCE' : 'SIMPAN (NONAKTIF)'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white/[0.03] border border-red-500/15 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-red-500/15">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400"/>
              </div>
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-wide">Danger Zone</h3>
                <p className="text-gray-500 text-xs">Aksi permanen. Hati-hati.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-sm font-bold text-white mb-1">Reset Papan Peringkat</p>
                <p className="text-xs text-gray-400 mb-3">Reset totalSpent seluruh pengguna ke 0. Tidak bisa dibatalkan.</p>
                <button disabled={isProcessing} onClick={handleResetLeaderboard}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-xs font-black transition-all disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5"/> RESET LEADERBOARD
                </button>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-sm font-bold text-white mb-1">Export Data Lengkap</p>
                <p className="text-xs text-gray-400 mb-3">Unduh semua data pengguna dan transaksi dalam format CSV.</p>
                <div className="flex gap-2">
                  <button onClick={handleExportUsersCSV}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-black transition-all">
                    <Download className="w-3 h-3"/> USER CSV
                  </button>
                  <button onClick={handleExportTransactionsCSV}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-all">
                    <Download className="w-3 h-3"/> TX CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOPUP MODAL ──────────────────────────────────────────────── */}
      {showTopUpModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0a0000] border border-purple-600/40 p-6 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.15)] relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-purple-600/15 blur-3xl rounded-full"/>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h3 className="text-xl font-black text-white uppercase">Suntik Saldo</h3>
              <button onClick={()=>setShowTopUpModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4 mb-6 relative z-10">
              <div className="bg-purple-500/5 border border-purple-500/15 p-3 rounded-xl flex items-center gap-3">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.name}&backgroundColor=a855f7`} className="w-10 h-10 rounded-full" alt="av"/>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Target</p>
                  <p className="font-bold text-white">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">Saldo: <FormatRupiah value={selectedUser.balance||0}/></p>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 font-black text-sm">Rp</span>
                  <input type="number" value={addAmount} onChange={e=>setAddAmount(e.target.value)} placeholder="50000"
                    className="w-full bg-black/60 border border-purple-900/40 rounded-xl py-3.5 pl-12 pr-4 text-xl font-black text-white focus:outline-none focus:border-purple-500 transition-all"/>
                </div>
              </div>
            </div>
            <button disabled={isProcessing} onClick={handleProcessTopUp}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3.5 rounded-xl uppercase tracking-widest shadow-lg shadow-purple-900/30 disabled:opacity-50 transition-all relative z-10 flex items-center justify-center gap-2">
              {isProcessing?<Loader2 className="w-5 h-5 animate-spin"/>:<Plus className="w-5 h-5"/>} PROSES SUNTIK
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ───────────────────────────────────────────── */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f0202] border border-red-500/25 p-7 rounded-2xl w-full max-w-sm shadow-[0_0_40px_rgba(220,38,38,0.15)] relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-red-600/10 blur-3xl rounded-full"/>
            <div className="relative z-10 text-center">
              <div className="w-14 h-14 bg-red-500/10 text-red-500 flex items-center justify-center rounded-2xl mx-auto mb-5 border border-red-500/20">
                <AlertTriangle className="w-7 h-7"/>
              </div>
              <h3 className="text-lg font-black text-white uppercase mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-400 mb-6 text-sm leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button className="flex-1 py-2.5 text-sm font-bold border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white rounded-xl transition-all"
                  onClick={()=>setConfirmDialog({isOpen:false,title:'',message:'',onConfirm:null})}>BATAL</button>
                <button className="flex-1 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center"
                  onClick={confirmDialog.onConfirm} disabled={isProcessing}>
                  {isProcessing?<Loader2 className="w-4 h-4 animate-spin"/>:'YAKIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
);