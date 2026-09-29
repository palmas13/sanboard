import { ImageResponse } from 'next/og';
import { SanboardOgImage } from '@/components/seo/SanboardOgImage';

export const alt = "Sanboard – Los Santos'un İlan Platformu";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(<SanboardOgImage />, size);
}
