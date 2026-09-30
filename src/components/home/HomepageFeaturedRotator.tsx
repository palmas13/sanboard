'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import type { PublicListingSummary } from '@/types';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { formatCurrency } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';

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

  return <div className="homepage-featured-viewport" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => setFocused(event.currentTarget.contains(event.relatedTarget as Node))}>
    <article key={listing.id} className="homepage-featured-card homepage-featured-enter group relative">
      <Link href={getListingUrl(listing)} className="absolute inset-0 z-0" aria-label={`${listing.title} ilanını görüntüle`} />
      <div className="relative aspect-[1.48/1] overflow-hidden rounded-t-[inherit]">
        <Image src={image} alt={listing.title} fill sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1279px) calc(50vw - 2rem), 380px" quality={90} className="object-cover object-center transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
        <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/65 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">Öne Çıkarılan</span>
        <span className="pointer-events-auto absolute right-3 top-3 z-10"><FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={listing.is_favorited} size="sm" /></span>
      </div>
      <div className="pointer-events-none relative z-10 p-[1.125rem]">
        <p className="text-[1.35rem] font-black tracking-tight text-[#ff8a1f]">{formatCurrency(listing.price)}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-10 text-[15px] font-bold leading-5 text-[var(--text-main)] group-hover:text-[#ff9d45]">{listing.title}</h3>
        <div className="mt-3 flex min-h-5 items-center justify-between gap-3 border-t border-[var(--border-app)] pt-3 text-[11px] text-[var(--text-muted)]">
          {listing.location ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.location}</span></span> : <span aria-hidden="true" />}
          {listing.published_at && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Intl.DateTimeFormat('tr-TR', { year: 'numeric' }).format(new Date(listing.published_at))}</span>}
        </div>
      </div>
    </article>
  </div>;
}
