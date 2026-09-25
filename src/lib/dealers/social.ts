import { CorporateSocialMedia } from '@/types';

/**
 * Normalizes corporate social media data to canonical CorporateSocialMedia[] (max 2 entries).
 * Supports legacy formats ({ name, url } object or { facebrowser, twitter, etc. }) for backward compatibility.
 */
export function normalizeSocialMedia(input: any): CorporateSocialMedia[] {
  if (!input) return [];

  // String format (JSON from DB/Postgres)
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === '{}' || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeSocialMedia(parsed);
    } catch {
      return [];
    }
  }

  // Array format
  if (Array.isArray(input)) {
    return input
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: String(item.name || '').trim(),
        url: String(item.url || '').trim(),
      }))
      .filter((item) => item.name.length > 0 && item.url.length > 0)
      .slice(0, 2);
  }

  // Object format
  if (typeof input === 'object' && input !== null) {
    if ('name' in input && 'url' in input) {
      const name = String(input.name || '').trim();
      const url = String(input.url || '').trim();
      if (name && url) {
        return [{ name, url }];
      }
      return [];
    }

    // Legacy dictionary compatibility: { facebrowser, twitter, instagram, website }
    const results: CorporateSocialMedia[] = [];
    if (input.facebrowser && typeof input.facebrowser === 'string' && input.facebrowser.trim()) {
      results.push({ name: 'Facebrowser', url: input.facebrowser.trim() });
    }
    if (results.length < 2 && input.twitter && typeof input.twitter === 'string' && input.twitter.trim()) {
      results.push({ name: 'X', url: input.twitter.trim() });
    }
    if (results.length < 2 && input.instagram && typeof input.instagram === 'string' && input.instagram.trim()) {
      results.push({ name: 'Instagram', url: input.instagram.trim() });
    }
    if (results.length < 2 && input.website && typeof input.website === 'string' && input.website.trim()) {
      results.push({ name: 'Website', url: input.website.trim() });
    }
    return results.slice(0, 2);
  }

  return [];
}
