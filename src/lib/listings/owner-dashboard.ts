import type { Listing, ListingCategory, ListingStatus } from '@/types';

export type OwnerDashboardStatus = Extract<ListingStatus, 'ACTIVE' | 'EXPIRED' | 'SOLD'>;
export type OwnerDashboardType = 'ALL' | ListingCategory;

export interface OwnerDashboardFilters {
  status: OwnerDashboardStatus;
  type: OwnerDashboardType;
  query: string;
}

export function getOwnerDashboardCounts(listings: Listing[]) {
  return listings.reduce(
    (counts, listing) => {
      if (listing.status === 'ACTIVE' || listing.status === 'EXPIRED' || listing.status === 'SOLD') {
        counts[listing.status] += 1;
      }
      return counts;
    },
    { ACTIVE: 0, EXPIRED: 0, SOLD: 0 } as Record<OwnerDashboardStatus, number>
  );
}

export function filterOwnerDashboardListings(listings: Listing[], filters: OwnerDashboardFilters) {
  const query = filters.query.trim().toLocaleLowerCase('tr-TR');

  return listings.filter((listing) => {
    if (listing.status !== filters.status) return false;
    if (filters.type !== 'ALL' && listing.category !== filters.type) return false;
    if (!query) return true;

    return [listing.title, listing.listing_number, listing.public_id, listing.category, listing.subcategory]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(query));
  });
}