import { db } from './store';
import {
  Listing,
  ListingCategory,
  MemberListingDetail,
  PublicListingSummary,
  SimilarListingSummary,
  VehicleCategory,
  PropertyType,
  ReportReason,
} from '@/types';
import { generateListingNumber } from '../utils/format';
import { createNotification } from './notifications';
import { SupabaseListingRepository } from './repositories/supabase/supabase-listing-repo';
import type { ListingPublishOptions } from './repositories/types';
import { isUuid, resolveUserId } from './id-mapper';
import { resolveMockUserId } from '@/lib/integrations/gtaworld/mock-identities';
import { isListingOwnedByActiveProfile } from '../dealers/eligibility';
import { getEffectiveListingStatus, isPublicListingVisible } from '../listings/visibility';
import { getListingCoverPath, sortListingImages } from '../listings/images';
import { isListingPublicId } from '../urls';
import { redactPrivateContact } from '../profiles/contact-privacy';
import { getSupabaseAdminClient } from './supabase-client';
import { sortPublicListings } from '@/lib/listings/public-sort';
import { rankSimilarListings } from '@/lib/listings/similarity';
import { CANONICAL_PRICING } from '@/lib/payments/pricing';

export interface ListingFilterParams {
  category?: ListingCategory;
  subcategory?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  // Vehicle specific
  brand?: string;
  model?: string;
  minMileage?: number;
  maxMileage?: number;
  turbo?: 'all' | 'yes' | 'no';
  subwoofer?: 'all' | 'yes' | 'no';
  trade?: 'all' | 'yes' | 'no';
  // Seller type filter
  sellerType?: 'all' | 'INDIVIDUAL' | 'CORPORATE';
  // Property specific
  roomCount?: string;
  furnished?: 'all' | 'yes' | 'no';
  balcony?: 'all' | 'yes' | 'no';
  buildingType?: 'all' | 'Normal' | 'Dubleks';
  floor?: number;
  // Sorting
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular';
}

/**
 * Strips all member-only private details from a listing object.
 * Returns only public-safe fields.
 */
export function sanitizeListingForPublic(listing: Listing): PublicListingSummary {
  const coverImg = getListingCoverPath(listing.images);
  const favCount = db.favorites.filter((f) => f.listing_id === listing.id).length;
  const now = new Date();
  const isFeatured = Boolean(
    listing.is_featured &&
    (!listing.featured_until || new Date(listing.featured_until) > now)
  );

  return {
    id: listing.id,
    public_id: listing.public_id,
    listing_number: listing.listing_number,
    category: listing.category,
    subcategory: listing.subcategory,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    previous_price: listing.previous_price,
    location: listing.location,
    published_at: listing.published_at,
    cover_image: coverImg,
    favorite_count: favCount,
    is_locked: true,
    is_featured: isFeatured,
    featured_until: listing.featured_until,
    seller_type: listing.seller_type,
    corporate_profile_id: listing.corporate_profile_id,
    brand: listing.vehicle_details?.brand,
    model: listing.vehicle_details?.model,
    status: getEffectiveListingStatus(listing),
  };
}

let supabaseListingRepoInstance: SupabaseListingRepository | null = null;
function getSupabaseRepo(): SupabaseListingRepository {
  if (!supabaseListingRepoInstance) {
    supabaseListingRepoInstance = new SupabaseListingRepository();
  }
  return supabaseListingRepoInstance;
}

function isSupabaseConfiguredMode(): boolean {
  return process.env.DATA_STORE === 'supabase';
}

/**
 * Public search/listing query.
 * CRITICAL RULE: ONLY returns ACTIVE and expires_at > NOW().
 */
