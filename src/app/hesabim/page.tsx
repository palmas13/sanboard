'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, Clock3, CreditCard, Heart, ImageIcon, ListPlus, Store, UserRound } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getCreditPresentation } from '@/lib/dashboard/credit-presentation';
import { resolveAvatarUrl, resolveMediaUrl } from '@/lib/media/url';
import { formatTimeRemaining } from '@/lib/utils/format';
import { getListingUrl } from '@/lib/urls';

type UpcomingPersonalListing = { id: string; public_id: string | null; title: string; expires_at: string; cover_image: string | null };
type OverviewData = { activeListings: number; favoritesCount: number; individualCredits: number; corporateCredits: number; upcomingPersonalListings: UpcomingPersonalListing[] };
const EMPTY_DATA: OverviewData = { activeListings: 0, favoritesCount: 0, individualCredits: 0, corporateCredits: 0, upcomingPersonalListings: [] };
const cardLinkClass = 'group inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]';

export default function HesabimOverviewPage() {
  const { currentProfile } = useAuth();
  const [data, setData] = useState<OverviewData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!currentProfile?.id) return;
    const controller = new AbortController();
    setLoading(true);
    setAvatarError(false);
    fetch('/api/account/bootstrap', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!result?.success) return;
        setData({
          activeListings: result.stats?.activeListings || 0,
          favoritesCount: result.stats?.favoritesCount || 0,
          individualCredits: result.credits?.individualCredits || 0,
          corporateCredits: result.credits?.corporateCredits || 0,
          upcomingPersonalListings: Array.isArray(result.upcomingPersonalListings) ? result.upcomingPersonalListings : [],
        });
      })
      .catch((error) => { if (error?.name !== 'AbortError') setData(EMPTY_DATA); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currentProfile?.id]);

  const firstName = currentProfile?.full_name?.split(' ')[0] || 'Kullanıcı';
  const avatar = resolveAvatarUrl(currentProfile?.avatar_path || currentProfile?.avatar_url);
  const credits = getCreditPresentation(data.individualCredits, data.corporateCredits);
  const nearestExpiry = data.upcomingPersonalListings[0]?.expires_at;

  return <div className="space-y-5">
    <header className="surface-card rounded-2xl border border-[var(--border-app)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          {avatar && !avatarError ? <Image src={avatar} alt={`${currentProfile?.full_name || firstName} profil fotoğrafı`} width={52} height={52} onError={() => setAvatarError(true)} className="h-[52px] w-[52px] shrink-0 rounded-full border-2 border-[#FF8A1F]/55 object-cover" /> : <div aria-label={`${currentProfile?.full_name || firstName} profil görseli`} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-[#FF8A1F]/25 bg-[var(--brand-orange-subtle)] text-lg font-black text-[#FF9D45]">{firstName.charAt(0).toLocaleUpperCase('tr-TR')}</div>}
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF9D45]">Kişisel hesap</p><h1 className="mt-0.5 truncate text-lg font-black tracking-tight text-[var(--text-main)] sm:text-xl">Merhaba, {firstName} 👋</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">Kişisel ilanlarını, favorilerini ve ilan haklarını buradan yönetebilirsin.</p></div>
        </div>
        <Link href="/ilan-ver" className="btn-primary inline-flex w-full shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-xs sm:w-auto"><ListPlus className="h-4 w-4" />Yeni İlan Ver</Link>
      </div>
    </header>

    <section aria-label="Hesap özeti" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article className="surface-card rounded-2xl border border-emerald-500/20 p-4">
        <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ListPlus className="h-4 w-4" /></div><span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Aktif</span></div>
        <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Aktif Bireysel İlanlar</p>
        {loading ? <div className="mt-1 h-8 w-12 animate-pulse rounded-lg bg-[var(--bg-surface-secondary)]" /> : <p className="mt-1 text-3xl font-black tabular-nums text-[var(--text-main)]">{data.activeListings}</p>}
        <div className="mt-3 flex min-h-5 items-end justify-between gap-3"><p className="truncate text-[10px] text-[var(--text-dim)]">{!loading && nearestExpiry ? `En yakın süre: ${formatTimeRemaining(nearestExpiry).text}` : !loading && data.activeListings === 0 ? 'Aktif kişisel ilanın bulunmuyor.' : ''}</p><Link href="/hesabim/ilanlarim" className={cardLinkClass}>İlanları Yönet <ArrowRight className="h-3 w-3" /></Link></div>
      </article>

      <article className="surface-card rounded-2xl border border-[#FF8A1F]/25 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF9D45]"><CreditCard className="h-4 w-4" /></div><p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">İlan Hakların</p>
        {loading ? <div className="mt-1 h-[72px] animate-pulse rounded-xl bg-[var(--bg-surface-secondary)]" /> : <><p className="mt-1 text-3xl font-black tabular-nums text-[var(--text-main)]">{credits.total}</p><div className="mt-2 space-y-1.5 text-[11px] font-semibold"><div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-surface-secondary)]/55 px-2.5 py-1.5 text-[var(--text-muted)]"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />Bireysel ilan hakkı</span><strong className="tabular-nums text-[var(--text-main)]">{data.individualCredits}</strong></div>{data.corporateCredits > 0 && <div className="flex items-center justify-between gap-3 rounded-lg bg-[#FF8A1F]/[0.07] px-2.5 py-1.5 text-[var(--text-muted)]"><span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />Kurumsal ilan hakkı</span><strong className="tabular-nums text-[var(--text-main)]">{data.corporateCredits}</strong></div>}</div></>}
        <div className="mt-3 flex justify-end"><Link href={credits.href} className={cardLinkClass}>Hakkını Kullan <ArrowRight className="h-3 w-3" /></Link></div>
      </article>

      <article className="surface-card rounded-2xl border border-[var(--border-app)] p-4 sm:col-span-2 xl:col-span-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-[var(--text-muted)]"><Heart className="h-4 w-4" /></div><p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Favoriler</p>{loading ? <div className="mt-1 h-8 w-12 animate-pulse rounded-lg bg-[var(--bg-surface-secondary)]" /> : <p className="mt-1 text-3xl font-black tabular-nums text-[var(--text-main)]">{data.favoritesCount}</p>}<div className="mt-3 flex min-h-5 items-end justify-between gap-3"><p className="text-[10px] text-[var(--text-dim)]">{!loading && data.favoritesCount === 0 ? 'Henüz favori ilan yok.' : ''}</p><Link href="/hesabim/favorilerim" className={cardLinkClass}>Favorilere Git <ArrowRight className="h-3 w-3" /></Link></div>
      </article>
    </section>

    <section aria-labelledby="quick-actions-title"><h2 id="quick-actions-title" className="mb-2 text-sm font-black text-[var(--text-main)]">Hızlı İşlemler</h2><div className="grid gap-2 sm:grid-cols-3">
      <Link href="/hesabim/ilanlarim" className="surface-card surface-card-hover group flex items-center gap-3 rounded-xl border border-[var(--border-app)] px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><ListPlus className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[var(--text-main)]">İlanlarımı Yönet</strong><span className="block truncate text-[10px] text-[var(--text-muted)]">Kişisel ilanlarını kontrol et</span></span><ArrowRight className="h-3.5 w-3.5 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" /></Link>
      <Link href={credits.href} className="surface-card surface-card-hover group flex items-center gap-3 rounded-xl border border-[#FF8A1F]/20 px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-orange-subtle)] text-[#FF9D45]"><Building2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[var(--text-main)]">İlan Hakkını Kullan</strong><span className="block truncate text-[10px] text-[var(--text-muted)]">Mevcut hakkınla ilana başla</span></span><ArrowRight className="h-3.5 w-3.5 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" /></Link>
      <Link href="/hesabim/odemeler" className="surface-card surface-card-hover group flex items-center gap-3 rounded-xl border border-[var(--border-app)] px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-[var(--text-muted)]"><CreditCard className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[var(--text-main)]">Ödeme Geçmişi</strong><span className="block truncate text-[10px] text-[var(--text-muted)]">Ödemelerini ve haklarını incele</span></span><ArrowRight className="h-3.5 w-3.5 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" /></Link>
    </div></section>

    <section aria-labelledby="listing-status-title" className="surface-card rounded-2xl border border-[var(--border-app)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 id="listing-status-title" className="text-sm font-black text-[var(--text-main)]">Yaklaşan Durumlar</h2><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Süresi en yakın aktif bireysel ilanların</p></div><Link href="/hesabim/ilanlarim" className={cardLinkClass}>Tümünü Gör <ArrowRight className="h-3 w-3" /></Link></div>
      {loading ? <div className="space-y-2" aria-label="İlan durumları yükleniyor">{[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[var(--bg-surface-secondary)]" />)}</div> : data.upcomingPersonalListings.length === 0 ? <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/35 p-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold text-[var(--text-main)]">Yaklaşan aktif ilan bulunmuyor.</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Yeni bir kişisel ilan yayınlayarak burada takip edebilirsin.</p></div><Link href="/ilan-ver" className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-[11px]"><ListPlus className="h-3.5 w-3.5" />Yeni İlan Ver</Link></div> : <div className="divide-y divide-[var(--border-app)]">{data.upcomingPersonalListings.map((listing) => { const cover = resolveMediaUrl(listing.cover_image); const remaining = formatTimeRemaining(listing.expires_at); return <Link key={listing.id} href={getListingUrl(listing)} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]"><div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]">{cover ? <Image src={cover} alt={`${listing.title} kapak görseli`} fill sizes="64px" className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-[var(--text-dim)]" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[var(--text-main)] transition-colors group-hover:text-[#FF9D45]">{listing.title}</p><p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><Clock3 className="h-3 w-3" />{remaining.text}</p></div><span className="sr-only">İlanı görüntüle</span><ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF9D45]" /></Link>; })}</div>}
    </section>
  </div>;
}