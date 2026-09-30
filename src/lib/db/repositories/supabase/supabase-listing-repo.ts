import { IListingRepository, CreateListingInput, ListingPublishOptions } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Listing, MemberListingDetail, PublicListingSummary, SimilarListingSummary } from '@/types';
import { ListingFilterParams } from '../../listings';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { resolveUserId, resolveProfileId, isUuid } from '../../id-mapper';
import { getEffectiveListingStatus } from '@/lib/listings/visibility';
import { getListingCoverPath, sortListingImages } from '@/lib/listings/images';
import { isListingPublicId } from '@/lib/urls';
import { redactPrivateContact } from '@/lib/profiles/contact-privacy';
import { sortPublicListings } from '@/lib/listings/public-sort';
import { clampSimilarListingsLimit, rankSimilarListings } from '@/lib/listings/similarity';

export function isPublicCorporateListingVisible(item: any): boolean {
  if (item.seller_type !== 'CORPORATE') return true;
  if (!item.corporate_profile_id || !item.corporate) return false;

  const corporate = Array.isArray(item.corporate) ? item.corporate[0] : item.corporate;
  if (!corporate) return false;

  return (
    corporate.moderation_status === 'ACTIVE' &&
    corporate.subscription_status === 'ACTIVE' &&
    Boolean(corporate.subscription_expires_at) &&
    new Date(corporate.subscription_expires_at).getTime() > Date.now() &&
    !corporate.deleted_at
  );
}

export function getSimilarPriceRange(
  price: number | string | bigint
): { minPrice: number | string; maxPrice: number | string } {
  let integerPrice: bigint;
  try {
    integerPrice = typeof price === 'number'
      ? BigInt(Math.max(0, Math.trunc(price)))
      : BigInt(price);
  } catch {
    integerPrice = BigInt(0);
  }
  if (integerPrice < BigInt(0)) integerPrice = BigInt(0);

  const minPrice = (integerPrice * BigInt(3)) / BigInt(5);
  const maxPrice = (integerPrice * BigInt(7) + BigInt(4)) / BigInt(5);
  const safeBoundary = (value: bigint) => value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();

  return {
    minPrice: safeBoundary(minPrice),
    maxPrice: safeBoundary(maxPrice),
  };
}

