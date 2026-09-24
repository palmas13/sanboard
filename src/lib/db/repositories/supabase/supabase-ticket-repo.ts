import { ITicketRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { SupportTicket, TicketMessage, TicketStatus } from '@/types';

import { resolveProfileId, isUuid } from '../../id-mapper';

export class SupabaseTicketRepository implements ITicketRepository {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (admin) return admin;
    return this.getClient();
  }

  async getUserTickets(profileId: string): Promise<SupportTicket[]> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];

    const { data, error } = await client
      .from('support_tickets')
      .select('*')
      .eq('profile_id', safeProfileId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching user tickets: ${error.message}`);
    }

    return (data || []) as SupportTicket[];
  }

  async getTicketById(id: string): Promise<(SupportTicket & { messages: TicketMessage[] }) | null> {
    const client = this.getAdminClient();
    if (!id) return null;

    const { data: ticket, error } = await client
      .from('support_tickets')
      .select(`*, ticket_messages (*)`)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase error fetching ticket by id: ${error.message}`);
    }

    if (!ticket) return null;

    return {
      ...ticket,
      messages: (ticket.ticket_messages || []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    };
  }

  async createTicket(params: { profileId: string; creatorName: string; subject: string; message: string }) {
    const client = this.getAdminClient();

    const { data: newTicket, error } = await client
      .from('support_tickets')
      .insert({
        profile_id: params.profileId,
        creator_name: params.creatorName,
        subject: params.subject,
        status: 'OPEN',
      })
      .select()
      .single();

    if (error || !newTicket) {
      return { success: false, error: error?.message || 'Destek talebi oluşturulamadı.' };
    }

    const { error: msgErr } = await client.from('ticket_messages').insert({
      ticket_id: newTicket.id,
      sender_role: 'USER',
      sender_name: params.creatorName,
      message: params.message,
    });

    if (msgErr) {
      return { success: false, error: msgErr.message };
    }

    return { success: true, ticket: newTicket };
  }

  async addTicketMessage(params: {
    ticketId: string;
    senderRole: 'USER' | 'ADMIN';
    senderName: string;
    message: string;
  }) {
    const client = this.getAdminClient();

    const { data: newMsg, error } = await client
      .from('ticket_messages')
      .insert({
        ticket_id: params.ticketId,
        sender_role: params.senderRole,
        sender_name: params.senderName,
        message: params.message,
      })
      .select()
      .single();

    if (error || !newMsg) {
      return { success: false, error: error?.message || 'Mesaj gönderilemedi.' };
    }

    // Update ticket status
    const nextStatus = params.senderRole === 'ADMIN' ? 'ANSWERED' : 'OPEN';
    await client
      .from('support_tickets')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', params.ticketId);

    // If admin replied, send notification to ticket owner
    if (params.senderRole === 'ADMIN') {
      try {
        const { data: ticket } = await client
          .from('support_tickets')
          .select('profile_id, subject')
          .eq('id', params.ticketId)
          .maybeSingle();

        if (ticket?.profile_id) {
          const { data: prof } = await client
            .from('character_profiles')
            .select('user_id')
            .or(`id.eq.${ticket.profile_id},external_character_id.eq.${ticket.profile_id}`)
            .maybeSingle();

          if (prof?.user_id) {
            await client.from('notifications').insert({
              user_id: prof.user_id,
              type: 'SUPPORT_REPLY',
              title: 'Destek Talebiniz Yanıtlandı',
              message: 'Destek talebinize yetkili tarafından yanıt verildi.',
              entity_type: 'ticket',
              entity_id: params.ticketId,
              metadata: { ticketId: params.ticketId, subject: ticket.subject },
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Notification creation should not corrupt ticket message insertion
      }
    }

    return { success: true, message: newMsg };
  }

  async updateTicketStatus(id: string, status: TicketStatus): Promise<boolean> {
    const client = this.getAdminClient();

    const { error } = await client
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    return !error;
  }

  async getAllTickets(): Promise<SupportTicket[]> {
    const client = this.getAdminClient();
    const { data, error } = await client
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching all tickets: ${error.message}`);
    }

    return (data || []) as SupportTicket[];
  }
}
