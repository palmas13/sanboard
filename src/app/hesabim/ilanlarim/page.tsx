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
  X,
  Heart,
  Edit3,
} from 'lucide-react';
import { formatCurrency, formatTimeRemaining, formatDate } from '@/lib/utils/format';
import { Listing } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';

export default function HesabimIlanlarimPage() {
  const { currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'EXPIRED'>('ACTIVE');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Mark as sold modal state
  const [soldModalListing, setSoldModalListing] = useState<Listing | null>(null);
  const [isProcessingSold, setIsProcessingSold] = useState(false);

  const fetchListings = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user/listings?profileId=${currentProfile.id}`);
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

  const activeListings = listings.filter((l) => l.status === 'ACTIVE');
  const expiredListings = listings.filter((l) => l.status === 'EXPIRED');

  const handleConfirmSold = async () => {
    if (!soldModalListing || !currentProfile) return;
    setIsProcessingSold(true);

    try {
      const res = await fetch('/api/user/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: soldModalListing.id,
          profileId: currentProfile.id,
        }),
      });

      if (res.ok) {
        setSoldModalListing(null);
        await fetchListings();
      }
    } catch {
      // Ignore
    } finally {
      setIsProcessingSold(false);
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
        </div>
      </div>

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
                        <span className="badge-tag text-[10px]">{listing.subcategory}</span>
                        <span className="text-[11px] font-mono text-[var(--text-dim)]">
                          {listing.listing_number}
                        </span>
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

                  <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-app)]">
                    <Link
                      href={`/hesabim/ilanlarim/${listing.id}/duzenle`}
                      className="flex-1 sm:flex-none btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1 text-[#FF8A1F] hover:bg-[var(--brand-orange-subtle)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Düzenle</span>
                    </Link>

                    <Link
                      href={`/ilan/${listing.id}`}
                      className="flex-1 sm:flex-none btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>İlanı Gör</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setSoldModalListing(listing)}
                      className="flex-1 sm:flex-none btn-danger text-xs py-2 px-3 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Satıldı Olarak İşaretle</span>
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
      ) : expiredListings.length > 0 ? (
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
                  <span className="text-[11px] font-mono text-[var(--text-dim)]">
                    {listing.listing_number}
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
                <Link
                  href="/ilan-ver/paket"
                  className="w-full sm:w-auto btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Yeniden Yayınla ($2.000)</span>
                </Link>
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
      )}

      {/* SATILDI OLARAK İŞARETLE CONFIRMATION MODAL */}
      {soldModalListing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full surface-card rounded-2xl border-2 border-[var(--color-danger)]/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[var(--text-main)]">
                  İlanı satıldı olarak işaretlemek istediğine emin misin?
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Bu işlemden sonra ilan yayından kalıcı olarak kaldırılacak, fotoğrafları sistemden silinecek ve favori listelerinden temizlenecektir. <strong className="text-[var(--color-danger)]">Bu işlem geri alınamaz.</strong>
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] text-xs text-[var(--text-main)] font-semibold truncate">
              {soldModalListing.title}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[var(--border-app)]">
              <button
                type="button"
                onClick={() => setSoldModalListing(null)}
                disabled={isProcessingSold}
                className="btn-secondary text-xs py-2 px-4"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmSold}
                disabled={isProcessingSold}
                className="btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {isProcessingSold ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                <span>Evet, Satıldı</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
