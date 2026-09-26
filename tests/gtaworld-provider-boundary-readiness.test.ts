import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { createLoginAttemptToken, verifyLoginAttemptToken } from '@/lib/auth/login-attempt';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';
import { GET as startRealLogin } from '@/app/api/auth/gtaworld/login/route';

describe('SANBOARD GTA World provider boundary readiness', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'provider-boundary-test-secret-at-least-32-characters';
    db.users = [];
    db.profiles = [];
    db.auditLogs = [];
  });

  test('unknown Account X and two opaque characters sync idempotently with internal UUID identities', async () => {
    const account = {
      externalAccountId: '12345',
      characters: [
        { externalCharacterId: 'char_981', displayName: 'Alex Stone', avatarUrl: null },
        { externalCharacterId: '8f8d0000-1111-4222-8333-abcdefabcdef', displayName: 'Jordan Reed' },
      ],
    };
    const first = await syncExternalGameAccount(account);
    const second = await syncExternalGameAccount(account);
    assert.equal(db.users.length, 1);
    assert.equal(db.profiles.length, 2);
    assert.equal(second.user.id, first.user.id);
    assert.deepEqual(second.profiles.map((profile) => profile.id).sort(), first.profiles.map((profile) => profile.id).sort());
    assert.ok(first.profiles.every((profile) => profile.id !== profile.external_character_id));
    assert.ok(first.profiles.every((profile) => profile.role === 'USER'));
  });

  test('rename preserves canonical profile and cross-account collision fails without transfer', async () => {
    const first = await syncExternalGameAccount({
      externalAccountId: 'Account X',
      characters: [{ externalCharacterId: 'ABC-99', displayName: 'Alex Stone' }],
    });
    const renamed = await syncExternalGameAccount({
      externalAccountId: 'Account X',
      characters: [{ externalCharacterId: 'ABC-99', displayName: 'Alex Reed' }],
    });
    assert.equal(renamed.profiles[0].id, first.profiles[0].id);
    assert.equal(renamed.profiles[0].full_name, 'Alex Reed');
    await assert.rejects(
      syncExternalGameAccount({
        externalAccountId: 'Account Y',
        characters: [{ externalCharacterId: 'ABC-99', displayName: 'Morgan Hale' }],
      }),
      /identity collision/
    );
    assert.equal(db.profiles.length, 1);
    assert.equal(db.profiles[0].user_id, first.user.id);
  });

  test('zero-character account creates no fake profile and retains no destructive absence behavior', async () => {
    const initial = await syncExternalGameAccount({
      externalAccountId: 'Account X',
      characters: [{ externalCharacterId: 'char-123', displayName: 'Alex Stone' }],
    });
    const repeatedWithoutCharacters = await syncExternalGameAccount({ externalAccountId: 'Account X', characters: [] });
    assert.equal(repeatedWithoutCharacters.user.id, initial.user.id);
    assert.equal(repeatedWithoutCharacters.profiles.length, 1);

    db.users = [];
    db.profiles = [];
    const empty = await syncExternalGameAccount({ externalAccountId: 'Account Y', characters: [] });
    assert.equal(empty.profiles.length, 0);
    assert.equal(db.profiles.length, 0);
    const picker = readFileSync(join(process.cwd(), 'src/app/karakter-sec/CharacterSelectContent.tsx'), 'utf8');
    assert.match(picker, /Bu hesapta seçilebilir karakter bulunamadı/);
  });

  test('OAuth attempt is signed, short-lived in shape, tamper-evident, and carries only a safe internal redirect', () => {
    const token = createLoginAttemptToken('state-123', '/hesabim?tab=ilanlar');
    const verified = verifyLoginAttemptToken(token);
    assert.equal(verified?.state, 'state-123');
    assert.equal(verified?.redirect, '/hesabim?tab=ilanlar');
    assert.ok(verified && verified.exp - verified.iat === 600);
    assert.equal(verifyLoginAttemptToken(`${token.slice(0, -1)}x`), null);
    assert.equal(verifyLoginAttemptToken(createLoginAttemptToken('state-456', 'https://evil.example'))?.redirect, '/');
    assert.equal(verifyLoginAttemptToken(createLoginAttemptToken('state-789', '//evil.example'))?.redirect, '/');
  });

  test('redirect normalization blocks external, encoded external, protocol and backslash forms', () => {
    for (const unsafe of [
      'https://evil.example', '//evil.example', 'javascript:alert(1)',
      '%2F%2Fevil.example', '%252F%252Fevil.example', '/\\evil.example',
    ]) assert.equal(normalizeInternalRedirect(unsafe), '/');
    assert.equal(normalizeInternalRedirect('/arac?sort=latest'), '/arac?sort=latest');
  });

  test('real login is NOT_CONFIGURED and never creates mock or canonical identities', async () => {
    process.env.ENABLE_TEST_LOGIN = 'true';
    const response = await startRealLogin(new NextRequest('http://localhost/api/auth/gtaworld/login?redirect=https%3A%2F%2Fevil.example'));
    assert.equal(response.status, 307);
    assert.match(response.headers.get('location') || '', /\/giris\?error=provider_not_configured$/);
    assert.equal(db.users.length, 0);
    assert.equal(db.profiles.length, 0);
  });

  test('frontend and business sync consume canonical DTOs rather than raw GTA World fields', () => {
    const sync = readFileSync(join(process.cwd(), 'src/lib/auth/gtaworld-sync.ts'), 'utf8');
    const picker = readFileSync(join(process.cwd(), 'src/app/karakter-sec/CharacterSelectContent.tsx'), 'utf8');
    assert.doesNotMatch(sync.split('/** @deprecated')[0], /firstname|lastname|access_token|\/oauth\/|\/api\/user/);
    assert.doesNotMatch(picker, /external_character_id|external_user_id|firstname|lastname|access_token/);
  });
});