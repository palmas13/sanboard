import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { GET as getAdmin, POST as mutateAdmin } from '@/app/api/admin/route';
import { GET as getAdminAudit } from '@/app/api/admin/audit/route';

describe('SANBOARD admin authorization and moderation package 1', () => {
  const accountX = '11111111-1111-4111-8111-111111111111';
  const accountY = '22222222-2222-4222-8222-222222222222';
  const adminA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const siblingB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const outsiderC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function request(
    path: string,
    profileId?: string,
    sessionRole: 'USER' | 'ADMIN' = 'USER',
    body?: unknown,
    extras: { roleCookie?: string; secret?: string; origin?: string } = {}
  ) {
    const cookies: string[] = [];
    if (profileId) {
      cookies.push(`sanboard_session=${createSessionToken({
        userId: profileId === outsiderC ? accountY : accountX,
        profileId,
        role: sessionRole,
      })}`);
    }
    if (extras.roleCookie) cookies.push(`sanboard_role=${extras.roleCookie}`);
    const headers: Record<string, string> = {};
    if (cookies.length) headers.cookie = cookies.join('; ');
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (extras.secret) headers['x-sanboard-secret'] = extras.secret;
    if (extras.origin) headers.origin = extras.origin;
    return new NextRequest(`http://localhost${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'admin-authorization-package-1-secret';
    process.env.SUPABASE_SECRET_KEY = 'must-not-authorize-browser-admin';
    db.users = [
      { id: accountX, provider: 'GTAWORLD', external_user_id: 'account-x', role: 'ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: accountY, provider: 'GTAWORLD', external_user_id: 'account-y', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.profiles = [
      { id: adminA, user_id: accountX, full_name: 'Character A', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: '', updated_at: '' },
      { id: siblingB, user_id: accountX, full_name: 'Character B', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
      { id: outsiderC, user_id: accountY, full_name: 'Character C', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
    ];
    db.tickets = [{ id: 'ticket-c', profile_id: outsiderC, creator_name: 'Character C', subject: 'Support', status: 'OPEN', created_at: '', updated_at: '' }];
    db.ticketMessages = [];
    db.reports = [{ id: 'report-1', reporter_profile_id: outsiderC, listing_id: 'listing-1', reason: 'Diğer', description: '', status: 'PENDING', created_at: '' }];
    db.listings = [{ id: 'listing-1', listing_number: '#1', seller_profile_id: outsiderC, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Listing', description: '', price: 1, location: null, status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.dealers = [{ id: 'store-1', profile_id: outsiderC, owner_profile_id: outsiderC, company_name: 'Store', description: '', logo_url: '', banner_url: '', status: 'APPROVED', subscription_status: 'ACTIVE', subscription_expires_at: '2027-01-01T00:00:00.000Z', moderation_status: 'ACTIVE', boost_credits: 2, created_at: '', updated_at: '' }];
    db.applications = [{ id: 'application-1', applicant_profile_id: siblingB, company_name: 'Pending Store', purpose: 'Trade', status: 'PENDING', created_at: '' }];
    db.followers = [];
    db.notifications = [];
    db.payments = [];
    db.credits = [];
    db.auditLogs = [];
    db.notifications = [];
    db.auditLogs = [];
    db.payments = [];
    db.favorites = [];
    db.credits = [];
  });

  test('admin access is character-scoped and ignores role/profile injection', async () => {
    assert.equal((await getAdmin(request('/api/admin', adminA, 'USER'))).status, 200);
    assert.equal((await getAdmin(request('/api/admin?role=ADMIN&profileId=' + adminA, siblingB, 'ADMIN', undefined, { roleCookie: 'ADMIN' }))).status, 403);
    assert.equal((await getAdmin(request('/api/admin', outsiderC, 'ADMIN'))).status, 403);
    assert.equal((await getAdmin(request('/api/admin'))).status, 401);
  });

  test('stale signed ADMIN role is denied when the DB-fresh character role is USER', async () => {
    assert.equal((await getAdmin(request('/api/admin', siblingB, 'ADMIN'))).status, 403);
    assert.equal((await getAdminAudit(request('/api/admin/audit', siblingB, 'ADMIN'))).status, 403);
    assert.equal((await getAdminAudit(request('/api/admin/audit', adminA, 'USER'))).status, 200);
  });

  test('a banned account cannot retain admin access through a stale signed session', async () => {
    db.users[0].status = 'BANNED';
    assert.equal((await getAdmin(request('/api/admin', adminA, 'ADMIN'))).status, 403);
  });

  test('the former Supabase secret header cannot authorize a browser admin request', async () => {
    const response = await getAdmin(request('/api/admin', undefined, 'USER', undefined, { secret: process.env.SUPABASE_SECRET_KEY }));
    assert.equal(response.status, 401);
  });

  test('admin ticket reply and status use the canonical admin character identity', async () => {
    const reply = await mutateAdmin(request('/api/admin', adminA, 'USER', {
      action: 'adminReplyTicket',
      role: 'USER',
      profileId: siblingB,
      payload: { ticketId: 'ticket-c', message: 'Reviewed', senderRole: 'USER', senderName: 'Injected' },
    }));
    assert.equal(reply.status, 200);
    assert.equal(db.ticketMessages[0].sender_role, 'ADMIN');
    assert.equal(db.ticketMessages[0].sender_name, 'Character A');
    assert.equal(db.tickets[0].status, 'ANSWERED');

    const status = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'updateTicket', payload: { ticketId: 'ticket-c', status: 'CLOSED' } }));
    assert.equal(status.status, 200);
    assert.equal(db.tickets[0].status, 'CLOSED');
    assert.ok(db.auditLogs.some((item) => item.event_type === 'ADMIN_TICKET_REPLIED' && item.profile_id === adminA));
    assert.ok(db.auditLogs.some((item) => item.event_type === 'ADMIN_TICKET_STATUS_CHANGED' && item.profile_id === adminA));
  });

  test('USER characters cannot perform ticket, listing, report or store moderation', async () => {
    for (const body of [
      { action: 'adminReplyTicket', payload: { ticketId: 'ticket-c', message: 'Attack' } },
      { action: 'delist', payload: { listingId: 'listing-1' } },
      { action: 'updateReport', payload: { reportId: 'report-1', status: 'RESOLVED' } },
      { action: 'suspendStore', payload: { dealerId: 'store-1', reason: 'Attack' } },
    ]) {
      const response = await mutateAdmin(request('/api/admin', siblingB, 'ADMIN', { ...body, role: 'ADMIN', profileId: adminA }, { roleCookie: 'ADMIN' }));
      assert.equal(response.status, 403);
    }
    assert.equal(db.listings[0].status, 'ACTIVE');
    assert.equal(db.reports[0].status, 'PENDING');
    assert.equal(db.dealers[0].moderation_status, 'ACTIVE');
    assert.equal(db.ticketMessages.length, 0);
  });

  test('ADMIN can moderate listing, report and store with canonical audit attribution', async () => {
    assert.equal((await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'delist', payload: { listingId: 'listing-1' } }))).status, 200);
    assert.equal((await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'updateReport', payload: { reportId: 'report-1', status: 'RESOLVED' } }))).status, 200);
    assert.equal((await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'suspendStore', payload: { dealerId: 'store-1', reason: 'Policy' } }))).status, 200);
    assert.equal(db.listings[0].status, 'REMOVED');
    assert.equal(db.reports[0].status, 'RESOLVED');
    assert.equal(db.dealers[0].moderation_status, 'SUSPENDED');
    assert.equal(db.dealers[0].suspended_by_profile_id, adminA);
    assert.ok(db.auditLogs.some((item) => item.event_type === 'ADMIN_LISTING_DELISTED' && item.profile_id === adminA));
    assert.ok(db.auditLogs.some((item) => item.event_type === 'ADMIN_REPORT_STATUS_CHANGED' && item.profile_id === adminA));
    assert.ok(db.auditLogs.some((item) => item.event_type === 'CORPORATE_STORE_SUSPENDED' && item.profile_id === adminA));
  });

  test('application approval does not grant a free subscription, expiry or boost entitlement', async () => {
    const response = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'approveApplication', payload: { applicationId: 'application-1' } }));
    assert.equal(response.status, 200);
    const store = db.dealers.find((item) => item.owner_profile_id === siblingB);
    assert.ok(store);
    assert.equal(store.subscription_status, 'INACTIVE');
    assert.equal(store.subscription_expires_at, undefined);
    assert.equal(store.boost_credits, 0);
    assert.equal(db.applications[0].reviewed_by, accountX);
    assert.equal(db.applications[0].status, 'APPROVED');
    assert.equal(store.status, 'APPROVED');
    assert.equal(store.moderation_status, 'ACTIVE');
    assert.equal(db.notifications.at(-1)?.type, 'CORPORATE_APPLICATION_APPROVED');

    const aggregate = await getAdmin(request('/api/admin', adminA));
    const body = await aggregate.json();
    assert.equal(body.applications.some((item: any) => item.id === 'application-1'), false);
    assert.equal(body.dealers.some((item: any) => item.id === store.id), true);
  });

  test('admin manually activates an inactive corporate membership without creating payment history', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    db.dealers[0].subscription_expires_at = null;
    db.dealers[0].boost_credits = 0;
    const paymentsBefore = db.payments.length;
    const creditsBefore = db.credits.length;

    const response = await mutateAdmin(request('/api/admin', adminA, 'USER', {
      action: 'manuallyActivateCorporateSubscription',
      payload: { dealerId: 'store-1' },
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(db.dealers[0].subscription_status, 'ACTIVE');
    assert.equal(db.dealers[0].current_period_start, body.activatedAt);
    assert.equal(db.dealers[0].current_period_end, db.dealers[0].subscription_expires_at);
    assert.equal(db.dealers[0].boost_credits, 3);
    assert.equal(db.payments.length, paymentsBefore);
    assert.equal(db.credits.length, creditsBefore);
    assert.equal(db.notifications.at(-1)?.type, 'SYSTEM');
    assert.equal(db.notifications.at(-1)?.metadata?.source, 'ADMIN_GRANT');
    assert.equal(db.auditLogs.at(-1)?.event_type, 'CORPORATE_SUBSCRIPTION_MANUAL_ACTIVATION');
    assert.equal(db.auditLogs.at(-1)?.profile_id, adminA);
    assert.equal(db.auditLogs.at(-1)?.metadata?.targetId, 'store-1');
  });

  test('manual activation is admin-only, idempotent for active membership, and does not change moderation', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    db.dealers[0].subscription_expires_at = null;
    db.dealers[0].moderation_status = 'SUSPENDED';

    const forbidden = await mutateAdmin(request('/api/admin', outsiderC, 'USER', {
      action: 'manuallyActivateCorporateSubscription', payload: { dealerId: 'store-1' },
    }));
    assert.equal(forbidden.status, 403);
    assert.equal(db.dealers[0].subscription_status, 'INACTIVE');

    const first = await mutateAdmin(request('/api/admin', adminA, 'USER', {
      action: 'manuallyActivateCorporateSubscription', payload: { dealerId: 'store-1' },
    }));
    assert.equal(first.status, 200);
    assert.equal(db.dealers[0].moderation_status, 'SUSPENDED');
    const expiry = db.dealers[0].subscription_expires_at;
    const notificationCount = db.notifications.length;

    const replay = await mutateAdmin(request('/api/admin', adminA, 'USER', {
      action: 'manuallyActivateCorporateSubscription', payload: { dealerId: 'store-1' },
    }));
    assert.equal(replay.status, 400);
    assert.equal(db.dealers[0].subscription_expires_at, expiry);
    assert.equal(db.notifications.length, notificationCount);
  });

  test('application review validates input and cannot review the same application twice', async () => {
    const missingId = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'approveApplication', payload: {} }));
    assert.equal(missingId.status, 400);
    const missingReason = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'rejectApplication', payload: { applicationId: 'application-1', rejectionReason: '   ' } }));
    assert.equal(missingReason.status, 400);
    const approved = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'approveApplication', payload: { applicationId: 'application-1' } }));
    assert.equal(approved.status, 200);
    const reviewedAgain = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'rejectApplication', payload: { applicationId: 'application-1', rejectionReason: 'Duplicate' } }));
    assert.equal(reviewedAgain.status, 400);
    assert.equal(db.applications[0].status, 'APPROVED');
  });

  test('admin aggregate enriches users and reports from the same response source', async () => {
    db.tickets.push({ id: 'ticket-answered', profile_id: outsiderC, creator_name: 'Character C', subject: 'Answered', status: 'ANSWERED', created_at: '', updated_at: '' });
    const response = await getAdmin(request('/api/admin', adminA));
    const body = await response.json();
    assert.deepEqual(body.summary, body.stats);
    assert.equal(body.stats.totalUsers, 3);
    assert.equal(body.stats.totalUsers, body.summary.totalProfiles);
    assert.equal(body.summary.totalProfiles, 3);
    assert.equal(body.summary.totalCharacters, 3);
    assert.equal(body.summary.activeListings, 1);
    assert.equal(body.summary.corporateProfiles, 1);
    assert.equal(body.summary.pendingCorporateApplications, 1);
    assert.equal(body.summary.openTickets, 1, 'ANSWERED waits on the requester and is not admin-open');
    assert.equal(body.summary.openReports, 1);
    assert.equal(body.users.find((item: any) => item.user.id === accountY).characters[0].full_name, 'Character C');
    assert.equal(body.reports[0].reporter.full_name, 'Character C');
    assert.equal(body.reports[0].listing.title, 'Listing');
    assert.equal(body.reports[0].listing.owner.full_name, 'Character C');
  });

  test('admin mutations reject an explicit cross-origin request', async () => {
    const response = await mutateAdmin(request('/api/admin', adminA, 'USER', { action: 'updateReport', payload: { reportId: 'report-1', status: 'RESOLVED' } }, { origin: 'https://attacker.example' }));
    assert.equal(response.status, 403);
    assert.equal(db.reports[0].status, 'PENDING');
  });
});