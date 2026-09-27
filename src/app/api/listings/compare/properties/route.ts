import { NextRequest, NextResponse } from 'next/server';
import { getPropertyCompareListings } from '@/lib/db/listings';

export async function GET(request: NextRequest) {
  try {
    const ids = (new URL(request.url).searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 3);
    return NextResponse.json({ success: true, listings: await getPropertyCompareListings(ids) });
  } catch (error) {
    console.error('Error fetching property compare listings:', error);
    return NextResponse.json({ success: false, error: 'Mülk karşılaştırma verileri getirilemedi.' }, { status: 500 });
  }
}