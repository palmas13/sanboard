import type { ListingFilterParams } from '@/lib/db/listings';

interface SortablePublicListing {
  id: string;
  price: number;
  published_at?: string | null;
  created_at?: string | null;
  is_featured?: boolean;
  favorite_count?: number;
}

export function sortPublicListings<T extends SortablePublicListing>(
  listings: T[],
  sort: ListingFilterParams['sort'] = 'newest',
  getFavoriteCount: (listing: T) => number = (listing) => listing.favorite_count || 0
): T[] {
  return [...listings].sort((a, b) => {
    if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
      return a.is_featured ? -1 : 1;
    }

    switch (sort) {
      case 'price_asc':
        return a.price - b.price;
      case 'price_desc':
        return b.price - a.price;
      case 'popular':
        return getFavoriteCount(b) - getFavoriteCount(a);
      case 'oldest':
        return listingTime(a) - listingTime(b);
      case 'newest':
      default:
        return listingTime(b) - listingTime(a);
    }
  });
}

function listingTime(listing: SortablePublicListing): number {
  return new Date(listing.published_at || listing.created_at || 0).getTime();
}