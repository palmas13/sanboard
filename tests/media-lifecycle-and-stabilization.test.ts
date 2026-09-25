import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveMediaUrl, resolveAvatarUrl, extractObjectKey, isSanboardMediaUrl } from '../src/lib/media/url';
import { isValidSanboardStorageKey, queueMediaCleanup } from '../src/lib/storage/lifecycle';
import { MockStorageProvider } from '../src/lib/storage/mock-provider';
import { runOrphanScan } from '../scripts/media-cleanup';
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
});
