import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { db } from '@/lib/db/store';
import { GET as getAdmin } from '@/app/api/admin/route';
import { POST as createTicket } from '@/app/api/tickets/route';
import { calculateListingQuality } from '@/lib/listings/quality';
import { getTicketCategoryLabel, TICKET_CATEGORIES } from '@/lib/tickets/categories';

describe('admin work queue, support categories and listing quality', () => {
  const adminUser = '11111111-1111-4111-8111-111111111111';
  const user = '22222222-2222-4222-8222-222222222222';
  const adminProfile = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userProfile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const request = (path: string, profileId: string, userId: string, body?: unknown) => new NextRequest(`http://localhost${path}`, {
    method: body ? 'POST' : 'GET', headers: { cookie: `sanboard_session=${createSessionToken({ userId, profileId, role: 'USER' })}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });

  beforeEach(() => {
    process.env.DATA_STORE = 'memory'; process.env.SANBOARD_SESSION_SECRET = 'queue-category-quality-secret-32-bytes-minimum';
    db.users = [{ id: adminUser, provider: 'GTAWORLD', role: 'ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' }, { id: user, provider: 'GTAWORLD', role: 'USER', status: 'ACTIVE', created_at: '', updated_at: '' }];
    db.profiles = [{ id: adminProfile, user_id: adminUser, full_name: 'Admin', avatar_url: '', sanmail_email: '', phone: '', role: 'ADMIN', created_at: '', updated_at: '' }, { id: userProfile, user_id: user, full_name: 'User', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: '', updated_at: '' }];
    db.applications = [{ id: 'pending', applicant_profile_id: userProfile, company_name: 'Bum Motors', purpose: '', status: 'PENDING', created_at: '' }, { id: 'rejected', applicant_profile_id: userProfile, company_name: 'Old', purpose: '', status: 'REJECTED', created_at: '' }];
    db.tickets = [{ id: 'open', profile_id: userProfile, creator_name: 'User', subject: 'Open', status: 'OPEN', created_at: '', updated_at: '' }, { id: 'answered', profile_id: userProfile, creator_name: 'User', subject: 'Answered', status: 'ANSWERED', created_at: '', updated_at: '' }, { id: 'closed', profile_id: userProfile, creator_name: 'User', subject: 'Closed', status: 'CLOSED', created_at: '', updated_at: '' }];
    db.reports = [{ id: 'pending-report', reporter_profile_id: userProfile, listing_id: 'missing', reason: 'Diğer', description: '', status: 'PENDING', created_at: '' }, { id: 'resolved-report', reporter_profile_id: userProfile, listing_id: 'missing', reason: 'Diğer', description: '', status: 'RESOLVED', created_at: '' }];
    db.ticketMessages = []; db.listings = []; db.dealers = []; db.payments = []; db.packages = []; db.auditLogs = [];
  });

  test('queue counts only actionable statuses', async () => {
    const body = await (await getAdmin(request('/api/admin', adminProfile, adminUser))).json();
    assert.equal(body.summary.pendingCorporateApplications, 1); assert.equal(body.summary.openTickets, 1); assert.equal(body.summary.openReports, 1);
  });

  test('category is required and every category can be created', async () => {
    assert.equal((await createTicket(request('/api/tickets', userProfile, user, { subject: 'x', message: 'y' }))).status, 400);
    for (const item of TICKET_CATEGORIES) { const response = await createTicket(request('/api/tickets', userProfile, user, { category: item.value, subject: item.label, message: 'Detay' })); assert.equal(response.status, 200); assert.equal((await response.json()).ticket.category, item.value); }
  });

  test('legacy category falls back safely', () => assert.equal(getTicketCategoryLabel(null), 'Diğer'));

  test('quality reacts to completion and category-specific omissions', () => {
    const empty = calculateListingQuality({ category: 'vehicle', imageCount: 0 });
    const improved = calculateListingQuality({ category: 'vehicle', title: 'Araç', price: 100, subcategory: 'Otomobil', description: 'Detay', imageCount: 3, brand: 'Bravado', model: 'Buffalo', fuelType: 'BENZIN', hasContact: true });
    assert.ok(empty.percentage < 50); assert.ok(improved.percentage > empty.percentage); assert.ok(improved.suggestions.includes('Mil bilgisini ekle.'));
    assert.ok(calculateListingQuality({ category: 'property', title: 'Ev', price: 100, imageCount: 1 }).suggestions.includes('Mülkün konumunu belirt.'));
  });

  test('UI contains queue, filter, draft/preview quality and no public score', () => {
    const admin = readFileSync('src/app/yonetim/page.tsx', 'utf8'); const create = readFileSync('src/app/ilan-ver/yeni/page.tsx', 'utf8'); const dashboard = readFileSync('src/app/hesabim/ilanlarim/page.tsx', 'utf8'); const publicPage = readFileSync('src/app/ilan/[id]/page.tsx', 'utf8');
    assert.match(admin, /İlgilenmeniz Gerekenler/); assert.match(admin, /Şu an ilgilenmeniz gereken bir işlem yok/); assert.match(admin, /setActiveTab\(item\.id\)/); assert.match(admin, /ticketCategoryFilter/);
    assert.equal((create.match(/<ListingQualityIndicator/g) || []).length, 1); assert.match(create, /setStep\(4\)/); assert.match(create, /setStep\(3\)/); assert.match(create, /step === 4/); assert.match(dashboard, /Düzenlemeye Devam Et/); assert.match(dashboard, /sanboard_listing_draft_v2_/);
    assert.doesNotMatch(publicPage, /ListingQualityIndicator|İlan Tamamlanma/);
  });
});