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
