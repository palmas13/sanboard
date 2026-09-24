import { IListingRepository, CreateListingInput } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Listing, MemberListingDetail, PublicListingSummary } from '@/types';
import { ListingFilterParams } from '../../listings';
import { uploadListingImage } from '@/lib/storage';
import { deleteMediaSafely } from '@/lib/storage/lifecycle';
import { resolveUserId, resolveProfileId, isUuid } from '../../id-mapper';

export class SupabaseListingRepository implements IListingRepository {
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

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error fetching public listings: ${error.message}`);
    }

    const rows = data || [];
    const listingIds = rows.map((r: any) => r.id);

    // Batch query favorite counts and price histories
    const priceHistoryMap: Record<string, number> = {};
    const favCountMap: Record<string, number> = {};

    if (listingIds.length > 0) {
      const [histRes, favRes] = await Promise.all([
        client
          .from('listing_price_history')
          .select('listing_id, old_price, changed_at')
          .in('listing_id', listingIds)
          .order('changed_at', { ascending: false }),
        client
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

    const listings: PublicListingSummary[] = rows.map((item: any) => {
      const cover = item.listing_images?.find((img: any) => img.is_cover)?.storage_path || item.listing_images?.[0]?.storage_path;
      const prevPrice = priceHistoryMap[item.id];
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
        is_locked: true,
      };
    });

    return listings;
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
    const safeViewerUserId = await this.resolveAccountUserId(viewerUserId, viewerProfileId);

    const isOwner = Boolean(
      (safeViewerProfileId && listing.seller_profile_id === safeViewerProfileId) ||
      (safeViewerUserId && listing.seller?.user_id === safeViewerUserId)
    );

    // Fetch favorite count and user favorite status
    const [favCountRes, userFavRes, histRes] = await Promise.all([
      client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', id),
      safeViewerUserId
        ? client.from('favorites').select('id').eq('listing_id', id).eq('user_id', safeViewerUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      client
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
      const cover = listing.listing_images?.find((i: any) => i.is_cover)?.storage_path || listing.listing_images?.[0]?.storage_path;
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
        images: listing.listing_images || [],
        favorite_count: favoriteCount,
        is_favorited: isFavorited,
      },
      isLocked: false,
      isOwner,
    };
  }

  async createListing(input: CreateListingInput, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);

    // 1. Check and consume 1 available credit
    const { data: availableCredit, error: creditErr } = await client
      .from('listing_credits')
      .select('id')
      .eq('profile_id', safeProfileId)
      .eq('status', 'AVAILABLE')
      .limit(1)
      .maybeSingle();

    if (creditErr) {
      return { success: false, error: `Kredi kontrolü başarısız: ${creditErr.message}` };
    }

    if (!availableCredit) {
      return { success: false, error: 'Yayınlanabilir ilan hakkınız (krediniz) bulunmamaktadır. Lütfen önce bir paket satın alın.' };
    }

    const listingNumber = `#SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    // VEHICLE listings MUST have location = null; PROPERTY listings must have valid location
    const finalLocation = input.category === 'vehicle' ? null : (input.location?.trim() || null);

    const sellerType = input.seller_type || (input.corporate_profile_id ? 'CORPORATE' : 'INDIVIDUAL');
    const corporateProfileId = input.corporate_profile_id || null;

    const insertPayload: any = {
      listing_number: listingNumber,
      seller_profile_id: safeProfileId,
      seller_type: sellerType,
      corporate_profile_id: corporateProfileId,
      category: input.category,
      subcategory: input.subcategory,
      title: input.title,
      description: input.description,
      price: input.price,
      location: finalLocation,
      status: 'ACTIVE',
      published_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };

    let { data: newListing, error: insertError } = await client
      .from('listings')
      .insert(insertPayload)
      .select()
      .single();

    // Defensive fallback: if column seller_type doesn't exist yet on remote DB
    if (insertError && insertError.message?.includes('seller_type')) {
      delete insertPayload.seller_type;
      const retry = await client
        .from('listings')
        .insert(insertPayload)
        .select()
        .single();
      newListing = retry.data;
      insertError = retry.error;
    }

