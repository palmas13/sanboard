import { IListingRepository, CreateListingInput } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Listing, MemberListingDetail, PublicListingSummary } from '@/types';
import { ListingFilterParams } from '../../listings';
import { uploadListingImage } from '@/lib/storage';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { resolveUserId, resolveProfileId, isUuid } from '../../id-mapper';
import { getEffectiveListingStatus } from '@/lib/listings/visibility';
import { getListingCoverPath, sortListingImages } from '@/lib/listings/images';

export function isPublicCorporateListingVisible(item: any): boolean {
  if (item.seller_type !== 'CORPORATE') return true;
  if (!item.corporate_profile_id || !item.corporate) return false;

  const corporate = Array.isArray(item.corporate) ? item.corporate[0] : item.corporate;
  if (!corporate) return false;

  return (
    corporate.moderation_status !== 'SUSPENDED' &&
    corporate.moderation_status !== 'DELETED' &&
    !corporate.deleted_at
  );
}

export function getSimilarPriceRange(price: number): { minPrice: number; maxPrice: number } {
  return {
    minPrice: Math.max(0, Math.floor(price * 0.6)),
    maxPrice: Math.ceil(price * 1.4),
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
        listing_number,
        category,
        subcategory,
        title,
        price,
        location,
        published_at,
        is_featured,
        featured_until,
        seller_type,
        corporate_profile_id,
        corporate:corporate_profiles (moderation_status, deleted_at),
        listing_images (storage_path, is_cover, sort_order)
      `)
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString());

    if (params?.category) query = query.eq('category', params.category);
    if (params?.subcategory && params.subcategory !== 'all') query = query.eq('subcategory', params.subcategory);
    if (params?.minPrice !== undefined) query = query.gte('price', params.minPrice);
    if (params?.maxPrice !== undefined) query = query.lte('price', params.maxPrice);
    if (params?.query) {
      query = query.ilike('title', `%${params.query}%`);
    }
    if (params?.location && params.location !== 'all') {
      query = query.ilike('location', `%${params.location}%`);
    }

    if (params?.sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (params?.sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('published_at', { ascending: false });
    }

    query = query.limit(60);

    let { data, error } = await query;

    // Defensive fallback if columns from pending migrations are not yet present on remote DB before migration execution
    if (error && (error.message?.includes('is_featured') || error.message?.includes('seller_type') || error.message?.includes('moderation_status'))) {
      let fallbackQuery = client
        .from('listings')
        .select(`
          id,
          listing_number,
          category,
          subcategory,
          title,
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
      if (params?.query) fallbackQuery = fallbackQuery.ilike('title', `%${params.query}%`);
      if (params?.location && params.location !== 'all') fallbackQuery = fallbackQuery.ilike('location', `%${params.location}%`);

      if (params?.sort === 'price_asc') {
        fallbackQuery = fallbackQuery.order('price', { ascending: true });
      } else if (params?.sort === 'price_desc') {
        fallbackQuery = fallbackQuery.order('price', { ascending: false });
      } else {
        fallbackQuery = fallbackQuery.order('published_at', { ascending: false });
      }

      fallbackQuery = fallbackQuery.limit(60);

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
      // Exclude listings from suspended or deleted corporate stores (Section 14 & 16)
      if (item.seller_type === 'CORPORATE' && item.corporate) {
        if (
          item.corporate.moderation_status === 'SUSPENDED' ||
          item.corporate.moderation_status === 'DELETED' ||
          item.corporate.deleted_at
        ) {
          return false;
        }
      }
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
        listing_number: item.listing_number,
        category: item.category,
        subcategory: item.subcategory,
        title: item.title,
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
      };
    });

    // Boosted listings appear first before normal listings
    listings.sort((a, b) => {
      if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
        return a.is_featured ? -1 : 1;
      }
      return 0;
    });

    return listings;
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

  async getSimilarListings(currentListingId: string, limit: number = 4): Promise<PublicListingSummary[]> {
    if (!isUuid(currentListingId)) return [];

    const client = this.getClient();
    const nowIso = new Date().toISOString();

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
        corporate:corporate_profiles (moderation_status, deleted_at),
        vehicle_details (*)
      `)
      .eq('id', currentListingId)
      .maybeSingle();

    if (curErr) throw new Error(`Supabase error fetching current similar listing: ${curErr.message}`);
    if (
      !current ||
      current.category !== 'vehicle' ||
      current.status !== 'ACTIVE' ||
      !current.expires_at ||
      new Date(current.expires_at).getTime() <= Date.now() ||
      !this.isPublicCorporateListingVisible(current)
    ) return [];

    const candidateSelect = `
        id,
        listing_number,
        category,
        subcategory,
        title,
        price,
        location,
        published_at,
        created_at,
        is_featured,
        featured_until,
        seller_type,
        corporate_profile_id,
        corporate:corporate_profiles (moderation_status, deleted_at),
        vehicle_details (*),
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
      .eq('category', 'vehicle')
      .neq('id', currentListingId);

    const candidateQueries: PromiseLike<any>[] = [
      createCandidateQuery()
        .eq('subcategory', currentSubcategory)
        .order('published_at', { ascending: false })
        .limit(80),
      createCandidateQuery()
        .gte('price', minPrice)
        .lte('price', maxPrice)
        .order('published_at', { ascending: false })
        .limit(80),
    ];

    const detailQueries: PromiseLike<any>[] = [];
    if (currentBrand) detailQueries.push(client.from('vehicle_details').select('listing_id').ilike('brand', currentBrand).limit(80));
    if (currentModel) detailQueries.push(client.from('vehicle_details').select('listing_id').ilike('model', currentModel).limit(80));

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
        );
      }
    }

    const candidateResults = await Promise.all(candidateQueries);
    const candidateMap = new Map<string, any>();
    for (const result of candidateResults) {
      if (result.error) throw new Error(`Supabase error fetching similar listing candidates: ${result.error.message}`);
      for (const candidate of result.data || []) candidateMap.set(candidate.id, candidate);
    }

    const validCandidates = Array.from(candidateMap.values()).filter((item) =>
      this.isPublicCorporateListingVisible(item)
    );

    const scored = validCandidates.map((cand: any) => {
      let score = 0;
      const candVeh = Array.isArray(cand.vehicle_details) ? cand.vehicle_details[0] : cand.vehicle_details;

      if (cand.subcategory === currentSubcategory) score += 50;

      const candBrand = candVeh?.brand?.toLowerCase().trim();
      if (currentBrand && candBrand && candBrand === currentBrand) score += 30;

      const candModel = candVeh?.model?.toLowerCase().trim();
      if (currentModel && candModel && candModel === currentModel) score += 40;

      const candPrice = cand.price || 1;
      const priceDiffPct = Math.abs(candPrice - currentPrice) / Math.max(currentPrice, 1);
      if (priceDiffPct <= 0.10) score += 40;
      else if (priceDiffPct <= 0.25) score += 25;
      else if (priceDiffPct <= 0.40) score += 15;
      else score += 5;

      if (currentVeh && candVeh) {
        if (currentVeh.fuel_type && currentVeh.fuel_type === candVeh.fuel_type) score += 5;
        if (currentVeh.turbo === candVeh.turbo) score += 3;
      }

      return { cand, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.cand.published_at || b.cand.created_at).getTime() -
        new Date(a.cand.published_at || a.cand.created_at).getTime()
      );
    });

    const selected = scored.slice(0, Math.max(0, limit));
    const selectedIds = selected.map(({ cand }) => cand.id);
    const favoriteCountMap = new Map<string, number>();
    if (selectedIds.length > 0) {
      const { data: favorites, error: favoriteError } = await this.getAdminClient()
        .from('favorites')
        .select('listing_id')
        .in('listing_id', selectedIds);
      if (favoriteError) throw new Error(`Supabase error fetching similar listing favorite counts: ${favoriteError.message}`);
      for (const favorite of favorites || []) {
        favoriteCountMap.set(favorite.listing_id, (favoriteCountMap.get(favorite.listing_id) || 0) + 1);
      }
    }

    const nowTime = Date.now();
    return selected.map(({ cand }) => {
      const cover = getListingCoverPath(cand.listing_images);
      const candVeh = Array.isArray(cand.vehicle_details) ? cand.vehicle_details[0] : cand.vehicle_details;
      const isFeatured = Boolean(
        cand.is_featured &&
        (!cand.featured_until || new Date(cand.featured_until).getTime() > nowTime)
      );

      return {
        id: cand.id,
        listing_number: cand.listing_number,
        category: cand.category,
        subcategory: cand.subcategory,
        title: cand.title,
        price: cand.price,
        location: null,
        published_at: cand.published_at,
        cover_image: cover,
        favorite_count: favoriteCountMap.get(cand.id) || 0,
        is_locked: true as const,
        is_featured: isFeatured,
        featured_until: cand.featured_until,
        seller_type: cand.seller_type,
        corporate_profile_id: cand.corporate_profile_id,
        brand: candVeh?.brand,
        model: candVeh?.model,
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

    // Check store moderation state for corporate listings (Section 2 & 12)
    if (listing.seller_type === 'CORPORATE' && listing.corporate) {
      const corpMod = listing.corporate.moderation_status;
      if ((corpMod === 'SUSPENDED' || corpMod === 'DELETED' || listing.corporate.deleted_at) && !isOwner) {
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
        },
        isLocked: true,
        isOwner: false,
      };
    }

    return {
      listing: {
        ...listing,
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

  async createListing(input: CreateListingInput, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
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
      let finalPath = img.storage_path;
      let sizeBytes = img.size_bytes || 500000;
      if (finalPath.startsWith('data:image/')) {
        const matches = finalPath.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches) {
          const uploadRes = await uploadListingImage(Buffer.from(matches[2], 'base64'), `pending-${Date.now()}`, matches[1]);
          if (!uploadRes.success) return { success: false, error: `R2 görsel yükleme hatası: ${uploadRes.error}` };
          finalPath = uploadRes.url;
          sizeBytes = uploadRes.sizeBytes;
        }
      }
      processedImages.push({ storage_path: finalPath, sort_order: img.sort_order ?? i, is_cover: Boolean(img.is_cover ?? i === 0), size_bytes: sizeBytes });
    }

    const rpcListingNumber = `#SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const details = input.category === 'vehicle' ? {
      vehicle_category: input.subcategory, brand: input.brand || '', model: input.model || '', plate: input.plate || 'LS-TEMP',
      mileage: input.mileage || 0, engine_upgrade: input.engine_upgrade || 0, transmission_upgrade: input.transmission_upgrade || 0,
      brake_upgrade: input.brake_upgrade || 0, turbo: Boolean(input.turbo), subwoofer: Boolean(input.subwoofer),
      trade_available: Boolean(input.trade_available), lock_level: input.lock_level ?? null, alarm_level: input.alarm_level ?? null,
      anti_theft_level: input.anti_theft_level ?? null, engine_health: input.engine_health ?? null,
      suspension: input.suspension || null, fuel_type: input.fuel_type || null, factory_price: input.factory_price ?? null,
    } : {
      property_type: input.subcategory, floor: input.floor || 1, room_count: input.room_count || '1+1',
      furnished: Boolean(input.furnished), building_type: input.building_type || 'Normal', balcony: Boolean(input.balcony),
    };

    const { data: rpcData, error: rpcError } = await client.rpc('create_listing_with_credit', {
      p_profile_id: targetCreditOwnerId,
      p_seller_type: sellerType,
      p_corporate_profile_id: corporateProfileId,
      p_listing: {
        listing_number: rpcListingNumber, category: input.category, subcategory: input.subcategory,
        title: input.title, description: input.description, price: input.price,
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
      .select('*, seller:character_profiles(user_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: 'İlan bulunamadı.' };
    }

    // Ownership check: Admin or Profile Owner or Account Owner
    const isAdmin = role === 'ADMIN';
    const isProfileOwner = existing.seller_profile_id === safeProfileId;
    const isAccountOwner = Boolean(safeUserId && existing.seller?.user_id === safeUserId);

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
    if (newPrice !== oldPrice || input.title || input.description) {
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
      if (input.suspension !== undefined) vehUpdate.suspension = input.suspension ? String(input.suspension).trim() : null;
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
        let finalPath = input.images[i].storage_path;
        if (finalPath.startsWith('data:image/')) {
          const matches = finalPath.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          if (matches) {
            const buffer = Buffer.from(matches[2], 'base64');
            const uploadRes = await uploadListingImage(buffer, id, matches[1]);
            if (uploadRes.success) {
              finalPath = uploadRes.url;
              input.images[i].size_bytes = uploadRes.sizeBytes;
            }
          }
        }

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

    await client.from('favorites').delete().eq('listing_id', listingId);
    await client.from('listing_images').delete().eq('listing_id', listingId);

    const mediaType = category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE';
    for (const key of imageKeys) {
      deleteMediaSafely(key, mediaType, reason).catch((err) => {
        console.error(`Failed to clean R2 media for listing ${listingId}: ${key}`, err);
      });
    }
  }

  async markListingAsSold(id: string, profileId: string): Promise<{ success: boolean; error?: string }> {
    if (!isUuid(id)) {
      return { success: false, error: 'Geçersiz ilan ID formatı.' };
    }
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    const { data: listing, error: fetchErr } = await client
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) return { success: false, error: 'İlan bulunamadı.' };
    if (listing.seller_profile_id !== safeProfileId) return { success: false, error: 'Bu işlem için yetkiniz yok.' };

    const { error: updateErr } = await client
      .from('listings')
      .update({ status: 'SOLD', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) return { success: false, error: updateErr.message };

    // Clean up media through lifecycle with retry queue
    await this.cleanupListingMedia(id, listing.category, 'LISTING_SOLD');

    // Audit log
    await client.from('sold_listing_audit').insert({
      original_listing_id: id,
      seller_profile_id: safeProfileId,
      sold_at: new Date().toISOString(),
    });

    return { success: true };
  }

  async removeListing(id: string, profileId: string): Promise<{ success: boolean; error?: string }> {
    if (!isUuid(id)) {
      return { success: false, error: 'Geçersiz ilan ID formatı.' };
    }
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    const { data: listing, error: fetchErr } = await client
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) return { success: false, error: 'İlan bulunamadı.' };
    if (listing.seller_profile_id !== safeProfileId) return { success: false, error: 'Bu işlem için yetkiniz yok.' };

    const { error: updateErr } = await client
      .from('listings')
      .update({ status: 'REMOVED', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) return { success: false, error: updateErr.message };

    // Clean up media through lifecycle with retry queue (REMOVED flow parity)
    await this.cleanupListingMedia(id, listing.category, 'LISTING_REMOVED');

    return { success: true };
  }

  async getUserListings(
    profileId: string,
    onTiming?: (stage: 'query' | 'enrich' | 'map', duration: number) => void
  ): Promise<Listing[]> {
    const client = this.getClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];

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
        property_details (listing_id, property_type, floor, room_count, furnished, building_type, balcony),
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
    } finally {
      onTiming?.('enrich', performance.now() - enrichStartedAt);
    }

    const mapStartedAt = performance.now();
    try {
      return rows.map((item: any) => ({
        ...item,
        location: item.category === 'vehicle' ? null : item.location,
        previous_price: priceHistoryMap[item.id] && priceHistoryMap[item.id] !== item.price ? priceHistoryMap[item.id] : undefined,
        favorite_count: favCountMap[item.id] || 0,
        images: item.listing_images || [],
        status: getEffectiveListingStatus(item),
      }));
    } finally {
      onTiming?.('map', performance.now() - mapStartedAt);
    }
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
          property_details (listing_id, property_type, floor, room_count, furnished, building_type, balcony),
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
