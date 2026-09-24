import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';
import { resolveMediaUrl } from '@/lib/media/url';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealerId } = await params;
    const dealerRepo = getDealerRepository();

    if (typeof dealerRepo.getFollowers !== 'function') {
      return NextResponse.json({ followers: [], count: 0 });
    }

    const followers = await dealerRepo.getFollowers(dealerId);

    const safeFollowers = followers.map((f) => ({
      id: f.id,
      name: f.full_name,
      full_name: f.full_name,
      avatar_path: f.avatar_path || f.avatar_url || '',
      avatar_url: resolveMediaUrl(f.avatar_path || f.avatar_url),
      public_id: f.public_id,
      created_at: f.created_at,
    }));

    return NextResponse.json({
      success: true,
      followers: safeFollowers,
      count: safeFollowers.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Takipçiler getirilemedi.' }, { status: 500 });
  }
}
