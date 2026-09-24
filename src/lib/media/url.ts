/**
 * Public domain for Cloudflare R2 bucket.
 * Prefers NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN or CLOUDFLARE_R2_PUBLIC_DOMAIN.
 */
const DEFAULT_R2_PUBLIC_DOMAIN = 'https://pub-454798ec1d264d749a7f16dac2c48498.r2.dev';

export function getR2PublicDomain(): string {
  const domain =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN ||
        process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN)) ||
    DEFAULT_R2_PUBLIC_DOMAIN;

  let clean = domain.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

/**
 * Resolves a storage path or URL into a fully qualified image URL.
 * - If pathOrUrl is empty/null/undefined: returns empty string
 * - If pathOrUrl already starts with http:// or https://: returns as-is
 * - If pathOrUrl is an R2 key (e.g. avatars/..., listings/..., dealers/...):
 *   returns CLOUDFLARE_R2_PUBLIC_DOMAIN + "/" + path
 */
export function resolveMediaUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const domain = getR2PublicDomain();
  return `${domain}/${cleanPath}`;
}

/**
 * Resolves an avatar URL with a safe fallback only when avatar is empty/null.
 */
export function resolveAvatarUrl(
  pathOrUrl?: string | null,
  fallbackUrl: string = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80'
): string {
  const resolved = resolveMediaUrl(pathOrUrl);
  if (!resolved) {
    return fallbackUrl;
  }
  return resolved;
}
