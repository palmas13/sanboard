'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Check, ShieldCheck, ArrowRight, Loader2, Sparkles, Building2, User, Crown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export default function IlanPaketSecPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated } = useAuth();
  const [loadingPkg, setLoadingPkg] = useState<'individual' | 'corporate' | null>(null);
  const [error, setError] = useState('');

  const individualPrice = 2000;
  const corporatePrice = 1750;

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

  const handleSelectCorporate = async () => {
    if (!isAuthenticated || !currentProfile) {
      router.push('/giris?redirect=/ilan-ver/paket');
      return;
    }

    setLoadingPkg('corporate');
    setError('');

    try {
      // 1. Authoritative Server-Side Eligibility Verification (Section 1 & 3)
      const res = await fetch(`/api/dealers/eligibility?profileId=${currentProfile.id}`);
      const data = await res.json();

      if (!res.ok || !data.eligible) {
        const reason = data.reason || 'NO_STORE';
        if (reason === 'STORE_SUSPENDED') {
          setError(data.message || 'Kurumsal mağazanız askıya alınmıştır. Kurumsal ilan satın alamazsınız.');
          setLoadingPkg(null);
          setTimeout(() => {
            router.push('/hesabim/kurumsal?state=SUSPENDED');
          }, 1500);
          return;
        }

        // All non-eligible reasons redirect to corporate management view with appropriate state
        router.push(`/hesabim/kurumsal?state=${reason}`);
        return;
      }

      // 2. Only when eligible (ACTIVE) -> continue to CORPORATE $1,750 listing checkout
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          packageCode: 'CORPORATE_14_DAY',
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Kurumsal sipariş oluşturulamadı.');

      router.push(`/odeme/${checkoutData.orderId}`);
    } catch (err: any) {
      setError(err.message || 'Kurumsal ödeme başlatılamadı.');
      setLoadingPkg(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Şeffaf & Avantajlı Fiyatlandırma</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
          İlan Türünü ve Paketini Seç
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-xl mx-auto">
          İlanınızı bireysel olarak yayınlayabilir veya kurumsal mağazanızın avantajlı tarifesiyle öne çıkarabilirsiniz.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold border border-[rgba(229,72,77,0.3)] text-center">
          {error}
        </div>
      )}

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* CARD 1: Bireysel / Standart İlan */}
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
              className="w-full btn-secondary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer hover:border-[#FF8A1F]"
            >
              {loadingPkg === 'individual' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ödeme Başlatılıyor...</span>
                </>
              ) : (
                <>
                  <span>Bireysel İlan Yayınla ({formatCurrency(individualPrice)})</span>
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

        {/* CARD 2: Kurumsal İlan */}
        <div className="surface-card rounded-2xl border-2 border-[#FF8A1F] p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between space-y-6 bg-gradient-to-b from-[var(--bg-surface)] via-[var(--brand-orange-subtle)]/5 to-[var(--bg-surface)]">
          <div className="absolute -top-3.5 right-6 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white text-[11px] font-black shadow-md tracking-wider uppercase">
            ÖZEL FİYAT & 14 GÜN
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-orange-subtle)] text-[#FF8A1F] text-xs font-bold border border-[#FF8A1F]/30">
                <Crown className="w-3.5 h-3.5 fill-current" />
                <span>KURUMSAL İLAN</span>
              </span>
              <span className="text-[11px] font-bold text-amber-400">2 Kat Süre / İndirimli</span>
            </div>

            <div className="space-y-2 border-b border-[var(--border-app)] pb-5">
              <h3 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                <span>14 Günlük Kurumsal İlan</span>
              </h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-[#FF8A1F] tracking-tight">
                  {formatCurrency(corporatePrice)}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-semibold">/ 14 gün</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                İşletmenizin kurumsal kimliği ve güvencesiyle mağazanız altında yayınlanır.
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
                <span><strong>Kesintisiz 14 Gün Aktif Yayın</strong> (2 Kat Süre)</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Satıcı: <strong>Kurumsal Mağaza (Şirket İsmi)</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Kurumsal Mağaza Vitrininde Otomatik Listelenme</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Mağazanızı Takip Edenlere <strong>Anlık Bildirim</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Doğrulanmış Kurumsal Üye Rozeti</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--border-app)]">
            <button
              type="button"
              onClick={handleSelectCorporate}
              disabled={Boolean(loadingPkg)}
              className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              {loadingPkg === 'corporate' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mağaza Durumu Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <span>Kurumsal İlan Satın Al ({formatCurrency(corporatePrice)})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-dim)]">
              <Building2 className="w-3.5 h-3.5 text-[#FF8A1F]" />
              <span>Yalnızca aktif kurumsal üyeliği bulunan karakterler yararlanabilir.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
