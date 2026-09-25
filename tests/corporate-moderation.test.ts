import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/lib/db/store';
import { resolveCorporateEligibility } from '../src/lib/dealers/eligibility';
import {
  reviewApplication,
  activateSubscription,
  boostListing,
  suspendCorporateStore,
  reactivateCorporateStore,
  deleteCorporateStore,
  applyForDealer,
} from '../src/lib/db/dealers';
import {
  createListingWithCredit,
  getUserListings,
  getCorporateListings,
  getPublicListings,
  getListingById,
} from '../src/lib/db/listings';

describe('Sanboard – Corporate Listing Seller Context & Admin Moderation', () => {
  const ZADE_USER_ID = 'usr-zade';
  const ZADE_CHAR_ID = 'char-zade-01';
  const MAVIS_ADMIN_ID = 'char-mavis-admin';

  beforeEach(() => {
    // Reset seed state in memory
    db.profiles = [
      {
        id: ZADE_CHAR_ID,
        user_id: ZADE_USER_ID,
        full_name: 'Zade Vexnera',
        avatar_url: '',
        sanmail_email: 'zade@sanmail.com',
        phone: '555-0909',
        is_dealer: false,
        public_id: 101,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: MAVIS_ADMIN_ID,
        user_id: 'usr-mavis-account',
        full_name: 'Mavis Pierce',
        avatar_url: '',
        sanmail_email: 'mavis@sanmail.com',
        phone: '555-0101',
        is_dealer: false,
        role: 'ADMIN',
        public_id: 102,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    db.dealers = [];
    db.applications = [];
    db.followers = [];
    db.credits = [];
    db.listings = [];
    db.favorites = [];
    db.notifications = [];
    db.auditLogs = [];
  });

  describe('26. Corporate Eligibility Resolver State Machine', () => {
    it('returns NO_STORE when character has no application or store', async () => {
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'NO_STORE');
    });

    it('returns PENDING_APPLICATION when application is waiting for admin review', async () => {
      db.applications.push({
        id: 'app-bum-01',
        applicant_profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        purpose: 'Araç galerisi',
        status: 'PENDING',
        created_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'PENDING_APPLICATION');
    });

    it('returns REJECTED_APPLICATION when application was rejected and no store exists', async () => {
      db.applications.push({
        id: 'app-bum-01',
        applicant_profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        purpose: 'Araç galerisi',
        status: 'REJECTED',
        rejection_reason: 'Geçersiz vergi levhası',
        created_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'REJECTED_APPLICATION');
    });

    it('returns SUBSCRIPTION_INACTIVE when approved but subscription not yet paid/activated', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'INACTIVE',
        moderation_status: 'ACTIVE',
        boost_credits: 0,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'SUBSCRIPTION_INACTIVE');
    });

    it('returns SUBSCRIPTION_EXPIRED when subscription expired in the past', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'EXPIRED',
        subscription_expires_at: new Date(Date.now() - 86400000).toISOString(),
        moderation_status: 'ACTIVE',
        boost_credits: 0,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'SUBSCRIPTION_EXPIRED');
    });

    it('returns STORE_SUSPENDED when store is suspended even if subscription is active', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 864000000).toISOString(),
        moderation_status: 'SUSPENDED',
        suspension_reason: 'Kural ihlali incelemesi',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'STORE_SUSPENDED');
    });

    it('returns STORE_DELETED when store is soft-deleted', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'DELETED',
        deleted_at: new Date().toISOString(),
        boost_credits: 0,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'STORE_DELETED');
    });

    it('returns ACTIVE and eligible: true when subscription and moderation are ACTIVE', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 864000000).toISOString(),
        moderation_status: 'ACTIVE',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, true);
      assert.strictEqual(eligibility.reason, 'ACTIVE');
      assert.ok(eligibility.dealer);
      assert.strictEqual(eligibility.dealer.id, 'store-bum-01');
    });
  });

  describe('27. Strict Seller Separation (Personal vs Corporate)', () => {
    beforeEach(() => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 864000000).toISOString(),
        moderation_status: 'ACTIVE',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      // Add individual credit and corporate credit
      db.credits.push(
        {
          id: 'cred-ind-01',
          profile_id: ZADE_CHAR_ID,
          package_id: 'pkg-ind',
          credit_type: 'INDIVIDUAL',
          status: 'AVAILABLE',
          amount: 2000,
          created_at: new Date().toISOString(),
        } as any,
        {
          id: 'cred-corp-01',
          profile_id: ZADE_CHAR_ID,
          corporate_profile_id: 'store-bum-01',
          package_id: 'pkg-corp',
          credit_type: 'CORPORATE',
          status: 'AVAILABLE',
          amount: 1750,
          created_at: new Date().toISOString(),
        } as any
      );
    });

    it('publishes personal vehicle: INDIVIDUAL seller, visible in Bireysel İlanlarım, NOT in Bum Motors', async () => {
      const res = await createListingWithCredit(
        {
          category: 'vehicle',
          subcategory: 'Sedan',
          title: 'Zade Kişisel Sultan RS',
          description: 'Garaj aracımdır',
          price: 90000,
          seller_type: 'INDIVIDUAL',
        },
        ZADE_CHAR_ID
      );

      assert.strictEqual(res.success, true);
      assert.ok(res.listing);
      assert.strictEqual(res.listing.seller_type, 'INDIVIDUAL');
      assert.strictEqual(res.listing.corporate_profile_id, undefined);

      // Check Bireysel İlanlarım query
      const userListings = await getUserListings(ZADE_CHAR_ID);
      assert.strictEqual(userListings.length, 1);
      assert.strictEqual(userListings[0].title, 'Zade Kişisel Sultan RS');

      // Check Bum Motors query
      const storeListings = await getCorporateListings('store-bum-01');
      assert.strictEqual(storeListings.length, 0);
    });

    it('publishes corporate vehicle: CORPORATE seller, visible in Bum Motors, NOT in Bireysel İlanlarım', async () => {
      const res = await createListingWithCredit(
        {
          category: 'vehicle',
          subcategory: 'Sports',
          title: 'Bum Motors Elegy Retro Custom',
          description: 'Sıfır ayarında galeri stoğu',
          price: 180000,
          seller_type: 'CORPORATE',
          corporate_profile_id: 'store-bum-01',
        },
        ZADE_CHAR_ID
      );

      assert.strictEqual(res.success, true);
      assert.ok(res.listing);
      assert.strictEqual(res.listing.seller_type, 'CORPORATE');
      assert.strictEqual(res.listing.corporate_profile_id, 'store-bum-01');

      // Check Bireysel İlanlarım query -> MUST BE EMPTY
      const userListings = await getUserListings(ZADE_CHAR_ID);
      assert.strictEqual(userListings.length, 0);

      // Check Bum Motors query -> MUST HAVE THE CORPORATE LISTING
      const storeListings = await getCorporateListings('store-bum-01');
      assert.strictEqual(storeListings.length, 1);
      assert.strictEqual(storeListings[0].title, 'Bum Motors Elegy Retro Custom');
    });
  });

  describe('28. Corporate Boost Isolation', () => {
    beforeEach(() => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 864000000).toISOString(),
        moderation_status: 'ACTIVE',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      // 1 personal listing
      db.listings.push({
        id: 'list-personal-01',
        user_id: ZADE_USER_ID,
        profile_id: ZADE_CHAR_ID,
        category: 'vehicle',
        subcategory: 'Sedan',
        title: 'Zade Kişisel Araç',
        description: 'Test',
        price: 50000,
        seller_type: 'INDIVIDUAL',
        status: 'ACTIVE',
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      } as any);

      // 1 corporate listing
      db.listings.push({
        id: 'list-corp-01',
        user_id: ZADE_USER_ID,
        profile_id: ZADE_CHAR_ID,
        corporate_profile_id: 'store-bum-01',
        category: 'vehicle',
        subcategory: 'Sports',
        title: 'Bum Motors Şirket Aracı',
        description: 'Test',
        price: 150000,
        seller_type: 'CORPORATE',
        status: 'ACTIVE',
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      } as any);
    });

    it('rejects boosting an individual listing with corporate store boost rights', async () => {
      const res = await boostListing('store-bum-01', 'list-personal-01');
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /kurumsal/i);

      // Store boost credits must remain 3
      assert.strictEqual(db.dealers[0].boost_credits, 3);
    });

    it('allows boosting a corporate listing and decrements store boost credits by 1', async () => {
      const res = await boostListing('store-bum-01', 'list-corp-01');
      assert.strictEqual(res.success, true);

      // Verify boost fields on listing
      const corpListing = db.listings.find((l) => l.id === 'list-corp-01')!;
      assert.strictEqual(corpListing.is_featured, true);
      assert.ok(corpListing.featured_until);

      // Store boost credits must be decremented to 2
      assert.strictEqual(db.dealers[0].boost_credits, 2);
    });
  });

  describe('29. Admin Store Moderation (Suspend & Reactivate)', () => {
    beforeEach(() => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 864000000).toISOString(),
        moderation_status: 'ACTIVE',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      db.listings.push({
        id: 'list-corp-01',
        user_id: ZADE_USER_ID,
        seller_profile_id: ZADE_CHAR_ID,
        corporate_profile_id: 'store-bum-01',
        category: 'vehicle',
        subcategory: 'Sports',
        title: 'Bum Motors Vitrin Aracı',
        description: 'Test',
        price: 150000,
        seller_type: 'CORPORATE',
        status: 'ACTIVE',
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      } as any);
    });

    it('suspends store: updates moderation_status, sends character-scoped notification, hides corporate listings from public', async () => {
      const res = await suspendCorporateStore(
        'store-bum-01',
        'Şüpheli ilan aktiviteleri nedeniyle askıya alındı',
        MAVIS_ADMIN_ID
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(db.dealers[0].moderation_status, 'SUSPENDED');
      assert.strictEqual(db.dealers[0].suspension_reason, 'Şüpheli ilan aktiviteleri nedeniyle askıya alındı');
      assert.strictEqual(db.dealers[0].suspended_by_profile_id, MAVIS_ADMIN_ID);

      // Character-scoped notification to Zade
      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      assert.strictEqual(zadeNotifs.length, 1);
      assert.strictEqual(zadeNotifs[0].type, 'CORPORATE_STORE_SUSPENDED');
      assert.match(zadeNotifs[0].message, /askıya alındı/i);

      // Corporate publishing blocked
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'STORE_SUSPENDED');

      // Boost blocked
      const boostRes = await boostListing('store-bum-01', 'list-corp-01');
      assert.strictEqual(boostRes.success, false);
      assert.match(boostRes.error || '', /askıya alınmış/i);

      // Public listings hide suspended store's items
      const publicListings = await getPublicListings();
      assert.strictEqual(publicListings.length, 0);

      // Direct listing view blocked
      const directListing = await getListingById('list-corp-01');
      assert.strictEqual(directListing.listing, null);
    });

    it('reactivates suspended store without bypassing subscription state', async () => {
      // 1. Store is suspended and subscription is EXPIRED
      db.dealers[0].moderation_status = 'SUSPENDED';
      db.dealers[0].subscription_status = 'EXPIRED';
      db.dealers[0].subscription_expires_at = new Date(Date.now() - 1000).toISOString();

      const res = await reactivateCorporateStore('store-bum-01', MAVIS_ADMIN_ID);
      assert.strictEqual(res.success, true);
      assert.strictEqual(db.dealers[0].moderation_status, 'ACTIVE');

      // Subscription MUST NOT be activated by admin reactivation
      assert.strictEqual(db.dealers[0].subscription_status, 'EXPIRED');

      // Eligibility must indicate SUBSCRIPTION_EXPIRED (not eligible yet)
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'SUBSCRIPTION_EXPIRED');

      // Notification sent to Zade
      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      assert.strictEqual(zadeNotifs.some((n) => n.type === 'CORPORATE_STORE_REACTIVATED'), true);
    });
  });

  describe('30. Admin Store Soft Delete & Reapplication', () => {
    beforeEach(() => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'ACTIVE',
        boost_credits: 3,
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      db.listings.push({
        id: 'list-corp-01',
        user_id: ZADE_USER_ID,
        seller_profile_id: ZADE_CHAR_ID,
        corporate_profile_id: 'store-bum-01',
        category: 'vehicle',
        subcategory: 'Sports',
        title: 'Bum Motors Stoğu',
        description: 'Test',
        price: 150000,
        seller_type: 'CORPORATE',
        status: 'ACTIVE',
        media_urls: ['listings/list-corp-01/1.webp'],
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      } as any);
    });

    it('soft-deletes store: transitions listings to REMOVED, sends notification, and allows character to reapply', async () => {
      const res = await deleteCorporateStore(
        'store-bum-01',
        'İşletme faaliyetini sonlandırdı',
        MAVIS_ADMIN_ID
      );

      assert.strictEqual(res.success, true);
      const store = db.dealers.find((d) => d.id === 'store-bum-01')!;
      assert.strictEqual(store.moderation_status, 'DELETED');
      assert.strictEqual(store.deletion_reason, 'İşletme faaliyetini sonlandırdı');
      assert.strictEqual(store.deleted_by_profile_id, MAVIS_ADMIN_ID);
      assert.ok(store.deleted_at);

      // Corporate listings transitioned to REMOVED
      const listing = db.listings.find((l) => l.id === 'list-corp-01')!;
      assert.strictEqual(listing.status, 'REMOVED');

      // Notification sent
      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      assert.strictEqual(zadeNotifs.some((n) => n.type === 'CORPORATE_STORE_DELETED'), true);

      // Character can reapply without conflicting with deleted store
      const applyRes = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'Zade New Automotive',
        purpose: 'Yeni galeri başvurusu',
      });
      assert.strictEqual(applyRes.success, true);
      assert.ok(applyRes.application);

      // Eligibility resolves to PENDING_APPLICATION for the new business
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'PENDING_APPLICATION');
    });
  });
});
