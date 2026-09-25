'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ArrowLeft, Trash2, ExternalLink, Sparkles, Building2, User, AlertCircle } from 'lucide-react';
import { useCompare } from '@/components/compare/CompareContext';
import { VehicleComparisonTable } from '@/components/compare/VehicleComparisonTable';
import { Listing } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { resolveMediaUrl } from '@/lib/media/url';

export default function VehicleComparisonPage() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const [listings, setListings] = useState<(Listing | null)[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch full listing details when compareIds change
  useEffect(() => {
    if (compareIds.length === 0) {
      setListings([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    fetch(`/api/listings/compare?ids=${compareIds.join(',')}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled) {
          if (data.success && Array.isArray(data.listings)) {
            setListings(data.listings);
          } else {
            setListings([]);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Error fetching compare data:', err);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [compareIds]);

  const listingA = listings[0] || null;
  const listingB = listings[1] || null;

  const fallbackImage =
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80';

  const renderTopCard = (
    listing: Listing | null,
    id: string | undefined,
    slotNumber: number
  ) => {
    if (!id) {
      // Empty slot (no listing selected for this slot)
      return (
        <div className="surface-card p-6 sm:p-8 rounded-2xl border border-dashed border-[var(--border-app)] text-center flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] flex items-center justify-center text-[var(--text-dim)]">
            <ArrowLeftRight className="w-5 h-5 text-[#FF8A1F]" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-main)]">
            {slotNumber === 1 ? 'İlk Aracı Seçin' : 'İkinci Bir Araç Seçin'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            {slotNumber === 1
              ? 'Karşılaştırma yapmak için araç ilanlarından en az bir ilan ekleyin.'
              : 'İki aracı yan yana karşılaştırmak için araç ilanlarına dönüp ikinci bir araç seçin.'}
          </p>
          <Link
            href="/arac"
            className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 font-semibold mt-2"
          >
            <span>Araç İlanlarına Dön</span>
          </Link>
        </div>
      );
    }

    if (!listing) {
      // ID was stored, but listing is missing/expired/removed/corporate suspended
      return (
        <div className="surface-card p-6 rounded-2xl border border-red-500/20 text-center flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-main)]">İlan Artık Mevcut Değil</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            Bu ilan yayından kaldırılmış, süresi dolmuş veya artık karşılaştırılamıyor olabilir.
          </p>
          <button
            type="button"
            onClick={() => removeFromCompare(id)}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 text-red-400 border-red-500/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Listeden Kaldır</span>
          </button>
        </div>
      );
    }

    const coverImg =
      listing.images?.find((img) => img.is_cover)?.storage_path ||
      listing.images?.[0]?.storage_path;
    const displayImg = resolveMediaUrl(coverImg) || fallbackImage;
    const isCorporate = listing.seller_type === 'CORPORATE';
    const brandModel =
      [listing.vehicle_details?.brand, listing.vehicle_details?.model].filter(Boolean).join(' ') ||
      listing.subcategory;

    return (
      <div className="surface-card rounded-2xl border border-[var(--border-app)] overflow-hidden flex flex-col justify-between shadow-sm">
        <div>
          {/* Cover Photo */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-surface-secondary)]">
            <img
              src={displayImg}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
              {listing.is_featured && (
                <span className="badge-tag bg-gradient-to-r from-amber-500 to-[#FF8A1F] text-white border-amber-400/30 font-extrabold text-[9px] uppercase px-1.5 py-0.5 shadow-md flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-white fill-white" />
                  ÖNE ÇIKAN
                </span>
              )}
              <span className="badge-tag bg-black/65 backdrop-blur-md text-white border-white/10 text-[10px]">
                {listing.subcategory}
              </span>
            </div>

            <button
              type="button"
              onClick={() => removeFromCompare(id)}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-red-400 hover:bg-black/80 transition-colors cursor-pointer"
              title="Karşılaştırmadan Kaldır"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Details */}
          <div className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2">
              {isCorporate ? (
                <span className="badge-tag bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Kurumsal
                </span>
              ) : (
                <span className="badge-tag bg-zinc-700/30 text-[var(--text-muted)] border-zinc-700/50 text-[10px] font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Bireysel
                </span>
              )}
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                {listing.listing_number}
              </span>
            </div>

            <h3 className="text-lg font-bold text-[var(--text-main)] truncate" title={brandModel}>
              {brandModel}
            </h3>
            <p className="text-xs text-[var(--text-muted)] line-clamp-1">{listing.title}</p>

            <div className="pt-2">
              {listing.previous_price && listing.price < listing.previous_price && (
                <div className="text-xs font-semibold text-[var(--text-muted)] line-through">
                  {formatCurrency(listing.previous_price)}
                </div>
              )}
              <div className="text-2xl font-black text-[#FF8A1F] tracking-tight">
                {formatCurrency(listing.price)}
              </div>
            </div>
          </div>
        </div>

        {/* Action Link to Listing Page */}
        <div className="p-4 pt-0">
          <Link
            href={`/ilan/${listing.id}`}
            className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 font-semibold"
          >
            <span>İlana Git</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
          <Link href="/" className="hover:text-[var(--text-main)] transition-colors">
            Ana Sayfa
          </Link>
          <span>/</span>
          <Link href="/arac" className="hover:text-[var(--text-main)] transition-colors">
            Araç İlanları
          </Link>
          <span>/</span>
          <span className="text-[#FF8A1F] font-semibold">Karşılaştır</span>
        </div>

        <Link
          href="/arac"
          className="text-xs text-[var(--text-muted)] hover:text-[#FF8A1F] flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Araç İlanlarına Dön</span>
        </Link>
      </div>

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] flex items-center gap-3">
            <ArrowLeftRight className="w-7 h-7 text-[#FF8A1F]" />
            <span>İlanları Karşılaştır</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Seçtiğiniz araç ilanlarını teknik özellikleri ve fiyatlarıyla yan yana kıyaslayın.
          </p>
        </div>

        {compareIds.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="btn-secondary text-xs py-2 px-3 self-start sm:self-auto flex items-center gap-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Karşılaştırmayı Sıfırla</span>
          </button>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] animate-pulse h-80 bg-[var(--bg-surface-secondary)]/40" />
          <div className="surface-card p-8 rounded-2xl border border-[var(--border-app)] animate-pulse h-80 bg-[var(--bg-surface-secondary)]/40" />
        </div>
      ) : compareIds.length === 0 ? (
        <div className="surface-card p-12 text-center rounded-2xl border border-[var(--border-app)] space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#FF8A1F]/15 flex items-center justify-center text-[#FF8A1F]">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-main)]">Karşılaştırma Listeniz Boş</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Araç ilanları listesinden veya ilan detay sayfalarından &quot;İlan Karşılaştır&quot; butonuna basarak araçları listenize ekleyebilirsiniz.
          </p>
          <Link href="/arac" className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5 font-semibold">
            <span>Araç İlanlarına Göz At</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 2 Vehicle Cards Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {renderTopCard(listingA, compareIds[0], 1)}
            {renderTopCard(listingB, compareIds[1], 2)}
          </div>

          {/* Technical Specs Comparison Table */}
          {listingA && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF8A1F]" />
                <span>Teknik Özellik Kıyaslaması</span>
              </h2>
              <VehicleComparisonTable listingA={listingA} listingB={listingB} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
