import { db } from './store';
import { DealerProfile, DealerStatus, Listing, CorporateApplication, CorporateProfile, CharacterProfile, CorporateFollower } from '@/types';
import { getDealerRepository, getListingRepository, getNotificationRepository } from './repositories';
import { normalizePhone } from '../utils/format';
import { normalizeSocialMedia } from '../dealers/social';
import { recordAuditEvent } from '../audit';
import { notifyNewFollowerBestEffort } from './follow-notifications';
import { slugify } from '../urls';

export function ensureDealers() {
  if (!db.dealers) {
    db.dealers = [
      {
        id: 'dealer-apex-01',
        profile_id: 'char-mavis-01',
        company_name: 'Apex Motors & Luxury Estates',
        slug: 'apex-motors',
        description: 'Los Santos genelinde lüks otomobil ve seçkin mülk portföyü ile 2024\'ten bu yana kurumsal hizmet sunuyoruz. Güvenilir ekspertiz ve hızlı devir.',
        logo_url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&auto=format&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=80',
        address: 'Vinewood Boulevard No: 12, Vinewood Hills',
        phone: '555-0192',
        sanmail_email: 'apex.motors@sanmail.com',
        purpose: 'Los Santos genelinde kurumsal otomobil galerisi ve emlak ofisi işletmek.',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        boost_credits: 0,
        public_id: 1,
        social_media: {
          facebrowser: 'https://facebrowser.gtaw/apexmotors',
        },
        created_at: '2026-09-02T10:00:00Z',
        updated_at: '2026-09-02T10:00:00Z',
      },
    ];
  }
  if (!db.applications) {
    db.applications = [];
  }
  if (!db.followers) {
    db.followers = [];
  }
}

export async function getDealerByProfileId(profileId: string, includeDeleted = false): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return (getDealerRepository() as any).getDealerByProfileId(profileId, includeDeleted) as any;
  }
  ensureDealers();
  return (
    db.dealers.find((d) => {
      const isOwner = d.profile_id === profileId || d.owner_profile_id === profileId;
      if (!isOwner) return false;
      if (includeDeleted) return true;
      return d.moderation_status !== 'DELETED' && !d.deleted_at;
    }) || null
  );
}

export async function getDealerById(dealerId: string): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().getDealerById(dealerId) as any;
  }
  ensureDealers();
  return db.dealers.find((d) => d.id === dealerId) || null;
}

export async function getDealerBySlug(slug: string): Promise<DealerProfile | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().getDealerBySlug(slug) as any;
  }
  ensureDealers();
  return db.dealers.find((d) => d.slug === slug) || null;
}

