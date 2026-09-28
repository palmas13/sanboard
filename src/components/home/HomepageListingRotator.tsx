'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Heart, MapPin } from 'lucide-react';
import { PublicListingSummary } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';

const FALLBACK_IMAGES = { vehicle: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=700&auto=format&fit=crop&q=80', property: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=700&auto=format&fit=crop&q=80' };

function HomepageCompactListing({ listing }: { listing: PublicListingSummary }) {
  const image = resolveMediaUrl(listing.cover_image) || FALLBACK_IMAGES[listing.category];
  const date = listing.published_at ? new Intl.DateTimeFormat('tr-TR', { month: 'short', year: 'numeric' }).format(new Date(listing.published_at)) : null;
  return <Link href={getListingUrl(listing)} className="homepage-compact-listing group"><div className="relative h-[82px] w-[104px] shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface-secondary)] sm:w-[112px]"><Image src={image} alt={listing.title} fill sizes="112px" className="object-cover transition-transform duration-300 group-hover:scale-105" /></div><div className="min-w-0 flex-1 py-0.5"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-black text-[#ff8a1f]">{formatCurrency(listing.price)}</p><span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)]"><Heart className="h-3 w-3" />{listing.favorite_count}</span></div><h3 className="mt-1 line-clamp-1 text-xs font-bold text-[var(--text-main)] transition-colors group-hover:text-[#ff9d45]">{listing.title}</h3><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--text-dim)]"><span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-[#ff8a1f]" /><span className="truncate">{listing.location || listing.subcategory}</span></span>{date && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="h-3 w-3" />{date}</span>}</div></div></Link>;
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
  return <div className="space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}><div className="flex justify-end gap-1.5"><button type="button" onClick={() => move(-1)} disabled={pageCount < 2} aria-label={`Önceki ${label}`} className="homepage-arrow"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={() => move(1)} disabled={pageCount < 2} aria-label={`Sonraki ${label}`} className="homepage-arrow"><ChevronRight className="h-3.5 w-3.5" /></button></div><div className="overflow-hidden"><div key={page} className={reducedMotion ? '' : 'homepage-rotator-enter'}><div className="grid min-h-[180px] content-start gap-2.5">{pages[page]?.map((listing) => <HomepageCompactListing key={listing.id} listing={listing} />)}</div></div></div></div>;
}