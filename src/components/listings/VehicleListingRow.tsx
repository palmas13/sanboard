import React from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FavoriteButton } from './FavoriteButton';
import { CompareButton } from '@/components/compare/CompareButton';
import { PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getListingUrl } from '@/lib/urls';
import { FeaturedBadge } from './FeaturedBadge';

interface VehicleListingRowProps {
  listing: PublicListingSummary;
  className?: string;
}

export function VehicleListingRow({ listing, className = '' }: VehicleListingRowProps) {
  const fallbackImage =
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80';

  const displayImage = resolveMediaUrl(listing.cover_image) || fallbackImage;

  const brandModelText = [listing.brand, listing.model].filter(Boolean).join(' ');

  return (
    <div
      className={`group relative surface-card rounded-xl border border-[var(--border-app)] hover:border-[#FF8A1F]/40 hover:bg-[var(--bg-surface-secondary)]/50 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg overflow-hidden ${className}`}
    >
      <Link
        href={getListingUrl(listing)}
        className="absolute inset-0 z-0"
        aria-label={`${listing.title} ilanını aç`}
      />
      <div className="relative z-10 pointer-events-none">
        {/* Desktop View: Horizontal Row (approx 125-155px height) */}
        <div className="hidden sm:flex items-center min-h-[135px] max-h-[160px] p-3 gap-4 lg:gap-5">
          {/* Cover Photo */}
          <div className="relative w-[180px] lg:w-[200px] h-[115px] shrink-0 rounded-lg overflow-hidden bg-[var(--bg-surface-secondary)]">
            <img
              src={displayImage}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
            />
            {listing.is_featured && (
              <FeaturedBadge className="absolute left-1.5 top-1.5 h-6 w-6" />
            )}
          </div>

          {/* Center Column: Title (primary) + Brand/Model (subtitle) + Published Date */}
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1 py-1">
            <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[#FF8A1F] transition-colors truncate">
              {listing.title}
            </h3>

            {brandModelText && (
              <p className="text-xs font-medium text-[var(--text-muted)] truncate">
                {brandModelText}
              </p>
            )}

            <div className="flex items-center gap-1 text-xs text-[var(--text-dim)] pt-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(listing.published_at)}</span>
            </div>
          </div>

          {/* Right Column: Price, Compare & Favorite Button */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 shrink-0 pl-3 pr-1 border-l border-[var(--border-app)]/60">
            <div className="text-right">
              {listing.previous_price && listing.price < listing.previous_price && (
                <div className="text-xs font-semibold text-[var(--text-muted)] line-through">
                  {formatCurrency(listing.previous_price)}
                </div>
              )}
              <div className="text-xl lg:text-2xl font-black text-[#FF8A1F] tracking-tight whitespace-nowrap">
                {formatCurrency(listing.price)}
              </div>
            </div>

            <div className="relative z-20 flex items-center gap-1.5 pointer-events-auto">
              <CompareButton
                listing={listing}
                variant="icon"
                className="!bg-[var(--bg-surface)] hover:!bg-[var(--bg-surface-secondary)] !text-[var(--text-main)] hover:!text-[#FF8A1F] border border-[var(--border-app)] hover:border-[#FF8A1F]/50"
              />
              <FavoriteButton
                listingId={listing.id}
                initialCount={listing.favorite_count}
                initialIsFavorited={listing.is_favorited}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Mobile View: Compact Card Layout (No horizontal table overflow!) */}
        <div className="sm:hidden flex flex-col p-3 space-y-3">
          <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden bg-[var(--bg-surface-secondary)]">
            <img
              src={displayImage}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
              {listing.is_featured && (
                <FeaturedBadge className="h-6 w-6" />
              )}
            </div>
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-auto">
              <CompareButton
                listing={listing}
                variant="icon"
                className="w-8 h-8 !bg-black/60 backdrop-blur-md hover:!bg-black/80"
              />
              <FavoriteButton
                listingId={listing.id}
                initialCount={listing.favorite_count}
                initialIsFavorited={listing.is_favorited}
                size="sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text-main)] truncate">
              {listing.title}
            </h3>
            {brandModelText && (
              <p className="text-xs font-medium text-[var(--text-muted)] truncate">
                {brandModelText}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-app)] text-xs">
            <div className="text-lg font-extrabold text-[#FF8A1F] tracking-tight">
              {formatCurrency(listing.price)}
            </div>
            <div className="flex items-center gap-1 text-[var(--text-dim)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(listing.published_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
