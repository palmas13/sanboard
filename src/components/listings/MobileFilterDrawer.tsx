'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { FilterSidebar } from './FilterSidebar';
import { ListingCategory } from '@/types';

interface MobileFilterDrawerProps {
  category: ListingCategory;
}

export function MobileFilterDrawer({ category }: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF8A1F]" />
        <span>Filtrele</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer content */}
          <div className="themed-scrollbar relative w-full max-w-sm h-full bg-[var(--bg-surface)] border-l border-[var(--border-app)] p-5 overflow-y-auto z-10 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">Filtreler</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg border border-[var(--border-app)] hover:bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <FilterSidebar
              category={category}
              className="border-none p-0 bg-transparent"
              onFilterChange={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