export async function getPublicListings(filters: ListingFilterParams = {}): Promise<PublicListingSummary[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getPublicListings(filters);
  }
  const now = new Date();

  // 1. Strict status & expiration filter
  let result = db.listings.filter((l) => {
    const store = l.seller_type === 'CORPORATE'
      ? (db.dealers || []).find((dealer) => dealer.id === l.corporate_profile_id)
      : null;
    return isPublicListingVisible(l, store, now);
  });

  // Filter out corporate listings from suspended or deleted stores (Section 14 & 16)
  result = result.filter((l) => {
    if (l.seller_type === 'CORPORATE' && l.corporate_profile_id) {
      const store = (db.dealers || []).find((d) => d.id === l.corporate_profile_id);
      if (!store || !isPublicListingVisible(l, store, new Date())) {
        return false;
      }
    }
    return true;
  });

  // 2. Category filter
  if (filters.category) {
    result = result.filter((l) => l.category === filters.category);
  }

  // 3. Subcategory filter
  if (filters.subcategory && filters.subcategory !== 'all') {
    result = result.filter((l) => l.subcategory === filters.subcategory);
  }

  // 4. Query filter (title, model, location)
  if (filters.query) {
    const q = filters.query.toLowerCase().trim();
    result = result.filter((l) => {
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchLoc = l.location ? l.location.toLowerCase().includes(q) : false;
      const matchModel = l.vehicle_details?.model.toLowerCase().includes(q);
      return matchTitle || matchLoc || Boolean(matchModel);
    });
  }

  // 5. Price filter
  if (filters.minPrice !== undefined && !isNaN(filters.minPrice)) {
    result = result.filter((l) => l.price >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
    result = result.filter((l) => l.price <= filters.maxPrice!);
  }

  // 6. Location filter
  if (filters.location && filters.location !== 'all') {
    result = result.filter((l) =>
      Boolean(l.location && l.location.toLowerCase().includes(filters.location!.toLowerCase()))
    );
  }

  // 7. Vehicle filters
  if (filters.brand && filters.brand !== 'all') {
    result = result.filter(
      (l) => l.vehicle_details?.brand?.toLowerCase() === filters.brand!.toLowerCase()
    );
  }
  if (filters.model && filters.model !== 'all') {
    result = result.filter(
      (l) => l.vehicle_details?.model?.toLowerCase() === filters.model!.toLowerCase()
    );
  }
  if (filters.minMileage !== undefined && !isNaN(filters.minMileage)) {
    result = result.filter(
      (l) => l.vehicle_details && l.vehicle_details.mileage >= filters.minMileage!
    );
  }
  if (filters.maxMileage !== undefined && !isNaN(filters.maxMileage)) {
    result = result.filter(
      (l) => l.vehicle_details && l.vehicle_details.mileage <= filters.maxMileage!
    );
  }
  if (filters.turbo && filters.turbo !== 'all') {
    const wantTurbo = filters.turbo === 'yes';
    result = result.filter((l) => l.vehicle_details?.turbo === wantTurbo);
  }
  if (filters.subwoofer && filters.subwoofer !== 'all') {
    const wantSub = filters.subwoofer === 'yes';
    result = result.filter((l) => l.vehicle_details?.subwoofer === wantSub);
  }
  if (filters.trade && filters.trade !== 'all') {
    const wantTrade = filters.trade === 'yes';
    result = result.filter((l) => l.vehicle_details?.trade_available === wantTrade);
  }

  // 8. Seller type filter
  if (filters.sellerType && filters.sellerType !== 'all') {
    result = result.filter((l) => (l.seller_type || 'INDIVIDUAL') === filters.sellerType);
  }

  // 9. Property filters
  if (filters.roomCount && filters.roomCount !== 'all') {
    result = result.filter((l) => l.property_details?.room_count === filters.roomCount);
  }
  if (filters.furnished && filters.furnished !== 'all') {
    const wantFurnished = filters.furnished === 'yes';
    result = result.filter((l) => l.property_details?.furnished === wantFurnished);
  }
  if (filters.balcony && filters.balcony !== 'all') {
    const wantBalcony = filters.balcony === 'yes';
    result = result.filter((l) => l.property_details?.balcony === wantBalcony);
  }
  if (filters.buildingType && filters.buildingType !== 'all') {
    result = result.filter((l) => l.property_details?.building_type === filters.buildingType);
  }

  // 10. Sorting (Featured listings always appear first!)
  const getFavCount = (id: string) => db.favorites.filter((f) => f.listing_id === id).length;

  result = sortPublicListings(
    result.map((listing) => ({
      ...listing,
      is_featured: Boolean(listing.is_featured && (!listing.featured_until || new Date(listing.featured_until) > now)),
    })),
    filters.sort,
    (listing) => getFavCount(listing.id)
  );

  return result.map(sanitizeListingForPublic);
}

/**
 * Smart Similar Listings scoring & ranking algorithm.
 * Strictly respects visibility rules:
 * - Excludes current listing (ASLA kendi benzer ilanları içinde görünmemeli)
 * - Excludes REMOVED, SOLD, EXPIRED, DRAFT
 * - Excludes listings from SUSPENDED or DELETED corporate stores
 * - Requires the same broad market and canonical vehicle/property category
 * - Uses vehicle brand/model only as ranking bonuses alongside price proximity
 * - Supports property listings without depending on vehicle details
 */
export async function getSimilarListings(
  currentListingId: string,
  limit: number = 10
): Promise<SimilarListingSummary[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getSimilarListings(currentListingId, limit);
  }

  const current = db.listings.find((l) => l.id === currentListingId);
  if (!current) return [];

  const now = new Date();
  const currentStore = current.seller_type === 'CORPORATE'
    ? (db.dealers || []).find((dealer) => dealer.id === current.corporate_profile_id)
    : null;
  if (!isPublicListingVisible(current, currentStore, now)) return [];

  // Eligibility is identical to public discovery and enforced before ranking.
  // Brand/model never narrow this canonical-category pool.
  const candidates = db.listings.filter((l) => {
    if (l.id === currentListingId) return false;
    if (l.category !== current.category || l.subcategory !== current.subcategory) return false;
    const store = l.seller_type === 'CORPORATE'
      ? (db.dealers || []).find((dealer) => dealer.id === l.corporate_profile_id)
      : null;
    return isPublicListingVisible(l, store, now);
  });

  return rankSimilarListings(
    {
      ...current,
      brand: current.vehicle_details?.brand,
      model: current.vehicle_details?.model,
    },
    candidates.map((candidate) => ({
      ...candidate,
      brand: candidate.vehicle_details?.brand,
      model: candidate.vehicle_details?.model,
    })),
    limit
  ).map((candidate) => ({
    id: candidate.id,
    public_id: candidate.public_id,
    category: candidate.category,
    subcategory: candidate.subcategory,
    title: candidate.title,
    price: candidate.price,
    location: candidate.location,
    published_at: candidate.published_at,
    cover_image: getListingCoverPath(candidate.images),
    brand: candidate.brand,
    model: candidate.model,
  }));
}

/**
 * Safely fetches listings for comparison by their IDs.
 * Strictly verifies visibility rules:
 * - ACTIVE status
 * - Not expired
 * - Vehicle category only (Property listings cannot enter vehicle compare)
 * - Corporate store not suspended or deleted
 * Returns array with matching Listing or null for invalid/removed slots.
 */
