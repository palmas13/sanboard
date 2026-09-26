import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const repo = getUserRepository();
    const profile = /^\d+$/.test(id) && repo.getProfileByPublicId
      ? await repo.getProfileByPublicId(Number(id))
      : await repo.getProfileById(id);

    if (!profile) return NextResponse.json({ error: 'Profil bulunamadı.' }, { status: 404 });

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.public_id ?? profile.id,
        displayName: profile.full_name,
        avatarUrl: resolveMediaUrl(profile.avatar_path || profile.avatar_url || ''),
        isDealer: Boolean(profile.is_dealer),
        dealerId: profile.dealer_id || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Profil yüklenemedi.' }, { status: 500 });
  }
}