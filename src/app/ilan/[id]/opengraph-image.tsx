import { ImageResponse } from 'next/og';
import { SanboardOgImage } from '@/components/seo/SanboardOgImage';
import { resolveListingShareData } from '@/lib/seo/listing-share';

export const alt = 'Sanboard ilan önizlemesi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 30;

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await resolveListingShareData(id);
  return new ImageResponse(<SanboardOgImage listing={listing} />, size);
}
