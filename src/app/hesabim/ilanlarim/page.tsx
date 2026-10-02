'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Clock, Edit3, ExternalLink, Heart, ImageIcon, ListPlus, Loader2, MoreHorizontal, RotateCcw, Search, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { formatCurrency, formatDate, formatTimeRemaining } from '@/lib/utils/format';
import type { Listing } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { getListingCoverPath } from '@/lib/listings/images';
import { calculateListingQuality, type ListingQualityInput } from '@/lib/listings/quality';
import { filterOwnerDashboardListings, getOwnerDashboardCounts, type OwnerDashboardStatus, type OwnerDashboardType } from '@/lib/listings/owner-dashboard';

type SavedListingDraft = ListingQualityInput & { savedAt?: string; images?: unknown[] };
const STATUS_TABS: Array<{ value: OwnerDashboardStatus; label: string }> = [{ value: 'ACTIVE', label: 'Aktif' }, { value: 'EXPIRED', label: 'Süresi Dolan' }, { value: 'SOLD', label: 'Satılan' }];
const EMPTY_COPY: Record<OwnerDashboardStatus, string> = { ACTIVE: 'Aktif ilan bulunmuyor.', EXPIRED: 'Süresi dolan ilan bulunmuyor.', SOLD: 'Satılan ilan bulunmuyor.' };