export async function getCompareListings(ids: string[]): Promise<(Listing | null)[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getCompareListings(ids);
  }

  const now = new Date();
  return ids.map((id) => {
    const listing = db.listings.find((l) => l.id === id);
    if (!listing) return null;
    if (listing.status !== 'ACTIVE') return null;
    if (!listing.expires_at || new Date(listing.expires_at) <= now) return null;
    if (listing.category !== 'vehicle') return null;

    if (listing.seller_type === 'CORPORATE' && listing.corporate_profile_id) {
      const store = (db.dealers || []).find((d) => d.id === listing.corporate_profile_id);
      if (store && (store.moderation_status === 'SUSPENDED' || store.moderation_status === 'DELETED' || store.deleted_at)) {
        return null;
      }
    }

    return listing;
  });
}

/** Fetches only currently public property listings for comparison. */
export async function getPropertyCompareListings(ids: string[]): Promise<(Listing | null)[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getPropertyCompareListings(ids);
  }

  const now = new Date();
  return ids.map((id) => {
    const listing = db.listings.find((item) => item.id === id);
    if (!listing || listing.category !== 'property') return null;
    const store = listing.seller_type === 'CORPORATE' && listing.corporate_profile_id
      ? (db.dealers || []).find((dealer) => dealer.id === listing.corporate_profile_id)
      : null;
    if (!isPublicListingVisible(listing, store, now)) return null;

    return {
      ...listing,
      seller: db.profiles.find((profile) => profile.id === listing.seller_profile_id),
      dealer: store || undefined,
    };
  });
}

/**
 * Get single listing by ID with public/member data separation.
 */
export async function getListingById(
  id: string,
  viewerProfileId?: string,
  viewerUserId?: string
): Promise<{ listing: PublicListingSummary | MemberListingDetail | null; isLocked: boolean; isOwner: boolean }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getListingById(id, viewerProfileId, viewerUserId);
  }
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) {
    return { listing: null, isLocked: false, isOwner: false };
  }

  // Check if expired and viewer is not the owner
  const isExpired = listing.expires_at ? new Date(listing.expires_at) <= new Date() : false;
  const store = listing.seller_type === 'CORPORATE' && listing.corporate_profile_id
    ? (db.dealers || []).find((d) => d.id === listing.corporate_profile_id)
    : undefined;
  const storeOwnerId = store?.owner_profile_id || store?.profile_id;
  const isOwner = isListingOwnedByActiveProfile(listing, viewerProfileId, storeOwnerId);

  if (listing.status === 'FROZEN' && !isOwner) {
    return { listing: null, isLocked: false, isOwner: false };
  }

  if (listing.status === 'REMOVED') {
    return { listing: null, isLocked: false, isOwner };
  }
  if (listing.status === 'SOLD' && listing.closed_at && Date.now() >= new Date(listing.closed_at).getTime() + 24 * 60 * 60 * 1000) {
    return { listing: null, isLocked: false, isOwner };
  }

  // Owners retain dashboard access; public viewers require a live store subscription.
  if (listing.seller_type === 'CORPORATE') {
    if (!isPublicListingVisible(listing, store, new Date()) && !isOwner) {
      return { listing: null, isLocked: false, isOwner: false };
    }
  }

  // Draft and naturally expired listings remain private. Terminal listings keep a
  // stable public detail page so old links and favorites explain what happened.
  if ((listing.status === 'DRAFT' || (isExpired && listing.status === 'ACTIVE') || listing.status === 'EXPIRED') && !isOwner) {
    return { listing: null, isLocked: false, isOwner: false };
  }

  const favoriteCount = db.favorites.filter((f) => f.listing_id === listing.id).length;
  const isFavorited = (viewerUserId || viewerProfileId)
    ? db.favorites.some((f) => f.listing_id === listing.id && (viewerUserId ? f.user_id === viewerUserId : f.profile_id === viewerProfileId))
    : false;

  // Unauthenticated user -> return safe PublicListingSummary (locked)
  if (!viewerProfileId && !viewerUserId) {
    return {
      listing: {
        ...sanitizeListingForPublic(listing),
        favorite_count: favoriteCount,
        is_favorited: isFavorited,
      },
      isLocked: true,
      isOwner: false,
    };
  }

  // Member user -> return full details with seller info
  if (!db.dealers) {
    db.dealers = [
      {
        id: 'dealer-apex-01',
        profile_id: 'char-mavis-01',
        company_name: 'Apex Motors & Luxury Estates',
        slug: 'apex-motors',
        description: 'Los Santos genelinde lüks otomobil ve seçkin mülk portföyü ile kurumsal hizmet sunuyoruz. Güvenilir ekspertiz ve hızlı devir.',
        logo_url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&auto=format&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=80',
        address: 'Vinewood Boulevard No: 12, Vinewood Hills',
        phone: '555-0192',
        sanmail_email: 'apex.motors@sanmail.com',
        purpose: 'Los Santos genelinde kurumsal otomobil galerisi ve emlak ofisi işletmek.',
        status: 'APPROVED',
        created_at: '2026-09-02T10:00:00Z',
        updated_at: '2026-09-02T10:00:00Z',
      },
    ];
  }

  const seller = db.profiles.find((p) => p.id === listing.seller_profile_id);
  const dealerIdToFind = listing.corporate_profile_id || (seller?.is_dealer ? seller.dealer_id : undefined);
  const dealer = dealerIdToFind
    ? (db.dealers || []).find((d) => (d.id === dealerIdToFind || d.profile_id === seller?.id) && d.status === 'APPROVED')
    : undefined;

  const memberListing: MemberListingDetail = {
    ...listing,
    images: sortListingImages(listing.images),
    seller: redactPrivateContact(seller),
    dealer,
    favorite_count: favoriteCount,
    is_favorited: isFavorited,
    is_locked: false,
  };

  return {
    listing: memberListing,
    isLocked: false,
    isOwner,
  };
}

