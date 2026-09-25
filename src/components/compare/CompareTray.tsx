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
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      {/* Toast Notification if triggered */}
      {toastMessage && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#FF8A1F] text-white text-xs font-semibold shadow-lg">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={clearToast}
            className="text-white/80 hover:text-white ml-2 p-0.5"
            aria-label="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Floating Bar */}
      <div className="surface-card bg-[var(--bg-surface-secondary)]/95 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-[var(--border-app)] shadow-2xl flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Tray Icon & Count */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#FF8A1F]/15 border border-[#FF8A1F]/30 flex items-center justify-center text-[#FF8A1F]">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div className="hidden md:block">
            <span className="text-xs font-bold text-[var(--text-main)] block">Araç Kıyasla</span>
            <span className="text-[10px] text-[var(--text-muted)] block">{compareIds.length} / 2 araç</span>
          </div>
        </div>

        {/* Center: Slots */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Slot 1 */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] flex-1 min-w-0 max-w-[200px]">
            {slot1?.image && (
              <img
                src={slot1.image}
                alt=""
                className="w-7 h-7 rounded-md object-cover shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[var(--text-main)] truncate">
                {slot1?.brand || slot1?.model || slot1?.title || 'İlan 1'}
              </p>
              {slot1?.price ? (
                <p className="text-[10px] text-[#FF8A1F] font-semibold">{formatCurrency(slot1.price)}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeFromCompare(compareIds[0])}
              className="text-[var(--text-dim)] hover:text-red-400 p-0.5 transition-colors cursor-pointer"
              title="Kaldır"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-xs text-[var(--text-dim)] font-bold">vs</span>

          {/* Slot 2 */}
          {slot2 ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] flex-1 min-w-0 max-w-[200px]">
              {slot2.image && (
                <img
                  src={slot2.image}
                  alt=""
                  className="w-7 h-7 rounded-md object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[var(--text-main)] truncate">
                  {slot2.brand || slot2.model || slot2.title || 'İlan 2'}
                </p>
                {slot2.price ? (
                  <p className="text-[10px] text-[#FF8A1F] font-semibold">{formatCurrency(slot2.price)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeFromCompare(compareIds[1])}
                className="text-[var(--text-dim)] hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                title="Kaldır"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-dashed border-[var(--border-app)] text-[var(--text-dim)] text-[11px] flex-1 min-w-0 max-w-[200px]">
              <Plus className="w-3 h-3 text-[#FF8A1F]" />
              <span className="truncate">İkinci Araç Seç</span>
            </div>
          )}
        </div>

        {/* Right: CTA button */}
        <div className="flex items-center gap-2 shrink-0">
          {isReady ? (
            <Link
              href="/arac/karsilastir"
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-md shadow-[#FF8A1F]/20 whitespace-nowrap animate-pulse"
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
  );
}