    // Defensive fallback: if database still has NOT NULL on location (pending migration execution)
    if (insertError && insertError.code === '23502' && insertError.message?.includes('location') && input.category === 'vehicle') {
      insertPayload.location = '';
      const retry = await client
        .from('listings')
        .insert(insertPayload)
        .select()
        .single();
      newListing = retry.data;
      insertError = retry.error;
    }

    if (insertError || !newListing) {
      return { success: false, error: insertError?.message || 'İlan oluşturulamadı.' };
    }

    // 2. Mark credit as USED
    await client
      .from('listing_credits')
      .update({
        status: 'USED',
        used_listing_id: newListing.id,
        used_at: now.toISOString(),
      })
      .eq('id', availableCredit.id);

    // 3. Insert vehicle or property details
    if (input.category === 'vehicle') {
      const { error: vehErr } = await client.from('vehicle_details').insert({
        listing_id: newListing.id,
        vehicle_category: input.subcategory,
        brand: input.brand || '',
        model: input.model || '',
        plate: input.plate || 'LS-TEMP',
        mileage: input.mileage || 0,
        engine_upgrade: input.engine_upgrade || 0,
        transmission_upgrade: input.transmission_upgrade || 0,
        brake_upgrade: input.brake_upgrade || 0,
        turbo: Boolean(input.turbo),
        subwoofer: Boolean(input.subwoofer),
        trade_available: Boolean(input.trade_available),
        lock_level: input.lock_level !== undefined && input.lock_level !== null ? Number(input.lock_level) : null,
        alarm_level: input.alarm_level !== undefined && input.alarm_level !== null ? Number(input.alarm_level) : null,
        anti_theft_level: input.anti_theft_level !== undefined && input.anti_theft_level !== null ? Number(input.anti_theft_level) : null,
        engine_health: input.engine_health !== undefined && input.engine_health !== null ? Number(input.engine_health) : null,
        suspension: input.suspension ? String(input.suspension).trim() : null,
        fuel_type: input.fuel_type ? String(input.fuel_type).trim() : null,
        factory_price: input.factory_price !== undefined && input.factory_price !== null ? Number(input.factory_price) : null,
      });
      if (vehErr) {
        return { success: false, error: `Araç detayları kaydedilemedi: ${vehErr.message}` };
      }
    } else {
      const { error: propErr } = await client.from('property_details').insert({
        listing_id: newListing.id,
        property_type: input.subcategory,
        floor: input.floor || 1,
        room_count: input.room_count || '1+1',
        furnished: Boolean(input.furnished),
        building_type: input.building_type || 'Normal',
        balcony: Boolean(input.balcony),
      });
      if (propErr) {
        return { success: false, error: `Mülk detayları kaydedilemedi: ${propErr.message}` };
      }
    }

    // 4. Handle images (upload base64 to R2 if needed)
    if (input.images && input.images.length > 0) {
      const processedImages: Array<{ storage_path: string; is_cover: boolean; sort_order: number; size_bytes: number }> = [];

      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        let finalPath = img.storage_path;

        if (finalPath.startsWith('data:image/')) {
          const matches = finalPath.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          if (matches) {
            const mime = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const uploadRes = await uploadListingImage(buffer, newListing.id, mime);
            if (uploadRes.success) {
              finalPath = uploadRes.url;
              img.size_bytes = uploadRes.sizeBytes;
            } else {
              return { success: false, error: `R2 görsel yükleme hatası: ${uploadRes.error}` };
            }
          }
        }

        processedImages.push({
          storage_path: finalPath,
          sort_order: img.sort_order ?? i,
          is_cover: Boolean(img.is_cover ?? i === 0),
          size_bytes: img.size_bytes || 500000,
        });
      }

      const { error: imgErr } = await client.from('listing_images').insert(
        processedImages.map((img) => ({
          listing_id: newListing.id,
          storage_path: img.storage_path,
          sort_order: img.sort_order,
          is_cover: img.is_cover,
          size_bytes: img.size_bytes,
        }))
      );

