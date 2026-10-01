import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { canBypassTestPayment } from '@/lib/auth/test-login';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';
import { getPaymentRepository } from '@/lib/db/repositories';
import { buildListingPackageOptions } from '@/lib/listings/package-options';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const [creditResult, eligibility, testPublishBypass] = await Promise.all([
      getPaymentRepository().getUserCredits(actor.profileId),
      resolveCorporateEligibility(actor.profileId),
      canBypassTestPayment({ userId: actor.userId, profile: actor.profile }),
    ]);

    return NextResponse.json(
      buildListingPackageOptions({
        profile: actor.profile,
        eligibility,
        credits: creditResult.credits || [],
        testPublishBypass,
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan hakları yüklenemedi.' },
      { status: 500 }
    );
  }
}