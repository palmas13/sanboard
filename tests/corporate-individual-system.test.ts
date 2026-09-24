import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/lib/db/store';
import { MemoryUserRepository } from '../src/lib/db/repositories/memory/memory-user-repo';
import {
  reviewApplication,
  activateSubscription,
  boostListing,
  toggleFollow,
  getFollowers,
  isFollowing,
} from '../src/lib/db/dealers';
import { getPublicListings, createListingWithCredit, getUserListings, getCorporateListings } from '../src/lib/db/listings';

describe('Sanboard – Individual vs Corporate System & Lifecycle', () => {
  beforeEach(() => {
    // Reset seed state in memory
    db.profiles = [
      {
        id: 'char-mavis-01',
        user_id: 'usr-mavis-account',
        full_name: 'Mavis Pierce',
        avatar_url: '',
        sanmail_email: 'mavis@sanmail.com',
        phone: '555-0101',
        is_dealer: true,
        dealer_id: 'dealer-apex-01',
        public_id: 12,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'char-mavis-alt',
        user_id: 'usr-mavis-account',
        full_name: 'Mavis SecondChar',
        avatar_url: '',
        sanmail_email: 'mavis2@sanmail.com',
        phone: '555-0102',
        is_dealer: false,
        public_id: 13,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'char-john-01',
        user_id: 'usr-john-account',
        full_name: 'John Doe',
        avatar_url: '',
        sanmail_email: 'john@sanmail.com',
        phone: '555-0202',
        is_dealer: false,
        public_id: 14,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    db.dealers = [
      {
        id: 'dealer-apex-01',
        profile_id: 'char-mavis-01',
        owner_profile_id: 'char-mavis-01',
        company_name: 'Apex Motors',
        slug: 'apex-motors',
        description: 'Lüks galeri',
        logo_url: '',
        banner_url: '',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        boost_credits: 3,
        public_id: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    db.applications = [];
    db.followers = [];
    db.credits = [
      {
        id: 'cred-1',
        profile_id: 'char-mavis-01',
        package_id: 'pkg-1',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      } as any,
      {
        id: 'cred-2',
        profile_id: 'char-mavis-01',
        package_id: 'pkg-2',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      } as any,
    ];

    db.listings = [];
    db.favorites = [];
    db.notifications = [];
  });

  describe('1. SanMail & Phone Uniqueness (Case-Insensitive)', () => {
    const userRepo = new MemoryUserRepository();

    it('rejects duplicate phone number across different characters', async () => {
      const res = await userRepo.updateProfile('char-john-01', {
        phone: '555-0101', // Already belongs to Mavis
      });

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /telefon numarası/i);
    });

    it('rejects duplicate SanMail case-insensitively', async () => {
      const res = await userRepo.updateProfile('char-john-01', {
        sanmail_email: 'MAVIS@SANMAIL.COM', // Uppercase version of mavis@sanmail.com
      });

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /sanmail adresi/i);
    });

    it('allows character to keep or re-save its own SanMail & phone', async () => {
      const res = await userRepo.updateProfile('char-mavis-01', {
        sanmail_email: 'mavis@sanmail.com',
        phone: '555-0101',
      });

      assert.strictEqual(res.success, true);
    });
  });

  describe('2. Individual vs Corporate Listing Separation & Expirations', () => {
    it('sets 7 days expiration for INDIVIDUAL and 14 days for CORPORATE', async () => {
      // Create Individual listing
      const resInd = await createListingWithCredit(
        {
          category: 'vehicle',
          subcategory: 'Sedan',
          title: 'Mavis Kendi Kişisel Arabası',
          description: 'Kişisel aracım',
          price: 25000,
          seller_type: 'INDIVIDUAL',
        },
        'char-mavis-01'
      );
      assert.strictEqual(resInd.success, true);
      assert.ok(resInd.listing);
      assert.ok(resInd.listing.expires_at);

      const indDays =
        (new Date(resInd.listing.expires_at!).getTime() - new Date(resInd.listing.published_at!).getTime()) /
        (24 * 3600 * 1000);
      assert.strictEqual(Math.round(indDays), 7);
      assert.strictEqual(resInd.listing.seller_type, 'INDIVIDUAL');
      assert.strictEqual(resInd.listing.corporate_profile_id, undefined);

      // Create Corporate listing
      const resCorp = await createListingWithCredit(
        {
          category: 'vehicle',
          subcategory: 'Coupe',
          title: 'Apex Motors Galeri Stoğu',
          description: 'Galeri aracı',
          price: 150000,
          seller_type: 'CORPORATE',
          corporate_profile_id: 'dealer-apex-01',
        },
        'char-mavis-01'
      );
      assert.strictEqual(resCorp.success, true);
      assert.ok(resCorp.listing);
      assert.ok(resCorp.listing.expires_at);

      const corpDays =
        (new Date(resCorp.listing.expires_at!).getTime() - new Date(resCorp.listing.published_at!).getTime()) /
        (24 * 3600 * 1000);
      assert.strictEqual(Math.round(corpDays), 14);
      assert.strictEqual(resCorp.listing.seller_type, 'CORPORATE');
      assert.strictEqual(resCorp.listing.corporate_profile_id, 'dealer-apex-01');

      // Verify separation:
      // Individual profile listing query should ONLY return individual listing
      const userListings = await getUserListings('char-mavis-01');
      assert.strictEqual(userListings.length, 1);
      assert.strictEqual(userListings[0].title, 'Mavis Kendi Kişisel Arabası');

      // Corporate store listing query should ONLY return corporate listing
      const corpListings = await getCorporateListings('dealer-apex-01');
      assert.strictEqual(corpListings.length, 1);
      assert.strictEqual(corpListings[0].title, 'Apex Motors Galeri Stoğu');
    });
  });

  describe('3. Corporate Application Review, Rejection Reason & History', () => {
    it('saves rejection reason, keeps history, and sends notification to character user', async () => {
      // 1. Submit application #1
      const app1: any = {
        id: 'app-test-01',
        applicant_profile_id: 'char-john-01',
        company_name: 'John Motors',
        purpose: 'Araç alım satım',
        status: 'PENDING' as const,
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
      };
      db.applications.push(app1);

      // 2. Reject application #1 with specific reason
      const reviewRes = await reviewApplication(
        'app-test-01',
        'REJECTED',
        'Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.',
        'admin-01'
      );
      assert.strictEqual(reviewRes.success, true);
      assert.strictEqual(app1.status, 'REJECTED');
      assert.strictEqual(app1.rejection_reason, 'Fiziksel işletme bilgileri doğrulanamadığı için başvurunuz reddedildi.');

      // Check notification sent to John's account
      const notifs = db.notifications.filter((n) => n.user_id === 'usr-john-account');
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].type, 'CORPORATE_APPLICATION_REJECTED');
      assert.match(notifs[0].message, /Fiziksel işletme bilgileri/);

      // 3. User can reapply without overwriting old application #1
      const app2: any = {
        id: 'app-test-02',
        applicant_profile_id: 'char-john-01',
        company_name: 'John Motors LLC',
        purpose: 'Yenilenmiş vergi ve ruhsat belgeleriyle araç ticareti',
        status: 'PENDING' as const,
        created_at: new Date('2026-09-02T10:00:00Z').toISOString(),
      };
      db.applications.push(app2);

      // Both applications exist in history
      assert.strictEqual(db.applications.length, 2);
      assert.strictEqual(db.applications[0].status, 'REJECTED');
      assert.strictEqual(db.applications[1].status, 'PENDING');
    });
  });

  describe('4. Corporate Subscription & Fleeca Activation', () => {
    it('sets subscription to ACTIVE and grants 3 boost credits upon activation', async () => {
      // Simulate approved store with INACTIVE subscription
      const store = db.dealers[0];
      store.subscription_status = 'INACTIVE';
      store.boost_credits = 0;

      const actRes = await activateSubscription(store.id);
      assert.strictEqual(actRes.success, true);
      assert.strictEqual(store.subscription_status, 'ACTIVE');
      assert.strictEqual(store.boost_credits, 3);
      assert.ok(store.subscription_expires_at);

      const daysRemaining =
        (new Date(store.subscription_expires_at).getTime() - Date.now()) / (24 * 3600 * 1000);
      assert.ok(daysRemaining > 29 && daysRemaining <= 31);
    });
  });

  describe('5. Boost (Öne Çıkarma) & Sorting Order', () => {
    it('consumes 1 credit, sets 24h boost, and sorts featured listing before normal listings', async () => {
      const store = db.dealers[0];
      store.subscription_status = 'ACTIVE';
      store.boost_credits = 3;

      // Normal listing (created first)
      const normalListing: any = {
        id: 'lst-normal',
        listing_number: '#SB-100001',
        seller_profile_id: 'char-mavis-01',
        description: 'Test',
        category: 'vehicle' as const,
        subcategory: 'Sedan',
        title: 'Normal İlan - Sultan RS',
        price: 80000,
        status: 'ACTIVE' as const,
        published_at: new Date(Date.now() - 3600000).toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      };
      db.listings.push(normalListing);

      // Corporate listing to be boosted
      const corpListing: any = {
        id: 'lst-boosted',
        listing_number: '#SB-100002',
        seller_profile_id: 'char-mavis-01',
        description: 'Test',
        category: 'vehicle' as const,
        subcategory: 'Coupe',
        title: 'Apex Motors – Dinka Jester (Boosted)',
        price: 120000,
        status: 'ACTIVE' as const,
        seller_type: 'CORPORATE' as const,
        corporate_profile_id: store.id,
        published_at: new Date(Date.now() - 7200000).toISOString(), // Published earlier
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      };
      db.listings.push(corpListing);

      // Boost the corporate listing
      const boostRes = await boostListing(store.id, 'lst-boosted');
      assert.strictEqual(boostRes.success, true);
      assert.strictEqual(store.boost_credits, 2);
      assert.strictEqual(corpListing.is_featured, true);
      assert.ok(corpListing.featured_until);

      // Cannot boost same listing again while active
      const repeatBoost = await boostListing(store.id, 'lst-boosted');
      assert.strictEqual(repeatBoost.success, false);
      assert.match(repeatBoost.error || '', /zaten aktif olarak öne çıkarılmış/);

      // Query public listings: Boosted listing must be FIRST despite older published_at
      const publicListings = await getPublicListings({ category: 'vehicle' });
      assert.strictEqual(publicListings[0].id, 'lst-boosted');
      assert.strictEqual(publicListings[0].is_featured, true);
      assert.strictEqual(publicListings[1].id, 'lst-normal');
      assert.strictEqual(Boolean(publicListings[1].is_featured), false);
    });
  });

  describe('6. Character-Level Follower System', () => {
    it('tracks followers at character level and supports multiple characters under one account', async () => {
      const storeId = 'dealer-apex-01';

      // Character 1 follows store
      const follow1 = await toggleFollow('char-mavis-01', storeId);
      assert.strictEqual(follow1.isFollowing, true);
      assert.strictEqual(follow1.count, 1);

      // Character 2 (alt character under same account) follows store
      const follow2 = await toggleFollow('char-mavis-alt', storeId);
      assert.strictEqual(follow2.isFollowing, true);
      assert.strictEqual(follow2.count, 2); // 2 distinct followers!

      const followersList = await getFollowers(storeId);
      assert.strictEqual(followersList.length, 2);
      assert.strictEqual(followersList[0].full_name, 'Mavis Pierce');
      assert.strictEqual(followersList[1].full_name, 'Mavis SecondChar');

      // Character 1 unfollows
      const unfollow1 = await toggleFollow('char-mavis-01', storeId);
      assert.strictEqual(unfollow1.isFollowing, false);
      assert.strictEqual(unfollow1.count, 1);

      const isChar2StillFollowing = await isFollowing('char-mavis-alt', storeId);
      assert.strictEqual(isChar2StillFollowing, true);
    });
  });
});
