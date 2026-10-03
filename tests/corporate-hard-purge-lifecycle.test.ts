import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/lib/db/store';
import { applyForDealer, deleteCorporateStore, reviewApplication } from '@/lib/db/dealers';
import { getPublicListings } from '@/lib/db/listings';

describe('corporate profile permanent purge lifecycle', () => {
  const owner = 'char-zade-purge';
  const admin = 'char-admin-purge';
  const store = 'store-a-purge';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    const now = new Date().toISOString();
    db.profiles = [
      { id: owner, user_id: 'user-zade', full_name: 'Zade', avatar_url: '', sanmail_email: 'zade@sanmail.com', phone: '1', is_dealer: true, dealer_id: store, created_at: now, updated_at: now },
      { id: admin, user_id: 'user-admin', full_name: 'Admin', avatar_url: '', sanmail_email: 'admin@sanmail.com', phone: '2', role: 'ADMIN', created_at: now, updated_at: now },
    ] as any;
    db.dealers = [{ id: store, profile_id: owner, owner_profile_id: owner, company_name: 'Corporate A', slug: 'corporate-a', description: '', logo_url: 'dealers/logos/a/logo.webp', banner_url: 'dealers/banners/a/banner.webp', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2099-01-01T00:00:00.000Z', boost_credits: 4, monthly_boost_credits: 3, purchased_boost_credits: 1, created_at: now, updated_at: now }] as any;
    db.listings = [{ id: 'listing-a', listing_number: '#A', seller_profile_id: owner, corporate_profile_id: store, seller_type: 'CORPORATE', category: 'vehicle', subcategory: 'Otomobil', title: 'A', description: 'A', price: 1, location: null, status: 'ACTIVE', published_at: now, expires_at: '2099-01-01T00:00:00.000Z', created_at: now, updated_at: now, images: [{ id: 'image-a', listing_id: 'listing-a', storage_path: 'listings/a/image.webp', sort_order: 0, is_cover: true, size_bytes: 1, created_at: now }] }] as any;
    db.followers = [{ id: 'follow-a', follower_profile_id: admin, corporate_profile_id: store, created_at: now }];
    db.payments = [{ id: 'payment-a', order_id: 'order-a', profile_id: owner, package_id: 'package-a', provider: 'FLEECA', corporate_profile_id: store, amount: 1, status: 'SUCCESS', created_at: now }] as any;
    db.credits = [{ id: 'credit-a', profile_id: owner, payment_id: 'payment-a', package_id: 'package-a', credit_type: 'CORPORATE', corporate_profile_id: store, status: 'AVAILABLE', created_at: now }] as any;
    db.offerThreads = [{ id: 'offer-a', listing_id: 'listing-a', buyer_profile_id: admin, seller_profile_id: owner, seller_corporate_profile_id: store, current_amount: 1, status: 'ACTIVE', movement_count: 1, expires_at: '2099-01-01T00:00:00.000Z', created_at: now, updated_at: now }] as any;
    db.offerEvents = []; db.applications = []; db.notifications = []; db.auditLogs = []; db.favorites = []; db.priceHistories = [];
  });

  test('purges A, preserves protected history, then approves B for the same character', async () => {
    assert.equal((await deleteCorporateStore(store, 'Permanent close', admin)).success, true);
    assert.equal(db.dealers.some((item) => item.id === store), false);
    assert.equal(db.listings[0].status, 'REMOVED');
    assert.equal((await getPublicListings({})).some((item) => item.id === 'listing-a'), false);
    assert.equal(db.profiles[0].is_dealer, false);
    assert.equal(db.profiles[0].dealer_id, undefined);
    assert.equal(db.followers.length, 0);
    assert.equal(db.payments[0].corporate_profile_id, null);
    assert.equal(db.payments[0].historical_corporate_profile_id, store);
    assert.equal(db.credits[0].corporate_profile_id, null);
    assert.equal(db.credits[0].status, 'AVAILABLE');
    assert.equal(db.offerThreads[0].seller_corporate_profile_id, null);
    assert.equal(db.offerThreads[0].historical_seller_corporate_profile_id, store);
    assert.ok(db.auditLogs.some((item) => item.event_type === 'CORPORATE_STORE_DELETED'));

    const application = await applyForDealer({ profileId: owner, companyName: 'Corporate B', purpose: 'Fresh application' });
    assert.equal(application.success, true);
    assert.equal((await reviewApplication(application.application!.id, 'APPROVED', undefined, admin)).success, true);
    const liveStores = db.dealers.filter((item) => (item.owner_profile_id || item.profile_id) === owner && item.moderation_status !== 'DELETED' && !item.deleted_at);
    assert.equal(liveStores.length, 1);
    assert.equal(liveStores[0].company_name, 'Corporate B');
  });

  test('an active store still blocks a second application and approval path', async () => {
    const application = await applyForDealer({ profileId: owner, companyName: 'Corporate B', purpose: 'Duplicate' });
    assert.equal(application.success, false);
    db.applications.push({ id: 'forced-pending', applicant_profile_id: owner, company_name: 'Corporate B', purpose: 'Duplicate', status: 'PENDING', created_at: new Date().toISOString() } as any);
    const approval = await reviewApplication('forced-pending', 'APPROVED', undefined, admin);
    assert.equal(approval.success, false);
    assert.match(approval.error || '', /zaten onaylanmış/i);
    assert.equal(db.dealers.length, 1);
  });
});