function generateUniqueCorporateSlug(companyName: string): string {
  const base = slugify(companyName);
  let candidate = base;
  let suffix = 2;
  while (db.dealers.some((dealer) => dealer.slug === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function getApplicationByProfileId(profileId: string): Promise<CorporateApplication | null> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.getApplicationByProfileId === 'function') {
      return repo.getApplicationByProfileId(profileId);
    }
  }
  ensureDealers();
  const apps = (db.applications || [])
    .filter((a) => a.applicant_profile_id === profileId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return apps[0] || null;
}

export async function getAllApplications(): Promise<CorporateApplication[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.getAllApplications === 'function') {
      return repo.getAllApplications();
    }
  }
  ensureDealers();
  return [...(db.applications || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function applyForDealer(params: {
  profileId: string;
  companyName: string;
  contactPhone?: string;
  contactEmail?: string;
  location?: string;
  purpose: string;
}): Promise<{ success: boolean; application?: CorporateApplication; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().createApplication(params);
  }
  ensureDealers();

  if (!params.profileId) {
    return { success: false, error: 'Karakter profili zorunludur.' };
  }

  if (!params.companyName.trim() || !params.purpose.trim()) {
    return { success: false, error: 'Şirket adı ve başvuru amacı alanları zorunludur.' };
  }

  const profile = db.profiles.find((p) => p.id === params.profileId);
  if (!profile) return { success: false, error: 'Profil bulunamadı.' };

  const existingStore = db.dealers.find(
    (d) =>
      (d.profile_id === params.profileId || d.owner_profile_id === params.profileId) &&
      d.moderation_status !== 'DELETED' &&
      !d.deleted_at
  );
  if (existingStore) {
    if (existingStore.moderation_status === 'SUSPENDED') {
      return { success: false, error: 'Askıya alınmış bir kurumsal mağazanız bulunmaktadır. Yeni başvuru yapamazsınız.' };
    }
    return { success: false, error: 'Zaten onaylanmış bir kurumsal hesabınız bulunmaktadır.' };
  }

  const existingPending = (db.applications || []).find(
    (a) => a.applicant_profile_id === params.profileId && a.status === 'PENDING'
  );
  if (existingPending) {
    return { success: false, error: 'Zaten beklemede olan bir kurumsal başvurunuz bulunmaktadır.' };
  }

  const newApp: CorporateApplication = {
    id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    applicant_profile_id: params.profileId,
    company_name: params.companyName.trim(),
    contact_phone: normalizePhone(params.contactPhone || profile.phone || ''),
    contact_email: (params.contactEmail || profile.sanmail_email || '').trim(),
    location: (params.location || 'Los Santos, San Andreas').trim(),
    purpose: params.purpose.trim(),
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  db.applications.push(newApp);
  return { success: true, application: newApp };
}

export async function reviewApplication(
  applicationId: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
  reviewerAccountId?: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.reviewApplication === 'function') {
      return repo.reviewApplication(applicationId, status, rejectionReason, reviewerAccountId);
    }
  }

  ensureDealers();
  const app = (db.applications || []).find((a) => a.id === applicationId);
  if (!app) return { success: false, error: 'Başvuru bulunamadı.' };
  if (app.status !== 'PENDING') return { success: false, error: 'Başvuru daha önce değerlendirilmiş.' };
  if (status === 'REJECTED' && !rejectionReason?.trim()) return { success: false, error: 'Red gerekçesi zorunludur.' };

  app.status = status;
  app.reviewed_by = reviewerAccountId;
  app.reviewed_at = new Date().toISOString();

  const profile = db.profiles.find((p) => p.id === app.applicant_profile_id);
  const targetUserId = profile?.user_id;

  if (status === 'APPROVED') {
    let store = db.dealers.find((d) => (d.profile_id === app.applicant_profile_id || d.owner_profile_id === app.applicant_profile_id) && d.moderation_status !== 'DELETED');
    if (!store) {
      store = {
        id: `dealer-${Date.now()}`,
        profile_id: app.applicant_profile_id,
        owner_profile_id: app.applicant_profile_id,
        company_name: app.company_name,
        slug: generateUniqueCorporateSlug(app.company_name),
        description: app.purpose,
        logo_url: profile?.avatar_url || '',
        banner_url: '',
        address: app.location || 'Los Santos, San Andreas',
        phone: app.contact_phone || profile?.phone,
        sanmail_email: app.contact_email || profile?.sanmail_email,
        status: 'APPROVED',
        subscription_status: 'INACTIVE', // Requires activation/package purchase
        moderation_status: 'ACTIVE',
        boost_credits: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.dealers.push(store);
    } else {
      store.status = 'APPROVED';
      store.subscription_status = store.subscription_status || 'INACTIVE';
      store.moderation_status = 'ACTIVE';
      store.boost_credits = store.boost_credits ?? 0;
    }

    if (profile) {
      profile.is_dealer = true;
      profile.dealer_id = store.id;
    }

    if (targetUserId) {
      await getNotificationRepository().createNotification({
        recipient_profile_id: app.applicant_profile_id,
        user_id: targetUserId,
        type: 'CORPORATE_APPLICATION_APPROVED',
        title: 'Kurumsal Profiliniz Onaylandı',
        message: `"${app.company_name}" adına yaptığınız kurumsal satış başvurusu onaylanmıştır. Kurumsal panelden üyeliğinizi aktif ederek avantajlardan yararlanabilirsiniz.`,
        entity_type: 'application',
        entity_id: app.id,
      });
    }
  } else if (status === 'REJECTED') {
    app.rejection_reason = rejectionReason || 'Fiziksel işletme bilgileri doğrulanamadı.';
    if (targetUserId) {
      await getNotificationRepository().createNotification({
        recipient_profile_id: app.applicant_profile_id,
        user_id: targetUserId,
        type: 'CORPORATE_APPLICATION_REJECTED',
        title: 'Kurumsal Başvurunuz Reddedildi',
        message: `Kurumsal hesap başvurunuz reddedildi. Neden: ${app.rejection_reason}`,
        entity_type: 'application',
        entity_id: app.id,
      });
    }
  }

  return { success: true };
}

export async function activateSubscription(dealerId: string): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.activateSubscription === 'function') {
      return repo.activateSubscription(dealerId);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

  dealer.subscription_status = 'ACTIVE';
  dealer.subscription_expires_at = new Date(Date.now() + 30 * 86400000).toISOString();
  dealer.boost_credits = 3;
  dealer.updated_at = new Date().toISOString();

  return { success: true, dealer };
}

