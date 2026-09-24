import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || session?.profileId;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId gereklidir veya oturum açılmalıdır.' }, { status: 400 });
    }

    const repo = getDealerRepository();
    const dealer = await repo.getDealerByProfileId(profileId);
    return NextResponse.json({ dealer });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.profileId) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Oturum açmanız gerekmektedir.' }, { status: 401 });
    }

    const repo = getDealerRepository();
    // Resolve owner's approved store strictly from verified session
    const existingDealer = await repo.getDealerByProfileId(session.profileId);
    if (!existingDealer) {
      return NextResponse.json({ error: 'Bu karaktere ait onaylı bir kurumsal mağaza bulunamadı.' }, { status: 404 });
    }

    const body = await req.json();
    // Ignore any client-sent identity IDs
    const { dealerId: _d, profileId: _p, ownerId: _o, ...updateData } = body;

    const result = await repo.updateDealerProfile(existingDealer.id, updateData);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
