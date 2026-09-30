import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';

interface SimilarListingCardProps {
  listing: PublicListingSummary;
  className?: string;
  style?: React.CSSProperties;
}

export function SimilarListingCard({ listing, className = '', style }: SimilarListingCardProps) {
  const fallbackImage =
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80';

  const displayImage = resolveMediaUrl(listing.cover_image) || fallbackImage;
  const brandModelText = [listing.brand, listing.model].filter(Boolean).join(' ') || listing.subcategory;

  return (
    <div
      style={style}
      className={`group surface-card w-[310px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-app)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF8A1F]/40 hover:bg-[var(--bg-surface-secondary)]/50 hover:shadow-md sm:w-[340px] ${className}`}
    >
      <Link href={getListingUrl(listing)} className="flex min-h-32">
        {/* Cover Thumbnail */}
        <div className="relative w-[42%] shrink-0 overflow-hidden bg-[var(--bg-surface-secondary)]">
          <img
            src={displayImage}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute left-2 top-2 flex items-center gap-1">
            {listing.is_featured && (
              <span className="badge-tag bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white border-amber-400/30 font-extrabold text-[8px] uppercase px-1.5 py-0.5 shadow-sm flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-white fill-white" />
                ÖNE ÇIKAN
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between space-y-2 p-3.5">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors truncate">
              {brandModelText || listing.title}
            </h4>
            <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
              {listing.title}
            </p>
          </div>

          <span className="w-fit rounded-md bg-[var(--bg-surface-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">{listing.subcategory}</span>
          <div className="flex items-center justify-between border-t border-[var(--border-app)] pt-2">
            <span className="text-base font-extrabold text-[#FF8A1F] tracking-tight">
              {formatCurrency(listing.price)}
            </span>
            <span className="text-[10px] text-[var(--text-dim)] font-medium">İncele →</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
