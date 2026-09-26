export type ListingCategory = 'vehicle' | 'property';

export type VehicleCategory =
  | 'Otomobil'
  | 'SUV / Off-Road / Kamyonet'
  | 'Motosiklet';

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

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'SOLD' | 'REMOVED';

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BANNED';

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
  role?: UserRole;
  is_dealer?: boolean;
  dealer_id?: string;
  public_id?: number;
  created_at: string;
  updated_at: string;
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
  suspension?: string | null;
  fuel_type?: FuelType | null;
  factory_price?: number | null;
}

export interface PropertyDetails {
  listing_id: string;
  property_type: PropertyType;
  floor: number;
  room_count: RoomCount;
  furnished: boolean;
  building_type: BuildingType;
  balcony: boolean;
}

export interface Listing {
  id: string;
  listing_number: string; // e.g. #SB-100028
  seller_profile_id: string;
  corporate_profile_id?: string;
  seller_type?: SellerType;
  category: ListingCategory;
  subcategory: VehicleCategory | PropertyType;
  title: string; // max 60
  description: string; // max 100
  price: number;
  previous_price?: number;
  location: string | null;
  status: ListingStatus;
  is_featured?: boolean;
  featured_until?: string | null;
  published_at?: string;
  expires_at?: string;
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
  listing_number: string;
  corporate_profile_id?: string;
  seller_type?: SellerType;
  category: ListingCategory;
  subcategory: string;
  title: string;
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

export interface Payment {
  id: string;
  order_id: string;
  profile_id: string;
  package_id: string;
  provider: 'FLEECA';
  external_payment_id?: string;
  idempotency_key?: string;
  corporate_profile_id?: string | null;
  entitlement_type?: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION';
  entitlement_applied_at?: string | null;
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
  amount?: number;
  status: CreditStatus;
  used_listing_id?: string;
  created_at: string;
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
  | 'CORPORATE_STORE_DELETED';

export interface Notification {
  id: string;
  recipient_profile_id?: string;
  user_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: 'listing' | 'ticket' | 'application' | 'system';
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
  listing_id: string;
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
  boost_credits?: number;
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
  purpose: string;
  status: DealerStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface SupportTicket {
  id: string;
  profile_id: string;
  creator_name: string;
  subject: string;
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
  message: string;
  created_at: string;
}