export async function getListingByPublicId(
  publicId: string,
  viewerProfileId?: string,
  viewerUserId?: string
): Promise<{ listing: PublicListingSummary | MemberListingDetail | null; isLocked: boolean; isOwner: boolean }> {
  if (!isListingPublicId(publicId)) return { listing: null, isLocked: false, isOwner: false };
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getListingByPublicId(publicId, viewerProfileId, viewerUserId);
  }
  const listing = db.listings.find((item) => item.public_id === publicId);
  return listing
    ? getListingById(listing.id, viewerProfileId, viewerUserId)
    : { listing: null, isLocked: false, isOwner: false };
}

function generateUniqueListingPublicId(): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    if (!db.listings.some((listing) => listing.public_id === candidate)) return candidate;
  }
  throw new Error('Benzersiz ilan public ID üretilemedi.');
}

/**
 * Create listing and atomically consume 1 available credit.
 */
export async function createListingWithCredit(
  input: any,
  sellerProfileId: string,
  options: ListingPublishOptions = {}
): Promise<{ success: boolean; listing?: Listing; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().createListing(input, sellerProfileId, options);
  }
  if (input.category !== 'vehicle' && input.category !== 'property') {
    return { success: false, error: 'Desteklenmeyen ilan kategorisi.' };
  }
  const imageLimit = input.category === 'vehicle' ? 3 : 5;
  if (input.images !== undefined && (!Array.isArray(input.images) || input.images.length > imageLimit)) {
    return { success: false, error: `${input.category === 'vehicle' ? 'Araç' : 'Mülk'} ilanlarında en fazla ${imageLimit} fotoğraf kullanılabilir.` };
  }
  const now = new Date();
  const isCorporateRequest = input.seller_type === 'CORPORATE';
  let corporateProfileId: string | undefined = undefined;

  if (isCorporateRequest) {
    const dealer = (db.dealers || []).find(
      (d) => (d.owner_profile_id === sellerProfileId || d.profile_id === sellerProfileId) && d.status === 'APPROVED'
    );
    if (!dealer) {
      return {
        success: false,
        error: 'Kurumsal ilan vermek için onaylı bir kurumsal mağazaya sahip olmalısınız.',
      };
    }
    corporateProfileId = dealer.id;
  }

  const sellerType = corporateProfileId ? 'CORPORATE' : 'INDIVIDUAL';
  const durationDays = sellerType === 'CORPORATE' ? 14 : 7;
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // 1. Find available credit strictly matching the seller_type
  const credit = db.credits.find((c) => {
    if (c.profile_id !== sellerProfileId || c.status !== 'AVAILABLE') return false;
    const packageCode = db.packages.find((pkg) => pkg.id === c.package_id)?.code;
    const effectiveCreditType = c.credit_type || (
      packageCode === 'CORPORATE_14_DAY'
        ? 'CORPORATE'
        : packageCode === 'STANDARD_7_DAY'
          ? 'INDIVIDUAL'
          : undefined
    );
    if (sellerType === 'CORPORATE') {
      return effectiveCreditType === 'CORPORATE' && c.corporate_profile_id === corporateProfileId;
    } else {
      return effectiveCreditType === 'INDIVIDUAL';
    }
  });

  const testBypass = options.paymentMode === 'TEST_BYPASS';
  if (!credit && !testBypass) {
    return {
      success: false,
      error: `${sellerType === 'CORPORATE' ? `Kurumsal ($${CANONICAL_PRICING.CORPORATE_14_DAY.toLocaleString('tr-TR')})` : `Bireysel ($${CANONICAL_PRICING.STANDARD_7_DAY.toLocaleString('tr-TR')})`} ilan yayınlamak için uygun bir ilan hakkınız (krediniz) bulunmuyor.`,
    };
  }
  const newId = `lst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const listingNumber = generateListingNumber(db.listings.length + 1);

  const newListing: Listing = {
    id: newId,
    public_id: generateUniqueListingPublicId(),
    listing_number: listingNumber,
    seller_profile_id: sellerProfileId,
    corporate_profile_id: corporateProfileId,
    seller_type: sellerType,
    category: input.category,
    subcategory: input.subcategory,
    title: input.title,
    description: input.description,
    price: Number(input.price),
    offers_enabled: input.offers_enabled !== false,
    minimum_offer_amount: input.minimum_offer_amount ?? null,
    location: input.category === 'vehicle' ? null : (input.location || null),
    status: 'ACTIVE',
    published_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    images: input.images || [],
    vehicle_details: input.category === 'vehicle' ? {
      listing_id: newId,
      vehicle_category: input.subcategory as VehicleCategory,
      brand: input.brand,
      model: input.model,
      plate: input.plate,
      mileage: Number(input.mileage),
      engine_upgrade: Number(input.engine_upgrade || 0) as any,
      transmission_upgrade: Number(input.transmission_upgrade || 0) as any,
      brake_upgrade: Number(input.brake_upgrade || 0) as any,
      turbo: Boolean(input.turbo),
      subwoofer: Boolean(input.subwoofer),
      trade_available: Boolean(input.trade_available),
      lock_level: input.lock_level !== undefined && input.lock_level !== null ? Number(input.lock_level) : null,
      alarm_level: input.alarm_level !== undefined && input.alarm_level !== null ? Number(input.alarm_level) : null,
      anti_theft_level: input.anti_theft_level !== undefined && input.anti_theft_level !== null ? Number(input.anti_theft_level) : null,
      engine_health: input.engine_health !== undefined && input.engine_health !== null ? Number(input.engine_health) : null,
      suspension: input.subcategory === 'Motosiklet' ? null : (input.suspension || null),
      fuel_type: (input.fuel_type as any) || null,
      factory_price: input.factory_price !== undefined && input.factory_price !== null ? Number(input.factory_price) : null,
    } : undefined,
    property_details: input.category === 'property' ? {
      listing_id: newId,
      property_type: input.subcategory as PropertyType,
      floor: Number(input.floor),
      room_count: input.room_count,
      room_number: Number(input.room_number),
      furnished: Boolean(input.furnished),
      alarm: Boolean(input.alarm),
      market_value: Number(input.market_value),
      furniture_value: input.furnished && input.furniture_value != null ? Number(input.furniture_value) : null,
      building_type: input.building_type || 'Normal',
      balcony: Boolean(input.balcony),
    } : undefined,
  };

  // Atomic consumption of credit
  if (credit) {
    credit.status = 'USED';
    credit.used_listing_id = newId;
    credit.used_at = now.toISOString();
  }

  db.listings.unshift(newListing);

  return { success: true, listing: newListing };
}

/**
 * Edit existing listing. Ownership checked. DOES NOT extend 7 days duration.
 */
export async function updateListing(
  id: string,
  input: any,
  sellerProfileId: string,
  userId?: string,
  role?: string
): Promise<{ success: boolean; listing?: Listing; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().updateListing(id, input, sellerProfileId, userId, role);
  }
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) {
    return { success: false, error: 'İlan bulunamadı.' };
  }

  const store = listing.seller_type === 'CORPORATE' && listing.corporate_profile_id
    ? db.dealers.find((dealer) => dealer.id === listing.corporate_profile_id)
    : undefined;
  const storeOwnerId = store?.owner_profile_id || store?.profile_id;
  if (!isListingOwnedByActiveProfile(listing, sellerProfileId, storeOwnerId)) {
    return { success: false, error: 'Bu ilanı düzenleme yetkiniz yok.' };
  }

  if (listing.status !== 'ACTIVE' && listing.status !== 'FROZEN') {
    return { success: false, error: 'Yalnızca aktif veya dondurulmuş ilanlar düzenlenebilir.' };
  }

  const oldPrice = listing.price;
  const newPrice = Number(input.price);

  listing.title = input.title;
  listing.description = input.description;
  listing.price = newPrice;
  if (input.offers_enabled !== undefined) listing.offers_enabled = Boolean(input.offers_enabled);
  if (input.minimum_offer_amount !== undefined) listing.minimum_offer_amount = input.minimum_offer_amount == null ? null : Number(input.minimum_offer_amount);
  
  // Only property listings have location!
  if (listing.category === 'property') {
    listing.location = input.location || listing.location;
  }
  
  if (input.images) {
    listing.images = input.images;
  }

  if (listing.category === 'vehicle' && listing.vehicle_details) {
    if (input.subcategory) listing.subcategory = input.subcategory;
    if (input.subcategory) listing.vehicle_details.vehicle_category = input.subcategory;
    if (input.brand) listing.vehicle_details.brand = input.brand;
    listing.vehicle_details.model = input.model || listing.vehicle_details.model;
    listing.vehicle_details.plate = input.plate || listing.vehicle_details.plate;
    listing.vehicle_details.mileage = Number(input.mileage ?? listing.vehicle_details.mileage);
    listing.vehicle_details.engine_upgrade = Number(input.engine_upgrade ?? listing.vehicle_details.engine_upgrade) as any;
    listing.vehicle_details.transmission_upgrade = Number(input.transmission_upgrade ?? listing.vehicle_details.transmission_upgrade) as any;
    listing.vehicle_details.brake_upgrade = Number(input.brake_upgrade ?? listing.vehicle_details.brake_upgrade) as any;
    listing.vehicle_details.turbo = Boolean(input.turbo);
    listing.vehicle_details.subwoofer = Boolean(input.subwoofer);
    listing.vehicle_details.trade_available = Boolean(input.trade_available);
    if (input.lock_level !== undefined) listing.vehicle_details.lock_level = input.lock_level !== null ? Number(input.lock_level) : null;
    if (input.alarm_level !== undefined) listing.vehicle_details.alarm_level = input.alarm_level !== null ? Number(input.alarm_level) : null;
    if (input.anti_theft_level !== undefined) listing.vehicle_details.anti_theft_level = input.anti_theft_level !== null ? Number(input.anti_theft_level) : null;
    if (input.engine_health !== undefined) listing.vehicle_details.engine_health = input.engine_health !== null ? Number(input.engine_health) : null;
    if (input.suspension !== undefined || input.subcategory === 'Motosiklet') listing.vehicle_details.suspension = input.subcategory === 'Motosiklet' ? null : (input.suspension || null);
    if (input.fuel_type !== undefined) listing.vehicle_details.fuel_type = (input.fuel_type as any) || null;
    if (input.factory_price !== undefined) listing.vehicle_details.factory_price = input.factory_price !== null ? Number(input.factory_price) : null;
  }

  if (listing.category === 'property' && listing.property_details) {
    if (input.subcategory) listing.subcategory = input.subcategory;
    if (input.property_type) listing.property_details.property_type = input.property_type;
    listing.property_details.floor = Number(input.floor ?? listing.property_details.floor);
    listing.property_details.room_count = input.room_count || listing.property_details.room_count;
    if (input.room_number !== undefined) listing.property_details.room_number = Number(input.room_number);
    listing.property_details.furnished = Boolean(input.furnished);
    if (input.alarm !== undefined) listing.property_details.alarm = Boolean(input.alarm);
    if (input.market_value !== undefined) listing.property_details.market_value = Number(input.market_value);
    listing.property_details.furniture_value = input.furnished && input.furniture_value != null ? Number(input.furniture_value) : null;
    listing.property_details.building_type = input.building_type || listing.property_details.building_type;
    listing.property_details.balcony = Boolean(input.balcony);
  }

  // Preserve published_at and expires_at completely!
  listing.updated_at = new Date().toISOString();

  // Price Change Check & Notification Trigger
  if (newPrice !== oldPrice) {
    await (await import('./repositories')).getOfferRepository().recordListingPriceChange(id, oldPrice, newPrice);
    // 1. Record in price history
    if (!db.priceHistories) db.priceHistories = [];
    db.priceHistories.push({
      id: `lph-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      listing_id: id,
      old_price: oldPrice,
      new_price: newPrice,
      changed_at: new Date().toISOString(),
    });

    // 2. Identify favorited character profiles strictly (Section 13)
    const isDrop = newPrice < oldPrice;
    if (isDrop) {
      const favoritedProfiles = Array.from(
        new Set(
          db.favorites
            .filter((f) => f.listing_id === id && f.profile_id && f.profile_id !== listing.seller_profile_id)
            .map((f) => f.profile_id)
        )
      );

      favoritedProfiles.forEach((pid) => {
        createNotification({
          recipient_profile_id: pid,
          user_id: db.profiles.find((p) => p.id === pid)?.user_id || pid,
          type: 'LISTING_PRICE_DROP',
          title: 'Favori İlanınızın Fiyatı Düştü',
          message: `${listing.title} isimli ilanın fiyatı düştü.`,
          entity_type: 'listing',
          entity_id: listing.id,
          metadata: {
            listingId: listing.id,
            oldPrice,
            newPrice,
          },
        });
      });
    }
  }

  return { success: true, listing };
}

