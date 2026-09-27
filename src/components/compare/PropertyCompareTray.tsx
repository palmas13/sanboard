'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, X } from 'lucide-react';
import { usePropertyCompare } from './PropertyCompareContext';

export function PropertyCompareTray() {
  const pathname = usePathname();
  const { compareIds, previews, removeFromCompare, clearCompare } = usePropertyCompare();
  if ((!pathname?.startsWith('/mulk') && !pathname?.startsWith('/ilan')) || pathname?.startsWith('/mulk/karsilastir') || !compareIds.length) return null;

  return <div className="fixed bottom-3 left-1/2 z-50 w-[95%] max-w-3xl -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
    <div className="surface-card flex flex-col gap-3 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/95 p-3 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 shrink-0 text-[#FF8A1F]" />
        <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
          {compareIds.map((id) => <div key={id} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--text-main)]">{previews[id]?.title || 'Mülk ilanı'}</span>
            <button type="button" onClick={() => removeFromCompare(id)} aria-label="Karşılaştırmadan kaldır"><X className="h-3.5 w-3.5 text-[var(--text-dim)] hover:text-red-400" /></button>
          </div>)}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">{compareIds.length} / 3 mülk</span>
        {compareIds.length >= 2 && <Link href="/mulk/karsilastir" className="btn-primary px-3 py-2 text-xs font-bold">Karşılaştır</Link>}
        <button type="button" onClick={clearCompare} className="text-[10px] text-[var(--text-dim)] hover:text-red-400">Temizle</button>
      </div>
    </div>
  </div>;
}