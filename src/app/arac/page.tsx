import React from 'react';
import { getPublicListings } from '@/lib/db/listings';
import { ListingCard } from '@/components/listings/ListingCard';
import { FilterSidebar } from '@/components/listings/FilterSidebar';
import { MobileFilterDrawer } from '@/components/listings/MobileFilterDrawer';
import { ListingSortBar } from '@/components/listings/ListingSortBar';
import { Car } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 0;

export default async function VehicleListingsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  const subcategory = typeof resolvedParams.subcategory === 'string' ? resolvedParams.subcategory : undefined;
  const query = typeof resolvedParams.q === 'string' ? resolvedParams.q : undefined;
  const minPrice = typeof resolvedParams.minPrice === 'string' ? Number(resolvedParams.minPrice) : undefined;
  const maxPrice = typeof resolvedParams.maxPrice === 'string' ? Number(resolvedParams.maxPrice) : undefined;
  const location = typeof resolvedParams.location === 'string' ? resolvedParams.location : undefined;
  const minMileage = typeof resolvedParams.minMileage === 'string' ? Number(resolvedParams.minMileage) : undefined;
  const maxMileage = typeof resolvedParams.maxMileage === 'string' ? Number(resolvedParams.maxMileage) : undefined;
  const brand = typeof resolvedParams.brand === 'string' && resolvedParams.brand !== 'all' ? resolvedParams.brand : undefined;
  const model = typeof resolvedParams.model === 'string' && resolvedParams.model !== 'all' ? resolvedParams.model : undefined;
  const turbo = typeof resolvedParams.turbo === 'string' ? (resolvedParams.turbo as any) : undefined;
  const subwoofer = typeof resolvedParams.subwoofer === 'string' ? (resolvedParams.subwoofer as any) : undefined;
  const trade = typeof resolvedParams.trade === 'string' ? (resolvedParams.trade as any) : undefined;
  const sort = typeof resolvedParams.sort === 'string' ? (resolvedParams.sort as any) : 'newest';

  const listings = await getPublicListings({
    category: 'vehicle',
    subcategory,
    query,
    minPrice,
    maxPrice,
    location,
    brand,
    model,
    minMileage,
    maxMileage,
    turbo,
    subwoofer,
    trade,
    sort,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <span>Ana Sayfa</span>
            <span>/</span>
            <span className="text-[var(--text-muted)]">Araç İlanları</span>
            {subcategory && (
              <>
                <span>/</span>
                <span className="text-[#FF8A1F] font-semibold">{subcategory}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] mt-1 flex items-center gap-2.5">
            <Car className="w-7 h-7 text-[#FF8A1F]" />
            <span>San Andreas Araç İlanları</span>
          </h1>
        </div>

        <MobileFilterDrawer category="vehicle" />
      </div>

      {/* Main Grid: Left Filters, Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Desktop Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-1 sticky top-20">
          <FilterSidebar category="vehicle" />
        </div>

        {/* Results Column */}
        <div className="lg:col-span-3 space-y-6">
          <ListingSortBar totalCount={listings.length} />

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="surface-card p-12 text-center space-y-3">
              <p className="text-base font-bold text-[var(--text-main)]">
                Bu filtrelere uygun araç ilanı bulunamadı.
              </p>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Filtre kriterlerinizi genişleterek veya arama kelimesini değiştirerek tekrar deneyebilirsiniz.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
