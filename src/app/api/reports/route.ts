import { NextRequest, NextResponse } from 'next/server';
import { reportListing } from '@/lib/db/listings';

export async function POST(req: NextRequest) {
  try {
    const { reporterProfileId, listingId, reason, description } = await req.json();

    if (!reporterProfileId || !listingId || !reason) {
      return NextResponse.json(
        { error: 'Gerekli alanlar eksik.' },
        { status: 400 }
      );
    }

    const result = await reportListing(
      reporterProfileId,
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
