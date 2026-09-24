import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId gereklidir.' },
        { status: 400 }
      );
    }

    const repo = getPaymentRepository();
    const result = await repo.getUserCredits(profileId);
    return NextResponse.json({
      availableCredits: result.available,
      credits: result.credits,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Krediler getirilemedi.' },
      { status: 500 }
    );
  }
}