export async function boostListing(
  actorProfileId: string,
  listingId: string,
  now = new Date()
): Promise<{ success: boolean; error?: string; code?: string; remainingBoosts?: number; featured_until?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.boostListing === 'function') {
      return repo.boostListing(actorProfileId, listingId, now);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => (d.owner_profile_id || d.profile_id) === actorProfileId);
  if (!dealer) return { success: false, code: 'LISTING_NOT_OWNED', error: 'Aktif karaktere ait kurumsal mağaza bulunamadı.' };
  if (dealer.moderation_status && dealer.moderation_status !== 'ACTIVE') {
    return { success: false, code: 'LISTING_NOT_ELIGIBLE', error: 'Kurumsal mağazanız askıya alınmış veya pasif durumdadır.' };
  }
  if (dealer.subscription_status !== 'ACTIVE') {
    return { success: false, code: 'SUBSCRIPTION_INACTIVE', error: 'Kurumsal üyeliğiniz aktif değil. Öne çıkarma hakkı kullanamazsınız.' };
  }
  const expiresAt = dealer.subscription_expires_at ? new Date(dealer.subscription_expires_at) : null;
  if (!expiresAt || expiresAt <= now) {
    return { success: false, code: 'SUBSCRIPTION_EXPIRED', error: 'Kurumsal üyeliğinizin süresi dolmuş. Öne çıkarma hakkı kullanamazsınız.' };
  }
  const periodStart = dealer.current_period_start ? new Date(dealer.current_period_start) : null;
  const periodEnd = dealer.current_period_end ? new Date(dealer.current_period_end) : null;
  if (!periodStart && !periodEnd) {
    dealer.current_period_start = now.toISOString();
    dealer.current_period_end = new Date(Math.min(now.getTime() + 30 * 86400000, expiresAt.getTime())).toISOString();
  } else if (!periodStart || !periodEnd || periodStart >= periodEnd) {
    return { success: false, code: 'LISTING_NOT_ELIGIBLE', error: 'Kurumsal üyelik dönemi tutarsızdır.' };
  }
  if (periodEnd && periodEnd <= now) {
    const nextPeriodEnd = new Date(Math.min(now.getTime() + 30 * 86400000, expiresAt.getTime()));
    dealer.current_period_start = now.toISOString();
    dealer.current_period_end = nextPeriodEnd.toISOString();
    dealer.boost_credits = 3;
  }
  if (dealer.boost_credits == null || dealer.boost_credits <= 0) {
    return { success: false, code: 'NO_BOOST_CREDITS', error: 'Bu abonelik dönemi için öne çıkarma hakkınız tükenmiştir.' };
  }

  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  if (listing.status !== 'ACTIVE') {
    return { success: false, code: 'LISTING_NOT_ELIGIBLE', error: 'Yalnızca aktif yayındaki ilanlar öne çıkarılabilir.' };
  }

  // STRICT: Corporate boost can ONLY boost corporate listings belonging to this store (Requirement 10 & 11)
  if (listing.seller_type !== 'CORPORATE' || listing.corporate_profile_id !== dealer.id) {
    return { success: false, code: 'LISTING_NOT_OWNED', error: 'İlan aktif karakterin kurumsal mağazasına ait değil.' };
  }

  if (listing.is_featured && listing.featured_until && new Date(listing.featured_until) > now) {
    return { success: false, code: 'ALREADY_BOOSTED', error: 'Bu ilan zaten aktif olarak öne çıkarılmış durumdadır.' };
  }

  dealer.boost_credits -= 1;
  listing.is_featured = true;
  const boostEnd = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  listing.featured_until = boostEnd;

  return {
    success: true,
    remainingBoosts: dealer.boost_credits,
    featured_until: boostEnd,
  };
}

