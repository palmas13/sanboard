'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Check, ShieldCheck, ArrowRight, Loader2, Sparkles, Building2, User, Crown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default function IlanPaketSecPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated } = useAuth();
  const [loadingPkg, setLoadingPkg] = useState<'individual' | null>(null);
  const [error, setError] = useState('');

  const individualPrice = 2000;

  const handleSelectIndividual = async () => {
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver/paket');
      return;
    }

    setLoadingPkg('individual');
    setError('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          packageCode: 'STANDARD_7_DAY',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sipariş oluşturulamadı.');

      router.push(`/odeme/${data.orderId}`);
    } catch (err: any) {
      setError(err.message || 'Ödeme sayfası başlatılamadı.');
      setLoadingPkg(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Şeffaf & Standart Fiyatlandırma</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
          Bireysel İlan Paketi
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          Karakterinizin kişisel kimliği altında araç veya mülk ilanınızı 7 gün boyunca yayınlayın.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold border border-[rgba(229,72,77,0.3)] text-center">
          {error}
        </div>
      )}

      {/* Single Bireysel Card */}
      <div className="surface-card rounded-2xl border border-[var(--border-app)] hover:border-[#FF8A1F]/50 p-6 sm:p-8 shadow-xl relative flex flex-col justify-between space-y-6 transition-all">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-main)] text-xs font-bold border border-[var(--border-app)]">
              <User className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>BİREYSEL İLAN</span>
            </span>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Standart Tarife</span>
          </div>

          <div className="space-y-2 border-b border-[var(--border-app)] pb-5">
            <h3 className="text-xl font-bold text-[var(--text-main)]">
              7 Günlük Standart İlan
            </h3>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-[#FF8A1F] tracking-tight">
                {formatCurrency(individualPrice)}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-semibold">/ 7 gün</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Karakterinizin kişisel kimliği altında yayınlanır. GTA World Fleeca hesabınızdan tahsil edilir.
            </p>
          </div>

          <ul className="space-y-3 text-xs sm:text-sm text-[var(--text-main)]">
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>1 adet Araç veya Mülk İlanı</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Kesintisiz 7 Gün Aktif Yayın</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Satıcı: <strong>Aktif Karakter (Bireysel)</strong></span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Hesabım → İlanlarım Üzerinden Yönetim</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Arama ve Kategori Sayfalarında Listelenme</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Favorilere Eklenebilme & Sayaç</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3 pt-4 border-t border-[var(--border-app)]">
          <button
            type="button"
            onClick={handleSelectIndividual}
            disabled={Boolean(loadingPkg)}
            className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            {loadingPkg === 'individual' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ödeme Başlatılıyor...</span>
              </>
            ) : (
              <>
                <span>Bireysel İlan Satın Al ({formatCurrency(individualPrice)})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
            <span>Ödeme sonrası anında ilan oluşturmaya başlarsınız.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
