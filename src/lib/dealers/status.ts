export type CorporateApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;
export type CorporateSubscriptionStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | null;

export interface CorporateSidebarLabelParams {
  applicationStatus?: CorporateApplicationStatus;
  subscriptionStatus?: CorporateSubscriptionStatus;
  isDealer?: boolean;
  hasApprovedStore?: boolean;
}

/**
 * Computes the navigation label for the corporate dashboard button.
 * Requirements (Sections 5 & 44):
 * - NONE / undefined: "Kurumsal Başvuru"
 * - PENDING: "Kurumsal Başvuru"
 * - REJECTED: "Kurumsal Başvuru"
 * - APPROVED + subscription INACTIVE: "Kurumsal Profil"
 * - ACTIVE: "Kurumsal Profil"
 * - EXPIRED: "Kurumsal Profil"
 */
export function getCorporateSidebarLabel(
  paramsOrAppStatus?: CorporateSidebarLabelParams | CorporateApplicationStatus | 'NONE',
  subscriptionStatusArg?: CorporateSubscriptionStatus
): string {
  let appStatus: CorporateApplicationStatus | 'NONE' | undefined;
  let subStatus: CorporateSubscriptionStatus | undefined;
  let hasApprovedStore = false;
  let isDealer = false;

  if (typeof paramsOrAppStatus === 'string') {
    appStatus = paramsOrAppStatus;
    subStatus = subscriptionStatusArg;
  } else if (paramsOrAppStatus && typeof paramsOrAppStatus === 'object') {
    appStatus = paramsOrAppStatus.applicationStatus;
    subStatus = paramsOrAppStatus.subscriptionStatus;
    hasApprovedStore = Boolean(paramsOrAppStatus.hasApprovedStore);
    isDealer = Boolean(paramsOrAppStatus.isDealer);
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
