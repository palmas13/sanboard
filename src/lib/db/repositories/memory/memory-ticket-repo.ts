import { ITicketRepository } from '../types';
import {
  getUserTickets,
  getTicketById,
  createTicket,
  addTicketMessage,
  updateTicketStatus,
  getAllTicketsForAdmin,
} from '../../tickets';
import { TicketCategory, TicketStatus } from '@/types';

export class MemoryTicketRepository implements ITicketRepository {
  async getUserTickets(profileId: string) {
    return getUserTickets(profileId);
  }

  async getTicketById(id: string) {
    return getTicketById(id);
  }

  async createTicket(params: { profileId: string; creatorName: string; category: TicketCategory; subject: string; message: string }) {
    return createTicket(params);
  }

  async addTicketMessage(params: {
    ticketId: string;
    senderRole: 'USER' | 'ADMIN';
    senderName: string;
    message: string;
  }) {
    return addTicketMessage(params);
  }

  async updateTicketStatus(id: string, status: TicketStatus) {
    return updateTicketStatus(id, status);
  }

  async getAllTickets() {
    return getAllTicketsForAdmin();
  }
}
