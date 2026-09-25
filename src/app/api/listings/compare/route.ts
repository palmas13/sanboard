import { NextRequest, NextResponse } from 'next/server';
import { getCompareListings } from '@/lib/db/listings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json({ success: true, listings: [] });
    }

    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2); // Max 2 for current version

    const listings = await getCompareListings(ids);
    return NextResponse.json({ success: true, listings });
  } catch (error: any) {
    console.error('Error fetching compare listings:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
