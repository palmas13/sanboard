import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { GET as getAdmin, POST as mutateAdmin } from '@/app/api/admin/route';
import { POST as createUserTicket } from '@/app/api/tickets/route';
import { GET as getUserTicketDetail } from '@/app/api/tickets/[id]/route';

const layoutSource = readFileSync('src/app/hesabim/layout.tsx', 'utf8');
const adminPageSource = readFileSync('src/app/yonetim/page.tsx', 'utf8');
const userTicketSource = readFileSync('src/app/hesabim/destek/[id]/page.tsx', 'utf8');

describe('dashboard sidebar and support conversation regressions', () => {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const adminProfileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function request(path: string, user: string, profile: string, sessionRole: 'USER' | 'ADMIN' = 'USER', body?: unknown) {
    return new NextRequest(`http://localhost${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: `sanboard_session=${createSessionToken({ userId: user, profileId: profile, role: sessionRole })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'dashboard-sidebar-support-secret';
    db.users = [
      { id: adminUserId, provider: 'GTAWORLD', role: 'ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: userId, provider: 'GTAWORLD', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.profiles = [
      { id: adminProfileId, user_id: adminUserId, full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: '', updated_at: '' },
      { id: userProfileId, user_id: userId, full_name: 'Zade Vexnera', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
    ];
    db.tickets = [];
    db.ticketMessages = [];
    db.notifications = [];
    db.auditLogs = [];
    db.listings = [];
    db.reports = [];
    db.dealers = [];
    db.applications = [];
    db.payments = [];
    db.packages = [];
  });

  test('sidebar removes logout and renders corporate identity only in the separated footer after resolution', () => {
    assert.doesNotMatch(layoutSource, /Çıkış Yap|LogOut|logout\(\)/);
    assert.match(layoutSource, /data-sidebar-footer="corporate"/);
    assert.match(layoutSource, /data-corporate-loading="true"/);
    assert.match(layoutSource, /corporateEligibility !== null/);
    assert.match(layoutSource, /corporateResolved && corporateLabel/);
    assert.match(layoutSource, /<span>\{corporateLabel\}<\/span>/);
  });

  test('corporate normal styling is neutral and active styling is route-derived', () => {
    assert.match(layoutSource, /pathname\.startsWith\('\/hesabim\/kurumsal\/'\)/);
    assert.match(layoutSource, /aria-current=\{isKurumsalPage \? 'page'/);
    assert.match(layoutSource, /isKurumsalPage[\s\S]*bg-\[var\(--brand-orange-subtle\)\]/);
    assert.match(layoutSource, /bg-\[var\(--bg-surface-secondary\)\]\/30/);
    assert.doesNotMatch(layoutSource, /bg-amber-400\/\[0\.055\]/);
  });

  test('ticket initial message and replies are chronological with server-derived display authors', async () => {
    const created = await createUserTicket(request('/api/tickets', userId, userProfileId, 'USER', { subject: 'Deneme', message: 'Deneme1.' }));
    assert.equal(created.status, 200);
    const ticketId = (await created.json()).ticket.id;
    assert.equal(db.ticketMessages.filter((message) => message.ticket_id === ticketId).length, 1);

    const replied = await mutateAdmin(request('/api/admin', adminUserId, adminProfileId, 'USER', {
      action: 'adminReplyTicket', payload: { ticketId, message: 'bwbwbwbw' },
    }));
    assert.equal(replied.status, 200);
    assert.equal(db.ticketMessages[1].sender_name, 'Mavis Pierce');
    assert.ok(db.auditLogs.some((entry) => entry.event_type === 'ADMIN_TICKET_REPLIED' && entry.profile_id === adminProfileId));

    const adminAggregate = await getAdmin(request('/api/admin', adminUserId, adminProfileId));
    const adminTicket = (await adminAggregate.json()).tickets.find((ticket: any) => ticket.id === ticketId);
    assert.deepEqual(adminTicket.messages.map((message: any) => message.message), ['Deneme1.', 'bwbwbwbw']);
    assert.deepEqual(adminTicket.messages.map((message: any) => message.display_author), ['Zade Vexnera', 'Sanboard Yönetim']);
    assert.deepEqual(adminTicket.messages.map((message: any) => message.author_type), ['USER', 'ADMIN']);

    const userDetail = await getUserTicketDetail(request(`/api/tickets/${ticketId}`, userId, userProfileId), { params: Promise.resolve({ id: ticketId }) });
    const userMessages = (await userDetail.json()).messages;
    assert.equal(userMessages[1].display_author, 'Sanboard Yönetim');
    assert.notEqual(userMessages[1].display_author, 'Mavis Pierce');
  });

  test('legacy message rows are normalized without changing stored sender identity', async () => {
    db.tickets = [{ id: 'legacy-ticket', profile_id: userProfileId, creator_name: 'Zade Vexnera', subject: 'Legacy', status: 'ANSWERED', created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:02:00.000Z' }];
    db.ticketMessages = [
      { id: 'late', ticket_id: 'legacy-ticket', sender_role: 'ADMIN', sender_name: 'Mavis Pierce', message: 'Yanıt', created_at: '2026-09-01T10:02:00.000Z' },
      { id: 'first', ticket_id: 'legacy-ticket', sender_role: 'USER', sender_name: 'Zade Vexnera', message: 'İlk mesaj', created_at: '2026-09-01T10:00:00.000Z' },
    ];
    const detail = await getUserTicketDetail(request('/api/tickets/legacy-ticket', userId, userProfileId), { params: Promise.resolve({ id: 'legacy-ticket' }) });
    const messages = (await detail.json()).messages;
    assert.deepEqual(messages.map((message: any) => message.id), ['first', 'late']);
    assert.equal(messages[0].display_author, 'Zade Vexnera');
    assert.equal(messages[1].display_author, 'Sanboard Yönetim');
    assert.equal(db.ticketMessages[0].sender_name, 'Mavis Pierce');
  });

  test('admin ticket aggregate remains DB-fresh ADMIN-only', async () => {
    assert.equal((await getAdmin(request('/api/admin', userId, userProfileId))).status, 403);
    db.users[0].role = 'USER';
    db.profiles[0].role = 'USER';
    assert.equal((await getAdmin(request('/api/admin', adminUserId, adminProfileId, 'ADMIN'))).status, 403);
  });

  test('both support views use the safe presentation author', () => {
    assert.match(userTicketSource, /msg\.display_author \|\| 'Sanboard Yönetim'/);
    assert.match(adminPageSource, /msg\.display_author \|\| 'Sanboard Yönetim'/);
    assert.doesNotMatch(adminPageSource, /msg\.sender_name\} \(Yönetim\)/);
    assert.match(adminPageSource, /aria-labelledby="ticket-dialog-title"/);
    assert.match(adminPageSource, /overflow-y-auto/);
    assert.match(adminPageSource, /Talebi Kapat/);
  });
});