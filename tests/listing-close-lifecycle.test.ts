import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db/store';
import { getListingById, markListingAsSold, removeListing } from '@/lib/db/listings';

describe('listing close lifecycle', () => {
  test('sold detail is retained for 24 hours and then becomes unavailable', async () => {
    const listing = db.listings.find((item) => item.status === 'ACTIVE')!;
    const original = structuredClone(listing);
    try {
      const result = await markListingAsSold(listing.id, listing.seller_profile_id);
      assert.equal(result.success, true);
      assert.ok((await getListingById(listing.id)).listing);
      listing.closed_at = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString();
      assert.equal((await getListingById(listing.id)).listing, null);
    } finally {
      Object.assign(listing, original);
      db.soldAudits = db.soldAudits.filter((audit) => audit.original_listing_id !== listing.id);
    }
  });

  test('seller cancellation closes direct URL immediately and removes detail payload in memory', async () => {
    const listing = db.listings.find((item) => item.status === 'ACTIVE')!;
    const original = structuredClone(listing);
    try {
      const result = await removeListing(listing.id, listing.seller_profile_id);
      assert.equal(result.success, true);
      assert.equal((await getListingById(listing.id)).listing, null);
      assert.deepEqual(listing.images, []);
    } finally {
      Object.assign(listing, original);
    }
  });

  test('migration and cleanup preserve minimal archive and retry-safe media deletion', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260930120000_listing_close_lifecycle.sql'), 'utf8');
    const cleanup = fs.readFileSync(path.join(process.cwd(), 'scripts/sold-listing-cleanup.ts'), 'utf8');
    assert.match(migration, /title TEXT/);
    assert.match(migration, /price BIGINT/);
    assert.match(migration, /description TEXT/);
    assert.match(migration, /closed_at TIMESTAMPTZ/);
    assert.match(cleanup, /24 \* 60 \* 60 \* 1000/);
    assert.match(cleanup, /deleteMediaSafely/);
    assert.match(cleanup, /pending retry/);
  });
});