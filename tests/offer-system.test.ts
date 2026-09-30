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
    assert.equal((await create(49999)).code, 'MINIMUM_OFFER_NOT_MET');
    assert.equal((await repo.createOffer({ listingId, amount: 60000, actorProfileId: sibling, actorUserId: 'seller-account' })).code, 'SELF_OFFER');
  });

  test('minimum offer is enforced for individual, corporate, test-like and direct repository requests', async () => {
    db.listings[0].minimum_offer_amount = 100000;
    assert.equal((await create(50000)).code, 'MINIMUM_OFFER_NOT_MET');
    assert.match((await create(50000)).error || '', /\$100\.000/);
    assert.equal((await create(100000)).success, true);
    db.offerThreads = []; db.offerEvents = [];
    assert.equal((await create(150000)).success, true);
    db.offerThreads = []; db.offerEvents = [];
    db.listings[0].seller_type = 'CORPORATE';
    db.listings[0].corporate_profile_id = 'offer-store';
    assert.equal((await create(50000)).code, 'MINIMUM_OFFER_NOT_MET');
    db.listings[0].minimum_offer_amount = null;
    assert.equal((await create(50000)).success, true);
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

  test('participant hide is isolated, preserves history and remains hidden after reload, sync and new activity', async () => {
    await create();
    const thread = db.offerThreads[0];
    const eventCount = db.offerEvents.length;
    assert.equal((await repo.hideOffer(thread.id, buyer)).success, true);
    assert.equal((await repo.listOffers({ actorProfileId: buyer, box: 'sent' })).threads.length, 0);
    assert.equal((await repo.listOffers({ actorProfileId: seller, box: 'received' })).threads.length, 1);
    assert.equal(db.offerEvents.length, eventCount);
    assert.equal((await repo.hideOffer(thread.id, sibling)).success, false);
    await repo.actOnOffer({ threadId: thread.id, actorProfileId: seller, actorUserId: 'seller-account', action: 'COUNTER', amount: 70000 });
    const freshRepo = new MemoryOfferRepository();
    assert.equal((await freshRepo.listOffers({ actorProfileId: buyer, box: 'sent' })).threads.length, 0);
    assert.equal((await freshRepo.getOffer(thread.id, buyer)).success, false);
    db.users = [
      { id: 'buyer-account', provider: 'GTAWORLD', external_user_id: 'buyer-external', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'seller-account', provider: 'GTAWORLD', external_user_id: 'seller-external', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
    ] as any;
    db.profiles.find((profile) => profile.id === buyer)!.external_character_id = 'buyer-character';
    await syncExternalGameAccount({ externalAccountId: 'buyer-external', characters: [{ externalCharacterId: 'buyer-character', displayName: 'Buyer Renamed' }] });
    assert.equal((await new MemoryOfferRepository().listOffers({ actorProfileId: buyer, box: 'sent' })).threads.length, 0);
  });

  test('accepted individual thread exposes the same canonical seller contact to both sides', async () => {
    await create();
    const thread = db.offerThreads[0];
    db.profiles[0].phone_visibility = 'PRIVATE';
    db.profiles[0].sanmail_visibility = 'PUBLIC';
    await repo.actOnOffer({ threadId: thread.id, actorProfileId: seller, actorUserId: 'seller-account', action: 'ACCEPT' });
    const buyerDetail = await repo.getOffer(thread.id, buyer);
    const sellerDetail = await repo.getOffer(thread.id, seller);
    assert.deepEqual(buyerDetail.thread?.visible_contact, sellerDetail.thread?.visible_contact);
    assert.equal(buyerDetail.thread?.visible_contact?.phone, '');
    assert.equal(buyerDetail.thread?.visible_contact?.sanmail_email, 'seller@sanmail.com');
    assert.notEqual(sellerDetail.thread?.visible_contact?.sanmail_email, 'buyer@sanmail.com');
    db.profiles[0].sanmail_visibility = 'PRIVATE';
    const privateDetail = await repo.getOffer(thread.id, buyer);
    assert.equal(privateDetail.thread?.visible_contact?.phone, '');
    assert.equal(privateDetail.thread?.visible_contact?.sanmail_email, '');
  });

  test('accepted corporate thread uses canonical store contact, never buyer contact', async () => {
    db.listings[0].seller_type = 'CORPORATE';
    db.listings[0].corporate_profile_id = 'offer-store';
    db.dealers[0].phone = '5559000';
    db.dealers[0].sanmail_email = 'store@sanmail.com';
    await create();
    const thread = db.offerThreads[0];
    await repo.actOnOffer({ threadId: thread.id, actorProfileId: seller, actorUserId: 'seller-account', action: 'ACCEPT' });
    const buyerDetail = await repo.getOffer(thread.id, buyer);
    const sellerDetail = await repo.getOffer(thread.id, seller);
    assert.deepEqual(buyerDetail.thread?.visible_contact, { phone: '5559000', sanmail_email: 'store@sanmail.com' });
    assert.deepEqual(sellerDetail.thread?.visible_contact, buyerDetail.thread?.visible_contact);
    assert.notEqual(buyerDetail.thread?.visible_contact?.phone, '2');
  });

  test('unread box counts split received and sent, exclude own events and update after read', async () => {
    await create();
    assert.deepEqual(await repo.getUnreadCounts(seller), { total: 1, received: 1, sent: 0 });
    assert.deepEqual(await repo.getUnreadCounts(buyer), { total: 0, received: 0, sent: 0 });
    const thread = db.offerThreads[0];
    await repo.actOnOffer({ threadId: thread.id, actorProfileId: seller, actorUserId: 'seller-account', action: 'COUNTER', amount: 70000 });
    assert.deepEqual(await repo.getUnreadCounts(buyer), { total: 1, received: 0, sent: 1 });
    await repo.markRead(thread.id, buyer);
    assert.deepEqual(await repo.getUnreadCounts(buyer), { total: 0, received: 0, sent: 0 });
  });

  test('bulk read is box-scoped, durable and cannot affect another profile', async () => {
    await create();
    const receivedThread = db.offerThreads[0];
    db.profiles.push({ id: 'offer-other-seller', user_id: 'other-account', full_name: 'Other Seller', avatar_url: '', sanmail_email: '', phone: '', created_at: '', updated_at: '' } as any);
    db.listings.push({ ...db.listings[0], id: 'offer-other-listing', listing_number: '#OTHER', seller_profile_id: 'offer-other-seller', title: 'Other listing' } as any);
    assert.equal((await repo.createOffer({ listingId: 'offer-other-listing', amount: 60000, actorProfileId: seller, actorUserId: 'seller-account' })).success, true);
    const sentThread = db.offerThreads.find((thread) => thread.listing_id === 'offer-other-listing')!;
    assert.equal((await repo.actOnOffer({ threadId: sentThread.id, actorProfileId: 'offer-other-seller', actorUserId: 'other-account', action: 'COUNTER', amount: 70000 })).success, true);

    assert.deepEqual(await repo.getUnreadCounts(seller), { total: 2, received: 1, sent: 1 });
    const sentReadCursorBeforeReceivedBulkRead = sentThread.buyer_last_read_at;
    const receivedResult = await repo.markAllRead(seller, 'received');
    assert.equal(receivedResult.count, 1);
    assert.deepEqual(receivedResult.unreadCounts, { total: 1, received: 0, sent: 1 });
    assert.ok(receivedThread.seller_last_read_at);
    assert.equal(receivedThread.seller_last_read_at, db.offerEvents.filter((event) => event.thread_id === receivedThread.id && event.actor_profile_id !== seller).map((event) => event.created_at).sort().at(-1));
    assert.equal(sentThread.buyer_last_read_at, sentReadCursorBeforeReceivedBulkRead);
    assert.deepEqual(await new MemoryOfferRepository().getUnreadCounts(seller), { total: 1, received: 0, sent: 1 });

    const outsiderResult = await repo.markAllRead(sibling, 'sent');
    assert.equal(outsiderResult.count, 0);
    assert.deepEqual(await repo.getUnreadCounts(seller), { total: 1, received: 0, sent: 1 });

    const sentResult = await repo.markAllRead(seller, 'sent');
    assert.equal(sentResult.count, 1);
    assert.deepEqual(sentResult.unreadCounts, { total: 0, received: 0, sent: 0 });
    assert.ok(sentThread.buyer_last_read_at);
  });

  test('bulk-read migration preserves box semantics and service-role boundary', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260930220000_offer_box_bulk_read.sql'), 'utf8');
    assert.match(sql, /p_box IS NULL OR p_box NOT IN \('received', 'sent'\)/);
    assert.match(sql, /p_box = 'received'[\s\S]*seller_profile_id = p_actor_profile_id[\s\S]*seller_hidden_at IS NULL/);
    assert.match(sql, /ELSE[\s\S]*buyer_profile_id = p_actor_profile_id[\s\S]*buyer_hidden_at IS NULL/);
    assert.match(sql, /actor_profile_id IS DISTINCT FROM p_actor_profile_id/);
    assert.match(sql, /MAX\(e\.created_at\) AS read_at/);
    assert.match(sql, /SET seller_last_read_at = u\.read_at/);
    assert.match(sql, /SET buyer_last_read_at = u\.read_at/);
    assert.doesNotMatch(sql, /SET (?:seller|buyer)_last_read_at = v_now/);
    assert.match(sql, /ALTER COLUMN created_at SET DEFAULT clock_timestamp\(\)/);
    assert.doesNotMatch(sql, /assign_offer_event_created_at/);
    assert.doesNotMatch(sql, /CREATE TRIGGER/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.mark_offer_thread_read[\s\S]*MAX\(e\.created_at\)[\s\S]*GREATEST\(COALESCE\(buyer_last_read_at[\s\S]*GREATEST\(COALESCE\(seller_last_read_at/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.hide_offer_thread[\s\S]*MAX\(e\.created_at\)[\s\S]*GREATEST\(COALESCE\(buyer_last_read_at[\s\S]*GREATEST\(COALESCE\(seller_last_read_at/);
    assert.equal((sql.match(/IF p_actor_profile_id IS NULL/g) || []).length, 3);
    assert.match(sql, /p_actor_profile_id IS NULL[\s\S]*Teklif bulunamadı/);
    assert.equal((sql.match(/PERFORM 1[\s\S]*?ORDER BY t\.id\s+FOR UPDATE;/g) || []).length, 2);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.close_offers_for_listing[\s\S]*ORDER BY t\.id\s+FOR UPDATE OF t[\s\S]*INSERT INTO public\.offer_events/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_offer_listing_price_change[\s\S]*ORDER BY t\.id\s+FOR UPDATE OF t[\s\S]*INSERT INTO public\.offer_events/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.expire_stale_offer_threads[\s\S]*ORDER BY t\.id\s+FOR UPDATE OF t[\s\S]*INSERT INTO public\.offer_events/);
    assert.equal((sql.match(/ORDER BY t\.id\s+FOR UPDATE(?: OF t)?/g) || []).length, 5);
    assert.match(sql, /FOR UPDATE/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.mark_offer_box_read\(UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.mark_offer_box_read\(UUID, TEXT\) TO service_role/);
  });

  test('offer API ignores client supplied contact identity fields', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/offers/[id]/route.ts'), 'utf8');
    const repos = readFileSync(join(process.cwd(), 'src/lib/db/repositories/memory/memory-offer-repo.ts'), 'utf8') + readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-offer-repo.ts'), 'utf8');
    assert.doesNotMatch(route, /ownerProfileId|sellerProfileId|contactProfileId/);
    assert.match(repos, /redactPrivateContact\(seller\)|redactPrivateContact\(thread\.seller\)/);
  });

  test('corrective migration adds participant visibility without rewriting production offer migration', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260928020000_offer_participant_visibility.sql'), 'utf8');
    for (const pattern of [/buyer_hidden_at/, /seller_hidden_at/, /hide_offer_thread/, /restore_offer_thread_visibility_on_event/, /get_offer_unread_count/]) assert.match(sql, pattern);
  });

  test('durable visibility migration removes automatic offer restore trigger', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261002010000_persistent_user_hidden_history.sql'), 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS buyer_hidden_at/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS seller_hidden_at/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS payment_history_cleared_at/);
    assert.match(sql, /DROP TRIGGER IF EXISTS offer_event_restores_participant_visibility/);
    assert.match(sql, /DROP FUNCTION IF EXISTS public\.restore_offer_thread_visibility_on_event/);
  });
});