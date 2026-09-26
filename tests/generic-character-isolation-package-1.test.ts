import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET as getCredits } from '@/app/api/credits/route';
import { GET as getPayments } from '@/app/api/user/payments/route';
import { GET as getCharacters } from '@/app/api/user/characters/route';

describe('SANBOARD generic character isolation package 1', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const otherAccountId = '22222222-2222-4222-8222-222222222222';
  const alexId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordanId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const morganId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const outsiderId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  function request(path: string, profileId?: string, writableCookieProfileId?: string) {
    const cookies: string[] = [];
    if (profileId) {
      cookies.push(`sanboard_session=${createSessionToken({ userId: accountId, profileId, role: 'USER' })}`);
    }
    if (writableCookieProfileId) cookies.push(`sanboard_profile_id=${writableCookieProfileId}`);
    return new NextRequest(`http://localhost${path}`, {
      headers: cookies.length ? { cookie: cookies.join('; ') } : undefined,
    });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'generic-character-isolation-secret-32-bytes-minimum';
    delete process.env.ENABLE_TEST_LOGIN;
    db.users = [
      { id: accountId, provider: 'GTAWORLD', external_user_id: 'external-account-isolation-01', role: 'USER', status: 'ACTIVE', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: otherAccountId, provider: 'GTAWORLD', external_user_id: 'external-account-isolation-02', role: 'USER', status: 'ACTIVE', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
    ];
    db.profiles = [
      { id: alexId, user_id: accountId, external_character_id: 'external-character-alex', full_name: 'Alex Stone', avatar_url: '/alex.webp', sanmail_email: 'alex@sanmail.test', phone: '1001', role: 'USER', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: jordanId, user_id: accountId, external_character_id: 'external-character-jordan', full_name: 'Jordan Reed', avatar_url: '', sanmail_email: 'jordan@sanmail.test', phone: '1002', role: 'USER', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: morganId, user_id: accountId, external_character_id: 'external-character-morgan', full_name: 'Morgan Hale', avatar_url: '', sanmail_email: 'morgan@sanmail.test', phone: '1003', role: 'USER', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: outsiderId, user_id: otherAccountId, external_character_id: 'external-character-outsider', full_name: 'Taylor Cross', avatar_url: '', sanmail_email: 'taylor@sanmail.test', phone: '2001', role: 'USER', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
    ];
    db.credits = [
      { id: 'credit-A1', profile_id: alexId, payment_id: 'payment-A', package_id: 'package-1', credit_type: 'INDIVIDUAL', amount: 2000, status: 'AVAILABLE', created_at: '2026-09-26T01:00:00.000Z' },
      { id: 'credit-A2', profile_id: alexId, payment_id: 'payment-A2', package_id: 'package-1', credit_type: 'INDIVIDUAL', amount: 2000, status: 'USED', created_at: '2026-09-26T02:00:00.000Z' },
      { id: 'credit-B1', profile_id: jordanId, payment_id: 'payment-B', package_id: 'package-1', credit_type: 'INDIVIDUAL', amount: 2000, status: 'AVAILABLE', created_at: '2026-09-26T03:00:00.000Z' },
    ] as any;
    db.payments = [
      { id: 'payment-A', order_id: 'ORDER-A', profile_id: alexId, package_id: 'package-1', provider: 'FLEECA', amount: 2000, status: 'SUCCESS', created_at: '2026-09-26T01:00:00.000Z' },
      { id: 'payment-B', order_id: 'ORDER-B', profile_id: jordanId, package_id: 'package-1', provider: 'FLEECA', amount: 2000, status: 'SUCCESS', created_at: '2026-09-26T02:00:00.000Z' },
    ] as any;
  });

  test('credit history is scoped to signed active character and ignores query/cookie actor injection', async () => {
    const alexResponse = await getCredits(request(`/api/credits?profileId=${jordanId}`, alexId, jordanId));
    assert.equal(alexResponse.status, 200);
    const alexBody = await alexResponse.json();
    assert.deepEqual(alexBody.credits.map((credit: { id: string }) => credit.id).sort(), ['credit-A1', 'credit-A2']);

    const jordanResponse = await getCredits(request(`/api/credits?profileId=${alexId}`, jordanId, outsiderId));
    assert.deepEqual((await jordanResponse.json()).credits.map((credit: { id: string }) => credit.id), ['credit-B1']);

    const crossAccountSession = createSessionToken({ userId: otherAccountId, profileId: outsiderId, role: 'USER' });
    const crossAccount = await getCredits(new NextRequest(`http://localhost/api/credits?profileId=${alexId}`, { headers: { cookie: `sanboard_session=${crossAccountSession}` } }));
    assert.deepEqual((await crossAccount.json()).credits, []);
    assert.equal((await getCredits(request('/api/credits'))).status, 401);
  });

  test('payment history is scoped to signed active character and ignores query/cookie actor injection', async () => {
    const alexResponse = await getPayments(request(`/api/user/payments?profileId=${jordanId}`, alexId, jordanId));
    assert.deepEqual((await alexResponse.json()).map((payment: { id: string }) => payment.id), ['payment-A']);

    const jordanResponse = await getPayments(request(`/api/user/payments?profileId=${alexId}`, jordanId, outsiderId));
    assert.deepEqual((await jordanResponse.json()).map((payment: { id: string }) => payment.id), ['payment-B']);

    const crossAccountSession = createSessionToken({ userId: otherAccountId, profileId: outsiderId, role: 'USER' });
    const crossAccount = await getPayments(new NextRequest(`http://localhost/api/user/payments?profileId=${alexId}`, { headers: { cookie: `sanboard_session=${crossAccountSession}` } }));
    assert.deepEqual(await crossAccount.json(), []);
    assert.equal((await getPayments(request('/api/user/payments'))).status, 401);
  });

  test('character picker returns only provider-neutral summaries for the signed account', async () => {
    const response = await getCharacters(request('/api/user/characters', alexId));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.isTestIdentity, false);
    assert.equal(body.profiles, undefined);
    assert.deepEqual(body.characters.map((character: { displayName: string }) => character.displayName), ['Alex Stone', 'Jordan Reed', 'Morgan Hale']);
    assert.deepEqual(Object.keys(body.characters[0]).sort(), ['avatarUrl', 'displayName', 'id', 'role']);
    assert.equal(body.characters[0].id, alexId);
    assert.equal(body.characters[0].externalCharacterId, undefined);
    assert.equal(body.characters[0].user_id, undefined);
    assert.equal(body.characters[0].external_character_id, undefined);
  });
});