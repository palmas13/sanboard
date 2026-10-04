import { NextRequest, NextResponse } from 'next/server';
import { getCharacterSelectionContext, getServerSession } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { isTestExternalAccountId, isTestLoginEnabled } from '@/lib/auth/test-login';
import { getUserRepository } from '@/lib/db/repositories';
import { CharacterProfile, CharacterSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  const selectionContext = session ? null : getCharacterSelectionContext(req);
  const userId = session?.userId || selectionContext?.userId || null;

  if (!userId) {
    return NextResponse.json(
      { error: 'Karakterleri listelemek için oturum açmalısınız.', characters: [] },
      { status: 401 }
    );
  }

  const user = await getUserRepository().getUserById(userId);
  const isTestIdentity = isTestExternalAccountId(user?.external_user_id);
  if (isTestIdentity && !isTestLoginEnabled()) {
    return NextResponse.json({ error: 'Test login devre dışı.', characters: [] }, { status: 404 });
  }

  // 1. Fetch real / synchronized character profiles from DB for this account
  let dbProfiles: CharacterProfile[] = [];
  if (process.env.DATA_STORE === 'supabase') {
    try {
      const client = getSupabaseAdminClient();
      if (client) {
        const { data: profiles, error } = await client
          .from('character_profiles')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!error && profiles) {
          dbProfiles = profiles;
        }
      }
    } catch {
      // fallback
    }
  }

  if (dbProfiles.length === 0) {
    dbProfiles = db.profiles.filter((p) => p.user_id === userId);
  }

  const profilesByExternalId = new Map(dbProfiles.map((profile) => [profile.external_character_id, profile]));
  const discovered = selectionContext?.characters;
  const characters: CharacterSummary[] = discovered !== undefined
    ? discovered.map((character) => {
        const profile = profilesByExternalId.get(character.externalCharacterId);
        return {
          id: character.externalCharacterId,
          profileId: profile?.id || null,
          externalCharacterId: character.externalCharacterId,
          firstName: character.firstName,
          lastName: character.lastName,
          displayName: [character.firstName, character.lastName].filter(Boolean).join(' '),
          avatarUrl: profile ? resolveMediaUrl(profile.avatar_path || profile.avatar_url || '') || null : null,
          role: profile?.role || 'USER',
          hasProfile: Boolean(profile),
        };
      })
    : dbProfiles.map((profile) => ({
        id: profile.id,
        displayName: profile.full_name,
        avatarUrl: resolveMediaUrl(profile.avatar_path || profile.avatar_url || '') || null,
        role: profile.role || 'USER',
      }));

  return NextResponse.json({
    success: true,
    characters,
    isTestIdentity,
  });
}