/**
 * Mark listing as SOLD.
 * De-lists immediately while preserving the detail record.
 */
export async function markListingAsSold(
  id: string,
  sellerProfileId: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().markListingAsSold(id, sellerProfileId);
  }
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) return { success: false, error: 'İlan bulunamadı.' };

  const store = listing.corporate_profile_id
    ? db.dealers.find((dealer) => dealer.id === listing.corporate_profile_id)
    : undefined;
  if (!isListingOwnedByActiveProfile(listing, sellerProfileId, store?.owner_profile_id || store?.profile_id)) {
    return { success: false, error: 'Bu işlem için yetkiniz yok.' };
  }

  if (getEffectiveListingStatus(listing) !== 'ACTIVE') {
    return { success: false, error: 'Yalnızca yayındaki ilanlar kapatılabilir.' };
  }

  listing.status = 'SOLD';
  listing.updated_at = new Date().toISOString();
  (listing as Listing & { close_reason?: string; closed_at?: string }).close_reason = 'SOLD';
  (listing as Listing & { close_reason?: string; closed_at?: string }).closed_at = listing.updated_at;
  await (await import('./repositories')).getOfferRepository().closeForListing(id, 'LISTING_SOLD');

  // Store audit record
  db.soldAudits.push({
    id: `audit-${Date.now()}`,
    original_listing_id: id,
    seller_profile_id: sellerProfileId,
    sold_at: new Date().toISOString(),
    title: listing.title,
    price: listing.price,
    description: listing.description,
    closed_at: listing.updated_at,
  });

  return { success: true };
}

