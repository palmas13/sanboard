import {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDeleteResult,
  StorageDeleteManyResult,
  StorageCopyResult,
} from './types';

export interface MockStorageProviderOptions {
  /** Keys whose deletion should fail, for testing partial-failure handling. */
  failDeletesFor?: Iterable<string>;
  failCopiesFor?: Iterable<string>;
}

export class MockStorageProvider implements StorageProvider {
  private readonly failedDeleteKeys: Set<string>;
  private readonly failedCopyKeys: Set<string>;

  constructor(options: MockStorageProviderOptions = {}) {
    this.failedDeleteKeys = new Set(options.failDeletesFor);
    this.failedCopyKeys = new Set(options.failCopiesFor);
  }
  isAvailable(): boolean {
    return true;
  }

  getPublicUrl(key: string): string {
    return `/mock-storage/${key}`;
  }

  private objects: Map<string, { size: number; lastModified: Date; mimeType?: string }> = new Map();

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

    this.objects.set(key, { size: fileBuffer.byteLength, lastModified: new Date(), mimeType: options.contentType });

    return {
      success: true,
      url: dataUrl,
      key,
      sizeBytes: fileBuffer.byteLength,
      mimeType: options.contentType || 'image/webp',
    };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<StorageCopyResult> {
    const source = sourceKey.replace(/^\/+/, '');
    const destination = destinationKey.replace(/^\/+/, '');
    if (this.failedCopyKeys.has(source) || this.failedCopyKeys.has(destination)) {
      return { success: false, sourceKey: source, destinationKey: destination, destinationExists: false, error: `Injected copy failure for ${source}` };
    }
    const existing = this.objects.get(destination);
    if (existing) {
      return { success: true, sourceKey: source, destinationKey: destination, destinationExists: true, sizeBytes: existing.size, mimeType: existing.mimeType };
    }
    const object = this.objects.get(source);
    if (!object) {
      return { success: false, sourceKey: source, destinationKey: destination, destinationExists: false, error: 'Source object not found.' };
    }
    this.objects.set(destination, { ...object, lastModified: new Date() });
    return { success: true, sourceKey: source, destinationKey: destination, destinationExists: true, sizeBytes: object.size, mimeType: object.mimeType };
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
