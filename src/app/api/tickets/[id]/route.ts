import { NextRequest, NextResponse } from 'next/server';
import { getTicketRepository } from '@/lib/db/repositories';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const repo = getTicketRepository();
    const ticket = await repo.getTicketById(id);

    if (!ticket) {
      return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 });
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
    const body = await req.json();
    const senderRole = body.senderRole || body.sender_role || (req.cookies.get('sanboard_role')?.value === 'ADMIN' ? 'ADMIN' : 'USER');
    const senderName = body.senderName || body.sender_name || 'Kullanıcı';
    const message = body.message;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Mesaj boş olamaz.' }, { status: 400 });
    }

    const repo = getTicketRepository();
    const result = await repo.addTicketMessage({
      ticketId: id,
      senderRole: senderRole as 'USER' | 'ADMIN',
      senderName,
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
    const { status } = await req.json();

    const repo = getTicketRepository();
    const success = await repo.updateTicketStatus(id, status);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Durum güncellenemedi.' }, { status: 500 });
  }
}