      if (imgErr) {
        return { success: false, error: `Fotoğraflar kaydedilemedi: ${imgErr.message}` };
      }
    }

    return { success: true, listing: newListing };
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

        // Price Change Notification: Triggered whenever newPrice !== oldPrice, exclude seller
        if (newPrice !== oldPrice) {
          const { data: favs } = await client.from('favorites').select('user_id').eq('listing_id', id);
          const sellerUserId = existing.seller?.user_id;

          if (favs && favs.length > 0) {
            const userIds = [...new Set(favs.map((f: any) => f.user_id).filter((uid: string) => uid && uid !== sellerUserId))];
            const isDrop = newPrice < oldPrice;
            for (const uid of userIds) {
              await client.from('notifications').insert({
                user_id: uid,
                type: isDrop ? 'LISTING_PRICE_DROP' : 'LISTING_PRICE_CHANGE',
                title: isDrop ? 'Favori İlanınızın Fiyatı Düştü' : 'Favori İlanınızın Fiyatı Değişti',
                message: `${existing.title} ilanının fiyatı $${oldPrice.toLocaleString('en-US')} → $${newPrice.toLocaleString('en-US')} olarak güncellendi.`,
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

    // 1. Fetch images to collect exact storage paths before deleting DB rows
    const { data: existingImages } = await client
      .from('listing_images')
      .select('storage_path')
      .eq('listing_id', id);

    const imageKeys = (existingImages || [])
      .map((img: any) => img.storage_path)
      .filter((k: any) => Boolean(k) && typeof k === 'string');

    // 2. Clean up favorites and images from database
    await client.from('favorites').delete().eq('listing_id', id);
    await client.from('listing_images').delete().eq('listing_id', id);

    // 3. Asynchronously / safely delete each physical image from R2
    const mediaType = listing.category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE';
    for (const key of imageKeys) {
      deleteMediaSafely(key, mediaType, 'LISTING_SOLD').catch((err) => {
        console.error(`Failed to clean R2 media for sold listing ${id}: ${key}`, err);
      });
    }

    // 4. Audit log
    await client.from('sold_listing_audit').insert({
      original_listing_id: id,
      seller_profile_id: safeProfileId,
      sold_at: new Date().toISOString(),
    });

    return { success: true };
  }

  async getUserListings(profileId: string): Promise<Listing[]> {
    const client = this.getClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];

    const { data, error } = await client
      .from('listings')
      .select(`
        *,
        vehicle_details (*),
        property_details (*),
        listing_images (*)
      `)
      .eq('seller_profile_id', safeProfileId)
      .is('corporate_profile_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching user listings: ${error.message}`);
    }

    const rows = data || [];
    const ids = rows.map((r: any) => r.id);

    const priceHistoryMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: histories } = await client
        .from('listing_price_history')
        .select('listing_id, old_price, changed_at')
        .in('listing_id', ids)
        .order('changed_at', { ascending: false });

      if (histories) {
        for (const h of histories) {
          if (!priceHistoryMap[h.listing_id]) priceHistoryMap[h.listing_id] = h.old_price;
        }
      }
    }

    return rows.map((item: any) => ({
      ...item,
      location: item.category === 'vehicle' ? null : item.location,
      previous_price: priceHistoryMap[item.id] && priceHistoryMap[item.id] !== item.price ? priceHistoryMap[item.id] : undefined,
      images: item.listing_images || [],
    }));
  }

  async getCorporateListings(corporateProfileId: string): Promise<Listing[]> {
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
      query = query.eq('corporate_profile_id', safeCorporateId);
    } else {
      query = query.or(`corporate_profile_id.eq.${corporateProfileId}`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase error fetching corporate listings: ${error.message}`);
    }

    const rows = data || [];
    const ids = rows.map((r: any) => r.id);

    const priceHistoryMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: histories } = await client
        .from('listing_price_history')
        .select('listing_id, old_price, changed_at')
        .in('listing_id', ids)
        .order('changed_at', { ascending: false });

      if (histories) {
        for (const h of histories) {
          if (!priceHistoryMap[h.listing_id]) priceHistoryMap[h.listing_id] = h.old_price;
        }
      }
    }

    return rows.map((item: any) => ({
      ...item,
      location: item.category === 'vehicle' ? null : item.location,
      previous_price: priceHistoryMap[item.id] && priceHistoryMap[item.id] !== item.price ? priceHistoryMap[item.id] : undefined,
      images: item.listing_images || [],
    }));
  }

  async toggleFavorite(arg1: string, arg2: string, legacyUserId?: string): Promise<{ isFavorited: boolean; count: number }> {
    const client = this.getAdminClient();

    // Support both toggleFavorite(listingId, userId) and legacy toggleFavorite(profileId, listingId, userId)
    let listingId = arg1;
    let rawUserId = arg2;

    if (legacyUserId) {
      listingId = arg2;
      rawUserId = legacyUserId;
    }

    const safeUserId = await this.resolveAccountUserId(rawUserId);

    if (!safeUserId || !isUuid(safeUserId) || !isUuid(listingId)) {
      return { isFavorited: false, count: 0 };
    }

    // Check by account user_id and listing_id
    const { data: existing } = await client
      .from('favorites')
      .select('id')
      .eq('user_id', safeUserId)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (existing) {
      // Remove favorite
      await client.from('favorites').delete().eq('id', existing.id);
      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: false, count: count || 0 };
    } else {
      // Add favorite (strictly user_id and listing_id; no client profile required)
      const { error: insErr } = await client.from('favorites').insert({
        user_id: safeUserId,
        listing_id: listingId,
      });

      // Defensive fallback if profile_id constraint is still active in DB before migration run
      if (insErr && insErr.message?.includes('profile_id')) {
        const safeProfileId = await this.resolveCharacterProfileId(undefined, safeUserId);
        await client.from('favorites').insert({
          user_id: safeUserId,
          profile_id: safeProfileId || undefined,
          listing_id: listingId,
        });
      }

      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: true, count: count || 1 };
    }
  }

  async removeFavorite(listingId: string, userId: string): Promise<{ success: boolean; count: number }> {
    const client = this.getAdminClient();
    const safeUserId = await this.resolveAccountUserId(userId);

    if (!safeUserId || !isUuid(safeUserId) || !isUuid(listingId)) {
      return { success: false, count: 0 };
    }

    await client
      .from('favorites')
      .delete()
      .eq('user_id', safeUserId)
      .eq('listing_id', listingId);

    const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
    return { success: true, count: count || 0 };
  }

  async getUserFavorites(arg1: string, legacyUserId?: string): Promise<(Listing & { isExpired: boolean })[]> {
    const client = this.getAdminClient();

    // Support both getUserFavorites(userId) and legacy getUserFavorites(profileId, userId)
    const rawUserId = legacyUserId || arg1;
    const safeUserId = await this.resolveAccountUserId(rawUserId);

    if (!safeUserId || !isUuid(safeUserId)) {
      return [];
    }

    // Query strictly by user_id
    const { data, error } = await client
      .from('favorites')
      .select(`
        listing_id,
        listings (
          *,
          vehicle_details (*),
          property_details (*),
          listing_images (*)
        )
      `)
      .eq('user_id', safeUserId);

    if (error) {
      throw new Error(`Supabase error fetching favorites: ${error.message}`);
    }

    const rows = (data || []).filter((item: any) => item.listings).map((item: any) => item.listings);
    const ids = rows.map((r: any) => r.id);

    const priceHistoryMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: histories } = await client
        .from('listing_price_history')
        .select('listing_id, old_price, changed_at')
        .in('listing_id', ids)
        .order('changed_at', { ascending: false });

      if (histories) {
        for (const h of histories) {
          if (!priceHistoryMap[h.listing_id]) priceHistoryMap[h.listing_id] = h.old_price;
        }
      }
    }

    const now = new Date();
    return rows.map((listing: any) => ({
      ...listing,
      location: listing.category === 'vehicle' ? null : listing.location,
      previous_price: priceHistoryMap[listing.id] && priceHistoryMap[listing.id] !== listing.price ? priceHistoryMap[listing.id] : undefined,
      images: listing.listing_images || [],
      isExpired: listing.expires_at ? new Date(listing.expires_at) < now : false,
    }));
  }
}
