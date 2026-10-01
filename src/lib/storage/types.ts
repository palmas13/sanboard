export type StorageCategory = 'listing' | 'avatar' | 'corporate_logo' | 'corporate_banner' | 'site_favicon';

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

export interface StorageCopyResult {
  success: boolean;
  sourceKey: string;
  destinationKey: string;
  destinationExists: boolean;
  sizeBytes?: number;
  mimeType?: string;
  error?: string;
}

export interface StorageDeleteManyItemResult extends StorageDeleteResult {
  /** The key (or URL) supplied by the caller. */
  key: string;
}

export interface StorageDeleteManyResult {
  /** False when at least one requested key could not be deleted. */
  success: boolean;
  results: StorageDeleteManyItemResult[];
}

export interface StorageProvider {
  /**
   * Uploads binary file buffer to storage.
   */
  upload(
    fileBuffer: Buffer | Uint8Array,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  /** Copies one exact object without deleting the source and verifies the destination. */
  copy?(sourceKey: string, destinationKey: string): Promise<StorageCopyResult>;

  /**
   * Deletes a file from storage by its key/path.
   */
  delete(key: string): Promise<StorageDeleteResult>;

  /**
   * Deletes several files and reports the outcome for every supplied key.
   * Providers may implement this with their native bulk API.
   */
  deleteMany?(keys: string[]): Promise<StorageDeleteManyResult>;

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
