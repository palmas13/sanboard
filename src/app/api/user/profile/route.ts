import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';
import { getServerSession, createSessionToken, setSessionCookieOnResponse } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

function toPrivateProfileDto(profile: Awaited<ReturnType<ReturnType<typeof getUserRepository>['getProfileById']>>) {
  if (!profile) return null;
  const avatarPath = profile.avatar_path || profile.avatar_url || '';
  return {
    id: profile.id,
    full_name: profile.full_name,
    avatar_path: avatarPath,
    avatar_url: resolveMediaUrl(avatarPath),
    sanmail_email: profile.sanmail_email,
    phone: profile.phone,
    role: profile.role || 'USER',
    is_dealer: profile.is_dealer,
    dealer_id: profile.dealer_id,
    public_id: profile.public_id,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getUserRepository();
    const profile = await repo.getProfileById(actor.profileId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Karakter profili bulunamadı.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: toPrivateProfileDto(profile),
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
    const userId = session?.userId || null;
    const userRole = session?.role || 'USER';

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
      role: created.role || 'USER',
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
    response.cookies.set('sanboard_role', created.role || 'USER', {
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
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const body = await req.json().catch(() => ({}));

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
    const existing = await repo.getProfileById(actor.profileId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Profil bulunamadı.' },
        { status: 404 }
      );
    }

    const editableFields = {
      ...(body.avatar_url !== undefined ? { avatar_url: body.avatar_url } : {}),
      ...(body.avatar_path !== undefined ? { avatar_path: body.avatar_path } : {}),
      ...(body.sanmail_email !== undefined ? { sanmail_email: body.sanmail_email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.full_name !== undefined ? { full_name: body.full_name } : {}),
    };
    const result = await repo.updateProfile(actor.profileId, editableFields);

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Profil güncellenemedi.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: toPrivateProfileDto(result.profile),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Profil güncellenemedi.' },
      { status: 500 }
    );
  }
}
