import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';
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
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const body = await req.json().catch(() => ({}));
    const { avatarData, sanmailEmail, phone } = body;

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
    const existing = await repo.getProfileById(actor.profileId);
    if (!existing) return NextResponse.json({ error: 'Karakter profili bulunamadı.' }, { status: 404 });

    const result = await repo.updateProfile(actor.profileId, {
      ...(avatarData ? { avatar_url: avatarData, avatar_path: avatarData } : {}),
      ...(sanmailEmail !== undefined ? { sanmail_email: String(sanmailEmail).trim() } : {}),
      ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
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

    const response = NextResponse.json({
      success: true,
      profile: toPrivateProfileDto({ ...created, avatar_path: avatarPath, avatar_url: resolvedAvatarUrl }),
    });

    await recordAuditEvent({
      eventType: 'PROFILE_CREATED',
      userId: actor.userId,
      profileId: created.id,
      metadata: {
        characterName: created.full_name,
        source: 'canonical_profile_onboarding',
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
