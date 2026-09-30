'use client';

import React, { useEffect, useState } from 'react';
import type { PublicListingSummary } from '@/types';
import { ActiveFilterChips } from './ActiveFilterChips';
import { ListingCard } from './ListingCard';
import { ListingSortBar } from './ListingSortBar';
import { PropertyListingRow } from './PropertyListingRow';

const STORAGE_KEY_VIEW = 'sanboard_property_view';
const PAGE_SIZE = 8;

export function PropertyListingsView({ listings }: { listings: PublicListingSummary[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => setVisibleCount(PAGE_SIZE), [listings]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW);
      if (saved === 'grid' || saved === 'list') setViewMode(saved);
    } catch {
      // Storage may be unavailable in privacy-restricted browsers.
    }
  }, []);

  const handleViewChange = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, mode);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  };

  return (
    <div className="space-y-5">
      <ListingSortBar totalCount={listings.length} viewMode={viewMode} onViewChange={handleViewChange} showViewToggle />
      <ActiveFilterChips baseRoute="/mulk" />
      {listings.length > 0 ? viewMode === 'list' ? (
        <div className="space-y-3" data-testid="property-list-view">{listings.slice(0, visibleCount).map((listing) => <PropertyListingRow key={listing.id} listing={listing} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="property-grid-view">{listings.slice(0, visibleCount).map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
      ) : (
        <div className="surface-card space-y-3 rounded-2xl border border-[var(--border-app)] p-12 text-center"><p className="text-base font-bold text-[var(--text-main)]">Bu filtrelere uygun mülk ilanı bulunamadı.</p><p className="mx-auto max-w-sm text-xs text-[var(--text-muted)]">Filtre kriterlerinizi genişleterek veya arama kelimesini değiştirerek tekrar deneyebilirsiniz.</p></div>
      )}
      {visibleCount < listings.length && <div className="flex justify-center pt-2"><button type="button" onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, listings.length))} className="btn-secondary px-5 py-2.5 text-sm">Daha Fazla Göster</button></div>}
    </div>
  );
}