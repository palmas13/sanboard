import type { MemberListingDetail, PublicListingSummary } from '@/types';
import { getListingRepository } from '@/lib/db/repositories';
import { getListingCoverPath } from '@/lib/listings/images';
import { resolveMediaUrl } from '@/lib/media/url';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getAbsoluteUrl, getListingUrl, parseListingRouteIdentifier } from '@/lib/urls';
import { SITE_DESCRIPTION, SITE_TITLE } from './site-metadata';

type ShareListing = MemberListingDetail | PublicListingSummary;

export interface ListingShareData {
  title: string;
  description: string;
  price: string;
  category: string;
  location?: string;
  date: string;
  coverImage?: string;
  canonical: string;
  ogImage: string;
}

export const GENERIC_SHARE_DATA = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  canonical: getAbsoluteUrl('/'),
  ogImage: getAbsoluteUrl('/opengraph-image'),
};

const PUBLIC_DETAIL_STATUSES = new Set(['ACTIVE', 'SOLD', 'REMOVED']);

export function getListingShareDescription(listing: Pick<ShareListing, 'price' | 'subcategory' | 'category' | 'location' | 'published_at'>): string {
  const parts = [formatCurrency(listing.price), listing.subcategory];
  const location = listing.category === 'property' ? listing.location?.trim() : '';
  if (location) parts.push(location);
  const date = formatDate(listing.published_at);
  if (date !== '-') parts.push(date);
  return parts.join(' · ');
}

export function createListingShareData(listing: ShareListing): ListingShareData | null {
  if (listing.status && !PUBLIC_DETAIL_STATUSES.has(listing.status)) return null;

  const path = getListingUrl(listing);
  const rawCover = 'cover_image' in listing
    ? listing.cover_image
    : 'images' in listing
      ? getListingCoverPath(listing.images)
      : undefined;
  const location = listing.category === 'property' ? listing.location?.trim() || undefined : undefined;

  return {
    title: listing.title,
    description: getListingShareDescription(listing),
    price: formatCurrency(listing.price),
    category: listing.subcategory,
    location,
    date: formatDate(listing.published_at),
    coverImage: rawCover ? resolveMediaUrl(rawCover) : undefined,
    canonical: getAbsoluteUrl(path),
    ogImage: getAbsoluteUrl(`${path}/opengraph-image`),
  };
}

export async function resolveListingShareData(identifier: string): Promise<ListingShareData | null> {
  const repo = getListingRepository();
  const parsed = parseListingRouteIdentifier(identifier);
  const { listing } = parsed.publicId
    ? await repo.getListingByPublicId(parsed.publicId)
    : await repo.getListingById(parsed.legacyId!);
  return listing ? createListingShareData(listing) : null;
}
