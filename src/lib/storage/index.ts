import crypto from 'crypto';
import sharp from 'sharp';
import { StorageProvider, StorageUploadResult } from './types';
import { CloudflareR2StorageProvider } from './r2-provider';
import { MockStorageProvider } from './mock-provider';
import {
  optimizeAvatar,
  optimizeListingImage,
  optimizeCorporateLogo,
  optimizeCorporateBanner,
} from '@/lib/media/optimizer';

export * from './types';
export * from './r2-provider';
export * from './mock-provider';

let storageInstance: StorageProvider | null = null;

export function resetStorageInstance() {
  storageInstance = null;
}

export function getStorageProvider(): StorageProvider {
  if (storageInstance) return storageInstance;

  const isMock = process.env.USE_MOCK_STORAGE === 'true';

  if (!isMock) {
    const r2 = new CloudflareR2StorageProvider();
    if (!r2.isAvailable()) {
      throw new Error(
        'USE_MOCK_STORAGE is false, but Cloudflare R2 is missing required environment variables (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME). Silent fallback is disabled.'
      );
    }
    storageInstance = r2;
  } else {
    storageInstance = new MockStorageProvider();
  }

  return storageInstance;
}

function extractEntityId(idOrString: string): string {
  const uuidMatch = idOrString.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  const cleaned = idOrString.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'common';
}

/**
 * Uploads a vehicle or property listing photo.
 * - Server-side optimization via sharp
 * - WebP output, max 1600px long edge, quality 82
 * - Path: listings/{listingId}/{uuid}.webp
 * - Content-Type: image/webp
 */
export async function uploadListingImage(
  fileBuffer: Buffer | Uint8Array,
  listingIdOrFileName: string,
  _contentType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  try {
    const optimized = await optimizeListingImage(fileBuffer);
    const listingId = extractEntityId(listingIdOrFileName);
    const fileId = crypto.randomUUID();
    const key = `listings/${listingId}/${fileId}.webp`;

    const res = await provider.upload(optimized.buffer, {
      fileName: `${fileId}.webp`,
      contentType: optimized.mimeType,
      category: 'listing',
      folder: `listings/${listingId}`,
      key,
      maxSizeBytes: 2 * 1024 * 1024,
    });

    return {
      ...res,
      width: optimized.width,
      height: optimized.height,
      mimeType: optimized.mimeType,
      sizeBytes: optimized.sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      key: '',
      sizeBytes: fileBuffer.byteLength,
      error: err?.message || 'İlan görseli optimize edilemedi veya yüklenemedi.',
    };
  }
}

/**
 * Uploads a user character profile avatar.
 * - Server-side optimization via sharp
 * - WebP output, max 512x512, center crop, quality 82
 * - Path: avatars/{profileId}/{uuid}.webp
 * - Content-Type: image/webp
 */
export async function uploadProfileAvatar(
  fileBuffer: Buffer | Uint8Array,
  profileIdOrFileName: string,
  _contentType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  try {
    const optimized = await optimizeAvatar(fileBuffer);
    const profileId = extractEntityId(profileIdOrFileName);
    const fileId = crypto.randomUUID();
    const key = `avatars/${profileId}/${fileId}.webp`;

    const res = await provider.upload(optimized.buffer, {
      fileName: `${fileId}.webp`,
      contentType: optimized.mimeType,
      category: 'avatar',
      folder: `avatars/${profileId}`,
      key,
      maxSizeBytes: 2 * 1024 * 1024,
    });

    return {
      ...res,
      width: optimized.width,
      height: optimized.height,
      mimeType: optimized.mimeType,
      sizeBytes: optimized.sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      key: '',
      sizeBytes: fileBuffer.byteLength,
      error: err?.message || 'Profil avatarı optimize edilemedi veya yüklenemedi.',
    };
  }
}

/**
 * Uploads a corporate dealer logo.
 * - Server-side optimization via sharp
 * - WebP output, max 512x512, quality 85
 * - Path: dealers/logos/{corporateId}/{uuid}.webp
 * - Content-Type: image/webp
 */
export async function uploadCorporateLogo(
  fileBuffer: Buffer | Uint8Array,
  corporateIdOrFileName: string,
  _contentType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  try {
    const optimized = await optimizeCorporateLogo(fileBuffer);
    const corporateId = extractEntityId(corporateIdOrFileName);
    const fileId = crypto.randomUUID();
    const key = `dealers/logos/${corporateId}/${fileId}.webp`;

    const res = await provider.upload(optimized.buffer, {
      fileName: `${fileId}.webp`,
      contentType: optimized.mimeType,
      category: 'corporate_logo',
      folder: `dealers/logos/${corporateId}`,
      key,
      maxSizeBytes: 2 * 1024 * 1024,
    });

    return {
      ...res,
      width: optimized.width,
      height: optimized.height,
      mimeType: optimized.mimeType,
      sizeBytes: optimized.sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      key: '',
      sizeBytes: fileBuffer.byteLength,
      error: err?.message || 'Kurumsal logo optimize edilemedi veya yüklenemedi.',
    };
  }
}

/**
 * Uploads a corporate dealer store banner.
 * - Server-side optimization via sharp
 * - WebP output, max width 1600px, quality 82
 * - Path: dealers/banners/{corporateId}/{uuid}.webp
 * - Content-Type: image/webp
 */
export async function uploadCorporateBanner(
  fileBuffer: Buffer | Uint8Array,
  corporateIdOrFileName: string,
  _contentType: string = 'image/jpeg'
): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  try {
    const optimized = await optimizeCorporateBanner(fileBuffer);
    const corporateId = extractEntityId(corporateIdOrFileName);
    const fileId = crypto.randomUUID();
    const key = `dealers/banners/${corporateId}/${fileId}.webp`;

    const res = await provider.upload(optimized.buffer, {
      fileName: `${fileId}.webp`,
      contentType: optimized.mimeType,
      category: 'corporate_banner',
      folder: `dealers/banners/${corporateId}`,
      key,
      maxSizeBytes: 2 * 1024 * 1024,
    });

    return {
      ...res,
      width: optimized.width,
      height: optimized.height,
      mimeType: optimized.mimeType,
      sizeBytes: optimized.sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      key: '',
      sizeBytes: fileBuffer.byteLength,
      error: err?.message || 'Kurumsal banner optimize edilemedi veya yüklenemedi.',
    };
  }
}

/** Uploads a sanitized, square PNG favicon under a versioned immutable key. */
export async function uploadSiteFavicon(fileBuffer: Buffer | Uint8Array): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  try {
    if (fileBuffer.byteLength > 1024 * 1024) throw new Error('Favicon en fazla 1 MB olabilir.');
    const image = sharp(fileBuffer, { failOn: 'error', limitInputPixels: 16_777_216 });
    const metadata = await image.metadata();
    if (!metadata.format || !['png', 'jpeg', 'webp'].includes(metadata.format)) {
      throw new Error('Yalnızca PNG, JPEG veya WEBP görseli yüklenebilir.');
    }
    const output = await image.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const id = crypto.randomUUID();
    const key = `site/favicon/${id}.png`;
    const result = await provider.upload(output, {
      fileName: `${id}.png`, contentType: 'image/png', category: 'site_favicon', folder: 'site/favicon', key,
      maxSizeBytes: 2 * 1024 * 1024,
    });
    return { ...result, width: 512, height: 512, mimeType: 'image/png', sizeBytes: output.byteLength };
  } catch (error: any) {
    return { success: false, url: '', key: '', sizeBytes: fileBuffer.byteLength, error: error?.message || 'Favicon işlenemedi.' };
  }
}