/**
 * Remove listing (User delete or Admin delist).
 * Closes the listing without destroying its historical public detail.
 */
export async function removeListing(
  id: string,
  requesterProfileId: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().removeListing ? getSupabaseRepo().removeListing!(id, requesterProfileId) : { success: false, error: 'İşlem desteklenmiyor.' };
  }
  const listing = db.listings.find((l) => l.id === id);
  if (!listing) return { success: false, error: 'İlan bulunamadı.' };

  const store = listing.corporate_profile_id
    ? db.dealers.find((dealer) => dealer.id === listing.corporate_profile_id)
    : undefined;
  if (
    requesterProfileId !== 'SYSTEM_ADMIN' &&
    !isListingOwnedByActiveProfile(listing, requesterProfileId, store?.owner_profile_id || store?.profile_id)
  ) {
    return { success: false, error: 'Bu işlem için yetkiniz yok.' };
  }

  if (listing.status === 'SOLD' || listing.status === 'REMOVED') {
    return { success: false, error: 'İlan zaten kapatılmış.' };
  }

  listing.status = 'REMOVED';
  listing.updated_at = new Date().toISOString();
  listing.close_reason = requesterProfileId === 'SYSTEM_ADMIN' ? 'ADMIN_REMOVED' : 'OTHER';
  listing.closed_at = listing.updated_at;
  listing.images = [];
  db.favorites = db.favorites.filter((favorite) => favorite.listing_id !== id);
  await (await import('./repositories')).getOfferRepository().closeForListing(id, requesterProfileId === 'SYSTEM_ADMIN' ? 'LISTING_REMOVED_BY_ADMIN' : 'LISTING_REMOVED_BY_SELLER');

  return { success: true };
}

