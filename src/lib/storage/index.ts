import { StorageProvider } from './types';
import { CloudflareR2StorageProvider } from './r2-provider';
import { MockStorageProvider } from './mock-provider';

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

/**
 * Uploads a vehicle or property listing photo (max 2MB, JPG/PNG/WEBP).
 */
export async function uploadListingImage(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'image/jpeg'
) {
  const provider = getStorageProvider();
  return provider.upload(fileBuffer, {
    fileName,
    contentType,
    category: 'listing',
    folder: 'listings',
    maxSizeBytes: 2 * 1024 * 1024,
  });
}

/**
 * Uploads a user character profile avatar (max 2MB, JPG/PNG/WEBP).
 */
export async function uploadProfileAvatar(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'image/jpeg'
) {
  const provider = getStorageProvider();
  return provider.upload(fileBuffer, {
    fileName,
    contentType,
    category: 'avatar',
    folder: 'avatars',
    maxSizeBytes: 2 * 1024 * 1024,
  });
}

/**
 * Uploads a corporate dealer logo (max 2MB).
 */
export async function uploadCorporateLogo(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'image/jpeg'
) {
  const provider = getStorageProvider();
  return provider.upload(fileBuffer, {
    fileName,
    contentType,
    category: 'corporate_logo',
    folder: 'dealers/logos',
    maxSizeBytes: 2 * 1024 * 1024,
  });
}

/**
 * Uploads a corporate dealer store banner (max 2MB).
 */
export async function uploadCorporateBanner(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'image/jpeg'
) {
  const provider = getStorageProvider();
  return provider.upload(fileBuffer, {
    fileName,
    contentType,
    category: 'corporate_banner',
    folder: 'dealers/banners',
    maxSizeBytes: 2 * 1024 * 1024,
  });
}
