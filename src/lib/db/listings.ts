import { db } from './store';
import {
  Listing,
  ListingCategory,
  MemberListingDetail,
  PublicListingSummary,
  VehicleCategory,
  PropertyType,
} from '@/types';
import { generateListingNumber } from '../utils/format';
import { createNotification } from './notifications';
import { SupabaseListingRepository } from './repositories/supabase/supabase-listing-repo';
import { deleteMediaSafely } from '../storage/lifecycle';
import { extractMediaKey } from '../media/url';
import { resolveUserId } from './id-mapper';

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
  // Property specific
  roomCount?: string;
  furnished?: 'all' | 'yes' | 'no';
  balcony?: 'all' | 'yes' | 'no';
  buildingType?: 'all' | 'Normal' | 'Dubleks';
  floor?: number;
  // Sorting
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

/**
 * Strips all member-only private details from a listing object.
 * Returns only public-safe fields.
 */
export function sanitizeListingForPublic(listing: Listing): PublicListingSummary {
  const coverImg = listing.images?.find((i) => i.is_cover)?.storage_path || listing.images?.[0]?.storage_path;
  const favCount = db.favorites.filter((f) => f.listing_id === listing.id).length;
  const now = new Date();
  const isFeatured = Boolean(
    listing.is_featured &&
    (!listing.featured_until || new Date(listing.featured_until) > now)
  );

  return {
    id: listing.id,
    listing_number: listing.listing_number,
    category: listing.category,
    subcategory: listing.subcategory,
    title: listing.title,
    price: listing.price,
    location: listing.location,
    published_at: listing.published_at,
    cover_image: coverImg,
    favorite_count: favCount,
    is_locked: true,
    is_featured: isFeatured,
    featured_until: listing.featured_until,
    seller_type: listing.seller_type,
    corporate_profile_id: listing.corporate_profile_id,
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
    if (l.status !== 'ACTIVE') return false;
    if (!l.expires_at) return false;
    const expiry = new Date(l.expires_at);
    return expiry > now;
  });

  // Filter out corporate listings from suspended or deleted stores (Section 14 & 16)
  result = result.filter((l) => {
    if (l.seller_type === 'CORPORATE' && l.corporate_profile_id) {
      const store = (db.dealers || []).find((d) => d.id === l.corporate_profile_id);
      if (store && (store.moderation_status === 'SUSPENDED' || store.moderation_status === 'DELETED')) {
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

  // 8. Property filters
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

  // 9. Sorting (Featured listings always appear first!)
  const getFavCount = (id: string) => db.favorites.filter((f) => f.listing_id === id).length;

  result.sort((a, b) => {
    const aFeatured = Boolean(a.is_featured && (!a.featured_until || new Date(a.featured_until) > now));
    const bFeatured = Boolean(b.is_featured && (!b.featured_until || new Date(b.featured_until) > now));

    if (aFeatured !== bFeatured) {
      return aFeatured ? -1 : 1;
    }

    switch (filters.sort) {
      case 'price_asc':
        return a.price - b.price;
      case 'price_desc':
        return b.price - a.price;
      case 'popular':
        return getFavCount(b.id) - getFavCount(a.id);
      case 'newest':
      default:
        return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
    }
  });

  return result.map(sanitizeListingForPublic);
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
  const isOwner = Boolean(viewerProfileId && listing.seller_profile_id === viewerProfileId);

  // Check store moderation state for corporate listings
  if (listing.seller_type === 'CORPORATE' && listing.corporate_profile_id) {
    const store = (db.dealers || []).find((d) => d.id === listing.corporate_profile_id);
    if (store && (store.moderation_status === 'SUSPENDED' || store.moderation_status === 'DELETED') && !isOwner) {
      return { listing: null, isLocked: false, isOwner: false };
    }
  }

  // If expired or sold and not owner, it should not be accessible
  if ((isExpired || listing.status === 'SOLD') && !isOwner) {
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
        purpose: 'San Andreas genelinde kurumsal otomobil galerisi ve emlak ofisi işletmek.',
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
    seller,
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

/**
 * Create listing and atomically consume 1 available credit.
 */
export async function createListingWithCredit(
  input: any,
  sellerProfileId: string
): Promise<{ success: boolean; listing?: Listing; error?: string }> {
  if (isSupabaseConfiguredMode()) {
    return getSupabaseRepo().createListing(input, sellerProfileId);
  }
  const now = new Date();
  const sellerProfile = db.profiles.find((p) => p.id === sellerProfileId);
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
    if (sellerType === 'CORPORATE') {
      return c.credit_type === 'CORPORATE' || c.amount === 1750;
    } else {
      return (c.credit_type === 'INDIVIDUAL' || (!c.credit_type && c.amount !== 1750));
    }
  });

  if (!credit) {
    return {
      success: false,
      error: `${sellerType === 'CORPORATE' ? 'Kurumsal ($1.750)' : 'Bireysel ($2.000)'} ilan yayınlamak için uygun bir ilan hakkınız (krediniz) bulunmuyor.`,
    };
  }
  const newId = `lst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const listingNumber = generateListingNumber(db.listings.length + 1);

  const newListing: Listing = {
    id: newId,
    listing_number: listingNumber,
    seller_profile_id: sellerProfileId,
    corporate_profile_id: corporateProfileId,
    seller_type: sellerType,
    category: input.category,
    subcategory: input.subcategory,
    title: input.title,
    description: input.description,
    price: Number(input.price),
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
      suspension: input.suspension || null,
      fuel_type: (input.fuel_type as any) || null,
      factory_price: input.factory_price !== undefined && input.factory_price !== null ? Number(input.factory_price) : null,
    } : undefined,
    property_details: input.category === 'property' ? {
      listing_id: newId,
      property_type: input.subcategory as PropertyType,
      floor: Number(input.floor),
      room_count: input.room_count,
      furnished: Boolean(input.furnished),
      building_type: input.building_type || 'Normal',
      balcony: Boolean(input.balcony),
    } : undefined,
  };

  // Atomic consumption of credit
  credit.status = 'USED';
  credit.used_listing_id = newId;
  credit.used_at = now.toISOString();

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

  if (listing.seller_profile_id !== sellerProfileId) {
    return { success: false, error: 'Bu ilanı düzenleme yetkiniz yok.' };
  }

  if (listing.status !== 'ACTIVE') {
    return { success: false, error: 'Yalnızca aktif ilanlar düzenlenebilir.' };
  }

  const oldPrice = listing.price;
  const newPrice = Number(input.price);

  listing.title = input.title;
  listing.description = input.description;
  listing.price = newPrice;
  
  // Only property listings have location!
  if (listing.category === 'property') {
    listing.location = input.location || listing.location;
  }
  
  if (input.images) {
    listing.images = input.images;
  }

  if (listing.category === 'vehicle' && listing.vehicle_details) {
    if (input.subcategory) listing.subcategory = input.subcategory;
    if (input.vehicle_category) listing.vehicle_details.vehicle_category = input.vehicle_category;
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
    if (input.suspension !== undefined) listing.vehicle_details.suspension = input.suspension || null;
    if (input.fuel_type !== undefined) listing.vehicle_details.fuel_type = (input.fuel_type as any) || null;
    if (input.factory_price !== undefined) listing.vehicle_details.factory_price = input.factory_price !== null ? Number(input.factory_price) : null;
  }

  if (listing.category === 'property' && listing.property_details) {
    if (input.subcategory) listing.subcategory = input.subcategory;
    if (input.property_type) listing.property_details.property_type = input.property_type;
    listing.property_details.floor = Number(input.floor ?? listing.property_details.floor);
    listing.property_details.room_count = input.room_count || listing.property_details.room_count;
    listing.property_details.furnished = Boolean(input.furnished);
    listing.property_details.building_type = input.building_type || listing.property_details.building_type;
    listing.property_details.balcony = Boolean(input.balcony);
  }

  // Preserve published_at and expires_at completely!
  listing.updated_at = new Date().toISOString();

  // Price Change Check & Notification Trigger
  if (newPrice !== oldPrice) {
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
 * De-lists immediately, purges images, removes favorites, stores audit record.
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

  if (listing.seller_profile_id !== sellerProfileId) {
    return { success: false, error: 'Bu işlem için yetkiniz yok.' };
  }

  listing.status = 'SOLD';
  const mediaKeys = [...(listing.images || [])];
  listing.images = []; // Purge images from listing
  listing.updated_at = new Date().toISOString();

  // Clean up favorites
  db.favorites = db.favorites.filter((f) => f.listing_id !== id);

  // Store audit record
  db.soldAudits.push({
    id: `audit-${Date.now()}`,
    original_listing_id: id,
    seller_profile_id: sellerProfileId,
    sold_at: new Date().toISOString(),
  });

  // Clean up media through lifecycle with retry queue
  for (const imgItem of mediaKeys) {
    try {
      const imgUrl = (imgItem as any)?.storage_path || (typeof imgItem === 'string' ? imgItem : '');
      const key = extractMediaKey(imgUrl);
      if (key) {
        await deleteMediaSafely(key, listing.category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE', 'LISTING_SOLD');
      }
    } catch {}
  }

  return { success: true };
}

/**
 * Remove listing (User delete or Admin delist).
 * Parity with SOLD media lifecycle cleanup.
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

  if (requesterProfileId !== 'SYSTEM_ADMIN' && listing.seller_profile_id !== requesterProfileId) {
    return { success: false, error: 'Bu işlem için yetkiniz yok.' };
  }

  listing.status = 'REMOVED';
  const mediaKeys = [...(listing.images || [])];
  listing.images = [];
  listing.updated_at = new Date().toISOString();

  // Clean up favorites
  db.favorites = db.favorites.filter((f) => f.listing_id !== id);

  // Clean up media through lifecycle with retry queue (REMOVED flow parity)
  for (const imgItem of mediaKeys) {
    try {
      const imgUrl = (imgItem as any)?.storage_path || (typeof imgItem === 'string' ? imgItem : '');
      const key = extractMediaKey(imgUrl);
      if (key) {
        await deleteMediaSafely(key, listing.category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE', 'LISTING_REMOVED');
      }
    } catch {}
  }

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

  return listings.map((l) => {
    const isExpired = l.expires_at ? new Date(l.expires_at) <= now : false;
    const favCount = db.favorites.filter((f) => f.listing_id === l.id).length;
    return {
      ...l,
      status: l.status === 'ACTIVE' && isExpired ? 'EXPIRED' : l.status,
      favorite_count: favCount,
    };
  });
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
    const isExpired = l.expires_at ? new Date(l.expires_at) <= now : false;
    const favCount = db.favorites.filter((f) => f.listing_id === l.id).length;
    return {
      ...l,
      status: l.status === 'ACTIVE' && isExpired ? 'EXPIRED' : l.status,
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

  const existingIdx = db.favorites.findIndex(
    (f) => f.profile_id === profileId && f.listing_id === listingId
  );

  if (existingIdx >= 0) {
    db.favorites.splice(existingIdx, 1);
  } else {
    const profile = db.profiles.find((p) => p.id === profileId);
    const resolvedUser = userIdParam || resolveUserId(profile?.user_id) || profile?.user_id;
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
    };
  });
}

/**
 * Report a listing.
 */
export async function reportListing(
  reporterProfileId: string,
  listingId: string,
  reason: any,
  description: string
): Promise<{ success: boolean; error?: string }> {
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
