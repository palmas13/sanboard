export type CorporateApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;
export type CorporateSubscriptionStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | null;

export interface CorporateSidebarLabelParams {
  applicationStatus?: CorporateApplicationStatus;
  subscriptionStatus?: CorporateSubscriptionStatus;
  moderationStatus?: string;
  isDealer?: boolean;
  hasApprovedStore?: boolean;
}

/**
 * Computes the navigation label for the corporate dashboard button.
 * Requirements:
 * - DELETED: "Kurumsal Başvuru"
 * - NONE / undefined: "Kurumsal Başvuru"
 * - PENDING: "Kurumsal Başvuru"
 * - REJECTED: "Kurumsal Başvuru"
 * - APPROVED + subscription INACTIVE: "Kurumsal Profil"
 * - SUSPENDED: "Kurumsal Profil"
 * - ACTIVE: "Kurumsal Profil"
 * - EXPIRED: "Kurumsal Profil"
 */
export function getCorporateSidebarLabel(
  paramsOrAppStatus?: CorporateSidebarLabelParams | CorporateApplicationStatus | 'NONE',
  subscriptionStatusArg?: CorporateSubscriptionStatus
): string {
  let appStatus: CorporateApplicationStatus | 'NONE' | undefined;
  let subStatus: CorporateSubscriptionStatus | undefined;
  let moderationStatus: string | undefined;
  let hasApprovedStore = false;
  let isDealer = false;

  if (typeof paramsOrAppStatus === 'string') {
    appStatus = paramsOrAppStatus;
    subStatus = subscriptionStatusArg;
  } else if (paramsOrAppStatus && typeof paramsOrAppStatus === 'object') {
    appStatus = paramsOrAppStatus.applicationStatus;
    subStatus = paramsOrAppStatus.subscriptionStatus;
    moderationStatus = paramsOrAppStatus.moderationStatus;
    hasApprovedStore = Boolean(paramsOrAppStatus.hasApprovedStore);
    isDealer = Boolean(paramsOrAppStatus.isDealer);
  }

  if (moderationStatus === 'DELETED') {
    return 'Kurumsal Başvuru';
  }

  // If user has an approved corporate store (or approved application)
  if (
    hasApprovedStore ||
    appStatus === 'APPROVED' ||
    subStatus === 'ACTIVE' ||
    subStatus === 'INACTIVE' ||
    subStatus === 'EXPIRED' ||
    isDealer
  ) {
    // If explicitly in pending/rejected application state and store is not approved yet
    if (appStatus === 'PENDING' && !hasApprovedStore && !isDealer) {
      return 'Kurumsal Başvuru';
    }
    if (appStatus === 'REJECTED' && !hasApprovedStore && !isDealer) {
      return 'Kurumsal Başvuru';
    }
    return 'Kurumsal Profil';
  }

  return 'Kurumsal Başvuru';
}

export interface CorporateHeaderActions {
  canOpenStore: boolean;
  canCreateCorporateListing: boolean;
}

/**
 * Single Canonical State Resolver for Header Action Buttons (Section 7, 8, 9).
 * Guarantees zero contradiction between page content and header buttons.
 * Fully client-safe (no server/database dependencies).
 */
export function resolveCorporateHeaderActions(params: {
  eligibility?: any;
  activeProfileId?: string | null;
  isCorporatePage?: boolean;
}): CorporateHeaderActions {
  const { eligibility, activeProfileId, isCorporatePage } = params;
  if (!eligibility || !activeProfileId) {
    return { canOpenStore: false, canCreateCorporateListing: false };
  }

  const store = eligibility.dealer;
  const isOwner = Boolean(
    store &&
    (store.owner_profile_id === activeProfileId || store.profile_id === activeProfileId)
  );
  const isStoreModerationActive = Boolean(
    store &&
    store.moderation_status === 'ACTIVE' &&
    !store.deleted_at
  );

  // Section 7: "Mağazamı Aç"
  // Minimum: owner_profile_id === activeProfileId AND moderation_status === 'ACTIVE' AND deleted_at IS NULL
  // Subscription EXPIRED olsa bile public mağaza erişilebilir olduğundan gösterilebilir.
  // NO_STORE, PENDING, REJECTED, SUSPENDED, DELETED durumlarında ASLA görünmemeli.
  const canOpenStore = Boolean(
    isOwner &&
    isStoreModerationActive &&
    (eligibility.reason === 'ACTIVE' || eligibility.reason === 'SUBSCRIPTION_EXPIRED')
  );

  // Section 8: "Yeni İlan Ver" (Kurumsal header'da)
  // Sadece: owner_profile_id === activeProfileId AND moderation_status === 'ACTIVE' AND deleted_at IS NULL AND subscription_status === 'ACTIVE'
  // NO_STORE, PENDING, REJECTED, SUSPENDED, DELETED, SUBSCRIPTION_INACTIVE, SUBSCRIPTION_EXPIRED -> görünmez.
  // ACTIVE + ACTIVE SUBSCRIPTION -> görünür.
  const canCreateCorporateListing = Boolean(
    isCorporatePage &&
    isOwner &&
    isStoreModerationActive &&
    store?.subscription_status === 'ACTIVE' &&
    eligibility.eligible &&
    eligibility.reason === 'ACTIVE'
  );

  return { canOpenStore, canCreateCorporateListing };
}

