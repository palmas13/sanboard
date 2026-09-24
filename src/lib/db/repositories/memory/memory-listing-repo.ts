import { IListingRepository, CreateListingInput } from '../types';
import {
  getPublicListings,
  getListingById,
  createListingWithCredit,
  updateListing,
  markListingAsSold,
  getUserListings,
  toggleFavorite,
  getUserFavorites,
  ListingFilterParams,
} from '../../listings';

export class MemoryListingRepository implements IListingRepository {
  async getPublicListings(params?: ListingFilterParams) {
    return getPublicListings(params);
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

  async getUserListings(profileId: string) {
    return getUserListings(profileId);
  }

  async toggleFavorite(listingId: string, userId: string) {
    return toggleFavorite(userId, listingId, userId);
  }

  async removeFavorite(listingId: string, userId: string) {
    const res = await toggleFavorite(userId, listingId, userId);
    if (res.isFavorited) {
      const secondRes = await toggleFavorite(userId, listingId, userId);
      return { success: true, count: secondRes.count };
    }
    return { success: true, count: res.count };
  }

  async getUserFavorites(userId: string) {
    return getUserFavorites(undefined, userId);
  }
}
