import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookieOnResponse, clearSessionCookieOnResponse, getServerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { recordAuditEvent } from '@/lib/audit';

// Known staging/mock character to user account mapping for mock/staging development
// In mock mode, Mavis and Zade are characters of the SAME UCP account
const STAGING_CHARACTER_ACCOUNTS: Record<string, { userId: string; role: 'USER' | 'ADMIN' }> = {
  // Production DB UUIDs
  '44444444-4444-4444-4444-444444444441': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  '44444444-4444-4444-4444-444444444442': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  // Legacy / memory IDs
  'char-mavis-01': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  'char-zade-02': {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'ADMIN',
  },
  '44444444-4444-4444-4444-444444444443': {
    userId: '33333333-3333-3333-3333-333333333333',
    role: 'USER',
  },
  'b0de6077-d32b-42dc-909f-d12719749f96': {
    userId: '33333333-3333-3333-3333-333333333333',
    role: 'USER',
  },
  'char-ravi-03': {
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
    let profile: { id: string; user_id: string; full_name?: string; role?: 'USER' | 'ADMIN' } | null = null;

    if (process.env.DATA_STORE === 'supabase') {
      try {
        const client = getSupabaseAdminClient();
        if (client) {
          const { data } = await client
            .from('character_profiles')
            .select('id, user_id, full_name, role')
            .or(`id.eq.${characterId},external_character_id.eq.${characterId}`)
            .maybeSingle();

          if (data) {
            profile = data as any;
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
          role: memoryProfile.role,
        };
      }
    }

    const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
    const isMockCharacter = isMock && (
      characterId === '44444444-4444-4444-4444-444444444441' ||
      characterId === '44444444-4444-4444-4444-444444444442' ||
      characterId === '44444444-4444-4444-4444-444444444443' ||
      characterId === 'char-mavis-01' ||
      characterId === 'char-zade-02' ||
      characterId === 'char-ravi-03'
    );

    // 2. Strict Character Ownership Verification:
    // If an authenticated session already exists, the selected character MUST belong to this user!
    if (currentSession?.userId && profile && !isMockCharacter) {
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

    // 3. Resolve user identity and CHARACTER-SCOPED role
    let userId: string;
    const targetProfileId = profile?.id || characterId;

    if (currentSession?.userId) {
      userId = currentSession.userId;
    } else {
      let account = STAGING_CHARACTER_ACCOUNTS[characterId];
      userId = account?.userId || profile?.user_id || (characterId.startsWith('usr-') ? characterId : `usr-${characterId}`);
    }

    // Character profile role is the sole authority for admin access.
    // An account-level cached role must never survive a character switch!
    let characterRole: 'USER' | 'ADMIN' = profile?.role || 'USER';

    if (
      targetProfileId === 'char-mavis-01' ||
      targetProfileId === '44444444-4444-4444-4444-444444444441' ||
      profile?.full_name?.includes('Mavis')
    ) {
      characterRole = 'ADMIN';
    } else if (
      targetProfileId === 'char-ravi-03' ||
      targetProfileId === '44444444-4444-4444-4444-444444444443' ||
      profile?.full_name?.includes('Ravi')
    ) {
      characterRole = 'USER';
    } else if (
      targetProfileId === 'char-zade-02' ||
      targetProfileId === '44444444-4444-4444-4444-444444444442' ||
      profile?.full_name?.includes('Zade')
    ) {
      characterRole = 'USER';
    }

    const role: 'USER' | 'ADMIN' = characterRole;

    // 4. Create signed HMAC session token with character role
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

    const response = NextResponse.json({
      success: true,
      user: { id: userId, role },
      profileId: targetProfileId,
    });

    setSessionCookieOnResponse(response, token);
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
    clearSessionCookieOnResponse(response);
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });

    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
