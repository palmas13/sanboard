import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finalizeListingMedia } from '@/lib/listings/finalize-media';
import { MockStorageProvider } from '@/lib/storage/mock-provider';

const listingId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const imageId = '33333333-3333-4333-8333-333333333333';
const filename = '44444444-4444-4444-8444-444444444444.webp';
const pendingKey = `listings/pending-scope/${filename}`;
const profileKey = `listings/${profileId}/${filename}`;
const canonicalKey = `listings/${listingId}/${filename}`;

async function seededStorage(source = pendingKey, options = {}) {
  const storage = new MockStorageProvider(options);
  await storage.upload(Buffer.from('image'), { fileName: filename, contentType: 'image/webp', category: 'listing', key: source });
  return storage;
}

describe('listing media finalization', () => {
  test('copies a pending exact key before committing the canonical raw key', async () => {
    const storage = await seededStorage();
    const events: string[] = [];
    const originalCopy = storage.copy.bind(storage);
    storage.copy = async (...args) => { events.push(`copy:${args.join('->')}`); return originalCopy(...args); };
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: pendingKey }],
      commit: async (args) => { events.push(`db:${args.oldKey}->${args.newStoragePath}`); return 'FINALIZED'; },
    } });
    assert.equal(report.finalizedCount, 1);
    assert.deepEqual(events, [`copy:${pendingKey}->${canonicalKey}`, `db:${pendingKey}->${canonicalKey}`]);
    assert.deepEqual((await storage.list(`listings/${listingId}/`)).objects.map((item) => item.key), [canonicalKey]);
  });

  test('copy failure leaves the database untouched and source present', async () => {
    const storage = await seededStorage(pendingKey, { failCopiesFor: [pendingKey] });
    let commits = 0;
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: pendingKey }],
      commit: async () => { commits++; return 'FINALIZED'; },
    } });
    assert.equal(report.failedCount, 1);
    assert.equal(commits, 0);
    assert.deepEqual((await storage.list('listings/pending-scope/')).objects.map((item) => item.key), [pendingKey]);
  });

  test('database rejection leaves both source and copied destination for safe retry', async () => {
    const storage = await seededStorage();
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: pendingKey }], commit: async () => 'STALE',
    } });
    assert.equal(report.failedCount, 1);
    assert.deepEqual((await storage.list('listings/')).objects.map((item) => item.key).sort(), [canonicalKey, pendingKey].sort());
  });

  test('already canonical media is an idempotent no-op', async () => {
    const storage = await seededStorage(canonicalKey);
    let copies = 0; let commits = 0;
    storage.copy = async () => { copies++; throw new Error('should not copy'); };
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: canonicalKey }],
      commit: async () => { commits++; return 'FINALIZED'; },
    } });
    assert.equal(report.alreadyFinalizedCount, 1); assert.equal(copies, 0); assert.equal(commits, 0);
  });

  test('destination-already-exists retry and DB-already-finalized are safe', async () => {
    const storage = await seededStorage();
    await storage.copy(pendingKey, canonicalKey);
    let commits = 0;
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: pendingKey }],
      commit: async () => { commits++; return 'ALREADY_FINALIZED'; },
    } });
    assert.equal(report.alreadyFinalizedCount, 1); assert.equal(commits, 1);
  });

  test('CDN URL and profile-scoped raw key canonicalize to the same destination', async () => {
    for (const storagePath of [`https://cdn.sanboard.xyz/${pendingKey}`, profileKey]) {
      const source = storagePath.includes('://') ? pendingKey : profileKey;
      const storage = await seededStorage(source);
      let received: any;
      const report = await finalizeListingMedia(listingId, { uploadOwnerId: profileId, dependencies: {
        storage, loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: storagePath }],
        commit: async (args) => { received = args; return 'FINALIZED'; },
      } });
      assert.equal(report.finalizedCount, 1); assert.equal(received.newKey, canonicalKey); assert.equal(received.newStoragePath, canonicalKey);
    }
  });

  test('shared pending prefixes never cause cross-listing or prefix-wide mutation', async () => {
    const otherListing = '55555555-5555-4555-8555-555555555555';
    const otherKey = 'listings/pending-scope/other.webp';
    const storage = await seededStorage();
    await storage.upload(Buffer.from('other'), { fileName: 'other.webp', contentType: 'image/webp', category: 'listing', key: otherKey });
    const committed: string[] = [];
    const report = await finalizeListingMedia(listingId, { dependencies: {
      storage,
      loadImages: async () => [{ id: imageId, listing_id: listingId, storage_path: pendingKey }, { id: 'other', listing_id: otherListing, storage_path: otherKey }],
      commit: async ({ imageId: id }) => { committed.push(id); return 'FINALIZED'; },
    } });
    assert.equal(report.finalizedCount, 1); assert.equal(report.skippedCount, 1); assert.deepEqual(committed, [imageId]);
    assert.equal((await storage.list('listings/pending-scope/')).objects.some((item) => item.key === otherKey), true);
  });

  test('atomic RPC locks, compares, updates, then enqueues deduplicated cleanup', () => {
    const migration = readFileSync('supabase/migrations/20261002060000_finalize_listing_media.sql', 'utf8');
    assert.match(migration, /WHERE id = p_image_id\s+FOR UPDATE/);
    assert.match(migration, /image_row\.listing_id IS DISTINCT FROM p_listing_id/);
    assert.match(migration, /current_key IS DISTINCT FROM old_key/);
    assert.match(migration, /SET storage_path = p_new_storage_path/);
    assert.match(migration, /enqueue_media_cleanup_job\([\s\S]*'LISTING_MEDIA_FINALIZED'/);
    assert.match(migration, /'listing-finalize:' \|\| p_image_id::text \|\| ':' \|\| old_key/);
    assert.ok(migration.indexOf('SET storage_path = p_new_storage_path') < migration.indexOf('enqueue_media_cleanup_job'));
    assert.doesNotMatch(migration, /DELETE FROM public\.listing_images|DELETE FROM public\.listings/);
  });

  test('create and edit integrations are best-effort', () => {
    const createRoute = readFileSync('src/app/api/listings/route.ts', 'utf8');
    const editRoute = readFileSync('src/app/api/user/listings/[id]/route.ts', 'utf8');
    for (const route of [createRoute, editRoute]) { assert.match(route, /finalizeListingMedia/); assert.match(route, /catch \(finalizeError\)/); }
    assert.match(createRoute, /failed without invalidating the listing/);
    assert.match(editRoute, /failed without invalidating the edit/);
  });
});