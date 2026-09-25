'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, LayoutGrid, List } from 'lucide-react';

interface ListingSortBarProps {
  totalCount: number;
  viewMode?: 'list' | 'grid';
  onViewChange?: (mode: 'list' | 'grid') => void;
  showViewToggle?: boolean;
}

export function ListingSortBar({
  totalCount,
  viewMode = 'list',
  onViewChange,
  showViewToggle = false,
}: ListingSortBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'newest';

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === 'newest') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
      <div className="text-sm font-semibold text-[var(--text-main)]">
        <span className="text-[#FF8A1F] font-bold">{totalCount}</span> ilan bulundu
      </div>

      <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
        {/* View mode toggle (List / Grid) */}
        {showViewToggle && onViewChange && (
          <div className="flex items-center bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onViewChange('list')}
              aria-label="Liste görünümü"
              className={`p-1.5 rounded-md text-xs flex items-center transition-all ${
                viewMode === 'list'
                  ? 'bg-[#FF8A1F] text-white shadow-sm font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange('grid')}
              aria-label="Kart görünümü"
              className={`p-1.5 rounded-md text-xs flex items-center transition-all ${
                viewMode === 'grid'
                  ? 'bg-[#FF8A1F] text-white shadow-sm font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Sıralama:</span>
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="form-input text-xs py-1.5 px-2.5 w-auto"
          >
            <option value="newest">En Yeni</option>
            <option value="oldest">En Eski</option>
            <option value="price_asc">Fiyat: Düşük → Yüksek</option>
            <option value="price_desc">Fiyat: Yüksek → Düşük</option>
            <option value="popular">En Çok Favorilenen</option>
          </select>
        </div>
      </div>
    </div>
  );
}
