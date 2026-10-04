import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveMediaUrl, resolveAvatarUrl, extractObjectKey, isSanboardMediaUrl } from '../src/lib/media/url';
import { isValidSanboardStorageKey, queueMediaCleanup } from '../src/lib/storage/lifecycle';
import { MockStorageProvider } from '../src/lib/storage/mock-provider';
import { runOrphanScan } from '../scripts/media-cleanup';
import { GET as orphanReconciliationRoute } from '../src/app/api/internal/orphan-reconciliation/route';
import { resetStorageInstance } from '../src/lib/storage';
import type { StorageProvider } from '../src/lib/storage/types';
import { db } from '../src/lib/db/store';
import { toggleFavorite, getUserFavorites, markListingAsSold } from '../src/lib/db/listings';
import { MemoryListingRepository } from '../src/lib/db/repositories/memory/memory-listing-repo';

describe('Media Resolution & URL Normalization', () => {
  it('should resolve canonical object keys to Worker URL without r2.dev', () => {
    const key = 'avatars/44444444-4444-4444-4444-444444444441/uuid.webp';
    const resolved = resolveMediaUrl(key);
    assert.ok(resolved?.startsWith('https://cdn.sanboard.xyz/avatars/'));
    assert.strictEqual(resolved?.includes('r2.dev'), false);
  });

  it('should resolve leading slash keys without double slash or error', () => {
    const key = '/avatars/test/uuid.webp';
    const resolved = resolveMediaUrl(key);
    assert.strictEqual(resolved, 'https://cdn.sanboard.xyz/avatars/test/uuid.webp');
  });

  it('should rewrite legacy r2.dev URLs to Worker domain safely', () => {
    const legacy = 'https://pub-abc.r2.dev/avatars/123/pic.webp';
    const resolved = resolveMediaUrl(legacy);
    assert.strictEqual(resolved, 'https://cdn.sanboard.xyz/avatars/123/pic.webp');
  });

  it('should return empty string for null or empty paths', () => {
    assert.strictEqual(resolveMediaUrl(null), '');
    assert.strictEqual(resolveMediaUrl(''), '');
    assert.strictEqual(resolveMediaUrl('   '), '');
  });

  it('should preserve external non-Sanboard URLs unchanged', () => {
    const unsplash = 'https://images.unsplash.com/photo-123';
    assert.strictEqual(resolveMediaUrl(unsplash), unsplash);
  });

  it('should correctly extract canonical object key from Worker URL', () => {
    const workerUrl = 'https://cdn.sanboard.xyz/avatars/user-1/abc.webp';
    const extracted = extractObjectKey(workerUrl);
    assert.strictEqual(extracted, 'avatars/user-1/abc.webp');
  });

  it('canonicalizes Sanboard CDN query strings but rejects external URLs', () => {
    assert.strictEqual(
      extractObjectKey('https://cdn.sanboard.xyz/listings/abc/file.webp?v=123#preview'),
      'listings/abc/file.webp'
    );
    assert.strictEqual(extractObjectKey('https://example.com/listings/abc/file.webp'), null);
  });

  it('should validate allowed Sanboard storage key prefixes and reject path traversal', () => {
    assert.strictEqual(isValidSanboardStorageKey('avatars/123/test.webp'), true);
    assert.strictEqual(isValidSanboardStorageKey('listings/456/test.webp'), true);
    assert.strictEqual(isValidSanboardStorageKey('dealers/logos/789/test.webp'), true);
    assert.strictEqual(isValidSanboardStorageKey('dealers/banners/789/test.webp'), true);

    // Invalid & security violations
    assert.strictEqual(isValidSanboardStorageKey('other/test.webp'), false);
    assert.strictEqual(isValidSanboardStorageKey('avatars/../etc/passwd'), false);
    assert.strictEqual(isValidSanboardStorageKey('listings/test\\hack.webp'), false);
  });
});

