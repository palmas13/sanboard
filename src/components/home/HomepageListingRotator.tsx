'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin, Tag } from 'lucide-react';
import { PublicListingSummary } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { FavoriteButton } from '@/components/listings/FavoriteButton';

const FALLBACK_IMAGES = { vehicle: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=700&auto=format&fit=crop&q=80', property: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=700&auto=format&fit=crop&q=80' };

function HomepageCompactListing({ listing }: { listing: PublicListingSummary }) {
  const image = resolveMediaUrl(listing.cover_image) || FALLBACK_IMAGES[listing.category];
  const date = listing.published_at ? new Intl.DateTimeFormat('tr-TR', { month: 'short', year: 'numeric' }).format(new Date(listing.published_at)) : null;
  const primaryMeta = listing.location
    ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.location}</span></span>
    : listing.category === 'vehicle'
      ? <span className="flex min-w-0 items-center gap-1"><Tag className="h-3 w-3 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.subcategory}</span></span>
      : <span aria-hidden="true" />;
  return <article className="homepage-compact-listing group"><Link href={getListingUrl(listing)} className="absolute inset-0 z-0" aria-label={`${listing.title} ilanını görüntüle`} /><div className="relative h-[108px] w-[136px] shrink-0 overflow-hidden rounded-[.7rem] bg-[var(--bg-surface-secondary)] sm:w-[146px]"><Image src={image} alt={listing.title} fill sizes="(max-width: 639px) 136px, 146px" quality={88} className="object-cover object-center transition-transform duration-300 group-hover:scale-105" /></div><div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col py-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-base font-black leading-5 text-[#ff8a1f]">{formatCurrency(listing.price)}</p><span className="pointer-events-auto"><FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={listing.is_favorited} size="sm" /></span></div><h3 className="mt-1.5 line-clamp-2 min-h-[2.3rem] text-sm font-bold leading-[1.15rem] text-[var(--text-main)] transition-colors group-hover:text-[#ff9d45]">{listing.title}</h3><div className="mt-auto flex min-h-4 items-center justify-between gap-2 pt-2 text-[11px] text-[var(--text-dim)]">{primaryMeta}{date && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="h-3 w-3" />{date}</span>}</div></div></article>;
}

export function HomepageListingRotator({ listings, emptyMessage }: { listings: PublicListingSummary[]; emptyMessage: string; label: string }) {
  if (!listings.length) return <div className="homepage-empty-state">{emptyMessage}</div>;
  return <HomepageListingPages listings={listings} />;
}

function HomepageListingPages({ listings }: { listings: PublicListingSummary[] }) {
  const pages = useMemo(() => Array.from({ length: Math.ceil(listings.length / 3) }, (_, index) => listings.slice(index * 3, index * 3 + 3)), [listings]);
  const [page, setPage] = useState(0);
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
    if (pages.length < 2 || hovered || focused || hidden) return;
    const timer = window.setTimeout(() => setPage((current) => (current + 1) % pages.length), 5000);
    return () => window.clearTimeout(timer);
  }, [focused, hidden, hovered, page, pages.length]);

  useEffect(() => setPage((current) => Math.min(current, pages.length - 1)), [pages.length]);

  return (
    <div
      className="homepage-rotator-viewport"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => setFocused(event.currentTarget.contains(event.relatedTarget as Node))}
    >
      <div key={page} className="homepage-listing-stack homepage-rotator-enter">
        {pages[page].map((listing) => <HomepageCompactListing key={listing.id} listing={listing} />)}
      </div>
    </div>
  );
}