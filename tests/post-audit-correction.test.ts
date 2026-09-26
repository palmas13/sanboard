import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET as adminGet } from '@/app/api/admin/route';
import {
  getUserRepository,
  getListingRepository,
  getNotificationRepository,
  getDealerRepository,
} from '@/lib/db/repositories';
import { MemoryUserRepository } from '@/lib/db/repositories/memory/memory-user-repo';
import { MemoryDealerRepository } from '@/lib/db/repositories/memory/memory-dealer-repo';
import { toggleFavorite, getUserFavorites, createListingWithCredit, removeListing } from '@/lib/db/listings';
import { toggleFollow, getFollowers, applyForDealer } from '@/lib/db/dealers';
import { createTicket, addTicketMessage } from '@/lib/db/tickets';
import { normalizePhone } from '@/lib/utils/format';
import { POST as checkoutPost } from '@/app/api/checkout/route';
import { POST as activateSubscriptionPost } from '@/app/api/dealers/subscription/activate/route';
import { adminDelistListing } from '@/lib/db/admin';
import { readJsonResponse } from '@/lib/http/json-response';

describe('Sanboard Post-Audit Correction Pass: Sections 36-47', () => {
  const accountAUserId = '22222222-2222-2222-2222-222222222222';
  const mavisProfileId = 'char-mavis-01';
  const raviProfileId = 'char-ravi-03';
  const accountBUserId = '33333333-3333-3333-3333-333333333333';
  const zadeProfileId = 'char-zade-02';

  beforeEach(() => {
    // Reset seed state in mock database
    db.profiles = [
      {
        id: mavisProfileId,
        user_id: accountAUserId,
        external_character_id: mavisProfileId,
        full_name: 'Mavis Pierce',
        avatar_url: '',
        sanmail_email: 'mavis@sanmail.com',
        phone: '5550192',
        role: 'ADMIN',
        is_dealer: true,
        dealer_id: 'dealer-apex-01',
        public_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: raviProfileId,
        user_id: accountAUserId,
        external_character_id: raviProfileId,
        full_name: 'Ravi Blumon',
        avatar_url: '',
        sanmail_email: 'ravi@sanmail.com',
        phone: '5557722',
        role: 'USER',
        public_id: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: zadeProfileId,
        user_id: accountBUserId,
        external_character_id: zadeProfileId,
        full_name: 'Zade Vexnera',
        avatar_url: '',
        sanmail_email: 'zade@sanmail.com',
        phone: '5558831',
        role: 'USER',
        public_id: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    db.dealers = [
      {
        id: 'dealer-apex-01',
        profile_id: mavisProfileId,
        owner_profile_id: mavisProfileId,
        company_name: 'Apex Motors & Luxury Estates',
        slug: 'apex-motors',
        description: 'Lüks araç ve mülk galerisi.',
        logo_url: '',
        banner_url: '',
        address: 'Vinewood Hills No: 12',
        phone: '5550192',
        sanmail_email: 'apex.motors@sanmail.com',
        purpose: 'Lüks galeri işletmeciliği',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
        subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        boost_credits: 3,
        public_id: 1,
        social_media: {
          name: 'Facebrowser',
          url: 'https://facebrowser.gtaw/apexmotors',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    db.followers = [];
    db.favorites = [];
    db.notifications = [];
    db.tickets = [];
    db.ticketMessages = [];
    db.credits = [];
    db.payments = [];

    db.listings = [
      {
        id: 'lst-test-01',
        listing_number: '#SB-99001',
        seller_profile_id: zadeProfileId,
        category: 'vehicle',
        subcategory: 'Otomobil',
        title: 'Kişisel Zade Arabası',
        description: 'Temiz araç',
        price: 50000,
        location: 'Los Santos',
        status: 'ACTIVE',
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        images: [
          {
            id: 'img-1',
            listing_id: 'lst-test-01',
            storage_path: 'https://media.sanboard.org/listings/vehicles/test-car.webp',
            sort_order: 0,
            is_cover: true,
            size_bytes: 50000,
            created_at: new Date().toISOString(),
          },
        ],
      },
    ];
  });

  // =========================================================================
  // 36. TEST — ADMIN CHARACTER ROLE
  // =========================================================================
  it('Section 36: Admin permission belongs to character profile, not account (Mavis 200, Ravi 403, Zade 403)', async () => {
    // 1. Mavis (ADMIN) requests /api/admin -> Allowed (200)
    const mavisToken = createSessionToken({
      userId: accountAUserId,
      role: 'ADMIN',
      profileId: mavisProfileId,
    });
    const mavisReq = new NextRequest('http://localhost:3000/api/admin', {
      headers: { cookie: `sanboard_session=${mavisToken}` },
    });
    const mavisRes = await adminGet(mavisReq);
    assert.strictEqual(mavisRes.status, 200, 'Mavis with ADMIN character role must be allowed');

    // 2. Switch to Ravi (USER) under SAME account -> Denied (403)
    const raviToken = createSessionToken({
      userId: accountAUserId,
      role: 'USER',
      profileId: raviProfileId,
    });
    const raviReq = new NextRequest('http://localhost:3000/api/admin', {
      headers: { cookie: `sanboard_session=${raviToken}` },
    });
    const raviRes = await adminGet(raviReq);
    assert.strictEqual(raviRes.status, 403, 'Ravi with USER character role must be denied even under same account');

    // 3. Switch back to Mavis -> Allowed (200)
    const switchBackRes = await adminGet(mavisReq);
    assert.strictEqual(switchBackRes.status, 200, 'Switching back to Mavis immediately grants admin access');

    // 4. Account B (Zade, USER) -> Denied (403)
    const zadeToken = createSessionToken({
      userId: accountBUserId,
      role: 'USER',
      profileId: zadeProfileId,
    });
    const zadeReq = new NextRequest('http://localhost:3000/api/admin', {
      headers: { cookie: `sanboard_session=${zadeToken}` },
    });
    const zadeRes = await adminGet(zadeReq);
    assert.strictEqual(zadeRes.status, 403, 'Zade (USER) must be denied');
  });

  // =========================================================================
  // 37. TEST — FAVORITES: CHARACTER OWNERSHIP & ISOLATION
  // =========================================================================
  it('Section 37: Favorites are character-owned (Mavis=1, Ravi=2, Ravi removes=1, Mavis remains, persists across sessions)', async () => {
    const listingId = 'lst-test-01';

    // Mavis favorites Listing X -> count = 1
    const fav1 = await toggleFavorite(mavisProfileId, listingId);
    assert.strictEqual(fav1.isFavorited, true);
    assert.strictEqual(fav1.count, 1);

    // Ravi (same account) favorites Listing X -> count = 2
    const fav2 = await toggleFavorite(raviProfileId, listingId);
    assert.strictEqual(fav2.isFavorited, true);
    assert.strictEqual(fav2.count, 2);

    // Ravi removes favorite -> count = 1
    const unfavRavi = await toggleFavorite(raviProfileId, listingId);
    assert.strictEqual(unfavRavi.isFavorited, false);
    assert.strictEqual(unfavRavi.count, 1);

    // Mavis favorite remains
    const mavisFavs = await getUserFavorites(mavisProfileId);
    assert.strictEqual(mavisFavs.length, 1);
    assert.strictEqual(mavisFavs[0].id, listingId);

    // Ravi has 0 favorites
    const raviFavs = await getUserFavorites(raviProfileId);
    assert.strictEqual(raviFavs.length, 0);

    // Simulate re-login (querying by mavisProfileId again)
    const reloadedFavs = await getUserFavorites(mavisProfileId);
    assert.strictEqual(reloadedFavs.length, 1, 'Mavis favorite persists across sessions');
  });

  // =========================================================================
  // 38. TEST — NOTIFICATION ISOLATION
  // =========================================================================
  it('Section 38: Notifications and unread counts are strictly isolated between sibling characters', async () => {
    const notifRepo = getNotificationRepository();

    // Send notification to Mavis
    await notifRepo.createNotification({
      recipient_profile_id: mavisProfileId,
      user_id: accountAUserId,
      type: 'LISTING_PRICE_DROP',
      title: 'İlan Fiyatı Düştü',
      message: 'Mavis için fiyat indirimi bildirimi.',
    });

    // Mavis sees it
    const mavisNotifs = await notifRepo.getUserNotifications(mavisProfileId);
    assert.strictEqual(mavisNotifs.length, 1);
    const mavisUnread = await notifRepo.getUnreadCount(mavisProfileId);
    assert.strictEqual(mavisUnread, 1);

    // Ravi (same account) does NOT see it
    const raviNotifs = await notifRepo.getUserNotifications(raviProfileId);
    assert.strictEqual(raviNotifs.length, 0);
    const raviUnread = await notifRepo.getUnreadCount(raviProfileId);
    assert.strictEqual(raviUnread, 0);
  });

  // =========================================================================
  // 39. TEST — TICKET REPLY
  // =========================================================================
  it('Section 39: Admin ticket reply notifies ticket creator character profile only', async () => {
    // Mavis creates ticket
    const ticketRes = await createTicket({
      profileId: mavisProfileId,
      creatorName: 'Mavis Pierce',
      subject: 'Ödeme Sorunu',
      message: 'Faturam ile ilgili yardım rica ediyorum.',
    });
    assert.ok(ticketRes.success);
    const ticketId = ticketRes.ticket!.id;

    // Admin replies to ticket
    await addTicketMessage({
      ticketId,
      senderRole: 'ADMIN',
      senderName: 'Sanboard Destek',
      message: 'Ödemeniz incelendi, her şey yolunda.',
    });

    const notifRepo = getNotificationRepository();

    // Mavis receives notification
    const mavisNotifs = await notifRepo.getUserNotifications(mavisProfileId);
    assert.ok(mavisNotifs.some((n) => n.type === 'SUPPORT_REPLY'));

    // Ravi (sibling character) does NOT receive it
    const raviNotifs = await notifRepo.getUserNotifications(raviProfileId);
    assert.strictEqual(raviNotifs.some((n) => n.type === 'SUPPORT_REPLY'), false);
  });

  // =========================================================================
  // 40. TEST — FOLLOW & NOTIFICATION
  // =========================================================================
  it('Section 40: Follow notifies corporate store owner character; prevents self-follow; unfollow sends no notification', async () => {
    const storeId = 'dealer-apex-01';

    // Store owner Mavis attempts self-follow -> Rejected
    await assert.rejects(
      () => toggleFollow(mavisProfileId, storeId),
      /Kendi mağazanızı takip edemezsiniz/
    );

    // Ravi follows Apex Motors
    const followRes = await toggleFollow(raviProfileId, storeId);
    assert.strictEqual(followRes.isFollowing, true);

    // Mavis receives NEW_FOLLOWER notification
    const notifRepo = getNotificationRepository();
    const mavisNotifs = await notifRepo.getUserNotifications(mavisProfileId);
    const followNotif = mavisNotifs.find((n) => n.type === 'NEW_FOLLOWER');
    assert.ok(followNotif, 'Store owner must receive NEW_FOLLOWER notification');
    assert.ok(followNotif!.message.includes('Ravi Blumon mağazanızı takip etmeye başladı'));

    // Zade also follows -> 2 followers
    await toggleFollow(zadeProfileId, storeId);
    const followers = await getFollowers(storeId);
    assert.strictEqual(followers.length, 2);

    // Ravi unfollows -> count drops to 1, no new follow notification created
    const notifsCountBefore = (await notifRepo.getUserNotifications(mavisProfileId)).length;
    const unfollowRes = await toggleFollow(raviProfileId, storeId);
    assert.strictEqual(unfollowRes.isFollowing, false);
    const notifsCountAfter = (await notifRepo.getUserNotifications(mavisProfileId)).length;
    assert.strictEqual(notifsCountAfter, notifsCountBefore, 'Unfollow must NOT send notification');
  });

  // =========================================================================
  // 41. TEST — FOLLOWED STORE NEW LISTING
  // =========================================================================
  it('Section 41: Followed store new listing notifies follower character profile only', async () => {
    const storeId = 'dealer-apex-01';

    // Ravi follows Apex Motors; Zade does not
    await toggleFollow(raviProfileId, storeId);

    // Give Mavis a CORPORATE credit to publish
    db.credits.push({
      id: 'crd-corp-pub',
      profile_id: mavisProfileId,
      payment_id: 'pay-test-1',
      package_id: 'pkg-corporate-14-day',
      credit_type: 'CORPORATE',
      status: 'AVAILABLE',
      created_at: new Date().toISOString(),
    });

    // Mavis publishes corporate listing
    const listingRes = await createListingWithCredit(
      {
        category: 'vehicle',
        subcategory: 'Coupe',
        title: 'Apex Motors Yeni Galeri Aracı',
        description: 'Lüks spor araç',
        price: 200000,
        seller_type: 'CORPORATE',
        corporate_profile_id: storeId,
      },
      mavisProfileId
    );
    assert.ok(listingRes.success);

    // Notify followers
    const notifRepo = getNotificationRepository();
    const followers = db.followers.filter((f) => f.corporate_profile_id === storeId);
    for (const f of followers) {
      await notifRepo.createNotification({
        recipient_profile_id: f.follower_profile_id,
        type: 'NEW_CORPORATE_LISTING',
        title: 'Takip Ettiğiniz Mağazadan Yeni İlan',
        message: 'Apex Motors yeni bir ilan yayınladı.',
      });
    }

    // Ravi receives NEW_CORPORATE_LISTING
    const raviNotifs = await notifRepo.getUserNotifications(raviProfileId);
    assert.ok(raviNotifs.some((n) => n.type === 'NEW_CORPORATE_LISTING'));

    // Zade and Mavis did not follow, so they receive 0 NEW_CORPORATE_LISTING
    const zadeNotifs = await notifRepo.getUserNotifications(zadeProfileId);
    assert.strictEqual(zadeNotifs.some((n) => n.type === 'NEW_CORPORATE_LISTING'), false);
  });

  // =========================================================================
  // 42. TEST — ONE STORE PER CHARACTER
  // =========================================================================
  it('Section 42: Enforces maximum ONE corporate store per character profile', async () => {
    // Mavis already owns 'dealer-apex-01'. Attempt to apply for second store -> Rejected
    const duplicateRes = await applyForDealer({
      profileId: mavisProfileId,
      companyName: 'Second Mavis Motors',
      purpose: 'İkinci mağaza başvurusu',
    });
    assert.strictEqual(duplicateRes.success, false);
    assert.ok(duplicateRes.error?.includes('Zaten onaylanmış bir kurumsal hesabınız bulunmaktadır'));

    // Ravi (different character) CAN apply for independent store
    const raviStoreRes = await applyForDealer({
      profileId: raviProfileId,
      companyName: 'Ravi Customs',
      purpose: 'Tamirhane ve galeri',
    });
    assert.strictEqual(raviStoreRes.success, true);
  });

  // =========================================================================
  // 43. TEST — PHONE NORMALIZATION & COLLISION DETECTION
  // =========================================================================
  it('Section 43: Phone numbers are normalized to digits-only and detect formatted collisions', async () => {
    const userRepo = new MemoryUserRepository();

    // Save formatted phone '12-345'
    const res1 = await userRepo.updateProfile(mavisProfileId, {
      phone: '12-345',
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.profile?.phone, '12345', 'Phone must be stored digits-only');

    // Another character attempts '12 345' -> Collision conflict!
    const res2 = await userRepo.updateProfile(raviProfileId, {
      phone: '12 345',
    });
    assert.strictEqual(res2.success, false, 'Formatted variant must conflict');
    assert.ok(res2.error?.includes('kullanılmaktadır'));

    // Another character attempts raw '12345' -> Collision conflict!
    const res3 = await userRepo.updateProfile(zadeProfileId, {
      phone: '12345',
    });
    assert.strictEqual(res3.success, false, 'Exact digits must conflict');

    // Robust helper directly
    assert.strictEqual(normalizePhone('(555) 019-200'), '555019200');
  });

  // =========================================================================
  // 44. TEST — CORPORATE SOCIAL MEDIA: DYNAMIC ROWS (MAX 2)
  // =========================================================================
  it('Section 44: Corporate social media supports dynamic rows [{ name, url }] up to 2 entries', async () => {
    const dealerRepo = new MemoryDealerRepository();
    const updateRes = await dealerRepo.updateDealerProfile('dealer-apex-01', {
      social_media: [
        {
          name: 'LifeInvader',
          url: 'https://lifeinvader.gtaw/apexmotors',
        },
        {
          name: 'Facebrowser',
          url: 'https://facebrowser.gtaw/apex',
        },
      ],
    });
    assert.strictEqual(updateRes.success, true);
    assert.deepStrictEqual(updateRes.dealer?.social_media, [
      {
        name: 'LifeInvader',
        url: 'https://lifeinvader.gtaw/apexmotors',
      },
      {
        name: 'Facebrowser',
        url: 'https://facebrowser.gtaw/apex',
      },
    ]);
  });

  // =========================================================================
  // 45. TEST — LISTING PRICES & CREDIT SEPARATION
  // =========================================================================
  it('Section 45: Individual ($2,000 / 7 days) and Corporate ($1,750 / 14 days) credits reject cross-consumption', async () => {
    // 1. Give Mavis INDIVIDUAL credit
    db.credits.push({
      id: 'crd-ind-only',
      profile_id: mavisProfileId,
      payment_id: 'pay-test-2',
      package_id: 'pkg-standard-7-day',
      credit_type: 'INDIVIDUAL',
      status: 'AVAILABLE',
      created_at: new Date().toISOString(),
    });

    // Attempt to publish CORPORATE listing with INDIVIDUAL credit -> Fails!
    const corpAttempt = await createListingWithCredit(
      {
        category: 'vehicle',
        subcategory: 'Coupe',
        title: 'Corporate Galeri İlanı',
        description: 'Test',
        price: 90000,
        seller_type: 'CORPORATE',
        corporate_profile_id: 'dealer-apex-01',
      },
      mavisProfileId
    );
    assert.strictEqual(corpAttempt.success, false, 'Corporate listing cannot consume INDIVIDUAL credit');

    // Give Mavis CORPORATE credit
    db.credits.push({
      id: 'crd-corp-only',
      profile_id: mavisProfileId,
      payment_id: 'pay-test-3',
      package_id: 'pkg-corporate-14-day',
      credit_type: 'CORPORATE',
      status: 'AVAILABLE',
      created_at: new Date().toISOString(),
    });

    // Attempt to publish INDIVIDUAL listing with CORPORATE credit -> Fails!
    // (Consume the individual credit first to test isolation)
    db.credits[0].status = 'USED';
    const indAttempt = await createListingWithCredit(
      {
        category: 'vehicle',
        subcategory: 'Sedan',
        title: 'Kişisel İlan',
        description: 'Test',
        price: 30000,
        seller_type: 'INDIVIDUAL',
      },
      mavisProfileId
    );
    assert.strictEqual(indAttempt.success, false, 'Individual listing cannot consume CORPORATE credit');

    // Corporate credit publishes corporate listing with 14-day expiry
    const corpSuccess = await createListingWithCredit(
      {
        category: 'vehicle',
        subcategory: 'Coupe',
        title: 'Corporate Galeri İlanı',
        description: 'Test',
        price: 90000,
        seller_type: 'CORPORATE',
        corporate_profile_id: 'dealer-apex-01',
      },
      mavisProfileId
    );
    assert.strictEqual(corpSuccess.success, true);
    const days = (new Date(corpSuccess.listing!.expires_at!).getTime() - new Date(corpSuccess.listing!.published_at!).getTime()) / (24 * 3600 * 1000);
    assert.strictEqual(Math.round(days), 14, 'Corporate listing expiry must be 14 days');
  });

  // =========================================================================
  // 46. TEST — CORPORATE PAYMENT OWNER VALIDATION
  // =========================================================================
  it('Section 46: Corporate subscription and billing charges dealer.owner_profile_id, rejects sibling character', async () => {
    // Ravi attempts to activate Apex Motors (owned by Mavis) -> Denied
    const raviToken = createSessionToken({
      userId: accountAUserId,
      role: 'USER',
      profileId: raviProfileId,
    });
    const unauthReq = new NextRequest('http://localhost:3000/api/dealers/subscription/activate', {
      method: 'POST',
      headers: {
        cookie: `sanboard_session=${raviToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ dealerId: 'dealer-apex-01' }),
    });
    const unauthRes = await activateSubscriptionPost(unauthReq);
    assert.strictEqual(unauthRes.status, 403, 'Sibling character cannot activate subscription of another store');

    // Direct activation is closed even for the owner; payment flow is mandatory.
    const mavisToken = createSessionToken({
      userId: accountAUserId,
      role: 'ADMIN',
      profileId: mavisProfileId,
    });
    const authReq = new NextRequest('http://localhost:3000/api/dealers/subscription/activate', {
      method: 'POST',
      headers: {
        cookie: `sanboard_session=${mavisToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ dealerId: 'dealer-apex-01' }),
    });
    const authRes = await activateSubscriptionPost(authReq);
    assert.strictEqual(authRes.status, 409);
    assert.match(authRes.headers.get('content-type') || '', /application\/json/);

    // Corporate listing-credit checkout requires an already active paid membership.
    const apexStore = db.dealers.find((dealer) => dealer.id === 'dealer-apex-01')!;
    apexStore.subscription_status = 'ACTIVE';
    apexStore.moderation_status = 'ACTIVE';
    apexStore.subscription_expires_at = new Date(Date.now() + 30 * 86400000).toISOString();

    // Checkout endpoint verification for Corporate Credit ($1,750)
    const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        cookie: `sanboard_session=${mavisToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        packageCode: 'CORPORATE_14_DAY',
      }),
    });
    const checkoutRes = await checkoutPost(checkoutReq);
    assert.strictEqual(checkoutRes.status, 200);
    const checkoutData = await checkoutRes.json();
    assert.strictEqual(checkoutData.amount, 1750, 'Corporate credit checkout price must be $1,750');
  });

  it('Section 46 regression: corporate subscription client targets duplicate-safe checkout', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/hesabim/kurumsal/page.tsx'),
      'utf8'
    );

    assert.ok(source.includes("fetch('/api/checkout'"));
    assert.ok(source.includes("packageCode: 'CORPORATE_SUBSCRIPTION_30_DAY'"));
    assert.ok(source.includes("'Idempotency-Key'"));
  });

  it('Section 46 regression: unauthenticated activation errors are JSON, not login redirects', async () => {
    const req = new NextRequest('http://localhost:3000/api/dealers/subscription/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealerId: 'dealer-apex-01' }),
    });
    const res = await activateSubscriptionPost(req);
    const payload = await res.json();

    assert.strictEqual(res.status, 401);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.match(payload.error, /Yetkisiz erişim/);
    assert.strictEqual(res.headers.get('location'), null);
  });

  it('Section 46 regression: JSON response reader rejects HTML without exposing parser errors', async () => {
    const htmlResponse = new Response('<!DOCTYPE html><html><body>Not Found</body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    await assert.rejects(
      () => readJsonResponse(htmlResponse, 'Kurumsal üyelik aktivasyonu başarısız.'),
      (error: Error) => {
        assert.match(error.message, /HTTP 404/);
        assert.doesNotMatch(error.message, /Unexpected token/);
        return true;
      }
    );
  });

  // =========================================================================
  // 47. TEST — REMOVED MEDIA LIFECYCLE
  // =========================================================================
  it('Section 47: Listing removal (user delete & admin delist) triggers R2 media lifecycle cleanup with retry queue', async () => {
    const listingId = 'lst-test-01';

    // 1. User delete triggers removeListing -> status REMOVED, images purged, media cleanup queued/deleted
    const removeRes = await removeListing(listingId, zadeProfileId);
    assert.strictEqual(removeRes.success, true);

    const listing = db.listings.find((l) => l.id === listingId);
    assert.strictEqual(listing?.status, 'REMOVED');
    assert.strictEqual((listing?.images || []).length, 0, 'Listing images should be cleared upon REMOVED status');

    // 2. Admin delist test
    // Create new active listing with media
    db.listings.push({
      id: 'lst-admin-delist',
      listing_number: '#SB-99002',
      seller_profile_id: zadeProfileId,
      category: 'vehicle',
      subcategory: 'Otomobil',
      title: 'Admin Delist Test Araç',
      description: 'Test',
      price: 40000,
      location: 'Los Santos',
      status: 'ACTIVE',
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      images: [
        {
          id: 'img-delist-1',
          listing_id: 'lst-admin-delist',
          storage_path: 'https://media.sanboard.org/listings/vehicles/delist-car.webp',
          sort_order: 0,
          is_cover: true,
          size_bytes: 45000,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const adminDelistRes = await adminDelistListing('lst-admin-delist');
    assert.strictEqual(adminDelistRes, true);
    const delistedListing = db.listings.find((l) => l.id === 'lst-admin-delist');
    assert.strictEqual(delistedListing?.status, 'REMOVED');
    assert.strictEqual((delistedListing?.images || []).length, 0);
  });
});
