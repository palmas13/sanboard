import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { isCanonicalTestLoginActor } from '@/lib/auth/test-login';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }

    const repo = getPaymentRepository();
    const [result, testPublishBypass] = await Promise.all([
      repo.getUserCredits(actor.profileId),
      isCanonicalTestLoginActor({ userId: actor.userId, profile: actor.profile }),
    ]);
    const availableList = (result.credits || []).filter((c: any) => c.status === 'AVAILABLE');
    const individualCredits = availableList.filter((c: any) => c.credit_type === 'INDIVIDUAL').length;
    const corporateCredits = availableList.filter((c: any) => c.credit_type === 'CORPORATE').length;

    return NextResponse.json({
      availableCredits: result.available,
      individualCredits,
      corporateCredits,
      credits: result.credits,
      testPublishBypass,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Krediler getirilemedi.' },
      { status: 500 }
    );
  }
}
