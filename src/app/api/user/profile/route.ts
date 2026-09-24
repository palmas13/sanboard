import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';
import { getServerSession, createSessionToken, setSessionCookieOnResponse } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    let profileId = req.nextUrl.searchParams.get('profileId');

    // Fallback to authenticated server session or cookie if not passed as query param
    if (!profileId) {
      const session = await getServerSession(req);
      profileId = session?.profileId || req.cookies.get('sanboard_profile_id')?.value || null;
    }

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId parametresi veya aktif oturum zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getUserRepository();
    const profile = await repo.getProfileById(profileId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Karakter profili bulunamadı.' },
        { status: 404 }
      );
    }

    const avatarPath = profile.avatar_path || profile.avatar_url || '';
    const resolvedAvatarUrl = resolveMediaUrl(avatarPath);

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        avatar_path: avatarPath,
        avatar_url: resolvedAvatarUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Profil yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
    const userId = session?.userId || (isMock ? '22222222-2222-2222-2222-222222222222' : null);
    const userRole = session?.role || (isMock ? 'ADMIN' : 'USER');

    if (!userId) {
      return NextResponse.json(
        { error: 'Profil oluşturmak için oturum açmalısınız.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { characterId, fullName, avatarData, sanmailEmail, phone } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json(
        { error: 'Karakter adı zorunludur.' },
        { status: 400 }
      );
    }

    // Avatar validation: Reject SVG
    if (avatarData && typeof avatarData === 'string') {
      if (avatarData.includes('image/svg+xml') || avatarData.startsWith('<svg')) {
        return NextResponse.json(
          { error: 'SVG formatı desteklenmemektedir. Lütfen JPG, PNG veya WEBP yükleyin.' },
          { status: 400 }
        );
      }
    }

    const repo = getUserRepository();
    const result = await repo.createProfile({
      userId,
      fullName: fullName.trim(),
      externalCharacterId: characterId || undefined,
      avatarData: avatarData || undefined,
      sanmailEmail: sanmailEmail?.trim() || undefined,
      phone: phone?.trim() || undefined,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Profil oluşturulamadı.' },
        { status: 400 }
      );
    }

    const created = result.profile;
    const avatarPath = created.avatar_path || created.avatar_url || '';
    const resolvedAvatarUrl = resolveMediaUrl(avatarPath);

    // Issue updated signed session containing the newly created profileId
    const newToken = createSessionToken({
      userId,
      role: userRole,
      profileId: created.id,
    });

    const response = NextResponse.json({
      success: true,
      profile: {
        ...created,
        avatar_path: avatarPath,
        avatar_url: resolvedAvatarUrl,
      },
    });

    setSessionCookieOnResponse(response, newToken);

    // Set routing cookies
    response.cookies.set('sanboard_profile_id', created.id, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
    response.cookies.set('sanboard_user_id', userId, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
    response.cookies.set('sanboard_role', userRole, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    await recordAuditEvent({
      eventType: 'PROFILE_CREATED',
      userId,
      profileId: created.id,
      metadata: {
        characterName: created.full_name,
        externalCharacterId: characterId,
      },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Profil oluşturulurken bir hata oluştu.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const isMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
    const userId = session?.userId || (isMock ? '22222222-2222-2222-2222-222222222222' : null);

    if (!userId) {
      return NextResponse.json(
        { error: 'Profil güncellemek için oturum açmalısınız.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    // Derive target profile from server session; allow fallback to cookie/body only for ADMIN
    const sessionProfileId = session?.profileId || req.cookies.get('sanboard_profile_id')?.value;
    const targetProfileId = body.profileId || sessionProfileId;

    if (!targetProfileId) {
      return NextResponse.json(
        { error: 'Güncellenecek profil belirlenemedi.' },
        { status: 400 }
      );
    }

    // Avatar validation: Reject SVG
    const incomingAvatar = body.avatar_path || body.avatar_url;
    if (incomingAvatar && typeof incomingAvatar === 'string') {
      if (incomingAvatar.includes('image/svg+xml') || incomingAvatar.startsWith('<svg')) {
        return NextResponse.json(
          { error: 'SVG formatı desteklenmemektedir. Lütfen JPG, PNG veya WEBP yükleyin.' },
          { status: 400 }
        );
      }
    }

    const repo = getUserRepository();
    // Verify ownership
    const existing = await repo.getProfileById(targetProfileId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Profil bulunamadı.' },
        { status: 404 }
      );
    }

    const isAdmin = session?.role === 'ADMIN' || (isMock && userId === '22222222-2222-2222-2222-222222222222');
    if (!isAdmin && existing.user_id !== userId && existing.id !== sessionProfileId) {
      return NextResponse.json(
        { error: 'Bu profili düzenleme yetkiniz yok.' },
        { status: 403 }
      );
    }

    const result = await repo.updateProfile(targetProfileId, {
      avatar_url: body.avatar_url,
      avatar_path: body.avatar_path,
      sanmail_email: body.sanmail_email,
      phone: body.phone,
      full_name: body.full_name,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Profil güncellenemedi.' },
        { status: 400 }
      );
    }

    const updated = result.profile;
    const avatarPath = updated.avatar_path || updated.avatar_url || '';
    const resolvedAvatarUrl = resolveMediaUrl(avatarPath);

    return NextResponse.json({
      success: true,
      profile: {
        ...updated,
        avatar_path: avatarPath,
        avatar_url: resolvedAvatarUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Profil güncellenemedi.' },
      { status: 500 }
    );
  }
}
