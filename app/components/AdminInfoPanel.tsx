'use client';

/**
 * AdminInfoPanel.tsx
 * ─────────────────────────────────────────────────────────────────
 * Panel admin untuk mengelola konten InfoPage secara realtime.
 * Di-import di AdminPanelPage.tsx, ditambahkan ke dalam tab 'settings'.
 *
 * Data tersimpan di Firestore: settings/siteInfo
 *
 * CARA PAKAI DI AdminPanelPage.tsx:
 *   import AdminInfoPanel from './AdminInfoPanel';
 *   // Di dalam tab 'settings', tambahkan:
 *   <AdminInfoPanel showToast={showToast} />
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, RefreshCw, Eye, EyeOff,
  ChevronDown, ChevronUp, Loader2, Info, FileText,
  Link, Megaphone, AlertCircle, CheckCircle2
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import type { SiteInfoData, InfoCard, ExtraChannel } from './InfoPage';

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

// ── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const COLOR_OPTIONS: InfoCard['color'][] = ['red', 'blue', 'green', 'orange', 'purple', 'yellow'];

const CHANNEL_TYPES: { value: ExtraChannel['type']; label: string }[] = [
  { value: 'telegram_channel', label: 'Telegram Channel' },
  { value: 'telegram_group',   label: 'Telegram Group' },
  { value: 'whatsapp',         label: 'WhatsApp' },
  { value: 'youtube',          label: 'YouTube' },
  { value: 'website',          label: 'Website' },
  { value: 'other',            label: 'Lainnya' },
];

// ── Shared Input Styles ────────────────────────────────────────────────────
const inputCls = 'w-full bg-[#0a0101] border border-red-900/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors';
const textareaCls = `${inputCls} resize-none`;
const labelCls = 'text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block';

// ── Section wrapper ────────────────────────────────────────────────────────
function AdminSection({
  icon, title, children, defaultOpen = false
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#080000] border border-red-900/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-red-400">{icon}</span>
          <span className="text-white font-black text-sm uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminInfoPanel({ showToast }: { showToast?: (msg: string, type?: 'success' | 'error') => void }) {
  const [data, setData]         = useState<SiteInfoData>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Local edit states
  const [serviceDesc, setServiceDesc]     = useState('');
  const [refundPolicy, setRefundPolicy]   = useState('');
  const [refundNotes, setRefundNotes]     = useState('');
  const [infoCards, setInfoCards]         = useState<InfoCard[]>([]);
  const [extraChannels, setExtraChannels] = useState<ExtraChannel[]>([]);

  // Sync dari Firestore
  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const ref = doc(db, 'settings', 'siteInfo');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as SiteInfoData;
        setData(d);
        setServiceDesc(d.serviceDescription || '');
        setRefundPolicy(d.refundPolicy || '');
        setRefundNotes(d.refundNotes || '');
        setInfoCards(d.infoCards || []);
        setExtraChannels(d.extraChannels || []);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Save ke Firestore
  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      await setDoc(doc(db, 'settings', 'siteInfo'), {
        serviceDescription: serviceDesc,
        refundPolicy,
        refundNotes,
        infoCards,
        extraChannels,
        lastUpdated: now,
      } satisfies SiteInfoData, { merge: true });
      showToast?.('Info berhasil disimpan!', 'success');
    } catch (e) {
      showToast?.('Gagal menyimpan. Coba lagi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Card Handlers ──────────────────────────────────────────────────
  const addCard = () => setInfoCards(prev => [...prev, {
    id: uid(), title: '', content: '', icon: '📢', color: 'red', visible: true
  }]);

  const updateCard = (id: string, field: keyof InfoCard, val: any) =>
    setInfoCards(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const removeCard = (id: string) => setInfoCards(prev => prev.filter(c => c.id !== id));

  const moveCard = (id: string, dir: 'up' | 'down') => {
    setInfoCards(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const arr = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  };

  // ── Channel Handlers ───────────────────────────────────────────────
  const addChannel = () => setExtraChannels(prev => [...prev, {
    id: uid(), name: '', description: '', url: 'https://', type: 'telegram_channel', visible: true
  }]);

  const updateChannel = (id: string, field: keyof ExtraChannel, val: any) =>
    setExtraChannels(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const removeChannel = (id: string) => setExtraChannels(prev => prev.filter(c => c.id !== id));

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat data info...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-2">
        <div>
          <p className="text-white font-black text-sm uppercase tracking-widest">Kelola Info & Konten Publik</p>
          <p className="text-gray-600 text-xs mt-0.5">
            Perubahan langsung tampil di halaman Info.
            {data.lastUpdated && ` Terakhir disimpan: ${data.lastUpdated}`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-widest shrink-0"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Simpan Semua
        </button>
      </div>

      {/* ── Deskripsi Layanan ────────────────────────────────────────── */}
      <AdminSection icon={<Info className="w-4 h-4" />} title="Deskripsi Layanan" defaultOpen>
        <label className={labelCls}>Teks Deskripsi Layanan</label>
        <textarea
          className={textareaCls}
          rows={5}
          placeholder="Tulis deskripsi layanan yang tampil di halaman Info..."
          value={serviceDesc}
          onChange={e => setServiceDesc(e.target.value)}
        />
        <p className="text-[10px] text-gray-600 mt-1.5">Mendukung line break (Enter untuk paragraf baru).</p>
      </AdminSection>

      {/* ── Ketentuan Refund ─────────────────────────────────────────── */}
      <AdminSection icon={<FileText className="w-4 h-4" />} title="Ketentuan Refund">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Kebijakan Umum Refund</label>
            <textarea
              className={textareaCls}
              rows={4}
              placeholder="Tulis kebijakan refund umum..."
              value={refundPolicy}
              onChange={e => setRefundPolicy(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Catatan Tambahan (opsional)</label>
            <textarea
              className={textareaCls}
              rows={2}
              placeholder="Catatan atau peringatan khusus terkait refund (tampil dengan ikon warning)..."
              value={refundNotes}
              onChange={e => setRefundNotes(e.target.value)}
            />
          </div>
        </div>
      </AdminSection>

      {/* ── Info Cards / Pengumuman ───────────────────────────────────── */}
      <AdminSection icon={<Megaphone className="w-4 h-4" />} title={`Info Cards / Pengumuman (${infoCards.length})`}>
        <div className="space-y-3 mb-3">
          {infoCards.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">Belum ada info card. Klik tambah untuk membuat.</p>
          )}
          {infoCards.map((card, idx) => (
            <div key={card.id} className="bg-[#0a0101] border border-red-900/20 rounded-xl p-4 space-y-3">
              {/* Header card */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Card #{idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateCard(card.id, 'visible', !card.visible)}
                    className={`p-1.5 rounded-lg border transition-colors text-xs ${card.visible ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-500'}`}
                    title={card.visible ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {card.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => moveCard(card.id, 'up')} className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-white transition-colors" title="Naik">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveCard(card.id, 'down')} className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-white transition-colors" title="Turun">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeCard(card.id)} className="p-1.5 rounded-lg border border-red-900/30 text-red-500 hover:bg-red-500/10 transition-colors" title="Hapus">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ikon (emoji)</label>
                  <input
                    className={inputCls}
                    placeholder="📢"
                    value={card.icon}
                    maxLength={4}
                    onChange={e => updateCard(card.id, 'icon', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Warna</label>
                  <select
                    className={inputCls}
                    value={card.color}
                    onChange={e => updateCard(card.id, 'color', e.target.value)}
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Judul</label>
                <input
                  className={inputCls}
                  placeholder="Judul pengumuman..."
                  value={card.title}
                  onChange={e => updateCard(card.id, 'title', e.target.value)}
                />
              </div>

              <div>
                <label className={labelCls}>Isi Konten</label>
                <textarea
                  className={textareaCls}
                  rows={3}
                  placeholder="Tulis isi pengumuman atau informasi..."
                  value={card.content}
                  onChange={e => updateCard(card.id, 'content', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addCard}
          className="w-full py-2.5 rounded-xl border border-dashed border-red-900/40 text-gray-500 hover:text-red-400 hover:border-red-500/40 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Info Card
        </button>
      </AdminSection>

      {/* ── Channel Tambahan ─────────────────────────────────────────── */}
      <AdminSection icon={<Link className="w-4 h-4" />} title={`Channel Tambahan (${extraChannels.length})`}>
        <p className="text-[10px] text-gray-600 mb-3">
          Channel default (Telegram CS, WhatsApp CS, Website) selalu tampil. Tambah channel ekstra di sini.
        </p>

        <div className="space-y-3 mb-3">
          {extraChannels.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">Belum ada channel tambahan.</p>
          )}
          {extraChannels.map((ch, idx) => (
            <div key={ch.id} className="bg-[#0a0101] border border-red-900/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Channel #{idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateChannel(ch.id, 'visible', !ch.visible)}
                    className={`p-1.5 rounded-lg border transition-colors ${ch.visible ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-500'}`}
                    title={ch.visible ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {ch.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => removeChannel(ch.id)} className="p-1.5 rounded-lg border border-red-900/30 text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama Channel</label>
                  <input className={inputCls} placeholder="Telegram Channel Resmi" value={ch.name} onChange={e => updateChannel(ch.id, 'name', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Tipe</label>
                  <select className={inputCls} value={ch.type} onChange={e => updateChannel(ch.id, 'type', e.target.value)}>
                    {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>URL</label>
                <input className={inputCls} placeholder="https://t.me/..." value={ch.url} onChange={e => updateChannel(ch.id, 'url', e.target.value)} />
              </div>

              <div>
                <label className={labelCls}>Deskripsi Singkat</label>
                <input className={inputCls} placeholder="Ikuti channel resmi kami untuk info terbaru." value={ch.description} onChange={e => updateChannel(ch.id, 'description', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addChannel}
          className="w-full py-2.5 rounded-xl border border-dashed border-red-900/40 text-gray-500 hover:text-red-400 hover:border-red-500/40 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Channel
        </button>
      </AdminSection>

      {/* Save button bottom */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(220,38,38,0.25)]"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Simpan Semua Perubahan
      </button>
    </div>
  );
}