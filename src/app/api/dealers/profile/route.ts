import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json({ error: 'profileId gereklidir.' }, { status: 400 });
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
    const { dealerId, profileId, ...data } = await req.json();

    if (!dealerId || !profileId) {
      return NextResponse.json({ error: 'dealerId ve profileId zorunludur.' }, { status: 400 });
    }

    const repo = getDealerRepository();
    const result = await repo.updateDealerProfile(dealerId, data);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
