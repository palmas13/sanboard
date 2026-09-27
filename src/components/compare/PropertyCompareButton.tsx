'use client';

import { ArrowLeftRight, Check } from 'lucide-react';
import type { Listing, MemberListingDetail, PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { usePropertyCompare } from './PropertyCompareContext';

export function PropertyCompareButton({ listing, compact = false }: { listing: Listing | MemberListingDetail | PublicListingSummary; compact?: boolean }) {
  const { addToCompare, removeFromCompare, isInCompare } = usePropertyCompare();
  if (listing.category !== 'property' || (listing.status && listing.status !== 'ACTIVE')) return null;
  const added = isInCompare(listing.id);

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (added) return removeFromCompare(listing.id);
    const rawImage = 'cover_image' in listing
      ? listing.cover_image
      : 'images' in listing
        ? listing.images?.find((image) => image.is_cover)?.storage_path || listing.images?.[0]?.storage_path
        : undefined;
    addToCompare({ id: listing.id, title: listing.title, image: resolveMediaUrl(rawImage), price: listing.price, subcategory: listing.subcategory });
  };

  return <button type="button" onClick={toggle} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${added ? 'border-[#FF8A1F]/40 bg-[#FF8A1F]/15 text-[#FF8A1F]' : 'border-[var(--border-app)] bg-[var(--bg-surface-secondary)] text-[var(--text-main)] hover:border-[#FF8A1F]/50 hover:text-[#FF8A1F]'}`} aria-label={added ? 'Mülkü karşılaştırmadan çıkar' : 'Mülkü karşılaştırmaya ekle'} title={added ? 'Karşılaştırmadan çıkar' : 'Karşılaştır'}>
    {added ? <Check className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
    {!compact && <span>{added ? 'Eklendi' : 'Karşılaştır'}</span>}
  </button>;
}