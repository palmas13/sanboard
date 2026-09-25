import { db } from './store';
import { SupportTicket, TicketMessage, TicketStatus } from '@/types';
import { createNotification } from './notifications';

function ensureTickets() {
  if (!db.tickets) {
    db.tickets = [
      {
        id: 'tkt-1001',
        profile_id: 'char-zade-02',
        creator_name: 'Zade Vexnera',
        subject: 'İlan Fotoğrafı Boyut Sınırı Hakkında',
        status: 'ANSWERED',
        created_at: '2026-09-22T14:30:00Z',
        updated_at: '2026-09-22T15:00:00Z',
      },
    ];
  }
  if (!db.ticketMessages) {
    db.ticketMessages = [
      {
        id: 'msg-01',
        ticket_id: 'tkt-1001',
        sender_role: 'USER',
        sender_name: 'Zade Vexnera',
        message: 'Merhaba, ilan oluştururken 2MB üstü fotoğraflar yüklenmiyor mu? Bilgi alabilir miyim?',
        created_at: '2026-09-22T14:30:00Z',
      },
      {
        id: 'msg-02',
        ticket_id: 'tkt-1001',
        sender_role: 'ADMIN',
        sender_name: 'Sanboard Yönetimi',
        message: 'Merhaba Sayın Vexnera. Sanboard üzerinde ilan başına görsel sınırı 2MB ve toplam 3 fotoğraftır. Format olarak JPG veya PNG kullanabilirsiniz.',
        created_at: '2026-09-22T15:00:00Z',
      },
    ];
  }
}

import { getTicketRepository } from './repositories';

export async function getUserTickets(profileId: string): Promise<SupportTicket[]> {
  if (process.env.DATA_STORE === 'supabase') {
    return getTicketRepository().getUserTickets(profileId);
  }
  ensureTickets();
  const tickets = db.tickets.filter((t) => t.profile_id === profileId);
  return [...tickets].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getTicketById(
  ticketId: string
): Promise<(SupportTicket & { messages: TicketMessage[] }) | null> {
  if (process.env.DATA_STORE === 'supabase') {
    return getTicketRepository().getTicketById(ticketId);
  }
  ensureTickets();
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;

  const messages = db.ticketMessages
    .filter((m) => m.ticket_id === ticketId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    ...ticket,
    messages,
  };
}

export async function createTicket(params: {
  profileId: string;
  creatorName: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    return getTicketRepository().createTicket(params);
  }
  ensureTickets();
  if (!params.subject.trim() || !params.message.trim()) {
    return { success: false, error: 'Başlık ve mesaj alanları zorunludur.' };
  }

  const now = new Date().toISOString();
  const ticketId = `tkt-${Date.now()}`;

  const newTicket: SupportTicket = {
    id: ticketId,
    profile_id: params.profileId,
    creator_name: params.creatorName,
    subject: params.subject.trim(),
    status: 'OPEN',
    created_at: now,
    updated_at: now,
  };

  const initialMsg: TicketMessage = {
    id: `msg-${Date.now()}`,
    ticket_id: ticketId,
    sender_role: 'USER',
    sender_name: params.creatorName,
    message: params.message.trim(),
    created_at: now,
  };

  db.tickets.unshift(newTicket);
  db.ticketMessages.push(initialMsg);

  return { success: true, ticket: newTicket };
}

export async function addTicketMessage(params: {
  ticketId: string;
  senderRole: 'USER' | 'ADMIN';
  senderName: string;
  message: string;
}): Promise<{ success: boolean; message?: TicketMessage; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    return getTicketRepository().addTicketMessage(params);
  }
  ensureTickets();
  const ticket = db.tickets.find((t) => t.id === params.ticketId);
  if (!ticket) return { success: false, error: 'Talep bulunamadı.' };

  const now = new Date().toISOString();
  const msg: TicketMessage = {
    id: `msg-${Date.now()}`,
    ticket_id: params.ticketId,
    sender_role: params.senderRole,
    sender_name: params.senderName,
    message: params.message.trim(),
    created_at: now,
  };

  db.ticketMessages.push(msg);
  // Update ticket status
  ticket.updated_at = now;
  if (params.senderRole === 'ADMIN') {
    ticket.status = 'ANSWERED';
    const creatorProfile = db.profiles.find((p) => p.id === ticket.profile_id);
    createNotification({
      recipient_profile_id: ticket.profile_id,
      user_id: creatorProfile?.user_id,
      type: 'SUPPORT_REPLY',
      title: 'Destek Talebiniz Yanıtlandı',
      message: 'Destek talebinize yetkili tarafından yanıt verildi.',
      entity_type: 'ticket',
      entity_id: ticket.id,
      metadata: { ticketId: ticket.id, subject: ticket.subject },
    });
  } else if (ticket.status === 'ANSWERED') {
    ticket.status = 'OPEN';
  }

  return { success: true, message: msg };
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<boolean> {
  if (process.env.DATA_STORE === 'supabase') {
    return getTicketRepository().updateTicketStatus(ticketId, status);
  }
  ensureTickets();
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket) return false;

  ticket.status = status;
  ticket.updated_at = new Date().toISOString();
  return true;
}

export async function getAllTicketsForAdmin(): Promise<SupportTicket[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getTicketRepository();
    if (typeof (repo as any).getAllTickets === 'function') {
      return (repo as any).getAllTickets();
    }
  }
  ensureTickets();
  return [...db.tickets].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
