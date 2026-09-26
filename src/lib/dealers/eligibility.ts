import { CorporateApplication, DealerProfile } from '@/types';
import { getDealerRepository } from '@/lib/db/repositories';
import { db } from '@/lib/db/store';

export type CorporateEligibilityReason =
  | 'NO_STORE'
  | 'PENDING_APPLICATION'
  | 'REJECTED_APPLICATION'
  | 'SUBSCRIPTION_INACTIVE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'STORE_SUSPENDED'
  | 'STORE_DELETED'
  | 'ACTIVE';

export interface CorporateEligibilityResult {
  eligible: boolean;
  reason: CorporateEligibilityReason;
  dealer?: DealerProfile | null;
  application?: CorporateApplication | null;
  message?: string;
}

/**
 * Authoritative Canonical Listing Ownership Checker (Section 4 & 14).
 * Enforces character-scoped ownership without account-level or sibling fallback.
 */
export function isListingOwnedByActiveProfile(
  listing: {
    seller_type?: 'INDIVIDUAL' | 'CORPORATE';
    seller_profile_id?: string;
    corporate_profile_id?: string | null;
  },
  activeProfileId?: string | null,
  storeOwnerProfileId?: string | null
): boolean {
  if (!activeProfileId) return false;

  const isCorporate = listing.seller_type === 'CORPORATE' || Boolean(listing.corporate_profile_id);

  if (isCorporate) {
    // Kurumsal ilan: corporate_profiles.owner_profile_id === activeProfileId
    return Boolean(storeOwnerProfileId && storeOwnerProfileId === activeProfileId);
  }

  // Bireysel ilan: listing.seller_profile_id === activeProfileId
  return Boolean(listing.seller_profile_id && listing.seller_profile_id === activeProfileId);
}

/**
 * Authoritative Server-Side Corporate Publishing Eligibility Resolver.
 * Resolves strictly from database state. Does NOT trust client-side flags.
 */
export async function resolveCorporateEligibility(profileId: string): Promise<CorporateEligibilityResult> {
  if (!profileId) {
    return { eligible: false, reason: 'NO_STORE', message: 'Karakter profili belirtilmedi.' };
  }

  const dealerRepo = getDealerRepository();

  // 1. Fetch store by profileId (owner_profile_id or profile_id)
  let dealer = typeof (dealerRepo as any).getDealerByProfileId === 'function'
    ? await (dealerRepo as any).getDealerByProfileId(profileId, true)
    : await dealerRepo.getDealerByProfileId(profileId);

  // 2. Fetch application history for profile if available
  let application: CorporateApplication | null = null;
  if (typeof dealerRepo.getApplicationByProfileId === 'function') {
    application = await dealerRepo.getApplicationByProfileId(profileId);
  } else {
    const apps = (db.applications || [])
      .filter((a) => a.applicant_profile_id === profileId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    application = apps[0] || null;
  }

  // Case A: No store exists
  if (!dealer) {
    if (application?.status === 'PENDING') {
      return {
        eligible: false,
        reason: 'PENDING_APPLICATION',
        application,
        message: 'Kurumsal başvurunuz inceleme aşamasındadır.',
      };
    }
    if (application?.status === 'REJECTED') {
      return {
        eligible: false,
        reason: 'REJECTED_APPLICATION',
        application,
        message: 'Kurumsal başvurunuz onaylanmamıştır.',
      };
    }
    return {
      eligible: false,
      reason: 'NO_STORE',
      message: 'Aktif veya onaylı bir kurumsal mağazanız bulunmuyor.',
    };
  }

  // Case B: Store is soft-deleted
  if (dealer.moderation_status === 'DELETED' || dealer.deleted_at) {
    if (application?.status === 'PENDING') {
      return {
        eligible: false,
        reason: 'PENDING_APPLICATION',
        application,
        message: 'Yeni kurumsal başvurunuz inceleme aşamasındadır.',
      };
    }
    return {
      eligible: false,
      reason: 'STORE_DELETED',
      dealer,
      message: 'Kurumsal mağazanız kapatılmıştır.',
    };
  }

  // Case C: Store is suspended by admin moderation
  if (dealer.moderation_status === 'SUSPENDED') {
    return {
      eligible: false,
      reason: 'STORE_SUSPENDED',
      dealer,
      message: dealer.suspension_reason
        ? `Kurumsal mağazanız askıya alınmıştır. Neden: ${dealer.suspension_reason}`
        : 'Kurumsal mağazanız yönetim tarafından askıya alınmıştır.',
    };
  }

  // Unknown/missing moderation state must never become publishable.
  if (dealer.moderation_status !== 'ACTIVE') {
    return {
      eligible: false,
      reason: 'STORE_SUSPENDED',
      dealer,
      message: 'Kurumsal mağazanın moderasyon durumu aktif değildir.',
    };
  }

  // Case D: Store application is not approved
  if (dealer.status === 'PENDING') {
    return {
      eligible: false,
      reason: 'PENDING_APPLICATION',
      dealer,
      application,
      message: 'Kurumsal mağaza başvurunuz onay beklemektedir.',
    };
  }
  if (dealer.status === 'REJECTED') {
    return {
      eligible: false,
      reason: 'REJECTED_APPLICATION',
      dealer,
      application,
      message: 'Kurumsal mağaza başvurunuz reddedilmiştir.',
    };
  }
  if (dealer.status !== 'APPROVED') {
    return {
      eligible: false,
      reason: 'NO_STORE',
      dealer,
      application,
      message: 'Kurumsal mağaza onaylı durumda değildir.',
    };
  }

  // Case E: Store subscription inactive (approved but not yet activated)
  if (!dealer.subscription_status || dealer.subscription_status === 'INACTIVE') {
    return {
      eligible: false,
      reason: 'SUBSCRIPTION_INACTIVE',
      dealer,
      message: 'Kurumsal üyeliğiniz henüz aktif edilmemiştir. Lütfen üyeliğinizi aktif edin.',
    };
  }

  // Case F: Store subscription expired
  const now = new Date();
  const isExpired =
    dealer.subscription_status === 'EXPIRED' ||
    (dealer.subscription_expires_at ? new Date(dealer.subscription_expires_at) <= now : false);

  if (isExpired) {
    return {
      eligible: false,
      reason: 'SUBSCRIPTION_EXPIRED',
      dealer,
      message: 'Kurumsal üyelik süreniz sona ermiştir. Lütfen aboneliğinizi yenileyin.',
    };
  }

  if (dealer.subscription_status !== 'ACTIVE') {
    return {
      eligible: false,
      reason: 'SUBSCRIPTION_INACTIVE',
      dealer,
      message: 'Kurumsal üyeliğiniz aktif değildir.',
    };
  }

  // Case G: Store is ACTIVE (both moderation_status and subscription_status are ACTIVE)
  return {
    eligible: true,
    reason: 'ACTIVE',
    dealer,
    message: 'Kurumsal ilan yayınlamak için uygunsunuz.',
  };
}

export { resolveCorporateHeaderActions, type CorporateHeaderActions } from './status';


