import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { POST as createListing } from '@/app/api/listings/route';
import { GET as getOwnListing, PUT as updateOwnListing } from '@/app/api/user/listings/[id]/route';
import { GET as getTickets, POST as createTicket } from '@/app/api/tickets/route';
import { GET as getTicket, POST as replyTicket } from '@/app/api/tickets/[id]/route';
import { GET as getApplication, POST as apply } from '@/app/api/dealers/apply/route';
import { GET as getEligibility } from '@/app/api/dealers/eligibility/route';
import { GET as getPrivateProfile, PUT as updatePrivateProfile } from '@/app/api/user/profile/route';
import { GET as getPublicProfile } from '@/app/api/profiles/[id]/route';

describe('SANBOARD generic character isolation package 2', () => {
  const accountX = '11111111-1111-4111-8111-111111111111';
  const accountY = '22222222-2222-4222-8222-222222222222';
  const alex = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const jordan = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const morgan = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function request(
    path: string,
    profileId?: string,
    init: { method?: string; headers?: Record<string, string>; body?: string } = {},
    routingProfileId?: string
  ) {
    const cookies: string[] = [];
    if (profileId) cookies.push(`sanboard_session=${createSessionToken({ userId: profileId === morgan ? accountY : accountX, profileId, role: 'USER' })}`);
    if (routingProfileId) cookies.push(`sanboard_profile_id=${routingProfileId}`, 'sanboard_role=ADMIN');
    return new NextRequest(`http://localhost${path}`, {
      ...init,
      headers: { ...(init.headers || {}), ...(cookies.length ? { cookie: cookies.join('; ') } : {}) },
    });
  }

  const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'generic-character-isolation-package-2-secret';
    db.users = [
      { id: accountX, provider: 'GTAWORLD', external_user_id: 'account-x', role: 'USER', status: 'ACTIVE', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: accountY, provider: 'GTAWORLD', external_user_id: 'account-y', role: 'USER', status: 'ACTIVE', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
    ];
    db.profiles = [
      { id: alex, user_id: accountX, full_name: 'Alex Stone', avatar_url: '/alex.webp', sanmail_email: 'alex@sanmail.test', phone: '1001', role: 'USER', public_id: 101, created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: jordan, user_id: accountX, full_name: 'Jordan Reed', avatar_url: '', sanmail_email: 'jordan@sanmail.test', phone: '1002', role: 'USER', public_id: 102, created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: morgan, user_id: accountY, full_name: 'Morgan Hale', avatar_url: '', sanmail_email: 'morgan@sanmail.test', phone: '2001', role: 'USER', public_id: 201, created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
    ];
    db.listings = [
      { id: 'listing-alex', listing_number: '#A', seller_profile_id: alex, category: 'vehicle', subcategory: 'Otomobil', title: 'Alex Vehicle', description: 'Alex listing', price: 1000, status: 'ACTIVE', seller_type: 'INDIVIDUAL', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z', expires_at: '2026-10-03T00:00:00.000Z', images: [] },
      { id: 'listing-jordan', listing_number: '#B', seller_profile_id: jordan, category: 'vehicle', subcategory: 'Otomobil', title: 'Jordan Vehicle', description: 'Jordan listing', price: 2000, status: 'ACTIVE', seller_type: 'INDIVIDUAL', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z', expires_at: '2026-10-03T00:00:00.000Z', images: [] },
    ] as any;
    db.credits = [{ id: 'credit-alex', profile_id: alex, package_id: 'pkg-standard-7-day', status: 'AVAILABLE', credit_type: 'INDIVIDUAL', created_at: '2026-09-26T00:00:00.000Z' }] as any;
    db.tickets = [
      { id: 'ticket-alex', profile_id: alex, creator_name: 'Alex Stone', subject: 'Alex ticket', status: 'OPEN', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
      { id: 'ticket-jordan', profile_id: jordan, creator_name: 'Jordan Reed', subject: 'Jordan ticket', status: 'OPEN', created_at: '2026-09-26T00:00:00.000Z', updated_at: '2026-09-26T00:00:00.000Z' },
    ];
    db.ticketMessages = [];
    db.applications = [{ id: 'app-alex', applicant_profile_id: alex, company_name: 'Alex Corp', purpose: 'Trade', status: 'PENDING', created_at: '2026-09-26T00:00:00.000Z' }];
    db.dealers = [];
  });

  test('listing create/edit/private read use the signed active character', async () => {
    const payload = { sellerProfileId: jordan, category: 'vehicle', subcategory: 'Otomobil', title: 'Signed actor listing', description: 'Created by Alex', price: 5000, images: [{ storage_path: '/x.webp', sort_order: 0, is_cover: true, size_bytes: 100 }], brand: 'Karin', model: 'Sultan', plate: 'ALEX1', mileage: 1, engine_upgrade: 0, transmission_upgrade: 0, brake_upgrade: 0, turbo: false, subwoofer: false, trade_available: false };
    const created = await createListing(request('/api/listings', alex, json(payload), jordan));
    assert.equal(created.status, 200);
    assert.equal((await created.json()).listing.seller_profile_id, alex);

    assert.equal((await getOwnListing(request(`/api/user/listings/listing-alex?profileId=${jordan}`, alex, {}, jordan), { params: Promise.resolve({ id: 'listing-alex' }) })).status, 200);
    assert.equal((await getOwnListing(request('/api/user/listings/listing-jordan', alex), { params: Promise.resolve({ id: 'listing-jordan' }) })).status, 403);
    const denied = await updateOwnListing(request('/api/user/listings/listing-jordan', alex, { ...json({ profileId: jordan, title: 'Attack' }), method: 'PUT' }), { params: Promise.resolve({ id: 'listing-jordan' }) });
    assert.equal(denied.status, 403);
    assert.equal((await createListing(request('/api/listings', undefined, json(payload)))).status, 401);
  });

  test('ticket owner and user sender identity are server-derived', async () => {
    const list = await getTickets(request(`/api/tickets?profileId=${jordan}`, alex, {}, jordan));
    assert.deepEqual((await list.json()).map((ticket: any) => ticket.id), ['ticket-alex']);
    assert.equal((await getTicket(request('/api/tickets/ticket-jordan', alex), { params: Promise.resolve({ id: 'ticket-jordan' }) })).status, 403);

    const created = await createTicket(request('/api/tickets', alex, json({ profileId: jordan, creatorName: 'Fake', category: 'ACCOUNT_CHARACTER', subject: 'Subject', message: 'Message' }), jordan));
    const createdBody = await created.json();
    assert.equal(createdBody.ticket.profile_id, alex);
    assert.equal(createdBody.ticket.creator_name, 'Alex Stone');

    const reply = await replyTicket(request('/api/tickets/ticket-alex', alex, json({ senderRole: 'ADMIN', senderName: 'Fake Admin', message: 'Hello' }), jordan), { params: Promise.resolve({ id: 'ticket-alex' }) });
    assert.equal(reply.status, 200);
    const message = (await reply.json()).message;
    assert.equal(message.sender_role, 'USER');
    assert.equal(message.sender_name, 'Alex Stone');
    assert.equal((await replyTicket(request('/api/tickets/ticket-jordan', alex, json({ message: 'Attack' })), { params: Promise.resolve({ id: 'ticket-jordan' }) })).status, 403);
  });

  test('corporate application and eligibility are isolated to the active character', async () => {
    const alexApp = await getApplication(request(`/api/dealers/apply?profileId=${jordan}`, alex, {}, jordan));
    assert.equal((await alexApp.json()).application.id, 'app-alex');
    const jordanApp = await getApplication(request(`/api/dealers/apply?profileId=${alex}`, jordan, {}, alex));
    assert.equal((await jordanApp.json()).application, null);
    const applied = await apply(request('/api/dealers/apply', jordan, json({ applicantProfileId: alex, profileId: alex, companyName: 'Jordan Corp', contactPhone: '555123', contactEmail: 'jordan@sanmail.com', location: 'Downtown, Los Santos', purpose: 'Vehicle sales and verified physical dealership operations in Los Santos.' }), alex));
    assert.equal((await applied.json()).application.applicant_profile_id, jordan);
    assert.equal((await getEligibility(request(`/api/dealers/eligibility?profileId=${alex}`, jordan, {}, alex))).status, 200);
    assert.equal((await getEligibility(request('/api/dealers/eligibility'))).status, 401);
  });

  test('private profile ignores target injection and public profile returns a safe DTO', async () => {
    const privateResponse = await getPrivateProfile(request(`/api/user/profile?profileId=${jordan}`, alex, {}, jordan));
    const privateProfile = (await privateResponse.json()).profile;
    assert.equal(privateProfile.id, alex);
    assert.equal(privateProfile.user_id, undefined);
    assert.equal(privateProfile.external_character_id, undefined);

    const updated = await updatePrivateProfile(request('/api/user/profile', alex, { ...json({ profileId: jordan, phone: '9999' }), method: 'PUT' }, jordan));
    assert.equal((await updated.json()).profile.id, alex);
    assert.equal(db.profiles.find((profile) => profile.id === alex)?.phone, '9999');
    assert.equal(db.profiles.find((profile) => profile.id === jordan)?.phone, '1002');

    const publicResponse = await getPublicProfile(request('/api/profiles/101'), { params: Promise.resolve({ id: '101' }) });
    const publicProfile = (await publicResponse.json()).profile;
    assert.deepEqual(Object.keys(publicProfile).sort(), ['avatarUrl', 'dealerId', 'displayName', 'id', 'isDealer']);
    assert.equal(publicProfile.displayName, 'Alex Stone');
  });
});