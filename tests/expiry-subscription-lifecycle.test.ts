import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST as lifecycleRoute } from '@/app/api/internal/expiry-lifecycle/route';
import { db } from '@/lib/db/store';
import { addCalendarMonth, completePaymentOrder } from '@/lib/db/payments';
import { isPublicListingVisible } from '@/lib/listings/visibility';
import { canRenewCorporateSubscription } from '@/lib/subscriptions/calendar-month';

describe('listing expiry and corporate subscription lifecycle', () => {
  const original = {
    dealers: structuredClone(db.dealers),
    packages: structuredClone(db.packages),
    payments: structuredClone(db.payments),
    dataStore: process.env.DATA_STORE,
    cronSecret: process.env.LIFECYCLE_CRON_SECRET,
  };

  afterEach(() => {
    db.dealers = structuredClone(original.dealers);
    db.packages = structuredClone(original.packages);
    db.payments = structuredClone(original.payments);
    process.env.DATA_STORE = original.dataStore;
    process.env.LIFECYCLE_CRON_SECRET = original.cronSecret;
  });

  test('scheduler route fails closed without a configured strong bearer secret', async () => {
    delete process.env.LIFECYCLE_CRON_SECRET;
    const response = await lifecycleRoute(new NextRequest('http://localhost/api/internal/expiry-lifecycle', {
      method: 'POST',
      headers: { authorization: 'Bearer attacker' },
    }));
    assert.equal(response.status, 401);
  });

  test('corporate entitlement is one calendar month and replay is idempotent', async () => {
    process.env.DATA_STORE = 'memory';
    const profileId = 'calendar-owner';
    const storeId = 'calendar-store';
    const paymentId = 'calendar-payment';
    db.dealers = [{
      id: storeId, owner_profile_id: profileId, profile_id: profileId,
      company_name: 'Calendar Store', description: '', logo_url: '', banner_url: '',
      status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'EXPIRED',
      subscription_expires_at: '2026-01-01T00:00:00.000Z', boost_credits: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }] as any;
    db.packages = [{ id: 'calendar-package', code: 'CORPORATE_SUBSCRIPTION_30_DAY', name: '1 Ay', price: 5000, duration_days: 30, active: true, seller_type: 'CORPORATE' }] as any;
    db.payments = [{
      id: paymentId, order_id: 'calendar-order', profile_id: profileId,
      package_id: 'calendar-package', provider: 'FLEECA', amount: 5000,
      status: 'PENDING', corporate_profile_id: storeId,
      entitlement_type: 'CORPORATE_SUBSCRIPTION', created_at: '2026-01-31T12:00:00.000Z',
    }] as any;

    const paidAt = new Date('2026-01-31T12:00:00.000Z');
    assert.equal((await completePaymentOrder('calendar-order', 'fleeca-calendar', paidAt)).success, true);
    assert.equal(db.dealers[0].subscription_expires_at, '2026-02-28T12:00:00.000Z');
    const expiry = db.dealers[0].subscription_expires_at;
    assert.equal((await completePaymentOrder('calendar-order', 'fleeca-calendar', new Date('2026-02-01T12:00:00.000Z'))).success, true);
    assert.equal(db.dealers[0].subscription_expires_at, expiry);
  });

  test('calendar month arithmetic clamps month-end like PostgreSQL', () => {
    assert.equal(addCalendarMonth(new Date('2026-01-31T12:00:00.000Z')).toISOString(), '2026-02-28T12:00:00.000Z');
    assert.equal(addCalendarMonth(new Date('2024-01-31T12:00:00.000Z')).toISOString(), '2024-02-29T12:00:00.000Z');
    assert.equal(addCalendarMonth(new Date('2026-03-31T12:00:00.000Z')).toISOString(), '2026-04-30T12:00:00.000Z');
  });

  test('public corporate listing visibility requires active unexpired subscription', () => {
    const now = new Date('2026-01-15T00:00:00.000Z');
    const listing = { status: 'ACTIVE', expires_at: '2026-01-20T00:00:00.000Z', seller_type: 'CORPORATE', corporate_profile_id: 'store' } as any;
    const store = { moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', subscription_expires_at: '2026-01-16T00:00:00.000Z' };
    assert.equal(isPublicListingVisible(listing, store, now), true);
    assert.equal(isPublicListingVisible(listing, { ...store, subscription_status: 'EXPIRED' }, now), false);
    assert.equal(isPublicListingVisible(listing, { ...store, subscription_expires_at: now.toISOString() }, now), false);
  });

  test('active corporate renewal opens only in the final seven days', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    assert.equal(canRenewCorporateSubscription('ACTIVE', '2026-01-08T12:00:00.000Z', now), true);
    assert.equal(canRenewCorporateSubscription('ACTIVE', '2026-01-08T12:00:00.001Z', now), false);
    assert.equal(canRenewCorporateSubscription('ACTIVE', null, now), false);
    assert.equal(canRenewCorporateSubscription('ACTIVE', 'invalid-date', now), false);
    assert.equal(canRenewCorporateSubscription('EXPIRED', '2025-12-31T00:00:00.000Z', now), true);
    assert.equal(canRenewCorporateSubscription('INACTIVE', null, now), true);
  });

  test('migration is concurrent-safe, terminal-state-safe, and service-role-only', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20261001000000_expiry_and_subscription_lifecycle.sql'), 'utf8');
    const renewal = readFileSync(join(process.cwd(), 'supabase/migrations/20260926060000_payment_boost_integrity_package_1.sql'), 'utf8');
    const calendarRenewal = readFileSync(join(process.cwd(), 'supabase/migrations/20261001010000_corporate_calendar_month_renewal.sql'), 'utf8');
    const preflight = readFileSync(join(process.cwd(), 'supabase/scripts/expiry_lifecycle_preflight.sql'), 'utf8');
    const postflight = readFileSync(join(process.cwd(), 'supabase/scripts/expiry_lifecycle_postflight.sql'), 'utf8');
    assert.match(migration, /WHERE status = 'ACTIVE'[\s\S]*expires_at <= v_now[\s\S]*FOR UPDATE SKIP LOCKED/);
    assert.match(migration, /SET status = 'EXPIRED'[\s\S]*is_featured = FALSE/);
    assert.match(migration, /close_offers_for_listing\(v_listing\.id, 'LISTING_EXPIRED'\)/);
    assert.match(migration, /subscription_status = 'EXPIRED'[\s\S]*boost_credits = 0/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.run_expiry_lifecycle\(\) FROM PUBLIC, anon, authenticated/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.run_expiry_lifecycle\(\) TO service_role/);
    assert.match(renewal, /GREATEST\(v_now, COALESCE\(v_old_expiry, v_now\)\) \+ INTERVAL '30 days'/);
    assert.match(calendarRenewal, /'1 month'/);
    assert.match(renewal, /entitlement_applied_at IS NOT NULL/);
    assert.doesNotMatch(preflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
    assert.doesNotMatch(postflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });
});