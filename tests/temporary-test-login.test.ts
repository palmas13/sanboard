import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { GET as startTestLogin } from '@/app/api/auth/test-login/route';
import { GET as startRealLogin } from '@/app/api/auth/gtaworld/login/route';
import { POST as selectCharacter, DELETE as logout } from '@/app/api/auth/session/route';
import { GET as listCharacters } from '@/app/api/user/characters/route';
import { POST as setFavorite } from '@/app/api/favorites/route';
import { CHARACTER_SELECTION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { TEST_LOGIN_ACCOUNT_PREFIX, TEST_LOGIN_CHARACTER_PREFIX, isTestLoginEnabled } from '@/lib/auth/test-login';

describe('SANBOARD temporary test character login harness', () => {
  const existingListings = [...db.listings];

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'temporary-test-login-secret-at-least-32-characters';
    delete process.env.ENABLE_TEST_LOGIN;
    delete process.env.GTAWORLD_CLIENT_ID;
    delete process.env.GTAWORLD_CLIENT_SECRET;
    delete process.env.GTAWORLD_REDIRECT_URI;
    db.users = [];
    db.profiles = [];
    db.favorites = [];
    db.auditLogs = [];
    db.listings = [...existingListings];
  });

  test('disabled flag hides UI at the server boundary and denies the route', async () => {
    assert.equal(isTestLoginEnabled(), false);
    const denied = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    assert.equal(denied.status, 404);
    const loginPage = readFileSync(join(process.cwd(), 'src/app/giris/page.tsx'), 'utf8');
    assert.match(loginPage, /isTestLoginEnabled\(\)/);
    const loginContent = readFileSync(join(process.cwd(), 'src/app/giris/LoginContent.tsx'), 'utf8');
    assert.match(loginContent, /testLoginEnabled &&/);
  });

  test('disabling the flag also revokes existing test selection context at server endpoints', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const start = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    const selection = start.cookies.get(CHARACTER_SELECTION_COOKIE)!.value;
    delete process.env.ENABLE_TEST_LOGIN;
    const characters = await listCharacters(new NextRequest('http://localhost/api/user/characters', { headers: { cookie: `${CHARACTER_SELECTION_COOKIE}=${selection}` } }));
    assert.equal(characters.status, 404);
    const selectionAttempt = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: `${CHARACTER_SELECTION_COOKIE}=${selection}`, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: db.profiles[0].id }) }));
    assert.equal(selectionAttempt.status, 404);
  });

  test('enabled route uses namespaced mock source then canonical sync and selection context', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const response = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login?redirect=%2Farac'));
    assert.equal(response.status, 307);
    assert.match(response.headers.get('location') || '', /\/karakter-sec\?redirect=%2Farac&source=test$/);
    assert.equal(db.users.length, 1);
    assert.equal(db.profiles.length, 3);
    assert.ok(db.users[0].external_user_id?.startsWith(TEST_LOGIN_ACCOUNT_PREFIX));
    assert.ok(db.profiles.every((profile) => profile.external_character_id?.startsWith(TEST_LOGIN_CHARACTER_PREFIX)));
    assert.ok(db.profiles.every((profile) => profile.role === 'USER'));
    assert.ok(db.profiles.every((profile) => profile.id !== profile.external_character_id));
    assert.equal(response.cookies.get('sanboard_session')?.value, '');
    assert.ok(response.cookies.get(CHARACTER_SELECTION_COOKIE)?.value);
  });

  test('canonical picker creates canonical session, rejects cross-account injection, and isolates favorites after switch', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const start = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    const selectionToken = start.cookies.get(CHARACTER_SELECTION_COOKIE)!.value;
    const selectionCookie = `${CHARACTER_SELECTION_COOKIE}=${selectionToken}`;
    const listed = await listCharacters(new NextRequest('http://localhost/api/user/characters', { headers: { cookie: selectionCookie } }));
    const body = await listed.json();
    assert.equal(body.isTestIdentity, true);
    const [profileA, profileB] = body.profiles;

    const outsiderUser = { id: 'outsider-user', provider: 'GTAWORLD' as const, external_user_id: 'real-account', role: 'USER' as const, status: 'ACTIVE' as const, created_at: '', updated_at: '' };
    const outsiderProfile = { id: 'outsider-profile', user_id: outsiderUser.id, external_character_id: 'real-character', full_name: 'Outside Character', avatar_url: '', sanmail_email: '', phone: '', role: 'USER' as const, created_at: '', updated_at: '' };
    db.users.push(outsiderUser);
    db.profiles.push(outsiderProfile);
    const injection = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: selectionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: outsiderProfile.id, role: 'ADMIN', userId: outsiderUser.id }) }));
    assert.equal(injection.status, 403);

    const selectedA = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: selectionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: profileA.id, role: 'ADMIN' }) }));
    assert.equal(selectedA.status, 200);
    const sessionA = verifySessionToken(selectedA.cookies.get('sanboard_session')!.value)!;
    assert.equal(sessionA.userId, db.users[0].id);
    assert.equal(sessionA.profileId, profileA.id);
    assert.equal(sessionA.role, 'USER');

    const listingId = db.listings.find((listing) => listing.seller_profile_id !== profileA.id)?.id;
    assert.ok(listingId);
    const sessionCookieA = `sanboard_session=${selectedA.cookies.get('sanboard_session')!.value}`;
    const favoriteA = await setFavorite(new NextRequest('http://localhost/api/favorites', { method: 'POST', headers: { cookie: sessionCookieA, 'content-type': 'application/json' }, body: JSON.stringify({ listingId, isFavorited: true, profileId: profileB.id }) }));
    assert.equal(favoriteA.status, 200);
    assert.ok(db.favorites.some((favorite) => favorite.profile_id === profileA.id));
    assert.equal(db.favorites.some((favorite) => favorite.profile_id === profileB.id), false);

    const selectedB = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: sessionCookieA, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: profileB.id }) }));
    assert.equal(selectedB.status, 200);
    const sessionB = verifySessionToken(selectedB.cookies.get('sanboard_session')!.value)!;
    assert.equal(sessionB.profileId, profileB.id);
    assert.equal(db.favorites.some((favorite) => favorite.profile_id === profileB.id), false);
  });

  test('real login never falls back to mock and normal logout clears both auth cookies', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const real = await startRealLogin(new NextRequest('http://localhost/api/auth/gtaworld/login'));
    assert.equal(real.status, 307);
    assert.match(real.headers.get('location') || '', /\/giris\?error=oauth_config_missing$/);
    assert.equal(db.users.length, 0);

    const start = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    const selection = start.cookies.get(CHARACTER_SELECTION_COOKIE)!.value;
    const profile = db.profiles[0];
    const selected = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: `${CHARACTER_SELECTION_COOKIE}=${selection}`, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: profile.id }) }));
    const fullSession = selected.cookies.get('sanboard_session')!.value;
    const loggedOut = await logout(new NextRequest('http://localhost/api/auth/session', { method: 'DELETE', headers: { cookie: `sanboard_session=${fullSession}; ${CHARACTER_SELECTION_COOKIE}=${selection}` } }));
    assert.equal(loggedOut.cookies.get('sanboard_session')?.value, '');
    assert.equal(loggedOut.cookies.get(CHARACTER_SELECTION_COOKIE)?.value, '');
  });
});