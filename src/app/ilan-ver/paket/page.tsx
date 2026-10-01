'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Check, Clock3, Loader2, RefreshCw, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveAvatarUrl, resolveMediaUrl } from '@/lib/media/url';
import { formatCurrency } from '@/lib/utils/format';
import type { ListingPackageOptions } from '@/lib/listings/package-options';

type LoadingAction = 'individual-buy' | 'individual-use' | 'corporate-buy' | 'corporate-use' | null;

const individualFeatures = ['1 araç veya mülk ilanı', '7 gün aktif yayın', 'Kişisel satıcı kimliği', 'Hesabım üzerinden ilan yönetimi', 'Arama ve kategori görünürlüğü', 'Favori desteği'];
const corporateFeatures = ['1 araç veya mülk ilanı', '14 gün aktif yayın', 'Kurumsal mağaza kimliği', 'Kurumsal panelden ilan yönetimi', 'Arama ve kategori görünürlüğü', 'Favori desteği'];

function PackageSkeleton() {
  return <div className="grid gap-5 lg:grid-cols-2" aria-label="İlan seçenekleri yükleniyor">
    {[0, 1].map((item) => <div key={item} className="surface-card animate-pulse rounded-2xl border border-[var(--border-app)] p-6 sm:p-7">
      <div className="h-6 w-32 rounded-full bg-[var(--bg-surface-secondary)]" />
      <div className="mt-7 h-5 w-44 rounded bg-[var(--bg-surface-secondary)]" />
      <div className="mt-4 h-10 w-56 rounded bg-[var(--bg-surface-secondary)]" />
      <div className="mt-7 space-y-3">{[0, 1, 2, 3].map((row) => <div key={row} className="h-4 rounded bg-[var(--bg-surface-secondary)]" />)}</div>
      <div className="mt-8 h-12 rounded-xl bg-[var(--bg-surface-secondary)]" />
    </div>)}
  </div>;
}

function FeatureList({ items }: { items: string[] }) {
  return <ul className="grid gap-3 text-xs text-[var(--text-main)] sm:grid-cols-2 sm:text-sm lg:grid-cols-1 xl:grid-cols-2">
    {items.map((item) => <li key={item} className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)]"><Check className="h-3.5 w-3.5" /></span>
      <span>{item}</span>
    </li>)}
  </ul>;
}