/**
 * Get listings owned by a user (Active & Expired) - Strictly individual listings.
 */
export async function getUserListings(sellerProfileId: string): Promise<Listing[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getUserListings(sellerProfileId);
  }
  // Strict separation: Only individual listings owned by the character (Section 8 & 9)
  const listings = db.listings.filter(
    (l) => l.seller_profile_id === sellerProfileId && l.seller_type === 'INDIVIDUAL' && !l.corporate_profile_id
  );
  const now = new Date();
  const profile = db.profiles.find((item) => item.id === sellerProfileId);
  const expiredCutoff = profile?.expired_listing_history_cleared_at ? new Date(profile.expired_listing_history_cleared_at).getTime() : 0;
  const soldCutoff = profile?.sold_listing_history_cleared_at ? new Date(profile.sold_listing_history_cleared_at).getTime() : 0;

  const activeHistory = listings.map((l) => {
    const favCount = db.favorites.filter((f) => f.listing_id === l.id).length;
    return {
      ...l,
      status: getEffectiveListingStatus(l, now),
      favorite_count: favCount,
    };
  });
  const soldHistory = db.soldAudits.filter((audit) => audit.seller_profile_id === sellerProfileId).map((audit) => ({
    id: audit.original_listing_id,
    listing_number: '', seller_profile_id: sellerProfileId, seller_type: 'INDIVIDUAL' as const,
    category: 'vehicle' as const, subcategory: 'Otomobil' as const,
    title: audit.title || 'Satılan ilan', description: audit.description || '', price: audit.price || 0,
    location: null, status: 'SOLD' as const, closed_at: audit.closed_at || audit.sold_at,
    created_at: audit.sold_at, updated_at: audit.closed_at || audit.sold_at,
  }));
  const visibleListings = activeHistory.filter((listing) => {
    if (listing.status === 'ACTIVE') return true;
    if (listing.status === 'SOLD') return new Date(listing.closed_at || listing.updated_at || listing.created_at).getTime() > soldCutoff;
    if (listing.status === 'EXPIRED') return new Date(listing.expires_at || listing.updated_at || listing.created_at).getTime() > expiredCutoff;
    return true;
  });
  const knownIds = new Set(visibleListings.map((listing) => listing.id));
  return [...visibleListings, ...soldHistory.filter((listing) => !knownIds.has(listing.id) && new Date(listing.closed_at || listing.updated_at).getTime() > soldCutoff)];
}

/**
 * Get listings belonging to a corporate store profile.
 */
export async function getCorporateListings(corporateProfileId: string): Promise<Listing[]> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getCorporateListings(corporateProfileId);
  }
  // Strict separation: Only corporate listings belonging to this store (Section 8)
  const listings = db.listings.filter(
    (l) => l.corporate_profile_id === corporateProfileId && l.seller_type === 'CORPORATE'
  );
  const now = new Date();

  return listings.map((l) => {
    const favCount = db.favorites.filter((f) => f.listing_id === l.id).length;
    return {
      ...l,
      status: getEffectiveListingStatus(l, now),
      favorite_count: favCount,
    };
  });
}

/**
 * Toggle favorite on a listing with character-level ownership and self-abuse checks.
 */
