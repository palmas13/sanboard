import {
  Listing,
  MemberListingDetail,
  PublicListingSummary,
  Notification,
  NotificationType,
  CharacterProfile,
  CorporateProfile,
  CorporateApplication,
  SupportTicket,
  TicketMessage,
  TicketStatus,
  User,
} from '@/types';
import { ListingFilterParams } from '../listings';

export interface CreateListingInput {
  category: 'vehicle' | 'property';
  subcategory: string;
  title: string;
  description: string;
  price: number;
  location?: string;
  images: Array<{
    storage_path: string;
    is_cover?: boolean;
    sort_order?: number;
    size_bytes?: number;
  }>;
  // Vehicle details
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuel_type?: string;
  transmission?: string;
  color?: string;
  engine_state?: string;
  body_state?: string;
  turbo?: boolean;
  subwoofer?: boolean;
  trade_available?: boolean;
  plate?: string;
  engine_upgrade?: number;
  transmission_upgrade?: number;
  brake_upgrade?: number;
  // Property details
  property_type?: string;
  floor?: number;
  room_count?: string;
  furnished?: boolean;
  building_type?: 'Normal' | 'Dubleks';
  balcony?: boolean;
}

export interface IListingRepository {
  getPublicListings(params?: ListingFilterParams): Promise<PublicListingSummary[]>;
  getListingById(id: string, viewerProfileId?: string): Promise<{ listing: MemberListingDetail | PublicListingSummary | null; isLocked: boolean; isOwner: boolean }>;
  createListing(input: CreateListingInput, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }>;
  updateListing(id: string, input: Partial<CreateListingInput>, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }>;
  markListingAsSold(id: string, profileId: string): Promise<{ success: boolean; error?: string }>;
  getUserListings(profileId: string): Promise<Listing[]>;
  toggleFavorite(profileId: string, listingId: string, userId?: string): Promise<{ isFavorited: boolean; count: number }>;
  getUserFavorites(profileId: string, userId?: string): Promise<(Listing & { isExpired: boolean })[]>;
}

export interface INotificationRepository {
  getUserNotifications(userId: string): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(userId: string, notificationId: string): Promise<{ success: boolean; notification?: Notification; error?: string }>;
  markAllAsRead(userId: string): Promise<{ success: boolean; count: number }>;
  createNotification(params: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    entity_type?: 'listing' | 'ticket' | 'application' | 'system';
    entity_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification>;
}

export interface IUserRepository {
  getUserById(id: string): Promise<User | null>;
  getProfileById(id: string): Promise<CharacterProfile | null>;
  getProfilesByUserId(userId: string): Promise<CharacterProfile[]>;
  updateProfile(id: string, data: Partial<CharacterProfile>): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }>;
}

export interface ITicketRepository {
  getUserTickets(profileId: string): Promise<SupportTicket[]>;
  getTicketById(id: string): Promise<(SupportTicket & { messages: TicketMessage[] }) | null>;
  createTicket(params: { profileId: string; creatorName: string; subject: string; message: string }): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }>;
  addTicketMessage(params: { ticketId: string; senderRole: 'USER' | 'ADMIN'; senderName: string; message: string }): Promise<{ success: boolean; message?: TicketMessage; error?: string }>;
  updateTicketStatus(id: string, status: TicketStatus): Promise<boolean>;
}

export interface IDealerRepository {
  getDealerById(id: string): Promise<CorporateProfile | null>;
  getDealerBySlug(slug: string): Promise<CorporateProfile | null>;
  getDealerByProfileId(profileId: string): Promise<CorporateProfile | null>;
  createApplication(params: { profileId: string; companyName: string; purpose: string }): Promise<{ success: boolean; application?: CorporateApplication; error?: string }>;
  updateDealerProfile(id: string, data: Partial<CorporateProfile>): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }>;
}

export interface IPaymentRepository {
  getUserCredits(profileId: string): Promise<{ available: number; total: number; credits: any[] }>;
  consumeCredit(profileId: string, listingId: string): Promise<boolean>;
  createPaymentOrder(profileId: string, packageIdOrCode: string): Promise<{ orderId: string; amount: number; packageName?: string }>;
  completePayment(orderId: string, externalPaymentId?: string): Promise<{ success: boolean; credit?: any; error?: string }>;
  getUserPayments(profileId: string): Promise<any[]>;
}
