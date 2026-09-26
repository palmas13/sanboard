import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository, getDealerRepository } from '@/lib/db/repositories';
import { listingUnionSchema } from '@/lib/validations/listing';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { revalidatePath } from 'next/cache';

// Public listings search endpoint
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as any;
    const subcategory = searchParams.get('subcategory') || undefined;
    const query = searchParams.get('q') || undefined;
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const location = searchParams.get('location') || undefined;
    const brand = searchParams.get('brand') || undefined;
    const model = searchParams.get('model') || undefined;
    const sort = searchParams.get('sort') as any;

    const repo = getListingRepository();
    const listings = await repo.getPublicListings({
      category,
      subcategory,
      query,
      minPrice,
      maxPrice,
      location,
      brand,
      model,
      sort,
    });

    return NextResponse.json(listings);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlanlar getirilemedi.' },
      { status: 500 }
    );
  }
}

// Create new listing consuming 1 credit
export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const body = await req.json();
    const { sellerProfileId: _sellerProfileId, profileId: _profileId, userId: _userId, corporate, isCorporate, ...listingData } = body;
    const trustedProfileId = actor.profileId;

    // Corporate Seller Authorization Check (Section 6 & 7)
    const wantsCorporate = corporate === true || isCorporate === true || listingData.seller_type === 'CORPORATE';
    if (wantsCorporate) {
      const { resolveCorporateEligibility } = await import('@/lib/dealers/eligibility');
      const eligibility = await resolveCorporateEligibility(trustedProfileId);
      if (!eligibility.eligible || !eligibility.dealer) {
        let businessError = 'Kurumsal ilan yayınlama şartlarını sağlamıyorsunuz.';
        if (eligibility.reason === 'NO_STORE' || eligibility.reason === 'STORE_DELETED') {
          businessError = 'Mağaza bulunamadı.';
        } else if (eligibility.reason === 'STORE_SUSPENDED') {
          businessError = 'Mağaza askıya alınmış.';
        } else if (eligibility.reason === 'SUBSCRIPTION_INACTIVE') {
          businessError = 'Üyelik aktif değil.';
        } else if (eligibility.reason === 'SUBSCRIPTION_EXPIRED') {
          businessError = 'Üyelik süresi dolmuş.';
        }
        return NextResponse.json(
          {
            error: businessError,
            reason: eligibility.reason,
          },
          { status: 403 }
        );
      }
      listingData.seller_type = 'CORPORATE';
      listingData.corporate_profile_id = eligibility.dealer.id;
    } else {
      listingData.seller_type = 'INDIVIDUAL';
      listingData.corporate_profile_id = null;
    }

    // Server-side Zod validation
    const parsed = listingUnionSchema.safeParse(listingData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Geçersiz ilan verileri.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const repo = getListingRepository();
    const result = await repo.createListing(parsed.data, trustedProfileId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Corporate Follower Notification (Section 18)
    if (result.listing && result.listing.seller_type === 'CORPORATE' && result.listing.corporate_profile_id) {
      try {
        const dealerRepo = getDealerRepository();
        const [dealer, followers] = await Promise.all([
          dealerRepo.getDealerById(result.listing.corporate_profile_id),
          dealerRepo.getFollowers ? dealerRepo.getFollowers(result.listing.corporate_profile_id) : Promise.resolve([]),
        ]);

        if (dealer && followers.length > 0) {
          const notifRepo = (await import('@/lib/db/repositories')).getNotificationRepository();
          // Directly notify follower character profiles strictly (Section 17)
          const validFollowers = followers.filter((f) => f.id !== trustedProfileId);

          await Promise.all(
            validFollowers.map((f) =>
              notifRepo.createNotification({
                recipient_profile_id: f.id,
                user_id: f.user_id,
                type: 'NEW_CORPORATE_LISTING',
                title: `${dealer.company_name} yeni bir ilan yayınladı`,
                message: `Takip ettiğiniz ${dealer.company_name} yeni bir ilan yayınladı: "${result.listing!.title}"`,
                entity_type: 'listing',
                entity_id: result.listing!.id,
              })
            )
          );
        }
      } catch (notifErr) {
        console.error('Failed to dispatch corporate follower notifications:', notifErr);
      }
    }

    try {
      revalidatePath('/');
      revalidatePath('/arac');
      revalidatePath('/mulk');
    } catch {}

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan oluşturulamadı.' },
      { status: 500 }
    );
  }
}

// Update existing listing (owner only)
export async function PUT(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const body = await req.json();
    const { id, sellerProfileId: _sellerProfileId, profileId: _profileId, userId: _userId, ...listingData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id zorunludur.' },
        { status: 400 }
      );
    }

    const parsed = listingUnionSchema.safeParse(listingData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Geçersiz ilan verileri.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const repo = getListingRepository();
    const result = await repo.updateListing(id, parsed.data, actor.profileId, actor.userId, actor.role);

    if (!result.success) {
      const isForbidden = result.error?.includes('yetkiniz yok');
      return NextResponse.json({ error: result.error }, { status: isForbidden ? 403 : 400 });
    }

    try {
      revalidatePath('/');
      revalidatePath('/arac');
      revalidatePath('/mulk');
      revalidatePath(`/ilan/${id}`);
      revalidatePath('/hesabim/ilanlarim');
    } catch {}

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan güncellenemedi.' },
      { status: 500 }
    );
  }
}
