export type StorageCategory = 'listing' | 'avatar' | 'corporate_logo' | 'corporate_banner';

export interface StorageUploadOptions {
  fileName: string;
  contentType: string;
  category: StorageCategory;
  folder?: string;
  key?: string;
  maxSizeBytes?: number;
}

export interface StorageUploadResult {
  success: boolean;
  url: string;
  key: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  mimeType?: string;
  error?: string;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

export interface StorageProvider {
  /**
   * Uploads binary file buffer to storage.
   */
  upload(
    fileBuffer: Buffer | Uint8Array,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  /**
   * Deletes a file from storage by its key/path.
   */
  delete(key: string): Promise<StorageDeleteResult>;

  /**
   * Resolves the public CDN/access URL for a given storage key.
   */
  getPublicUrl(key: string): string;

  /**
   * Returns true if provider is configured and available for live uploads.
   */
  isAvailable(): boolean;

  /**
   * Lists stored objects with pagination.
   */
  list?(
    prefix?: string,
    continuationToken?: string
  ): Promise<{
    objects: { key: string; size: number; lastModified?: Date }[];
    nextContinuationToken?: string;
    isTruncated: boolean;
  }>;
}
