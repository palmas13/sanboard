'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { CreditCard, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Payment } from '@/types';

export default function HesabimOdemelerPage() {
  const { currentProfile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile) return;

    async function fetchPayments() {
      try {
        const res = await fetch(`/api/user/payments?profileId=${currentProfile?.id}`);
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
      <div className="pb-4 border-b border-[var(--border-app)]">
        <h2 className="text-xl font-bold text-[var(--text-main)]">Ödeme Geçmişim</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Fleeca Bank üzerinden gerçekleştirdiğiniz paket satın alma işlemlerinin dökümü.
        </p>
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
                    7 Günlük Standart İlan
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
    </div>
  );
}