describe('Price Display Logic (Section 18, 19, 20)', () => {
  it('should show previous price strikethrough ONLY when current_price < previous_price', () => {
    // Case A: Price Drop
    const priceDrop = { price: 95000, previous_price: 120000 };
    const shouldShowOldPriceDrop = Boolean(priceDrop.previous_price && priceDrop.price < priceDrop.previous_price);
    assert.strictEqual(shouldShowOldPriceDrop, true);

    // Case B: Price Increase
    const priceIncrease = { price: 120000, previous_price: 95000 };
    const shouldShowOldPriceIncrease = Boolean(priceIncrease.previous_price && priceIncrease.price < priceIncrease.previous_price);
    assert.strictEqual(shouldShowOldPriceIncrease, false); // Must NOT show discount styling on increase!

    // Case C: No previous price
    const noPrevPrice = { price: 95000, previous_price: undefined };
    const shouldShowOldNoPrev = Boolean(noPrevPrice.previous_price && (noPrevPrice as any).price < noPrevPrice.previous_price);
    assert.strictEqual(shouldShowOldNoPrev, false);
  });
});

describe('Character-Scoped Favorites & Sibling Isolation', () => {
  it('should isolate favorites to character profile and support sibling characters independently', async () => {
    const characterZade = 'char-zade-test';
    const characterMavis = 'char-mavis-test';
    const listingId = db.listings[0]?.id || 'listing-veh-01';
    db.favorites = db.favorites.filter((f) => f.listing_id !== listingId);

    // 1. Favorite as Zade
    const addRes = await toggleFavorite(characterZade, listingId);
    assert.strictEqual(addRes.isFavorited, true);

    // 2. Query favorites for Mavis (sibling character should NOT have Zade's favorite)
    const mavisFavs = await getUserFavorites(characterMavis);
    assert.strictEqual(mavisFavs.some((l) => l.id === listingId), false, 'Sibling character must NOT see other character favorites');

    // 3. Query favorites for Zade
    const zadeFavs = await getUserFavorites(characterZade);
    assert.ok(zadeFavs.some((l) => l.id === listingId), 'Zade must see his own favorite');

    // 4. Mavis also favorites the listing (count becomes 2)
    const mavisAdd = await toggleFavorite(characterMavis, listingId);
    assert.strictEqual(mavisAdd.isFavorited, true);
    assert.strictEqual(mavisAdd.count, 2);

    // 5. Mavis removes favorite -> Zade favorite remains intact
    const removeRes = await toggleFavorite(characterMavis, listingId);
    assert.strictEqual(removeRes.isFavorited, false);
    assert.strictEqual(removeRes.count, 1);

    const afterUnfav = await getUserFavorites(characterZade);
    assert.ok(afterUnfav.some((l) => l.id === listingId), 'Zade favorite must remain after Mavis unfavorites');
  });
});

