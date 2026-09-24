import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { listingUnionSchema } from '@/lib/validations/listing';

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
    const body = await req.json();
    const { sellerProfileId, ...listingData } = body;

    if (!sellerProfileId) {
      return NextResponse.json(
        { error: 'Satıcı profili zorunludur.' },
        { status: 400 }
      );
    }

    // Server-side Zod validation
    const parsed = listingUnionSchema.safeParse(listingData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Geçersiz ilan verileri.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const repo = getListingRepository();
    const result = await repo.createListing(parsed.data, sellerProfileId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

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
    const body = await req.json();
    const { id, sellerProfileId, ...listingData } = body;

    if (!id || !sellerProfileId) {
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
    const result = await repo.updateListing(id, parsed.data, sellerProfileId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan güncellenemedi.' },
      { status: 500 }
    );
  }
}
