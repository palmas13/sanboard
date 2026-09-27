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
  setFollow,
  getFollowers,
  isFollowing,
  updateDealerProfile,
  suspendCorporateStore,
  reactivateCorporateStore,
  deleteCorporateStore,
} from '../../dealers';
import { CorporateApplication, CorporateProfile, CharacterProfile } from '@/types';
import { db } from '../../store';

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

  async getApplicationByCanonicalProfileId(profileId: string): Promise<CorporateApplication | null> {
    const applications = (db.applications || [])
      .filter((application) => application.applicant_profile_id === profileId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    return applications[0] || null;
  }

  async getAllApplications(): Promise<CorporateApplication[]> {
    return getAllApplications();
  }

  async createApplication(params: { profileId: string; companyName: string; contactPhone?: string; contactEmail?: string; location?: string; purpose: string }) {
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
    actorProfileId: string,
    listingId: string,
    now?: Date
  ): Promise<{ success: boolean; error?: string; code?: string; remainingBoosts?: number; featured_until?: string }> {
    return boostListing(actorProfileId, listingId, now);
  }

  async toggleFollow(
    followerProfileId: string,
    corporateProfileId: string
  ): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
    return toggleFollow(followerProfileId, corporateProfileId);
  }

  async setFollow(followerProfileId: string, corporateProfileId: string, shouldFollow: boolean) {
    return setFollow(followerProfileId, corporateProfileId, shouldFollow);
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
