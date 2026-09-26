import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let profileId = searchParams.get('profileId');
    if (!profileId) {
      profileId = req.cookies.get('sanboard_profile_id')?.value || null;
    }

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId gereklidir.' },
        { status: 400 }
      );
    }

    const repo = getPaymentRepository();
    const result = await repo.getUserCredits(profileId);
    const availableList = (result.credits || []).filter((c: any) => c.status === 'AVAILABLE');
    const individualCredits = availableList.filter((c: any) => c.credit_type === 'INDIVIDUAL').length;
    const corporateCredits = availableList.filter((c: any) => c.credit_type === 'CORPORATE').length;

    return NextResponse.json({
      availableCredits: result.available,
      individualCredits,
      corporateCredits,
      credits: result.credits,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Krediler getirilemedi.' },
      { status: 500 }
    );
  }
}