function StatusBadge({ status }: { status: OwnerDashboardStatus }) {
  const style = status === 'ACTIVE' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : status === 'EXPIRED' ? 'border-white/10 bg-white/[0.04] text-[var(--text-muted)]' : 'border-blue-400/20 bg-blue-400/10 text-blue-300';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${style}`}>{status === 'ACTIVE' ? 'Aktif' : status === 'EXPIRED' ? 'Süresi Doldu' : 'Satıldı'}</span>;
}

export default function HesabimIlanlarimPage() {
  const { currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<OwnerDashboardStatus>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<OwnerDashboardType>('ALL');
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [closeModalListing, setCloseModalListing] = useState<Listing | null>(null);
  const [closeReason, setCloseReason] = useState<'SOLD' | 'CANCELLED' | 'OTHER'>('SOLD');
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [republishingId, setRepublishingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [activeOfferCount, setActiveOfferCount] = useState(0);
  const [savedDraft, setSavedDraft] = useState<{ quality: number; savedAt?: string; href: string; storageKey: string } | null>(null);
  const [clearHistoryStatus, setClearHistoryStatus] = useState<'EXPIRED' | 'SOLD' | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  const fetchListings = useCallback(async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const response = await fetch('/api/user/listings', { cache: 'no-store' });
      const data = await response.json();
      if (Array.isArray(data)) setListings(data);
    } catch { setActionError('İlanlar yüklenemedi. Lütfen tekrar deneyin.'); }
    finally { setLoading(false); }
  }, [currentProfile]);

  useEffect(() => { void fetchListings(); }, [fetchListings]);
  useEffect(() => {
    if (!currentProfile) return;
    const keys = [`sanboard_listing_draft_v2_${currentProfile.id}_individual`, `sanboard_listing_draft_v2_${currentProfile.id}_corporate`];
    const drafts = keys.flatMap((key) => {
      try {
        const raw = localStorage.getItem(key); if (!raw) return [];
        const draft = JSON.parse(raw) as SavedListingDraft;
        const result = calculateListingQuality({ ...draft, imageCount: Array.isArray(draft.images) ? draft.images.length : 0, hasContact: Boolean(currentProfile.phone?.trim() || currentProfile.sanmail_email?.trim()) });
        return [{ quality: result.percentage, savedAt: draft.savedAt, href: key.endsWith('_corporate') ? '/ilan-ver/yeni?corporate=true' : '/ilan-ver/yeni', storageKey: key }];
      } catch { return []; }
    });
    setSavedDraft(drafts.sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())[0] || null);
  }, [currentProfile]);
  useEffect(() => {
    if (!openMenuId) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [openMenuId]);

  const counts = useMemo(() => getOwnerDashboardCounts(listings), [listings]);
  const filteredListings = useMemo(() => filterOwnerDashboardListings(listings, { status: activeTab, type: typeFilter, query }), [activeTab, listings, query, typeFilter]);
  const totalFavorites = useMemo(() => listings.reduce((total, listing) => total + (listing.favorite_count || 0), 0), [listings]);
  const hasFilters = Boolean(query.trim()) || typeFilter !== 'ALL';

  const openCloseModal = async (listing: Listing) => {
    setOpenMenuId(null); setCloseReason('SOLD'); setCloseModalListing(listing);
    const response = await fetch(`/api/offers?listingId=${encodeURIComponent(listing.id)}`);
    const data = await response.json().catch(() => ({}));
    setActiveOfferCount(response.ok ? Number(data.activeCount || 0) : 0);
  };
  const handleConfirmClose = async () => {
    if (!closeModalListing || !currentProfile) return;
    setIsProcessingClose(true); setActionError('');
    try {
      const response = await fetch('/api/user/listings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: closeModalListing.id, action: closeReason === 'SOLD' ? 'SOLD' : 'REMOVED', closeReason }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'İlan kapatılamadı.');
      setCloseModalListing(null); await fetchListings();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'İlan kapatılamadı.'); }
    finally { setIsProcessingClose(false); }
  };
  const handleRepublish = async (listing: Listing) => {
    setRepublishingId(listing.id); setActionError('');
    try {
      const response = await fetch('/api/user/listings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: listing.id, action: 'REPUBLISH' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'İlan yeniden yayınlanamadı.');
      await fetchListings(); setActiveTab('ACTIVE');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'İlan yeniden yayınlanamadı.'); }
    finally { setRepublishingId(null); }
  };
  const clearHistory = async () => {
    if (!clearHistoryStatus) return;
    setClearingHistory(true); setActionError('');
    try {
      const response = await fetch('/api/user/listings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: clearHistoryStatus }) });
      const data = await response.json().catch(() => ({})); if (!response.ok || !data.success) throw new Error(data.error || 'Liste temizlenemedi.');
      setListings((current) => current.filter((listing) => listing.status !== clearHistoryStatus)); setClearHistoryStatus(null);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Liste temizlenemedi.'); }
    finally { setClearingHistory(false); }
  };
  const handleDeleteDraft = () => {
    if (!savedDraft || !window.confirm('Bu taslağı silmek istediğinize emin misiniz?')) return;
    localStorage.removeItem(savedDraft.storageKey); setSavedDraft(null);
  };

  return <div className="space-y-5">
    <header className="surface-card rounded-2xl border border-[var(--border-app)] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-black tracking-tight text-[var(--text-main)] sm:text-2xl">İlanlarım</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Aktif ve geçmiş ilanlarını buradan yönetebilirsin.</p>{!loading && listings.length > 0 && <p className="mt-2 text-xs font-semibold text-[var(--text-dim)]">{counts.ACTIVE} aktif ilan · Toplam {totalFavorites} favori</p>}</div><Link href="/ilan-ver" className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs"><ListPlus className="h-4 w-4" />Yeni İlan Ver</Link></div></header>

    <section className="surface-card rounded-2xl border border-[var(--border-app)] p-3 sm:p-4" aria-label="İlan filtreleri"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1 sm:max-w-md"><span className="sr-only">İlanlarda ara</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Başlık, ilan no veya kategori ara..." className="h-10 w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] pl-9 pr-3 text-xs text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[#FF8A1F]/60" /></label><div className="flex rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-1" aria-label="İlan türü">{([['ALL', 'Tümü'], ['vehicle', 'Araç'], ['property', 'Mülk']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTypeFilter(value)} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none ${typeFilter === value ? 'bg-[var(--bg-surface)] text-[#FF9E45] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{label}</button>)}</div></div><div className="overflow-x-auto pb-1 lg:pb-0"><div className="flex min-w-max rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-1" role="tablist" aria-label="İlan durumu">{STATUS_TABS.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => setActiveTab(tab.value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === tab.value ? 'bg-[var(--bg-surface)] text-[#FF9E45] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{tab.label} ({counts[tab.value]})</button>)}</div></div></div></section>

    {savedDraft && <div className="surface-card flex flex-col gap-3 rounded-2xl border border-[#FF8A1F]/25 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[var(--text-main)]">Kaydedilmiş ilan taslağın var</p><p className="text-xs text-[var(--text-muted)]">%{savedDraft.quality} tamamlandı{savedDraft.savedAt ? ` · ${formatDate(savedDraft.savedAt)}` : ''}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={handleDeleteDraft} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" />Taslağı Sil</button><Link href={savedDraft.href} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs"><Edit3 className="h-3.5 w-3.5" />Düzenlemeye Devam Et</Link></div></div>}
    {!loading && (activeTab === 'EXPIRED' || activeTab === 'SOLD') && counts[activeTab] > 0 && <div className="flex justify-end"><button type="button" onClick={() => setClearHistoryStatus(activeTab)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" />Listeyi Temizle</button></div>}

    {loading ? <div className="surface-card flex items-center justify-center gap-2 rounded-2xl p-12 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin text-[#FF8A1F]" />İlanlar yükleniyor...</div> : listings.length === 0 ? <div className="surface-card rounded-2xl p-10 text-center"><ListPlus className="mx-auto h-8 w-8 text-[var(--text-dim)]" /><h2 className="mt-3 text-sm font-bold text-[var(--text-main)]">Henüz ilan vermedin.</h2><Link href="/ilan-ver" className="btn-primary mt-4 inline-flex px-4 py-2 text-xs">İlan Ver</Link></div> : filteredListings.length === 0 ? <div className="surface-card rounded-2xl p-10 text-center"><Clock className="mx-auto h-8 w-8 text-[var(--text-dim)]" /><h2 className="mt-3 text-sm font-bold text-[var(--text-main)]">{hasFilters ? 'Bu filtreye uygun ilan bulunamadı.' : EMPTY_COPY[activeTab]}</h2></div> : <div className="space-y-2.5">{filteredListings.map((listing) => {
      const cover = resolveMediaUrl(getListingCoverPath(listing.images)); const remaining = formatTimeRemaining(listing.expires_at); const isActive = listing.status === 'ACTIVE'; const isExpired = listing.status === 'EXPIRED';
      return <article key={listing.id} data-testid="personal-listing-card" className="group rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[#FF8A1F]/30 hover:bg-[var(--bg-surface-secondary)]/30"><div className="grid gap-3 sm:grid-cols-[128px_minmax(0,1fr)] lg:grid-cols-[144px_minmax(0,1fr)_auto] lg:items-center"><div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] sm:aspect-auto sm:h-24">{cover ? <Image src={cover} alt={`${listing.title} kapak görseli`} fill sizes="(max-width: 639px) calc(100vw - 4rem), (max-width: 1023px) 128px, 144px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-[var(--text-dim)]"><ImageIcon className="h-6 w-6" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="badge-tag px-2 py-0.5 text-[9px]">{listing.subcategory}</span><span className="text-[10px] font-semibold text-[var(--text-dim)]">{listing.listing_number}</span><span className="lg:hidden"><StatusBadge status={listing.status as OwnerDashboardStatus} /></span></div><h2 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-[var(--text-main)] sm:text-base">{listing.title}</h2><p className="mt-1 text-lg font-black tracking-tight text-[#FF9E45]">{formatCurrency(listing.price)}</p><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--text-muted)]"><span className={`inline-flex items-center gap-1 ${isActive ? 'text-emerald-300' : ''}`}><Clock className="h-3.5 w-3.5" />{isActive ? remaining.text : isExpired ? `Süresi doldu${listing.expires_at ? `: ${formatDate(listing.expires_at)}` : ''}` : `Kapanış: ${formatDate(listing.closed_at || listing.updated_at)}`}</span><span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-[#FF8A1F]" />{listing.favorite_count || 0} favori</span></div></div><div className="flex items-center justify-between gap-2 border-t border-[var(--border-app)] pt-3 sm:col-span-2 lg:col-span-1 lg:border-0 lg:pt-0"><span className="hidden lg:inline-flex"><StatusBadge status={listing.status as OwnerDashboardStatus} /></span><div className="ml-auto flex items-center gap-2">{isExpired && <button type="button" onClick={() => void handleRepublish(listing)} disabled={republishingId === listing.id} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[#FF9E45]">{republishingId === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Yeniden Yayınla</button>}<Link href={getListingUrl(listing)} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs"><ExternalLink className="h-3.5 w-3.5" />İlanı Gör</Link>{isActive && <div className="relative" ref={openMenuId === listing.id ? menuRef : undefined}><button type="button" aria-label={`${listing.title} yönetim menüsünü aç`} aria-haspopup="menu" aria-expanded={openMenuId === listing.id} onClick={() => setOpenMenuId((current) => current === listing.id ? null : listing.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-app)] text-[var(--text-muted)] transition-colors hover:border-[#FF8A1F]/40 hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/60"><MoreHorizontal className="h-4 w-4" /></button>{openMenuId === listing.id && <div role="menu" className="absolute bottom-full right-0 z-20 mb-2 w-44 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-1.5 shadow-2xl"><Link role="menuitem" href={`/hesabim/ilanlarim/${listing.id}/duzenle`} onClick={() => setOpenMenuId(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)]"><Edit3 className="h-3.5 w-3.5" />Düzenle</Link><div className="my-1 border-t border-[var(--border-app)]" /><button type="button" role="menuitem" onClick={() => void openCloseModal(listing)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-400/10"><XCircle className="h-3.5 w-3.5" />İlanı Kapat</button></div>}</div>}</div></div></div></article>;
    })}</div>}

    {actionError && <div className="rounded-xl bg-[var(--color-danger-subtle)] p-3 text-xs font-semibold text-[var(--color-danger)]">{actionError}</div>}
    {closeModalListing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="close-listing-title"><div className="surface-card w-full max-w-md rounded-2xl border border-[var(--color-danger)]/40 p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)]"><AlertTriangle className="h-5 w-5" /></div><div><h3 id="close-listing-title" className="font-extrabold text-[var(--text-main)]">İlanı hangi nedenle kapatmak istiyorsun?</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">İlan yayından kalıcı olarak kaldırılacak, fotoğrafları ve favorileri temizlenecektir. <strong className="text-[var(--color-danger)]">Bu işlem geri alınamaz.</strong></p></div></div><div className="mt-5 truncate rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3 text-xs font-semibold text-[var(--text-main)]">{closeModalListing.title}</div>{activeOfferCount > 0 && <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">Bu ilan için {activeOfferCount} aktif teklif bulunuyor. İlanı kaldırırsanız bu tekliflerin tamamı kapatılacak.</p>}<div className="mt-4 grid gap-2">{([['SOLD', 'Satıldı'], ['CANCELLED', 'Satıştan vazgeçildi'], ['OTHER', 'Diğer nedenle kapat']] as const).map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3 text-xs font-semibold text-[var(--text-main)]"><input type="radio" name="closeReason" checked={closeReason === value} onChange={() => setCloseReason(value)} className="accent-[#FF8A1F]" />{label}</label>)}</div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--border-app)] pt-4"><button type="button" onClick={() => setCloseModalListing(null)} disabled={isProcessingClose} className="btn-secondary px-4 py-2 text-xs">Vazgeç</button><button type="button" onClick={() => void handleConfirmClose()} disabled={isProcessingClose} className="btn-danger inline-flex items-center gap-1.5 px-4 py-2 text-xs">{isProcessingClose ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}İlanı Kapat</button></div></div></div>}
    {clearHistoryStatus && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-listing-history-title"><div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl"><h3 id="clear-listing-history-title" className="text-lg font-bold text-[var(--text-main)]">Listeyi görünümden temizle?</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{clearHistoryStatus === 'SOLD' ? 'Satılan' : 'Süresi dolan'} ilanlar yalnızca bu karakter profilinin görünümünden kaldırılır. Aktif ilanlar, diğer karakterler ve denetim kayıtları etkilenmez.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setClearHistoryStatus(null)} disabled={clearingHistory} className="btn-secondary px-4 py-2 text-xs">Vazgeç</button><button type="button" onClick={() => void clearHistory()} disabled={clearingHistory} className="btn-danger px-4 py-2 text-xs">{clearingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Listeyi Temizle'}</button></div></div></div>}
  </div>;
}