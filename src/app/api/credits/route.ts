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
    const result = await repo.getUserCredits(actor.profileId);
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
