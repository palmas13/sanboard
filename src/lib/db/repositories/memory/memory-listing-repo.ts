import { IListingRepository, CreateListingInput } from '../types';
import {
  getPublicListings,
  getListingById,
  createListingWithCredit,
  updateListing,
  markListingAsSold,
  republishListing,
  getUserListings,
  toggleFavorite,
  getUserFavorites,
  ListingFilterParams,
} from '../../listings';

export class MemoryListingRepository implements IListingRepository {
  async getPublicListings(params?: ListingFilterParams) {
    return getPublicListings(params);
  }

  async getSimilarListings(currentListingId: string, limit?: number) {
    const { getSimilarListings: fetchSimilar } = await import('../../listings');
    return fetchSimilar(currentListingId, limit);
  }

  async getCompareListings(ids: string[]) {
    const { getCompareListings: fetchCompare } = await import('../../listings');
    return fetchCompare(ids);
  }

  async getListingById(id: string, viewerProfileId?: string, viewerUserId?: string) {
    return getListingById(id, viewerProfileId, viewerUserId);
  }

  async createListing(input: CreateListingInput, profileId: string) {
    return createListingWithCredit(input as any, profileId);
  }

  async updateListing(id: string, input: Partial<CreateListingInput>, profileId: string, userId?: string, role?: string) {
    return updateListing(id, input as any, profileId, userId, role);
  }

  async markListingAsSold(id: string, profileId: string) {
    return markListingAsSold(id, profileId);
  }

  async republishListing(id: string, profileId: string) {
    return republishListing(id, profileId);
  }

  async getUserListings(profileId: string) {
    return getUserListings(profileId);
  }

  async getCorporateListings(corporateProfileId: string) {
    const { getCorporateListings: fetchCorporate } = await import('../../listings');
    return fetchCorporate(corporateProfileId);
  }

  async toggleFavorite(listingId: string, profileId: string) {
    return toggleFavorite(profileId, listingId);
  }

  async setFavorite(listingId: string, profileId: string, isFavorited: boolean) {
    const existing = (await this.getFavoriteStates([listingId], profileId))[listingId]?.isFavorited;
    if (existing !== isFavorited) {
      return toggleFavorite(profileId, listingId);
    }
    return {
      isFavorited,
      count: (await this.getFavoriteStates([listingId], profileId))[listingId]?.count || 0,
    };
  }

  async removeFavorite(listingId: string, profileId: string) {
    const res = await toggleFavorite(profileId, listingId);
    if (res.isFavorited) {
      const secondRes = await toggleFavorite(profileId, listingId);
      return { success: true, count: secondRes.count };
    }
    return { success: true, count: res.count };
  }

  async getUserFavorites(profileId: string) {
    return getUserFavorites(profileId);
  }

  async getFavoriteStates(listingIds: string[], profileId?: string) {
    const { db } = await import('../../store');
    const ids = new Set(listingIds);
    const states: Record<string, { isFavorited: boolean; count: number }> = {};
    for (const listingId of ids) {
      const rows = db.favorites.filter((favorite) => favorite.listing_id === listingId);
      states[listingId] = {
        isFavorited: Boolean(profileId && rows.some((favorite) => favorite.profile_id === profileId)),
        count: rows.length,
      };
    }
    return states;
  }

  async removeListing(id: string, profileId: string) {
    const { removeListing } = await import('../../listings');
    return removeListing(id, profileId);
  }
}
