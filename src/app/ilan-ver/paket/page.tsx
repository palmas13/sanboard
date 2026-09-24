'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Check, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default function IlanPaketSecPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const packagePrice = 2000;

  const handleSelectPackage = async () => {
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver/paket');
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Şeffaf & Sabit Fiyatlandırma</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
          İlan Paketini Seç
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-lg mx-auto">
          San Andreas genelinde binlerce oyuncuya ulaşmak için standart ilan paketini satın al ve anında ilanını yayınla.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold border border-[rgba(229,72,77,0.3)] text-center">
          {error}
        </div>
      )}

      {/* Package Card */}
      <div className="max-w-md mx-auto surface-card rounded-2xl border-2 border-[#FF8A1F] p-8 shadow-2xl relative space-y-6">
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#FF8A1F] text-white text-xs font-extrabold shadow-md tracking-wider">
          STANDART YAYIN
        </div>

        <div className="text-center space-y-2 pt-2 border-b border-[var(--border-app)] pb-6">
          <h3 className="text-xl font-bold text-[var(--text-main)]">
            7 Günlük Standart İlan
          </h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-black text-[#FF8A1F] tracking-tight">
              {formatCurrency(packagePrice)}
            </span>
            <span className="text-xs text-[var(--text-muted)]">/ 7 gün</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            GTA World oyun içi Fleeca hesabınızdan tahsil edilir.
          </p>
        </div>

        {/* Feature List */}
        <ul className="space-y-3.5 text-sm text-[var(--text-main)]">
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
            <span>Maksimum 3 Fotoğraf & Vitrin Seçimi</span>
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
          <li className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span>Yayın Süresi Boyunca Ücretsiz Düzenleme</span>
          </li>
        </ul>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSelectPackage}
            disabled={loading}
            className="w-full btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ödeme Başlatılıyor...</span>
              </>
            ) : (
              <>
                <span>Paketi Satın Al</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-dim)] pt-2 border-t border-[var(--border-app)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
          <span>Ödeme başarılı olduktan sonra ilan hakkınız hesabınıza tanımlanır.</span>
        </div>
      </div>
    </div>
  );
}
