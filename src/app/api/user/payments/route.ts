import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) {
      return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));
    }

    const repo = getPaymentRepository();
    const payments = await timing.measure('payments', () => repo.getUserPayments(actor.profileId));
    return timing.respond(NextResponse.json(payments));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Ödemeler getirilemedi.' },
      { status: 500 }
    ));
  }
}
