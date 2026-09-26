import type { ExternalGameAccount } from '@/lib/integrations/gtaworld/types';

export const TEST_LOGIN_ACCOUNT_PREFIX = 'test-login:account:';
export const TEST_LOGIN_CHARACTER_PREFIX = 'test-login:character:';

export function isTestLoginEnabled(): boolean {
  return process.env.ENABLE_TEST_LOGIN === 'true';
}

export function isTestExternalAccountId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEST_LOGIN_ACCOUNT_PREFIX);
}

export function isTestExternalCharacterId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEST_LOGIN_CHARACTER_PREFIX);
}

export function assertTestLoginAccountNamespace(account: ExternalGameAccount): void {
  if (!isTestExternalAccountId(account.externalAccountId)) {
    throw new Error('Test login provider returned an account outside the test namespace.');
  }
  if (!account.characters.length || account.characters.some((character) => !isTestExternalCharacterId(character.externalCharacterId))) {
    throw new Error('Test login provider returned a character outside the test namespace.');
  }
}