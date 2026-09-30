'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { CreditCard, CheckCircle2, Clock, XCircle, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Payment } from '@/types';
import { getPaymentProductLabel } from '@/lib/payments/presentation';

export default function HesabimOdemelerPage() {
  const { currentProfile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const clearHistory = async () => {
    setClearing(true); setClearError('');
    try {
      const res = await fetch('/api/user/payments', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Geçmiş temizlenemedi.');
      setPayments([]); setClearModalOpen(false);
    } catch (error: any) { setClearError(error.message || 'Geçmiş temizlenemedi.'); }
    finally { setClearing(false); }
  };

  useEffect(() => {
    if (!currentProfile) return;

    async function fetchPayments() {
      try {
        const res = await fetch('/api/user/payments');
        const data = await res.json();
        if (Array.isArray(data)) {
          setPayments(data);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, [currentProfile]);

  return (
    <div className="surface-card p-6 sm:p-8 rounded-2xl border border-[var(--border-app)] space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-app)] pb-4">
        <div><h2 className="text-xl font-bold text-[var(--text-main)]">Ödeme Geçmişim</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Fleeca Bank üzerinden gerçekleştirdiğiniz paket satın alma işlemlerinin dökümü.
        </p></div>
        {payments.length > 0 && <button type="button" onClick={() => setClearModalOpen(true)} className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" />Geçmişi Temizle</button>}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
          <span>Ödeme kayıtları getiriliyor...</span>
        </div>
      ) : payments.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Sipariş No</th>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Paket</th>
                <th className="py-3 px-4">Tutar</th>
                <th className="py-3 px-4">Sağlayıcı</th>
                <th className="py-3 px-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-app)]">
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-[var(--bg-surface-secondary)]/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-[var(--text-main)]">
                    {pay.order_id}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">
                    {formatDateTime(pay.created_at)}
                  </td>
                  <td className="py-3 px-4 font-medium text-[var(--text-main)]">
                    {getPaymentProductLabel(pay)}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#FF8A1F]">
                    {formatCurrency(pay.amount)}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-dim)]">
                    Fleeca Bank
                  </td>
                  <td className="py-3 px-4">
                    {pay.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Başarılı</span>
                      </span>
                    ) : pay.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] font-semibold text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>Bekliyor</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] font-semibold text-[11px]">
                        <XCircle className="w-3 h-3" />
                        <span>Başarısız</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center space-y-2">
          <CreditCard className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
          <p className="text-sm font-bold text-[var(--text-main)]">
            Henüz bir ödeme işleminiz bulunmuyor.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            İlan paketi satın aldığınızda ödeme makbuzlarınız burada listelenecektir.
          </p>
        </div>
      )}
      {clearModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-payment-title"><div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><ShieldCheck className="h-5 w-5" /></div><h3 id="clear-payment-title" className="text-lg font-bold text-[var(--text-main)]">Ödeme geçmişini görünümden kaldır?</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">İşlem kayıtları güvenlik, finansal denetim ve hak doğrulama amacıyla korunur. Bu işlem yalnızca geçmişi bu karakter profilinin görünümünden kaldırır.</p>{clearError && <p className="mt-3 text-xs font-semibold text-[var(--color-danger)]">{clearError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setClearModalOpen(false)} disabled={clearing} className="btn-secondary px-4 py-2 text-xs">Vazgeç</button><button type="button" onClick={clearHistory} disabled={clearing} className="btn-primary px-4 py-2 text-xs">{clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Görünümden Kaldır'}</button></div></div></div>}
    </div>
  );
}