export default function IlanPaketSecPage() {
  const router = useRouter();
  const { currentProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const [options, setOptions] = useState<ListingPackageOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [error, setError] = useState('');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/listing-package-options', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'İlan hakları yüklenemedi.');
      setOptions(data);
    } catch (loadError: any) {
      setOptions(null);
      setError(loadError.message || 'İlan hakları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !currentProfile) {
      router.replace('/giris?redirect=/ilan-ver/paket');
      return;
    }
    void loadOptions();
  }, [authLoading, currentProfile, isAuthenticated, loadOptions, router]);

  const startCheckout = async (kind: 'individual' | 'corporate') => {
    if (!options) return;
    const corporate = kind === 'corporate';
    setLoadingAction(corporate ? 'corporate-buy' : 'individual-buy');
    setError('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${corporate ? 'corporate-listing-credit' : 'listing-credit'}:${corporate ? options.corporate?.dealer.id : options.profile.id}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ packageCode: corporate ? 'CORPORATE_14_DAY' : 'STANDARD_7_DAY' }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'ENTITLEMENT_AVAILABLE') {
        await loadOptions();
        throw new Error(data.error);
      }
      if (!response.ok) throw new Error(data.error || 'Ödeme sayfası başlatılamadı.');
      window.location.assign(data.paymentLink);
    } catch (checkoutError: any) {
      setError(checkoutError.message || 'Ödeme sayfası başlatılamadı.');
      setLoadingAction(null);
    }
  };

  const handleUseCredit = (kind: 'individual' | 'corporate') => {
    setLoadingAction(kind === 'corporate' ? 'corporate-use' : 'individual-use');
    router.push(kind === 'corporate' ? '/ilan-ver/yeni?corporate=true' : '/ilan-ver/yeni');
  };

  const individualAvatar = resolveAvatarUrl(options?.profile.avatar_path || options?.profile.avatar_url);
  const corporateLogo = resolveMediaUrl(options?.corporate?.dealer.logo_path || options?.corporate?.dealer.logo_url);

  return <main className="mx-auto w-full max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
    <section className="relative overflow-hidden rounded-3xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-5 py-7 sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#FF8A1F]/8 blur-3xl" />
      <div className="relative max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] px-3 py-1 text-[11px] font-bold text-[#FF9E45]"><Sparkles className="h-3.5 w-3.5" /><span>PROFİL VE İLAN HAKKI SEÇİMİ</span></div>
        <div className="space-y-2"><h1 className="text-3xl font-black tracking-tight text-[var(--text-main)] sm:text-4xl">İlan Vermeye Başla</h1><p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">İlanını hangi profil altında yayınlayacağını seç ve mevcut ilan haklarını kullan.</p></div>
        {options && <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <span className="rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-3 py-2">{options.individual.availableCredits} bireysel ilan hakkı</span>
          {options.corporate && <span className="rounded-lg border border-[#FF8A1F]/20 bg-[#FF8A1F]/8 px-3 py-2 text-[#FFAE63]">{options.corporate.availableCredits} kurumsal ilan hakkı</span>}
        </div>}
      </div>
    </section>

    {error && <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[rgba(229,72,77,0.3)] bg-[var(--color-danger-subtle)] p-3.5 text-xs font-semibold text-[var(--color-danger)]"><span>{error}</span><button type="button" onClick={() => void loadOptions()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"><RefreshCw className="h-3.5 w-3.5" /> Yenile</button></div>}

    <section className="mt-7" aria-labelledby="package-options-title">
      <div className="mb-4 flex items-center gap-3"><div className="h-px flex-1 bg-[var(--border-app)]" /><h2 id="package-options-title" className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">Yayınlama Kimliğini Seç</h2><div className="h-px flex-1 bg-[var(--border-app)]" /></div>
      {loading || authLoading ? <PackageSkeleton /> : options ? <div className={options.corporate ? 'grid gap-5 lg:grid-cols-2' : 'mx-auto grid max-w-2xl gap-5'}>
        <article className="surface-card group flex min-w-0 flex-col rounded-2xl border border-[var(--border-app)] p-5 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-[#FF8A1F]/40 sm:p-7">
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] px-3 py-1 text-[11px] font-black text-[var(--text-main)]"><User className="h-3.5 w-3.5 text-[#FF8A1F]" /> BİREYSEL İLAN</span><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-dim)]"><Clock3 className="h-3.5 w-3.5" /> 7 gün</span></div>
          <div className="mt-6 flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3">
            {individualAvatar ? <img src={individualAvatar} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><User className="h-5 w-5" /></span>}
            <div className="min-w-0"><p className="text-[11px] font-semibold text-[var(--text-dim)]">Aktif karakter</p><p className="truncate text-sm font-bold text-[var(--text-main)]">{options.profile.full_name}</p></div>
          </div>
          <div className="mt-6 border-b border-[var(--border-app)] pb-6"><h3 className="text-xl font-black text-[var(--text-main)]">7 Günlük Standart İlan</h3><div className="mt-3">{options.individual.action === 'USE' ? <p className="text-2xl font-black text-[var(--color-success)]">{options.individual.availableCredits || 1} İlan Hakkın Var</p> : <div className="flex items-baseline gap-2"><span className="text-4xl font-black text-[var(--text-main)]">{formatCurrency(1)}</span><span className="text-sm font-semibold text-[var(--text-muted)]">/ 7 gün</span></div>}</div><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">İlan, aktif karakterinizin kişisel satıcı kimliği altında yayınlanır.</p></div>
          <div className="flex-1 py-6"><FeatureList items={individualFeatures} /></div>
          <button type="button" disabled={Boolean(loadingAction)} onClick={() => options.individual.action === 'USE' ? handleUseCredit('individual') : void startCheckout('individual')} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-bold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] disabled:opacity-60">{loadingAction?.startsWith('individual') ? <Loader2 className="h-4 w-4 animate-spin" /> : options.individual.action === 'USE' ? <Check className="h-4 w-4" /> : null}<span>{options.individual.action === 'USE' ? 'İlan Hakkını Kullan' : `Bireysel İlan Satın Al (${formatCurrency(1)})`}</span>{!loadingAction?.startsWith('individual') && <ArrowRight className="h-4 w-4" />}</button>
        </article>

        {options.corporate && <article className="surface-card group flex min-w-0 flex-col rounded-2xl border border-[#FF8A1F]/30 p-5 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-[#FF8A1F]/60 sm:p-7">
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] px-3 py-1 text-[11px] font-black text-[#FF9E45]"><Building2 className="h-3.5 w-3.5" /> KURUMSAL İLAN</span><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" /> Aktif üyelik</span></div>
          <div className="mt-6 flex min-w-0 items-center gap-3 rounded-xl border border-[#FF8A1F]/20 bg-[#FF8A1F]/6 p-3">
            {corporateLogo ? <img src={corporateLogo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><Building2 className="h-5 w-5" /></span>}
            <div className="min-w-0"><p className="text-[11px] font-semibold text-[var(--text-dim)]">Kurumsal mağaza</p><p className="truncate text-sm font-bold text-[var(--text-main)]">{options.corporate.dealer.company_name}</p></div>
          </div>
          <div className="mt-6 border-b border-[var(--border-app)] pb-6"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black text-[var(--text-main)]">14 Günlük Kurumsal İlan</h3><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-dim)]"><Clock3 className="h-3.5 w-3.5" /> 14 gün</span></div><div className="mt-3">{options.corporate.action === 'USE' ? <p className="text-2xl font-black text-[var(--color-success)]">{options.corporate.availableCredits || 1} Kurumsal İlan Hakkın Var</p> : <div className="flex items-baseline gap-2"><span className="text-4xl font-black text-[var(--text-main)]">{formatCurrency(1)}</span><span className="text-sm font-semibold text-[var(--text-muted)]">/ 14 gün</span></div>}</div><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">İlan, kurumsal profilinizin mağaza kimliği altında yayınlanır.</p></div>
          <div className="flex-1 py-6"><FeatureList items={corporateFeatures} /></div>
          <button type="button" disabled={Boolean(loadingAction)} onClick={() => options.corporate?.action === 'USE' ? handleUseCredit('corporate') : void startCheckout('corporate')} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-bold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] disabled:opacity-60">{loadingAction?.startsWith('corporate') ? <Loader2 className="h-4 w-4 animate-spin" /> : options.corporate.action === 'USE' ? <Check className="h-4 w-4" /> : null}<span>{options.corporate.action === 'USE' ? 'Kurumsal İlan Hakkını Kullan' : `Kurumsal İlan Hakkı Satın Al (${formatCurrency(1)})`}</span>{!loadingAction?.startsWith('corporate') && <ArrowRight className="h-4 w-4" />}</button>
        </article>}
      </div> : null}
    </section>
    <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-[var(--text-dim)]"><ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-success)]" /><span>Mevcut ilan hakkı varsa ödeme açılmaz; hak yalnız ilan yayınlandığında kanonik akış tarafından kullanılır.</span></div>
  </main>;
}