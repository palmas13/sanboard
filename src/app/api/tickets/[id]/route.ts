import { NextRequest, NextResponse } from 'next/server';
import { getTicketRepository } from '@/lib/db/repositories';
import { getUserRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { id } = await params;
    const repo = getTicketRepository();
    const ticket = await repo.getTicketById(id);

    if (!ticket) {
      return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 });
    }
    if (ticket.profile_id !== actor.profileId) {
      return NextResponse.json({ error: 'Bu destek talebine erişim yetkiniz yok.' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Hata oluştu.' }, { status: 500 });
  }
}

// Add reply message
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const body = await req.json();
    const message = body.message;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Mesaj boş olamaz.' }, { status: 400 });
    }

    const repo = getTicketRepository();
    const [ticket, profile] = await Promise.all([
      repo.getTicketById(id),
      getUserRepository().getProfileById(actor.profileId),
    ]);
    if (!ticket) return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 });
    if (ticket.profile_id !== actor.profileId) {
      return NextResponse.json({ error: 'Bu destek talebine yanıt verme yetkiniz yok.' }, { status: 403 });
    }
    if (!profile) return NextResponse.json({ error: 'Aktif karakter bulunamadı.' }, { status: 403 });
    const result = await repo.addTicketMessage({
      ticketId: id,
      senderRole: 'USER',
      senderName: profile.full_name,
      message: message.trim(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Mesaj gönderilemedi.' }, { status: 500 });
  }
}

// Update status
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { status } = await req.json();

    const repo = getTicketRepository();
    const ticket = await repo.getTicketById(id);
    if (!ticket) return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 });
    if (ticket.profile_id !== actor.profileId) {
      return NextResponse.json({ error: 'Bu destek talebini güncelleme yetkiniz yok.' }, { status: 403 });
    }
    if (status !== 'CLOSED') return NextResponse.json({ error: 'Geçersiz durum.' }, { status: 400 });
    const success = await repo.updateTicketStatus(id, status);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Durum güncellenemedi.' }, { status: 500 });
  }
}
