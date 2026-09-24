import { NextRequest, NextResponse } from 'next/server';
import { getTicketRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json({ error: 'profileId gereklidir.' }, { status: 400 });
    }

    const repo = getTicketRepository();
    const tickets = await repo.getUserTickets(profileId);
    return NextResponse.json(tickets);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Talepler getirilemedi.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profileId, creatorName, subject, message } = await req.json();

    if (!profileId || !creatorName || !subject || !message) {
      return NextResponse.json(
        { error: 'Tüm alanların doldurulması zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getTicketRepository();
    const result = await repo.createTicket({
      profileId,
      creatorName,
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
