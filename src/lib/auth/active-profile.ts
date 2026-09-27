import { NextRequest } from 'next/server';
import { getServerSession, getServerSessionWithTiming, SessionTimingStage } from '@/lib/auth/session';
import { getUserRepository } from '@/lib/db/repositories';
import { CharacterProfile } from '@/types';

export type ActiveProfileResolution =
  | { ok: true; profileId: string; userId: string; role: 'USER' | 'ADMIN'; profile: CharacterProfile }
  | { ok: false; status: 401 | 400 | 403; error: string };

export type ActiveAdminResolution = ActiveProfileResolution;
export type ActiveProfileTimingStage = SessionTimingStage | 'canonical_profile_lookup' | 'actor_map';
export type ActiveProfileTimingObserver = (stage: ActiveProfileTimingStage, duration: number) => void;

/**
 * Resolves the signed session profile to the canonical character_profiles.id
 * and verifies that it belongs to the signed-in account.
 */
export async function resolveOwnedActiveProfile(
  req: NextRequest,
  onTiming?: ActiveProfileTimingObserver
): Promise<ActiveProfileResolution> {
  const session = onTiming
    ? await getServerSessionWithTiming(req, onTiming)
    : await getServerSession(req);
  if (!session?.userId) {
    return { ok: false, status: 401, error: 'Yetkisiz erişim. Lütfen giriş yapın.' };
  }

  if (!session.profileId) {
    return {
      ok: false,
      status: 400,
      error: 'Aktif bir karakter profili seçilmedi. Lütfen bir karakter seçin.',
    };
  }

  const canonicalLookupStartedAt = performance.now();
  let profile: CharacterProfile | null;
  try {
    profile = await getUserRepository().getCanonicalProfileById(session.profileId);
  } finally {
    onTiming?.('canonical_profile_lookup', performance.now() - canonicalLookupStartedAt);
  }

  const actorMapStartedAt = performance.now();
  try {
    if (!profile || profile.user_id !== session.userId) {
      return { ok: false, status: 403, error: 'Aktif karakter profili bu hesaba ait değil.' };
    }

    return {
      ok: true,
      profileId: profile.id,
      userId: session.userId,
      role: profile.role || 'USER',
      profile,
    };
  } finally {
    onTiming?.('actor_map', performance.now() - actorMapStartedAt);
  }
}

/** Resolves a human admin strictly from the owned active character's DB-fresh role. */
export async function resolveActiveAdmin(req: NextRequest): Promise<ActiveAdminResolution> {
  const actor = await resolveOwnedActiveProfile(req);
  if (!actor.ok) {
    if (actor.status === 400) {
      return { ok: false, status: 403, error: 'Aktif yönetici karakteri seçilmedi.' };
    }
    return actor;
  }
  if (actor.role !== 'ADMIN') {
    return { ok: false, status: 403, error: 'Bu işlem için aktif yönetici karakteri gereklidir.' };
  }
  const user = await getUserRepository().getUserById(actor.userId);
  if (!user || user.status !== 'ACTIVE') {
    return { ok: false, status: 403, error: 'Yönetici hesabı aktif değil.' };
  }
  return actor;
}