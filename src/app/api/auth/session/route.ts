import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, createSessionCookie, clearSessionCookie, getServerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { recordAuditEvent } from '@/lib/audit';

// Known staging/mock character to user account mapping for mock/staging development
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

// POST create/issue signed session on character selection or character switch
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

    const currentSession = await getServerSession(req);

    // 1. Resolve character profile from Supabase or Memory
    let profile: { id: string; user_id: string; full_name?: string } | null = null;

    if (process.env.DATA_STORE === 'supabase') {
      try {
        const client = getSupabaseAdminClient();
        if (client) {
          const { data } = await client
            .from('character_profiles')
            .select('id, user_id, full_name')
            .or(`id.eq.${characterId},external_character_id.eq.${characterId}`)
            .maybeSingle();

          if (data) {
            profile = data;
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!profile) {
      const memoryProfile = db.profiles.find(
        (p) => p.id === characterId || p.external_character_id === characterId
      );
      if (memoryProfile) {
        profile = {
          id: memoryProfile.id,
          user_id: memoryProfile.user_id,
          full_name: memoryProfile.full_name,
        };
      }
    }

    // 2. Strict Character Ownership Verification:
    // If an authenticated session already exists, the selected character MUST belong to this user!
    if (currentSession?.userId && profile) {
      if (profile.user_id !== currentSession.userId) {
        await recordAuditEvent({
          eventType: 'AUTH_LOGIN_FAILURE',
          userId: currentSession.userId,
          profileId: characterId,
          metadata: {
            reason: 'unauthorized_character_selection_attempt',
            requestedProfileId: characterId,
          },
        });

        return NextResponse.json(
          { error: 'Bu karakter profili mevcut hesabınıza ait değildir.' },
          { status: 403 }
        );
      }
    }

    // 3. Resolve user identity and role
    let userId: string;
    let role: 'USER' | 'ADMIN';
    const targetProfileId = profile?.id || characterId;

    if (currentSession?.userId) {
      userId = currentSession.userId;
      role = currentSession.role;
    } else {
      // In mock/staging without an existing session, resolve from staging account mapping
      let account = STAGING_CHARACTER_ACCOUNTS[characterId];
      if (!account && profile) {
        if (process.env.DATA_STORE === 'supabase') {
          try {
            const client = getSupabaseAdminClient();
            if (client) {
              const { data: u } = await client
                .from('users')
                .select('id, role')
                .eq('id', profile.user_id)
                .maybeSingle();
              if (u) account = { userId: u.id, role: u.role as any };
            }
          } catch {
            // ignore
          }
        }
        if (!account) {
          const u = db.users.find((usr) => usr.id === profile?.user_id);
          if (u) account = { userId: u.id, role: u.role as any };
        }
      }

      userId = account?.userId || (characterId.startsWith('usr-') ? characterId : `usr-${characterId}`);
      role = account?.role || 'USER';
    }

    // 4. Create signed HMAC session token
    const token = createSessionToken({
      userId,
      role,
      profileId: targetProfileId,
    });

    // 5. Record Audit Event
    const isSwitch = Boolean(currentSession?.profileId && currentSession.profileId !== targetProfileId);
    await recordAuditEvent({
      eventType: isSwitch ? 'CHARACTER_SWITCHED' : 'CHARACTER_SELECTED',
      userId,
      profileId: targetProfileId,
      metadata: {
        characterName: profile?.full_name,
        previousProfileId: currentSession?.profileId || null,
      },
    });

    const cookieHeader = createSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      user: { id: userId, role },
      profileId: targetProfileId,
    });

    response.headers.set('Set-Cookie', cookieHeader);
    response.cookies.set('sanboard_profile_id', targetProfileId, { path: '/', maxAge: 86400, sameSite: 'lax' });
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
export async function DELETE(req: NextRequest) {
  try {
    const currentSession = await getServerSession(req);
    if (currentSession?.userId) {
      await recordAuditEvent({
        eventType: 'AUTH_LOGOUT',
        userId: currentSession.userId,
        profileId: currentSession.profileId || null,
      });
    }

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookie());
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });

    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
