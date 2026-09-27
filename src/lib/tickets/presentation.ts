import type { SupportTicket, TicketMessage } from '@/types';

export function normalizeTicketMessage(message: TicketMessage): TicketMessage {
  const isAdmin = message.sender_role === 'ADMIN';
  return {
    ...message,
    author_type: isAdmin ? 'ADMIN' : 'USER',
    display_author: isAdmin ? 'Sanboard Yönetim' : message.sender_name,
  };
}

export function normalizeTicketConversation<T extends SupportTicket & { messages?: TicketMessage[] }>(
  ticket: T
): T & { messages: TicketMessage[] } {
  return {
    ...ticket,
    messages: [...(ticket.messages || [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(normalizeTicketMessage),
  };
}