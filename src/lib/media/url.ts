/**
 * Public domain for Cloudflare R2 bucket via Cloudflare Worker media delivery.
 * Prefers NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN or CLOUDFLARE_R2_PUBLIC_DOMAIN.
 */
const DEFAULT_R2_PUBLIC_DOMAIN = "https://cdn.sanboard.xyz";

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
 * Checks if a URL or path is a Sanboard R2 media reference.
 */
export function isSanboardMediaUrl(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.includes('images.unsplash.com')) {
    return false;
  }
  if (
    trimmed.includes('r2.dev') ||
    trimmed.includes('sanboard-media.esin18457.workers.dev') ||
    trimmed.includes('cdn.sanboard.xyz')
  ) {
    return true;
  }
  return (
    trimmed.startsWith('avatars/') ||
    trimmed.startsWith('listings/') ||
    trimmed.startsWith('dealers/') ||
    trimmed.startsWith('/avatars/') ||
    trimmed.startsWith('/listings/') ||
    trimmed.startsWith('/dealers/')
  );
}

/**
 * Extracts the canonical R2 object key from a storage path or full Worker/R2 URL.
 * Returns null if not a recognized Sanboard R2 path.
 */
export function extractObjectKey(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.includes('images.unsplash.com')) {
    return null;
  }

  let pathPart = trimmed;
  if (pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
    try {
      const url = new URL(pathPart);
      pathPart = url.pathname;
    } catch {
      return null;
    }
  }

  // Remove leading slashes
  pathPart = pathPart.replace(/^\/+/, '');

  // Verify prefix matches one of the canonical folders
  if (
    pathPart.startsWith('avatars/') ||
    pathPart.startsWith('listings/') ||
    pathPart.startsWith('dealers/logos/') ||
    pathPart.startsWith('dealers/banners/')
  ) {
    return pathPart;
  }

  return null;
}

export const extractMediaKey = extractObjectKey;

/**
 * Resolves a storage path or URL into a fully qualified image URL.
 * - If pathOrUrl is empty/null/undefined: returns empty string
 * - If pathOrUrl starts with data:: returns as-is
 * - If pathOrUrl contains legacy r2.dev: rewrites domain to active Worker domain
 * - If pathOrUrl is external (e.g. unsplash): returns as-is
 * - If pathOrUrl is an R2 key (e.g. avatars/..., listings/..., dealers/...):
 *   returns CLOUDFLARE_R2_PUBLIC_DOMAIN + "/" + path
 */
export function resolveMediaUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const domain = getR2PublicDomain();

  // Eski Sanboard R2 / Worker URL'lerini canonical CDN domainine çevir.
  if (
    trimmed.includes('r2.dev') ||
    trimmed.includes('sanboard-media.esin18457.workers.dev')
  ) {
    const key = extractObjectKey(trimmed);

    if (key) {
      return `${domain}/${key}`;
    }
  }

  // Zaten yeni CDN domainindeyse aynen bırak.
  if (
    trimmed.startsWith(`${domain}/`) ||
    trimmed === domain
  ) {
    return trimmed;
  }

  // Sanboard dışındaki external URL'leri koru.
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // R2 object path
  const cleanPath = trimmed.replace(/^\/+/, '');

  return `${domain}/${cleanPath}`;
}

/**
 * Resolves an avatar URL with a safe fallback only when avatar is empty/null.
 */
export function resolveAvatarUrl(
  pathOrUrl?: string | null,
  fallbackUrl: string = ''
): string {
  const resolved = resolveMediaUrl(pathOrUrl);
  if (!resolved) {
    return fallbackUrl;
  }
  return resolved;
}
