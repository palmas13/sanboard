import { IDealerRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { CorporateApplication, CorporateProfile, CharacterProfile } from '@/types';
import { uploadCorporateLogo, uploadCorporateBanner } from '@/lib/storage';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { normalizePhone } from '@/lib/utils/format';
import { normalizeSocialMedia } from '@/lib/dealers/social';
import { notifyNewFollowerBestEffort } from '../../follow-notifications';
import { addCalendarMonth } from '@/lib/subscriptions/calendar-month';

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
    const client = this.getAdminClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile: ${error.message}`);
    }
    return mapCorporateProfile(data);
  }

  async getDealerByPublicId(publicId: number): Promise<CorporateProfile | null> {
    const client = this.getClient();
    const { data, error } = await client.from('corporate_profiles').select('*').eq('public_id', publicId).eq('moderation_status', 'ACTIVE').is('deleted_at', null).maybeSingle();
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
    const { data, error } = await client.from('corporate_profiles').select('*').eq('slug', slug).eq('moderation_status', 'ACTIVE').is('deleted_at', null).maybeSingle();
    if (error) {
      throw new Error(`Supabase error fetching corporate profile by slug: ${error.message}`);
    }
    return mapCorporateProfile(data);
  }

  async getDealerByProfileId(profileId: string, includeDeleted = false): Promise<CorporateProfile | null> {
    const client = this.getClient();
    let query = client.from('corporate_profiles').select('*').eq('owner_profile_id', profileId);

    if (!includeDeleted) {
      query = query.neq('moderation_status', 'DELETED').is('deleted_at', null);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      if (error.message?.includes('moderation_status')) {
        const { data: fallbackData } = await client
          .from('corporate_profiles')
          .select('*')
          .eq('owner_profile_id', profileId)
          .maybeSingle();
        return mapCorporateProfile(fallbackData);
      }
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

  async createApplication(params: { profileId: string; companyName: string; contactPhone?: string; contactEmail?: string; location?: string; purpose: string }): Promise<{ success: boolean; application?: CorporateApplication; error?: string }> {
    if (!params.profileId) {
      return { success: false, error: 'Karakter profili zorunludur.' };
    }

    if (!params.companyName.trim() || !params.purpose.trim()) {
      return { success: false, error: 'Şirket adı ve başvuru amacı alanları zorunludur.' };
    }

    const client = this.getAdminClient();
    const { data: applicantProfile } = await client
      .from('character_profiles')
      .select('phone, sanmail_email')
      .eq('id', params.profileId)
      .maybeSingle();

    // 1. Check if user has an active or suspended store (Requirement 2 B)
    const { data: existingStore } = await client
      .from('corporate_profiles')
      .select('id, moderation_status')
      .eq('owner_profile_id', params.profileId)
      .neq('moderation_status', 'DELETED')
      .is('deleted_at', null)
      .maybeSingle();

    if (existingStore) {
      if (existingStore.moderation_status === 'SUSPENDED') {
        return { success: false, error: 'Askıya alınmış bir kurumsal mağazanız bulunmaktadır. Yeni başvuru yapamazsınız.' };
      }
      return { success: false, error: 'Zaten aktif veya onaylanmış bir kurumsal mağazanız bulunmaktadır.' };
    }

    // 2. Check if user already has a pending application
    const { data: existingApp } = await client
      .from('corporate_applications')
      .select('id')
      .eq('applicant_profile_id', params.profileId)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingApp) {
      return { success: false, error: 'Zaten beklemede olan bir kurumsal başvurunuz bulunmaktadır.' };
    }

    const applicationPayload = {
      applicant_profile_id: params.profileId,
      company_name: params.companyName,
      contact_phone: normalizePhone(params.contactPhone || applicantProfile?.phone || ''),
      contact_email: (params.contactEmail || applicantProfile?.sanmail_email || '').trim(),
      location: (params.location || 'Los Santos, San Andreas').trim(),
      purpose: params.purpose,
      status: 'PENDING',
    };

    let { data, error } = await client
      .from('corporate_applications')
      .insert(applicationPayload)
      .select()
      .single();

    const missingContactColumns = error && (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      /contact_phone|contact_email|location|schema cache/i.test(error.message || '')
    );

    if (missingContactColumns) {
      const legacyResult = await client
        .from('corporate_applications')
        .insert({
          applicant_profile_id: applicationPayload.applicant_profile_id,
          company_name: applicationPayload.company_name,
          purpose: applicationPayload.purpose,
          status: applicationPayload.status,
        })
        .select()
        .single();

      data = legacyResult.data
        ? { ...legacyResult.data, contact_phone: applicationPayload.contact_phone, contact_email: applicationPayload.contact_email, location: applicationPayload.location }
        : null;
      error = legacyResult.error;
    }

    if (error || !data) {
      return { success: false, error: error?.message || 'Kurumsal başvuru oluşturulamadı.' };
    }

    return { success: true, application: data as CorporateApplication };
  }

  async updateDealerProfile(id: string, data: Partial<CorporateProfile>): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
    const client = this.getAdminClient();

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
          if (isNewLogoUpload && newLogoKey) await deleteMediaSafely(newLogoKey, 'CORPORATE_LOGO', 'CORPORATE_LOGO_REPLACED');
          return { success: false, error: 'SVG formatı kabul edilmemektedir. Lütfen PNG, JPG, JPEG veya WEBP kullanınız.' };
        }
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await uploadCorporateBanner(buffer, id, mime);
        if (!uploadRes.success) {
          if (isNewLogoUpload && newLogoKey) await deleteMediaSafely(newLogoKey, 'CORPORATE_LOGO', 'CORPORATE_LOGO_REPLACED');
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
      if (isNewLogoUpload && newLogoKey) await deleteMediaSafely(newLogoKey, 'CORPORATE_LOGO', 'CORPORATE_LOGO_REPLACED');
      if (isNewBannerUpload && newBannerKey) await deleteMediaSafely(newBannerKey, 'CORPORATE_BANNER', 'CORPORATE_BANNER_REPLACED');
      return { success: false, error: error?.message || 'Veritabanı güncellenemedi.' };
    }

    // 6. DB update succeeded: cleanup old assets from R2
    if (isNewLogoUpload && oldLogoKey && oldLogoKey !== newLogoKey) {
      await deleteMediaSafely(oldLogoKey, 'CORPORATE_LOGO', 'CORPORATE_LOGO_REPLACED');
    }
    if (isNewBannerUpload && oldBannerKey && oldBannerKey !== newBannerKey) {
      await deleteMediaSafely(oldBannerKey, 'CORPORATE_BANNER', 'CORPORATE_BANNER_REPLACED');
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

  async getApplicationByCanonicalProfileId(profileId: string): Promise<CorporateApplication | null> {
    const client = this.getAdminClient();
    const { data, error } = await client
      .from('corporate_applications')
      .select('*')
      .eq('applicant_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error('Kurumsal başvuru bilgisi alınamadı.');
    }

    return data as CorporateApplication | null;
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
    reviewerAccountId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();
    const { data, error } = await client.rpc('review_corporate_application', {
      p_application_id: applicationId,
      p_status: status,
      p_rejection_reason: rejectionReason?.trim() || null,
      p_reviewer_user_id: reviewerAccountId || null,
    });
    if (error) {
      console.error('Corporate application review RPC failed', { code: error.code, details: error.details, hint: error.hint });
      return { success: false, error: 'Kurumsal başvuru değerlendirme servisine ulaşılamadı.' };
    }
    const result = Array.isArray(data) ? data[0] : data;
    return { success: Boolean(result?.success), error: result?.error || undefined };
  }

  async activateSubscription(dealerId: string): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
    const client = this.getAdminClient();
    const expiresAt = addCalendarMonth(new Date()).toISOString();

    const { data: existing, error: existingError } = await client
      .from('corporate_profiles')
      .select('purchased_boost_credits')
      .eq('id', dealerId)
      .maybeSingle();
    if (existingError || !existing) {
      return { success: false, error: existingError?.message || 'Kurumsal mağaza bulunamadı.' };
    }
    const purchasedBoostCredits = existing.purchased_boost_credits || 0;

    const { data, error } = await client
      .from('corporate_profiles')
      .update({
        subscription_status: 'ACTIVE',
        subscription_expires_at: expiresAt,
        monthly_boost_credits: 3,
        boost_credits: 3 + purchasedBoostCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealerId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message || 'Üyelik aktif edilemedi.' };
    }

    const { error: resumeError } = await client.rpc('transition_corporate_membership_listings', {
      p_corporate_profile_id: dealerId,
      p_action: 'RESUME',
    });
    if (resumeError) {
      console.error('Test corporate subscription listing resume failed', { code: resumeError.code, details: resumeError.details, hint: resumeError.hint });
      return { success: false, error: 'Üyelik aktif edildi ancak ilanlar yeniden aktifleştirilemedi.' };
    }

    return { success: true, dealer: data as CorporateProfile };
  }

  async manuallyActivateSubscription(dealerId: string, adminProfileId: string): Promise<{ success: boolean; dealer?: CorporateProfile; previousStatus?: string; activatedAt?: string; error?: string }> {
    const client = this.getAdminClient();
    const { data, error } = await client.rpc('grant_corporate_subscription', {
      p_corporate_profile_id: dealerId,
      p_admin_profile_id: adminProfileId,
    });
    if (error) {
      console.error('Manual corporate subscription RPC failed', { code: error.code, details: error.details, hint: error.hint });
      return { success: false, error: 'Manuel üyelik aktivasyon servisine ulaşılamadı.' };
    }
    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: Boolean(result?.success),
      dealer: result?.dealer as CorporateProfile | undefined,
      previousStatus: result?.previous_status,
      activatedAt: result?.activated_at,
      error: result?.error || undefined,
    };
  }

  async boostListing(
    actorProfileId: string,
    listingId: string,
    _now?: Date,
    options?: { paymentMode?: 'REQUIRE_CREDIT' | 'TEST_BYPASS' }
  ): Promise<{ success: boolean; error?: string; code?: string; remainingBoosts?: number; monthlyBoostCredits?: number; purchasedBoostCredits?: number; featured_until?: string }> {
    const client = this.getAdminClient();
    let { data, error } = await client.rpc('consume_corporate_boost', {
      p_actor_profile_id: actorProfileId,
      p_listing_id: listingId,
      p_payment_mode: options?.paymentMode || 'REQUIRE_CREDIT',
    });
    if (error && options?.paymentMode !== 'TEST_BYPASS' && (error.code === 'PGRST202' || error.message?.includes('p_payment_mode'))) {
      ({ data, error } = await client.rpc('consume_corporate_boost', {
        p_actor_profile_id: actorProfileId,
        p_listing_id: listingId,
      }));
    }
    if (error) {
      console.error('Corporate boost RPC failed', { code: error.code, details: error.details, hint: error.hint });
      return { success: false, code: 'BOOST_SERVICE_ERROR', error: 'Öne çıkarma servisine ulaşılamadı.' };
    }
    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: Boolean(result?.success),
      error: result?.error || undefined,
      code: result?.code || undefined,
      remainingBoosts: result?.remaining_boosts,
      monthlyBoostCredits: result?.monthly_boost_credits,
      purchasedBoostCredits: result?.purchased_boost_credits,
      featured_until: result?.featured_until,
    };
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

  async setFollow(
    followerProfileId: string,
    corporateProfileId: string,
    shouldFollow: boolean
  ): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
    const client = this.getAdminClient();
    const { data: dealer, error: dealerError } = await client
      .from('corporate_profiles')
      .select('owner_profile_id')
      .eq('id', corporateProfileId)
      .maybeSingle();

    if (dealerError) throw new Error(dealerError.message);
    if (!dealer) throw new Error('Kurumsal mağaza bulunamadı.');
    if (dealer.owner_profile_id === followerProfileId) {
      throw new Error('Kendi mağazanızı takip edemezsiniz.');
    }

    let createdFollow = false;
    if (shouldFollow) {
      const { data: inserted, error } = await client.from('corporate_followers').upsert(
        { follower_profile_id: followerProfileId, corporate_profile_id: corporateProfileId },
        { onConflict: 'follower_profile_id,corporate_profile_id', ignoreDuplicates: true }
      ).select('id');
      if (error) throw new Error(error.message);
      createdFollow = Boolean(inserted?.length);
    } else {
      const { error } = await client
        .from('corporate_followers')
        .delete()
        .eq('follower_profile_id', followerProfileId)
        .eq('corporate_profile_id', corporateProfileId);
      if (error) throw new Error(error.message);
    }

    if (createdFollow && dealer.owner_profile_id) {
      const { data: follower } = await client
        .from('character_profiles')
        .select('full_name')
        .eq('id', followerProfileId)
        .maybeSingle();
      await notifyNewFollowerBestEffort({
        recipientProfileId: dealer.owner_profile_id,
        followerName: follower?.full_name || 'Bir kullanıcı',
        corporateProfileId,
      });
    }

    const [{ data: relation, error: relationError }, { count, error: countError }] = await Promise.all([
      client
        .from('corporate_followers')
        .select('id')
        .eq('follower_profile_id', followerProfileId)
        .eq('corporate_profile_id', corporateProfileId)
        .maybeSingle(),
      client
        .from('corporate_followers')
        .select('*', { count: 'exact', head: true })
        .eq('corporate_profile_id', corporateProfileId),
    ]);

    if (relationError) throw new Error(relationError.message);
    if (countError) throw new Error(countError.message);
    return { isFollowing: Boolean(relation), count: count || 0, followerCount: count || 0 };
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
      try {
        const { getNotificationRepository } = await import('../index');
        await getNotificationRepository().createNotification({
          recipient_profile_id: ownerId,
          type: 'CORPORATE_STORE_SUSPENDED',
          title: 'Kurumsal mağazanız askıya alındı',
          message: reason
            ? `${dealer.company_name} mağazanız yönetim tarafından askıya alınmıştır. Neden: ${reason}`
            : `${dealer.company_name} mağazanız yönetim tarafından askıya alınmıştır.`,
          entity_type: 'application',
          entity_id: dealerId,
        });
      } catch (notifErr: any) {
        console.error('Failed to dispatch corporate store suspended notification:', notifErr);
      }
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

    const { data, error } = await client.rpc('request_corporate_profile_purge', {
      p_corporate_profile_id: dealerId,
      p_reason: reason,
      p_admin_profile_id: adminProfileId,
    });
    const purgeResult = Array.isArray(data) ? data[0] : data;
    if (error || !purgeResult?.success) return { success: false, error: purgeResult?.error || error?.message || 'Kurumsal mağaza silme işlemi başlatılamadı.' };

    // Character-scoped notification to corporate store owner (Section 18)
    const ownerId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerId) {
      try {
        const { getNotificationRepository } = await import('../index');
        await getNotificationRepository().createNotification({
          recipient_profile_id: ownerId,
          type: 'CORPORATE_STORE_DELETED',
          title: 'Kurumsal mağazanız silindi',
          message: reason
            ? `${dealer.company_name} mağazanız yönetim tarafından silinmiştir. Neden: ${reason}`
            : `${dealer.company_name} mağazanız yönetim tarafından silinmiştir.`,
          entity_type: 'application',
          entity_id: dealerId,
        });
      } catch (notifErr: any) {
        console.error('Failed to dispatch corporate store deleted notification:', notifErr);
      }
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
