import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';
import { recordAuditEvent } from '@/lib/audit';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { clearCharacterSelectionCookieOnResponse, createSessionToken, getCharacterSelectionContext, setLegacyRoutingCookiesOnResponse, setSessionCookieOnResponse } from '@/lib/auth/session';
import { isTestExternalAccountId, isTestLoginEnabled } from '@/lib/auth/test-login';
import { ServerTiming } from '@/lib/performance/server-timing';
import { normalizeContactVisibility } from '@/lib/profiles/contact-privacy';

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
    phone_visibility: profile.phone_visibility || 'PUBLIC',
    sanmail_visibility: profile.sanmail_visibility || 'PUBLIC',
    role: profile.role || 'USER',
    is_dealer: profile.is_dealer,
    dealer_id: profile.dealer_id,
    public_id: profile.public_id,
  };
}

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));

    const repo = getUserRepository();
    const profile = await timing.measure('profile', () => repo.getProfileById(actor.profileId));

    if (!profile) {
      return timing.respond(NextResponse.json(
        { error: 'Karakter profili bulunamadı.' },
        { status: 404 }
      ));
    }

    return timing.respond(NextResponse.json({
      success: true,
      profile: toPrivateProfileDto(profile),
    }));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Profil yüklenemedi.' },
      { status: 500 }
    ));
  }
}

export async function POST(req: NextRequest) {
  try {
    const selection = getCharacterSelectionContext(req);
    const body = await req.json().catch(() => ({}));
    const { avatarData, sanmailEmail, phone } = body;
    if (!selection) {
      const actor = await resolveOwnedActiveProfile(req);
      if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
      if (avatarData && typeof avatarData === 'string' && (avatarData.includes('image/svg+xml') || avatarData.startsWith('<svg'))) {
        return NextResponse.json({ error: 'SVG formatı desteklenmemektedir. Lütfen JPG, PNG veya WEBP yükleyin.' }, { status: 400 });
      }
      const update = await getUserRepository().updateProfile(actor.profileId, {
        ...(avatarData ? { avatar_url: avatarData, avatar_path: avatarData } : {}),
        ...(sanmailEmail !== undefined ? { sanmail_email: String(sanmailEmail).trim() } : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
      });
      if (!update.success || !update.profile) return NextResponse.json({ error: update.error || 'Profil güncellenemedi.' }, { status: 400 });
      return NextResponse.json({ success: true, profile: toPrivateProfileDto(update.profile) });
    }
    const characterId = String(body.characterId || '').trim();
    const verifiedCharacter = selection.characters?.find((character) => character.externalCharacterId === characterId);
    if (!verifiedCharacter) return NextResponse.json({ error: 'Seçilen karakter doğrulanamadı.', code: 'character_invalid' }, { status: 403 });

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
    const user = await repo.getUserById(selection.userId);
    if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Hesap doğrulanamadı.', code: 'character_invalid' }, { status: 401 });
    if (isTestExternalAccountId(user.external_user_id) && !isTestLoginEnabled()) return NextResponse.json({ error: 'Test login devre dışı.' }, { status: 404 });
    const result = await repo.createProfile({
      userId: user.id,
      externalCharacterId: verifiedCharacter.externalCharacterId,
      fullName: `${verifiedCharacter.firstName} ${verifiedCharacter.lastName}`,
      avatarData: typeof avatarData === 'string' && avatarData ? avatarData : undefined,
      sanmailEmail: typeof sanmailEmail === 'string' && sanmailEmail.trim() ? sanmailEmail.trim() : undefined,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Karakter profiliniz oluşturulurken bir sorun oluştu.', code: 'profile_create_failed' },
        { status: 400 }
      );
    }

    const created = result.profile;
    const avatarPath = created.avatar_path || created.avatar_url || '';
    const resolvedAvatarUrl = resolveMediaUrl(avatarPath);

    const response = NextResponse.json({
      success: true,
      profile: toPrivateProfileDto({ ...created, avatar_path: avatarPath, avatar_url: resolvedAvatarUrl }),
      user: { ...user, role: created.role || 'USER' },
    });
    setSessionCookieOnResponse(response, createSessionToken({ userId: user.id, profileId: created.id, role: created.role || 'USER' }));
    clearCharacterSelectionCookieOnResponse(response);
    setLegacyRoutingCookiesOnResponse(response, { userId: user.id, profileId: created.id, role: created.role || 'USER' });

    await recordAuditEvent({
      eventType: 'PROFILE_CREATED',
      userId: user.id,
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
    const phoneVisibility = body.phone_visibility === undefined ? undefined : normalizeContactVisibility(body.phone_visibility);
    const sanmailVisibility = body.sanmail_visibility === undefined ? undefined : normalizeContactVisibility(body.sanmail_visibility);
    if (phoneVisibility === null || sanmailVisibility === null) {
      return NextResponse.json({ error: 'Geçersiz iletişim görünürlüğü.' }, { status: 400 });
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
      ...(phoneVisibility ? { phone_visibility: phoneVisibility } : {}),
      ...(sanmailVisibility ? { sanmail_visibility: sanmailVisibility } : {}),
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
