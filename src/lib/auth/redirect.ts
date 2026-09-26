export function normalizeInternalRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  let candidate = value.trim();
  if (!candidate || /[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  for (let index = 0; index < 3; index += 1) {
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
    let decoded: string;
    try { decoded = decodeURIComponent(candidate); } catch { return fallback; }
    if (decoded === candidate) break;
    candidate = decoded.trim();
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  return candidate;
}