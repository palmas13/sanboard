'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, X, ArrowRight, Plus } from 'lucide-react';
import { useCompare } from './CompareContext';
import { formatCurrency } from '@/lib/utils/format';

export function CompareTray() {
  const pathname = usePathname();
  const { compareIds, removeFromCompare, clearCompare, previews, toastMessage, clearToast } = useCompare();

  // Only render on vehicle pages and listing detail pages
  const isRelevantPage =
    pathname?.startsWith('/arac') ||
    pathname?.startsWith('/ilan');

  // Never render on auth, admin, or account pages
  const isExcludedPage =
    pathname?.startsWith('/hesabim') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/giris') ||
    pathname?.startsWith('/kayit') ||
    pathname?.startsWith('/arac/karsilastir'); // Already on the compare page!

  if (!isRelevantPage || isExcludedPage || compareIds.length === 0) {
    return null;
  }

  const slot1 = previews[compareIds[0]];
  const slot2 = compareIds[1] ? previews[compareIds[1]] : null;
  const isReady = compareIds.length === 2;

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pb-[env(safe-area-inset-bottom)]">
      {/* Toast Notification if triggered */}
      {toastMessage && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#FF8A1F] text-white text-xs font-semibold shadow-lg">
          <span className="truncate">{toastMessage}</span>
          <button
            type="button"
            onClick={clearToast}
            className="text-white/80 hover:text-white ml-2 p-0.5 shrink-0"
            aria-label="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Floating Bar */}
      <div className="surface-card bg-[var(--bg-surface-secondary)]/95 backdrop-blur-md p-2.5 sm:p-3.5 rounded-2xl border border-[var(--border-app)] shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
        {/* Mobile top row / Desktop left & center: Header & Slots */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
          {/* Left: Tray Icon & Count */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FF8A1F]/15 border border-[#FF8A1F]/30 flex items-center justify-center text-[#FF8A1F]">
              <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="hidden md:block">
              <span className="text-xs font-bold text-[var(--text-main)] block">Araç Kıyasla</span>
              <span className="text-[10px] text-[var(--text-muted)] block">{compareIds.length} / 2 araç</span>
            </div>
          </div>

          {/* Slots */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
            {/* Slot 1 */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] flex-1 min-w-0 max-w-[200px]">
              {slot1?.image && (
                <img
                  src={slot1.image}
                  alt=""
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-bold text-[var(--text-main)] truncate leading-tight">
                  {slot1?.brand || slot1?.model || slot1?.title || 'İlan 1'}
                </p>
                {slot1?.price ? (
                  <p className="text-[9px] sm:text-[10px] text-[#FF8A1F] font-semibold truncate leading-tight">{formatCurrency(slot1.price)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeFromCompare(compareIds[0])}
                className="text-[var(--text-dim)] hover:text-red-400 p-0.5 transition-colors cursor-pointer shrink-0"
                title="Kaldır"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            <span className="text-[10px] sm:text-xs text-[var(--text-dim)] font-bold shrink-0">vs</span>

            {/* Slot 2 */}
            {slot2 ? (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] flex-1 min-w-0 max-w-[200px]">
                {slot2.image && (
                  <img
                    src={slot2.image}
                    alt=""
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-bold text-[var(--text-main)] truncate leading-tight">
                    {slot2.brand || slot2.model || slot2.title || 'İlan 2'}
                  </p>
                  {slot2.price ? (
                    <p className="text-[9px] sm:text-[10px] text-[#FF8A1F] font-semibold truncate leading-tight">{formatCurrency(slot2.price)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCompare(compareIds[1])}
                  className="text-[var(--text-dim)] hover:text-red-400 p-0.5 transition-colors cursor-pointer shrink-0"
                  title="Kaldır"
                >
                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 sm:py-2 rounded-xl border border-dashed border-[var(--border-app)] text-[var(--text-dim)] text-[10px] sm:text-[11px] flex-1 min-w-0 max-w-[200px]">
                <Plus className="w-3 h-3 text-[#FF8A1F] shrink-0" />
                <span className="truncate">2. Araç Seç</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Row on Mobile / Right Column on Desktop */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[var(--border-app)]/50">
          <div className="sm:hidden text-[10px] text-[var(--text-dim)] font-medium">
            {isReady ? '2 / 2 araç hazır' : '1 araç daha ekleyin'}
          </div>

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {isReady ? (
              <Link
                href="/arac/karsilastir"
                className="btn-primary text-xs py-1.5 sm:py-2 px-3 sm:px-3.5 flex items-center justify-center gap-1.5 font-bold shadow-md shadow-[#FF8A1F]/20 whitespace-nowrap animate-pulse"
              >
                <span>Karşılaştır</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <span className="text-[11px] text-[var(--text-dim)] hidden sm:inline-block font-medium">
                1 araç daha ekleyin
              </span>
            )}

            <button
              type="button"
              onClick={clearCompare}
              className="text-[10px] text-[var(--text-dim)] hover:text-red-400 underline ml-1 cursor-pointer"
              title="Tümünü temizle"
            >
              Temizle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
