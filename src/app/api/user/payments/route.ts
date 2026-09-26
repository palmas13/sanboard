import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }

    const repo = getPaymentRepository();
    const payments = await repo.getUserPayments(actor.profileId);
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ödemeler getirilemedi.' },
      { status: 500 }
    );
  }
}
