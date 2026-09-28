'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Tag } from 'lucide-react';
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

export function HomepageListingRotator({ listings, emptyMessage, label }: { listings: PublicListingSummary[]; emptyMessage: string; label: string }) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [timerVersion, setTimerVersion] = useState(0);
  const pageCount = Math.ceil(listings.length / 2);
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, index) => listings.slice(index * 2, index * 2 + 2)), [listings, pageCount]);
  const move = useCallback((direction: number) => { if (pageCount < 2) return; setTimerVersion((value) => value + 1); setPage((current) => (current + direction + pageCount) % pageCount); }, [pageCount]);

  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { if (pageCount < 2 || paused || document.hidden) return; const id = window.setInterval(() => setPage((current) => (current + 1) % pageCount), 5000); return () => window.clearInterval(id); }, [pageCount, paused, timerVersion]);
  useEffect(() => { const onVisibility = () => setPaused(document.hidden); document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, []);

  if (!listings.length) return <div className="homepage-empty-state">{emptyMessage}</div>;
  return <div className="homepage-rotator" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}><div className="homepage-rotator-controls"><button type="button" onClick={() => move(-1)} disabled={pageCount < 2} aria-label={`Önceki ${label}`} className="homepage-arrow"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => move(1)} disabled={pageCount < 2} aria-label={`Sonraki ${label}`} className="homepage-arrow"><ChevronRight className="h-4 w-4" /></button></div><div className="overflow-hidden"><div key={page} className={reducedMotion ? '' : 'homepage-rotator-enter'}><div className="grid min-h-[230px] content-start gap-3">{pages[page]?.map((listing) => <HomepageCompactListing key={listing.id} listing={listing} />)}</div></div></div></div>;
}