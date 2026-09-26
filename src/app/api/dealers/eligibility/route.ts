import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ eligible: false, reason: 'NO_STORE', error: actor.error }, { status: actor.status });

    const result = await resolveCorporateEligibility(actor.profileId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { eligible: false, reason: 'NO_STORE', error: error?.message || 'Uygunluk kontrolü yapılamadı.' },
      { status: 500 }
    );
  }
}
