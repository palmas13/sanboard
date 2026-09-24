import { IDealerRepository } from '../types';
import {
  getDealerById,
  getDealerBySlug,
  getDealerByProfileId,
  applyForDealer,
  updateDealerProfile,
} from '../../dealers';
import { CorporateProfile } from '@/types';

export class MemoryDealerRepository implements IDealerRepository {
  async getDealerById(id: string): Promise<CorporateProfile | null> {
    return getDealerById(id);
  }

  async getDealerBySlug(slug: string): Promise<CorporateProfile | null> {
    return getDealerBySlug(slug);
  }

  async getDealerByProfileId(profileId: string): Promise<CorporateProfile | null> {
    return getDealerByProfileId(profileId);
  }

  async createApplication(params: { profileId: string; companyName: string; purpose: string }) {
    const res = await applyForDealer(params);
    return {
      success: res.success,
      application: res.dealer as any,
      error: res.error,
    };
  }

  async updateDealerProfile(id: string, data: Partial<CorporateProfile>) {
    // Memory implementation
    const dealer = await getDealerById(id);
    if (!dealer) return { success: false, error: 'Kurumsal profil bulunamadı.' };

    const res = await updateDealerProfile(id, dealer.profile_id, data);
    return res;
  }
}
