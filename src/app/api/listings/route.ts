import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository, getDealerRepository } from '@/lib/db/repositories';
import { listingUnionSchema } from '@/lib/validations/listing';
import { getServerSession } from '@/lib/auth/session';
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
    const session = await getServerSession(req);
    const body = await req.json();
    const { sellerProfileId, corporate, isCorporate, ...listingData } = body;

    const trustedProfileId = session?.profileId || sellerProfileId;

    if (!trustedProfileId) {
      return NextResponse.json(
        { error: 'Satıcı profili zorunludur. Lütfen oturum açın.' },
        { status: 401 }
      );
    }

    // Corporate Seller Authorization Check (Section 6 & 7)
    const wantsCorporate = corporate === true || isCorporate === true || listingData.seller_type === 'CORPORATE';
    if (wantsCorporate) {
      const { resolveCorporateEligibility } = await import('@/lib/dealers/eligibility');
      const eligibility = await resolveCorporateEligibility(trustedProfileId);
      if (!eligibility.eligible || !eligibility.dealer) {
        return NextResponse.json(
          {
            error: eligibility.message || 'Kurumsal ilan yayınlama şartlarını sağlamıyorsunuz.',
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
    const session = await getServerSession(req);
    const body = await req.json();
    const { id, sellerProfileId, userId: explicitUserId, ...listingData } = body;
    const userId = session?.userId || explicitUserId || req.cookies.get('sanboard_user_id')?.value;
    const role = session?.role || req.cookies.get('sanboard_role')?.value;
    const trustedProfileId = session?.profileId || sellerProfileId;

    if (!id || !trustedProfileId) {
      return NextResponse.json(
        { error: 'id ve sellerProfileId zorunludur.' },
        { status: 400 }
      );
    }

    const parsed = listingUnionSchema.safeParse(listingData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Geçersiz ilan verileri.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const repo = getListingRepository();
    const result = await repo.updateListing(id, parsed.data, trustedProfileId, userId, role);

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
