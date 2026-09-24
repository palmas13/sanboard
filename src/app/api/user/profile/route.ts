import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';
import { getServerSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    let profileId = req.nextUrl.searchParams.get('profileId');

    // Fallback to authenticated server session or cookie if not passed as query param
    if (!profileId) {
      const session = await getServerSession();
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    let profileId = body.profileId;

    if (!profileId) {
      const session = await getServerSession();
      profileId = session?.profileId || req.cookies.get('sanboard_profile_id')?.value || null;
    }

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getUserRepository();
    const result = await repo.updateProfile(profileId, {
      avatar_url: body.avatar_url,
      avatar_path: body.avatar_path,
      sanmail_email: body.sanmail_email,
      phone: body.phone,
      full_name: body.full_name,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Profil bulunamadı veya güncellenemedi.' },
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
