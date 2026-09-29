import type { ExternalGameAccount } from '@/lib/integrations/gtaworld/types';
import type { CharacterProfile, User } from '@/types';
import { getUserRepository } from '@/lib/db/repositories';

export const TEST_LOGIN_ACCOUNT_PREFIX = 'test-login:account:';
export const TEST_LOGIN_CHARACTER_PREFIX = 'test-login:character:';
export const TEST_LOGIN_FIXTURE_ACCOUNT_ID = `${TEST_LOGIN_ACCOUNT_PREFIX}fixtures`;
export const TEST_LOGIN_SECONDARY_ACCOUNT_ID = `${TEST_LOGIN_ACCOUNT_PREFIX}secondary`;
export const TEST_LOGIN_MAVIS_CHARACTER_ID = `${TEST_LOGIN_CHARACTER_PREFIX}mavis-pierce`;
export const TEST_LOGIN_JOHN_CHARACTER_ID = `${TEST_LOGIN_CHARACTER_PREFIX}john-doe`;
export const TEST_LOGIN_JANE_CHARACTER_ID = `${TEST_LOGIN_CHARACTER_PREFIX}jane-doe`;

export function isTestLoginEnabled(): boolean {
  return process.env.ENABLE_TEST_LOGIN === 'true';
}

export function isTestPaymentBypassEnabled(): boolean {
  return process.env.ENABLE_TEST_PAYMENT_BYPASS === 'true';
}

export function isTestExternalAccountId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEST_LOGIN_ACCOUNT_PREFIX);
}

export function isTestExternalCharacterId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEST_LOGIN_CHARACTER_PREFIX);
}

export function isTestLoginAccount(user: Pick<User, 'provider' | 'external_user_id'> | null | undefined): boolean {
  return Boolean(
    isTestLoginEnabled()
    && user?.provider === 'GTAWORLD'
    && isTestExternalAccountId(user.external_user_id)
  );
}

export async function isCanonicalTestLoginActor(params: {
  userId: string;
  profile: CharacterProfile;
}): Promise<boolean> {
  if (!isTestLoginEnabled() || params.profile.user_id !== params.userId) return false;
  if (!isTestExternalCharacterId(params.profile.external_character_id)) return false;

  const user = await getUserRepository().getUserById(params.userId);
  return Boolean(user && user.id === params.userId && user.status === 'ACTIVE' && isTestLoginAccount(user));
}

export async function canBypassTestPayment(params: {
  userId: string;
  profile: CharacterProfile;
}): Promise<boolean> {
  return isTestPaymentBypassEnabled() && isCanonicalTestLoginActor(params);
}

export function assertTestLoginAccountNamespace(account: ExternalGameAccount): void {
  if (!isTestExternalAccountId(account.externalAccountId)) {
    throw new Error('Test login provider returned an account outside the test namespace.');
  }
  if (!account.characters.length || account.characters.some((character) => !isTestExternalCharacterId(character.externalCharacterId))) {
    throw new Error('Test login provider returned a character outside the test namespace.');
  }
}

/**
 * Applies fixture authorization only after the reserved test account has been
 * synchronized to canonical profiles. Production GTA World identities never
 * enter this path and display names are deliberately not authorization inputs.
 */
export async function reconcileTestLoginRoles(
  user: User,
  profiles: CharacterProfile[]
): Promise<CharacterProfile[]> {
  if (!isTestLoginEnabled() || !isTestLoginAccount(user)) {
    throw new Error('Test role reconciliation requires an enabled canonical test account.');
  }

  if (user.external_user_id === TEST_LOGIN_FIXTURE_ACCOUNT_ID) {
    const mavisProfiles = profiles.filter(
      (profile) =>
        profile.user_id === user.id &&
        profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID
    );
    if (mavisProfiles.length !== 1) {
      throw new Error('Reserved Mavis test character could not be resolved unambiguously.');
    }
  }

  const repo = getUserRepository();
  for (const profile of profiles) {
    if (profile.user_id !== user.id || !isTestExternalCharacterId(profile.external_character_id)) {
      throw new Error('Test role reconciliation encountered an out-of-scope profile.');
    }
    const role = user.external_user_id === TEST_LOGIN_FIXTURE_ACCOUNT_ID
      && profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID
      ? 'ADMIN'
      : 'USER';
    const updated = await repo.updateProfile(profile.id, { role });
    if (!updated.success) throw new Error(updated.error || 'Test character role could not be synchronized.');
  }

  return repo.getProfilesByUserId(user.id);
}