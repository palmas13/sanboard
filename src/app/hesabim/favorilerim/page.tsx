'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { Heart, Loader2, Clock, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';

export default function HesabimFavorilerimPage() {
  const { user, currentProfile } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile && !user) return;

    async function fetchFavorites() {
      try {
        const res = await fetch('/api/user/favorites');
        const data = await res.json();
        if (Array.isArray(data)) {
          setFavorites(data);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, [user, currentProfile]);

  return (
    <div className="space-y-6">
      <div className="surface-card p-5 rounded-2xl border border-[var(--border-app)] flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">Favorilerim</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Beğendiğin ve takip etmek istediğin ilanların listesi
          </p>
        </div>
        <span className="badge-tag">{favorites.length} İlan</span>
      </div>

      {loading ? (
        <div className="surface-card p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF8A1F]" />
          <span>Favoriler yükleniyor...</span>
        </div>
      ) : favorites.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] divide-y divide-[var(--border-app)]">
          {favorites.map((listing) => {
            const rawCover =
              listing.images?.find((i: any) => i.is_cover)?.storage_path ||
              listing.images?.[0]?.storage_path;
            const coverImg = resolveMediaUrl(rawCover);

            const isExpired = listing.isExpired || listing.status === 'EXPIRED';

            return (
              <article
                key={listing.id}
                className={`group grid grid-cols-[88px_minmax(0,1fr)] gap-4 p-3 transition-colors sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:p-4 ${
                  isExpired ? 'opacity-65 grayscale-[30%]' : 'hover:bg-[var(--bg-surface-secondary)]/35'
                }`}
              >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/40">
                    <img
                      src={coverImg}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />

                    {isExpired ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-2 text-center">
                        <div className="rounded-lg bg-[var(--color-danger)]/90 px-2 py-1 text-[9px] font-bold text-white">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Bu ilan artık yayında değil</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-1.5 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{listing.category === 'vehicle' ? 'Araç' : 'Mülk'} · {listing.subcategory}</p>
                    <h3 className="truncate text-sm font-bold text-[var(--text-main)]">{listing.title}</h3>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {listing.previous_price && listing.previous_price !== listing.price && (
                        <span className="text-xs font-semibold text-[var(--text-muted)] line-through">
                          {formatCurrency(listing.previous_price)}
                        </span>
                      )}
                      <span className="text-base font-black text-[#FF8A1F]">
                        {formatCurrency(listing.price)}
                      </span>
                    </div>
                  </div>
                <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                  {!isExpired && <FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={true} initialStateIsAuthoritative={true} size="sm" onToggle={(isFav) => { if (!isFav) setFavorites((prev) => prev.filter((f) => f.id !== listing.id)); }} />}
                  {isExpired ? (
                    <span className="text-[11px] font-medium text-[var(--text-dim)]">Yayında değil</span>
                  ) : (
                    <Link
                      href={getListingUrl(listing)}
                      className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                    >
                      Detay <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface-card p-12 text-center space-y-3">
          <Heart className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
          <h3 className="text-sm font-bold text-[var(--text-main)]">
            Favorilerine eklediğin bir ilan yok.
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            İlan kartlarındaki kalp ikonuna tıklayarak beğendiğin araç ve mülkleri bu listede toplayabilirsin.
          </p>
          <div className="pt-2">
            <Link href="/arac" className="btn-primary text-xs py-2 px-4 inline-flex">
              İlanları Keşfet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
