'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicListingSummary } from '@/types';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { formatCurrency } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { FeaturedBadge } from '@/components/listings/FeaturedBadge';

const FALLBACK = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80';

export function HomepageFeaturedRotator({ listings }: { listings: PublicListingSummary[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden);
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (listings.length < 2 || hovered || focused || hidden) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % listings.length), 5000);
    return () => window.clearTimeout(timer);
  }, [focused, hidden, hovered, index, listings.length]);

  useEffect(() => setIndex((current) => Math.min(current, Math.max(0, listings.length - 1))), [listings.length]);

  if (!listings.length) return <div className="homepage-empty-state">Şu anda öne çıkarılmış aktif ilan bulunmuyor.</div>;
  const listing = listings[index];
  const image = resolveMediaUrl(listing.cover_image) || FALLBACK;
  const hasMultipleListings = listings.length > 1;
  const move = (direction: number) => setIndex((current) => (current + direction + listings.length) % listings.length);

  return <div className="homepage-featured-viewport" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => setFocused(event.currentTarget.contains(event.relatedTarget as Node))}>
    <article key={listing.id} className="homepage-featured-card homepage-featured-enter group relative">
      <Link href={getListingUrl(listing)} className="absolute inset-0 z-0" aria-label={`${listing.title} ilanını görüntüle`} />
      <div className="homepage-featured-media relative aspect-[4/3] overflow-hidden rounded-t-[inherit] bg-[var(--bg-surface-secondary)]">
        <Image src={image} alt={listing.title} fill sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1279px) calc(50vw - 2rem), 380px" quality={90} className="object-cover object-center transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
        <FeaturedBadge icon="rocket" className="absolute left-2.5 top-2.5 z-10 h-7 w-7 shadow-lg shadow-black/20" />
        <span className="homepage-featured-favorite pointer-events-auto absolute right-2.5 top-2.5 z-10"><FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={listing.is_favorited} size="sm" /></span>
        {hasMultipleListings && <div className="homepage-featured-controls" aria-label="Öne çıkan ilan kontrolleri">
          <button type="button" className="homepage-featured-arrow" onClick={(event) => { event.preventDefault(); event.stopPropagation(); move(-1); }} aria-label="Önceki öne çıkan ilan"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" className="homepage-featured-arrow" onClick={(event) => { event.preventDefault(); event.stopPropagation(); move(1); }} aria-label="Sonraki öne çıkan ilan"><ChevronRight aria-hidden="true" /></button>
        </div>}
      </div>
      <div className="homepage-featured-body pointer-events-none relative z-10">
        <p className="shrink-0 text-[1.65rem] font-black leading-none tracking-[-0.03em] text-[#ff8a1f]">{formatCurrency(listing.price)}</p>
        <h3 className="mt-2.5 line-clamp-2 min-h-11 shrink-0 text-base font-extrabold leading-[1.35rem] text-[var(--text-main)] transition-colors group-hover:text-[#ff9d45]">{listing.title}</h3>
        <p className="mt-2 line-clamp-3 shrink-0 text-xs leading-[1.15rem] text-[var(--text-muted)]">{listing.description}</p>
        <div className="homepage-featured-footer flex min-h-7 shrink-0 items-center justify-between gap-3 border-t border-[var(--border-app)] pt-3 text-[10px] font-medium text-[var(--text-muted)]">
          <span className="homepage-featured-category min-w-0 truncate">{listing.subcategory}</span>
          {listing.published_at && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(listing.published_at))}</span>}
        </div>
      </div>
    </article>
  </div>;
}
