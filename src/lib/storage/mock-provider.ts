import {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDeleteResult,
  StorageDeleteManyResult,
} from './types';

export interface MockStorageProviderOptions {
  /** Keys whose deletion should fail, for testing partial-failure handling. */
  failDeletesFor?: Iterable<string>;
}

export class MockStorageProvider implements StorageProvider {
  private readonly failedDeleteKeys: Set<string>;

  constructor(options: MockStorageProviderOptions = {}) {
    this.failedDeleteKeys = new Set(options.failDeletesFor);
  }
  isAvailable(): boolean {
    return true;
  }

  getPublicUrl(key: string): string {
    return `/mock-storage/${key}`;
  }

  private objects: Map<string, { size: number; lastModified: Date }> = new Map();

  async upload(
    fileBuffer: Buffer | Uint8Array,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const maxLimit = options.maxSizeBytes || 2 * 1024 * 1024;
    if (fileBuffer.byteLength > maxLimit) {
      return {
        success: false,
        url: '',
        key: '',
        sizeBytes: fileBuffer.byteLength,
        error: `Dosya boyutu sınırı aşıldı. Maksimum: ${Math.round(maxLimit / 1024 / 1024)}MB.`,
      };
    }

    const timestamp = Date.now();
    const sanitizedName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = options.folder || options.category;
    const key = options.key || `${folder}/${timestamp}-${sanitizedName}`;

    // For mock development, create a valid Base64 data URL so images render immediately in browser
    const base64 = Buffer.from(fileBuffer).toString('base64');
    const dataUrl = `data:${options.contentType || 'image/webp'};base64,${base64}`;

    this.objects.set(key, { size: fileBuffer.byteLength, lastModified: new Date() });

    return {
      success: true,
      url: dataUrl,
      key,
      sizeBytes: fileBuffer.byteLength,
      mimeType: options.contentType || 'image/webp',
    };
  }

  async delete(key: string): Promise<StorageDeleteResult> {
    if (this.failedDeleteKeys.has(key)) {
      return { success: false, error: `Injected delete failure for ${key}` };
    }
    // Deleting a missing object is intentionally idempotent.
    this.objects.delete(key);
    return { success: true };
  }

  async deleteMany(keys: string[]): Promise<StorageDeleteManyResult> {
    const results = await Promise.all(
      keys.map(async (key) => ({ key, ...(await this.delete(key)) }))
    );
    return {
      success: results.every((result) => result.success),
      results,
    };
  }

  async list(prefix?: string): Promise<{
    objects: { key: string; size: number; lastModified?: Date }[];
    isTruncated: boolean;
  }> {
    const res: { key: string; size: number; lastModified?: Date }[] = [];
    for (const [k, v] of this.objects.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        res.push({ key: k, size: v.size, lastModified: v.lastModified });
      }
    }
    return { objects: res, isTruncated: false };
  }
}
