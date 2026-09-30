import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { GET, DELETE } from '@/app/api/notifications/route';

const userId = '11111111-1111-4111-8111-111111111111';
const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function request(path: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { cookie: `sanboard_session=${createSessionToken({ userId, profileId, role: 'USER' })}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('notification pagination and deletion', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'notification-test-secret-at-least-32-bytes';
    db.users = [{ id: userId, provider: 'GTAWORLD', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.profiles = [{ id: profileId, user_id: userId, full_name: 'Owner', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' }];
    db.notifications = Array.from({ length: 12 }, (_, i) => ({ id: `n-${i}`, recipient_profile_id: profileId, type: 'SYSTEM', title: `N${i}`, message: '', read_at: i < 2 ? null : new Date().toISOString(), created_at: new Date(Date.UTC(2026, 0, 12 - i)).toISOString() } as any));
    db.notifications.push({ id: 'foreign', recipient_profile_id: otherProfileId, type: 'SYSTEM', title: 'Foreign', message: '', read_at: null, created_at: new Date().toISOString() } as any);
  });

  test('serves five at a time with authoritative counts', async () => {
    const first = await GET(request('/api/notifications?offset=0&limit=5'));
    const data = await first.json();
    assert.deepEqual(data.notifications.map((n: any) => n.id), ['n-0', 'n-1', 'n-2', 'n-3', 'n-4']);
    assert.equal(data.totalCount, 12);
    assert.equal(data.unreadCount, 2);
    assert.equal(data.hasMore, true);
  });

  test('single/bulk/clear deletion is owner-scoped and offsets remain usable after deletion', async () => {
    let response = await DELETE(request('/api/notifications', 'DELETE', { notificationId: 'n-1' }));
    let data = await response.json();
    assert.equal(data.count, 1);
    assert.equal(data.totalCount, 11);

    response = await DELETE(request('/api/notifications', 'DELETE', { notificationIds: ['foreign'] }));
    data = await response.json();
    assert.equal(data.count, 0);
    assert.equal(data.totalCount, 11);
    assert.ok(db.notifications.some((n) => n.id === 'foreign'));

    const page = await GET(request('/api/notifications?offset=5&limit=5'));
    assert.deepEqual((await page.json()).notifications.map((n: any) => n.id), ['n-6', 'n-7', 'n-8', 'n-9', 'n-10']);

    response = await DELETE(request('/api/notifications', 'DELETE', {}));
    data = await response.json();
    assert.equal(data.count, 11);
    assert.equal(data.totalCount, 0);
    assert.ok(db.notifications.some((n) => n.id === 'foreign'));
  });
});
