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
  location?: string | null;
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
  fuel_type?: string | null;
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
  lock_level?: number | null;
  alarm_level?: number | null;
  anti_theft_level?: number | null;
  engine_health?: number | null;
  suspension?: string | null;
  factory_price?: number | null;
  seller_type?: 'INDIVIDUAL' | 'CORPORATE' | null;
  corporate_profile_id?: string | null;
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
  getSimilarListings?(currentListingId: string, limit?: number): Promise<PublicListingSummary[]>;
  getCompareListings?(ids: string[]): Promise<(Listing | null)[]>;
  getListingById(id: string, viewerProfileId?: string, viewerUserId?: string): Promise<{ listing: MemberListingDetail | PublicListingSummary | null; isLocked: boolean; isOwner: boolean }>;
  createListing(input: CreateListingInput, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }>;
  updateListing(id: string, input: Partial<CreateListingInput>, profileId: string, userId?: string, role?: string): Promise<{ success: boolean; listing?: Listing; error?: string }>;
  markListingAsSold(id: string, profileId: string): Promise<{ success: boolean; error?: string }>;
  republishListing(id: string, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }>;
  removeListing?(id: string, profileId: string): Promise<{ success: boolean; error?: string }>;
  getUserListings(profileId: string): Promise<Listing[]>;
  getCorporateListings(
    corporateProfileId: string,
    onTiming?: (stage: 'db' | 'enrich', duration: number) => void
  ): Promise<Listing[]>;
  toggleFavorite(listingId: string, profileId: string): Promise<{ isFavorited: boolean; count: number }>;
  setFavorite(listingId: string, profileId: string, isFavorited: boolean): Promise<{ isFavorited: boolean; count: number }>;
  removeFavorite(listingId: string, profileId: string): Promise<{ success: boolean; count: number }>;
  getFavoriteStates(listingIds: string[], profileId?: string): Promise<Record<string, { isFavorited: boolean; count: number }>>;
  getUserFavorites(profileId: string): Promise<(Listing & { isExpired: boolean })[]>;
}

export interface INotificationRepository {
  getUserNotifications(profileIdOrUserId: string): Promise<Notification[]>;
  getUnreadCount(profileIdOrUserId: string): Promise<number>;
  markAsRead(profileIdOrUserId: string, notificationId: string): Promise<{ success: boolean; notification?: Notification; error?: string }>;
  markAllAsRead(profileIdOrUserId: string): Promise<{ success: boolean; count: number }>;
  createNotification(params: {
    recipient_profile_id?: string;
    user_id?: string;
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
  getCanonicalProfileById(id: string): Promise<CharacterProfile | null>;
  getProfileByPublicId?(publicId: number): Promise<CharacterProfile | null>;
  getProfilesByUserId(userId: string): Promise<CharacterProfile[]>;
  createProfile(data: {
    userId: string;
    fullName: string;
    externalCharacterId?: string;
    avatarData?: string;
    sanmailEmail?: string;
    phone?: string;
  }): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }>;
  updateProfile(id: string, data: Partial<CharacterProfile>): Promise<{ success: boolean; profile?: CharacterProfile; error?: string }>;
}

export interface ITicketRepository {
  getUserTickets(profileId: string): Promise<SupportTicket[]>;
  getTicketById(id: string): Promise<(SupportTicket & { messages: TicketMessage[] }) | null>;
  createTicket(params: { profileId: string; creatorName: string; subject: string; message: string }): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }>;
  addTicketMessage(params: { ticketId: string; senderRole: 'USER' | 'ADMIN'; senderName: string; message: string }): Promise<{ success: boolean; message?: TicketMessage; error?: string }>;
  updateTicketStatus(id: string, status: TicketStatus): Promise<boolean>;
  getAllTickets(): Promise<SupportTicket[]>;
}

export interface IDealerRepository {
  getDealerById(id: string): Promise<CorporateProfile | null>;
  getDealerByPublicId?(publicId: number): Promise<CorporateProfile | null>;
  getDealerBySlug(slug: string): Promise<CorporateProfile | null>;
  getDealerByProfileId(profileId: string, includeDeleted?: boolean): Promise<CorporateProfile | null>;
  getAllDealers?(): Promise<CorporateProfile[]>;
  getApplicationByProfileId?(profileId: string): Promise<CorporateApplication | null>;
  getApplicationByCanonicalProfileId(profileId: string): Promise<CorporateApplication | null>;
  getAllApplications?(): Promise<CorporateApplication[]>;
  createApplication(params: { profileId: string; companyName: string; purpose: string }): Promise<{ success: boolean; application?: CorporateApplication; error?: string }>;
  reviewApplication?(applicationId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string, reviewerUserId?: string): Promise<{ success: boolean; error?: string }>;
  activateSubscription?(dealerId: string): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }>;
  boostListing?(actorProfileId: string, listingId: string, now?: Date): Promise<{ success: boolean; error?: string; code?: string; remainingBoosts?: number; featured_until?: string }>;
  toggleFollow?(followerProfileId: string, corporateProfileId: string): Promise<{ isFollowing: boolean; count: number; followerCount?: number }>;
  setFollow?(followerProfileId: string, corporateProfileId: string, shouldFollow: boolean): Promise<{ isFollowing: boolean; count: number; followerCount?: number }>;
  getFollowers?(corporateProfileId: string): Promise<CharacterProfile[]>;
  isFollowing?(followerProfileId: string, corporateProfileId: string): Promise<boolean>;
  updateDealerProfile(id: string, data: Partial<CorporateProfile>): Promise<{ success: boolean; dealer?: CorporateProfile; error?: string }>;
  suspendStore?(dealerId: string, reason: string, adminProfileId: string): Promise<{ success: boolean; error?: string }>;
  reactivateStore?(dealerId: string, adminProfileId: string): Promise<{ success: boolean; error?: string }>;
  deleteStore?(dealerId: string, reason: string, adminProfileId: string): Promise<{ success: boolean; error?: string }>;
}

export interface IPaymentRepository {
  getUserCredits(profileId: string): Promise<{ available: number; total: number; credits: any[] }>;
  createPaymentOrder(profileId: string, packageIdOrCode: string, options?: { idempotencyKey?: string; corporateProfileId?: string | null }): Promise<{ orderId: string; amount: number; packageName?: string; entitlementType?: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION' }>;
  completePayment(orderId: string, externalPaymentId?: string): Promise<{ success: boolean; credit?: any; error?: string }>;
  getPaymentOrder(orderId: string): Promise<any | null>;
  getUserPayments(profileId: string): Promise<any[]>;
}

export interface AuditRecord {
  id: string;
  event_type: string;
  user_id?: string | null;
  profile_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface IAuditRepository {
  recordEvent(event: {
    eventType: string;
    userId?: string | null;
    profileId?: string | null;
    metadata?: Record<string, any>;
    timestamp?: string;
  }): Promise<void>;
  getAuditLogs(limit?: number): Promise<AuditRecord[]>;
}

