import { IListingRepository, CreateListingInput } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';
import { Listing, MemberListingDetail, PublicListingSummary } from '@/types';
import { ListingFilterParams } from '../../listings';
import { uploadListingImage } from '@/lib/storage';
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

    const { data, error } = await query.order('published_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching public listings: ${error.message}`);
    }

    const listings: PublicListingSummary[] = (data || []).map((item: any) => {
      const cover = item.listing_images?.find((img: any) => img.is_cover)?.storage_path || item.listing_images?.[0]?.storage_path;
      return {
        id: item.id,
        listing_number: item.listing_number,
        category: item.category,
        subcategory: item.subcategory,
        title: item.title,
        price: item.price,
        location: item.location,
        published_at: item.published_at,
        cover_image: cover,
        favorite_count: 0,
        is_locked: true,
      };
    });

    return listings;
  }

  async getListingById(id: string, viewerProfileId?: string): Promise<{ listing: MemberListingDetail | PublicListingSummary | null; isLocked: boolean; isOwner: boolean }> {
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

    const isOwner = Boolean(viewerProfileId && listing.seller_profile_id === viewerProfileId);

    // If unauthenticated viewer, return sanitized public summary
    if (!viewerProfileId) {
      const cover = listing.listing_images?.find((i: any) => i.is_cover)?.storage_path || listing.listing_images?.[0]?.storage_path;
      return {
        listing: {
          id: listing.id,
          listing_number: listing.listing_number,
          category: listing.category,
          subcategory: listing.subcategory,
          title: listing.title,
          price: listing.price,
          location: listing.location,
          published_at: listing.published_at,
          cover_image: cover,
          favorite_count: 0,
          is_locked: true,
        },
        isLocked: true,
        isOwner: false,
      };
    }

    return {
      listing: {
        ...listing,
        images: listing.listing_images || [],
      },
      isLocked: false,
      isOwner,
    };
  }

  async createListing(input: CreateListingInput, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    const client = this.getAdminClient();

    // 1. Check and consume 1 available credit
    const { data: availableCredit, error: creditErr } = await client
      .from('listing_credits')
      .select('id')
      .eq('profile_id', profileId)
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

    const { data: newListing, error: insertError } = await client
      .from('listings')
      .insert({
        listing_number: listingNumber,
        seller_profile_id: profileId,
        category: input.category,
        subcategory: input.subcategory,
        title: input.title,
        description: input.description,
        price: input.price,
        location: input.location || '',
        status: 'ACTIVE',
        published_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .select()
      .single();

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

        // If client submitted base64 data url, upload to R2
        if (finalPath.startsWith('data:image/')) {
          const matches = finalPath.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          if (matches) {
            const mime = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const uploadRes = await uploadListingImage(buffer, `listing-${Date.now()}-${i}.jpg`, mime);
            if (uploadRes.success) {
              finalPath = uploadRes.url;
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

  async updateListing(id: string, input: Partial<CreateListingInput>, profileId: string): Promise<{ success: boolean; listing?: Listing; error?: string }> {
    const client = this.getAdminClient();

    const { data: existing, error: fetchErr } = await client
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: 'İlan bulunamadı.' };
    }

    if (existing.seller_profile_id !== profileId) {
      return { success: false, error: 'Bu ilanı düzenleme yetkiniz yok.' };
    }

    if (existing.status === 'SOLD' || existing.status === 'REMOVED') {
      return { success: false, error: 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.' };
    }

    // Price Drop Detection
    const oldPrice = existing.price;
    const newPrice = input.price !== undefined ? input.price : oldPrice;

    if (newPrice < oldPrice) {
      // Record price history
      await client.from('listing_price_history').insert({
        listing_id: id,
        old_price: oldPrice,
        new_price: newPrice,
      });

      // Find favorited users to notify (excluding seller)
      const { data: favs } = await client.from('favorites').select('user_id').eq('listing_id', id);
      const { data: sellerProf } = await client.from('character_profiles').select('user_id').eq('id', profileId).single();
      const sellerUserId = sellerProf?.user_id;

      if (favs && favs.length > 0) {
        const userIds = [...new Set(favs.map((f: any) => f.user_id).filter((uid: string) => uid && uid !== sellerUserId))];
        for (const uid of userIds) {
          await client.from('notifications').insert({
            user_id: uid,
            type: 'LISTING_PRICE_DROP',
            title: 'Favori İlanınızın Fiyatı Düştü',
            message: `${existing.title} ilanının fiyatı $${oldPrice.toLocaleString('en-US')} → $${newPrice.toLocaleString('en-US')} olarak güncellendi.`,
            entity_type: 'listing',
            entity_id: id,
            metadata: { listingId: id, oldPrice, newPrice },
          });
        }
      }
    }

    // Update main listing table (without extending published_at / expires_at)
    const updateData: any = { updated_at: new Date().toISOString() };
    if (input.title) updateData.title = input.title;
    if (input.description) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.location !== undefined) updateData.location = input.location;

    const { data: updated, error: updateErr } = await client
      .from('listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: `İlan güncellenemedi: ${updateErr.message}` };
    }

    // Update category details if provided
    if (existing.category === 'vehicle') {
      const vehUpdate: any = {};
      if (input.brand !== undefined) vehUpdate.brand = input.brand;
      if (input.model !== undefined) vehUpdate.model = input.model;
      if (input.mileage !== undefined) vehUpdate.mileage = input.mileage;
      if (input.turbo !== undefined) vehUpdate.turbo = Boolean(input.turbo);
      if (input.subwoofer !== undefined) vehUpdate.subwoofer = Boolean(input.subwoofer);
      if (input.trade_available !== undefined) vehUpdate.trade_available = Boolean(input.trade_available);

      if (Object.keys(vehUpdate).length > 0) {
        await client.from('vehicle_details').update(vehUpdate).eq('listing_id', id);
      }
    } else {
      const propUpdate: any = {};
      if (input.floor !== undefined) propUpdate.floor = input.floor;
      if (input.room_count !== undefined) propUpdate.room_count = input.room_count;
      if (input.furnished !== undefined) propUpdate.furnished = Boolean(input.furnished);
      if (input.balcony !== undefined) propUpdate.balcony = Boolean(input.balcony);

      if (Object.keys(propUpdate).length > 0) {
        await client.from('property_details').update(propUpdate).eq('listing_id', id);
      }
    }

    // Update images if provided
    if (input.images) {
      await client.from('listing_images').delete().eq('listing_id', id);
      for (let i = 0; i < input.images.length; i++) {
        let finalPath = input.images[i].storage_path;
        if (finalPath.startsWith('data:image/')) {
          const matches = finalPath.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
          if (matches) {
            const buffer = Buffer.from(matches[2], 'base64');
            const uploadRes = await uploadListingImage(buffer, `listing-${id}-${i}.jpg`, matches[1]);
            if (uploadRes.success) finalPath = uploadRes.url;
          }
        }

        await client.from('listing_images').insert({
          listing_id: id,
          storage_path: finalPath,
          sort_order: input.images[i].sort_order ?? i,
          is_cover: Boolean(input.images[i].is_cover ?? i === 0),
          size_bytes: input.images[i].size_bytes || 500000,
        });
      }
    }

    return { success: true, listing: updated };
  }

  async markListingAsSold(id: string, profileId: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();

    const { data: listing, error: fetchErr } = await client
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) return { success: false, error: 'İlan bulunamadı.' };
    if (listing.seller_profile_id !== profileId) return { success: false, error: 'Bu işlem için yetkiniz yok.' };

    const { error: updateErr } = await client
      .from('listings')
      .update({ status: 'SOLD', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) return { success: false, error: updateErr.message };

    // Clean up favorites and images
    await client.from('favorites').delete().eq('listing_id', id);
    await client.from('listing_images').delete().eq('listing_id', id);

    // Audit log
    await client.from('sold_listing_audit').insert({
      original_listing_id: id,
      seller_profile_id: profileId,
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
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching user listings: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      images: item.listing_images || [],
    }));
  }

  async toggleFavorite(profileId: string, listingId: string, userId?: string): Promise<{ isFavorited: boolean; count: number }> {
    const client = this.getAdminClient();

    const safeProfileId = resolveProfileId(profileId);
    const safeUserId = userId ? resolveUserId(userId) : undefined;
    const lookupField = (safeUserId && isUuid(safeUserId)) ? 'user_id' : 'profile_id';
    const lookupVal = (lookupField === 'user_id' ? safeUserId : safeProfileId);

    if (!isUuid(lookupVal)) {
      return { isFavorited: false, count: 0 };
    }

    const { data: existing } = await client
      .from('favorites')
      .select('id')
      .eq(lookupField, lookupVal)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (existing) {
      await client.from('favorites').delete().eq('id', existing.id);
      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: false, count: count || 0 };
    } else {
      await client.from('favorites').insert({
        profile_id: isUuid(safeProfileId) ? safeProfileId : undefined,
        user_id: (safeUserId && isUuid(safeUserId)) ? safeUserId : undefined,
        listing_id: listingId,
      });
      const { count } = await client.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', listingId);
      return { isFavorited: true, count: count || 1 };
    }
  }

  async getUserFavorites(profileId: string, userId?: string): Promise<(Listing & { isExpired: boolean })[]> {
    const client = this.getClient();

    const safeProfileId = resolveProfileId(profileId);
    const safeUserId = userId ? resolveUserId(userId) : undefined;
    const lookupField = (safeUserId && isUuid(safeUserId)) ? 'user_id' : 'profile_id';
    const lookupVal = (lookupField === 'user_id' ? safeUserId : safeProfileId);

    if (!isUuid(lookupVal)) {
      return [];
    }

    const { data, error } = await client
      .from('favorites')
      .select(`
        listings (
          *,
          vehicle_details (*),
          property_details (*),
          listing_images (*)
        )
      `)
      .eq(lookupField, lookupVal);

    if (error) {
      throw new Error(`Supabase error fetching favorites: ${error.message}`);
    }

    const now = new Date();
    return (data || [])
      .filter((item: any) => item.listings)
      .map((item: any) => ({
        ...item.listings,
        images: item.listings.listing_images || [],
        isExpired: item.listings.expires_at ? new Date(item.listings.expires_at) < now : false,
      }));
  }
}
