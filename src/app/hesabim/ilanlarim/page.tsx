'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  ListPlus,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Loader2,
  Heart,
  Edit3,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatTimeRemaining, formatDate } from '@/lib/utils/format';
import { Listing } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { calculateListingQuality, ListingQualityInput } from '@/lib/listings/quality';

type SavedListingDraft = ListingQualityInput & { savedAt?: string; images?: unknown[] };

export default function HesabimIlanlarimPage() {
  const { currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'EXPIRED' | 'SOLD'>('ACTIVE');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const [closeModalListing, setCloseModalListing] = useState<Listing | null>(null);
  const [closeReason, setCloseReason] = useState<'SOLD' | 'CANCELLED' | 'OTHER'>('SOLD');
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const [republishingId, setRepublishingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [activeOfferCount, setActiveOfferCount] = useState(0);
  const [savedDraft, setSavedDraft] = useState<{ quality: number; savedAt?: string; href: string; storageKey: string } | null>(null);
  const [clearHistoryStatus, setClearHistoryStatus] = useState<'EXPIRED' | 'SOLD' | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  const fetchListings = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/listings');
      const data = await res.json();
      if (Array.isArray(data)) {
        setListings(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [currentProfile]);

  useEffect(() => {
    if (!currentProfile) return;
    const keys = [`sanboard_listing_draft_v2_${currentProfile.id}_individual`, `sanboard_listing_draft_v2_${currentProfile.id}_corporate`];
    const drafts = keys.flatMap((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const draft = JSON.parse(raw) as SavedListingDraft;
        const result = calculateListingQuality({ ...draft, imageCount: Array.isArray(draft.images) ? draft.images.length : 0, hasContact: Boolean(currentProfile.phone?.trim() || currentProfile.sanmail_email?.trim()) });
        return [{ quality: result.percentage, savedAt: draft.savedAt, href: key.endsWith('_corporate') ? '/ilan-ver/yeni?corporate=true' : '/ilan-ver/yeni', storageKey: key }];
      } catch { return []; }
    });
    setSavedDraft(drafts.sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())[0] || null);
  }, [currentProfile]);

  const activeListings = listings.filter((l) => l.status === 'ACTIVE');
  const expiredListings = listings.filter((l) => l.status === 'EXPIRED');
  const soldListings = listings.filter((l) => l.status === 'SOLD');

  const clearHistory = async () => {
    if (!clearHistoryStatus) return;
    setClearingHistory(true);
    setActionError('');
    try {
      const response = await fetch('/api/user/listings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: clearHistoryStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Liste temizlenemedi.');
      setListings((current) => current.filter((listing) => listing.status !== clearHistoryStatus));
      setClearHistoryStatus(null);
    } catch (error: any) {
      setActionError(error.message || 'Liste temizlenemedi.');
    } finally {
      setClearingHistory(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!closeModalListing || !currentProfile) return;
    setIsProcessingClose(true);
    setActionError('');

    try {
      const res = await fetch('/api/user/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: closeModalListing.id,
          action: closeReason === 'SOLD' ? 'SOLD' : 'REMOVED',
          closeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İlan kapatılamadı.');
      setCloseModalListing(null);
      await fetchListings();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'İlan kapatılamadı.');
    } finally {
      setIsProcessingClose(false);
    }
  };

  const handleDeleteDraft = () => {
    if (!savedDraft) return;
    if (!window.confirm('Bu taslağı silmek istediğinize emin misiniz?')) return;
    localStorage.removeItem(savedDraft.storageKey);
    setSavedDraft(null);
  };

  const handleRepublish = async (listing: Listing) => {
    setRepublishingId(listing.id);
    setActionError('');
    try {
      const res = await fetch('/api/user/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, action: 'REPUBLISH' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İlan yeniden yayınlanamadı.');
      await fetchListings();
      setActiveTab('ACTIVE');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'İlan yeniden yayınlanamadı.');
    } finally {
      setRepublishingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">İlanlarım</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Aktif ve süresi dolmuş tüm Sanboard ilanlarını buradan yönetebilirsin.
          </p>
        </div>

        <div className="flex rounded-xl bg-[var(--bg-surface-secondary)] p-1 border border-[var(--border-app)]">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-[var(--bg-surface)] text-[#FF8A1F] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Aktif ({activeListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXPIRED')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'EXPIRED'
                ? 'bg-[var(--bg-surface)] text-[#FF8A1F] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Süresi Dolan ({expiredListings.length})
          </button>
          <button type="button" onClick={() => setActiveTab('SOLD')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'SOLD' ? 'bg-[var(--bg-surface)] text-[#FF8A1F] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
            Satılan ({soldListings.length})
          </button>
        </div>
      </div>

      {!loading && ((activeTab === 'EXPIRED' && expiredListings.length > 0) || (activeTab === 'SOLD' && soldListings.length > 0)) && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setClearHistoryStatus(activeTab as 'EXPIRED' | 'SOLD')} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-danger)]">
            <Trash2 className="h-3.5 w-3.5" />Listeyi Temizle
          </button>
        </div>
      )}

      {savedDraft && (
        <div className="surface-card rounded-2xl border border-[#FF8A1F]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><p className="text-sm font-bold text-[var(--text-main)]">Kaydedilmiş ilan taslağın var</p><p className="text-xs text-[var(--text-muted)]">%{savedDraft.quality} tamamlandı{savedDraft.savedAt ? ` • ${formatDate(savedDraft.savedAt)}` : ''}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleDeleteDraft} className="btn-secondary text-xs py-2 px-4 inline-flex items-center justify-center gap-1.5 text-[var(--color-danger)]"><Trash2 className="w-3.5 h-3.5" />Taslağı Sil</button>
            <Link href={savedDraft.href} className="btn-primary text-xs py-2 px-4 inline-flex items-center justify-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />Düzenlemeye Devam Et</Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
          <span>İlanlar yükleniyor...</span>
        </div>
      ) : activeTab === 'ACTIVE' ? (
        activeListings.length > 0 ? (
          <div className="space-y-4">
            {activeListings.map((listing) => {
              const rawCover =
                listing.images?.find((i) => i.is_cover)?.storage_path ||
                listing.images?.[0]?.storage_path;
              const coverImg = resolveMediaUrl(rawCover);
              const remaining = formatTimeRemaining(listing.expires_at);

              return (
                <div
                  key={listing.id}
                  className="surface-card p-4 sm:p-5 rounded-2xl border border-[var(--border-app)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={coverImg}
                      alt={listing.title}
                      className="w-20 h-16 sm:w-24 sm:h-20 rounded-xl object-cover shrink-0 border border-[var(--border-app)]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="badge-tag inline-flex h-5 items-center px-1.5 py-0 text-[10px] leading-none">{listing.subcategory}</span>
                      </div>
                      <h3 className="font-bold text-sm text-[var(--text-main)] line-clamp-1">
                        {listing.title}
                      </h3>
                      <p className="text-base font-extrabold text-[#FF8A1F]">
                        {formatCurrency(listing.price)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1 text-[var(--color-success)] font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          {remaining.text}
                        </span>
                        <span className="flex items-center gap-1 text-[var(--text-dim)]">
                          <Heart className="w-3.5 h-3.5 text-[#FF8A1F]" />
                          {listing.favorite_count || 0} favori
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-1 items-stretch gap-2 w-full sm:w-32 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-app)]">
                    <Link
                      href={`/hesabim/ilanlarim/${listing.id}/duzenle`}
                      className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1 text-[#FF8A1F] hover:bg-[var(--brand-orange-subtle)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Düzenle</span>
                    </Link>

                    <Link
                      href={getListingUrl(listing)}
                      className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>İlanı Gör</span>
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        setCloseReason('SOLD');
                        setCloseModalListing(listing);
                        const response = await fetch(`/api/offers?listingId=${encodeURIComponent(listing.id)}`);
                        const data = await response.json().catch(() => ({}));
                        setActiveOfferCount(response.ok ? Number(data.activeCount || 0) : 0);
                      }}
                      className="btn-danger text-xs py-2 px-3 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>İlanı Kapat</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surface-card p-12 text-center space-y-3">
            <ListPlus className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Aktif ilanınız bulunmuyor.
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Araç veya mülkünüzü Los Santos'a duyurmak için hemen yeni bir ilan paketi başlatabilirsiniz.
            </p>
            <div className="pt-2">
              <Link href="/ilan-ver" className="btn-primary text-xs py-2 px-4 inline-flex">
                İlan Ver ($2.000)
              </Link>
            </div>
          </div>
        )
      ) : activeTab === 'EXPIRED' ? (expiredListings.length > 0 ? (
        <div className="space-y-4">
          {expiredListings.map((listing) => (
            <div
              key={listing.id}
              className="surface-card p-4 sm:p-5 rounded-2xl border border-[var(--border-app)] opacity-85 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="badge-tag bg-[var(--color-danger-subtle)] text-[var(--color-danger)] font-bold text-[10px]">
                    SÜRESİ DOLDU
                  </span>
                </div>
                <h3 className="font-bold text-sm text-[var(--text-main)]">{listing.title}</h3>
                <p className="text-sm font-bold text-[var(--text-muted)]">
                  Eski Fiyat: {formatCurrency(listing.price)}
                </p>
                <p className="text-xs text-[var(--text-dim)]">
                  Yayın: {formatDate(listing.published_at)} • Bitiş: {formatDate(listing.expires_at)}
                </p>
              </div>

              <div className="shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleRepublish(listing)}
                  disabled={republishingId === listing.id}
                  className="w-full sm:w-auto btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow"
                >
                  {republishingId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Yeniden Yayınla ($2.000)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card p-12 text-center space-y-2">
          <Clock className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
          <h3 className="text-sm font-bold text-[var(--text-main)]">
            Süresi dolan ilanınız bulunmuyor.
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            7 günlük yayın süresi tamamlanan ilanlarınız burada listelenir.
          </p>
        </div>
      )) : soldListings.length > 0 ? (
        <div className="space-y-3">
          {soldListings.map((listing) => <div key={listing.id} className="surface-card rounded-2xl border border-[var(--border-app)] p-4 sm:p-5">
            <span className="text-[10px] font-black text-emerald-400">SATILDI</span>
            <h3 className="mt-1 text-sm font-bold text-[var(--text-main)]">{listing.title}</h3>
            <p className="mt-1 text-sm font-bold text-[#FF8A1F]">{formatCurrency(listing.price)}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{listing.description}</p>
            <p className="mt-2 text-[11px] text-[var(--text-dim)]">Kapanış: {formatDate(listing.closed_at || listing.updated_at)}</p>
          </div>)}
        </div>
      ) : <div className="surface-card p-12 text-center space-y-2"><CheckCircle className="w-8 h-8 text-[var(--text-dim)] mx-auto" /><h3 className="text-sm font-bold text-[var(--text-main)]">Satılan ilanınız bulunmuyor.</h3></div>}

      {actionError && (
        <div className="p-3 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold">
          {actionError} Önce uygun ilan paketini satın alabilirsiniz.
        </div>
      )}

      {closeModalListing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full surface-card rounded-2xl border-2 border-[var(--color-danger)]/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[var(--text-main)]">
                  İlanı hangi nedenle kapatmak istiyorsun?
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  İlan yayından kalıcı olarak kaldırılacak, fotoğrafları ve favorileri temizlenecektir. <strong className="text-[var(--color-danger)]">Bu işlem geri alınamaz.</strong>
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-xs text-[var(--text-main)] font-semibold truncate">
              {closeModalListing.title}
            </div>
            {activeOfferCount > 0 && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">Bu ilan için {activeOfferCount} aktif teklif bulunuyor. İlanı kaldırırsanız bu tekliflerin tamamı kapatılacak.</p>}

            <div className="grid gap-2">
              {([
                ['SOLD', 'Satıldı'],
                ['CANCELLED', 'Satıştan vazgeçildi'],
                ['OTHER', 'Diğer nedenle kapat'],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)] p-3 text-xs font-semibold text-[var(--text-main)]">
                  <input type="radio" name="closeReason" value={value} checked={closeReason === value} onChange={() => setCloseReason(value)} className="accent-[#FF8A1F]" />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[var(--border-app)]">
              <button
                type="button"
                onClick={() => setCloseModalListing(null)}
                disabled={isProcessingClose}
                className="btn-secondary text-xs py-2 px-4"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={isProcessingClose}
                className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {isProcessingClose ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                <span>İlanı Kapat</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {clearHistoryStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-listing-history-title">
          <div className="surface-card w-full max-w-md rounded-2xl border border-[var(--border-app)] p-6 shadow-2xl">
            <h3 id="clear-listing-history-title" className="text-lg font-bold text-[var(--text-main)]">Listeyi görünümden temizle?</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{clearHistoryStatus === 'SOLD' ? 'Satılan' : 'Süresi dolan'} ilanlar yalnızca bu karakter profilinin görünümünden kaldırılır. Aktif ilanlar, diğer karakterler ve denetim kayıtları etkilenmez.</p>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setClearHistoryStatus(null)} disabled={clearingHistory} className="btn-secondary px-4 py-2 text-xs">Vazgeç</button><button type="button" onClick={clearHistory} disabled={clearingHistory} className="btn-danger px-4 py-2 text-xs">{clearingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Listeyi Temizle'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
