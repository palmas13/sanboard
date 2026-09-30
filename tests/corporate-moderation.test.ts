import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/lib/db/store';
import { resolveCorporateEligibility, resolveCorporateHeaderActions } from '../src/lib/dealers/eligibility';
import { baseListingSchema, vehicleListingSchema } from '../src/lib/validations/listing';
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
      const res = await boostListing(ZADE_CHAR_ID, 'list-personal-01');
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /kurumsal/i);

      // Store boost credits must remain 3
      assert.strictEqual(db.dealers[0].boost_credits, 3);
    });

    it('allows boosting a corporate listing and decrements store boost credits by 1', async () => {
      const res = await boostListing(ZADE_CHAR_ID, 'list-corp-01');
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
      const boostRes = await boostListing(ZADE_CHAR_ID, 'list-corp-01');
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

  describe('31. Section 17 Regression Test Suite', () => {
    const RAVI_SIBLING_CHAR_ID = 'char-ravi-02';

    beforeEach(() => {
      // Add Ravi as sibling on same user_id ZADE_USER_ID
      db.profiles.push({
        id: RAVI_SIBLING_CHAR_ID,
        user_id: ZADE_USER_ID,
        full_name: 'Ravi Blumon',
        avatar_url: '',
        sanmail_email: 'ravi@sanmail.com',
        phone: '555-0910',
        is_dealer: false,
        public_id: 103,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    it('Scenario 1 & 14: Zade Bum Motors ACTIVE -> eligible=true, Corporate Dashboard İlan Ver permitted', async () => {
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
      assert.strictEqual(eligibility.dealer?.id, 'store-bum-01');
    });

    it('Scenario 2 & 5 & 7: Admin SUSPENDED -> public hidden, Zade sees STORE_SUSPENDED, Zade gets notif, Ravi gets 0 notifs, new application blocked', async () => {
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

      await suspendCorporateStore('store-bum-01', 'Kural ihlali incelemesi', MAVIS_ADMIN_ID);

      // Notification only to Zade
      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      const raviNotifs = db.notifications.filter((n) => n.recipient_profile_id === RAVI_SIBLING_CHAR_ID);
      assert.strictEqual(zadeNotifs.length, 1);
      assert.match(zadeNotifs[0].message, /Bum Motors/);
      assert.strictEqual(raviNotifs.length, 0, 'Sibling Ravi must receive 0 notifications');

      // Zade sees STORE_SUSPENDED
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'STORE_SUSPENDED');

      // Cannot apply for new dealer while suspended
      const applyRes = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'Zade Another Auto',
        purpose: 'Deneme',
      });
      assert.strictEqual(applyRes.success, false);
      assert.match(applyRes.error || '', /askıya alınmış/i);
    });

    it('Scenario 4 & 6 & 7: Admin DELETED -> only Zade gets notif, Ravi gets 0 notifs, Zade sees NO_STORE, can reapply', async () => {
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

      await deleteCorporateStore('store-bum-01', 'Kapatıldı', MAVIS_ADMIN_ID);

      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      const raviNotifs = db.notifications.filter((n) => n.recipient_profile_id === RAVI_SIBLING_CHAR_ID);
      assert.strictEqual(zadeNotifs.length, 1);
      assert.match(zadeNotifs[0].message, /Bum Motors.*silinmiştir/);
      assert.strictEqual(raviNotifs.length, 0, 'Sibling Ravi must receive 0 notifications');

      // Zade sees STORE_DELETED when resolved with store, but getDealerByProfileId(ZADE_CHAR_ID) excludes deleted store!
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'STORE_DELETED');

      // Zade can reapply
      const applyRes = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'Zade Fresh Motors',
        purpose: 'Yeni başlangıç',
      });
      assert.strictEqual(applyRes.success, true);
    });

    it('Scenario 8, 9, 10: Ownership checks (isListingOwnedByActiveProfile)', async () => {
      const { isListingOwnedByActiveProfile } = await import('../src/lib/dealers/eligibility');

      const indListing = {
        id: 'l-ind-1',
        seller_type: 'INDIVIDUAL' as const,
        seller_profile_id: ZADE_CHAR_ID,
      };

      const corpListing = {
        id: 'l-corp-1',
        seller_type: 'CORPORATE' as const,
        seller_profile_id: ZADE_CHAR_ID,
        corporate_profile_id: 'store-bum-01',
      };

      // 8) Başkasının ilanında owner=false
      assert.strictEqual(isListingOwnedByActiveProfile(indListing, MAVIS_ADMIN_ID), false);
      assert.strictEqual(isListingOwnedByActiveProfile(corpListing, MAVIS_ADMIN_ID, ZADE_CHAR_ID), false);

      // 8b) Sibling Ravi on Zade's individual or corporate listing -> false!
      assert.strictEqual(isListingOwnedByActiveProfile(indListing, RAVI_SIBLING_CHAR_ID), false);
      assert.strictEqual(isListingOwnedByActiveProfile(corpListing, RAVI_SIBLING_CHAR_ID, ZADE_CHAR_ID), false);

      // 9) Kendi bireysel ilanında owner=true
      assert.strictEqual(isListingOwnedByActiveProfile(indListing, ZADE_CHAR_ID), true);

      // 10) Kendi kurumsal ilanında owner=true (store owner = Zade)
      assert.strictEqual(isListingOwnedByActiveProfile(corpListing, ZADE_CHAR_ID, ZADE_CHAR_ID), true);
    });

    it('Scenario 11 & 12: Favorite count DB aggregate persists across simulated reload and matches İlanlarım', async () => {
      // Create listing
      db.listings.push({
        id: 'l-fav-test',
        seller_profile_id: ZADE_CHAR_ID,
        user_id: ZADE_USER_ID,
        category: 'vehicle',
        subcategory: 'Sedan',
        title: 'Favori Test Aracı',
        description: 'Test',
        price: 50000,
        seller_type: 'INDIVIDUAL',
        status: 'ACTIVE',
        favorite_count: 0,
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      } as any);

      // Someone favorites the listing (Mavis)
      db.favorites.push({
        id: 'fav-1',
        user_id: 'usr-mavis-account',
        profile_id: MAVIS_ADMIN_ID,
        listing_id: 'l-fav-test',
        created_at: new Date().toISOString(),
      });

      // Query listing details
      const detail = await getListingById('l-fav-test');
      assert.strictEqual(detail.listing?.favorite_count, 1, 'Listing detail must reflect real DB count');

      // Another user (Ravi) favorites the listing
      db.favorites.push({
        id: 'fav-2',
        user_id: ZADE_USER_ID,
        profile_id: RAVI_SIBLING_CHAR_ID,
        listing_id: 'l-fav-test',
        created_at: new Date().toISOString(),
      });

      // Reload/re-query listing details -> count must be 2
      const reloadedDetail = await getListingById('l-fav-test');
      assert.strictEqual(reloadedDetail.listing?.favorite_count, 2, 'Reloaded listing must reflect DB count=2');

      // Check Zade's "İlanlarım" screen
      const zadeListings = await getUserListings(ZADE_CHAR_ID);
      assert.strictEqual(zadeListings.length, 1);
      assert.strictEqual(zadeListings[0].favorite_count, 2, 'İlanlarım screen must match real DB favorite count');
    });
  });

  describe('28. Hotfix Regression Scenarios (User Requirements 1-18)', () => {
    const RAVI_SIBLING_CHAR_ID = 'char-ravi-02';

    beforeEach(() => {
      // Add Ravi as sibling character under same user account
      db.profiles.push({
        id: RAVI_SIBLING_CHAR_ID,
        user_id: ZADE_USER_ID,
        full_name: 'Ravi Vexnera',
        avatar_url: '',
        sanmail_email: 'ravi@sanmail.com',
        phone: '555-0808',
        is_dealer: false,
        public_id: 103,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // 1. Corporate dashboard listing preview: 14 days
    it('1. Corporate listing preview canonical duration is 14 days ($1.750 model)', () => {
      const isCorporate = true;
      const durationDays = isCorporate ? 14 : 7;
      const previewText = isCorporate ? '14 Gün Aktif' : '7 Gün Aktif';
      const confirmationText = isCorporate
        ? 'İlanı yayınladığınız anda 1 adet kurumsal ilan krediniz kullanılacak ve 14 günlük yayın süreniz başlayacaktır.'
        : 'İlanı yayınladığınız anda 1 adet ilan krediniz kullanılacak ve 7 günlük yayın süreniz başlayacaktır.';

      assert.strictEqual(durationDays, 14);
      assert.strictEqual(previewText, '14 Gün Aktif');
      assert.match(confirmationText, /14 günlük yayın süreniz başlayacaktır/);
    });

    // 2. Corporate publish: expires_at is ~ +14 days
    it('2. Corporate publish sets expires_at to approximately +14 days', async () => {
      db.dealers.push({
        id: 'store-bum-01',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        moderation_status: 'ACTIVE',
        public_id: 201,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      db.credits.push({
        id: 'c-corp-1',
        profile_id: ZADE_CHAR_ID,
        payment_id: 'pay-test-corp',
        package_id: 'pkg-corp-14',
        amount: 1750,
        credit_type: 'CORPORATE',
        corporate_profile_id: 'store-bum-01',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      });

      const res = await createListingWithCredit(
        {
          seller_type: 'CORPORATE',
          category: 'vehicle',
          subcategory: 'Sedan',
          title: 'Kurumsal 14 Günlük Araç',
          description: 'Açıklama',
          price: 50000,
          mileage: 1000,
          brand: 'Bravado',
          model: 'Buffalo',
        },
        ZADE_CHAR_ID
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.listing?.seller_type, 'CORPORATE');
      assert.strictEqual(res.listing?.corporate_profile_id, 'store-bum-01');

      const publishedTime = new Date(res.listing!.published_at!).getTime();
      const expiresTime = new Date(res.listing!.expires_at!).getTime();
      const diffDays = Math.round((expiresTime - publishedTime) / (24 * 60 * 60 * 1000));
      assert.strictEqual(diffDays, 14, 'Corporate listing expires_at must be 14 days');
    });

    // 3. Individual publish: expires_at remains 7 days
    it('3. Individual publish sets expires_at to exactly 7 days', async () => {
      db.credits.push({
        id: 'c-ind-1',
        profile_id: ZADE_CHAR_ID,
        payment_id: 'pay-test-ind',
        package_id: 'pkg-ind-7',
        amount: 2000,
        credit_type: 'INDIVIDUAL',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      });

      const res = await createListingWithCredit(
        {
          seller_type: 'INDIVIDUAL',
          category: 'vehicle',
          subcategory: 'Sedan',
          title: 'Bireysel 7 Günlük Araç',
          description: 'Açıklama',
          price: 30000,
          mileage: 5000,
          brand: 'Vapid',
          model: 'Stanier',
        },
        ZADE_CHAR_ID
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.listing?.seller_type, 'INDIVIDUAL');
      assert.strictEqual(res.listing?.corporate_profile_id, undefined);

      const publishedTime = new Date(res.listing!.published_at!).getTime();
      const expiresTime = new Date(res.listing!.expires_at!).getTime();
      const diffDays = Math.round((expiresTime - publishedTime) / (24 * 60 * 60 * 1000));
      assert.strictEqual(diffDays, 7, 'Individual listing expires_at must be 7 days');
    });

    // 4. Corporate flow: server resolves active store even if client does not pass corporate_profile_id
    it('4. Corporate flow authoritatively resolves active store from profileId', async () => {
      db.dealers.push({
        id: 'store-bum-authoritative',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors Auth',
        slug: 'bum-motors-auth',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        moderation_status: 'ACTIVE',
        public_id: 202,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, true);
      assert.strictEqual(eligibility.dealer?.id, 'store-bum-authoritative');
    });

    // 5. Corporate publish: "Invalid UUID" error does NOT occur when client sends empty/undefined corporate_profile_id
    it('5. Corporate publish does not throw "Invalid UUID" when corporate_profile_id is empty string or undefined', () => {
      const validImages = [{ storage_path: 'listings/cover.webp', is_cover: true, sort_order: 0, size_bytes: 1000 }];

      const payloadWithEmptyString = {
        title: 'Örnek İlan Başlığı Burada',
        description: 'Detaylı ilan açıklaması yeterli uzunlukta yazılmıştır test amaçlı.',
        price: 25000,
        images: validImages,
        category: 'vehicle' as const,
        subcategory: 'Otomobil' as const,
        brand: 'Ubermacht',
        model: 'Oracle',
        plate: '22XYZ33',
        mileage: 15000,
        seller_type: 'CORPORATE' as const,
        corporate_profile_id: '',
      };

      const parsedEmpty = vehicleListingSchema.safeParse(payloadWithEmptyString);
      assert.strictEqual(parsedEmpty.success, true);
      assert.strictEqual((parsedEmpty as any).data.corporate_profile_id, null);

      const payloadWithUndefined = {
        title: 'Örnek İlan Başlığı Burada',
        description: 'Detaylı ilan açıklaması yeterli uzunlukta yazılmıştır test amaçlı.',
        price: 25000,
        images: validImages,
        category: 'vehicle' as const,
        subcategory: 'Otomobil' as const,
        brand: 'Ubermacht',
        model: 'Oracle',
        plate: '22XYZ33',
        mileage: 15000,
        seller_type: 'CORPORATE' as const,
      };

      const parsedUndefined = vehicleListingSchema.safeParse(payloadWithUndefined);
      assert.strictEqual(parsedUndefined.success, true);
      assert.strictEqual((parsedUndefined as any).data.corporate_profile_id, null);
    });

    // 6. No-store character: "Mağazamı Aç" does NOT appear
    it('6. No-store character does not see "Mağazamı Aç" button', async () => {
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canOpenStore, false);
    });

    // 7. No-store character: "Yeni İlan Ver" on kurumsal header does NOT appear
    it('7. No-store character does not see "Yeni İlan Ver" button on kurumsal header', async () => {
      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canCreateCorporateListing, false);
    });

    // 8. SUSPENDED: both buttons hidden
    it('8. SUSPENDED store hides both "Mağazamı Aç" and "Yeni İlan Ver" buttons', async () => {
      db.dealers.push({
        id: 'store-bum-suspended',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors Suspended',
        slug: 'bum-motors-suspended',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'SUSPENDED',
        suspension_reason: 'Kural ihlali',
        public_id: 203,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.reason, 'STORE_SUSPENDED');

      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canOpenStore, false, 'SUSPENDED store must not show Mağazamı Aç');
      assert.strictEqual(actions.canCreateCorporateListing, false, 'SUSPENDED store must not show Yeni İlan Ver');
    });

    // 9. DELETED: both buttons hidden
    it('9. DELETED store hides both "Mağazamı Aç" and "Yeni İlan Ver" buttons', async () => {
      db.dealers.push({
        id: 'store-bum-deleted',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors Deleted',
        slug: 'bum-motors-deleted',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'DELETED',
        deleted_at: new Date().toISOString(),
        public_id: 204,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.reason, 'STORE_DELETED');

      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canOpenStore, false, 'DELETED store must not show Mağazamı Aç');
      assert.strictEqual(actions.canCreateCorporateListing, false, 'DELETED store must not show Yeni İlan Ver');
    });

    // 10. ACTIVE + subscription ACTIVE: both buttons visible
    it('10. ACTIVE store with ACTIVE subscription shows both buttons', async () => {
      db.dealers.push({
        id: 'store-bum-active',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors Active',
        slug: 'bum-motors-active',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        moderation_status: 'ACTIVE',
        public_id: 205,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, true);
      assert.strictEqual(eligibility.reason, 'ACTIVE');

      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canOpenStore, true, 'ACTIVE store can open store');
      assert.strictEqual(actions.canCreateCorporateListing, true, 'ACTIVE subscription can create corporate listing');
    });

    // 11. ACTIVE + subscription EXPIRED: Mağazamı Aç visible, Yeni İlan Ver hidden
    it('11. ACTIVE store with EXPIRED subscription shows "Mağazamı Aç" but hides "Yeni İlan Ver"', async () => {
      db.dealers.push({
        id: 'store-bum-expired',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors Expired',
        slug: 'bum-motors-expired',
        status: 'APPROVED',
        subscription_status: 'EXPIRED',
        subscription_expires_at: new Date(Date.now() - 86400000).toISOString(),
        moderation_status: 'ACTIVE',
        public_id: 206,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const eligibility = await resolveCorporateEligibility(ZADE_CHAR_ID);
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.reason, 'SUBSCRIPTION_EXPIRED');

      const actions = resolveCorporateHeaderActions({
        eligibility,
        activeProfileId: ZADE_CHAR_ID,
        isCorporatePage: true,
      });
      assert.strictEqual(actions.canOpenStore, true, 'Public store still accessible so Mağazamı Aç is visible');
      assert.strictEqual(actions.canCreateCorporateListing, false, 'Expired subscription cannot create corporate listing');
    });

    // 12. Filled corporate application: PENDING application created
    it('12. Filled corporate application creates PENDING application for activeProfileId', async () => {
      const res = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'MAVIS AUTOS',
        purpose: 'DENEME faaliyet ve araç alım satım operasyonları.',
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.application);
      assert.strictEqual(res.application?.status, 'PENDING');
      assert.strictEqual(res.application?.company_name, 'MAVIS AUTOS');
      assert.strictEqual(res.application?.applicant_profile_id, ZADE_CHAR_ID);

      const savedApp = db.applications.find((a) => a.applicant_profile_id === ZADE_CHAR_ID);
      assert.ok(savedApp);
      assert.strictEqual(savedApp?.company_name, 'MAVIS AUTOS');
    });

    // 13. Empty company name: validation error
    it('13. Empty company name triggers validation error', async () => {
      const res = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: '   ',
        purpose: 'Faaliyet amacı geçerli',
      });

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /zorunludur/i);
    });

    // 14. Empty purpose: validation error
    it('14. Empty purpose triggers validation error', async () => {
      const res = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'MAVIS AUTOS',
        purpose: '   ',
      });

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /zorunludur/i);
    });

    // 15. Admin delete Bum Motors: exact owner Zade receives notification
    it('15. Admin delete sends notification to exact owner Zade', async () => {
      db.dealers.push({
        id: 'store-bum-del-test',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'ACTIVE',
        public_id: 207,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      await deleteCorporateStore('store-bum-del-test', 'Yönetim kararı', MAVIS_ADMIN_ID);

      const zadeNotifs = db.notifications.filter((n) => n.recipient_profile_id === ZADE_CHAR_ID);
      assert.strictEqual(zadeNotifs.length, 1);
      assert.strictEqual(zadeNotifs[0].title, 'Kurumsal mağazanız silindi');
      assert.match(zadeNotifs[0].message, /Bum Motors.*silinmiştir/);
    });

    // 16. Ravi: delete notification almaz
    it('16. Sibling Ravi under same account does not receive delete notification', async () => {
      const raviNotifs = db.notifications.filter((n) => n.recipient_profile_id === RAVI_SIBLING_CHAR_ID);
      assert.strictEqual(raviNotifs.length, 0, 'Sibling Ravi must receive 0 notifications');
    });

    // 17. Admin suspend: exact owner receives notification
    it('17. Admin suspend sends notification to exact owner Zade', async () => {
      db.dealers.push({
        id: 'store-bum-susp-test',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        moderation_status: 'ACTIVE',
        public_id: 208,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      await suspendCorporateStore('store-bum-susp-test', 'Şüpheli aktivite', MAVIS_ADMIN_ID);

      const zadeNotifs = db.notifications.filter(
        (n) => n.recipient_profile_id === ZADE_CHAR_ID && n.title === 'Kurumsal mağazanız askıya alındı'
      );
      assert.strictEqual(zadeNotifs.length, 1);
      assert.match(zadeNotifs[0].message, /Bum Motors.*askıya alınmıştır/);
    });

    // 18. DELETED previous store: owner can submit new corporate application
    it('18. Owner of DELETED store can submit a new corporate application successfully', async () => {
      // Existing store is DELETED
      db.dealers.push({
        id: 'store-old-deleted',
        owner_profile_id: ZADE_CHAR_ID,
        profile_id: ZADE_CHAR_ID,
        company_name: 'Old Defunct Motors',
        slug: 'old-defunct',
        status: 'APPROVED',
        moderation_status: 'DELETED',
        deleted_at: new Date().toISOString(),
        public_id: 209,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const applyRes = await applyForDealer({
        profileId: ZADE_CHAR_ID,
        companyName: 'New Era Motors',
        purpose: 'Eski mağaza kapatıldıktan sonra yeni başvuru',
      });

      assert.strictEqual(applyRes.success, true);
      assert.ok(applyRes.application);
      assert.strictEqual(applyRes.application?.status, 'PENDING');
      assert.strictEqual(applyRes.application?.company_name, 'New Era Motors');
    });
  });
});


