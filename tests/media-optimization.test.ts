import { describe, it } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import {
  optimizeAvatar,
  optimizeListingImage,
  optimizeCorporateLogo,
  optimizeCorporateBanner,
  validateImageBuffer,
} from '../src/lib/media/optimizer';
import { resolveMediaUrl, resolveAvatarUrl } from '../src/lib/media/url';
import { CloudflareR2StorageProvider } from '../src/lib/storage/r2-provider';
import { MockStorageProvider } from '../src/lib/storage/mock-provider';

describe('WebP Media Optimization Pipeline', () => {
  it('should optimize a PNG avatar to WebP within 512x512 and quality 82', async () => {
    // Create a 1000x800 sample PNG
    const samplePng = await sharp({
      create: {
        width: 1000,
        height: 800,
        channels: 4,
        background: { r: 120, g: 80, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeAvatar(samplePng);

    assert.strictEqual(result.mimeType, 'image/webp');
    assert.strictEqual(result.extension, '.webp');
    assert.strictEqual(result.width, 512);
    assert.strictEqual(result.height, 512);
    assert.ok(result.sizeBytes > 0);
    assert.ok(result.sizeBytes < samplePng.byteLength);

    // Verify sharp metadata of result
    const meta = await sharp(result.buffer).metadata();
    assert.strictEqual(meta.format, 'webp');
    assert.strictEqual(meta.width, 512);
    assert.strictEqual(meta.height, 512);
  });

  it('should optimize a JPEG listing image to max 1600px long edge', async () => {
    // Create a 2400x1200 landscape JPEG
    const sampleJpg = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await optimizeListingImage(sampleJpg);

    assert.strictEqual(result.mimeType, 'image/webp');
    assert.strictEqual(result.extension, '.webp');
    assert.strictEqual(result.width, 1600);
    assert.strictEqual(result.height, 800);
    assert.ok(result.sizeBytes < sampleJpg.byteLength);

    const meta = await sharp(result.buffer).metadata();
    assert.strictEqual(meta.format, 'webp');
    assert.strictEqual(meta.width, 1600);
    assert.strictEqual(meta.height, 800);
  });

  it('should optimize corporate logo to max 512x512 with quality 85', async () => {
    const samplePng = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeCorporateLogo(samplePng);
    assert.strictEqual(result.mimeType, 'image/webp');
    assert.strictEqual(result.width, 512);
    assert.strictEqual(result.height, 512);

    const meta = await sharp(result.buffer).metadata();
    assert.strictEqual(meta.format, 'webp');
  });

  it('should optimize corporate banner to max width 1600px with quality 82', async () => {
    const samplePng = await sharp({
      create: {
        width: 3200,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 138, b: 31, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeCorporateBanner(samplePng);
    assert.strictEqual(result.mimeType, 'image/webp');
    assert.strictEqual(result.width, 1600);
    assert.strictEqual(result.height, 500);

    const meta = await sharp(result.buffer).metadata();
    assert.strictEqual(meta.format, 'webp');
    assert.strictEqual(meta.width, 1600);
  });

  it('should reject SVG formats strictly', async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" /></svg>');

    await assert.rejects(
      async () => {
        await validateImageBuffer(svgBuffer);
      },
      /SVG formatı desteklenmemektedir/
    );

    await assert.rejects(
      async () => {
        await optimizeAvatar(svgBuffer);
      },
      /SVG formatı desteklenmemektedir/
    );
  });

  it('should reject files exceeding 2MB', async () => {
    const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024);

    await assert.rejects(
      async () => {
        await validateImageBuffer(hugeBuffer);
      },
      /Dosya boyutu sınırı aşıldı/
    );
  });
});

describe('Media URL Resolution & Backward Compatibility', () => {
  it('should resolve R2 object keys using public domain', () => {
    const key = 'avatars/44444444-4444-4444-4444-444444444441/sample.webp';
    const resolved = resolveMediaUrl(key);
    assert.ok(resolved.startsWith('https://'));
    assert.ok(resolved.endsWith(key));
  });

  it('should preserve full HTTP/HTTPS URLs (backward compatibility)', () => {
    const unsplashUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250';
    assert.strictEqual(resolveMediaUrl(unsplashUrl), unsplashUrl);

    const existingR2Url = 'https://pub-454798ec1d264d749a7f16dac2c48498.r2.dev/avatars/old.jpg';
    assert.strictEqual(resolveMediaUrl(existingR2Url), existingR2Url);
  });

  it('should preserve base64 data URLs for optimistic preview', () => {
    const dataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vuUAAA=';
    assert.strictEqual(resolveMediaUrl(dataUrl), dataUrl);
  });

  it('should only use fallback avatar when avatar_path is null or empty', () => {
    const fallback = 'https://images.unsplash.com/photo-default';
    assert.strictEqual(resolveAvatarUrl(null, fallback), fallback);
    assert.strictEqual(resolveAvatarUrl('', fallback), fallback);
    assert.strictEqual(resolveAvatarUrl('   ', fallback), fallback);

    // If avatar_path is present, it MUST return real resolved URL and not fallback
    const key = 'avatars/44444444-4444-4444-4444-444444444441/new-avatar.webp';
    const resolved = resolveAvatarUrl(key, fallback);
    assert.notStrictEqual(resolved, fallback);
    assert.ok(resolved.endsWith('new-avatar.webp'));
  });
});

describe('Storage Delete Safety & Cleanup', () => {
  it('should ignore external Unsplash URLs during deletion to prevent errors', async () => {
    const r2 = new CloudflareR2StorageProvider();
    const res = await r2.delete('https://images.unsplash.com/photo-1534528741775-53994a69daeb');
    assert.strictEqual(res.success, true);
  });

  it('MockStorageProvider should support key override and WebP contentType', async () => {
    const mock = new MockStorageProvider();
    const sampleBuffer = Buffer.from('dummy-webp-data');
    const key = 'avatars/44444444-4444-4444-4444-444444444441/test.webp';

    const uploadRes = await mock.upload(sampleBuffer, {
      fileName: 'test.webp',
      contentType: 'image/webp',
      category: 'avatar',
      key,
    });

    assert.strictEqual(uploadRes.success, true);
    assert.strictEqual(uploadRes.key, key);
    assert.strictEqual(uploadRes.mimeType, 'image/webp');
  });
});
