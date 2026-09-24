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

  async getListingById(id: string, viewerProfileId?: string) {
    return getListingById(id, viewerProfileId);
  }

  async createListing(input: CreateListingInput, profileId: string) {
    return createListingWithCredit(input as any, profileId);
  }

  async updateListing(id: string, input: Partial<CreateListingInput>, profileId: string) {
    return updateListing(id, input as any, profileId);
  }

  async markListingAsSold(id: string, profileId: string) {
    return markListingAsSold(id, profileId);
  }

  async getUserListings(profileId: string) {
    return getUserListings(profileId);
  }

  async toggleFavorite(profileId: string, listingId: string, userId?: string) {
    return toggleFavorite(profileId, listingId, userId);
  }

  async getUserFavorites(profileId: string, userId?: string) {
    return getUserFavorites(profileId, userId);
  }
}
