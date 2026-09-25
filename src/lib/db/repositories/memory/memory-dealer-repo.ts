import { IDealerRepository } from '../types';
import {
  getDealerById,
  getDealerBySlug,
  getDealerByProfileId,
  getAllDealers,
  applyForDealer,
  getApplicationByProfileId,
  getAllApplications,
  reviewApplication,
  activateSubscription,
  boostListing,
  toggleFollow,
  getFollowers,
  isFollowing,
  updateDealerProfile,
  suspendCorporateStore,
  reactivateCorporateStore,
  deleteCorporateStore,
} from '../../dealers';
import { CorporateApplication, CorporateProfile, CharacterProfile } from '@/types';

export class MemoryDealerRepository implements IDealerRepository {
  async getDealerById(id: string): Promise<CorporateProfile | null> {
    return getDealerById(id);
  }

  async getDealerBySlug(slug: string): Promise<CorporateProfile | null> {
    return getDealerBySlug(slug);
  }

  async getDealerByProfileId(profileId: string, includeDeleted?: boolean): Promise<CorporateProfile | null> {
    return getDealerByProfileId(profileId, includeDeleted);
  }

  async getAllDealers(): Promise<CorporateProfile[]> {
    return getAllDealers();
  }

  async getApplicationByProfileId(profileId: string): Promise<CorporateApplication | null> {
    return getApplicationByProfileId(profileId);
  }

  async getAllApplications(): Promise<CorporateApplication[]> {
    return getAllApplications();
  }

  async createApplication(params: { profileId: string; companyName: string; purpose: string }) {
    const res = await applyForDealer(params);
    return res;
  }

  async reviewApplication(
    applicationId: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
    reviewerUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return reviewApplication(applicationId, status, rejectionReason, reviewerUserId);
  }

  async activateSubscription(dealerId: string): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
    return activateSubscription(dealerId);
  }

  async boostListing(
    dealerId: string,
    listingId: string
  ): Promise<{ success: boolean; error?: string; remainingBoosts?: number; featured_until?: string }> {
    return boostListing(dealerId, listingId);
  }

  async toggleFollow(
    followerProfileId: string,
    corporateProfileId: string
  ): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
    return toggleFollow(followerProfileId, corporateProfileId);
  }

  async getFollowers(corporateProfileId: string): Promise<CharacterProfile[]> {
    return getFollowers(corporateProfileId);
  }

  async isFollowing(followerProfileId: string, corporateProfileId: string): Promise<boolean> {
    return isFollowing(followerProfileId, corporateProfileId);
  }

  async updateDealerProfile(id: string, data: Partial<CorporateProfile>) {
    const dealer = await getDealerById(id);
    if (!dealer) return { success: false, error: 'Kurumsal profil bulunamadı.' };

    return updateDealerProfile(id, dealer.profile_id, data);
  }

  async suspendStore(dealerId: string, reason: string, adminProfileId: string) {
    return suspendCorporateStore(dealerId, reason, adminProfileId);
  }

  async reactivateStore(dealerId: string, adminProfileId: string) {
    return reactivateCorporateStore(dealerId, adminProfileId);
  }

  async deleteStore(dealerId: string, reason: string, adminProfileId: string) {
    return deleteCorporateStore(dealerId, reason, adminProfileId);
  }
}
