const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export function resolveUserId(id: string | null | undefined): string {
  if (!id) return '';
  if (id === 'usr-admin-1' || id === 'gta-user-1') return '22222222-2222-2222-2222-222222222222';
  if (id === 'usr-user-2' || id === 'gta-user-2' || id === 'usr-buyer-3') return '33333333-3333-3333-3333-333333333333';
  return id;
}

export function resolveStoreUserId(id: string | null | undefined): string {
  if (!id) return '';
  if (id === '22222222-2222-2222-2222-222222222222') return 'usr-admin-1';
  if (id === '33333333-3333-3333-3333-333333333333') return 'usr-user-2';
  return id;
}

export function resolveProfileId(id: string | null | undefined): string {
  if (!id) return '';
  if (UUID_REGEX.test(id)) return id;
  if (id === 'char-mavis-01') return '44444444-4444-4444-4444-444444444441';
  if (id === 'char-zade-02') return '44444444-4444-4444-4444-444444444442';
  if (id === 'char-ravi-03') return '44444444-4444-4444-4444-444444444443';
  return id;
}

export function resolveStoreProfileId(id: string | null | undefined): string {
  if (!id) return '';
  if (id === '44444444-4444-4444-4444-444444444441') return 'char-mavis-01';
  if (id === '44444444-4444-4444-4444-444444444442') return 'char-zade-02';
  if (id === '44444444-4444-4444-4444-444444444443') return 'char-ravi-03';
  return id;
}
