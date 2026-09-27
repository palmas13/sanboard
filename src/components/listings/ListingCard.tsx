import React from 'react';
import Link from 'next/link';
import { MapPin, Calendar, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FavoriteButton } from './FavoriteButton';
import { PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { PropertyCompareButton } from '@/components/compare/PropertyCompareButton';

interface ListingCardProps {
  listing: PublicListingSummary;
  className?: string;
}

export function ListingCard({ listing, className = '' }: ListingCardProps) {
  const fallbackImage =
    listing.category === 'vehicle'
      ? 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80';

  const displayImage = resolveMediaUrl(listing.cover_image) || fallbackImage;

  return (
    <div
      className={`group surface-card surface-card-hover overflow-hidden flex flex-col justify-between ${className}`}
    >
      <Link href={getListingUrl(listing)} className="block flex-1">
        {/* Cover Photo & Badges */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-surface-secondary)]">
          <img
            src={displayImage}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Category Tag & Featured Badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
            {listing.is_featured && (
              <span className="badge-tag bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white border-amber-400/30 font-extrabold text-[10px] tracking-wider uppercase px-2 py-0.5 shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-white fill-white" />
                ÖNE ÇIKAN
              </span>
            )}
            <span className="badge-tag bg-black/65 backdrop-blur-md text-white border-white/10 font-semibold text-[11px]">
              {listing.subcategory}
            </span>
          </div>

          {/* Favorite Button on Image Corner */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <FavoriteButton
              listingId={listing.id}
              initialCount={listing.favorite_count}
              initialIsFavorited={listing.is_favorited}
              size="sm"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 flex flex-col flex-1">
          {/* Price */}
          <div className="flex items-baseline gap-2 flex-wrap">
            {listing.previous_price && listing.price < listing.previous_price && (
              <span className="text-xs font-semibold text-[var(--text-muted)] line-through">
                {formatCurrency(listing.previous_price)}
              </span>
            )}
            <span className="text-xl font-extrabold text-[#FF8A1F] tracking-tight">
              {formatCurrency(listing.price)}
            </span>
          </div>

          {/* Title */}
          <h3 className="mt-1.5 text-sm font-semibold text-[var(--text-main)] line-clamp-2 leading-snug group-hover:text-[#FF8A1F] transition-colors">
            {listing.title}
          </h3>

          {/* Location & Date (Location is ONLY shown for property, NOT for vehicles) */}
          <div className="mt-auto pt-3.5 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-app)]">
            {listing.category === 'property' ? (
              <div className="flex items-center gap-1 max-w-[130px] truncate">
                <MapPin className="w-3.5 h-3.5 text-[#FF8A1F] shrink-0" />
                <span className="truncate">{listing.location}</span>
              </div>
            ) : <span className="text-[11px] font-medium text-[var(--text-dim)]">{listing.subcategory}</span>}

            <div className="flex items-center gap-1 shrink-0 text-[var(--text-dim)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(listing.published_at)}</span>
            </div>
          </div>
        </div>
      </Link>
      {listing.category === 'property' && (
        <div className="absolute bottom-[4.35rem] right-2.5 z-10">
          <PropertyCompareButton listing={listing} compact />
        </div>
      )}
    </div>
  );
}