export async function toggleFollow(
  followerProfileId: string,
  corporateProfileId: string
): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.toggleFollow === 'function') {
      return repo.toggleFollow(followerProfileId, corporateProfileId);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === corporateProfileId);
  if (!dealer) throw new Error('Kurumsal mağaza bulunamadı.');

  // Prevent self-follow (Section 16)
  if (dealer.owner_profile_id === followerProfileId || dealer.profile_id === followerProfileId) {
    throw new Error('Kendi mağazanızı takip edemezsiniz.');
  }

  const idx = db.followers.findIndex(
    (f) => f.follower_profile_id === followerProfileId && f.corporate_profile_id === corporateProfileId
  );

  let isFollowing = false;
  if (idx >= 0) {
    db.followers.splice(idx, 1);
    isFollowing = false;
  } else {
    db.followers.push({
      id: `flw-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      follower_profile_id: followerProfileId,
      corporate_profile_id: corporateProfileId,
      created_at: new Date().toISOString(),
    });
    isFollowing = true;

    // Notify corporate store owner character on NEW follow (Section 16)
    const followerProfile = db.profiles.find((p) => p.id === followerProfileId);
    const followerName = followerProfile?.full_name || 'Bir kullanıcı';
    const ownerProfileId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerProfileId) {
      await getNotificationRepository().createNotification({
        recipient_profile_id: ownerProfileId,
        user_id: db.profiles.find((p) => p.id === ownerProfileId)?.user_id,
        type: 'NEW_FOLLOWER',
        title: 'Yeni Takipçi',
        message: `${followerName} mağazanızı takip etmeye başladı.`,
        entity_type: 'application',
        entity_id: corporateProfileId,
      });
    }
  }

  const count = db.followers.filter((f) => f.corporate_profile_id === corporateProfileId).length;
  return { isFollowing, count, followerCount: count };
}

export async function setFollow(
  followerProfileId: string,
  corporateProfileId: string,
  shouldFollow: boolean
): Promise<{ isFollowing: boolean; count: number; followerCount?: number }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.setFollow === 'function') {
      return repo.setFollow(followerProfileId, corporateProfileId, shouldFollow);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((item) => item.id === corporateProfileId);
  if (!dealer) throw new Error('Kurumsal mağaza bulunamadı.');
  if (dealer.owner_profile_id === followerProfileId || dealer.profile_id === followerProfileId) {
    throw new Error('Kendi mağazanızı takip edemezsiniz.');
  }

  const existingIndex = db.followers.findIndex(
    (follow) => follow.follower_profile_id === followerProfileId && follow.corporate_profile_id === corporateProfileId
  );

  if (shouldFollow && existingIndex < 0) {
    db.followers.push({
      id: `flw-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      follower_profile_id: followerProfileId,
      corporate_profile_id: corporateProfileId,
      created_at: new Date().toISOString(),
    });

    const ownerProfileId = dealer.owner_profile_id || dealer.profile_id;
    if (ownerProfileId) {
      const followerProfile = db.profiles.find((profile) => profile.id === followerProfileId);
      await notifyNewFollowerBestEffort({
        recipientProfileId: ownerProfileId,
        recipientUserId: db.profiles.find((profile) => profile.id === ownerProfileId)?.user_id,
        followerName: followerProfile?.full_name || 'Bir kullanıcı',
        corporateProfileId,
      });
    }
  } else if (!shouldFollow && existingIndex >= 0) {
    db.followers.splice(existingIndex, 1);
  }

  const count = db.followers.filter((follow) => follow.corporate_profile_id === corporateProfileId).length;
  return { isFollowing: shouldFollow, count, followerCount: count };
}

