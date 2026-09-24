import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';

export async function PUT(req: NextRequest) {
  try {
    const { profileId, avatar_url, sanmail_email, phone } = await req.json();

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getUserRepository();
    const result = await repo.updateProfile(profileId, {
      avatar_url,
      sanmail_email,
      phone,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { error: result.error || 'Profil bulunamadı veya güncellenemedi.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, profile: result.profile });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Profil güncellenemedi.' },
      { status: 500 }
    );
  }
}
