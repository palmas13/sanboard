import { NextRequest, NextResponse } from 'next/server';
import { getDealerRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getDealerRepository();
    const dealer = await repo.getDealerByProfileId(actor.profileId);
    return NextResponse.json({ dealer });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getDealerRepository();
    // Resolve owner's approved store strictly from verified session
    const existingDealer = await repo.getDealerByProfileId(actor.profileId);
    if (!existingDealer) {
      return NextResponse.json({ error: 'Bu karaktere ait onaylı bir kurumsal mağaza bulunamadı.' }, { status: 404 });
    }

    const body = await req.json();
    // Ignore any client-sent identity IDs
    const { dealerId: _d, profileId: _p, ownerId: _o, slug: _slug, public_id: _publicId, ...updateData } = body;

    const result = await repo.updateDealerProfile(existingDealer.id, updateData);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