export async function getFollowers(corporateProfileId: string): Promise<CharacterProfile[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.getFollowers === 'function') {
      return repo.getFollowers(corporateProfileId);
    }
  }

  ensureDealers();
  const followerIds = db.followers
    .filter((f) => f.corporate_profile_id === corporateProfileId)
    .map((f) => f.follower_profile_id);

  return db.profiles.filter((p) => followerIds.includes(p.id));
}

export async function isFollowing(followerProfileId: string, corporateProfileId: string): Promise<boolean> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.isFollowing === 'function') {
      return repo.isFollowing(followerProfileId, corporateProfileId);
    }
  }

  ensureDealers();
  return db.followers.some(
    (f) => f.follower_profile_id === followerProfileId && f.corporate_profile_id === corporateProfileId
  );
}

export async function updateDealerProfile(
  dealerId: string,
  profileId: string,
  data: Partial<Pick<DealerProfile, 'company_name' | 'description' | 'logo_url' | 'banner_url' | 'address' | 'phone' | 'sanmail_email' | 'social_media'>>
): Promise<{ success: boolean; dealer?: DealerProfile; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    return getDealerRepository().updateDealerProfile(dealerId, data);
  }
  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal profil bulunamadı.' };

  if (dealer.profile_id !== profileId && dealer.owner_profile_id !== profileId) {
    return { success: false, error: 'Bu kurumsal profili düzenleme yetkiniz yok.' };
  }

  if (data.company_name) dealer.company_name = data.company_name.trim();
  if (data.description !== undefined) dealer.description = data.description.trim();
  if (data.logo_url) dealer.logo_url = data.logo_url.trim();
  if (data.banner_url) dealer.banner_url = data.banner_url.trim();
  if (data.address) dealer.address = data.address.trim();
  if (data.phone !== undefined) dealer.phone = normalizePhone(data.phone);
  if (data.sanmail_email) dealer.sanmail_email = data.sanmail_email.trim();
  if (data.social_media !== undefined) {
    dealer.social_media = normalizeSocialMedia(data.social_media);
  }
  dealer.updated_at = new Date().toISOString();

  return { success: true, dealer };
}

