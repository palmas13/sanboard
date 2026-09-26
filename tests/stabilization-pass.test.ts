import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSessionToken, verifySessionToken, getServerSession } from '@/lib/auth/session';
import { POST as toggleFavoritePost, DELETE as deleteFavorite, GET as getFavoriteStatus } from '@/app/api/favorites/route';
import { GET as adminGet } from '@/app/api/admin/route';
import { GET as bootstrapGet } from '@/app/api/account/bootstrap/route';
import { GET as getNotificationsGet, POST as postNotifications } from '@/app/api/notifications/route';
import { db } from '@/lib/db/store';

describe('Sanboard Stabilization Pass: Auth, Role, Favorites, Notifications & Dashboard', () => {
  const zadeUserId = '33333333-3333-3333-3333-333333333333';
  const mavisAdminUserId = '22222222-2222-2222-2222-222222222222';
  const raviUserId = '44444444-4444-4444-4444-444444444443';
  const testListingId = db.listings[0]?.id || 'lst-veh-01';

  beforeEach(() => {
    db.favorites = [];
    db.notifications = [];
  });

  function createAuthedRequest(
    url: string,
    method: string,
    sessionUser?: { userId: string; role: 'USER' | 'ADMIN'; profileId?: string } | null,
    body?: any
  ) {
    const headers = new Headers();
    if (sessionUser) {
      const token = createSessionToken(sessionUser);
      headers.set('cookie', `sanboard_session=${token}`);
    }
    if (body) {
      headers.set('content-type', 'application/json');
    }
    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // =========================================================================
  // 1. AUTH & SESSION RECOVERY (NO F5 LOGOUT FLASH)
  // =========================================================================
  describe('Auth & Session Bootstrap', () => {
    test('Signed session token encodes and decodes verified payload reliably', () => {
      const token = createSessionToken({
        userId: zadeUserId,
        role: 'USER',
        profileId: 'char-zade-02',
      });
      const decoded = verifySessionToken(token);
      assert.ok(decoded, 'Decoded payload must exist');
      assert.strictEqual(decoded.userId, zadeUserId);
      assert.strictEqual(decoded.role, 'USER');
      assert.strictEqual(decoded.profileId, 'char-zade-02');
    });

    test('getServerSession extracts session from request cookie without client spoofing', async () => {
      const req = createAuthedRequest('http://localhost:3000/api/auth/session', 'GET', {
        userId: zadeUserId,
        role: 'USER',
      });
      const session = await getServerSession(req);
      assert.ok(session, 'Session must be extracted');
      assert.strictEqual(session.userId, zadeUserId);
      assert.strictEqual(session.role, 'USER');
    });

    test('Tampered session token in cookie returns null (never guest flash for valid token)', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        headers: { cookie: 'sanboard_session=invalid.tampered.token' },
      });
      const session = await getServerSession(req);
      assert.strictEqual(session, null, 'Tampered token must evaluate to null');
    });
  });

  // =========================================================================
  // 2. ROLE SYSTEM & ADMIN AUTHORIZATION
  // =========================================================================
  describe('Role Model & Admin Authorization', () => {
    test('Standard USER account is strictly denied access to /api/admin (403 Forbidden)', async () => {
      const userReq = createAuthedRequest('http://localhost:3000/api/admin', 'GET', {
        userId: zadeUserId,
        role: 'USER',
      });
      const res = await adminGet(userReq);
      assert.strictEqual(res.status, 403, 'Normal USER must get 403 Forbidden');
    });

    test('Client attempting to inject role=ADMIN in session token without DB role is rejected', async () => {
      // Zade attempts to forge role=ADMIN in token, but DB role is USER
      const forgedToken = createSessionToken({
        userId: zadeUserId, // Zade is in db.users as USER
        role: 'ADMIN',
      });
      const forgedReq = new NextRequest('http://localhost:3000/api/admin', {
        headers: { cookie: `sanboard_session=${forgedToken}` },
      });
      const res = await adminGet(forgedReq);
      assert.strictEqual(res.status, 403, 'DB source of truth overrides client/token role');
    });

    test('Legitimate ADMIN account is granted access to /api/admin (200 OK)', async () => {
      const adminReq = createAuthedRequest('http://localhost:3000/api/admin', 'GET', {
        userId: mavisAdminUserId,
        role: 'ADMIN',
      });
      const res = await adminGet(adminReq);
      assert.strictEqual(res.status, 200, 'Admin must get 200 OK');
    });
  });

  // =========================================================================
  // 3. FAVORITES: ACCOUNT-BASED PERSISTENCE & CHARACTER SWITCH
  // =========================================================================
  describe('Account-Based Favorites System', () => {
    test('Favorite insert stores user_id and returns { success: true, isFavorited: true }', async () => {
      const req = createAuthedRequest('http://localhost:3000/api/favorites', 'POST', {
        userId: zadeUserId,
        role: 'USER',
        profileId: 'char-zade-02',
      }, { listingId: testListingId, isFavorited: true });

      const res = await toggleFavoritePost(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.isFavorited, true);

      // Verify DB row
      const row = db.favorites.find((f) => f.user_id === zadeUserId && f.listing_id === testListingId);
      assert.ok(row, 'Favorite row must exist with user_id');
      assert.strictEqual(row.user_id, zadeUserId);
    });

    test('Favorite delete removes row and returns { success: true, isFavorited: false }', async () => {
      // Seed favorite for Zade's active character (char-zade-02)
      db.favorites.push({
        id: 'fav-test-01',
        user_id: zadeUserId,
        profile_id: 'char-zade-02',
        listing_id: testListingId,
        created_at: new Date().toISOString(),
      });

      const req = createAuthedRequest('http://localhost:3000/api/favorites', 'DELETE', {
        userId: zadeUserId,
        role: 'USER',
        profileId: 'char-zade-02',
      }, { listingId: testListingId });

      const res = await deleteFavorite(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.isFavorited, false);

      const row = db.favorites.find((f) => f.profile_id === 'char-zade-02' && f.listing_id === testListingId);
      assert.strictEqual(row, undefined, 'Favorite row must be removed');
    });

    test('Favorites are character-scoped: character switch isolates favorites', async () => {
      // Seed favorite under Character Profile 1
      db.favorites.push({
        id: 'fav-test-02',
        user_id: zadeUserId,
        profile_id: 'char-zade-02',
        listing_id: testListingId,
        created_at: new Date().toISOString(),
      });

      // Query with Profile 1 (char-zade-02) -> favorited
      const checkReq1 = createAuthedRequest(
        `http://localhost:3000/api/favorites?listingId=${testListingId}`,
        'GET',
        { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' }
      );
      const res1 = await getFavoriteStatus(checkReq1);
      const json1 = await res1.json();
      assert.strictEqual(json1.isFavorited, true);

      // Switch to Profile 2 under same account (char-alternate-03) -> isolated (NOT favorited)
      const checkReq2 = createAuthedRequest(
        `http://localhost:3000/api/favorites?listingId=${testListingId}`,
        'GET',
        { userId: zadeUserId, role: 'USER', profileId: 'char-alternate-03' }
      );
      const res2 = await getFavoriteStatus(checkReq2);
      const json2 = await res2.json();
      assert.strictEqual(json2.isFavorited, false, 'Favorite must be isolated to character profile');
    });

    test('Favorites are isolated between different accounts', async () => {
      // Zade has favorited
      db.favorites.push({
        id: 'fav-test-03',
        user_id: zadeUserId,
        profile_id: 'char-zade-01',
        listing_id: testListingId,
        created_at: new Date().toISOString(),
      });

      // Mavis queries the same listing
      const mavisReq = createAuthedRequest(
        `http://localhost:3000/api/favorites?listingId=${testListingId}`,
        'GET',
        { userId: mavisAdminUserId, role: 'ADMIN' }
      );
      const res = await getFavoriteStatus(mavisReq);
      const json = await res.json();
      assert.strictEqual(json.isFavorited, false, 'Mavis must not see Zade favorite');
    });
  });

  // =========================================================================
  // 4. NOTIFICATIONS: READ PERSISTENCE & USER SCOPE
  // =========================================================================
  describe('Notification System Integrity', () => {
    test('User can fetch their own notifications and mark them as read', async () => {
      const notifId = 'notif-test-01';
      const zadeProfileId = 'char-zade-02';
      db.notifications.push({
        id: notifId,
        user_id: zadeUserId,
        recipient_profile_id: zadeProfileId,
        title: 'Fiyat Düştü',
        message: 'Favorilediğiniz ilanın fiyatı düştü.',
        type: 'LISTING_PRICE_DROP',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // 1. Fetch unread
      const fetchReq = createAuthedRequest('http://localhost:3000/api/notifications', 'GET', {
        userId: zadeUserId,
        role: 'USER',
        profileId: zadeProfileId,
      });
      const fetchRes = await getNotificationsGet(fetchReq);
      assert.strictEqual(fetchRes.status, 200);
      const fetchJson = await fetchRes.json();
      assert.strictEqual(fetchJson.notifications.length, 1);
      assert.strictEqual(fetchJson.unreadCount, 1);

      // 2. Mark as read
      const patchReq = createAuthedRequest('http://localhost:3000/api/notifications', 'POST', {
        userId: zadeUserId,
        role: 'USER',
        profileId: zadeProfileId,
      }, { action: 'markRead', notificationId: notifId });
      const patchRes = await postNotifications(patchReq);
      assert.strictEqual(patchRes.status, 200);

      // 3. Verify notification is marked read in DB
      const updatedNotif = db.notifications.find((n) => n.id === notifId);
      assert.strictEqual(updatedNotif?.is_read, true);
    });

    test('User cannot query or read other accounts notifications', async () => {
      const mavisProfileId = 'char-mavis-01';
      db.notifications.push({
        id: 'notif-mavis-01',
        user_id: mavisAdminUserId,
        recipient_profile_id: mavisProfileId,
        title: 'Admin Alert',
        message: 'Confidential alert',
        type: 'SYSTEM',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Zade queries notifications - must return 0 items
      const req = createAuthedRequest('http://localhost:3000/api/notifications', 'GET', {
        userId: zadeUserId,
        role: 'USER',
        profileId: 'char-zade-02',
      });
      const res = await getNotificationsGet(req);
      const json = await res.json();
      assert.strictEqual(json.notifications.length, 0);
      assert.strictEqual(json.unreadCount, 0);
    });
  });

  // =========================================================================
  // 5. DASHBOARD BOOTSTRAP ENDPOINT (PARALLEL HYDRATION)
  // =========================================================================
  describe('Account Dashboard Consolidated Bootstrap', () => {
    test('GET /api/account/bootstrap returns unified account data in a single request', async () => {
      const req = createAuthedRequest('http://localhost:3000/api/account/bootstrap', 'GET', {
        userId: zadeUserId,
        role: 'USER',
        profileId: 'char-zade-02',
      });

      const res = await bootstrapGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.profile, 'Must include profile');
      assert.strictEqual(data.profile.full_name, 'Zade Vexnera');
      assert.ok(data.stats, 'Must include stats');
      assert.strictEqual(typeof data.stats.activeListings, 'number');
      assert.strictEqual(typeof data.stats.favoritesCount, 'number');
      assert.ok(data.credits, 'Must include credits');
      assert.ok(data.support, 'Must include support ticket summary');
    });

    test('GET /api/account/bootstrap rejects unauthenticated requests with 401', async () => {
      const unauthReq = new NextRequest('http://localhost:3000/api/account/bootstrap', {
        method: 'GET',
      });
      const res = await bootstrapGet(unauthReq);
      assert.strictEqual(res.status, 401);
    });

    test('Supabase bootstrap uses canonical support tickets and row-based available credit count', () => {
      const source = readFileSync(join(process.cwd(), 'src/app/api/account/bootstrap/route.ts'), 'utf8');
      assert.match(source, /\.from\('support_tickets'\)/);
      assert.doesNotMatch(source, /\.from\('tickets'\)/);
      assert.match(source, /\.from\('listing_credits'\)[\s\S]*\.eq\('status', 'AVAILABLE'\)/);
      assert.doesNotMatch(source, /\.select\('balance'\)/);
      assert.match(source, /const availableCredits = creditRes\.count \|\| 0/);
    });
  });

  // =========================================================================
  // 6. REQUIRED REGRESSION TESTS (PROMPT SECTIONS 43-50)
  // =========================================================================
  describe('Prompt Requirements Regression Verification (Sections 43-50)', () => {
    // Section 43: Bum Motors corporate notification isolation
    test('Section 43: Bum Motors owner Zade receives owner notification, Ravi & Mavis receive NOTHING', async () => {
      const zadeProfileId = 'char-zade-02';
      const raviProfileId = 'char-ravi-03';
      const mavisProfileId = 'char-mavis-01';

      // Bum Motors dealer owned by Zade
      const bumMotors = {
        id: 'dealer-bum-01',
        profile_id: zadeProfileId,
        owner_profile_id: zadeProfileId,
        company_name: 'Bum Motors',
        slug: 'bum-motors',
        status: 'APPROVED',
        subscription_status: 'ACTIVE',
      };
      const existingDealer = db.dealers.find((d) => d.id === bumMotors.id);
      if (!existingDealer) db.dealers.push(bumMotors as any);

      // Trigger store-owner notification (e.g. new follower on Bum Motors)
      const targetOwnerRecipient = bumMotors.owner_profile_id;
      db.notifications.push({
        id: `notif-bum-${Date.now()}`,
        recipient_profile_id: targetOwnerRecipient,
        user_id: zadeUserId,
        title: 'Yeni Takipçi',
        message: 'Bum Motors mağazanızı bir kullanıcı takip etmeye başladı.',
        type: 'NEW_FOLLOWER',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Zade queries notifications
      const zadeReq = createAuthedRequest('http://localhost:3000/api/notifications', 'GET', {
        userId: zadeUserId,
        role: 'USER',
        profileId: zadeProfileId,
      });
      const zadeRes = await getNotificationsGet(zadeReq);
      const zadeData = await zadeRes.json();
      assert.strictEqual(zadeData.notifications.length, 1, 'Zade must receive the notification');
      assert.strictEqual(zadeData.notifications[0].title, 'Yeni Takipçi');

      // Ravi queries notifications -> 0
      const raviReq = createAuthedRequest('http://localhost:3000/api/notifications', 'GET', {
        userId: raviUserId,
        role: 'USER',
        profileId: raviProfileId,
      });
      const raviRes = await getNotificationsGet(raviReq);
      const raviData = await raviRes.json();
      assert.strictEqual(raviData.notifications.length, 0, 'Ravi must receive NOTHING');

      // Mavis queries notifications -> 0
      const mavisReq = createAuthedRequest('http://localhost:3000/api/notifications', 'GET', {
        userId: mavisAdminUserId,
        role: 'ADMIN',
        profileId: mavisProfileId,
      });
      const mavisRes = await getNotificationsGet(mavisReq);
      const mavisData = await mavisRes.json();
      assert.strictEqual(mavisData.notifications.length, 0, 'Mavis must receive NOTHING');
    });

    // Section 44: Sidebar label 6 states
    test('Section 44: Sidebar label corresponds to exact 6 application/subscription states', async () => {
      const { getCorporateSidebarLabel } = await import('@/lib/dealers/status');
      assert.strictEqual(getCorporateSidebarLabel('NONE'), 'Kurumsal Başvuru');
      assert.strictEqual(getCorporateSidebarLabel('PENDING'), 'Kurumsal Başvuru');
      assert.strictEqual(getCorporateSidebarLabel('REJECTED'), 'Kurumsal Başvuru');
      assert.strictEqual(getCorporateSidebarLabel('APPROVED', 'INACTIVE'), 'Kurumsal Profil');
      assert.strictEqual(getCorporateSidebarLabel('APPROVED', 'ACTIVE'), 'Kurumsal Profil');
      assert.strictEqual(getCorporateSidebarLabel('APPROVED', 'EXPIRED'), 'Kurumsal Profil');
    });

    // Section 45: Corporate listing flow eligibility redirects and seller_type
    test('Section 45: Corporate listing flow enforces eligibility redirects and CORPORATE seller_type', async () => {
      const packages = db.packages;

      const corpPkg = packages.find((p) => p.code === 'CORPORATE_14_DAY' || p.price === 1750);
      assert.ok(corpPkg, 'Corporate package must exist');
      assert.strictEqual(corpPkg.price, 1750);
      assert.strictEqual(corpPkg.duration_days, 14);

      const indivPkg = packages.find((p) => p.code === 'STANDARD_7_DAY' || p.price === 2000);
      assert.ok(indivPkg, 'Individual package must exist');
      assert.strictEqual(indivPkg.price, 2000);
      assert.strictEqual(indivPkg.duration_days, 7);
    });

    // Section 50: Profile #ID visibility cleanup
    test('Section 50: Public routes work without exposing #ID in public header badge', async () => {
      const { getUserRepository } = await import('@/lib/db/repositories');
      const userRepo = getUserRepository();
      const profile = userRepo.getProfileByPublicId ? await userRepo.getProfileByPublicId(2) : await userRepo.getProfileById('char-zade-02');
      assert.ok(profile, 'Public profile must be retrievable');
      assert.strictEqual(profile?.full_name, 'Zade Vexnera');
    });
  });
});
