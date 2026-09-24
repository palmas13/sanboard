import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageDeleteResult } from './types';

export class MockStorageProvider implements StorageProvider {
  isAvailable(): boolean {
    return true;
  }

  getPublicUrl(key: string): string {
    return `/mock-storage/${key}`;
  }

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
    const key = `${folder}/${timestamp}-${sanitizedName}`;

    // For mock development, create a valid Base64 data URL so images render immediately in browser
    const base64 = Buffer.from(fileBuffer).toString('base64');
    const dataUrl = `data:${options.contentType || 'image/jpeg'};base64,${base64}`;

    return {
      success: true,
      url: dataUrl,
      key,
      sizeBytes: fileBuffer.byteLength,
    };
  }

  async delete(_key: string): Promise<StorageDeleteResult> {
    return { success: true };
  }
}
