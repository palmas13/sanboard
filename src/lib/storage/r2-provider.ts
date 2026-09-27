import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageDeleteResult } from './types';

const ALLOWED_STORAGE_PREFIXES = [
  'avatars/',
  'listings/',
  'dealers/logos/',
  'dealers/banners/',
  'site/favicon/',
];

export class CloudflareR2StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private publicDomain: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
    this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
    this.publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '';

    if (this.isAvailable()) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
    }
  }

  isAvailable(): boolean {
    return Boolean(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucketName
    );
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
    if (this.publicDomain) {
      let base = this.publicDomain.trim();
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`;
      }
      if (base.endsWith('/')) {
        base = base.slice(0, -1);
      }
      return `${base}/${cleanKey}`;
    }
    // Fallback URL format if custom public domain is not set
    return `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com/${cleanKey}`;
  }

  async upload(
    fileBuffer: Buffer | Uint8Array,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    if (!this.isAvailable() || !this.client) {
      return {
        success: false,
        url: '',
        key: '',
        sizeBytes: 0,
        error: 'Cloudflare R2 is not configured. Please supply environment credentials.',
      };
    }

    try {
      const maxLimit = options.maxSizeBytes || 2 * 1024 * 1024; // 2MB default
      if (fileBuffer.byteLength > maxLimit) {
        return {
          success: false,
          url: '',
          key: '',
          sizeBytes: fileBuffer.byteLength,
          error: `Dosya boyutu sınırı aşıldı. Maksimum: ${Math.round(maxLimit / 1024 / 1024)}MB.`,
        };
      }

      const sanitizedName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = options.folder || options.category || 'uploads';
      const key = options.key || `${folder}/${Date.now()}-${sanitizedName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          category: options.category,
        },
      });

      await this.client.send(command);

      const url = this.getPublicUrl(key);

      return {
        success: true,
        url,
        key,
        sizeBytes: fileBuffer.byteLength,
        mimeType: options.contentType,
      };
    } catch (err: any) {
      return {
        success: false,
        url: '',
        key: '',
        sizeBytes: fileBuffer.byteLength,
        error: err?.message || 'Cloudflare R2 yükleme işlemi başarısız oldu.',
      };
    }
  }

  async delete(keyOrUrl: string): Promise<StorageDeleteResult> {
    if (!keyOrUrl || typeof keyOrUrl !== 'string') {
      return { success: true };
    }

    // Ignore external URLs that are not stored in our R2 bucket
    if (keyOrUrl.includes('images.unsplash.com') || keyOrUrl.startsWith('data:')) {
      return { success: true };
    }

    if (!this.isAvailable() || !this.client) {
      return {
        success: false,
        error: 'Cloudflare R2 is not configured.',
      };
    }

    try {
      // Extract clean key if a full URL was provided
      let cleanKey = keyOrUrl;
      if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
        try {
          const parsed = new URL(cleanKey);
          cleanKey = parsed.pathname;
        } catch {
          // Keep as is
        }
      }
      cleanKey = cleanKey.replace(/^\/+/, '');

      // Security check: reject path traversal and non-allowed prefixes
      if (cleanKey.includes('..') || cleanKey.includes('\\')) {
        return { success: false, error: 'Geçersiz dosya anahtarı.' };
      }

      const hasValidPrefix = ALLOWED_STORAGE_PREFIXES.some((p) => cleanKey.startsWith(p));
      if (!hasValidPrefix) {
        return { success: false, error: 'Bu dizindeki dosyaları silme yetkiniz yok.' };
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });

      await this.client.send(command);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Dosya silinemedi.',
      };
    }
  }

  async list(
    prefix?: string,
    continuationToken?: string
  ): Promise<{
    objects: { key: string; size: number; lastModified?: Date }[];
    nextContinuationToken?: string;
    isTruncated: boolean;
  }> {
    if (!this.isAvailable() || !this.client) {
      return { objects: [], isTruncated: false };
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix ? prefix.replace(/^\/+/, '') : undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await this.client.send(command);
      const objects = (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified,
      }));

      return {
        objects,
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: Boolean(response.IsTruncated),
      };
    } catch (_err: any) {
      return { objects: [], isTruncated: false };
    }
  }
}
