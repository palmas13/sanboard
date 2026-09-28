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
import { GET as getAdmin } from '@/app/api/admin/route';
import { CHARACTER_SELECTION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { TEST_LOGIN_ACCOUNT_PREFIX, TEST_LOGIN_CHARACTER_PREFIX, TEST_LOGIN_FIXTURE_ACCOUNT_ID, TEST_LOGIN_JANE_CHARACTER_ID, TEST_LOGIN_JOHN_CHARACTER_ID, TEST_LOGIN_MAVIS_CHARACTER_ID, TEST_LOGIN_SECONDARY_ACCOUNT_ID, isTestLoginEnabled } from '@/lib/auth/test-login';
import CharacterSelectPage from '@/app/karakter-sec/page';
import { CharacterSelectContent } from '@/app/karakter-sec/CharacterSelectContent';

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
    const mavis = db.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID);
    assert.equal(mavis?.role, 'ADMIN');
    assert.ok(db.profiles.filter((profile) => profile.id !== mavis?.id).every((profile) => profile.role === 'USER'));
    assert.ok(db.profiles.every((profile) => profile.id !== profile.external_character_id));
    assert.equal(response.cookies.get('sanboard_session')?.value, '');
    assert.ok(response.cookies.get(CHARACTER_SELECTION_COOKIE)?.value);
  });

  test('secondary account is canonical, defaults to John, switches to Jane, and cannot inject accounts or profiles', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const accountAStart = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    assert.ok(accountAStart.cookies.get(CHARACTER_SELECTION_COOKIE)?.value);

    const invalid = await startTestLogin(new NextRequest(`http://localhost/api/auth/test-login?account=${encodeURIComponent(TEST_LOGIN_SECONDARY_ACCOUNT_ID)}`));
    assert.equal(invalid.status, 400);

    const accountBStart = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login?account=secondary&redirect=%2Farac'));
    assert.equal(accountBStart.status, 307);
    assert.match(accountBStart.headers.get('location') || '', /\/arac$/);
    assert.equal(db.users.length, 2);
    assert.equal(db.profiles.length, 5);

    const accountA = db.users.find((user) => user.external_user_id === TEST_LOGIN_FIXTURE_ACCOUNT_ID)!;
    const accountB = db.users.find((user) => user.external_user_id === TEST_LOGIN_SECONDARY_ACCOUNT_ID)!;
    assert.ok(accountA);
    assert.ok(accountB);
    assert.notEqual(accountA.id, accountB.id);

    const john = db.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_JOHN_CHARACTER_ID)!;
    const jane = db.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_JANE_CHARACTER_ID)!;
    assert.equal(john.full_name, 'John Doe');
    assert.equal(jane.full_name, 'Jane Doe');
    assert.equal(john.user_id, accountB.id);
    assert.equal(jane.user_id, accountB.id);
    assert.equal(john.role, 'USER');
    assert.equal(jane.role, 'USER');
    assert.ok(db.profiles.filter((profile) => profile.user_id === accountA.id).every((profile) => ![john.id, jane.id].includes(profile.id)));

    const johnToken = accountBStart.cookies.get('sanboard_session')!.value;
    const johnSession = verifySessionToken(johnToken)!;
    assert.equal(johnSession.userId, accountB.id);
    assert.equal(johnSession.profileId, john.id);
    assert.equal(johnSession.role, 'USER');

    const accountBCharacters = await listCharacters(new NextRequest('http://localhost/api/user/characters', { headers: { cookie: `sanboard_session=${johnToken}` } }));
    const accountBBody = await accountBCharacters.json();
    assert.deepEqual(accountBBody.characters.map((character: { displayName: string }) => character.displayName), ['John Doe', 'Jane Doe']);

    const mavis = db.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID)!;
    const crossAccountInjection = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: `sanboard_session=${johnToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: mavis.id, userId: accountA.id }) }));
    assert.equal(crossAccountInjection.status, 403);

    const switched = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: `sanboard_session=${johnToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: jane.id }) }));
    assert.equal(switched.status, 200);
    const janeSession = verifySessionToken(switched.cookies.get('sanboard_session')!.value)!;
    assert.equal(janeSession.userId, accountB.id);
    assert.equal(janeSession.profileId, jane.id);
  });

  test('character picker resolves test and normal UI from server search params without client URL branching', async () => {
    const testPage = await CharacterSelectPage({ searchParams: Promise.resolve({ redirect: '/arac', source: 'test' }) });
    assert.equal(testPage.type, CharacterSelectContent);
    assert.deepEqual(testPage.props, { redirect: '/arac', isTestSource: true });

    const normalPage = await CharacterSelectPage({ searchParams: Promise.resolve({}) });
    assert.equal(normalPage.type, CharacterSelectContent);
    assert.deepEqual(normalPage.props, { redirect: '/', isTestSource: false });

    const clientSource = readFileSync(join(process.cwd(), 'src/app/karakter-sec/CharacterSelectContent.tsx'), 'utf8');
    assert.doesNotMatch(clientSource, /useSearchParams/);
    assert.doesNotMatch(clientSource, /searchParams\.get\(['"]source['"]\)/);
    assert.match(clientSource, /isTestSource &&/);
    assert.match(clientSource, /Bu karakterler gerçek GTA World hesabı veya UCP karakteri değildir/);
    assert.match(clientSource, /onClick=\{\(\) => handleSelect/);
    assert.match(clientSource, /await selectCharacter\(characterId\)/);
  });

  test('canonical picker creates canonical session, rejects cross-account injection, and isolates favorites after switch', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const start = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    const selectionToken = start.cookies.get(CHARACTER_SELECTION_COOKIE)!.value;
    const selectionCookie = `${CHARACTER_SELECTION_COOKIE}=${selectionToken}`;
    const listed = await listCharacters(new NextRequest('http://localhost/api/user/characters', { headers: { cookie: selectionCookie } }));
    const body = await listed.json();
    assert.equal(body.isTestIdentity, true);
    assert.equal(body.profiles, undefined);
    const [profileA, profileB] = body.characters;
    assert.deepEqual(Object.keys(profileA).sort(), ['avatarUrl', 'displayName', 'id', 'role']);

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
    assert.equal(sessionA.role, 'ADMIN');

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

  test('Mavis test ADMIN is server-authoritative, feature-flag scoped, and isolated from names and siblings', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const start = await startTestLogin(new NextRequest('http://localhost/api/auth/test-login'));
    const selectionToken = start.cookies.get(CHARACTER_SELECTION_COOKIE)!.value;
    const selectionCookie = `${CHARACTER_SELECTION_COOKIE}=${selectionToken}`;
    const mavis = db.profiles.find((profile) => profile.external_character_id === TEST_LOGIN_MAVIS_CHARACTER_ID)!;
    const sibling = db.profiles.find((profile) => profile.id !== mavis.id)!;

    const selectedMavis = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: selectionCookie, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: mavis.id, role: 'USER' }) }));
    assert.equal(selectedMavis.status, 200);
    const mavisSession = selectedMavis.cookies.get('sanboard_session')!.value;
    assert.equal(verifySessionToken(mavisSession)?.role, 'ADMIN');
    assert.equal((await getAdmin(new NextRequest('http://localhost/api/admin', { headers: { cookie: `sanboard_session=${mavisSession}` } }))).status, 200);

    const siblingSelected = await selectCharacter(new NextRequest('http://localhost/api/auth/session', { method: 'POST', headers: { cookie: `sanboard_session=${mavisSession}`, 'content-type': 'application/json' }, body: JSON.stringify({ characterId: sibling.id, role: 'ADMIN' }) }));
    const siblingSession = siblingSelected.cookies.get('sanboard_session')!.value;
    assert.equal(verifySessionToken(siblingSession)?.role, 'USER');
    assert.equal((await getAdmin(new NextRequest('http://localhost/api/admin', { headers: { cookie: `sanboard_session=${siblingSession}; sanboard_role=ADMIN` } }))).status, 403);

    db.users.push({ id: 'real-mavis-user', provider: 'GTAWORLD', external_user_id: 'real-mavis-account', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' });
    db.profiles.push({ id: 'real-mavis-profile', user_id: 'real-mavis-user', external_character_id: 'real-mavis-character', full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' });
    const { createSessionToken } = await import('@/lib/auth/session');
    const realNameSession = createSessionToken({ userId: 'real-mavis-user', profileId: 'real-mavis-profile', role: 'ADMIN' });
    assert.equal((await getAdmin(new NextRequest('http://localhost/api/admin', { headers: { cookie: `sanboard_session=${realNameSession}` } }))).status, 403);

    mavis.role = 'USER';
    assert.equal((await getAdmin(new NextRequest('http://localhost/api/admin', { headers: { cookie: `sanboard_session=${mavisSession}` } }))).status, 403);
    mavis.role = 'ADMIN';
    delete process.env.ENABLE_TEST_LOGIN;
    assert.equal((await getAdmin(new NextRequest('http://localhost/api/admin', { headers: { cookie: `sanboard_session=${mavisSession}` } }))).status, 403);
  });

  test('real login never falls back to mock and normal logout clears both auth cookies', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const real = await startRealLogin(new NextRequest('http://localhost/api/auth/gtaworld/login'));
    assert.equal(real.status, 307);
    assert.match(real.headers.get('location') || '', /\/giris\?error=provider_not_configured$/);
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