export class SupabaseListingRepository implements IListingRepository {
  private isPublicCorporateListingVisible(item: any): boolean {
    return isPublicCorporateListingVisible(item);
  }

  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in environment variables.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (admin) return admin;
    return this.getClient();
  }

  /**
   * Resolves account user ID either from given userId or by looking up character profile in Supabase.
   */
  private async resolveAccountUserId(userId?: string, profileId?: string): Promise<string | null> {
    if (userId) {
      const mapped = resolveUserId(userId);
      if (isUuid(mapped)) return mapped;
    }

    if (profileId) {
      const safeProfileId = resolveProfileId(profileId);
      if (isUuid(safeProfileId)) {
        const client = this.getAdminClient();
        const { data: prof } = await client
          .from('character_profiles')
          .select('user_id')
          .eq('id', safeProfileId)
          .maybeSingle();

        if (prof?.user_id && isUuid(prof.user_id)) {
          return prof.user_id;
        }
      }
    }

    return null;
  }

  /**
   * Resolves character profile ID either from given profileId or by finding a profile for userId.
   */
  private async resolveCharacterProfileId(profileId?: string, userId?: string): Promise<string | null> {
    if (profileId) {
      const safeProfileId = resolveProfileId(profileId);
      if (isUuid(safeProfileId)) return safeProfileId;
    }

    if (userId) {
      const safeUserId = resolveUserId(userId);
      if (isUuid(safeUserId)) {
        const client = this.getAdminClient();
        const { data: prof } = await client
          .from('character_profiles')
          .select('id')
          .eq('user_id', safeUserId)
          .limit(1)
          .maybeSingle();

        if (prof?.id && isUuid(prof.id)) {
          return prof.id;
        }
      }
    }

    return null;
  }

  async getPublicListings(params?: ListingFilterParams): Promise<PublicListingSummary[]> {
    const client = this.getClient();

    let query = client
      .from('listings')
      .select(`
        id,
        public_id,
        listing_number,
        category,
        subcategory,
        title,
        description,
        price,
        location,
        published_at,
        is_featured,
        featured_until,
        seller_type,
        corporate_profile_id,
        corporate:corporate_profiles (moderation_status, deleted_at, subscription_status, subscription_expires_at),
        vehicle_details (brand, model, mileage, turbo, subwoofer, trade_available),
        property_details (room_count, furnished, market_value, furniture_value, building_type, balcony),
        listing_images (storage_path, is_cover, sort_order)
      `)
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString());

    if (params?.category) query = query.eq('category', params.category);
    if (params?.subcategory && params.subcategory !== 'all') query = query.eq('subcategory', params.subcategory);
    if (params?.minPrice !== undefined) query = query.gte('price', params.minPrice);
    if (params?.maxPrice !== undefined) query = query.lte('price', params.maxPrice);
    if (params?.location && params.location !== 'all') {
      query = query.ilike('location', `%${params.location}%`);
    }

    let { data, error } = await query;

    // Defensive fallback if columns from pending migrations are not yet present on remote DB before migration execution
    if (error && (error.message?.includes('public_id') || error.message?.includes('is_featured') || error.message?.includes('seller_type') || error.message?.includes('moderation_status'))) {
      let fallbackQuery = client
        .from('listings')
        .select(`
          id,
          listing_number,
          category,
          subcategory,
          title,
          description,
          price,
          location,
          published_at,
          listing_images (storage_path, is_cover, sort_order)
        `)
        .eq('status', 'ACTIVE')
        .gt('expires_at', new Date().toISOString());

      if (params?.category) fallbackQuery = fallbackQuery.eq('category', params.category);
      if (params?.subcategory && params.subcategory !== 'all') fallbackQuery = fallbackQuery.eq('subcategory', params.subcategory);
      if (params?.minPrice !== undefined) fallbackQuery = fallbackQuery.gte('price', params.minPrice);
      if (params?.maxPrice !== undefined) fallbackQuery = fallbackQuery.lte('price', params.maxPrice);
      if (params?.location && params.location !== 'all') fallbackQuery = fallbackQuery.ilike('location', `%${params.location}%`);

      const retryRes = await fallbackQuery;
      data = retryRes.data as any;
      error = retryRes.error;
    }

    if (error) {
      throw new Error(`Supabase error fetching public listings: ${error.message}`);
    }

    const rows = data || [];
    const listingIds = rows.map((r: any) => r.id);

    // Batch query favorite counts and price histories
    const priceHistoryMap: Record<string, number> = {};
    const favCountMap: Record<string, number> = {};

    if (listingIds.length > 0) {
      const adminClient = this.getAdminClient();
      const [histRes, favRes] = await Promise.all([
        adminClient
          .from('listing_price_history')
          .select('listing_id, old_price, changed_at')
          .in('listing_id', listingIds)
          .order('changed_at', { ascending: false }),
        adminClient
          .from('favorites')
          .select('listing_id')
          .in('listing_id', listingIds),
      ]);

      if (histRes.data) {
        for (const h of histRes.data) {
          if (!priceHistoryMap[h.listing_id]) {
            priceHistoryMap[h.listing_id] = h.old_price;
          }
        }
      }

      if (favRes.data) {
        for (const f of favRes.data) {
          favCountMap[f.listing_id] = (favCountMap[f.listing_id] || 0) + 1;
        }
      }
    }

    const filteredRows = (rows || []).filter((item: any) => {
      if (!this.isPublicCorporateListingVisible(item)) return false;
      const vehicle = Array.isArray(item.vehicle_details) ? item.vehicle_details[0] : item.vehicle_details;
      const property = Array.isArray(item.property_details) ? item.property_details[0] : item.property_details;
      const normalizedQuery = params?.query?.trim().toLocaleLowerCase('tr-TR');

      if (normalizedQuery && ![item.title, vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedQuery))) return false;
      if (params?.brand && params.brand !== 'all' && vehicle?.brand?.toLocaleLowerCase('tr-TR') !== params.brand.toLocaleLowerCase('tr-TR')) return false;
      if (params?.model && params.model !== 'all' && vehicle?.model?.toLocaleLowerCase('tr-TR') !== params.model.toLocaleLowerCase('tr-TR')) return false;
      if (params?.minMileage !== undefined && (!Number.isFinite(Number(vehicle?.mileage)) || Number(vehicle.mileage) < params.minMileage)) return false;
      if (params?.maxMileage !== undefined && (!Number.isFinite(Number(vehicle?.mileage)) || Number(vehicle.mileage) > params.maxMileage)) return false;
      if (params?.turbo && params.turbo !== 'all' && Boolean(vehicle?.turbo) !== (params.turbo === 'yes')) return false;
      if (params?.subwoofer && params.subwoofer !== 'all' && Boolean(vehicle?.subwoofer) !== (params.subwoofer === 'yes')) return false;
      if (params?.trade && params.trade !== 'all' && Boolean(vehicle?.trade_available) !== (params.trade === 'yes')) return false;
      if (params?.sellerType && params.sellerType !== 'all' && (item.seller_type || 'INDIVIDUAL') !== params.sellerType) return false;
      if (params?.roomCount && params.roomCount !== 'all' && property?.room_count !== params.roomCount) return false;
      if (params?.furnished && params.furnished !== 'all' && Boolean(property?.furnished) !== (params.furnished === 'yes')) return false;
      if (params?.balcony && params.balcony !== 'all' && Boolean(property?.balcony) !== (params.balcony === 'yes')) return false;
      if (params?.buildingType && params.buildingType !== 'all' && property?.building_type !== params.buildingType) return false;
      return true;
    });

    const nowTime = Date.now();
    const listings = filteredRows.map((item: any) => {
      const cover = getListingCoverPath(item.listing_images);
      const prevPrice = priceHistoryMap[item.id];
      const isFeatured = Boolean(
        item.is_featured &&
        (!item.featured_until || new Date(item.featured_until).getTime() > nowTime)
      );

      return {
        id: item.id,
        public_id: item.public_id,
        listing_number: item.listing_number,
        category: item.category,
        subcategory: item.subcategory,
        title: item.title,
        description: item.description,
        price: item.price,
        previous_price: prevPrice && prevPrice !== item.price ? prevPrice : undefined,
        location: item.category === 'vehicle' ? null : item.location,
        published_at: item.published_at,
        cover_image: cover,
        favorite_count: favCountMap[item.id] || 0,
        is_locked: true as const,
        is_featured: isFeatured,
        featured_until: item.featured_until,
        seller_type: item.seller_type,
        corporate_profile_id: item.corporate_profile_id,
        brand: (Array.isArray(item.vehicle_details) ? item.vehicle_details[0] : item.vehicle_details)?.brand,
        model: (Array.isArray(item.vehicle_details) ? item.vehicle_details[0] : item.vehicle_details)?.model,
      };
    });

    return sortPublicListings(listings, params?.sort);
  }
  async getCompareListings(ids: string[]): Promise<(Listing | null)[]> {
    if (!ids || ids.length === 0) return [];

    const validUuids = ids.filter(isUuid);
    if (validUuids.length === 0) {
      return ids.map(() => null);
    }

    const client = this.getClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await client
      .from('listings')
      .select(`
        *,
        vehicle_details (*),
        listing_images (*),
        corporate:corporate_profiles (*)
      `)
      .in('id', validUuids)
      .eq('status', 'ACTIVE')
      .gt('expires_at', nowIso)
      .eq('category', 'vehicle');

    if (error) throw new Error(`Supabase error fetching compare listings: ${error.message}`);

    const rows = data || [];
    const listingMap = new Map<string, Listing>();

    for (const item of rows) {
      // Exclude listings from suspended/deleted corporate stores
      if (!this.isPublicCorporateListingVisible(item)) continue;

      const vd = Array.isArray(item.vehicle_details) ? item.vehicle_details[0] : item.vehicle_details;
      const listingObj: Listing = {
        ...item,
        vehicle_details: vd || undefined,
        images: item.listing_images || [],
        location: null,
      };

      listingMap.set(item.id, listingObj);
    }

    return ids.map((id) => listingMap.get(id) || null);
  }

  async getPropertyCompareListings(ids: string[]): Promise<(Listing | null)[]> {
    if (!ids.length) return [];
    const validUuids = ids.filter(isUuid);
    if (!validUuids.length) return ids.map(() => null);

    const { data, error } = await this.getClient()
      .from('listings')
      .select(`
        *,
        property_details (*),
        listing_images (*),
        seller:character_profiles (id, full_name, avatar_url),
        corporate:corporate_profiles (*)
      `)
      .in('id', validUuids)
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString())
      .eq('category', 'property');

    if (error) throw new Error(`Supabase error fetching property compare listings: ${error.message}`);

    const listingMap = new Map<string, Listing>();
    for (const item of data || []) {
      if (!this.isPublicCorporateListingVisible(item)) continue;
      listingMap.set(item.id, {
        ...item,
        property_details: Array.isArray(item.property_details) ? item.property_details[0] : item.property_details,
        images: item.listing_images || [],
        seller: Array.isArray(item.seller) ? item.seller[0] : item.seller,
        dealer: Array.isArray(item.corporate) ? item.corporate[0] : item.corporate,
      });
    }
    return ids.map((id) => listingMap.get(id) || null);
  }

  async getSimilarListings(currentListingId: string, limit: number = 10): Promise<SimilarListingSummary[]> {
    if (!isUuid(currentListingId)) return [];

    const client = this.getClient();
    const nowIso = new Date().toISOString();
    const boundedLimit = clampSimilarListingsLimit(limit);
    if (boundedLimit === 0) return [];

    const { data: current, error: curErr } = await client
      .from('listings')
      .select(`
        id,
        category,
        subcategory,
        price,
        status,
        expires_at,
        seller_type,
        corporate_profile_id,
        corporate:corporate_profiles (moderation_status, deleted_at, subscription_status, subscription_expires_at),
        vehicle_details (brand, model)
      `)
      .eq('id', currentListingId)
      .maybeSingle();

    if (curErr) throw new Error(`Supabase error fetching current similar listing: ${curErr.message}`);
    if (
      !current ||
      current.status !== 'ACTIVE' ||
      !current.expires_at ||
      new Date(current.expires_at).getTime() <= Date.now() ||
      !this.isPublicCorporateListingVisible(current)
    ) return [];

    const candidateSelect = `
        id,
        public_id,
        listing_number,
        category,
        subcategory,
        title,
        price,
        location,
        published_at,
        created_at,
        seller_type,
        corporate_profile_id,
        corporate:corporate_profiles (moderation_status, deleted_at, subscription_status, subscription_expires_at),
        vehicle_details (brand, model),
        listing_images (storage_path, is_cover, sort_order)
      `;

    const currentPrice = current.price || 1;
    const { minPrice, maxPrice } = getSimilarPriceRange(currentPrice);
    const currentVeh = Array.isArray(current.vehicle_details) ? current.vehicle_details[0] : current.vehicle_details;
    const currentBrand = currentVeh?.brand?.toLowerCase().trim();
    const currentModel = currentVeh?.model?.toLowerCase().trim();
    const currentSubcategory = current.subcategory;

    const createCandidateQuery = () => client
      .from('listings')
      .select(candidateSelect)
      .eq('status', 'ACTIVE')
      .gt('expires_at', nowIso)
      .eq('category', current.category)
      .eq('subcategory', currentSubcategory)
      .neq('id', currentListingId);

    const candidateQueries: PromiseLike<any>[] = [
      // The primary pool is deliberately brand/model agnostic. Supplemental
      // lookups below may recover strong matches, but never replace this broad
      // canonical-category pool.
      createCandidateQuery()
        .order('published_at', { ascending: false })
        .limit(100),
      createCandidateQuery()
        .gte('price', minPrice)
        .lte('price', maxPrice)
        .order('published_at', { ascending: false })
        .limit(100),
    ];

    const detailQueries: PromiseLike<any>[] = [];
    if (current.category === 'vehicle' && currentBrand) {
      detailQueries.push(client.from('vehicle_details').select('listing_id').ilike('brand', currentBrand).limit(30));
    }
    if (current.category === 'vehicle' && currentModel) {
      detailQueries.push(client.from('vehicle_details').select('listing_id').ilike('model', currentModel).limit(30));
    }

    const detailResults = await Promise.all(detailQueries);
    for (const result of detailResults) {
      if (result.error) throw new Error(`Supabase error selecting similar vehicle details: ${result.error.message}`);
      const listingIds = (result.data || [])
        .map((detail: any) => detail.listing_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id !== currentListingId);
      if (listingIds.length > 0) {
        candidateQueries.push(
          createCandidateQuery()
            .in('id', listingIds)
            .order('published_at', { ascending: false })
            .limit(30)
        );
      }
    }

    const candidateResults = await Promise.all(candidateQueries);
    const candidateMap = new Map<string, any>();
    for (const result of candidateResults) {
      if (result.error) throw new Error(`Supabase error fetching similar listing candidates: ${result.error.message}`);
      for (const candidate of result.data || []) candidateMap.set(candidate.id, candidate);
    }

    const validCandidates = Array.from(candidateMap.values()).filter((item) => (
      item.category === current.category &&
      item.subcategory === currentSubcategory &&
      this.isPublicCorporateListingVisible(item)
    ));

    const selected = rankSimilarListings(
      {
        id: current.id,
        category: current.category,
        subcategory: currentSubcategory,
        price: current.price,
        brand: currentVeh?.brand,
        model: currentVeh?.model,
      },
      validCandidates.map((cand: any) => {
        const candVeh = Array.isArray(cand.vehicle_details) ? cand.vehicle_details[0] : cand.vehicle_details;
        return { ...cand, brand: candVeh?.brand, model: candVeh?.model };
      }),
      boundedLimit
    );

    return selected.map((cand) => {
      const cover = getListingCoverPath(cand.listing_images);

      return {
        id: cand.id,
        public_id: cand.public_id,
        category: cand.category,
        subcategory: cand.subcategory,
        title: cand.title,
        price: Number(cand.price),
        location: cand.location,
        published_at: cand.published_at,
        cover_image: cover,
        brand: cand.brand,
        model: cand.model,
      };
    });
  }


  async getListingById(
    id: string,
    viewerProfileId?: string,
    viewerUserId?: string
  ): Promise<{ listing: MemberListingDetail | PublicListingSummary | null; isLocked: boolean; isOwner: boolean }> {
    if (!isUuid(id)) {
      return { listing: null, isLocked: false, isOwner: false };
    }

    const client = this.getClient();

    const { data: listing, error } = await client
      .from('listings')
      .select(`
        *,
        vehicle_details (*),
        property_details (*),
        listing_images (*),
        seller:character_profiles (*),
        corporate:corporate_profiles (*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase error fetching listing by id: ${error.message}`);
    }

    if (!listing) {
      return { listing: null, isLocked: false, isOwner: false };
    }

    if (listing.status === 'REMOVED') return { listing: null, isLocked: false, isOwner: false };
    if (listing.status === 'SOLD' && listing.closed_at && Date.now() >= new Date(listing.closed_at).getTime() + 24 * 60 * 60 * 1000) {
      return { listing: null, isLocked: false, isOwner: false };
    }

    // Resolve viewer identity
    const safeViewerProfileId = viewerProfileId ? resolveProfileId(viewerProfileId) : null;

    let isOwner = false;
    if (safeViewerProfileId) {
      const isCorporate = listing.seller_type === 'CORPORATE' || Boolean(listing.corporate_profile_id);
      if (isCorporate) {
        const storeOwnerId = listing.corporate?.owner_profile_id;
        isOwner = Boolean(storeOwnerId && storeOwnerId === safeViewerProfileId);
      } else {
        isOwner = Boolean(listing.seller_profile_id === safeViewerProfileId);
      }
    }

    // Owners retain dashboard access; public viewers require a live store subscription.
    if (listing.seller_type === 'CORPORATE') {
      if (!this.isPublicCorporateListingVisible(listing) && !isOwner) {
        return { listing: null, isLocked: false, isOwner: false };
      }
    }

    // Fetch favorite count and character favorite status using adminClient so RLS does not zero-out counts
    const adminClient = this.getAdminClient();
    const [favCountRes, userFavRes, histRes] = await Promise.all([
      adminClient.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', id),
      safeViewerProfileId
        ? adminClient.from('favorites').select('id').eq('listing_id', id).eq('profile_id', safeViewerProfileId).maybeSingle()
        : Promise.resolve({ data: null }),
      adminClient
        .from('listing_price_history')
        .select('old_price')
        .eq('listing_id', id)
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const favoriteCount = favCountRes.count || 0;
    const isFavorited = Boolean(userFavRes.data);
    const previousPrice = histRes.data?.old_price && histRes.data.old_price !== listing.price
      ? histRes.data.old_price
      : undefined;

    // If unauthenticated viewer, return sanitized public summary
    if (!viewerProfileId && !viewerUserId) {
      const cover = getListingCoverPath(listing.listing_images);
      return {
        listing: {
          id: listing.id,
          public_id: listing.public_id,
          listing_number: listing.listing_number,
          category: listing.category,
          subcategory: listing.subcategory,
          title: listing.title,
          price: listing.price,
          previous_price: previousPrice,
          location: listing.category === 'vehicle' ? null : listing.location,
          published_at: listing.published_at,
          cover_image: cover,
          favorite_count: favoriteCount,
          is_locked: true,
          status: getEffectiveListingStatus(listing),
        },
        isLocked: true,
        isOwner: false,
      };
    }

    return {
      listing: {
        ...listing,
        seller: redactPrivateContact(listing.seller),
        dealer: listing.corporate
          ? {
              ...listing.corporate,
              profile_id: listing.corporate.owner_profile_id,
              sanmail_email: listing.corporate.email,
            }
          : undefined,
        location: listing.category === 'vehicle' ? null : listing.location,
        previous_price: previousPrice,
        images: sortListingImages(listing.listing_images),
        favorite_count: favoriteCount,
        is_favorited: isFavorited,
      },
      isLocked: false,
      isOwner,
    };
  }

  async getListingByPublicId(
    publicId: string,
    viewerProfileId?: string,
    viewerUserId?: string
  ): Promise<{ listing: MemberListingDetail | PublicListingSummary | null; isLocked: boolean; isOwner: boolean }> {
    if (!isListingPublicId(publicId)) return { listing: null, isLocked: false, isOwner: false };
    const client = this.getAdminClient();
    const { data, error } = await client.from('listings').select('id').eq('public_id', publicId).maybeSingle();
    if (error) throw new Error(`Supabase error fetching listing by public_id: ${error.message}`);
    return data?.id
      ? this.getListingById(data.id, viewerProfileId, viewerUserId)
      : { listing: null, isLocked: false, isOwner: false };
  }

  async createListing(input: CreateListingInput, profileId: string, options: ListingPublishOptions = {}): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    const client = getSupabaseAdminClient();
    if (!client) return { success: false, error: 'Güvenilir ilan işlemi için sunucu Supabase anahtarı yapılandırılmamış.' };
    const safeProfileId = resolveProfileId(profileId);

    const sellerType = input.seller_type || (input.corporate_profile_id ? 'CORPORATE' : 'INDIVIDUAL');
    const corporateProfileId = input.corporate_profile_id || null;
    let targetCreditOwnerId = safeProfileId;

    if (sellerType === 'CORPORATE') {
      if (!corporateProfileId) {
        return { success: false, error: 'Kurumsal ilan için kurumsal mağaza bilgisi gereklidir.' };
      }
      // Verify corporate store ownership
      const { data: dealer } = await client
        .from('corporate_profiles')
        .select('id, owner_profile_id, status, subscription_status')
        .eq('id', corporateProfileId)
        .maybeSingle();

      if (!dealer || (dealer.owner_profile_id !== safeProfileId && (dealer as any).profile_id !== safeProfileId)) {
        return { success: false, error: 'Bu kurumsal mağaza adına ilan yayınlama yetkiniz bulunmuyor.' };
      }
      targetCreditOwnerId = dealer.owner_profile_id || safeProfileId;
    }

    const processedImages: Array<{ storage_path: string; is_cover: boolean; sort_order: number; size_bytes: number }> = [];
    for (let i = 0; i < (input.images || []).length; i++) {
      const img = input.images[i];
      processedImages.push({ storage_path: img.storage_path, sort_order: img.sort_order ?? i, is_cover: Boolean(img.is_cover ?? i === 0), size_bytes: img.size_bytes || 500000 });
    }

    const rpcListingNumber = `#SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const details = input.category === 'vehicle' ? {
      vehicle_category: input.subcategory, brand: input.brand || '', model: input.model || '', plate: input.plate || 'LS-TEMP',
      mileage: input.mileage || 0, engine_upgrade: input.engine_upgrade || 0, transmission_upgrade: input.transmission_upgrade || 0,
      brake_upgrade: input.brake_upgrade || 0, turbo: Boolean(input.turbo), subwoofer: Boolean(input.subwoofer),
      trade_available: Boolean(input.trade_available), lock_level: input.lock_level ?? null, alarm_level: input.alarm_level ?? null,
      anti_theft_level: input.anti_theft_level ?? null, engine_health: input.engine_health ?? null,
      suspension: input.subcategory === 'Motosiklet' ? null : (input.suspension || null), fuel_type: input.fuel_type || null, factory_price: input.factory_price ?? null,
    } : {
      property_type: input.subcategory, floor: input.floor || 1, room_count: input.room_count || '1+1',
      furnished: Boolean(input.furnished), market_value: input.market_value, furniture_value: input.furnished ? (input.furniture_value ?? null) : null,
      building_type: input.building_type || 'Normal', balcony: Boolean(input.balcony),
    };

    if (options.paymentMode === 'TEST_BYPASS') {
      const now = new Date();
      const durationDays = sellerType === 'CORPORATE' ? 14 : 7;
      const { data: listing, error: listingError } = await client
        .from('listings')
        .insert({
          listing_number: rpcListingNumber,
          seller_profile_id: safeProfileId,
          seller_type: sellerType,
          corporate_profile_id: sellerType === 'CORPORATE' ? corporateProfileId : null,
          category: input.category,
          subcategory: input.subcategory,
          title: input.title,
          description: input.description,
          price: input.price,
          location: input.category === 'vehicle' ? null : (input.location?.trim() || null),
          status: 'ACTIVE',
          published_at: now.toISOString(),
          expires_at: new Date(now.getTime() + durationDays * 86400000).toISOString(),
        })
        .select()
        .single();
      if (listingError || !listing) {
        return { success: false, error: listingError?.message || 'Test ilanı oluşturulamadı.' };
      }

      const detailsTable = input.category === 'vehicle' ? 'vehicle_details' : 'property_details';
      const { error: detailsError } = await client.from(detailsTable).insert({ listing_id: listing.id, ...details });
      const { error: imagesError } = detailsError || processedImages.length === 0
        ? { error: null }
        : await client.from('listing_images').insert(
            processedImages.map((image) => ({ listing_id: listing.id, ...image }))
          );

      if (detailsError || imagesError) {
        await client.from('listings').delete().eq('id', listing.id);
        return { success: false, error: detailsError?.message || imagesError?.message || 'Test ilanı tamamlanamadı.' };
      }

      return { success: true, listing: listing as Listing };
    }

    const { data: rpcData, error: rpcError } = await client.rpc('create_listing_with_credit', {
      p_profile_id: targetCreditOwnerId,
      p_seller_type: sellerType,
      p_corporate_profile_id: corporateProfileId,
      p_listing: {
        listing_number: rpcListingNumber, category: input.category, subcategory: input.subcategory,
        title: input.title, description: input.description, price: input.price,
        offers_enabled: input.offers_enabled !== false, minimum_offer_amount: input.minimum_offer_amount ?? null,
        location: input.category === 'vehicle' ? null : (input.location?.trim() || null),
      },
      p_details: details,
      p_images: processedImages,
    });
    if (!rpcError) {
      const rpcResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      return { success: Boolean(rpcResult?.success), listing: rpcResult?.listing, error: rpcResult?.error };
    }
    return {
      success: false,
      error: `Atomik ilan oluşturma işlemi kullanılamıyor: ${rpcError.message}`,
    };
  }

  async republishListing(id: string, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    if (!isUuid(id)) return { success: false, error: 'Geçersiz ilan ID formatı.' };
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return { success: false, error: 'Geçersiz profil ID formatı.' };
    const client = getSupabaseAdminClient();
    if (!client) return { success: false, error: 'Güvenilir ilan işlemi için sunucu Supabase anahtarı yapılandırılmamış.' };
    const { data, error } = await client.rpc('republish_listing_with_credit', {
      p_listing_id: id,
      p_profile_id: safeProfileId,
    });
    if (error) return { success: false, error: error.message };
    const result = Array.isArray(data) ? data[0] : data;
    return { success: Boolean(result?.success), listing: result?.listing, error: result?.error };
  }

  async updateListing(
    id: string,
    input: Partial<CreateListingInput>,
    profileId: string,
    userId?: string,
    role?: string
  ): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    if (!isUuid(id)) {
      return { success: false, error: 'Geçersiz ilan ID formatı.' };
    }
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    const safeUserId = await this.resolveAccountUserId(userId, profileId);

    const { data: existing, error: fetchErr } = await client
      .from('listings')
      .select('*, seller:character_profiles(user_id), corporate:corporate_profiles(owner_profile_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: 'İlan bulunamadı.' };
    }

    // Ownership check: Admin or Profile Owner or Account Owner
    const isAdmin = role === 'ADMIN';
    const isCorporate = existing.seller_type === 'CORPORATE' || Boolean(existing.corporate_profile_id);
    const isProfileOwner = isCorporate
      ? existing.corporate?.owner_profile_id === safeProfileId
      : existing.seller_profile_id === safeProfileId;
    const isAccountOwner = !isCorporate && Boolean(safeUserId && existing.seller?.user_id === safeUserId);

    if (!isAdmin && !isProfileOwner && !isAccountOwner) {
      return { success: false, error: 'Bu ilanı düzenleme yetkiniz yok.' };
    }

    if (existing.status === 'SOLD' || existing.status === 'REMOVED') {
      return { success: false, error: 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.' };
    }

    // Price Drop Detection & Atomic Update
    const oldPrice = existing.price;
    const newPrice = input.price !== undefined ? input.price : oldPrice;

    let rpcExecuted = false;
    // Attempt atomic update via PostgreSQL RPC if available
    if (!isCorporate && (newPrice !== oldPrice || input.title || input.description)) {
      try {
        const { data: rpcData, error: rpcErr } = await client.rpc('update_listing_price', {
          p_listing_id: id,
          p_new_price: newPrice,
          p_editor_user_id: safeUserId || null,
          p_editor_profile_id: safeProfileId || null,
          p_title: input.title || null,
          p_description: input.description || null,
        });

        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            return { success: false, error: rpcData.error || 'İlan güncellenemedi.' };
          }
          rpcExecuted = true;
        }
      } catch {
        // Fallback to sequential execution if RPC is not deployed yet
      }
    }

    if (!rpcExecuted) {
      if (newPrice !== oldPrice) {
        // Record price history
        await client.from('listing_price_history').insert({
          listing_id: id,
          old_price: oldPrice,
          new_price: newPrice,
        });

        // Price Drop Notification: strictly triggered when newPrice < oldPrice, excluding seller
        if (newPrice < oldPrice) {
          const { data: favs } = await client.from('favorites').select('profile_id').eq('listing_id', id);
          const sellerProfileId = existing.seller_profile_id;

          if (favs && favs.length > 0) {
            const profileIds = [...new Set(favs.map((f: any) => f.profile_id).filter((pid: string) => pid && pid !== sellerProfileId))];
            for (const pid of profileIds) {
              await client.from('notifications').insert({
                recipient_profile_id: pid,
                type: 'LISTING_PRICE_DROP',
                title: 'Favori İlanınızın Fiyatı Düştü',
                message: `${existing.title} ilanının fiyatı $${oldPrice.toLocaleString('en-US')} yerine $${newPrice.toLocaleString('en-US')} olarak güncellendi.`,
                entity_type: 'listing',
                entity_id: id,
                metadata: { listingId: id, oldPrice, newPrice },
              });
            }
          }
        }
      }
    }

    // Update main listing table
    const updateData: any = { updated_at: new Date().toISOString() };
    if (input.title) updateData.title = input.title;
    if (input.description) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.offers_enabled !== undefined) updateData.offers_enabled = input.offers_enabled;
    if (input.minimum_offer_amount !== undefined) updateData.minimum_offer_amount = input.minimum_offer_amount;
    if (input.subcategory) updateData.subcategory = input.subcategory;

    if (existing.category === 'vehicle') {
      updateData.location = null;
    } else if (input.location !== undefined) {
      updateData.location = input.location ? input.location.trim() : null;
    }

    let { data: updated, error: updateErr } = await client
      .from('listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr && updateErr.code === '23502' && updateErr.message?.includes('location') && existing.category === 'vehicle') {
      delete updateData.location;
      const retry = await client
        .from('listings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      updated = retry.data;
      updateErr = retry.error;
    }

    if (updateErr) {
      return { success: false, error: `İlan güncellenemedi: ${updateErr.message}` };
    }
    if (newPrice !== oldPrice) await (await import('../index')).getOfferRepository().recordListingPriceChange(id, oldPrice, newPrice);

    // Update category details if provided
    if (existing.category === 'vehicle') {
      const vehUpdate: any = {};
      const vehicleCategory = input.subcategory || (input as any).vehicle_category;
      if (vehicleCategory) vehUpdate.vehicle_category = vehicleCategory;
      if (input.brand !== undefined) vehUpdate.brand = input.brand;
      if (input.model !== undefined) vehUpdate.model = input.model;
      if (input.plate !== undefined) vehUpdate.plate = input.plate.trim().toUpperCase();
      if (input.mileage !== undefined) vehUpdate.mileage = Number(input.mileage);
      if (input.engine_upgrade !== undefined) vehUpdate.engine_upgrade = Number(input.engine_upgrade);
      if (input.transmission_upgrade !== undefined) vehUpdate.transmission_upgrade = Number(input.transmission_upgrade);
      if (input.brake_upgrade !== undefined) vehUpdate.brake_upgrade = Number(input.brake_upgrade);
      if (input.turbo !== undefined) vehUpdate.turbo = Boolean(input.turbo);
      if (input.subwoofer !== undefined) vehUpdate.subwoofer = Boolean(input.subwoofer);
      if (input.trade_available !== undefined) vehUpdate.trade_available = Boolean(input.trade_available);
      if (input.lock_level !== undefined) vehUpdate.lock_level = input.lock_level !== null ? Number(input.lock_level) : null;
      if (input.alarm_level !== undefined) vehUpdate.alarm_level = input.alarm_level !== null ? Number(input.alarm_level) : null;
      if (input.anti_theft_level !== undefined) vehUpdate.anti_theft_level = input.anti_theft_level !== null ? Number(input.anti_theft_level) : null;
      if (input.engine_health !== undefined) vehUpdate.engine_health = input.engine_health !== null ? Number(input.engine_health) : null;
      if (input.suspension !== undefined || vehicleCategory === 'Motosiklet') vehUpdate.suspension = vehicleCategory === 'Motosiklet' ? null : (input.suspension ? String(input.suspension).trim() : null);
      if (input.fuel_type !== undefined) vehUpdate.fuel_type = input.fuel_type ? String(input.fuel_type).trim() : null;
      if (input.factory_price !== undefined) vehUpdate.factory_price = input.factory_price !== null ? Number(input.factory_price) : null;

      if (Object.keys(vehUpdate).length > 0) {
        const { error: vehErr } = await client.from('vehicle_details').update(vehUpdate).eq('listing_id', id);
        if (vehErr) {
          return { success: false, error: `Araç detayları güncellenemedi: ${vehErr.message}` };
        }
      }
    } else {
      const propUpdate: any = {};
      const propType = input.subcategory || (input as any).property_type;
      if (propType) propUpdate.property_type = propType;
      if (input.floor !== undefined) propUpdate.floor = Number(input.floor);
      if (input.room_count !== undefined) propUpdate.room_count = input.room_count;
      if (input.building_type !== undefined) propUpdate.building_type = input.building_type;
      if (input.furnished !== undefined) propUpdate.furnished = Boolean(input.furnished);
      if (input.market_value !== undefined) propUpdate.market_value = Number(input.market_value);
      if (input.furniture_value !== undefined || input.furnished === false) propUpdate.furniture_value = input.furnished === false ? null : input.furniture_value;
      if (input.balcony !== undefined) propUpdate.balcony = Boolean(input.balcony);

      if (Object.keys(propUpdate).length > 0) {
        const { error: propErr } = await client.from('property_details').update(propUpdate).eq('listing_id', id);
        if (propErr) {
          return { success: false, error: `Mülk detayları güncellenemedi: ${propErr.message}` };
        }
      }
    }

    // Update images if provided
    if (input.images) {
      // 1. Collect existing images to detect removed objects for R2 cleanup
      const { data: existingImgs } = await client
        .from('listing_images')
        .select('storage_path')
        .eq('listing_id', id);

      const oldPaths = new Set(
        (existingImgs || [])
          .map((img: any) => img.storage_path)
          .filter((p: any) => Boolean(p) && typeof p === 'string')
      );

      const retainedPaths = new Set<string>();

      await client.from('listing_images').delete().eq('listing_id', id);
      for (let i = 0; i < input.images.length; i++) {
        const finalPath = input.images[i].storage_path;

        retainedPaths.add(finalPath);

        await client.from('listing_images').insert({
          listing_id: id,
          storage_path: finalPath,
          sort_order: input.images[i].sort_order ?? i,
          is_cover: Boolean(input.images[i].is_cover ?? i === 0),
          size_bytes: input.images[i].size_bytes || 500000,
        });
      }

      // 2. Safely delete removed objects from R2
      const mediaType = existing.category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE';
      for (const oldKey of oldPaths) {
        if (!retainedPaths.has(oldKey)) {
          await deleteMediaSafely(oldKey, mediaType, 'LISTING_IMAGE_REMOVED').catch(() => {});
        }
      }
    }

    return { success: true, listing: updated };
  }

  async cleanupListingMedia(
    listingId: string,
    category: 'vehicle' | 'property',
    reason: 'LISTING_SOLD' | 'LISTING_REMOVED'
  ): Promise<void> {
    const client = this.getAdminClient();
    const { data: existingImages } = await client
      .from('listing_images')
      .select('storage_path')
      .eq('listing_id', listingId);

    const imageKeys = (existingImages || [])
      .map((img: any) => img.storage_path)
      .filter((k: any) => Boolean(k) && typeof k === 'string');

    const mediaType = category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE';
    for (const key of imageKeys) {
      await deleteMediaSafely(key, mediaType, reason);
    }
    await client.from('favorites').delete().eq('listing_id', listingId).throwOnError();
    await client.from('listing_price_history').delete().eq('listing_id', listingId).throwOnError();
    await client.from('vehicle_details').delete().eq('listing_id', listingId).throwOnError();
    await client.from('property_details').delete().eq('listing_id', listingId).throwOnError();
    await client.from('listing_images').delete().eq('listing_id', listingId).throwOnError();
  }

  async markListingAsSold(id: string, profileId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.closeListing(id, profileId, 'SOLD');
    return { success: result.success, error: result.error };
  }

  async closeListing(id: string, profileId: string, status: 'SOLD' | 'REMOVED', closeReason?: 'SOLD' | 'CANCELLED' | 'OTHER'): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    if (!isUuid(id)) {
      return { success: false, error: 'Geçersiz ilan ID formatı.' };
    }
    const client = this.getAdminClient();
    const isAdminAction = profileId === 'SYSTEM_ADMIN';
    const safeProfileId = isAdminAction ? null : resolveProfileId(profileId);

    const { data: listing, error: fetchErr } = await client
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) return { success: false, error: 'İlan bulunamadı.' };
    const { data: closeResult, error: closeError } = await client.rpc('close_listing_with_offers', {
      p_listing_id: id,
      p_actor_profile_id: safeProfileId,
      p_status: status,
      p_admin: isAdminAction,
      p_close_reason: closeReason || (status === 'SOLD' ? 'SOLD' : 'OTHER'),
    });
    if (closeError || !closeResult?.success) return { success: false, error: closeResult?.error || closeError?.message || 'İlan kapatılamadı.' };

    if (status === 'SOLD') {
      await client.from('sold_listing_audit').insert({
        original_listing_id: id,
        seller_profile_id: listing.seller_profile_id,
        sold_at: new Date().toISOString(),
        title: listing.title,
        price: listing.price,
        description: listing.description,
        closed_at: closeResult.listing?.closed_at || new Date().toISOString(),
      });
    }
    if (status === 'REMOVED') {
      await this.cleanupListingMedia(id, listing.category, 'LISTING_REMOVED');
      await client.from('listings').delete().eq('id', id).throwOnError();
    }

    return { success: true, listing: { ...listing, ...(closeResult.listing || {}), status, images: [] } };
  }

  async removeListing(id: string, profileId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.closeListing(id, profileId, 'REMOVED');
    return { success: result.success, error: result.error };
  }

  async getUserListings(
    profileId: string,
    onTiming?: (
      stage: 'query' | 'enrichment_query' | 'enrich_map' | 'enrich' | 'map',
      duration: number
    ) => void
  ): Promise<Listing[]> {
    const client = this.getClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];
    const { data: historyProfile } = await this.getAdminClient()
      .from('character_profiles')
      .select('expired_listing_history_cleared_at, sold_listing_history_cleared_at')
      .eq('id', safeProfileId)
      .maybeSingle();
    const expiredCutoff = historyProfile?.expired_listing_history_cleared_at ? new Date(historyProfile.expired_listing_history_cleared_at).getTime() : 0;
    const soldCutoff = historyProfile?.sold_listing_history_cleared_at ? new Date(historyProfile.sold_listing_history_cleared_at).getTime() : 0;

    const queryStartedAt = performance.now();
    let data;
    let error;
    try {
      ({ data, error } = await client
        .from('listings')
        .select(`
        id,
        listing_number,
        seller_profile_id,
        corporate_profile_id,
        seller_type,
        category,
        subcategory,
        title,
        description,
        price,
        location,
        status,
        is_featured,
        featured_until,
        published_at,
        expires_at,
        created_at,
        updated_at,
        vehicle_details (listing_id, vehicle_category, brand, model, plate, mileage, engine_upgrade, transmission_upgrade, brake_upgrade, turbo, subwoofer, trade_available, lock_level, alarm_level, anti_theft_level, engine_health, suspension, fuel_type, factory_price),
        property_details (listing_id, property_type, floor, room_count, furnished, market_value, furniture_value, building_type, balcony),
        listing_images (id, listing_id, storage_path, sort_order, is_cover, size_bytes, created_at)
      `)
        .eq('seller_profile_id', safeProfileId)
        .eq('seller_type', 'INDIVIDUAL')
        .is('corporate_profile_id', null)
        .order('created_at', { ascending: false }));
    } finally {
      onTiming?.('query', performance.now() - queryStartedAt);
    }

    if (error) {
      throw new Error(`Supabase error fetching user listings: ${error.message}`);
    }

    const rows = data || [];
    const ids = rows.map((r: any) => r.id);

    const priceHistoryMap: Record<string, number> = {};
    const favCountMap: Record<string, number> = {};

    const enrichStartedAt = performance.now();
    try {
      if (ids.length > 0) {
        const enrichmentQueryStartedAt = performance.now();
        let enrichmentRows;
        try {
          const { data: enrichmentData } = await this.getAdminClient().rpc('get_user_listing_enrichment', {
            p_seller_profile_id: safeProfileId,
            p_listing_ids: ids,
          });
          enrichmentRows = enrichmentData || [];
        } finally {
          onTiming?.('enrichment_query', performance.now() - enrichmentQueryStartedAt);
        }

        const enrichMapStartedAt = performance.now();
        try {
          for (const enrichment of enrichmentRows) {
            if (enrichment.previous_price !== null) {
              priceHistoryMap[enrichment.listing_id] = Number(enrichment.previous_price);
            }
            favCountMap[enrichment.listing_id] = Number(enrichment.favorite_count);
          }
        } finally {
          onTiming?.('enrich_map', performance.now() - enrichMapStartedAt);
        }
      }
    } finally {
      onTiming?.('enrich', performance.now() - enrichStartedAt);
    }

    const mapStartedAt = performance.now();
    try {
      const mappedRows = rows.map((item: any) => ({
        ...item,
        location: item.category === 'vehicle' ? null : item.location,
        previous_price: priceHistoryMap[item.id] && priceHistoryMap[item.id] !== item.price ? priceHistoryMap[item.id] : undefined,
        favorite_count: favCountMap[item.id] || 0,
        images: item.listing_images || [],
        status: getEffectiveListingStatus(item),
      }));
      const { data: soldRows } = await this.getAdminClient().from('sold_listing_audit').select('original_listing_id, title, price, description, sold_at, closed_at').eq('seller_profile_id', safeProfileId).order('sold_at', { ascending: false });
      const visibleRows = mappedRows.filter((item: any) => {
        if (item.status === 'ACTIVE') return true;
        if (item.status === 'SOLD') return new Date(item.closed_at || item.updated_at || item.created_at).getTime() > soldCutoff;
        if (item.status === 'EXPIRED') return new Date(item.expires_at || item.updated_at || item.created_at).getTime() > expiredCutoff;
        return true;
      });
      const knownIds = new Set(visibleRows.map((item: any) => item.id));
      return [...visibleRows, ...(soldRows || []).filter((item: any) => !knownIds.has(item.original_listing_id) && new Date(item.closed_at || item.sold_at).getTime() > soldCutoff).map((item: any) => ({
        id: item.original_listing_id, listing_number: '', seller_profile_id: safeProfileId, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil',
        title: item.title || 'Satılan ilan', description: item.description || '', price: Number(item.price) || 0, location: null, status: 'SOLD',
        closed_at: item.closed_at || item.sold_at, created_at: item.sold_at, updated_at: item.closed_at || item.sold_at,
      }))];
    } finally {
      onTiming?.('map', performance.now() - mapStartedAt);
    }
  }

  async clearUserListingHistory(profileId: string, status: 'EXPIRED' | 'SOLD') {
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return { success: false, error: 'Profil bulunamadı.' };
    const clearedAt = new Date().toISOString();
    const column = status === 'EXPIRED' ? 'expired_listing_history_cleared_at' : 'sold_listing_history_cleared_at';
    const { data, error } = await this.getAdminClient()
      .from('character_profiles')
      .update({ [column]: clearedAt, updated_at: clearedAt })
      .eq('id', safeProfileId)
      .select('id')
      .maybeSingle();
    if (error || !data) return { success: false, error: error?.message || 'İlan geçmişi temizlenemedi.' };
    return { success: true, clearedAt };
  }

  async getCorporateListings(
    corporateProfileId: string,
    onTiming?: (stage: 'db' | 'enrich', duration: number) => void
  ): Promise<Listing[]> {
    const client = this.getClient();
    const safeCorporateId = resolveProfileId(corporateProfileId);

    let query = client
      .from('listings')
      .select(`
        *,
        vehicle_details (*),
        property_details (*),
        listing_images (*)
      `)
      .order('created_at', { ascending: false });

    if (isUuid(safeCorporateId)) {
      query = query.eq('seller_type', 'CORPORATE').eq('corporate_profile_id', safeCorporateId);
    } else {
      query = query.eq('seller_type', 'CORPORATE').or(`corporate_profile_id.eq.${corporateProfileId}`);
    }

    const dbStartedAt = performance.now();
    let data;
    let error;
    try {
      ({ data, error } = await query);
    } finally {
      onTiming?.('db', performance.now() - dbStartedAt);
    }
    if (error) {
      throw new Error(`Supabase error fetching corporate listings: ${error.message}`);
    }

    const enrichStartedAt = performance.now();
    try {
      const rows = data || [];
      const ids = rows.map((r: any) => r.id);

      const priceHistoryMap: Record<string, number> = {};
      const favCountMap: Record<string, number> = {};

      if (ids.length > 0) {
        const [historiesRes, favsRes] = await Promise.all([
          client
            .from('listing_price_history')
            .select('listing_id, old_price, changed_at')
            .in('listing_id', ids)
            .order('changed_at', { ascending: false }),
          this.getAdminClient()
            .from('favorites')
            .select('listing_id')
            .in('listing_id', ids),
        ]);

        if (historiesRes.data) {
          for (const h of historiesRes.data) {
            if (!priceHistoryMap[h.listing_id]) priceHistoryMap[h.listing_id] = h.old_price;
          }
        }

        if (favsRes.data) {
          for (const f of favsRes.data) {
            favCountMap[f.listing_id] = (favCountMap[f.listing_id] || 0) + 1;
          }
        }
      }

      return rows.map((item: any) => ({
        ...item,
        location: item.category === 'vehicle' ? null : item.location,
        previous_price: priceHistoryMap[item.id] && priceHistoryMap[item.id] !== item.price ? priceHistoryMap[item.id] : undefined,
        favorite_count: favCountMap[item.id] || 0,
        images: item.listing_images || [],
        status: getEffectiveListingStatus(item),
      }));
    } finally {
      onTiming?.('enrich', performance.now() - enrichStartedAt);
    }
  }

  async toggleFavorite(listingId: string, profileId: string): Promise<{ isFavorited: boolean; count: number }> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    if (!safeProfileId || !isUuid(safeProfileId) || !isUuid(listingId)) {
      return { isFavorited: false, count: 0 };
    }

    // Check by character profile_id and listing_id
    const { data: existing } = await client
      .from('favorites')
      .select('id')
      .eq('profile_id', safeProfileId)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (existing) {
      await client.from('favorites').delete().eq('id', existing.id);
      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: false, count: count || 0 };
    } else {
      // Self-abuse check before adding favorite
      const { data: targetListing } = await client
        .from('listings')
        .select('id, seller_type, seller_profile_id, corporate_profile_id')
        .eq('id', listingId)
        .maybeSingle();

      if (!targetListing) {
        throw new Error('İlan bulunamadı.');
      }

      if (targetListing.seller_type === 'INDIVIDUAL' && targetListing.seller_profile_id === safeProfileId) {
        throw new Error('Kendi ilanınızı favorilere ekleyemezsiniz.');
      }

      if (targetListing.seller_type === 'CORPORATE' && targetListing.corporate_profile_id) {
        const { data: dealer } = await client
          .from('corporate_profiles')
          .select('owner_profile_id')
          .eq('id', targetListing.corporate_profile_id)
          .maybeSingle();

        if (dealer && dealer.owner_profile_id === safeProfileId) {
          throw new Error('Sahibi olduğunuz mağazanın ilanını favorilere ekleyemezsiniz.');
        }
      }

      const safeUserId = await this.resolveAccountUserId(undefined, safeProfileId);
      await client.from('favorites').insert({
        profile_id: safeProfileId,
        user_id: safeUserId || undefined,
        listing_id: listingId,
      });

      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: true, count: count || 1 };
    }
  }

  async setFavorite(
    listingId: string,
    profileId: string,
    isFavorited: boolean
  ): Promise<{ isFavorited: boolean; count: number }> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    if (!safeProfileId || !isUuid(safeProfileId) || !isUuid(listingId)) {
      throw new Error('Geçersiz favori isteği.');
    }

    if (isFavorited) {
      const { data: targetListing, error: listingError } = await client
        .from('listings')
        .select('id, seller_type, seller_profile_id, corporate_profile_id')
        .eq('id', listingId)
        .maybeSingle();

      if (listingError) throw new Error(listingError.message);
      if (!targetListing) throw new Error('İlan bulunamadı.');
      if (targetListing.seller_type === 'INDIVIDUAL' && targetListing.seller_profile_id === safeProfileId) {
        throw new Error('Kendi ilanınızı favorilere ekleyemezsiniz.');
      }

      if (targetListing.seller_type === 'CORPORATE' && targetListing.corporate_profile_id) {
        const { data: dealer } = await client
          .from('corporate_profiles')
          .select('owner_profile_id')
          .eq('id', targetListing.corporate_profile_id)
          .maybeSingle();
        if (dealer?.owner_profile_id === safeProfileId) {
          throw new Error('Sahibi olduğunuz mağazanın ilanını favorilere ekleyemezsiniz.');
        }
      }

      const safeUserId = await this.resolveAccountUserId(undefined, safeProfileId);
      const { error: insertError } = await client.from('favorites').insert({
        profile_id: safeProfileId,
        user_id: safeUserId || undefined,
        listing_id: listingId,
      });
      // A concurrent/stale ADD is idempotent. PostgreSQL 23505 means the
      // canonical (profile_id, listing_id) relation already exists.
      if (insertError && insertError.code !== '23505') throw new Error(insertError.message);
    } else {
      const { error: deleteError } = await client
        .from('favorites')
        .delete()
        .eq('profile_id', safeProfileId)
        .eq('listing_id', listingId);
      if (deleteError) throw new Error(deleteError.message);
    }

    const { count, error: countError } = await client
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId);
    if (countError) throw new Error(countError.message);

    return { isFavorited, count: count || 0 };
  }

  async removeFavorite(listingId: string, profileId: string): Promise<{ success: boolean; count: number }> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    if (!safeProfileId || !isUuid(safeProfileId) || !isUuid(listingId)) {
      return { success: false, count: 0 };
    }

    const { error: deleteError } = await client
      .from('favorites')
      .delete()
      .eq('profile_id', safeProfileId)
      .eq('listing_id', listingId);
    if (deleteError) throw new Error(deleteError.message);

    const { count, error: countError } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
    if (countError) throw new Error(countError.message);
    return { success: true, count: count || 0 };
  }

  async getFavoriteStates(
    listingIds: string[],
    profileId?: string
  ): Promise<Record<string, { isFavorited: boolean; count: number }>> {
    const ids = [...new Set(listingIds.filter(isUuid))];
    const states: Record<string, { isFavorited: boolean; count: number }> = {};
    for (const id of ids) states[id] = { isFavorited: false, count: 0 };
    if (ids.length === 0) return states;

    const client = this.getAdminClient();
    const safeProfileId = profileId ? resolveProfileId(profileId) : undefined;
    const { data, error } = await client
      .from('favorites')
      .select('listing_id, profile_id')
      .in('listing_id', ids);
    if (error) throw new Error(error.message);

    for (const favorite of data || []) {
      const state = states[favorite.listing_id];
      if (!state) continue;
      state.count += 1;
      if (safeProfileId && favorite.profile_id === safeProfileId) state.isFavorited = true;
    }
    return states;
  }

  async getUserFavorites(profileId: string): Promise<(Listing & { isExpired: boolean })[]> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    if (!safeProfileId || !isUuid(safeProfileId)) {
      return [];
    }

    // Query strictly by character profile_id
    const { data, error } = await client
      .from('favorites')
      .select(`
        listing_id,
        listings (
          id,
          listing_number,
          seller_profile_id,
          corporate_profile_id,
          seller_type,
          category,
          subcategory,
          title,
          description,
          price,
          location,
          status,
          is_featured,
          featured_until,
          published_at,
          expires_at,
          created_at,
          updated_at,
          vehicle_details (listing_id, vehicle_category, brand, model, plate, mileage, engine_upgrade, transmission_upgrade, brake_upgrade, turbo, subwoofer, trade_available, lock_level, alarm_level, anti_theft_level, engine_health, suspension, fuel_type, factory_price),
          property_details (listing_id, property_type, floor, room_count, furnished, market_value, furniture_value, building_type, balcony),
          listing_images (id, listing_id, storage_path, sort_order, is_cover, size_bytes, created_at)
        )
      `)
      .eq('profile_id', safeProfileId);

    if (error) {
      throw new Error(`Supabase error fetching favorites: ${error.message}`);
    }

    const rows = (data || []).filter((item: any) => item.listings).map((item: any) => item.listings);
    const ids = rows.map((r: any) => r.id);

    const priceHistoryMap: Record<string, number> = {};
    const favoriteCountMap: Record<string, number> = {};
    if (ids.length > 0) {
      const [{ data: histories }, { data: favoriteRows }] = await Promise.all([
        client
          .from('listing_price_history')
          .select('listing_id, old_price, changed_at')
          .in('listing_id', ids)
          .order('changed_at', { ascending: false }),
        client.from('favorites').select('listing_id').in('listing_id', ids),
      ]);

      if (histories) {
        for (const h of histories) {
          if (!priceHistoryMap[h.listing_id]) priceHistoryMap[h.listing_id] = h.old_price;
        }
      }
      if (favoriteRows) {
        for (const favorite of favoriteRows) {
          favoriteCountMap[favorite.listing_id] = (favoriteCountMap[favorite.listing_id] || 0) + 1;
        }
      }
    }

    const now = new Date();
    return rows.map((listing: any) => ({
      ...listing,
      location: listing.category === 'vehicle' ? null : listing.location,
      previous_price: priceHistoryMap[listing.id] && priceHistoryMap[listing.id] !== listing.price ? priceHistoryMap[listing.id] : undefined,
      images: listing.listing_images || [],
      favorite_count: favoriteCountMap[listing.id] || 0,
      is_favorited: true,
      isExpired: listing.expires_at ? new Date(listing.expires_at) < now : false,
    }));
  }
}
