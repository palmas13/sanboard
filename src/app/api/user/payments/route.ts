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
    const payments = await repo.getUserPayments(profileId);
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ödemeler getirilemedi.' },
      { status: 500 }
    );
  }
}
