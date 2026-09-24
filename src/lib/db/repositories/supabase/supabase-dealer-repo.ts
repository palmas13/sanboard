import { IDealerRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CorporateApplication, CorporateProfile } from '@/types';
import { uploadCorporateLogo, uploadCorporateBanner, getStorageProvider } from '@/lib/storage';

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

  async getDealerByPublicId(publicId: number): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('public_id', publicId).maybeSingle();
    if (error) {
      if (error.code === '42703' || error.message.includes('public_id')) {
        return null;
      }
      throw new Error(`Supabase error fetching corporate profile by public_id: ${error.message}`);
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

  async getAllDealers(): Promise<CorporateProfile[]> {
    const client = this.getAdminClient();
    const [storesRes, appsRes] = await Promise.all([
      client.from('corporate_profiles').select('*').order('created_at', { ascending: false }),
      client.from('corporate_applications').select('*').eq('status', 'PENDING').order('created_at', { ascending: false }),
    ]);

    const stores = (storesRes.data || []).map((s: any) => ({
      ...s,
      profile_id: s.owner_profile_id,
      sanmail_email: s.email,
    }));

    const pendingApps = (appsRes.data || []).map((a: any) => ({
      id: a.id,
      profile_id: a.applicant_profile_id,
      company_name: a.company_name,
      purpose: a.purpose,
      status: a.status,
      created_at: a.created_at,
      updated_at: a.created_at,
      logo_url: '',
      banner_url: '',
      description: a.purpose,
    }));

    return [...pendingApps, ...stores] as CorporateProfile[];
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
    const storage = getStorageProvider();

    // 1. Fetch current profile to capture old asset keys for cleanup
    const existing = await this.getDealerById(id);
    if (!existing) {
      return { success: false, error: 'Kurumsal profil bulunamadı.' };
    }

    const oldLogoKey = (existing as any).logo_path || existing.logo_url;
    const oldBannerKey = (existing as any).banner_path || existing.banner_url;

    let newLogoKey: string | null = null;
    let isNewLogoUpload = false;

    // 2. Handle Logo Upload
    const incomingLogo = (data as any).logo_path || data.logo_url;
    if (incomingLogo && typeof incomingLogo === 'string' && incomingLogo.startsWith('data:image/')) {
      const matches = incomingLogo.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1].toLowerCase();
        if (mime.includes('svg')) {
          return { success: false, error: 'SVG formatı kabul edilmemektedir. Lütfen PNG, JPG, JPEG veya WEBP kullanınız.' };
        }
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadCorporateLogo(buffer, id, mime);
        if (!uploadRes.success) {
          return { success: false, error: `R2 logo yükleme hatası: ${uploadRes.error}` };
        }
        newLogoKey = uploadRes.key;
        isNewLogoUpload = true;
      }
    } else if (incomingLogo && typeof incomingLogo === 'string' && incomingLogo.trim()) {
      newLogoKey = incomingLogo.trim();
    }

    let newBannerKey: string | null = null;
    let isNewBannerUpload = false;

    // 3. Handle Banner Upload
    const incomingBanner = (data as any).banner_path || data.banner_url;
    if (incomingBanner && typeof incomingBanner === 'string' && incomingBanner.startsWith('data:image/')) {
      const matches = incomingBanner.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1].toLowerCase();
        if (mime.includes('svg')) {
          if (isNewLogoUpload && newLogoKey) await storage.delete(newLogoKey);
          return { success: false, error: 'SVG formatı kabul edilmemektedir. Lütfen PNG, JPG, JPEG veya WEBP kullanınız.' };
        }
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadCorporateBanner(buffer, id, mime);
        if (!uploadRes.success) {
          if (isNewLogoUpload && newLogoKey) await storage.delete(newLogoKey);
          return { success: false, error: `R2 banner yükleme hatası: ${uploadRes.error}` };
        }
        newBannerKey = uploadRes.key;
        isNewBannerUpload = true;
      }
    } else if (incomingBanner && typeof incomingBanner === 'string' && incomingBanner.trim()) {
      newBannerKey = incomingBanner.trim();
    }

    // 4. Build update payload
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.company_name !== undefined) updatePayload.company_name = data.company_name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.address !== undefined) updatePayload.address = data.address;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.sanmail_email !== undefined) updatePayload.email = data.sanmail_email;
    if (data.email !== undefined) updatePayload.email = data.email;

    if (newLogoKey !== null) {
      updatePayload.logo_path = newLogoKey;
      updatePayload.logo_url = newLogoKey;
    }

    if (newBannerKey !== null) {
      updatePayload.banner_path = newBannerKey;
      updatePayload.banner_url = newBannerKey;
    }

    // 5. Update database
    let { data: resData, error } = await client
      .from('corporate_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    // If logo_path or banner_path column does not exist yet (code 42703), retry without them
    if (error && (error.code === '42703' || error.message.includes('logo_path') || error.message.includes('banner_path'))) {
      delete updatePayload.logo_path;
      delete updatePayload.banner_path;
      const retryResult = await client
        .from('corporate_profiles')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle();

      resData = retryResult.data;
      error = retryResult.error;
    }

    if (error || !resData) {
      // Cleanup newly uploaded objects if DB update failed
      if (isNewLogoUpload && newLogoKey) await storage.delete(newLogoKey);
      if (isNewBannerUpload && newBannerKey) await storage.delete(newBannerKey);
      return { success: false, error: error?.message || 'Veritabanı güncellenemedi.' };
    }

    // 6. DB update succeeded: cleanup old assets from R2
    if (isNewLogoUpload && oldLogoKey && oldLogoKey !== newLogoKey) {
      await storage.delete(oldLogoKey);
    }
    if (isNewBannerUpload && oldBannerKey && oldBannerKey !== newBannerKey) {
      await storage.delete(oldBannerKey);
    }

    return { success: true, dealer: resData as CorporateProfile };
  }
}
