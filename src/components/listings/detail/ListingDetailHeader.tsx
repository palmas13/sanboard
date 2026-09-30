import Link from 'next/link';
import { CalendarDays, Heart, MapPin } from 'lucide-react';
import type { Listing, PublicListingSummary } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';

type HeaderListing = Listing | PublicListingSummary;

export function ListingDetailHeader({
  listing,
  categoryHref,
  categoryName,
  actions,
}: {
  listing: HeaderListing;
  categoryHref: string;
  categoryName: string;
  actions: React.ReactNode;
}) {
  return (
    <header data-testid="listing-detail-header" className="overflow-hidden rounded-[18px] border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-[0_20px_65px_rgba(0,0,0,.18)]">
      <div className="grid items-stretch gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <div className="min-w-0 p-5 sm:p-6 lg:px-7 lg:py-7">
          <nav aria-label="İlan yolu" className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--text-dim)]">
            <Link href="/" className="transition-colors hover:text-[#FF9E45]">Sanboard</Link>
            <span aria-hidden="true">/</span>
            <Link href={categoryHref} className="transition-colors hover:text-[#FF9E45]">{categoryName}</Link>
            <span aria-hidden="true">/</span>
            <span className="max-w-56 truncate text-[var(--text-muted)]">{listing.title}</span>
          </nav>

          <h1 className="max-w-4xl text-2xl font-black leading-[1.12] tracking-[-0.03em] text-[var(--text-main)] sm:text-3xl xl:text-[34px]">
            {listing.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
            {listing.location ? <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#FF9E45]" />{listing.location}</span> : null}
            {listing.published_at ? <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(listing.published_at)}</span> : null}
            <span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />{listing.favorite_count || 0} kişi favoriledi</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center border-t border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/40 p-5 sm:p-6 lg:border-l lg:border-t-0 lg:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-dim)]">Fiyat</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            {listing.previous_price && listing.price < listing.previous_price ? <span className="text-sm font-bold text-[var(--text-muted)] line-through">{formatCurrency(listing.previous_price)}</span> : null}
            <strong className="text-3xl font-black tracking-[-0.03em] text-[#FF9E45] sm:text-[34px]">{formatCurrency(listing.price)}</strong>
          </div>
          <div className="mt-4">{actions}</div>
        </div>
      </div>
    </header>
  );
}