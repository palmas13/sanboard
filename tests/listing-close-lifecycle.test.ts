import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db/store';
import { getListingById, getPublicListings, markListingAsSold, removeListing } from '@/lib/db/listings';

function corporateFixture(id: string) {
  const now = new Date().toISOString();
  return {
    id,
    listing_number: `#${id}`,
    seller_profile_id: 'legacy-corporate-publisher',
    seller_type: 'CORPORATE' as const,
    corporate_profile_id: 'close-store',
    category: 'vehicle' as const,
    subcategory: 'Otomobil' as const,
    title: 'Kurumsal kapanış testi',
    description: 'Kurumsal kapanış yaşam döngüsü testi',
    price: 100000,
    location: null,
    status: 'ACTIVE' as const,
    offers_enabled: true,
    published_at: now,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: now,
    updated_at: now,
    images: [],
  };
}

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
    assert.match(cleanup, /runListingPurgeWorker/);
    assert.doesNotMatch(cleanup, /from\('listings'\)\.delete/);
    assert.doesNotMatch(cleanup, /deleteMediaSafely/);
  });

  test('authorized corporate owner closes SOLD through the canonical flow and closes offers', async () => {
    const original = { listings: db.listings, dealers: db.dealers, profiles: db.profiles, offers: db.offerThreads, events: db.offerEvents, audits: db.soldAudits, notifications: db.notifications };
    try {
      db.profiles = [{ id: 'corporate-owner', user_id: 'corporate-account', full_name: 'Corporate Owner', avatar_url: '', sanmail_email: 'owner@sanmail.com', phone: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
      db.dealers = [{ id: 'close-store', profile_id: 'corporate-owner', owner_profile_id: 'corporate-owner', company_name: 'Close Store', slug: 'close-store', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: new Date(Date.now() + 86400000).toISOString(), boost_credits: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
      db.listings = [corporateFixture('corporate-sold')] as any;
      db.offerThreads = [{ id: 'corporate-offer-sold', listing_id: 'corporate-sold', buyer_profile_id: 'buyer', seller_profile_id: 'corporate-owner', current_amount: 90000, status: 'ACTIVE', turn_profile_id: 'corporate-owner', movement_count: 1, expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
      db.offerEvents = []; db.soldAudits = []; db.notifications = [];

      const result = await markListingAsSold('corporate-sold', 'corporate-owner');
      assert.equal(result.success, true);
      assert.equal(db.listings[0].status, 'SOLD');
      assert.equal(db.offerThreads[0].status, 'CLOSED');
      assert.equal(db.offerThreads[0].close_reason, 'LISTING_SOLD');
      assert.equal((await getPublicListings()).some((listing) => listing.id === 'corporate-sold'), false);
      assert.ok((await getListingById('corporate-sold', 'corporate-owner', 'corporate-account')).listing);
    } finally {
      db.listings = original.listings; db.dealers = original.dealers; db.profiles = original.profiles; db.offerThreads = original.offers; db.offerEvents = original.events; db.soldAudits = original.audits; db.notifications = original.notifications;
    }
  });

  test('authorized corporate owner closes REMOVED immediately while sibling and unrelated profiles are rejected', async () => {
    const original = { listings: db.listings, dealers: db.dealers, offers: db.offerThreads, events: db.offerEvents, notifications: db.notifications, favorites: db.favorites };
    try {
      db.dealers = [{ id: 'close-store', profile_id: 'corporate-owner', owner_profile_id: 'corporate-owner', company_name: 'Close Store', slug: 'close-store', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: new Date(Date.now() + 86400000).toISOString(), boost_credits: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
      db.listings = [corporateFixture('corporate-removed')] as any;
      db.offerThreads = [{ id: 'corporate-offer-removed', listing_id: 'corporate-removed', buyer_profile_id: 'buyer', seller_profile_id: 'corporate-owner', current_amount: 90000, status: 'ACTIVE', turn_profile_id: 'corporate-owner', movement_count: 1, expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
      db.offerEvents = []; db.notifications = []; db.favorites = [];

      assert.equal((await removeListing('corporate-removed', 'sibling-character')).success, false);
      assert.equal((await removeListing('corporate-removed', 'unrelated-user')).success, false);
      const result = await removeListing('corporate-removed', 'corporate-owner');
      assert.equal(result.success, true);
      assert.equal(db.listings[0].status, 'REMOVED');
      assert.equal(db.listings[0].close_reason, 'OTHER');
      assert.ok(db.listings[0].closed_at);
      assert.equal(db.offerThreads[0].status, 'CLOSED');
      assert.equal(db.offerThreads[0].close_reason, 'LISTING_REMOVED_BY_SELLER');
      assert.equal((await getListingById('corporate-removed')).listing, null);
    } finally {
      db.listings = original.listings; db.dealers = original.dealers; db.offerThreads = original.offers; db.offerEvents = original.events; db.notifications = original.notifications; db.favorites = original.favorites;
    }
  });

  test('durable purge contract delays SOLD discovery for 24 hours and enqueues REMOVED immediately', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261002030000_durable_listing_purge_and_media_jobs.sql'), 'utf8');
    assert.match(migration, /status='REMOVED' OR\(status='SOLD' AND closed_at<=now\(\)-interval '24 hours'\)/);
    assert.match(migration, /IF l\.status='REMOVED' THEN a:=coalesce\(l\.closed_at,l\.updated_at\);p:=a;ELSIF l\.status='SOLD' THEN a:=l\.closed_at;p:=a\+interval '24 hours'/);
    assert.match(migration, /enqueue_listing_purge_job/);
  });
});