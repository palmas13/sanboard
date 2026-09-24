import { isSupabaseConfigured } from '../supabase-client';
import {
  IListingRepository,
  INotificationRepository,
  IUserRepository,
  ITicketRepository,
  IDealerRepository,
  IPaymentRepository,
  IAuditRepository,
} from './types';
import { MemoryListingRepository } from './memory/memory-listing-repo';
import { MemoryNotificationRepository } from './memory/memory-notification-repo';
import { MemoryUserRepository } from './memory/memory-user-repo';
import { MemoryTicketRepository } from './memory/memory-ticket-repo';
import { MemoryDealerRepository } from './memory/memory-dealer-repo';
import { MemoryPaymentRepository } from './memory/memory-payment-repo';
import { MemoryAuditRepository } from './memory/memory-audit-repo';
import { SupabaseListingRepository } from './supabase/supabase-listing-repo';
import { SupabaseNotificationRepository } from './supabase/supabase-notification-repo';
import { SupabaseUserRepository } from './supabase/supabase-user-repo';
import { SupabaseTicketRepository } from './supabase/supabase-ticket-repo';
import { SupabaseDealerRepository } from './supabase/supabase-dealer-repo';
import { SupabasePaymentRepository } from './supabase/supabase-payment-repo';
import { SupabaseAuditRepository } from './supabase/supabase-audit-repo';

export * from './types';

function shouldUseSupabase(): boolean {
  const dataStore = process.env.DATA_STORE;
  if (dataStore === 'supabase') {
    if (!isSupabaseConfigured()) {
      throw new Error(
        "DATA_STORE is set to 'supabase', but Supabase credentials are missing (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Silent fallback to memory is disabled."
      );
    }
    return true;
  }
  if (dataStore === 'memory') return false;
  return isSupabaseConfigured();
}

let listingRepoInstance: IListingRepository | null = null;
let notificationRepoInstance: INotificationRepository | null = null;
let userRepoInstance: IUserRepository | null = null;
let ticketRepoInstance: ITicketRepository | null = null;
let dealerRepoInstance: IDealerRepository | null = null;
let paymentRepoInstance: IPaymentRepository | null = null;

export function getListingRepository(): IListingRepository {
  if (!listingRepoInstance) {
    listingRepoInstance = shouldUseSupabase()
      ? new SupabaseListingRepository()
      : new MemoryListingRepository();
  }
  return listingRepoInstance;
}

export function getNotificationRepository(): INotificationRepository {
  if (!notificationRepoInstance) {
    notificationRepoInstance = shouldUseSupabase()
      ? new SupabaseNotificationRepository()
      : new MemoryNotificationRepository();
  }
  return notificationRepoInstance;
}

export function getUserRepository(): IUserRepository {
  if (!userRepoInstance) {
    userRepoInstance = shouldUseSupabase()
      ? new SupabaseUserRepository()
      : new MemoryUserRepository();
  }
  return userRepoInstance;
}

export function getTicketRepository(): ITicketRepository {
  if (!ticketRepoInstance) {
    ticketRepoInstance = shouldUseSupabase()
      ? new SupabaseTicketRepository()
      : new MemoryTicketRepository();
  }
  return ticketRepoInstance;
}

export function getDealerRepository(): IDealerRepository {
  if (!dealerRepoInstance) {
    dealerRepoInstance = shouldUseSupabase()
      ? new SupabaseDealerRepository()
      : new MemoryDealerRepository();
  }
  return dealerRepoInstance;
}

export function getPaymentRepository(): IPaymentRepository {
  if (!paymentRepoInstance) {
    paymentRepoInstance = shouldUseSupabase()
      ? new SupabasePaymentRepository()
      : new MemoryPaymentRepository();
  }
  return paymentRepoInstance;
}

let auditRepoInstance: IAuditRepository | null = null;

export function getAuditRepository(): IAuditRepository {
  if (!auditRepoInstance) {
    auditRepoInstance = shouldUseSupabase()
      ? new SupabaseAuditRepository()
      : new MemoryAuditRepository();
  }
  return auditRepoInstance;
}

