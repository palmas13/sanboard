export type ListingCategory = 'vehicle' | 'property';

export type { VehicleCategory } from '@/lib/constants/vehicleCategories';
import type { VehicleCategory } from '@/lib/constants/vehicleCategories';

export type PropertyType =
  | 'Ev / Daire'
  | 'İşyeri'
  | 'Diğer Mülk';

export type RoomCount =
  | 'Stüdyo'
  | '1+0'
  | '1+1'
  | '2+1'
  | '3+1'
  | '4+1'
  | '5+1+';

export type BuildingType = 'Normal' | 'Dubleks';

export type UpgradeLevel = 0 | 1 | 2 | 3 | 4;

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'SOLD' | 'REMOVED';

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BANNED';
export type ContactVisibility = 'PUBLIC' | 'PRIVATE';

export interface User {
  id: string;
  provider: 'GTAWORLD';
  external_user_id?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface CharacterProfile {
  id: string;
  user_id: string;
  external_character_id?: string;
  full_name: string;
  avatar_url: string;
  avatar_path?: string;
  sanmail_email: string;
  phone: string;
  phone_visibility?: ContactVisibility;
  sanmail_visibility?: ContactVisibility;
  payment_history_cleared_at?: string | null;
  expired_listing_history_cleared_at?: string | null;
  sold_listing_history_cleared_at?: string | null;
  role?: UserRole;
  is_dealer?: boolean;
  dealer_id?: string;
  public_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterSummary {
  id: string;
  profileId?: string | null;
  externalCharacterId?: string;
  firstName?: string;
  lastName?: string;
  hasProfile?: boolean;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string; // URL or local path
  sort_order: number;
  is_cover: boolean;
  size_bytes: number;
  created_at: string;
}

export type FuelType = 'BENZIN' | 'DIZEL' | 'ELEKTRIK';
export type SellerType = 'INDIVIDUAL' | 'CORPORATE';

export interface VehicleDetails {
  listing_id: string;
  vehicle_category: VehicleCategory;
  brand?: string;
  model: string;
  plate: string;
  mileage: number;
  engine_upgrade: UpgradeLevel;
  transmission_upgrade: UpgradeLevel;
  brake_upgrade: UpgradeLevel;
  turbo: boolean;
  subwoofer: boolean;
  trade_available: boolean;

  // New LFM vehicle fields
  lock_level?: number | null;
  alarm_level?: number | null;
  anti_theft_level?: number | null;
  engine_health?: number | null;
  suspension?: UpgradeLevel | null;
  fuel_type?: FuelType | null;
  factory_price?: number | null;
}

export interface PropertyDetails {
  listing_id: string;
  property_type: PropertyType;
  floor: number;
  room_count: RoomCount;
  room_number?: number | null;
  furnished: boolean;
  alarm?: boolean | null;
  market_value?: number | null;
  furniture_value?: number | null;
  building_type: BuildingType;
  balcony: boolean;
}

export interface Listing {
  id: string;
  public_id?: string;
  listing_number: string; // e.g. #SB-100028
  seller_profile_id: string;
  corporate_profile_id?: string;
  seller_type?: SellerType;
  category: ListingCategory;
  subcategory: VehicleCategory | PropertyType;
  title: string; // max 60
  description: string; // max 240
  price: number;
  offers_enabled?: boolean;
  minimum_offer_amount?: number | null;
  previous_price?: number;
  location: string | null;
  status: ListingStatus;
  close_reason?: 'SOLD' | 'CANCELLED' | 'OTHER' | 'ADMIN_REMOVED' | null;
  closed_at?: string | null;
  is_featured?: boolean;
  featured_until?: string | null;
  published_at?: string;
  expires_at?: string;
  frozen_at?: string | null;
  remaining_listing_seconds?: number | null;
  remaining_boost_seconds?: number | null;
  last_freeze_transition_at?: string | null;
  freeze_count?: number;
  resume_count?: number;
  created_at: string;
  updated_at: string;

  // Joined relations
  images?: ListingImage[];
  vehicle_details?: VehicleDetails;
  property_details?: PropertyDetails;
  seller?: CharacterProfile;
  dealer?: DealerProfile;
  favorite_count?: number;
  is_favorited?: boolean;
}

// Public-safe listing representation for unauthenticated visitors
export interface PublicListingSummary {
  id: string;
  public_id?: string;
  listing_number: string;
  corporate_profile_id?: string;
  seller_type?: SellerType;
  category: ListingCategory;
  subcategory: string;
  title: string;
  description?: string;
  price: number;
  previous_price?: number;
  location: string | null;
  published_at?: string;
  cover_image?: string;
  favorite_count: number;
  is_favorited?: boolean;
  is_featured?: boolean;
  featured_until?: string | null;
  is_locked: true;
  brand?: string;
  model?: string;
  /** Effective lifecycle state. Detail responses may expose terminal states. */
  status?: ListingStatus;
}

export interface SimilarListingSummary {
  id: string;
  public_id?: string;
  category: ListingCategory;
  subcategory: string;
  title: string;
  price: number;
  location: string | null;
  published_at?: string;
  cover_image?: string;
  brand?: string;
  model?: string;
}

// Member-accessible full listing representation
export interface MemberListingDetail extends Listing {
  is_locked: false;
}

export interface ListingPackage {
  id: string;
  code: string; // 'STANDARD_7_DAY'
  name: string; // '7 Günlük Standart İlan'
  price: number; // 2000
  duration_days: number; // 7
  active: boolean;
  seller_type?: SellerType;
}

export type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED';
export type PayerIdentityStatus = 'PENDING' | 'VERIFIED' | 'MISMATCH' | 'UNAVAILABLE' | 'FAILED';
export type PayerIdentityFailureCode =
  | 'PAYER_NAME_MISMATCH'
  | 'PAYER_NAME_MISSING'
  | 'PAYER_ROUTING_MISSING'
  | 'PAYER_ROUTING_INVALID'
  | 'PAYER_ROUTING_CONFLICT'
  | 'PAYER_IDENTITY_UNAVAILABLE'
  | 'PAYER_VERIFICATION_FAILED';

export interface CharacterFleecaAccount {
  id: string;
  profile_id: string;
  payer_routing: string;
  verification_status: 'VERIFIED';
  verified_payment_id: string;
  verified_at: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  profile_id: string;
  package_id: string;
  provider: 'FLEECA';
  external_payment_id?: string;
  idempotency_key?: string;
  corporate_profile_id?: string | null;
  historical_corporate_profile_id?: string | null;
  corporate_profile_snapshot?: Record<string, unknown> | null;
  entitlement_type?: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION' | 'BOOST_CREDIT';
  purpose?: 'LISTING_PUBLICATION' | 'LISTING_BOOST' | 'CORPORATE_SUBSCRIPTION';
  target_listing_id?: string | null;
  package_code?: string | null;
  package_name?: string | null;
  entitlement_applied_at?: string | null;
  processed_at?: string | null;
  expected_external_character_id?: string | null;
  expected_character_name?: string | null;
  payer_identity_status?: PayerIdentityStatus | null;
  payer_identity_failure_code?: PayerIdentityFailureCode | null;
  payer_identity_verified_at?: string | null;
  amount: number; // 2000
  status: PaymentStatus;
  created_at: string;
  paid_at?: string;
}

export type CreditStatus = 'AVAILABLE' | 'USED';

export interface ListingCredit {
  id: string;
  profile_id: string;
  payment_id: string;
  package_id: string;
  credit_type?: SellerType;
  corporate_profile_id?: string | null;
  historical_corporate_profile_id?: string | null;
  corporate_profile_snapshot?: Record<string, unknown> | null;
  amount?: number;
  usage_scope?: 'NEW_LISTING_ONLY' | 'NEW_OR_REPUBLISH';
  grant_source?: 'PURCHASE' | 'MEMBERSHIP_PLUS';
  grant_sequence?: number;
  membership_period_id?: string | null;
  status: CreditStatus;
  used_listing_id?: string;
  created_at: string;
  used_at?: string;
}

export interface CorporateBoostCredit {
  id: string;
  corporate_profile_id: string;
  payment_id: string;
  grant_source: 'MEMBERSHIP_PLUS';
  grant_sequence: number;
  status: CreditStatus;
  created_at: string;
  used_listing_id?: string;
  used_at?: string;
}

export interface Favorite {
  id: string;
  user_id?: string;
  profile_id: string;
  listing_id: string;
  created_at: string;
}

export interface ListingPriceHistory {
  id: string;
  listing_id: string;
  old_price: number;
  new_price: number;
  changed_at: string;
}

export type CorporateModerationStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export type NotificationType =
  | 'LISTING_PRICE_DROP'
  | 'LISTING_PRICE_CHANGE'
  | 'SUPPORT_REPLY'
  | 'SYSTEM'
  | 'LISTING_EXPIRES_SOON'
  | 'CORPORATE_APPLICATION_APPROVED'
  | 'CORPORATE_APPLICATION_REJECTED'
  | 'NEW_CORPORATE_LISTING'
  | 'NEW_FOLLOWER'
  | 'CORPORATE_SUBSCRIPTION_EXPIRING'
  | 'CORPORATE_STORE_SUSPENDED'
  | 'CORPORATE_STORE_REACTIVATED'
  | 'CORPORATE_STORE_DELETED'
  | 'OFFER_ACTIVITY';

export type OfferThreadStatus = 'ACTIVE' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'CLOSED';
export type OfferCloseReason = 'LISTING_EXPIRED' | 'LISTING_REMOVED_BY_SELLER' | 'LISTING_REMOVED_BY_ADMIN' | 'LISTING_SOLD' | 'LISTING_DELETED' | 'LISTING_SUSPENDED';
export type OfferEventType = 'OFFER_CREATED' | 'COUNTER_OFFER_CREATED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'LISTING_PRICE_CHANGED' | 'THREAD_CLOSED';

export interface OfferEvent {
  id: string;
  thread_id: string;
  actor_profile_id?: string | null;
  event_type: OfferEventType;
  amount?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface OfferThread {
  id: string;
  listing_id: string | null;
  original_listing_id?: string;
  listing_snapshot?: Partial<Listing> | null;
  buyer_profile_id: string;
  seller_profile_id: string;
  seller_corporate_profile_id?: string | null;
  historical_seller_corporate_profile_id?: string | null;
  seller_corporate_snapshot?: Record<string, unknown> | null;
  current_amount: number;
  status: OfferThreadStatus;
  close_reason?: OfferCloseReason | null;
  turn_profile_id?: string | null;
  movement_count: number;
  expires_at: string;
  buyer_last_read_at?: string | null;
  seller_last_read_at?: string | null;
  buyer_hidden_at?: string | null;
  seller_hidden_at?: string | null;
  created_at: string;
  updated_at: string;
  listing?: Pick<Listing, 'id' | 'public_id' | 'title' | 'price' | 'status' | 'images' | 'offers_enabled' | 'minimum_offer_amount'>;
  buyer?: Pick<CharacterProfile, 'id' | 'public_id' | 'full_name' | 'avatar_url' | 'avatar_path'>;
  seller?: Pick<CharacterProfile, 'id' | 'public_id' | 'full_name' | 'avatar_url' | 'avatar_path'>;
  events?: OfferEvent[];
  unread_count?: number;
  actor_side?: 'BUYER' | 'SELLER';
  visible_contact?: { phone?: string; sanmail_email?: string };
}

export interface Notification {
  id: string;
  recipient_profile_id?: string;
  user_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: 'listing' | 'ticket' | 'application' | 'system' | 'offer';
  entity_id?: string;
  metadata?: Record<string, any>;
  read_at?: string | null;
  created_at: string;
  is_read?: boolean;
  link?: string;
}

export type ReportReason =
  | 'Yanlış bilgi'
  | 'Uygunsuz içerik'
  | 'Şüpheli ilan'
  | 'Diğer';

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id: string;
  reporter_profile_id: string;
  listing_id: string | null;
  historical_listing_id?: string;
  listing_snapshot?: Partial<Listing> | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  created_at: string;
}

export interface SoldListingAudit {
  id: string;
  original_listing_id: string;
  seller_profile_id: string;
  payment_id?: string;
  sold_at: string;
  title?: string;
  price?: number;
  description?: string;
  closed_at?: string;
}

export type DealerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CorporateSubscriptionStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED';

export interface CorporateSocialMedia {
  name: string;
  url: string;
}

export interface DealerProfile {
  id: string;
  profile_id: string;
  owner_profile_id?: string;
  company_name: string;
  slug?: string;
  description: string;
  logo_url: string;
  logo_path?: string;
  banner_url: string;
  banner_path?: string;
  public_id?: number;
  address?: string;
  phone?: string;
  sanmail_email?: string;
  email?: string;
  is_premium?: boolean;
  is_verified?: boolean;
  purpose?: string;
  status: DealerStatus;
  subscription_status?: CorporateSubscriptionStatus;
  subscription_expires_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  boost_credits?: number;
  monthly_boost_credits?: number;
  purchased_boost_credits?: number;
  active_package_code?: string | null;
  active_package_name?: string | null;
  active_package_price?: number | null;
  included_listing_credits?: number;
  included_boost_credits?: number;
  social_media?: CorporateSocialMedia[] | CorporateSocialMedia | { [key: string]: any } | null;
  follower_count?: number;
  is_following?: boolean;
  moderation_status?: CorporateModerationStatus;
  suspended_at?: string | null;
  suspended_by_profile_id?: string | null;
  suspension_reason?: string | null;
  deleted_at?: string | null;
  deleted_by_profile_id?: string | null;
  deletion_reason?: string | null;
  purge_requested_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CorporateProfile = DealerProfile;

export interface CorporateFollower {
  id: string;
  follower_profile_id: string;
  corporate_profile_id: string;
  created_at: string;
  follower?: CharacterProfile;
}

export interface CorporateApplication {
  id: string;
  applicant_profile_id: string;
  company_name: string;
  contact_phone?: string;
  contact_email?: string;
  location?: string;
  purpose: string;
  status: DealerStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type TicketCategory = 'LISTING' | 'PAYMENT' | 'CORPORATE' | 'ACCOUNT_CHARACTER' | 'REPORT_MODERATION' | 'OTHER';

export interface SupportTicket {
  id: string;
  profile_id: string;
  creator_name: string;
  subject: string;
  category?: TicketCategory | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_role: 'USER' | 'ADMIN';
  sender_name: string;
  /** Server-derived presentation identity. Never accepted from the client. */
  author_type?: 'USER' | 'ADMIN';
  /** Safe author label for user-facing and admin-facing conversation views. */
  display_author?: string;
  message: string;
  created_at: string;
}