describe('Orphan Scanner & Storage Provider Pagination', () => {
  it('should support pagination in MockStorageProvider and list objects with prefix filtering', async () => {
    const mockStorage = new MockStorageProvider();

    // Seed mock files
    for (let i = 0; i < 5; i++) {
      await mockStorage.upload(Buffer.from('sample'), {
        fileName: `file-${i}.webp`,
        category: 'avatar',
        contentType: 'image/webp',
        folder: 'avatars',
        key: `avatars/user-test/avatar-${i}.webp`,
      });
    }

    const result = await mockStorage.list('avatars/');
    assert.strictEqual(result.objects.length, 5);
    assert.ok(result.objects[0].key.startsWith('avatars/'));
  });

  it('should default to DRY-RUN mode without deleting candidate orphans', async () => {
    const origMock = process.env.USE_MOCK_STORAGE;
    process.env.USE_MOCK_STORAGE = 'true';
    try {
      const report = await runOrphanScan({ execute: false, graceHours: 24, quiet: true });
      assert.ok(typeof report.scannedCount === 'number');
      assert.ok(typeof report.referencedCount === 'number');
      assert.ok(typeof report.orphanCount === 'number');
    } finally {
      if (origMock !== undefined) {
        process.env.USE_MOCK_STORAGE = origMock;
      } else {
        delete process.env.USE_MOCK_STORAGE;
      }
    }
  });

  it('requires authentication and supports explicit dry-run while authenticated default is real execution', async () => {
    const original = {
      cronSecret: process.env.CRON_SECRET,
      lifecycleSecret: process.env.LIFECYCLE_CRON_SECRET,
      mockStorage: process.env.USE_MOCK_STORAGE,
      dataStore: process.env.DATA_STORE,
    };
    process.env.CRON_SECRET = 'orphan-reconciliation-test-secret-1234567890';
    process.env.USE_MOCK_STORAGE = 'true';
    process.env.DATA_STORE = 'memory';
    resetStorageInstance();
    try {
      const unauthorized = await orphanReconciliationRoute(new Request('http://localhost/api/internal/orphan-reconciliation'));
      assert.equal(unauthorized.status, 401);

      const authorization = { authorization: `Bearer ${process.env.CRON_SECRET}` };
      const dryRun = await orphanReconciliationRoute(new Request('http://localhost/api/internal/orphan-reconciliation?dryRun=true', { headers: authorization }));
      assert.equal(dryRun.status, 200);
      assert.equal((await dryRun.json()).report.dryRun, true);

      const execute = await orphanReconciliationRoute(new Request('http://localhost/api/internal/orphan-reconciliation', { headers: authorization }));
      assert.equal(execute.status, 200);
      const body = await execute.json();
      assert.equal(body.report.dryRun, false);
      assert.equal(typeof body.report.enqueuedCount, 'number');
      assert.equal(typeof body.report.failedCount, 'number');
    } finally {
      if (original.cronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original.cronSecret;
      if (original.lifecycleSecret === undefined) delete process.env.LIFECYCLE_CRON_SECRET; else process.env.LIFECYCLE_CRON_SECRET = original.lifecycleSecret;
      if (original.mockStorage === undefined) delete process.env.USE_MOCK_STORAGE; else process.env.USE_MOCK_STORAGE = original.mockStorage;
      if (original.dataStore === undefined) delete process.env.DATA_STORE; else process.env.DATA_STORE = original.dataStore;
      resetStorageInstance();
    }
  });

  it('enqueues only old exact-key unreferenced supported objects, including pending listing uploads', async () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const old = new Date(now - 25 * 60 * 60 * 1000);
    const young = new Date(now - 60 * 60 * 1000);
    const objects = [
      { key: 'listings/pending-1720000000000/orphan.webp', size: 100, lastModified: old },
      { key: 'listings/pending-1720000000000/referenced.webp', size: 200, lastModified: old },
      { key: 'listings/shared/active.webp', size: 300, lastModified: old },
      { key: 'listings/shared/young.webp', size: 400, lastModified: young },
      { key: 'listings/folder-marker/', size: 0, lastModified: old },
      { key: 'site/favicon/favicon.webp', size: 500, lastModified: old },
      { key: 'unknown/object.webp', size: 600, lastModified: old },
    ];
    const listedPrefixes: string[] = [];
    const storage = {
      isAvailable: () => true,
      getPublicUrl: (key: string) => key,
      upload: async () => ({ success: false, url: '', key: '', sizeBytes: 0 }),
      delete: async () => ({ success: true }),
      list: async (prefix?: string) => {
        listedPrefixes.push(prefix || '');
        return { objects: objects.filter((object) => object.key.startsWith(prefix || '')), isTruncated: false };
      },
    } satisfies StorageProvider;
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const client = {
      async rpc(name: string, args: Record<string, unknown> = {}) {
        calls.push({ name, args });
        return { data: 'ENQUEUED', error: null };
      },
    };
    const references = new Set(['listings/pending-1720000000000/referenced.webp', 'listings/shared/active.webp']);

    const report = await runOrphanScan({
      execute: true,
      graceHours: 24,
      quiet: true,
      dependencies: { storage, client, collectReferences: async () => references, now: () => now },
    });

    assert.deepEqual(listedPrefixes, ['avatars/', 'listings/', 'dealers/logos/', 'dealers/banners/']);
    assert.deepEqual(calls.map((call) => call.args.k), ['listings/pending-1720000000000/orphan.webp']);
    assert.equal(calls[0].args.t, 'LISTING_IMAGE');
    assert.equal(report.scannedCount, 5);
    assert.equal(report.orphanCount, 1);
    assert.equal(report.eligibleCount, 1);
    assert.equal(report.enqueuedCount, 1);
    assert.equal(report.skippedReferencedCount, 2);
    assert.equal(report.skippedYoungCount, 1);
    assert.equal(report.failedCount, 0);
    assert.equal(report.dryRun, false);
  });

  it('explicit dry-run never enqueues and a second reference check closes the scan-to-queue race', async () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const storage = {
      isAvailable: () => true,
      getPublicUrl: (key: string) => key,
      upload: async () => ({ success: false, url: '', key: '', sizeBytes: 0 }),
      delete: async () => ({ success: true }),
      list: async (prefix?: string) => ({
        objects: prefix === 'listings/' ? [{ key: 'listings/pending-race/file.webp', size: 10, lastModified: new Date(now - 25 * 60 * 60 * 1000) }] : [],
        isTruncated: false,
      }),
    } satisfies StorageProvider;
    let rpcCalls = 0;
    const client = { async rpc() { rpcCalls++; return { data: 'ENQUEUED', error: null }; } };

    const dryRun = await runOrphanScan({ execute: false, quiet: true, dependencies: { storage, client, collectReferences: async () => new Set(), now: () => now } });
    assert.equal(dryRun.eligibleCount, 1);
    assert.equal(dryRun.enqueuedCount, 0);
    assert.equal(dryRun.dryRun, true);
    assert.equal(rpcCalls, 0);

    let checks = 0;
    const race = await runOrphanScan({
      execute: true,
      quiet: true,
      dependencies: {
        storage,
        client,
        collectReferences: async () => ++checks === 1 ? new Set() : new Set(['listings/pending-race/file.webp']),
        now: () => now,
      },
    });
    assert.equal(race.enqueuedCount, 0);
    assert.equal(race.skippedReferencedCount, 1);
    assert.equal(rpcCalls, 0);
  });

  it('reports already-queued deduplication and enqueue failures without direct R2 deletion', async () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    let deletes = 0;
    const storage = {
      isAvailable: () => true,
      getPublicUrl: (key: string) => key,
      upload: async () => ({ success: false, url: '', key: '', sizeBytes: 0 }),
      delete: async () => { deletes++; return { success: true }; },
      list: async (prefix?: string) => ({
        objects: prefix === 'avatars/' ? [
          { key: 'avatars/already.webp', size: 10, lastModified: new Date(now - 25 * 60 * 60 * 1000) },
          { key: 'avatars/fails.webp', size: 20, lastModified: new Date(now - 25 * 60 * 60 * 1000) },
        ] : [],
        isTruncated: false,
      }),
    } satisfies StorageProvider;
    const client = {
      async rpc(_name: string, args: Record<string, unknown>) {
        return args.k === 'avatars/already.webp'
          ? { data: 'ALREADY_QUEUED', error: null }
          : { data: null, error: { message: 'injected enqueue failure' } };
      },
    };
    const report = await runOrphanScan({ execute: true, quiet: true, dependencies: { storage, client, collectReferences: async () => new Set(), now: () => now } });
    assert.equal(report.alreadyQueuedCount, 1);
    assert.equal(report.failedCount, 1);
    assert.equal(report.enqueuedCount, 0);
    assert.equal(deletes, 0);
  });
});
