import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST as createReport } from '@/app/api/reports/route';
import { GET as getAdmin } from '@/app/api/admin/route';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';

describe('listing report end-to-end flow', () => {
  const userAccount = '11111111-1111-4111-8111-111111111111';
  const adminAccount = '22222222-2222-4222-8222-222222222222';
  const reporterId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const adminId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const listingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  function request(path: string, accountId: string, profileId: string, body?: unknown) {
    return new NextRequest(`http://localhost${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: `sanboard_session=${createSessionToken({ userId: accountId, profileId, role: 'USER' })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'report-flow-secret-at-least-32-bytes';
    db.users = [
      { id: userAccount, provider: 'GTAWORLD', external_user_id: 'user', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: adminAccount, provider: 'GTAWORLD', external_user_id: 'admin', role: 'ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
    db.profiles = [
      { id: reporterId, user_id: userAccount, full_name: 'Reporter Character', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
      { id: ownerId, user_id: userAccount, full_name: 'Listing Owner', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' },
      { id: adminId, user_id: adminAccount, full_name: 'Fresh Admin', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: '', updated_at: '' },
    ];
    db.listings = [{ id: listingId, public_id: '123456', listing_number: '#SB-123456', seller_profile_id: ownerId, seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil', title: 'Reported Listing', description: '', price: 1, location: null, status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.reports = [];
    db.tickets = []; db.ticketMessages = []; db.dealers = []; db.applications = [];
    db.payments = []; db.packages = []; db.favorites = []; db.auditLogs = [];
  });

  test('USER creates a canonical pending report and ADMIN aggregate exposes it everywhere', async () => {
    const response = await createReport(request('/api/reports', userAccount, reporterId, {
      listingId,
      reporterProfileId: ownerId,
      reason: 'Şüpheli ilan',
      description: 'Fiyat ve içerik şüpheli görünüyor.',
    }));
    assert.equal(response.status, 201);
    assert.equal(db.reports.length, 1);
    assert.equal(db.reports[0].reporter_profile_id, reporterId);
    assert.equal(db.reports[0].listing_id, listingId);
    assert.equal(db.reports[0].reason, 'Şüpheli ilan');
    assert.equal(db.reports[0].description, 'Fiyat ve içerik şüpheli görünüyor.');
    assert.equal(db.reports[0].status, 'PENDING');
    assert.ok(db.reports[0].created_at);

    const adminResponse = await getAdmin(request('/api/admin', adminAccount, adminId));
    assert.equal(adminResponse.status, 200);
    const admin = await adminResponse.json();
    assert.equal(admin.summary.openReports, 1);
    assert.equal(admin.stats.openReports, 1);
    assert.equal(admin.reports.length, 1);
    assert.equal(admin.reports[0].reporter.full_name, 'Reporter Character');
    assert.equal(admin.reports[0].listing.title, 'Reported Listing');
    assert.equal(admin.reports[0].listing.owner.full_name, 'Listing Owner');
  });

  test('invalid reports do not insert and a normal USER cannot read admin reports', async () => {
    const invalidReason = await createReport(request('/api/reports', userAccount, reporterId, { listingId, reason: 'INVALID', description: 'x' }));
    const emptyDescription = await createReport(request('/api/reports', userAccount, reporterId, { listingId, reason: 'Diğer', description: '   ' }));
    const publicIdInsteadOfUuid = await createReport(request('/api/reports', userAccount, reporterId, { listingId: '123456', reason: 'Diğer', description: 'Açıklama' }));
    assert.equal(invalidReason.status, 400);
    assert.equal(emptyDescription.status, 400);
    assert.equal(publicIdInsteadOfUuid.status, 400);
    assert.equal(db.reports.length, 0);
    assert.equal((await getAdmin(request('/api/admin', userAccount, reporterId))).status, 403);
  });

  test('Supabase implementation inserts into public reports and verifies the returned row', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/db/listings.ts'), 'utf8');
    const reportSource = source.slice(source.indexOf('export async function reportListing'));
    assert.match(reportSource, /from\('reports'\)[\s\S]*\.insert\(\{[\s\S]*reporter_profile_id:[\s\S]*listing_id:[\s\S]*status: 'PENDING'/);
    assert.match(reportSource, /\.select\('id, reporter_profile_id, listing_id, reason, description, status, created_at'\)[\s\S]*\.single\(\)/);
  });
});