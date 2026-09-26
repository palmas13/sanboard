import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { syncGtaWorldAccountAndCharacters } from '@/lib/auth/gtaworld-sync';
import {
  CHARACTER_SELECTION_COOKIE,
  createCharacterSelectionToken,
  createSessionToken,
  verifyCharacterSelectionToken,
  verifySessionToken,
} from '@/lib/auth/session';
import { DELETE as logout, POST as switchCharacter } from '@/app/api/auth/session/route';
import { GET as getCharacters } from '@/app/api/user/characters/route';
import { getGtaWorldAuthProvider } from '@/lib/integrations/gtaworld';
import { RealGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/real-provider';
import { GtaWorldApiUser } from '@/lib/integrations/gtaworld/types';

const account = (characters: Array<[string | number, string, string]>): GtaWorldApiUser => ({
  id: 'gtaw-user-9001',
  username: 'dynamic-user',
  character: characters.map(([id, firstname, lastname]) => ({ id, firstname, lastname })),
});

describe('SANBOARD dynamic identity foundation', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'dynamic-identity-test-secret-at-least-32-characters';
    delete process.env.ENABLE_TEST_LOGIN;
    db.users = [];
    db.profiles = [];
    db.auditLogs = [];
    db.favorites = [];
    db.followers = [];
  });

  test('brand-new opaque account creates canonical user and three USER profiles', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([
      ['char-A', 'Alpha', 'One'], ['char-B', 'Beta', 'Two'], ['char-C', 'Gamma', 'Three'],
    ]));
    assert.equal(db.users.length, 1);
    assert.equal(result.user.external_user_id, 'gtaw-user-9001');
    assert.equal(result.user.status, 'ACTIVE');
    assert.equal(result.profiles.length, 3);
    assert.equal(new Set(result.profiles.map((profile) => profile.id)).size, 3);
    assert.ok(result.profiles.every((profile) => profile.user_id === result.user.id));
    assert.ok(result.profiles.every((profile) => profile.role === 'USER'));
    assert.ok(result.profiles.every((profile) => profile.id !== profile.external_character_id));
  });

  test('repeat and simultaneous first login converge without duplicates', async () => {
    const payload = account([['char-A', 'Alpha', 'One'], ['char-B', 'Beta', 'Two']]);
    const [first, second] = await Promise.all([
      syncGtaWorldAccountAndCharacters(payload),
      syncGtaWorldAccountAndCharacters(payload),
    ]);
    const third = await syncGtaWorldAccountAndCharacters(payload);
    assert.equal(first.user.id, second.user.id);
    assert.equal(second.user.id, third.user.id);
    assert.equal(db.users.length, 1);
    assert.equal(db.profiles.length, 2);
    assert.deepEqual(first.profiles.map((p) => p.id).sort(), third.profiles.map((p) => p.id).sort());
  });

  test('later character is added while existing canonical IDs remain stable', async () => {
    const first = await syncGtaWorldAccountAndCharacters(account([
      ['char-A', 'Alpha', 'One'], ['char-B', 'Beta', 'Two'],
    ]));
    const ids = new Map(first.profiles.map((profile) => [profile.external_character_id, profile.id]));
    const second = await syncGtaWorldAccountAndCharacters(account([
      ['char-A', 'Alpha', 'One'], ['char-B', 'Beta', 'Two'], ['char-C', 'Gamma', 'Three'],
    ]));
    assert.equal(second.profiles.find((p) => p.external_character_id === 'char-A')?.id, ids.get('char-A'));
    assert.equal(second.profiles.find((p) => p.external_character_id === 'char-B')?.id, ids.get('char-B'));
    assert.ok(second.profiles.find((p) => p.external_character_id === 'char-C'));
  });

  test('rename preserves profile identity and Sanboard-owned state', async () => {
    const first = await syncGtaWorldAccountAndCharacters(account([['char-A', 'John', 'Smith']]));
    const profile = first.profiles[0];
    profile.phone = '5551234';
    profile.sanmail_email = 'john@sanmail.com';
    const second = await syncGtaWorldAccountAndCharacters(account([['char-A', 'John', 'Blake']]));
    assert.equal(second.profiles[0].id, profile.id);
    assert.equal(second.profiles[0].full_name, 'John Blake');
    assert.equal(second.profiles[0].phone, '5551234');
    assert.equal(second.profiles[0].sanmail_email, 'john@sanmail.com');
  });

  test('same name with different external IDs creates two profiles', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([
      ['char-A', 'John', 'Smith'], ['char-B', 'John', 'Smith'],
    ]));
    assert.equal(result.profiles.length, 2);
    assert.notEqual(result.profiles[0].id, result.profiles[1].id);
  });

  test('numeric, alpha, underscored and UUID-looking external IDs remain opaque strings', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([
      [12345, 'Numeric', 'Character'], ['abc123', 'Alpha', 'Character'],
      ['char_987', 'Under', 'Score'], ['44444444-4444-4444-4444-444444444443', 'Uuid', 'Looking'],
    ]));
    assert.deepEqual(result.profiles.map((p) => p.external_character_id).sort(), [
      '12345', '44444444-4444-4444-4444-444444444443', 'abc123', 'char_987',
    ]);
  });

  test('cross-account external character collision fails without rebinding ownership', async () => {
    const first = await syncGtaWorldAccountAndCharacters(account([['shared-char', 'First', 'Owner']]));
    await assert.rejects(
      () => syncGtaWorldAccountAndCharacters({ ...account([['shared-char', 'Second', 'Owner']]), id: 'other-account' }),
      /identity collision/
    );
    assert.equal(db.profiles[0].user_id, first.user.id);
  });

  test('signed switch uses canonical profile UUID and character-scoped role only', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([
      ['char-admin', 'Random', 'Person'], ['char-user', 'Mavis', 'Something'],
    ]));
    const admin = result.profiles.find((p) => p.external_character_id === 'char-admin')!;
    const user = result.profiles.find((p) => p.external_character_id === 'char-user')!;
    admin.role = 'ADMIN';
    user.role = 'USER';
    result.user.role = 'ADMIN';

    const token = createSessionToken({ userId: result.user.id, profileId: user.id, role: 'ADMIN' });
    const request = new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ characterId: 'char-admin', role: 'USER', userId: 'attacker' }),
    });
    const response = await switchCharacter(request);
    assert.equal(response.status, 200);
    const sessionCookie = response.cookies.get('sanboard_session')?.value;
    const switched = sessionCookie ? verifySessionToken(sessionCookie) : null;
    assert.equal(switched?.userId, result.user.id);
    assert.equal(switched?.profileId, admin.id);
    assert.equal(switched?.role, 'ADMIN');

    const backResponse = await switchCharacter(new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { cookie: `sanboard_session=${sessionCookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ characterId: user.external_character_id }),
    }));
    const back = verifySessionToken(backResponse.cookies.get('sanboard_session')!.value);
    assert.equal(back?.profileId, user.id);
    assert.equal(back?.role, 'USER');
  });

  test('multi-character first login selection context creates canonical full session for selected profile', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([
      ['char-A', 'Alpha', 'One'], ['char-B', 'Beta', 'Two'], ['char-C', 'Gamma', 'Three'],
    ]));
    const target = result.profiles.find((profile) => profile.external_character_id === 'char-B')!;
    target.role = 'ADMIN';
    const selectionToken = createCharacterSelectionToken(result.user.id);

    const response = await switchCharacter(new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: {
        cookie: `${CHARACTER_SELECTION_COOKIE}=${selectionToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ characterId: target.external_character_id }),
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    const fullSession = verifySessionToken(response.cookies.get('sanboard_session')!.value);
    assert.equal(fullSession?.userId, result.user.id);
    assert.equal(fullSession?.profileId, target.id);
    assert.equal(fullSession?.role, 'ADMIN');
    assert.equal(body.profile.id, target.id);
    assert.equal(response.cookies.get(CHARACTER_SELECTION_COOKIE)?.value, '');
  });

  test('direct character selection without full session or selection context is denied', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([['char-B', 'Beta', 'Two']]));
    const response = await switchCharacter(new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ characterId: result.profiles[0].id }),
    }));
    assert.equal(response.status, 401);
    assert.equal(response.cookies.get('sanboard_session'), undefined);
  });

  test('selection context cannot select another account profile', async () => {
    const first = await syncGtaWorldAccountAndCharacters(account([['char-A', 'Alpha', 'One']]));
    const second = await syncGtaWorldAccountAndCharacters({
      ...account([['char-Y', 'Other', 'Character']]),
      id: 'gtaw-user-other',
      username: 'other',
    });
    const response = await switchCharacter(new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: {
        cookie: `${CHARACTER_SELECTION_COOKIE}=${createCharacterSelectionToken(first.user.id)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ characterId: second.profiles[0].id }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.cookies.get('sanboard_session'), undefined);
  });

  test('logout clears full session, selection context, and OAuth attempt cookies', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([['char-A', 'Alpha', 'One']]));
    const fullToken = createSessionToken({ userId: result.user.id, profileId: result.profiles[0].id, role: 'USER' });
    const response = await logout(new NextRequest('http://localhost/api/auth/session', {
      method: 'DELETE',
      headers: { cookie: `sanboard_session=${fullToken}; ${CHARACTER_SELECTION_COOKIE}=${createCharacterSelectionToken(result.user.id)}; gtaw_oauth_attempt=test` },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.cookies.get('sanboard_session')?.value, '');
    assert.equal(response.cookies.get(CHARACTER_SELECTION_COOKIE)?.value, '');
    assert.equal(response.cookies.get('gtaw_oauth_attempt')?.value, '');
  });

  test('selection token is purpose-separated, signed, and rejects tampering', () => {
    const token = createCharacterSelectionToken('canonical-user');
    assert.equal(verifyCharacterSelectionToken(token)?.userId, 'canonical-user');
    assert.equal(verifySessionToken(token), null);
    assert.equal(verifyCharacterSelectionToken(`${token}tampered`), null);
  });

  test('single-character full session uses canonical profile UUID and profile role', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([['char-only', 'Only', 'Character']]));
    result.profiles[0].role = 'ADMIN';
    const token = createSessionToken({
      userId: result.user.id,
      profileId: result.profiles[0].id,
      role: result.profiles[0].role,
    });
    const session = verifySessionToken(token);
    assert.equal(session?.profileId, result.profiles[0].id);
    assert.equal(session?.role, 'ADMIN');
  });

  test('picker production flow has initials fallback and no Ravi demo avatar fallback', () => {
    const picker = readFileSync(join(process.cwd(), 'src/app/karakter-sec/CharacterSelectContent.tsx'), 'utf8');
    const mockProvider = readFileSync(join(process.cwd(), 'src/lib/integrations/gtaworld/mock-provider.ts'), 'utf8');
    const store = readFileSync(join(process.cwd(), 'src/lib/db/store.ts'), 'utf8');
    assert.match(picker, /const charAvatar = char\.avatarUrl \? resolveAvatarUrl\(char\.avatarUrl\) : null/);
    assert.match(picker, /char\.displayName/);
    assert.doesNotMatch(picker, /external_character_id/);
    assert.match(picker, /\{initials\}/);
    assert.doesNotMatch(mockProvider, /photo-1500648767791-00dcc994a43e/);
    assert.doesNotMatch(store, /photo-1500648767791-00dcc994a43e/);
  });

  test('banned account cannot switch or receive a new signed character session', async () => {
    const result = await syncGtaWorldAccountAndCharacters(account([['char-A', 'Alpha', 'One']]));
    result.user.status = 'BANNED';
    const token = createSessionToken({ userId: result.user.id, profileId: result.profiles[0].id, role: 'USER' });
    const response = await switchCharacter(new NextRequest('http://localhost/api/auth/session', {
      method: 'POST',
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ characterId: result.profiles[0].id }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.cookies.get('sanboard_session'), undefined);
  });

  test('production provider selector always returns real provider', () => {
    assert.ok(getGtaWorldAuthProvider() instanceof RealGtaWorldAuthProvider);
  });

  test('production-facing identity modules contain no named fixture authorization', () => {
    const paths = [
      'src/app/api/auth/session/route.ts',
      'src/app/api/admin/route.ts',
      'src/lib/auth/gtaworld-sync.ts',
      'src/lib/db/id-mapper.ts',
      'src/features/auth/AuthContext.tsx',
    ];
    for (const path of paths) {
      const source = readFileSync(join(process.cwd(), path), 'utf8');
      assert.doesNotMatch(source, /Mavis|Ravi|Zade|STAGING_CHARACTER_ACCOUNTS|MOCK_CHARACTER_ACCOUNTS/);
      assert.doesNotMatch(source, /full_name.*includes\(/);
    }
  });

  test('schema contracts retain unique external identities and add only user lookup index', () => {
    const uniqueness = readFileSync(join(process.cwd(), 'supabase/migrations/20260924050000_gtaworld_oauth_and_audit.sql'), 'utf8');
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926050000_dynamic_identity_foundation.sql'), 'utf8');
    assert.match(uniqueness, /UNIQUE INDEX IF NOT EXISTS idx_users_provider_external_id/);
    assert.match(uniqueness, /UNIQUE INDEX IF NOT EXISTS idx_character_profiles_external_char_id/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_character_profiles_user_id[\s\S]*character_profiles\(user_id\)/);
    assert.doesNotMatch(migration, /UNIQUE|LIMIT|DELETE|ALTER TABLE/);
  });
});