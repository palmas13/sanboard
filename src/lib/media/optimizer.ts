import sharp from 'sharp';

export interface OptimizedMediaResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: 'image/webp';
  extension: '.webp';
}

const MAX_INPUT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);

/**
 * Validates and inspects an image buffer before optimization.
 * Explicitly rejects SVGs and non-raster formats.
 */
export async function validateImageBuffer(
  buffer: Buffer | Uint8Array,
  maxSizeBytes: number = MAX_INPUT_SIZE_BYTES
): Promise<{ format: string; width: number; height: number }> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Check file size
  if (nodeBuffer.byteLength > maxSizeBytes) {
    throw new Error(`Dosya boyutu sınırı aşıldı. Maksimum 2MB (${(nodeBuffer.byteLength / 1024 / 1024).toFixed(2)} MB).`);
  }

  // Reject SVG text patterns immediately
  const sampleHeader = nodeBuffer.subarray(0, 100).toString('utf-8').toLowerCase();
  if (sampleHeader.includes('<svg') || sampleHeader.includes('<?xml')) {
    throw new Error('SVG formatı desteklenmemektedir. Yalnızca JPG, JPEG, PNG veya WEBP yükleyebilirsiniz.');
  }

  try {
    const metadata = await sharp(nodeBuffer).metadata();
    const format = metadata.format?.toLowerCase();

    if (!format || !ALLOWED_INPUT_FORMATS.has(format)) {
      throw new Error(
        `Desteklenmeyen görsel formatı (${format || 'bilinmeyen'}). Yalnızca JPG, JPEG, PNG ve WEBP desteklenir.`
      );
    }

    return {
      format,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (err: any) {
    if (err.message && err.message.includes('Desteklenmeyen')) {
      throw err;
    }
    throw new Error('Geçersiz görsel dosyası. Dosya bozuk veya desteklenmeyen bir formatta.');
  }
}

/**
 * Optimizes profile avatar:
 * - Output: WebP
 * - Max resolution: 512x512
 * - Center crop / aspect ratio preserved
 * - No upscale
 * - Quality: 82
 */
export async function optimizeAvatar(
  buffer: Buffer | Uint8Array
): Promise<OptimizedMediaResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await validateImageBuffer(nodeBuffer, MAX_INPUT_SIZE_BYTES);

  const { data, info } = await sharp(nodeBuffer)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.byteLength,
    mimeType: 'image/webp',
    extension: '.webp',
  };
}

/**
 * Optimizes listing image:
 * - Output: WebP
 * - Long edge max 1600px
 * - Aspect ratio preserved
 * - No upscale
 * - Quality: 82
 */
export async function optimizeListingImage(
  buffer: Buffer | Uint8Array
): Promise<OptimizedMediaResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await validateImageBuffer(nodeBuffer, MAX_INPUT_SIZE_BYTES);

  const { data, info } = await sharp(nodeBuffer)
    .resize(1600, 1600, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.byteLength,
    mimeType: 'image/webp',
    extension: '.webp',
  };
}

/**
 * Optimizes corporate dealer logo:
 * - Output: WebP
 * - Max resolution: 512x512
 * - Aspect ratio preserved
 * - No upscale
 * - Quality: 85
 */
export async function optimizeCorporateLogo(
  buffer: Buffer | Uint8Array
): Promise<OptimizedMediaResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await validateImageBuffer(nodeBuffer, MAX_INPUT_SIZE_BYTES);

  const { data, info } = await sharp(nodeBuffer)
    .resize(512, 512, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.byteLength,
    mimeType: 'image/webp',
    extension: '.webp',
  };
}

/**
 * Optimizes corporate dealer store banner:
 * - Output: WebP
 * - Max width: 1600px
 * - Aspect ratio preserved
 * - No upscale
 * - Quality: 82
 */
export async function optimizeCorporateBanner(
  buffer: Buffer | Uint8Array
): Promise<OptimizedMediaResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await validateImageBuffer(nodeBuffer, MAX_INPUT_SIZE_BYTES);

  const { data, info } = await sharp(nodeBuffer)
    .resize(1600, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.byteLength,
    mimeType: 'image/webp',
    extension: '.webp',
  };
}
