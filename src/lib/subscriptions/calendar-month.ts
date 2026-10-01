/** PostgreSQL-compatible `timestamp + interval '1 month'` UTC arithmetic. */
export function addCalendarMonth(value: Date): Date {
  const result = new Date(value.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export const CORPORATE_RENEWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const CORPORATE_PERIOD_BOOST_ALLOWANCE = 3;

export function canRenewCorporateSubscription(
  subscriptionStatus: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (subscriptionStatus !== 'ACTIVE') return true;
  // An ACTIVE row without a valid boundary is inconsistent, not renewable.
  // Fail closed so checkout cannot silently repair malformed entitlement data.
  if (!subscriptionExpiresAt) return false;
  const expiryTime = new Date(subscriptionExpiresAt).getTime();
  if (!Number.isFinite(expiryTime)) return false;
  if (expiryTime <= now.getTime()) return true;
  return expiryTime - now.getTime() <= CORPORATE_RENEWAL_WINDOW_MS;
}