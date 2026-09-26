import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getUserRepository } from '@/lib/db/repositories';

export type ActiveProfileResolution =
  | { ok: true; profileId: string; userId: string; role: 'USER' | 'ADMIN' }
  | { ok: false; status: 401 | 400 | 403; error: string };

/**
 * Resolves the signed session profile to the canonical character_profiles.id
 * and verifies that it belongs to the signed-in account.
 */
export async function resolveOwnedActiveProfile(
  req: NextRequest
): Promise<ActiveProfileResolution> {
  const session = await getServerSession(req);
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

  const profile = await getUserRepository().getProfileById(session.profileId);
  if (!profile || profile.user_id !== session.userId) {
    return { ok: false, status: 403, error: 'Aktif karakter profili bu hesaba ait değil.' };
  }

  return {
    ok: true,
    profileId: profile.id,
    userId: session.userId,
    role: profile.role || 'USER',
  };
}