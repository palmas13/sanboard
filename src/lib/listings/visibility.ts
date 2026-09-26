import type { Listing } from '@/types';

export function isListingExpired(listing: Pick<Listing, 'expires_at'>, now = new Date()): boolean {
  return !listing.expires_at || new Date(listing.expires_at).getTime() <= now.getTime();
}

export function getEffectiveListingStatus(
  listing: Pick<Listing, 'status' | 'expires_at'>,
  now = new Date()
): Listing['status'] {
  return listing.status === 'ACTIVE' && isListingExpired(listing, now) ? 'EXPIRED' : listing.status;
}

export function isPublicListingVisible(
  listing: Pick<Listing, 'status' | 'expires_at' | 'seller_type' | 'corporate_profile_id'>,
  corporate?: { moderation_status?: string | null; deleted_at?: string | null } | null,
  now = new Date()
): boolean {
  if (getEffectiveListingStatus(listing, now) !== 'ACTIVE') return false;
  if (listing.seller_type !== 'CORPORATE') return true;
  return Boolean(
    listing.corporate_profile_id &&
    corporate?.moderation_status === 'ACTIVE' &&
    !corporate.deleted_at
  );
}