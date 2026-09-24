import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, createSessionCookie, clearSessionCookie, getServerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/store';

// Known staging/mock character to user account mapping
const STAGING_CHARACTER_ACCOUNTS: Record<string, { userId: string; role: 'USER' | 'ADMIN' }> = {
  // Production DB UUIDs
  '44444444-4444-4444-4444-444444444441': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  '44444444-4444-4444-4444-444444444442': {
    userId: '33333333-3333-3333-3333-333333333333',
    role: 'USER',
  },
  // Legacy / memory IDs
  'char-mavis-01': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  'char-zade-02': {
    userId: '33333333-3333-3333-3333-333333333333',
    role: 'USER',
  },
};

// GET current session info
export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, session });
}

import { getSupabaseAdminClient } from '@/lib/db/supabase-client';

// POST create/issue signed session on character selection or login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body.characterId || body.profileId;

    if (!characterId) {
      return NextResponse.json(
        { error: 'characterId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    // Resolve user account
    let account = STAGING_CHARACTER_ACCOUNTS[characterId];

    if (!account && process.env.DATA_STORE === 'supabase') {
      try {
        const client = getSupabaseAdminClient();
        if (client) {
          const { data: profile } = await client
            .from('character_profiles')
            .select('id, user_id')
            .or(`id.eq.${characterId},external_character_id.eq.${characterId}`)
            .maybeSingle();

          if (profile?.user_id) {
            const { data: user } = await client
              .from('users')
              .select('id, role')
              .eq('id', profile.user_id)
              .maybeSingle();

            if (user) {
              account = { userId: user.id, role: user.role as any };
            }
          }
        }
      } catch {
        // Fallback to memory
      }
    }

    if (!account) {
      // Check in memory store
      const profile = db.profiles.find((p) => p.id === characterId || p.external_character_id === characterId);
      if (profile) {
        const user = db.users.find((u) => u.id === profile.user_id);
        if (user) {
          account = { userId: user.id, role: user.role as any };
        }
      }
    }

    // Default fallback if not found in table
    const userId = account?.userId || (characterId.startsWith('usr-') ? characterId : `usr-${characterId}`);
    const role: 'USER' | 'ADMIN' = account?.role || 'USER';

    const token = createSessionToken({
      userId,
      role,
      profileId: characterId,
    });

    const cookieHeader = createSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      user: { id: userId, role },
      profileId: characterId,
    });

    response.headers.set('Set-Cookie', cookieHeader);
    response.cookies.set('sanboard_profile_id', characterId, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('sanboard_user_id', userId, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('sanboard_role', role, { path: '/', maxAge: 86400, sameSite: 'lax' });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Oturum oluşturulamadı.' },
      { status: 500 }
    );
  }
}

// DELETE logout / clear session
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}
