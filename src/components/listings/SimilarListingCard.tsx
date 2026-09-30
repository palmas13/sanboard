import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils/format';
import { SimilarListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';

interface SimilarListingCardProps {
  listing: SimilarListingSummary;
  className?: string;
  style?: React.CSSProperties;
}

export function SimilarListingCard({ listing, className = '', style }: SimilarListingCardProps) {
  const fallbackImage =
    listing.category === 'vehicle'
      ? 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80';

  const displayImage = resolveMediaUrl(listing.cover_image) || fallbackImage;
  const brandModelText = listing.category === 'vehicle'
    ? [listing.brand, listing.model].filter(Boolean).join(' ')
    : '';
  const secondaryText = brandModelText || (listing.category === 'property' ? listing.location : '');

  return (
    <article
      style={style}
      className={`group surface-card w-[82vw] max-w-[360px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-app)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF8A1F]/40 hover:shadow-md sm:w-[350px] ${className}`}
    >
      <Link href={getListingUrl(listing)} aria-label={`${listing.title} ilanını görüntüle`} className="flex min-h-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF8A1F]">
        <div className="relative w-[42%] shrink-0 overflow-hidden bg-[var(--bg-surface-secondary)]">
          <Image
            src={displayImage}
            alt={listing.title}
            fill
            sizes="(max-width: 639px) 35vw, 147px"
            quality={86}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[var(--text-main)] transition-colors group-hover:text-[#FF8A1F]">
              {listing.title}
            </h3>
            {secondaryText ? <p className="mt-1 truncate text-xs font-medium text-[var(--text-muted)]">{secondaryText}</p> : null}
          </div>

          <div className="mt-auto border-t border-[var(--border-app)] pt-3">
            <p className="text-base font-extrabold tracking-tight text-[#FF8A1F]">{formatCurrency(listing.price)}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}
