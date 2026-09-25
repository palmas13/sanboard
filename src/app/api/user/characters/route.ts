import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { GtaWorldCharacter } from '@/lib/integrations/gtaworld/types';

export async function GET(req: NextRequest) {
  const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
  const session = await getServerSession(req);
  const userId = session?.userId || (isMock ? '22222222-2222-2222-2222-222222222222' : null);

  if (!userId) {
    if (isMock) {
      return NextResponse.json({
        success: true,
        characters: MOCK_CHARACTERS,
        isMock: true,
      });
    }
    return NextResponse.json(
      { error: 'Karakterleri listelemek için oturum açmalısınız.', characters: [] },
      { status: 401 }
    );
  }

  // 1. Fetch real / synchronized character profiles from DB for this account
  let dbProfiles: any[] = [];
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

  const { resolveStoreUserId, resolveUserId, resolveProfileId, resolveStoreProfileId } = await import('@/lib/db/id-mapper');
  const safeStoreUserId = resolveStoreUserId(userId);
  const safeSupabaseUserId = resolveUserId(userId);

  if (dbProfiles.length === 0) {
    dbProfiles = db.profiles.filter(
      (p) => p.user_id === userId || p.user_id === safeStoreUserId || p.user_id === safeSupabaseUserId
    );
  }

  if (isMock) {
    // Merge mock character list with persisted profiles strictly by stable identity
    const merged = MOCK_CHARACTERS.map((char) => {
      const matched = dbProfiles.find(
        (p) =>
          p.id === char.id ||
          p.external_character_id === char.id ||
          resolveProfileId(p.id) === char.id ||
          resolveStoreProfileId(p.id) === char.id
      );

      if (matched) {
        return {
          ...char,
          id: matched.id,
          externalCharacterId: matched.external_character_id || char.id,
          fullName: matched.full_name,
          hasProfile: true,
          avatarUrl: matched.avatar_path || matched.avatar_url || '',
          avatarPath: matched.avatar_path || matched.avatar_url || '',
          sanmailEmail: matched.sanmail_email || '',
          phone: matched.phone || '',
        };
      }

      return {
        ...char,
        hasProfile: Boolean(char.hasProfile),
        avatarUrl: char.avatarUrl || '',
        sanmailEmail: char.sanmailEmail || '',
        phone: char.phone || '',
      };
    });

    return NextResponse.json({
      success: true,
      characters: merged,
      profiles: dbProfiles,
      isMock: true,
    });
  }

  const characters: GtaWorldCharacter[] = dbProfiles.map((p) => ({
    id: p.id,
    externalCharacterId: p.external_character_id || p.id,
    fullName: p.full_name,
    hasProfile: true,
    avatarUrl: p.avatar_path || p.avatar_url || '',
    avatarPath: p.avatar_path || p.avatar_url || '',
    sanmailEmail: p.sanmail_email || '',
    phone: p.phone || '',
  }));

  return NextResponse.json({
    success: true,
    characters,
    profiles: dbProfiles,
    isMock: false,
  });
}
