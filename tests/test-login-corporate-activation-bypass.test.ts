import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { POST as activateSubscription } from '@/app/api/dealers/subscription/activate/route';
import { TEST_LOGIN_FIXTURE_ACCOUNT_ID, TEST_LOGIN_CHARACTER_PREFIX } from '@/lib/auth/test-login';

describe('canonical test-login corporate subscription bypass', () => {
  const now = new Date('2026-09-29T12:00:00.000Z').toISOString();
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const testProfileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const normalUserId = '22222222-2222-4222-8222-222222222222';
  const normalProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.ENABLE_TEST_LOGIN = 'true';
    process.env.SANBOARD_SESSION_SECRET = 'test-login-corporate-bypass-secret';
    db.users = [
      { id: testUserId, provider: 'GTAWORLD', external_user_id: TEST_LOGIN_FIXTURE_ACCOUNT_ID, role: 'USER', status: 'ACTIVE', created_at: now, updated_at: now },
      { id: normalUserId, provider: 'GTAWORLD', external_user_id: 'real-account', role: 'ADMIN', status: 'ACTIVE', created_at: now, updated_at: now },
    ];
    db.profiles = [
      { id: testProfileId, user_id: testUserId, external_character_id: `${TEST_LOGIN_CHARACTER_PREFIX}mavis-pierce`, full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: now, updated_at: now },
      { id: normalProfileId, user_id: normalUserId, external_character_id: 'real-mavis-character', full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: now, updated_at: now },
    ] as any;
    db.dealers = [
      { id: 'test-dealer', profile_id: testProfileId, owner_profile_id: testProfileId, company_name: 'Test Gallery', description: '', logo_url: '', banner_url: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'INACTIVE', subscription_expires_at: null, created_at: now, updated_at: now },
      { id: 'real-dealer', profile_id: normalProfileId, owner_profile_id: normalProfileId, company_name: 'Real Gallery', description: '', logo_url: '', banner_url: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'INACTIVE', subscription_expires_at: null, created_at: now, updated_at: now },
    ] as any;
    db.auditLogs = [];
  });

  function request(userId: string, profileId: string, dealerId: string, extra: Record<string, unknown> = {}) {
    const token = createSessionToken({ userId, profileId, role: 'ADMIN' });
    return new NextRequest('http://localhost/api/dealers/subscription/activate', {
      method: 'POST',
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ dealerId, ...extra }),
    });
  }

  test('canonical test owner activates without payment and receives an audited active period', async () => {
    const response = await activateSubscription(request(testUserId, testProfileId, 'test-dealer'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.testActivationBypass, true);
    assert.equal(body.dealer.subscription_status, 'ACTIVE');
    assert.ok(new Date(body.dealer.subscription_expires_at).getTime() > Date.now());
    assert.equal(db.auditLogs.at(-1)?.event_type, 'TEST_CORPORATE_SUBSCRIPTION_BYPASS');
    assert.equal(db.auditLogs.at(-1)?.metadata?.charged, false);
  });

  test('real owner remains payment-required even with admin role and injected bypass flags', async () => {
    const response = await activateSubscription(request(normalUserId, normalProfileId, 'real-dealer', { isTest: true, skipPayment: true, testActivationBypass: true }));
    assert.equal(response.status, 409);
    assert.equal(db.dealers[1].subscription_status, 'INACTIVE');
    assert.equal(db.auditLogs.length, 0);
  });

  test('active character ownership is still required before test identity is considered', async () => {
    const response = await activateSubscription(request(testUserId, testProfileId, 'real-dealer'));
    assert.equal(response.status, 403);
    assert.equal(db.dealers[1].subscription_status, 'INACTIVE');
  });

  test('corporate dashboard probes the server-side activation route before checkout', () => {
    const dashboard = readFileSync(join(process.cwd(), 'src/app/hesabim/kurumsal/page.tsx'), 'utf8');
    assert.match(dashboard, /fetch\('\/api\/dealers\/subscription\/activate'/);
    assert.match(dashboard, /JSON\.stringify\(\{ dealerId: dealer\.id \}\)/);
    assert.match(dashboard, /activationRes\.status !== 409/);
    assert.doesNotMatch(dashboard, /skipPayment|isTest: true/);
  });
});