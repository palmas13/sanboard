'use client';

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useCompare, ComparePreviewItem } from './CompareContext';
import { Listing, MemberListingDetail, PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';

interface CompareButtonProps {
  listing: Listing | MemberListingDetail | PublicListingSummary;
  className?: string;
  variant?: 'default' | 'icon';
}

export function CompareButton({ listing, className = '', variant = 'default' }: CompareButtonProps) {
  const { isInCompare, addToCompare, removeFromCompare, setIsTrayOpen } = useCompare();

  // Property listings cannot be compared
  if (listing.category !== 'vehicle') {
    return null;
  }

  const added = isInCompare(listing.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (added) {
      removeFromCompare(listing.id);
    } else {
      const coverImg =
        (listing as any).cover_image ||
        (listing as any).images?.find((img: any) => img.is_cover)?.storage_path ||
        (listing as any).images?.[0]?.storage_path;

      const previewItem: ComparePreviewItem = {
        id: listing.id,
        title: listing.title,
        image: coverImg ? resolveMediaUrl(coverImg) : undefined,
        price: listing.price,
        subcategory: listing.subcategory,
        brand: (listing as any).vehicle_details?.brand || (listing as any).brand,
        model: (listing as any).vehicle_details?.model || (listing as any).model,
      };

      const res = addToCompare(previewItem);
      if (!res.success && res.reason === 'LIMIT_REACHED') {
        setIsTrayOpen(true);
      }
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
          added
            ? 'bg-[#FF8A1F] text-white shadow-md shadow-[#FF8A1F]/30 scale-105'
            : 'bg-black/60 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/80 hover:scale-105'
        } ${className}`}
        title={added ? 'Karşılaştırmadan Çıkar' : 'Karşılaştırmaya Ekle'}
        aria-label={added ? 'Karşılaştırmadan Çıkar' : 'Karşılaştırmaya Ekle'}
      >
        <ArrowLeftRight className={`w-3.5 h-3.5 ${added ? 'text-white' : 'text-white/90'}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
        added
          ? 'bg-[#FF8A1F]/15 text-[#FF8A1F] border border-[#FF8A1F]/40 hover:bg-[#FF8A1F]/25 shadow-sm'
          : 'bg-[var(--bg-surface-secondary)] text-[var(--text-main)] border border-[var(--border-app)] hover:border-[#FF8A1F]/50 hover:text-[#FF8A1F]'
      } ${className}`}
      title={added ? 'Karşılaştırma listesinden çıkar' : 'İlanı karşılaştırmaya ekle'}
    >
      <ArrowLeftRight className={`w-3.5 h-3.5 ${added ? 'text-[#FF8A1F]' : 'text-[var(--text-muted)]'}`} />
      <span>{added ? 'Karşılaştırmadan Çıkar' : 'İlan Karşılaştır'}</span>
    </button>
  );
}
