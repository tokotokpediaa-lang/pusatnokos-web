'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Loader2, CheckCircle2, Phone, Hash } from 'lucide-react';

interface Order {
  id?: string;
  orderId?: string;
  userId: string;
  serviceId?: string;
  saName?: string;
  number?: string;
  phone?: string;
  price?: number;
  status?: string;
}

interface ForceCancelButtonProps {
  order: Order;
  adminToken?: string;
  getToken?: () => Promise<string | null>;
  onSuccess?: (orderId: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export function ForceCancelButton({ order, adminToken, getToken, onSuccess, showToast }: ForceCancelButtonProps) {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [otpConflict, setOtpConflict] = useState<{ otp: string; number: string } | null>(null);

  const orderId = order.orderId ?? order.id ?? '';
  const serviceName = order.saName || order.serviceId?.toUpperCase() || 'Order';
  const phoneDisplay = order.number || order.phone || '—';

  const resolveToken = async (): Promise<string | null> => {
    if (getToken) return getToken();
    return adminToken ?? null;
  };

  const handleConfirm = async () => {
    setPhase('loading');
    setErrorMsg(null);
    setOtpConflict(null);
    try {
      const token = await resolveToken();
      if (!token) { setErrorMsg('Token tidak valid. Refresh halaman.'); setPhase('confirm'); return; }
      const res = await fetch('/api/admin/force-cancel-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, userId: order.userId }),
      });
      const data = await res.json();
      if (res.status === 409 && data.hasOtp) { setOtpConflict({ otp: data.otp, number: data.number }); setPhase('confirm'); return; }
      if (!res.ok) { setErrorMsg(data.error || 'Gagal force cancel.'); setPhase('confirm'); return; }
      setPhase('done');
      showToast?.(`Force cancel berhasil: ${serviceName}`, 'success');
      setTimeout(() => { setPhase('idle'); onSuccess?.(orderId); }, 1500);
    } catch { setErrorMsg('Koneksi gagal. Coba lagi.'); setPhase('confirm'); }
  };

  const handleClose = () => { setPhase('idle'); setErrorMsg(null); setOtpConflict(null); };

  return (
    <>
      <button
        onClick={() => setPhase('confirm')}
        disabled={phase !== 'idle'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        Force
      </button>

      {phase !== 'idle' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}>
          <div className="relative w-full max-w-sm rounded-2xl border overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0808 0%, #0f0404 100%)', borderColor: otpConflict ? '#f59e0b50' : '#ef444450', boxShadow: otpConflict ? '0 0 60px #f59e0b25, inset 0 1px 0 #f59e0b15' : '0 0 60px #ef444425, inset 0 1px 0 #ef444415' }}>
            <div className="h-1 w-full" style={{ background: otpConflict ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#b91c1c)' }} />
            <button onClick={handleClose} disabled={phase === 'loading'} className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40"><X className="w-4 h-4" /></button>
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: otpConflict ? '#f59e0b15' : '#ef444415', border: `1px solid ${otpConflict ? '#f59e0b30' : '#ef444430'}` }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: otpConflict ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div>
                  <p className="font-black text-white text-sm uppercase tracking-widest">{otpConflict ? 'OTP Sudah Masuk!' : 'Force Cancel Order'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{otpConflict ? 'Order ini tidak bisa dibatalkan' : 'Tindakan ini tidak bisa diundo'}</p>
                </div>
              </div>

              {otpConflict ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#f59e0b0d', border: '1px solid #f59e0b25' }}>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">⚠️ OTP sudah diterima — cancel dibatalkan</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400"><Phone className="w-3.5 h-3.5 text-gray-600 shrink-0" /><span className="font-mono">{otpConflict.number}</span></div>
                  <div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-gray-600 shrink-0" /><span className="font-mono text-xl font-black text-amber-400 tracking-[0.3em]">{otpConflict.otp}</span></div>
                </div>
              ) : (
                <div className="rounded-xl p-4 space-y-2.5" style={{ background: '#ffffff06', border: '1px solid #ffffff0f' }}>
                  {[['Service', <span key="s" className="text-white font-black">{serviceName}</span>], ['Nomor', <span key="n" className="font-mono text-gray-300">{phoneDisplay}</span>], ['Order ID', <span key="o" className="font-mono text-gray-500 text-[11px]">{orderId}</span>]].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-wider">{label}</span>
                      {val}
                    </div>
                  ))}
                  {(order.price ?? 0) > 0 && (
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-wider">Refund</span>
                      <span className="text-green-400 font-black">+Rp {order.price!.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              )}

              {errorMsg && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 font-bold">{errorMsg}</p>}
              {phase === 'done' && <div className="flex items-center gap-2 text-green-400 text-sm font-black"><CheckCircle2 className="w-4 h-4" />Berhasil di-cancel!</div>}

              <div className="flex gap-2 pt-1">
                <button onClick={handleClose} disabled={phase === 'loading' || phase === 'done'} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {otpConflict ? 'Tutup' : 'Batalkan'}
                </button>
                {!otpConflict && phase !== 'done' && (
                  <button onClick={handleConfirm} disabled={phase === 'loading'} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white border border-red-500/40 hover:border-red-400/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>
                    {phase === 'loading' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Proses...</> : <><ShieldAlert className="w-3.5 h-3.5" />Ya, Force Cancel</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}