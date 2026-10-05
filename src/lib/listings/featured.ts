export function isListingActivelyFeatured(
  listing: { status?: string | null; is_featured?: boolean | null; featured_until?: string | null },
  now: Date | number = Date.now()
) {
  if (listing.status === 'FROZEN' || !listing.is_featured || !listing.featured_until) return false;
  const nowTime = typeof now === 'number' ? now : now.getTime();
  const featuredUntil = new Date(listing.featured_until).getTime();
  return Number.isFinite(featuredUntil) && featuredUntil > nowTime;
}