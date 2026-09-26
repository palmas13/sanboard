const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export function resolveUserId(id: string | null | undefined): string {
  return id || '';
}

export function resolveStoreUserId(id: string | null | undefined): string {
  return id || '';
}

export function resolveProfileId(id: string | null | undefined): string {
  return id || '';
}

export function resolveStoreProfileId(id: string | null | undefined): string {
  return id || '';
}