export async function getAllDealers(): Promise<DealerProfile[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.getAllDealers === 'function') {
      return repo.getAllDealers();
    }
  }
  ensureDealers();
  return [...db.dealers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateDealerStatus(
  dealerId: string,
  status: DealerStatus,
  rejectionReason?: string
): Promise<boolean> {
  if (status === 'APPROVED' || status === 'REJECTED') {
    const res = await reviewApplication(dealerId, status, rejectionReason);
    if (res.success) return true;
  }

  // Fallback to updating dealer directly
  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return false;

  dealer.status = status;
  dealer.updated_at = new Date().toISOString();
  return true;
}

export async function getDealerListings(profileId: string): Promise<{ vehicles: Listing[]; properties: Listing[] }> {
  if (process.env.DATA_STORE === 'supabase') {
    const all = await getListingRepository().getUserListings(profileId);
    return {
      vehicles: all.filter((l) => l.category === 'vehicle' && l.status === 'ACTIVE' && l.seller_type === 'CORPORATE'),
      properties: all.filter((l) => l.category === 'property' && l.status === 'ACTIVE' && l.seller_type === 'CORPORATE'),
    };
  }
  const now = new Date();
  const all = db.listings.filter(
    (l) =>
      l.seller_profile_id === profileId &&
      l.seller_type === 'CORPORATE' &&
      l.status === 'ACTIVE' &&
      l.expires_at &&
      new Date(l.expires_at) > now
  );

  return {
    vehicles: all.filter((l) => l.category === 'vehicle'),
    properties: all.filter((l) => l.category === 'property'),
  };
}

export async function suspendCorporateStore(
  dealerId: string,
  reason: string,
  adminProfileId: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.suspendStore === 'function') {
      return repo.suspendStore(dealerId, reason, adminProfileId);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

  dealer.moderation_status = 'SUSPENDED';
  dealer.suspended_at = new Date().toISOString();
  dealer.suspended_by_profile_id = adminProfileId;
  dealer.suspension_reason = reason;
  dealer.updated_at = new Date().toISOString();

  // Character-scoped notification to corporate store owner (Section 18)
  const ownerId = dealer.owner_profile_id || dealer.profile_id;
  if (ownerId) {
    const profile = db.profiles.find((p) => p.id === ownerId);
    await getNotificationRepository().createNotification({
      recipient_profile_id: ownerId,
      user_id: profile?.user_id,
      type: 'CORPORATE_STORE_SUSPENDED',
      title: 'Kurumsal mağazanız askıya alındı',
      message: reason
        ? `${dealer.company_name} mağazanız yönetim tarafından askıya alınmıştır. Neden: ${reason}`
        : `${dealer.company_name} mağazanız yönetim tarafından askıya alınmıştır.`,
      entity_type: 'application',
      entity_id: dealer.id,
    });
  }

  // Admin audit log (Section 19)
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

export async function reactivateCorporateStore(
  dealerId: string,
  adminProfileId: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.reactivateStore === 'function') {
      return repo.reactivateStore(dealerId, adminProfileId);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

  // Section 15 & 22: Only modifies moderation_status! Does NOT alter subscription_status
  dealer.moderation_status = 'ACTIVE';
  dealer.updated_at = new Date().toISOString();

  // Character-scoped notification to corporate store owner (Section 18)
  const ownerId = dealer.owner_profile_id || dealer.profile_id;
  if (ownerId) {
    const profile = db.profiles.find((p) => p.id === ownerId);
    await getNotificationRepository().createNotification({
      recipient_profile_id: ownerId,
      user_id: profile?.user_id,
      type: 'CORPORATE_STORE_REACTIVATED',
      title: 'Kurumsal Mağazanız Yeniden Aktif',
      message: 'Kurumsal mağazanızın askısı kaldırıldı.',
      entity_type: 'application',
      entity_id: dealer.id,
    });
  }

  // Admin audit log (Section 19)
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

export async function deleteCorporateStore(
  dealerId: string,
  reason: string,
  adminProfileId: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getDealerRepository();
    if (typeof repo.deleteStore === 'function') {
      return repo.deleteStore(dealerId, reason, adminProfileId);
    }
  }

  ensureDealers();
  const dealer = db.dealers.find((d) => d.id === dealerId);
  if (!dealer) return { success: false, error: 'Kurumsal mağaza bulunamadı.' };

  // Soft delete (Section 16)
  dealer.moderation_status = 'DELETED';
  dealer.deleted_at = new Date().toISOString();
  dealer.deleted_by_profile_id = adminProfileId;
  dealer.deletion_reason = reason;
  dealer.updated_at = new Date().toISOString();

  // Active corporate listings transition to REMOVED with existing safe media cleanup
  const { removeListing } = await import('./listings');
  const storeListings = db.listings.filter(
    (l) =>
      l.corporate_profile_id === dealer.id ||
      (l.seller_profile_id === (dealer.owner_profile_id || dealer.profile_id) && l.seller_type === 'CORPORATE')
  );

  for (const list of storeListings) {
    if (list.status === 'ACTIVE') {
      await removeListing(list.id, 'SYSTEM_ADMIN');
    }
  }

  // Character-scoped notification to corporate store owner (Section 18)
  const ownerId = dealer.owner_profile_id || dealer.profile_id;
  if (ownerId) {
    const profile = db.profiles.find((p) => p.id === ownerId);
    await getNotificationRepository().createNotification({
      recipient_profile_id: ownerId,
      user_id: profile?.user_id,
      type: 'CORPORATE_STORE_DELETED',
      title: 'Kurumsal mağazanız silindi',
      message: reason
        ? `${dealer.company_name} mağazanız yönetim tarafından silinmiştir. Neden: ${reason}`
        : `${dealer.company_name} mağazanız yönetim tarafından silinmiştir.`,
      entity_type: 'application',
      entity_id: dealer.id,
    });
  }

  // Admin audit log (Section 19)
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
