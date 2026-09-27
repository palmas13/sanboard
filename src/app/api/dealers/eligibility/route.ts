import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) {
      return timing.respond(
        NextResponse.json(
          { eligible: false, reason: 'NO_STORE', error: actor.error },
          { status: actor.status }
        )
      );
    }

    const result = await timing.measure('store', () => resolveCorporateEligibility(actor.profileId));
    return timing.respond(NextResponse.json(result));
  } catch (error: any) {
    return timing.respond(
      NextResponse.json(
        { eligible: false, reason: 'NO_STORE', error: error?.message || 'Uygunluk kontrolü yapılamadı.' },
        { status: 500 }
      )
    );
  }
}
