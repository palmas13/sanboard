import React from 'react';
import { getListingRepository } from '@/lib/db/repositories';
import { FilterSidebar } from '@/components/listings/FilterSidebar';
import { MobileFilterDrawer } from '@/components/listings/MobileFilterDrawer';
import { PropertyListingsView } from '@/components/listings/PropertyListingsView';
import { Home } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 30;

export default async function PropertyListingsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  const subcategory = typeof resolvedParams.subcategory === 'string' ? resolvedParams.subcategory : undefined;
  const query = typeof resolvedParams.q === 'string' ? resolvedParams.q : undefined;
  const minPrice = typeof resolvedParams.minPrice === 'string' ? Number(resolvedParams.minPrice) : undefined;
  const maxPrice = typeof resolvedParams.maxPrice === 'string' ? Number(resolvedParams.maxPrice) : undefined;
  const location = typeof resolvedParams.location === 'string' ? resolvedParams.location : undefined;
  const roomCount = typeof resolvedParams.roomCount === 'string' ? resolvedParams.roomCount : undefined;
  const furnished = typeof resolvedParams.furnished === 'string' ? (resolvedParams.furnished as any) : undefined;
  const balcony = typeof resolvedParams.balcony === 'string' ? (resolvedParams.balcony as any) : undefined;
  const buildingType = typeof resolvedParams.buildingType === 'string' ? (resolvedParams.buildingType as any) : undefined;
  const sort = typeof resolvedParams.sort === 'string' ? (resolvedParams.sort as any) : 'newest';

  const repo = getListingRepository();
  const listings = await repo.getPublicListings({
    category: 'property',
    subcategory,
    query,
    minPrice,
    maxPrice,
    location,
    roomCount,
    furnished,
    balcony,
    buildingType,
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
            <span className="text-[var(--text-muted)]">Mülk İlanları</span>
            {subcategory && (
              <>
                <span>/</span>
                <span className="text-[#FF8A1F] font-semibold">{subcategory}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] mt-1 flex items-center gap-2.5">
            <Home className="w-7 h-7 text-[#FF8A1F]" />
            <span>Mülk İlanları</span>
          </h1>
        </div>

        <MobileFilterDrawer category="property" />
      </div>

      {/* Main Grid: Left Filters, Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Desktop Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-1 sticky top-20">
          <FilterSidebar category="property" />
        </div>

        {/* Results Column */}
        <div className="lg:col-span-3 space-y-6">
          <PropertyListingsView listings={listings} />
        </div>
      </div>
    </div>
  );
}
