const TURKISH_CHARACTERS: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

export function slugify(value: string): string {
  const ascii = Array.from(value || '', (char) => TURKISH_CHARACTERS[char] ?? char).join('');
  return ascii
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'ilan';
}

export function isListingPublicId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{5}$/.test(value);
}

export function parseListingRouteIdentifier(identifier: string): { publicId?: string; legacyId?: string } {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
    return { legacyId: identifier };
  }
  const match = identifier.match(/(?:^|-)([1-9][0-9]{5})$/);
  return match ? { publicId: match[1] } : { legacyId: identifier };
}

export function getListingUrl(listing: { title: string; public_id?: string | null; id: string }): string {
  return listing.public_id && isListingPublicId(listing.public_id)
    ? `/ilan/${slugify(listing.title)}-${listing.public_id}`
    : `/ilan/${listing.id}`;
}

export function getCorporateUrl(profile: { slug?: string | null; id: string }): string {
  return profile.slug ? `/kurumsal/${profile.slug}` : `/kurumsal/${profile.id}`;
}

export function getAbsoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sanboard.xyz';
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}