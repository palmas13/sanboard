'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Trash2, X } from 'lucide-react';
import type { Listing } from '@/types';
import { usePropertyCompare } from '@/components/compare/PropertyCompareContext';
import { PropertyComparisonGrid } from '@/components/compare/PropertyComparisonGrid';

export default function PropertyComparisonPage() {
  const { compareIds, removeFromCompare, clearCompare } = usePropertyCompare();
  const [listings, setListings] = useState<(Listing | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!compareIds.length) { setListings([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/listings/compare/properties?ids=${compareIds.join(',')}`)
      .then((response) => response.json())
      .then((data) => setListings(data.success && Array.isArray(data.listings) ? data.listings : []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [compareIds]);

  const validListings = listings.filter((listing): listing is Listing => Boolean(listing));

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="surface-card flex flex-col gap-4 rounded-2xl border border-[var(--border-app)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--text-main)]"><ArrowLeftRight className="h-6 w-6 text-[#FF8A1F]" />Mülkleri Karşılaştır</h1><p className="mt-1 text-xs text-[var(--text-muted)]">İki veya üç mülkü mevcut ilan özellikleriyle yan yana inceleyin.</p></div>
      {compareIds.length > 0 && <button type="button" onClick={clearCompare} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"><Trash2 className="h-3.5 w-3.5" />Sıfırla</button>}
    </header>

    {loading ? <div className="surface-card h-56 animate-pulse rounded-2xl" /> : compareIds.length < 2 ? <div className="surface-card rounded-2xl p-12 text-center"><p className="font-bold text-[var(--text-main)]">Karşılaştırma için en az 2 mülk seçin.</p><Link href="/mulk" className="btn-primary mt-4 inline-flex px-4 py-2 text-xs">Mülk İlanlarına Dön</Link></div> : <>
      <div className={`grid grid-cols-1 gap-3 ${compareIds.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {compareIds.map((id, index) => <div key={id} className={`surface-card flex items-center justify-between rounded-xl border p-3 ${listings[index] ? 'border-[var(--border-app)]' : 'border-red-500/30'}`}><span className="truncate text-xs font-bold text-[var(--text-main)]">{listings[index]?.title || 'İlan artık karşılaştırılamıyor'}</span><button type="button" onClick={() => removeFromCompare(id)} aria-label="Mülkü kaldır"><X className="h-4 w-4 text-[var(--text-dim)]" /></button></div>)}
      </div>
      {validListings.length >= 2 ? <PropertyComparisonGrid listings={validListings} /> : <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Seçili ilanlardan biri artık aktif değil. Devam etmek için geçersiz ilanı kaldırın.</div>}
    </>}
  </div>;
}