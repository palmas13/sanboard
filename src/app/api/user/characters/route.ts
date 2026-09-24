import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { MOCK_CHARACTERS } from '@/lib/integrations/gtaworld/mock-provider';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { GtaWorldCharacter } from '@/lib/integrations/gtaworld/types';

export async function GET(req: NextRequest) {
  const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';

  // 1. If in mock development mode, always serve MOCK_CHARACTERS
  if (isMock) {
    return NextResponse.json({
      success: true,
      characters: MOCK_CHARACTERS,
      isMock: true,
    });
  }

  // 2. Real OAuth mode: Must have valid authenticated session
  const session = await getServerSession(req);
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Karakterleri listelemek için oturum açmalısınız.', characters: [] },
      { status: 401 }
    );
  }

  const userId = session.userId;
  const characters: GtaWorldCharacter[] = [];

  // Fetch real synchronized character profiles for this account
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
          for (const p of profiles) {
            characters.push({
              id: p.id,
              fullName: p.full_name,
              hasProfile: true,
              avatarUrl: p.avatar_path || p.avatar_url || '',
              avatarPath: p.avatar_path || p.avatar_url || '',
              sanmailEmail: p.sanmail_email,
              phone: p.phone,
            });
          }
        }
      }
    } catch {
      // Fallback to memory
    }
  }

  if (characters.length === 0) {
    const memoryProfiles = db.profiles.filter((p) => p.user_id === userId);
    for (const p of memoryProfiles) {
      characters.push({
        id: p.id,
        fullName: p.full_name,
        hasProfile: true,
        avatarUrl: p.avatar_path || p.avatar_url || '',
        avatarPath: p.avatar_path || p.avatar_url || '',
        sanmailEmail: p.sanmail_email,
        phone: p.phone,
      });
    }
  }

  return NextResponse.json({
    success: true,
    characters,
    isMock: false,
  });
}
