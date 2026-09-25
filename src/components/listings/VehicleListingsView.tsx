'use client';

import React, { useState, useEffect } from 'react';
import { PublicListingSummary } from '@/types';
import { VehicleListingRow } from './VehicleListingRow';
import { ListingCard } from './ListingCard';
import { ListingSortBar } from './ListingSortBar';
import { ActiveFilterChips } from './ActiveFilterChips';

interface VehicleListingsViewProps {
  listings: PublicListingSummary[];
}

const STORAGE_KEY_VIEW = 'sanboard_vehicle_view';

export function VehicleListingsView({ listings }: VehicleListingsViewProps) {
  // Vehicle page default is LIST
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore saved view mode preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW);
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved);
      }
    } catch (e) {
      // Ignore storage access error
    }
    setIsHydrated(true);
  }, []);

  const handleViewChange = (newMode: 'list' | 'grid') => {
    setViewMode(newMode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, newMode);
    } catch (e) {
      // Ignore storage access error
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Sort Bar & View Mode Switcher */}
      <ListingSortBar
        totalCount={listings.length}
        viewMode={viewMode}
        onViewChange={handleViewChange}
        showViewToggle={true}
      />

      {/* Active Filter Chips */}
      <ActiveFilterChips baseRoute="/arac" />

      {/* Results Content */}
      {listings.length > 0 ? (
        viewMode === 'list' ? (
          <div className="space-y-3">
            {listings.map((listing) => (
              <VehicleListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )
      ) : (
        <div className="surface-card p-12 text-center space-y-3 rounded-2xl border border-[var(--border-app)]">
          <p className="text-base font-bold text-[var(--text-main)]">
            Bu filtrelere uygun araç ilanı bulunamadı.
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Filtre kriterlerinizi genişleterek veya arama kelimesini değiştirerek tekrar deneyebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
