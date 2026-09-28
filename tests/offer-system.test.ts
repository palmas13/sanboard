import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db/store';
import { MemoryOfferRepository } from '@/lib/db/repositories/memory/memory-offer-repo';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { MockGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/mock-provider';
import { TEST_LOGIN_JANE_CHARACTER_ID, TEST_LOGIN_JOHN_CHARACTER_ID, TEST_LOGIN_MAVIS_CHARACTER_ID } from '@/lib/auth/test-login';

describe('Structured offer system', () => {
  const repo = new MemoryOfferRepository();
  const seller = 'offer-seller';
  const buyer = 'offer-buyer';
  const sibling = 'offer-sibling';
  const listingId = 'offer-listing';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [
      { id: seller, user_id: 'seller-account', full_name: 'Seller', avatar_url: '', sanmail_email: 'seller@sanmail.com', phone: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: buyer, user_id: 'buyer-account', full_name: 'Buyer', avatar_url: '', sanmail_email: 'buyer@sanmail.com', phone: '2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: sibling, user_id: 'seller-account', full_name: 'Sibling', avatar_url: '', sanmail_email: 'sibling@sanmail.com', phone: '3', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as any;
    db.dealers = [{ id: 'offer-store', profile_id: seller, owner_profile_id: seller, company_name: 'Store', slug: 'store', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: new Date(Date.now() + 86400000).toISOString(), boost_credits: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] as any;
    db.listings = [{ id: listingId, listing_number: '#OFFER', seller_profile_id: seller, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Offer listing', description: '', price: 100000, offers_enabled: true, minimum_offer_amount: 50000, location: null, status: 'ACTIVE', published_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 7).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), images: [] }] as any;
    db.offerThreads = [];
    db.offerEvents = [];
    db.notifications = [];
  });

  const create = (amount = 60000) => repo.createOffer({ listingId, amount, actorProfileId: buyer, actorUserId: 'buyer-account' });

  test('create, duplicate, validation and account-level self-offer rules', async () => {
    const result = await create();
    assert.equal(result.success, true);
    assert.equal(result.thread?.turn_profile_id, seller);
    assert.deepEqual(result.thread?.events?.map((event) => event.event_type), ['OFFER_CREATED']);
    assert.equal((await create(65000)).code, 'EXISTING_ACTIVE');
    db.offerThreads = []; db.offerEvents = [];
    db.listings[0].offers_enabled = false;
    assert.equal((await create()).code, 'OFFERS_DISABLED');
    db.listings[0].offers_enabled = true;
    db.listings[0].status = 'REMOVED';
    assert.equal((await create()).code, 'LISTING_INACTIVE');
    db.listings[0].status = 'ACTIVE';
    assert.equal((await create(0)).code, 'INVALID_AMOUNT');
    assert.equal((await create(49999)).code, 'BELOW_MINIMUM');
    assert.equal((await repo.createOffer({ listingId, amount: 60000, actorProfileId: sibling, actorUserId: 'seller-account' })).code, 'SELF_OFFER');
  });

  test('corporate self-offer and structured turn state machine', async () => {
    db.listings[0].seller_type = 'CORPORATE';
    db.listings[0].corporate_profile_id = 'offer-store';
    assert.equal((await repo.createOffer({ listingId, amount: 60000, actorProfileId: sibling, actorUserId: 'seller-account' })).code, 'SELF_OFFER');
    db.listings[0].seller_type = 'INDIVIDUAL';
    db.listings[0].corporate_profile_id = undefined;
    const id = (await create()).thread!.id;
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: buyer, actorUserId: 'buyer-account', action: 'COUNTER', amount: 62000 })).success, false);
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: seller, actorUserId: 'seller-account', action: 'COUNTER', amount: 70000 })).thread?.turn_profile_id, buyer);
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: buyer, actorUserId: 'buyer-account', action: 'COUNTER', amount: 65000 })).thread?.turn_profile_id, seller);
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: seller, actorUserId: 'seller-account', action: 'ACCEPT' })).thread?.status, 'ACCEPTED');
    assert.equal(db.listings[0].status, 'ACTIVE');
  });

  test('six price movements are the hard maximum', async () => {
    const id = (await create()).thread!.id;
    for (const [index, actor] of [seller, buyer, seller, buyer, seller].entries()) {
      assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: actor, actorUserId: actor === seller ? 'seller-account' : 'buyer-account', action: 'COUNTER', amount: 61000 + index * 1000 })).success, true);
    }
    assert.equal(db.offerThreads[0].movement_count, 6);
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: buyer, actorUserId: 'buyer-account', action: 'COUNTER', amount: 70000 })).code, 'MOVEMENT_LIMIT');
  });

  test('reject, withdraw, cooldown and response expiry', async () => {
    let id = (await create()).thread!.id;
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: seller, actorUserId: 'seller-account', action: 'REJECT' })).thread?.status, 'REJECTED');
    assert.equal((await create()).code, 'COOLDOWN');
    db.offerThreads[0].updated_at = new Date(Date.now() - 31 * 60000).toISOString();
    id = (await create()).thread!.id;
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: buyer, actorUserId: 'buyer-account', action: 'WITHDRAW' })).thread?.status, 'WITHDRAWN');
    db.offerThreads.at(-1)!.updated_at = new Date(Date.now() - 31 * 60000).toISOString();
    id = (await create()).thread!.id;
    db.offerThreads.at(-1)!.expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal((await repo.actOnOffer({ threadId: id, actorProfileId: seller, actorUserId: 'seller-account', action: 'ACCEPT' })).success, false);
    assert.equal(db.offerThreads.at(-1)?.status, 'EXPIRED');
  });

  test('lifecycle close, price change, notifications, unread and privacy', async () => {
    const id = (await create()).thread!.id;
    const amount = db.offerThreads[0].current_amount;
    await repo.recordListingPriceChange(listingId, 100000, 90000);
    assert.equal(db.offerThreads[0].current_amount, amount);
    assert.deepEqual(db.offerEvents.at(-1)?.metadata, { oldPrice: 100000, newPrice: 90000 });
    assert.ok(await repo.getUnreadCount(buyer) > 0);
    assert.equal((await repo.markRead(id, buyer)).unreadCount, 0);
    assert.equal((await repo.getOffer(id, 'unauthorized')).success, false);
    await repo.closeForListing(listingId, 'LISTING_REMOVED_BY_ADMIN');
    assert.equal(db.offerThreads[0].close_reason, 'LISTING_REMOVED_BY_ADMIN');
    assert.equal(db.notifications.filter((notification) => notification.entity_id === id && notification.metadata?.eventType === 'THREAD_CLOSED').length, 2);
  });

  test('listing expiry closes active threads and republish does not reopen history', async () => {
    await create();
    db.listings[0].expires_at = new Date(Date.now() - 1000).toISOString();
    await repo.expireStale();
    assert.equal(db.offerThreads[0].status, 'CLOSED');
    assert.equal(db.offerThreads[0].close_reason, 'LISTING_EXPIRED');
    db.listings[0].status = 'ACTIVE';
    db.listings[0].expires_at = new Date(Date.now() + 86400000).toISOString();
    assert.equal(db.offerThreads[0].status, 'CLOSED');
  });

  test('canonical test accounts allow cross-account offers and reject same-account sibling offers generically', async () => {
    db.users = [];
    db.profiles = [];
    db.listings = [];
    db.offerThreads = [];
    db.offerEvents = [];
    db.notifications = [];

    const accountA = await syncExternalGameAccount(await new MockGtaWorldAuthProvider('fixtures').fetchAccount('test'));
    const accountB = await syncExternalGameAccount(await new MockGtaWorldAuthProvider('secondary').fetchAccount('test'));
    const mavis = accountA.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID)!;
    const john = accountB.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_JOHN_CHARACTER_ID)!;
    const jane = accountB.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_JANE_CHARACTER_ID)!;
    assert.notEqual(accountA.user.id, accountB.user.id);
    assert.equal(john.user_id, jane.user_id);

    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    db.listings = [
      { id: 'mavis-listing', listing_number: '#MAVIS', seller_profile_id: mavis.id, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Mavis listing', description: '', price: 100000, offers_enabled: true, minimum_offer_amount: 50000, location: null, status: 'ACTIVE', published_at: now, expires_at: expires, created_at: now, updated_at: now, images: [] },
      { id: 'john-listing', listing_number: '#JOHN', seller_profile_id: john.id, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'John listing', description: '', price: 100000, offers_enabled: true, minimum_offer_amount: 50000, location: null, status: 'ACTIVE', published_at: now, expires_at: expires, created_at: now, updated_at: now, images: [] },
      { id: 'jane-listing', listing_number: '#JANE', seller_profile_id: jane.id, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Jane listing', description: '', price: 100000, offers_enabled: true, minimum_offer_amount: 50000, location: null, status: 'ACTIVE', published_at: now, expires_at: expires, created_at: now, updated_at: now, images: [] },
    ] as any;

    assert.equal((await repo.createOffer({ listingId: 'mavis-listing', amount: 60000, actorProfileId: john.id, actorUserId: accountB.user.id })).success, true);
    assert.equal((await repo.createOffer({ listingId: 'john-listing', amount: 60000, actorProfileId: mavis.id, actorUserId: accountA.user.id })).success, true);
    assert.equal((await repo.createOffer({ listingId: 'jane-listing', amount: 60000, actorProfileId: john.id, actorUserId: accountB.user.id })).code, 'SELF_OFFER');
    assert.equal((await repo.createOffer({ listingId: 'john-listing', amount: 60000, actorProfileId: jane.id, actorUserId: accountB.user.id })).code, 'SELF_OFFER');

    const offerSources = [
      readFileSync(join(process.cwd(), 'src/lib/db/repositories/memory/memory-offer-repo.ts'), 'utf8'),
      readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-offer-repo.ts'), 'utf8'),
    ].join('\n');
    assert.doesNotMatch(offerSources, /test-login:account:|test-login:character:|John Doe|Jane Doe|Mavis Pierce/);
  });

  test('single migration retains schema, RLS and race protections', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260928010000_offer_system.sql'), 'utf8');
    for (const pattern of [/offer_threads/, /offer_events/, /ux_offer_threads_active_buyer_listing/, /ENABLE ROW LEVEL SECURITY/, /notifications_entity_type_check/, /close_listing_with_offers/, /expire_stale_offer_threads/, /pg_advisory_xact_lock/]) assert.match(sql, pattern);
  });
});