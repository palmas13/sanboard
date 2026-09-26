import { NextRequest, NextResponse } from 'next/server';
import { getCharacterSelectionContext, getServerSession } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { GtaWorldCharacter } from '@/lib/integrations/gtaworld/types';
import { isMockGtaWorldAuthEnabled } from '@/lib/integrations/gtaworld';

export async function GET(req: NextRequest) {
  const isMock = isMockGtaWorldAuthEnabled();
  const session = await getServerSession(req);
  const selectionContext = session ? null : getCharacterSelectionContext(req);
  const userId = session?.userId || selectionContext?.userId || null;

  if (!userId) {
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

  if (dbProfiles.length === 0) {
    dbProfiles = db.profiles.filter((p) => p.user_id === userId);
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
    isMock,
  });
}
