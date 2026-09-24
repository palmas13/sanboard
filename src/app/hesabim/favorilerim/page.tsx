'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { Heart, Loader2, MapPin, Calendar, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FavoriteButton } from '@/components/listings/FavoriteButton';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {favorites.map((listing) => {
            const coverImg =
              listing.images?.find((i: any) => i.is_cover)?.storage_path ||
              listing.images?.[0]?.storage_path ||
              'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600';

            const isExpired = listing.isExpired || listing.status === 'EXPIRED';

            return (
              <div
                key={listing.id}
                className={`surface-card rounded-2xl overflow-hidden border border-[var(--border-app)] flex flex-col justify-between ${
                  isExpired ? 'opacity-65 grayscale-[30%] bg-[var(--bg-surface-secondary)]/50' : 'surface-card-hover'
                }`}
              >
                <div>
                  {/* Photo area */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
                    <img
                      src={coverImg}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />

                    {isExpired ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-3 text-center">
                        <div className="px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Bu ilan artık yayında değil</span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute top-2.5 right-2.5">
                        <FavoriteButton
                          listingId={listing.id}
                          initialCount={listing.favorite_count}
                          initialIsFavorited={true}
                          size="sm"
                          onToggle={(isFav) => {
                            if (!isFav) {
                              setFavorites((prev) => prev.filter((f) => f.id !== listing.id));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {listing.previous_price && listing.previous_price !== listing.price && (
                        <span className="text-xs font-semibold text-[var(--text-muted)] line-through">
                          {formatCurrency(listing.previous_price)}
                        </span>
                      )}
                      <span className="text-lg font-black text-[#FF8A1F]">
                        {formatCurrency(listing.price)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)] line-clamp-2">
                      {listing.title}
                    </h3>
                  </div>
                </div>

                {/* Footer Link / Info */}
                <div className="p-4 pt-0">
                  {isExpired ? (
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-secondary)] text-[11px] text-[var(--text-dim)] text-center font-medium">
                      İlan süresi dolduğu için detaylar görüntülenemiyor.
                    </div>
                  ) : (
                    <Link
                      href={`/ilan/${listing.id}`}
                      className="w-full btn-secondary text-xs py-2 block text-center"
                    >
                      İlan Detayına Git
                    </Link>
                  )}
                </div>
              </div>
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
