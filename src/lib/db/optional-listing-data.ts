import { IListingRepository } from './repositories';
import { PublicListingSummary } from '@/types';

export async function getOptionalSimilarListings(
  repo: IListingRepository,
  listingId: string,
  limit: number
): Promise<PublicListingSummary[]> {
  try {
    if (repo.getSimilarListings) {
      return await repo.getSimilarListings(listingId, limit);
    }

    const { getSimilarListings } = await import('./listings');
    return await getSimilarListings(listingId, limit);
  } catch (error) {
    console.error(`Failed to load similar listings for listing ${listingId}:`, error);
    return [];
  }
}