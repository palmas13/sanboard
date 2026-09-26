import { NextRequest, NextResponse } from 'next/server';
import { reportListing } from '@/lib/db/listings';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { listingId, reason, description } = await req.json();

    if (!listingId || !reason) {
      return NextResponse.json(
        { error: 'Gerekli alanlar eksik.' },
        { status: 400 }
      );
    }

    const result = await reportListing(
      actor.profileId,
      listingId,
      reason,
      description || ''
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Şikayet kaydedilemedi.' },
      { status: 500 }
    );
  }
}
