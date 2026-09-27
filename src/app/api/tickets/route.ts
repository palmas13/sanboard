import { NextRequest, NextResponse } from 'next/server';
import { getTicketRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getUserRepository } from '@/lib/db/repositories';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));

    const repo = getTicketRepository();
    const tickets = await timing.measure('tickets', () => repo.getUserTickets(actor.profileId));
    return timing.respond(NextResponse.json(tickets));
  } catch (error: any) {
    return timing.respond(NextResponse.json({ error: error?.message || 'Talepler getirilemedi.' }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { subject, message } = await req.json();
    const profile = await getUserRepository().getProfileById(actor.profileId);

    if (!profile || !subject || !message) {
      return NextResponse.json(
        { error: 'Tüm alanların doldurulması zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getTicketRepository();
    const result = await repo.createTicket({
      profileId: actor.profileId,
      creatorName: profile.full_name,
      subject,
      message,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Talep oluşturulamadı.' }, { status: 500 });
  }
}
