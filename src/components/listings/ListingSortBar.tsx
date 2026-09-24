'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';

interface ListingSortBarProps {
  totalCount: number;
}

export function ListingSortBar({ totalCount }: ListingSortBarProps) {
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

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">Sıralama:</span>
        <select
          value={currentSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="form-input text-xs py-1.5 px-2.5 w-auto"
        >
          <option value="newest">En Yeni</option>
          <option value="price_asc">Fiyat: Artan</option>
          <option value="price_desc">Fiyat: Azalan</option>
          <option value="popular">En Çok Favorilenen</option>
        </select>
      </div>
    </div>
  );
}
