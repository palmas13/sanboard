const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export function resolveUserId(id: string | null | undefined): string {
  if (!id) return '';
  if (UUID_REGEX.test(id)) return id;
  if (id === 'usr-admin-1' || id === 'gta-user-1') return '22222222-2222-2222-2222-222222222222';
  if (id === 'usr-user-2' || id === 'gta-user-2') return '33333333-3333-3333-3333-333333333333';
  return id;
}

export function resolveProfileId(id: string | null | undefined): string {
  if (!id) return '';
  if (UUID_REGEX.test(id)) return id;
  if (id === 'char-mavis-01') return '44444444-4444-4444-4444-444444444441';
  if (id === 'char-zade-02') return '44444444-4444-4444-4444-444444444442';
  return id;
}
