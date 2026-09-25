import { IDealerRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CorporateApplication, CorporateProfile, CharacterProfile } from '@/types';
import { uploadCorporateLogo, uploadCorporateBanner, getStorageProvider } from '@/lib/storage';
import { normalizePhone } from '@/lib/utils/format';
import { normalizeSocialMedia } from '@/lib/dealers/social';

function mapCorporateProfile(data: any): CorporateProfile | null {
  if (!data) return null;
  return {
    ...data,
    social_media: normalizeSocialMedia(data.social_media),
  };
}

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
    return mapCorporateProfile(data);
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
    return mapCorporateProfile(data);
  }

  async getDealerBySlug(slug: string): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile by slug: ${error.message}`);
    }
    return mapCorporateProfile(data);
  }

  async getDealerByProfileId(profileId: string): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('owner_profile_id', profileId).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile by owner: ${error.message}`);
    }
    return mapCorporateProfile(data);
  }

  async getAllDealers(): Promise<CorporateProfile[]> {
    const client = this.getAdminClient();
    const { data: storesRes, error } = await client
      .from('corporate_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (storesRes || []).map((s: any) => ({
      ...s,
      profile_id: s.owner_profile_id,
      sanmail_email: s.email,
    })) as CorporateProfile[];
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
    if (data.phone !== undefined) updatePayload.phone = normalizePhone(data.phone);
    if (data.sanmail_email !== undefined) updatePayload.email = data.sanmail_email;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.social_media !== undefined) {
      updatePayload.social_media = normalizeSocialMedia(data.social_media);
    }

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

    return { success: true, dealer: mapCorporateProfile(resData)! };
  }

  async getApplicationByProfileId(profileId: string): Promise<CorporateApplication | null> {
    const client = this.getAdminClient();
    const { data: profile } = await client
      .from('character_profiles')
      .select('id, external_character_id')
      .or(`id.eq.${profileId},external_character_id.eq.${profileId}`)
      .maybeSingle();

    const pId = profile?.id || profileId;
    const { data: app } = await client
      .from('corporate_applications')
      .select('*')
      .eq('applicant_profile_id', pId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return app as CorporateApplication | null;
  }

  async getAllApplications(): Promise<CorporateApplication[]> {
    const client = this.getAdminClient();
    const { data, error } = await client
      .from('corporate_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as CorporateApplication[];
  }

  async reviewApplication(
    applicationId: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
    reviewerUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();

    const { data: app, error: appErr } = await client
      .from('corporate_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr || !app) {
      return { success: false, error: 'Başvuru bulunamadı.' };
    }

    const { data: profile } = await client
      .from('character_profiles')
      .select('id, user_id, full_name, avatar_path, avatar_url, phone, sanmail_email')
      .or(`id.eq.${app.applicant_profile_id},external_character_id.eq.${app.applicant_profile_id}`)
      .maybeSingle();

    const targetUserId = profile?.user_id;
    const targetProfileId = profile?.id || app.applicant_profile_id;

    if (status === 'APPROVED') {
      const { data: existingOwnerStore } = await client
        .from('corporate_profiles')
        .select('id')
        .eq('owner_profile_id', targetProfileId)
        .neq('moderation_status', 'DELETED')
        .maybeSingle();

      if (existingOwnerStore) {
        return { success: false, error: 'Bu karakterin zaten onaylanmış bir kurumsal mağazası bulunmaktadır.' };
      }

      await client
        .from('corporate_applications')
        .update({ status: 'APPROVED', reviewed_by: reviewerUserId, reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);

      const slug = app.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data: newStore } = await client
        .from('corporate_profiles')
        .insert({
          owner_profile_id: targetProfileId,
          company_name: app.company_name,
          slug,
          description: app.purpose,
          status: 'APPROVED',
          subscription_status: 'INACTIVE',
          moderation_status: 'ACTIVE',
          boost_credits: 3,
        })
        .select()
        .single();

      if (newStore) {
        await client
          .from('character_profiles')
          .update({ is_dealer: true, dealer_id: newStore.id })
          .eq('id', targetProfileId);
      }

      const { getNotificationRepository } = await import('../index');
      await getNotificationRepository().createNotification({
        recipient_profile_id: targetProfileId,
        user_id: targetUserId || undefined,
        type: 'CORPORATE_APPLICATION_APPROVED',
        title: 'Kurumsal Profiliniz Onaylandı',
        message: `"${app.company_name}" adına yaptığınız kurumsal satış başvurusu onaylanmıştır. Kurumsal panelden üyeliğinizi aktif ederek avantajlardan yararlanabilirsiniz.`,
        entity_type: 'application',
        entity_id: app.id,
      });
    } else if (status === 'REJECTED') {
      const reason = rejectionReason || 'Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.';
      await client
        .from('corporate_applications')
        .update({
          status: 'REJECTED',
          rejection_reason: reason,
          reviewed_by: reviewerUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      const { getNotificationRepository } = await import('../index');
      await getNotificationRepository().createNotification({
        recipient_profile_id: targetProfileId,
        user_id: targetUserId || undefined,
        type: 'CORPORATE_APPLICATION_REJECTED',
        title: 'Kurumsal Başvurunuz Reddedildi',
        message: `Kurumsal hesap başvurunuz reddedildi. Neden: ${reason}`,
        entity_type: 'application',
        entity_id: app.id,
      });
    }

    return { success: true };
  }

  async activateSubscription(dealerId: string): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
    const client = this.getAdminClient();
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

    const { data, error } = await client
      .from('corporate_profiles')
      .update({
        subscription_status: 'ACTIVE',
        subscription_expires_at: expiresAt,
        boost_credits: 3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealerId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message || 'Üyelik aktif edilemedi.' };
    }

    return { success: true, dealer: data as CorporateProfile };
  }

  async boostListing(
    dealerId: string,
    listingId: string
  ): Promise<{ success: boolean; error?: string; remainingBoosts?: number; featured_until?: string }> {
    const client = this.getAdminClient();

    const dealer = await this.getDealerById(dealerId);
    if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };
    if (dealer.moderation_status && dealer.moderation_status !== 'ACTIVE') {
      return { success: false, error: 'Kurumsal mağazanız askıya alınmış veya pasif durumdadır.' };
    }
    if (dealer.subscription_status !== 'ACTIVE') {
      return { success: false, error: 'Kurumsal üyeliğiniz aktif değil. Öne çıkarma hakkı kullanamazsınız.' };
    }
    if (!dealer.boost_credits || dealer.boost_credits <= 0) {
      return { success: false, error: 'Bu abonelik dönemi için öne çıkarma hakkınız tükenmiştir.' };
    }

    const { data: listing, error: listErr } = await client
      .from('listings')
      .select('id, status, is_featured, featured_until, seller_type, corporate_profile_id')
      .eq('id', listingId)
      .maybeSingle();

    if (listErr || !listing) return { success: false, error: 'İlan bulunamadı.' };
    if (listing.status !== 'ACTIVE') {
      return { success: false, error: 'Yalnızca aktif yayındaki ilanlar öne çıkarılabilir.' };
    }

    // STRICT: Corporate boost can ONLY boost corporate listings belonging to this store (Requirement 10 & 11)
    if (listing.seller_type !== 'CORPORATE' || listing.corporate_profile_id !== dealerId) {
      return { success: false, error: 'Bireysel ilanlar kurumsal öne çıkarma hakları ile öne çıkarılamaz.' };
    }

    const now = new Date();
    if (listing.is_featured && listing.featured_until && new Date(listing.featured_until) > now) {
      return { success: false, error: 'Bu ilan zaten aktif olarak öne çıkarılmış durumdadır.' };
    }

    const boostEnd = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    const newCredits = dealer.boost_credits - 1;

    await Promise.all([
      client.from('listings').update({ is_featured: true, featured_until: boostEnd }).eq('id', listingId),
      client.from('corporate_profiles').update({ boost_credits: newCredits }).eq('id', dealerId),
    ]);

    return { success: true, remainingBoosts: newCredits, featured_until: boostEnd };
  }

  async toggleFollow(
    followerProfileId: string,
    corporateProfileId: string
  ): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
    const client = this.getAdminClient();

    const { data: dealer } = await client
      .from('corporate_profiles')
      .select('owner_profile_id')
      .eq('id', corporateProfileId)
      .maybeSingle();

    if (!dealer) throw new Error('Kurumsal mağaza bulunamadı.');
    if (dealer.owner_profile_id === followerProfileId) {
      throw new Error('Kendi mağazanızı takip edemezsiniz.');
    }

    const { data: existing } = await client
      .from('corporate_followers')
      .select('id')
      .eq('follower_profile_id', followerProfileId)
      .eq('corporate_profile_id', corporateProfileId)
      .maybeSingle();

    let isFollowing = false;
    if (existing) {
      await client.from('corporate_followers').delete().eq('id', existing.id);
      isFollowing = false;
    } else {
      await client.from('corporate_followers').insert({
        follower_profile_id: followerProfileId,
        corporate_profile_id: corporateProfileId,
      });
      isFollowing = true;

      // Notify corporate store owner character on NEW follow (Section 16)
      if (dealer.owner_profile_id) {
        const { data: follower } = await client
          .from('character_profiles')
          .select('full_name, user_id')
          .eq('id', followerProfileId)
          .maybeSingle();

        const { getNotificationRepository } = await import('../index');
        await getNotificationRepository().createNotification({
          recipient_profile_id: dealer.owner_profile_id,
          type: 'NEW_FOLLOWER',
          title: 'Yeni Takipçi',
          message: `${follower?.full_name || 'Bir kullanıcı'} mağazanızı takip etmeye başladı.`,
          entity_type: 'application',
          entity_id: corporateProfileId,
        });
      }
    }

    const { count } = await client
      .from('corporate_followers')
      .select('*', { count: 'exact', head: true })
      .eq('corporate_profile_id', corporateProfileId);

    return { isFollowing, count: count || 0, followerCount: count || 0 };
  }

  async getFollowers(corporateProfileId: string): Promise<CharacterProfile[]> {
    const client = this.getAdminClient();
    const { data, error } = await client
      .from('corporate_followers')
      .select('follower:character_profiles (*)')
      .eq('corporate_profile_id', corporateProfileId);

    if (error) return [];
    return (data || []).map((row: any) => row.follower).filter(Boolean) as CharacterProfile[];
  }

  async isFollowing(followerProfileId: string, corporateProfileId: string): Promise<boolean> {
    const client = this.getAdminClient();
    const { data } = await client
      .from('corporate_followers')
      .select('id')
      .eq('follower_profile_id', followerProfileId)
      .eq('corporate_profile_id', corporateProfileId)
      .maybeSingle();

    return Boolean(data);
  }

  async suspendStore(
    dealerId: string,
    reason: string,
    adminProfileId: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();
    const dealer = await this.getDealerById(dealerId);
    if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

    const { error } = await client
      .from('corporate_profiles')
      .update({
        moderation_status: 'SUSPENDED',
        suspended_at: new Date().toISOString(),
        suspended_by_profile_id: adminProfileId,
        suspension_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealerId);

    if (error) return { success: false, error: error.message };

    // Character-scoped notification to corporate store owner (Section 18)
    const ownerId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerId) {
      const { getNotificationRepository } = await import('../index');
      await getNotificationRepository().createNotification({
        recipient_profile_id: ownerId,
        type: 'CORPORATE_STORE_SUSPENDED',
        title: 'Kurumsal Mağazanız Askıya Alındı',
        message: `Kurumsal mağazanız yönetim tarafından askıya alındı. Neden: ${reason}`,
        entity_type: 'application',
        entity_id: dealerId,
      });
    }

    // Admin audit log (Section 19)
    const { recordAuditEvent } = await import('@/lib/audit');
    await recordAuditEvent({
      eventType: 'CORPORATE_STORE_SUSPENDED',
      profileId: adminProfileId,
      metadata: {
        targetCorporateProfileId: dealer.id,
        companyName: dealer.company_name,
        reason,
        suspendedBy: adminProfileId,
      },
    });

    return { success: true };
  }

  async reactivateStore(
    dealerId: string,
    adminProfileId: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();
    const dealer = await this.getDealerById(dealerId);
    if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

    // Section 15 & 22: Only modifies moderation_status! Does NOT alter subscription_status
    const { error } = await client
      .from('corporate_profiles')
      .update({
        moderation_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealerId);

    if (error) return { success: false, error: error.message };

    // Character-scoped notification to corporate store owner (Section 18)
    const ownerId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerId) {
      const { getNotificationRepository } = await import('../index');
      await getNotificationRepository().createNotification({
        recipient_profile_id: ownerId,
        type: 'CORPORATE_STORE_REACTIVATED',
        title: 'Kurumsal Mağazanız Yeniden Aktif',
        message: 'Kurumsal mağazanızın askısı kaldırıldı.',
        entity_type: 'application',
        entity_id: dealerId,
      });
    }

    // Admin audit log (Section 19)
    const { recordAuditEvent } = await import('@/lib/audit');
    await recordAuditEvent({
      eventType: 'CORPORATE_STORE_REACTIVATED',
      profileId: adminProfileId,
      metadata: {
        targetCorporateProfileId: dealer.id,
        companyName: dealer.company_name,
        reactivatedBy: adminProfileId,
      },
    });

    return { success: true };
  }

  async deleteStore(
    dealerId: string,
    reason: string,
    adminProfileId: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();
    const dealer = await this.getDealerById(dealerId);
    if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

    // Soft delete (Section 16)
    const { error } = await client
      .from('corporate_profiles')
      .update({
        moderation_status: 'DELETED',
        deleted_at: new Date().toISOString(),
        deleted_by_profile_id: adminProfileId,
        deletion_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealerId);

    if (error) return { success: false, error: error.message };

    // Active corporate listings transition to REMOVED with existing safe media cleanup
    const { getListingRepository } = await import('../index');
    const listingRepo = getListingRepository();
    const corporateListings = await listingRepo.getCorporateListings(dealerId);

    for (const list of corporateListings) {
      if (list.status === 'ACTIVE' && typeof listingRepo.removeListing === 'function') {
        await listingRepo.removeListing(list.id, 'SYSTEM_ADMIN');
      }
    }

    // Character-scoped notification to corporate store owner (Section 18)
    const ownerId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerId) {
      const { getNotificationRepository } = await import('../index');
      await getNotificationRepository().createNotification({
        recipient_profile_id: ownerId,
        type: 'CORPORATE_STORE_DELETED',
        title: 'Kurumsal Mağazanız Kaldırıldı',
        message: `Kurumsal mağazanız yönetim tarafından kaldırıldı. Neden: ${reason}`,
        entity_type: 'application',
        entity_id: dealerId,
      });
    }

    // Admin audit log (Section 19)
    const { recordAuditEvent } = await import('@/lib/audit');
    await recordAuditEvent({
      eventType: 'CORPORATE_STORE_DELETED',
      profileId: adminProfileId,
      metadata: {
        targetCorporateProfileId: dealer.id,
        companyName: dealer.company_name,
        reason,
        deletedBy: adminProfileId,
      },
    });

    return { success: true };
  }
}