export async function toggleFavorite(
  profileId: string,
  listingId: string,
  userIdParam?: string
): Promise<{ isFavorited: boolean; count: number }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().toggleFavorite(listingId, profileId);
  }
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) {
    throw new Error('İlan bulunamadı.');
  }

  const existingIdx = db.favorites.findIndex(
    (f) => f.profile_id === profileId && f.listing_id === listingId
  );
  if (existingIdx < 0) {
    const store = listing.seller_type === 'CORPORATE'
      ? (db.dealers || []).find((dealer) => dealer.id === listing.corporate_profile_id)
      : null;
    if (!isPublicListingVisible(listing, store)) {
      throw new Error('Yayında olmayan ilan favorilere eklenemez.');
    }
  }

  // Self-abuse checks (Section 9)
  // 1. Individual listing owner cannot favorite own listing
  if (listing.seller_profile_id === profileId) {
    throw new Error('Kendi ilanınızı favorilere ekleyemezsiniz.');
  }
  // 2. Corporate store owner cannot favorite own corporate listing
  if (listing.seller_type === 'CORPORATE' || listing.corporate_profile_id) {
    const dealer = (db.dealers || []).find(
      (d) => d.id === listing.corporate_profile_id || d.profile_id === listing.seller_profile_id || d.owner_profile_id === listing.seller_profile_id
    );
    if (dealer && (dealer.owner_profile_id === profileId || dealer.profile_id === profileId)) {
      throw new Error('Sahibi olduğunuz mağazanın ilanını favorilere ekleyemezsiniz.');
    }
  }

  if (existingIdx >= 0) {
    db.favorites.splice(existingIdx, 1);
  } else {
    const profile = db.profiles.find((p) => p.id === profileId);
    const resolvedUser = userIdParam || resolveMockUserId(resolveUserId(profile?.user_id) || profile?.user_id || '');
    db.favorites.push({
      id: `fav-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: resolvedUser,
      profile_id: profileId,
      listing_id: listingId,
      created_at: new Date().toISOString(),
    });
  }

  const count = db.favorites.filter((f) => f.listing_id === listingId).length;
  const isFavorited = existingIdx < 0;

  return { isFavorited, count };
}

export async function republishListing(
  id: string,
  activeProfileId: string
): Promise<{ success: boolean; listing?: Listing; error?: string }> {
  if (isSupabaseConfiguredMode()) return getSupabaseRepo().republishListing(id, activeProfileId);

  const listing = db.listings.find((item) => item.id === id);
  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  if (getEffectiveListingStatus(listing) !== 'EXPIRED') {
    return { success: false, error: 'Yalnızca süresi dolmuş ilanlar yeniden yayınlanabilir.' };
  }

  let creditOwnerId = activeProfileId;
  if (listing.seller_type === 'CORPORATE') {
    const store = (db.dealers || []).find((dealer) => dealer.id === listing.corporate_profile_id);
    if (!store || (store.owner_profile_id || store.profile_id) !== activeProfileId) {
      return { success: false, error: 'Bu kurumsal ilanı yeniden yayınlama yetkiniz yok.' };
    }
    if (store.status !== 'APPROVED' || store.moderation_status !== 'ACTIVE' ||
        store.subscription_status !== 'ACTIVE' || !store.subscription_expires_at ||
        new Date(store.subscription_expires_at) <= new Date()) {
      return { success: false, error: 'Kurumsal mağaza yeniden yayınlamaya uygun değil.' };
    }
    creditOwnerId = store.owner_profile_id || activeProfileId;
  } else if (listing.seller_profile_id !== activeProfileId) {
    return { success: false, error: 'Bu ilanı yeniden yayınlama yetkiniz yok.' };
  }

  const credit = db.credits.find((item) =>
    item.profile_id === creditOwnerId &&
    item.status === 'AVAILABLE' &&
    item.credit_type === (listing.seller_type === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL') &&
    (listing.seller_type !== 'CORPORATE' || item.corporate_profile_id === listing.corporate_profile_id)
  );
  if (!credit) return { success: false, error: 'Uygun yayın hakkı bulunamadı.' };

  const now = new Date();
  const durationDays = listing.seller_type === 'CORPORATE' ? 14 : 7;
  credit.status = 'USED';
  credit.used_listing_id = listing.id;
  credit.used_at = now.toISOString();
  listing.status = 'ACTIVE';
  listing.published_at = now.toISOString();
  listing.expires_at = new Date(now.getTime() + durationDays * 86400000).toISOString();
  listing.is_featured = false;
  listing.featured_until = null;
  listing.updated_at = now.toISOString();
  return { success: true, listing };
}

/**
 * Get user's favorited listings strictly by character profile_id.
 */
export async function getUserFavorites(
  profileId?: string,
  userIdParam?: string
): Promise<(Listing & { isExpired: boolean })[]> {
  const safeProfileId = profileId || userIdParam;
  if (!safeProfileId) return [];

  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().getUserFavorites(safeProfileId);
  }

  const favListingIds = db.favorites
    .filter((f) => f.profile_id === safeProfileId)
    .map((f) => f.listing_id);

  const now = new Date();
  const listings = db.listings.filter((l) => favListingIds.includes(l.id));

  return listings.map((l) => {
    const isExpired = l.expires_at ? new Date(l.expires_at) <= now : false;
    const favCount = db.favorites.filter((f) => f.listing_id === l.id).length;
    return {
      ...l,
      isExpired,
      favorite_count: favCount,
      is_favorited: true,
    };
  });
}

/**
 * Report a listing.
 */
export async function reportListing(
  reporterProfileId: string,
  listingId: string,
  reason: ReportReason,
  description: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    if (!isUuid(reporterProfileId) || !isUuid(listingId)) {
      return { success: false, error: 'Geçersiz profil veya ilan kimliği.' };
    }

    const client = getSupabaseAdminClient();
    if (!client) {
      return { success: false, error: 'Şikayet servisi yapılandırılmamış.' };
    }

    const { data: listing, error: listingError } = await client
      .from('listings')
      .select('id')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) {
      return { success: false, error: listingError.message || 'İlan doğrulanamadı.' };
    }
    if (!listing) {
      return { success: false, error: 'Şikayet edilecek ilan bulunamadı.' };
    }

    const { data, error } = await client
      .from('reports')
      .insert({
        reporter_profile_id: reporterProfileId,
        listing_id: listing.id,
        reason,
        description,
        status: 'PENDING',
      })
      .select('id, reporter_profile_id, listing_id, reason, description, status, created_at')
      .single();

    if (error) {
      return { success: false, error: error.message || 'Şikayet kaydedilemedi.' };
    }
    if (!data?.id) {
      return { success: false, error: 'Şikayet kaydı doğrulanamadı.' };
    }

    return { success: true };
  }

  if (!db.profiles.some((profile) => profile.id === reporterProfileId)) {
    return { success: false, error: 'Aktif karakter profili bulunamadı.' };
  }
  if (!db.listings.some((listing) => listing.id === listingId)) {
    return { success: false, error: 'Şikayet edilecek ilan bulunamadı.' };
  }

  db.reports.push({
    id: `rep-${Date.now()}`,
    reporter_profile_id: reporterProfileId,
    listing_id: listingId,
    reason,
    description,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  });
  return { success: true };
}
