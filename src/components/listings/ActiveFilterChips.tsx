'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

interface ActiveFilterChipsProps {
  baseRoute?: string;
  className?: string;
}

export function ActiveFilterChips({ baseRoute = '/arac', className = '' }: ActiveFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read active params
  const subcategory = searchParams.get('subcategory');
  const brand = searchParams.get('brand');
  const model = searchParams.get('model');
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const sellerType = searchParams.get('sellerType') || searchParams.get('satici');
  const query = searchParams.get('q');
  const turbo = searchParams.get('turbo');
  const trade = searchParams.get('trade');

  interface FilterChip {
    id: string;
    label: string;
    keysToRemove: string[];
  }

  const chips: FilterChip[] = [];

  if (subcategory && subcategory !== 'all') {
    chips.push({ id: 'subcategory', label: subcategory, keysToRemove: ['subcategory'] });
  }

  if (brand && brand !== 'all') {
    chips.push({ id: 'brand', label: `Marka: ${brand}`, keysToRemove: ['brand', 'model'] });
  }

  if (model && model !== 'all') {
    chips.push({ id: 'model', label: `Model: ${model}`, keysToRemove: ['model'] });
  }

  if (minPrice || maxPrice) {
    let priceLabel = '';
    if (minPrice && maxPrice) {
      priceLabel = `${formatCurrency(Number(minPrice))} – ${formatCurrency(Number(maxPrice))}`;
    } else if (minPrice) {
      priceLabel = `Min: ${formatCurrency(Number(minPrice))}`;
    } else if (maxPrice) {
      priceLabel = `Maks: ${formatCurrency(Number(maxPrice))}`;
    }
    chips.push({ id: 'price', label: priceLabel, keysToRemove: ['minPrice', 'maxPrice'] });
  }

  if (sellerType && sellerType !== 'all') {
    const sLabel = sellerType === 'CORPORATE' ? 'Kurumsal' : 'Bireysel';
    chips.push({ id: 'sellerType', label: sLabel, keysToRemove: ['sellerType', 'satici'] });
  }

  if (query) {
    chips.push({ id: 'query', label: `"${query}"`, keysToRemove: ['q'] });
  }

  if (turbo && turbo === 'yes') {
    chips.push({ id: 'turbo', label: 'Turbo', keysToRemove: ['turbo'] });
  }

  if (trade && trade === 'yes') {
    chips.push({ id: 'trade', label: 'Takaslı', keysToRemove: ['trade'] });
  }

  if (chips.length === 0) return null;

  const removeChip = (keys: string[]) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    keys.forEach((k) => nextParams.delete(k));
    const nextUrl = nextParams.toString() ? `${baseRoute}?${nextParams.toString()}` : baseRoute;
    router.push(nextUrl);
  };

  const clearAll = () => {
    router.push(baseRoute);
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap text-xs ${className}`}>
      <span className="text-[var(--text-dim)] font-medium mr-1">Filtreler:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface-secondary)] text-[var(--text-main)] border border-[var(--border-app)] text-xs transition-colors hover:border-[#FF8A1F]/50"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => removeChip(chip.keysToRemove)}
            className="text-[var(--text-dim)] hover:text-[#FF8A1F] transition-colors p-0.5 rounded cursor-pointer"
            aria-label={`${chip.label} filtresini kaldır`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={clearAll}
        className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[#FF8A1F] transition-colors ml-1 font-medium cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        Filtreleri Temizle
      </button>
    </div>
  );
}
