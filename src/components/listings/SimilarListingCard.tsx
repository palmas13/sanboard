import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';

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
      className={`group surface-card rounded-xl border border-[var(--border-app)] hover:border-[#FF8A1F]/40 hover:bg-[var(--bg-surface-secondary)]/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-md overflow-hidden flex flex-col justify-between w-[240px] sm:w-[260px] shrink-0 ${className}`}
    >
      <Link href={`/ilan/${listing.id}`} className="block flex-1 flex flex-col">
        {/* Cover Thumbnail */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-surface-secondary)]">
          <img
            src={displayImage}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1">
            {listing.is_featured && (
              <span className="badge-tag bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white border-amber-400/30 font-extrabold text-[8px] uppercase px-1.5 py-0.5 shadow-sm flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-white fill-white" />
                ÖNE ÇIKAN
              </span>
            )}
            <span className="badge-tag bg-black/65 backdrop-blur-md text-white border-white/10 text-[10px]">
              {listing.subcategory}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3.5 flex flex-col flex-1 justify-between space-y-2">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors truncate">
              {brandModelText}
            </h4>
            <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
              {listing.title}
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border-app)] flex items-center justify-between">
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
