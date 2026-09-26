const MOCK_USER_ALIASES: Record<string, string> = {
  'usr-admin-1': '22222222-2222-2222-2222-222222222222',
  'gta-user-1': '22222222-2222-2222-2222-222222222222',
  'usr-user-2': '33333333-3333-3333-3333-333333333333',
  'gta-user-2': '33333333-3333-3333-3333-333333333333',
  'usr-buyer-3': '33333333-3333-3333-3333-333333333333',
};

const MOCK_PROFILE_ALIASES: Record<string, string> = {
  'char-mavis-01': '44444444-4444-4444-4444-444444444441',
  'char-zade-02': '44444444-4444-4444-4444-444444444442',
  'char-ravi-03': '44444444-4444-4444-4444-444444444443',
};

export function resolveMockUserId(id: string): string {
  return MOCK_USER_ALIASES[id] || id;
}

export function getMockUserAliases(id: string): string[] {
  const canonical = resolveMockUserId(id);
  return [canonical, ...Object.keys(MOCK_USER_ALIASES).filter((alias) => MOCK_USER_ALIASES[alias] === canonical)];
}

export function getMockProfileAliases(id: string): string[] {
  const canonical = MOCK_PROFILE_ALIASES[id] || id;
  return [canonical, ...Object.keys(MOCK_PROFILE_ALIASES).filter((alias) => MOCK_PROFILE_ALIASES[alias] === canonical)];
}