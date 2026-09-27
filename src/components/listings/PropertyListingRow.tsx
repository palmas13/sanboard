import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FavoriteButton } from './FavoriteButton';
import type { PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { PropertyCompareButton } from '@/components/compare/PropertyCompareButton';

export function PropertyListingRow({ listing }: { listing: PublicListingSummary }) {
  const displayImage = resolveMediaUrl(listing.cover_image) || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80';

  return (
    <article className="group relative overflow-hidden rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[#FF8A1F]/40 hover:bg-[var(--bg-surface-secondary)]/50 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:transform-none">
      <Link href={getListingUrl(listing)} className="absolute inset-0 z-0" aria-label={`${listing.title} ilanını aç`} />
      <div className="relative z-10 flex flex-col gap-4 p-3 pointer-events-none sm:min-h-[135px] sm:flex-row sm:items-center">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface-secondary)] sm:h-[115px] sm:w-[180px] lg:w-[200px]">
          <img src={displayImage} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:transform-none" />
          {listing.is_featured && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-gradient-to-r from-amber-500 to-[#FF8A1F] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white"><Sparkles className="h-2.5 w-2.5" />Öne Çıkan</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-base font-bold text-[var(--text-main)] transition-colors group-hover:text-[#FF8A1F]">{listing.title}</h3>
          <p className="text-xs font-medium text-[var(--text-muted)]">{listing.subcategory}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-[var(--text-dim)]"><span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF8A1F]" /><span className="truncate">{listing.location}</span></span><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(listing.published_at)}</span></div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-app)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="text-xl font-black tracking-tight text-[#FF8A1F] lg:text-2xl">{formatCurrency(listing.price)}</div>
          <div className="pointer-events-auto relative z-20 flex items-center gap-2"><PropertyCompareButton listing={listing} /><FavoriteButton listingId={listing.id} initialCount={listing.favorite_count} initialIsFavorited={listing.is_favorited} size="sm" /></div>
        </div>
      </div>
    </article>
  );
}