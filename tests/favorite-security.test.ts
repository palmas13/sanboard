import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as toggleFavoritePost, DELETE as deleteFavorite, GET as getFavoriteStatus } from '@/app/api/favorites/route';
import { GET as getUserFavoritesGet } from '@/app/api/user/favorites/route';
import { PUT as updateListingPut } from '@/app/api/user/listings/[id]/route';
import { GET as adminGet } from '@/app/api/admin/route';
import { db } from '@/lib/db/store';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { getListingRepository } from '@/lib/db/repositories';
import { proxy, config as proxyConfig } from '@/proxy';
import fs from 'node:fs';
import path from 'node:path';

describe('Sanboard Favorite & Session Security Hardening Tests', () => {
  const zadeUserId = '33333333-3333-3333-3333-333333333333';
  const mavisUserId = '22222222-2222-2222-2222-222222222222';
  const testListingId = db.listings[0]?.id || 'lst-veh-01';

  beforeEach(() => {
    // Reset favorites in mock store for clean isolated test runs
    db.favorites = [];
  });

  // Helper to create a NextRequest with signed session cookie or raw cookie
  function createAuthedRequest(
    url: string,
    method: string,
    sessionUser?: { userId: string; role: 'USER' | 'ADMIN'; profileId?: string } | null,
    body?: any,
    rawCookieHeader?: string
  ) {
    const headers = new Headers();
    if (sessionUser) {
      const token = createSessionToken(sessionUser);
      headers.set('cookie', `sanboard_session=${token}`);
    } else if (rawCookieHeader) {
      headers.set('cookie', rawCookieHeader);
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
  // 1. FAVORITE API IDENTITY TESTS
  // =========================================================================

  test('TEST 1: Zade cannot favorite on behalf of Mavis by injecting Mavis user ID into request body', async () => {
    // Zade has valid signed session for Zade, but attempts to spoof Mavis in request body
    const spoofReq = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      {
        listingId: testListingId,
        isFavorited: true,
        userId: mavisUserId, // Spoofed victim in body
      }
    );

    const res = await toggleFavoritePost(spoofReq);
    assert.strictEqual(res.status, 200);

    // Verify favorite in store belongs to Zade (session), NOT Mavis
    const mavisFavs = db.favorites.filter((f) => f.user_id === mavisUserId && f.listing_id === testListingId);
    assert.strictEqual(mavisFavs.length, 0, 'Mavis must NOT have any favorite row created');

    const zadeFavs = db.favorites.filter((f) => f.user_id === zadeUserId && f.listing_id === testListingId);
    assert.strictEqual(zadeFavs.length, 1, 'Favorite must belong strictly to authenticated session (Zade)');
  });

  test('TEST 2: Zade cannot delete Mavis favorite row using spoofed account ID in body or query', async () => {
    // Setup: Mavis has favorited the listing
    db.favorites.push({
      id: 'fav-mavis-row',
      user_id: mavisUserId,
      profile_id: '44444444-4444-4444-4444-444444444441',
      listing_id: testListingId,
      created_at: new Date().toISOString(),
    });

    // Zade is logged in with valid session, attempts to delete Mavis's favorite
    const deleteReq = createAuthedRequest(
      'http://localhost:3000/api/favorites?userId=' + mavisUserId,
      'DELETE',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      {
        listingId: testListingId,
        userId: mavisUserId, // Attacker specifies Mavis ID
      }
    );

    const res = await deleteFavorite(deleteReq);
    assert.strictEqual(res.status, 200);

    // Mavis's favorite must remain intact
    const mavisFavs = db.favorites.filter((f) => f.user_id === mavisUserId && f.listing_id === testListingId);
    assert.strictEqual(mavisFavs.length, 1, 'Mavis favorite row must not be deleted by Zade');
  });

  test('TEST 3: Client sending ONLY { listingId } without any userId succeeds for authenticated session', async () => {
    const cleanReq = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true } // No userId, no profileId
    );

    const res = await toggleFavoritePost(cleanReq);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.isFavorited, true);
    assert.strictEqual(data.count, 1);

    const favRow = db.favorites.find((f) => f.listing_id === testListingId);
    assert.ok(favRow);
    assert.strictEqual(favRow.user_id, zadeUserId);
  });

  test('TEST 3B: external character session ID resolves to canonical profile for favorite mutation', async () => {
    const profile = db.profiles.find((item) => item.id === 'char-zade-02');
    assert.ok(profile);
    const previousExternalId = profile.external_character_id;
    profile.external_character_id = '77702';

    try {
      const req = createAuthedRequest(
        'http://localhost:3000/api/favorites',
        'POST',
        { userId: zadeUserId, role: 'USER', profileId: '77702' },
        { listingId: testListingId, isFavorited: true }
      );
      const res = await toggleFavoritePost(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.isFavorited, true);
      assert.ok(db.favorites.some((favorite) => favorite.profile_id === profile.id));
    } finally {
      profile.external_character_id = previousExternalId;
    }
  });

  test('TEST 4: Character switch isolates favorites (char-profile-b does not inherit char-profile-a favorites)', async () => {
    // Character A adds favorite
    db.favorites.push({
      id: 'fav-zade-1',
      user_id: zadeUserId,
      profile_id: 'char-profile-a',
      listing_id: testListingId,
      created_at: new Date().toISOString(),
    });

    // Requesting favorites for Character B under the same account -> isolated (0 favorites)
    const reqB = createAuthedRequest(
      'http://localhost:3000/api/user/favorites',
      'GET',
      { userId: zadeUserId, role: 'USER', profileId: 'char-profile-b' }
    );

    const resB = await getUserFavoritesGet(reqB);
    assert.strictEqual(resB.status, 200);

    const favListB = await resB.json();
    assert.ok(Array.isArray(favListB));
    assert.strictEqual(favListB.length, 0, 'Character B must not inherit Character A favorites');

    // Requesting favorites for Character A -> has 1 favorite
    const reqA = createAuthedRequest(
      'http://localhost:3000/api/user/favorites',
      'GET',
      { userId: zadeUserId, role: 'USER', profileId: 'char-profile-a' }
    );
    const resA = await getUserFavoritesGet(reqA);
    const favListA = await resA.json();
    assert.strictEqual(favListA.length, 1);
    assert.strictEqual(favListA[0].id, testListingId);
  });

  test('TEST 5: Repeated ADD for the same (profile_id, listing_id) is idempotent', async () => {
    // First request adds favorite
    const req1 = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true }
    );
    const res1 = await toggleFavoritePost(req1);
    const data1 = await res1.json();
    assert.strictEqual(data1.isFavorited, true);
    assert.strictEqual(db.favorites.filter((f) => f.user_id === zadeUserId && f.listing_id === testListingId).length, 1);

    // Stale client repeats ADD: relation remains present and unique
    const req2 = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true }
    );
    const res2 = await toggleFavoritePost(req2);
    const data2 = await res2.json();
    assert.strictEqual(data2.isFavorited, true);
    assert.strictEqual(db.favorites.filter((f) => f.user_id === zadeUserId && f.listing_id === testListingId).length, 1);

    // Explicit REMOVE removes exactly that profile relation
    const req3 = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: false }
    );
    const res3 = await toggleFavoritePost(req3);
    const data3 = await res3.json();
    assert.strictEqual(data3.isFavorited, false);
    assert.strictEqual(db.favorites.filter((f) => f.user_id === zadeUserId && f.listing_id === testListingId).length, 0);
  });

  test('REGRESSION 1-3: refresh hydration is authoritative and sibling profile remains false', async () => {
    db.favorites.push({
      id: 'fav-refresh-profile-a',
      user_id: zadeUserId,
      profile_id: 'char-profile-a',
      listing_id: testListingId,
      created_at: new Date().toISOString(),
    });

    const activeRequest = createAuthedRequest(
      `http://localhost:3000/api/favorites?listingIds=${testListingId}`,
      'GET',
      { userId: zadeUserId, role: 'USER', profileId: 'char-profile-a' }
    );
    const activeData = await (await getFavoriteStatus(activeRequest)).json();
    assert.strictEqual(activeData.states[testListingId].isFavorited, true);
    assert.strictEqual(activeData.states[testListingId].count, 1);

    const siblingRequest = createAuthedRequest(
      `http://localhost:3000/api/favorites?listingIds=${testListingId}`,
      'GET',
      { userId: zadeUserId, role: 'USER', profileId: 'char-profile-b' }
    );
    const siblingData = await (await getFavoriteStatus(siblingRequest)).json();
    assert.strictEqual(siblingData.states[testListingId].isFavorited, false);
    assert.strictEqual(siblingData.states[testListingId].count, 1);
  });

  test('REGRESSION 4-5: explicit add and remove change aggregate count by exactly one', async () => {
    db.favorites.push({
      id: 'fav-other-profile',
      user_id: mavisUserId,
      profile_id: 'char-other-profile',
      listing_id: testListingId,
      created_at: new Date().toISOString(),
    });

    const addRequest = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true }
    );
    const added = await (await toggleFavoritePost(addRequest)).json();
    assert.strictEqual(added.isFavorited, true);
    assert.strictEqual(added.count, 2);

    const removeRequest = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: false }
    );
    const removed = await (await toggleFavoritePost(removeRequest)).json();
    assert.strictEqual(removed.isFavorited, false);
    assert.strictEqual(removed.count, 1);
  });

  test('REGRESSION 6-8: stale false ADD cannot remove an existing DB favorite or create duplicates', async () => {
    db.favorites.push({
      id: 'fav-existing-stale-client',
      user_id: zadeUserId,
      profile_id: 'char-zade-02',
      listing_id: testListingId,
      created_at: new Date().toISOString(),
    });

    const staleAddRequest = () => createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true }
    );
    const [first, second] = await Promise.all([
      toggleFavoritePost(staleAddRequest()),
      toggleFavoritePost(staleAddRequest()),
    ]);
    assert.strictEqual((await first.json()).isFavorited, true);
    assert.strictEqual((await second.json()).isFavorited, true);
    assert.strictEqual(
      db.favorites.filter((favorite) => favorite.profile_id === 'char-zade-02' && favorite.listing_id === testListingId).length,
      1
    );
  });

  test('REGRESSION 9-11: favorites page returns true membership and the same real aggregate count', async () => {
    db.favorites.push(
      {
        id: 'fav-page-active',
        user_id: zadeUserId,
        profile_id: 'char-zade-02',
        listing_id: testListingId,
        created_at: new Date().toISOString(),
      },
      {
        id: 'fav-page-other',
        user_id: mavisUserId,
        profile_id: 'char-mavis-01',
        listing_id: testListingId,
        created_at: new Date().toISOString(),
      }
    );

    const favoritesRequest = createAuthedRequest(
      'http://localhost:3000/api/user/favorites',
      'GET',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' }
    );
    const favorites = await (await getUserFavoritesGet(favoritesRequest)).json();
    const favoriteListing = favorites.find((listing: any) => listing.id === testListingId);
    assert.ok(favoriteListing);
    assert.strictEqual(favoriteListing.is_favorited, true);
    assert.strictEqual(favoriteListing.favorite_count, 2);

    const states = await getListingRepository().getFavoriteStates([testListingId], 'char-zade-02');
    assert.strictEqual(states[testListingId].count, favoriteListing.favorite_count);
  });

  test('REGRESSION 12-14: character cache isolation, logout persistence and batch query guards remain in source', () => {
    const buttonSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/listings/FavoriteButton.tsx'),
      'utf8'
    );
    const repoSource = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-listing-repo.ts'),
      'utf8'
    );
    const authSource = fs.readFileSync(
      path.join(process.cwd(), 'src/features/auth/AuthContext.tsx'),
      'utf8'
    );

    assert.strictEqual(buttonSource.includes('favoriteStateCache.get(`anon:${listingId}`)'), false);
    assert.ok(buttonSource.includes('listingIds.join'));
    assert.ok(buttonSource.includes('mutationPendingRef.current'));
    assert.ok(buttonSource.includes('isFavorited: optimisticFavorited'));
    assert.ok(repoSource.includes(".select('listing_id, profile_id')"));
    assert.ok(repoSource.includes(".in('listing_id', ids)"));
    assert.ok(repoSource.includes('favorite_count: favoriteCountMap[listing.id] || 0'));
    assert.strictEqual(authSource.includes('db.favorites'), false, 'Logout must not delete favorite relations');
  });

  // =========================================================================
  // 2. SESSION SPOOFING & CRYPTOGRAPHIC VERIFICATION TESTS
  // =========================================================================

  test('SESSION SPOOF 1: Attacker setting raw UUID cookie (sanboard_user_id=Mavis) without signed session is rejected (401)', async () => {
    // Attacker alters document.cookie to victim UUID in browser
    const rawSpoofReq = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      null,
      { listingId: testListingId, isFavorited: true },
      `sanboard_user_id=${mavisUserId}; sanboard_role=ADMIN` // Raw un-signed cookie
    );

    const res = await toggleFavoritePost(rawSpoofReq);
    assert.strictEqual(res.status, 401, 'Raw UUID cookie without HMAC signature must be rejected with 401');
  });

  test('SESSION SPOOF 2: Tampered HMAC signature in sanboard_session is detected and rejected (401)', async () => {
    // Generate valid token for Zade, then alter the signature
    const validToken = createSessionToken({ userId: zadeUserId, role: 'USER' });
    const [payloadB64] = validToken.split('.');
    const tamperedToken = `${payloadB64}.tampered_fake_signature_xyz123`;

    const tamperedReq = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      null,
      { listingId: testListingId },
      `sanboard_session=${tamperedToken}`
    );

    const res = await toggleFavoritePost(tamperedReq);
    assert.strictEqual(res.status, 401, 'Tampered token must be rejected with 401');
  });

  test('SESSION SPOOF 3: Validly signed session is accepted and authorizes user', async () => {
    const validReq = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      { listingId: testListingId, isFavorited: true }
    );

    const res = await toggleFavoritePost(validReq);
    assert.strictEqual(res.status, 200);
  });

  test('SESSION SPOOF 4: client-writable profile cookie cannot supply the active profile', async () => {
    const token = createSessionToken({ userId: zadeUserId, role: 'USER' });
    const req = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      null,
      { listingId: testListingId, isFavorited: true },
      `sanboard_session=${token}; sanboard_profile_id=char-zade-02`
    );

    const res = await toggleFavoritePost(req);
    assert.strictEqual(res.status, 400);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.match((await res.json()).error, /Aktif bir karakter profili seçilmedi/);
    assert.strictEqual(db.favorites.length, 0);
  });

  test('SESSION SPOOF 5: signed sibling profile not owned by the account is rejected with JSON 403', async () => {
    const req = createAuthedRequest(
      'http://localhost:3000/api/favorites',
      'POST',
      { userId: zadeUserId, role: 'USER', profileId: 'char-mavis-01' },
      { listingId: testListingId, isFavorited: true }
    );

    const res = await toggleFavoritePost(req);
    assert.strictEqual(res.status, 403);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.match((await res.json()).error, /bu hesaba ait değil/);
    assert.strictEqual(db.favorites.length, 0);
  });

  test('PROXY REGRESSION: /api/favorites is outside proxy matcher and direct proxy evaluation does not redirect', () => {
    assert.strictEqual(proxyConfig.matcher.some((matcher) => matcher.includes('/api')), false);
    const response = proxy(new NextRequest('http://localhost:3000/api/favorites'));
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('location'), null);
  });

  // =========================================================================
  // 3. AUTHORIZATION & ADMIN ACCESS TESTS
  // =========================================================================

  test('AUTH TEST 1: Client setting p_is_admin=true or sanboard_role=ADMIN without signed admin session is denied', async () => {
    // User Zade sets fake role cookie and sends p_is_admin in body
    const spoofAdminReq = createAuthedRequest(
      'http://localhost:3000/api/admin',
      'GET',
      null, // No valid admin session
      null,
      `sanboard_user_id=${zadeUserId}; sanboard_role=ADMIN`
    );

    const res = await adminGet(spoofAdminReq);
    assert.strictEqual(res.status, 403, 'Fake role cookie must be denied access to admin API (403)');
  });

  test('AUTH TEST 2: Zade cannot edit Mavis listing via PUT /api/user/listings/[id]', async () => {
    // Mavis owns listing lst-veh-01 (or db.listings[0])
    const mavisListing = db.listings[0];
    assert.ok(mavisListing);

    const zadeEditReq = createAuthedRequest(
      `http://localhost:3000/api/user/listings/${mavisListing.id}`,
      'PUT',
      { userId: zadeUserId, role: 'USER', profileId: 'char-zade-02' },
      {
        price: 99999,
        title: 'Hacked by Zade',
        p_is_admin: true, // Attempt to elevate privilege
      }
    );

    const res = await updateListingPut(zadeEditReq, {
      params: Promise.resolve({ id: mavisListing.id }),
    });

    assert.strictEqual(res.status, 403, 'Zade editing Mavis listing must return 403 Forbidden');
  });

  test('AUTH TEST 3: Admin with validly signed admin session can access admin dashboard', async () => {
    const adminReq = createAuthedRequest(
      'http://localhost:3000/api/admin',
      'GET',
      { userId: mavisUserId, role: 'ADMIN', profileId: 'char-mavis-01' }
    );

    const res = await adminGet(adminReq);
    assert.strictEqual(res.status, 200);
  });

  test('SESSION SECRET 1: Strictly requires 32+ byte secret in production and throws explicit error when missing', () => {
    const origSecret = process.env.SANBOARD_SESSION_SECRET;
    const origStore = process.env.DATA_STORE;
    const origNodeEnv = process.env.NODE_ENV;

    try {
      delete process.env.SANBOARD_SESSION_SECRET;
      delete process.env.SESSION_SECRET;
      process.env.DATA_STORE = 'supabase';

      assert.throws(() => {
        createSessionToken({ userId: 'u1', role: 'USER' });
      }, /SANBOARD_SESSION_SECRET is missing/);

      // Short secret < 32 bytes must be rejected
      process.env.SANBOARD_SESSION_SECRET = 'too-short-secret';
      assert.throws(() => {
        createSessionToken({ userId: 'u1', role: 'USER' });
      }, /SANBOARD_SESSION_SECRET is too short/);

      // Valid 32+ bytes secret must succeed
      process.env.SANBOARD_SESSION_SECRET = 'valid-production-secret-must-be-at-least-32-bytes-long';
      const token = createSessionToken({ userId: 'u1', role: 'USER' });
      assert.ok(token);
      const verified = verifySessionToken(token);
      assert.strictEqual(verified?.userId, 'u1');
    } finally {
      process.env.SANBOARD_SESSION_SECRET = origSecret;
      process.env.DATA_STORE = origStore;
      (process.env as any).NODE_ENV = origNodeEnv;
    }
  });
});
