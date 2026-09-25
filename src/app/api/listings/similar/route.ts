import { NextRequest, NextResponse } from 'next/server';
import { getSimilarListings } from '@/lib/db/listings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 4;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Listing ID is required' }, { status: 400 });
    }

    const listings = await getSimilarListings(id, isNaN(limit) ? 4 : limit);
    return NextResponse.json({ success: true, listings });
  } catch (error: any) {
    console.error('Error fetching similar listings:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
