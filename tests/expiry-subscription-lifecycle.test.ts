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
    const adminGrant = readFileSync(join(process.cwd(), 'supabase/migrations/20261002070000_corporate_admin_review_and_manual_subscription.sql'), 'utf8');
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
    assert.match(adminGrant, /review_corporate_application[\s\S]*FOR UPDATE[\s\S]*CORPORATE_APPLICATION_APPROVED/);
    assert.match(adminGrant, /grant_corporate_subscription[\s\S]*FOR UPDATE[\s\S]*INTERVAL '1 month'/);
    assert.match(adminGrant, /current_period_start = v_now[\s\S]*current_period_end = v_expiry[\s\S]*boost_credits = 3/);
    assert.match(adminGrant, /subscription_status = 'ACTIVE'[\s\S]*subscription_expires_at > v_now[\s\S]*Kurumsal üyelik zaten aktif/);
    assert.match(adminGrant, /moderation_status = 'DELETED'/);
    assert.match(adminGrant, /'SYSTEM'[\s\S]*'ADMIN_GRANT'/);
    assert.doesNotMatch(adminGrant, /INSERT INTO public\.payments|external_payment_id|order_id/);
    assert.match(adminGrant, /REVOKE ALL ON FUNCTION public\.grant_corporate_subscription[\s\S]*GRANT EXECUTE[\s\S]*service_role/);
    assert.match(renewal, /entitlement_applied_at IS NOT NULL/);
    assert.doesNotMatch(preflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
    assert.doesNotMatch(postflight.replace(/^\s*--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });

  test('freeze migration routes membership expiry and renewal through the canonical listing transition', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20261005000000_listing_freeze_resume_lifecycle.sql'), 'utf8');
    assert.match(migration, /p_source NOT IN \('OWNER','ADMIN','MEMBERSHIP'\)/);
    assert.match(migration, /freeze_source=p_source/);
    assert.match(migration, /status='FROZEN' AND freeze_source='MEMBERSHIP'/);
    assert.match(migration, /transition_listing_freeze_state\([\s\S]*p_action,'MEMBERSHIP'/);
    assert.match(migration, /run_expiry_lifecycle[\s\S]*transition_corporate_membership_listings\(store\.id,'FREEZE'\)[\s\S]*subscription_status='EXPIRED'/);
    assert.match(migration, /complete_sanboard_payment membership resume[\s\S]*transition_corporate_membership_listings\(v_store\.id, ''RESUME''\)/);
    assert.match(migration, /regexp_replace\(d,'WHERE id = v_store\\\.id\\s\+RETURNING \\\* INTO v_store;'[\s\S]*transition_corporate_membership_listings\(v_store\.id, ''RESUME''\)/);
    assert.match(migration, /seller_type='CORPORATE'/);
    assert.match(migration, /monthly_boost_credits=0,boost_credits=purchased_boost_credits/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.transition_corporate_membership_listings\(UUID,TEXT\) TO service_role/);
  });

  test('accepted offers do not defer membership expiry or block the canonical freeze transition', () => {
    const originalMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20261005000000_listing_freeze_resume_lifecycle.sql'), 'utf8');
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20261005010000_freeze_accepted_offers_owner_visibility.sql'), 'utf8');
    const canonicalTransition = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.transition_listing_freeze_state'), migration.indexOf('REVOKE ALL ON FUNCTION public.transition_listing_freeze_state'));
    assert.match(originalMigration, /status='ACCEPTED'[\s\S]*Kabul edilmiş teklifi bulunan ilan dondurulamaz/);
    assert.doesNotMatch(canonicalTransition, /status='ACCEPTED'|Kabul edilmiş teklifi bulunan ilan dondurulamaz/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transition_listing_freeze_state/);
    assert.match(migration, /status = 'ACTIVE' AND expires_at > NOW\(\)/);
    assert.match(migration, /corporate_profile_id IN[\s\S]*owner_profile_id IN \(SELECT public\.get_auth_profile_ids\(\)\)/);
    assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.run_expiry_lifecycle/);
    assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.transition_corporate_membership_listings/);
  });
});
