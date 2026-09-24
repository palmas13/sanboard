import { IDealerRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CorporateApplication, CorporateProfile } from '@/types';
import { uploadCorporateLogo, uploadCorporateBanner } from '@/lib/storage';

export class SupabaseDealerRepository implements IDealerRepository {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (admin) return admin;
    return this.getClient();
  }

  async getDealerById(id: string): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile: ${error.message}`);
    }
    return data as CorporateProfile | null;
  }

  async getDealerBySlug(slug: string): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile by slug: ${error.message}`);
    }
    return data as CorporateProfile | null;
  }

  async getDealerByProfileId(profileId: string): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('owner_profile_id', profileId).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile by owner: ${error.message}`);
    }
    return data as CorporateProfile | null;
  }

  async createApplication(params: { profileId: string; companyName: string; purpose: string }): Promise<{ success: boolean; application?: CorporateApplication; error?: string }> {
    const client = this.getAdminClient();

    const { data, error } = await client
      .from('corporate_applications')
      .insert({
        applicant_profile_id: params.profileId,
        company_name: params.companyName,
        purpose: params.purpose,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Kurumsal başvuru oluşturulamadı.' };
    }

    return { success: true, application: data as CorporateApplication };
  }

  async updateDealerProfile(id: string, data: Partial<CorporateProfile>): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
    const client = this.getAdminClient();

    let finalLogoUrl = data.logo_url;
    if (finalLogoUrl && finalLogoUrl.startsWith('data:image/')) {
      const matches = finalLogoUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadCorporateLogo(buffer, `logo-${id}-${Date.now()}.jpg`, matches[1]);
        if (uploadRes.success) finalLogoUrl = uploadRes.url;
        else return { success: false, error: `R2 logo yükleme hatası: ${uploadRes.error}` };
      }
    }

    let finalBannerUrl = data.banner_url;
    if (finalBannerUrl && finalBannerUrl.startsWith('data:image/')) {
      const matches = finalBannerUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadCorporateBanner(buffer, `banner-${id}-${Date.now()}.jpg`, matches[1]);
        if (uploadRes.success) finalBannerUrl = uploadRes.url;
        else return { success: false, error: `R2 banner yükleme hatası: ${uploadRes.error}` };
      }
    }

    const updatePayload: any = {
      ...data,
      logo_url: finalLogoUrl,
      banner_url: finalBannerUrl,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await client
      .from('corporate_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, dealer: updated as CorporateProfile };
  }
}
