import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/lib/db/store';
import { completePaymentOrder, createCheckoutOrder } from '@/lib/db/payments';
import { getPublicListings, getUserFavorites, republishListing, toggleFavorite } from '@/lib/db/listings';
import { resolveCorporateEligibility, resolveCorporateHeaderActions } from '@/lib/dealers/eligibility';
import { MemoryListingRepository } from '@/lib/db/repositories/memory/memory-listing-repo';
import { createListingWithCredit } from '@/lib/db/listings';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listingUnionSchema } from '@/lib/validations/listing';

describe('SANBOARD Business Logic Phase 1 regressions', () => {
  const ownerId = 'phase1-owner';
  const siblingId = 'phase1-sibling';
  const storeId = 'phase1-store';
  const listingId = 'phase1-listing';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [
      { id: ownerId, user_id: 'phase1-account', full_name: 'Mavis', avatar_url: '', sanmail_email: 'mavis@sanmail.com', phone: '100', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: siblingId, user_id: 'phase1-account', full_name: 'Ravi', avatar_url: '', sanmail_email: 'ravi@sanmail.com', phone: '101', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as any;
    db.dealers = [{
      id: storeId,
      profile_id: ownerId,
      owner_profile_id: ownerId,
      company_name: 'Vinewood Motors',
      slug: 'vinewood-motors',
      description: '', logo_url: '', banner_url: '',
      status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE',
      subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      boost_credits: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }] as any;
    db.applications = [];
    db.payments = [];
    db.credits = [];
    db.favorites = [];
    db.listings = [{
      id: listingId, listing_number: '#SB-PHASE1', seller_profile_id: ownerId,
      seller_type: 'INDIVIDUAL', category: 'vehicle', subcategory: 'Otomobil',
      title: 'Korunan ilan', description: 'Geçmişi korunur', price: 100000, location: null,
      status: 'ACTIVE', published_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(), updated_at: new Date().toISOString(),
      images: [{ id: 'img-1', listing_id: listingId, storage_path: 'image.jpg', sort_order: 0, is_cover: true, size_bytes: 10, created_at: new Date().toISOString() }],
    }] as any;
    db.packages = [
      { id: 'pkg-individual', code: 'STANDARD_7_DAY', name: '7 Günlük Bireysel', price: 2000, duration_days: 7, active: true, seller_type: 'INDIVIDUAL' },
      { id: 'pkg-corporate', code: 'CORPORATE_14_DAY', name: '14 Günlük Kurumsal', price: 1750, duration_days: 14, active: true, seller_type: 'CORPORATE' },
      { id: 'pkg-subscription', code: 'CORPORATE_SUBSCRIPTION_30_DAY', name: '30 Günlük Kurumsal Üyelik', price: 5000, duration_days: 30, active: true, seller_type: 'CORPORATE' },
    ] as any;
  });

  test('approved application/store without active subscription cannot publish and header agrees', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    db.dealers[0].subscription_expires_at = null;
    const eligibility = await resolveCorporateEligibility(ownerId);
    const actions = resolveCorporateHeaderActions({ eligibility, activeProfileId: ownerId, isCorporatePage: true });
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.reason, 'SUBSCRIPTION_INACTIVE');
    assert.equal(actions.canCreateCorporateListing, false);
  });

  test('expired store remains stored but cannot create corporate listings', async () => {
    db.dealers[0].subscription_status = 'EXPIRED';
    db.dealers[0].subscription_expires_at = new Date(Date.now() - 1000).toISOString();
    const eligibility = await resolveCorporateEligibility(ownerId);
    assert.equal(db.dealers.length, 1);
    assert.equal(eligibility.reason, 'SUBSCRIPTION_EXPIRED');
    assert.equal(eligibility.dealer?.id, storeId);
  });

  test('same payment intent and completion create one payment and one credit', async () => {
    const first = await createCheckoutOrder(ownerId, 'STANDARD_7_DAY', { idempotencyKey: 'same-intent' });
    const retry = await createCheckoutOrder(ownerId, 'STANDARD_7_DAY', { idempotencyKey: 'same-intent' });
    assert.equal(first.orderId, retry.orderId);
    await completePaymentOrder(first.orderId, 'FLC-ONE');
    await completePaymentOrder(first.orderId, 'FLC-ONE');
    assert.equal(db.payments.length, 1);
    assert.equal(db.credits.filter((credit) => credit.payment_id === db.payments[0].id).length, 1);
  });

  test('completed payment rejects a different provider transaction id', async () => {
    const order = await createCheckoutOrder(ownerId, 'STANDARD_7_DAY');
    assert.equal((await completePaymentOrder(order.orderId, 'FLC-ORIGINAL')).success, true);
    assert.equal((await completePaymentOrder(order.orderId, 'FLC-ORIGINAL')).success, true);
    const conflict = await completePaymentOrder(order.orderId, 'FLC-DIFFERENT');
    assert.equal(conflict.success, false);
    assert.match(conflict.error || '', /farklı bir sağlayıcı işlem kimliği/);
    assert.equal(db.credits.length, 1);
  });

  test('misconfigured listing packages cannot issue credits', async () => {
    const standard = db.packages.find((pkg) => pkg.code === 'STANDARD_7_DAY')!;
    standard.seller_type = 'CORPORATE';
    assert.match((await createCheckoutOrder(ownerId, standard.code)).error || '', /yapılandırması geçersiz/);
    standard.seller_type = 'INDIVIDUAL';
    standard.duration_days = 8;
    assert.match((await createCheckoutOrder(ownerId, standard.code)).error || '', /yapılandırması geçersiz/);

    const corporate = db.packages.find((pkg) => pkg.code === 'CORPORATE_14_DAY')!;
    corporate.seller_type = 'INDIVIDUAL';
    assert.match((await createCheckoutOrder(ownerId, corporate.code, { corporateProfileId: storeId })).error || '', /yapılandırması geçersiz/);
    corporate.seller_type = 'CORPORATE';
    corporate.duration_days = 13;
    assert.match((await createCheckoutOrder(ownerId, corporate.code, { corporateProfileId: storeId })).error || '', /yapılandırması geçersiz/);
    assert.equal(db.payments.length, 0);
    assert.equal(db.credits.length, 0);
  });

  test('corporate credit requires the exact owned and currently eligible store', async () => {
    const wrongStoreOrder = await createCheckoutOrder(ownerId, 'CORPORATE_14_DAY', { corporateProfileId: 'another-store' });
    const wrongStore = await completePaymentOrder(wrongStoreOrder.orderId, 'FLC-WRONG-STORE');
    assert.equal(wrongStore.success, false);

    db.dealers[0].subscription_expires_at = new Date(Date.now() - 1000).toISOString();
    const expiredOrder = await createCheckoutOrder(ownerId, 'CORPORATE_14_DAY', { corporateProfileId: storeId });
    assert.equal((await completePaymentOrder(expiredOrder.orderId, 'FLC-EXPIRED')).success, false);

    db.dealers[0].subscription_expires_at = new Date(Date.now() + 86400000).toISOString();
    db.dealers[0].moderation_status = 'SUSPENDED';
    const suspendedOrder = await createCheckoutOrder(ownerId, 'CORPORATE_14_DAY', { corporateProfileId: storeId });
    assert.equal((await completePaymentOrder(suspendedOrder.orderId, 'FLC-SUSPENDED')).success, false);
    assert.equal(db.credits.length, 0);
  });

  test('duplicate subscription completion adds only one 30-day cycle', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    db.dealers[0].subscription_expires_at = null;
    const order = await createCheckoutOrder(ownerId, 'CORPORATE_SUBSCRIPTION_30_DAY', {
      idempotencyKey: 'subscription-cycle', corporateProfileId: storeId,
    });
    await completePaymentOrder(order.orderId, 'FLC-SUB');
    const firstExpiry = db.dealers[0].subscription_expires_at;
    await completePaymentOrder(order.orderId, 'FLC-SUB');
    assert.equal(db.dealers[0].subscription_expires_at, firstExpiry);
  });

  test('legacy zero package price cannot open a free subscription and structural misconfiguration is rejected', async () => {
    db.dealers[0].subscription_status = 'INACTIVE';
    db.dealers[0].subscription_expires_at = null;
    const subscriptionPackage = db.packages.find((pkg) => pkg.code === 'CORPORATE_SUBSCRIPTION_30_DAY')!;

    subscriptionPackage.price = 0;
    const zeroPrice = await createCheckoutOrder(ownerId, subscriptionPackage.code, {
      idempotencyKey: 'zero-price-subscription', corporateProfileId: storeId,
    });
    assert.equal(zeroPrice.amount, 1);
    assert.equal(db.payments.length, 1);
    assert.equal(db.payments[0].status, 'PENDING');
    assert.equal(db.payments[0].amount, 1);
    assert.equal(db.dealers[0].subscription_status, 'INACTIVE');

    db.payments = [];
    subscriptionPackage.price = 5000;
    subscriptionPackage.seller_type = 'INDIVIDUAL';
    const wrongType = await createCheckoutOrder(ownerId, subscriptionPackage.code, {
      idempotencyKey: 'wrong-type-subscription', corporateProfileId: storeId,
    });
    assert.match(wrongType.error || '', /yapılandırması geçersiz/);
    assert.equal(db.payments.length, 0);
    assert.equal(db.dealers[0].subscription_status, 'INACTIVE');
  });

  test('republish keeps identity, media, favorites and creates a fresh 7-day window', async () => {
    db.favorites.push({ id: 'fav-owner', profile_id: siblingId, user_id: 'phase1-account', listing_id: listingId, created_at: new Date().toISOString() });
    db.credits.push({ id: 'credit-republish', profile_id: ownerId, payment_id: 'payment-x', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() });
    const oldCreatedAt = db.listings[0].created_at;
    const result = await republishListing(listingId, ownerId);
    assert.equal(result.success, true);
    assert.equal(result.listing?.id, listingId);
    assert.equal(result.listing?.created_at, oldCreatedAt);
    assert.equal(result.listing?.images?.length, 1);
    assert.equal(db.favorites.some((favorite) => favorite.listing_id === listingId), true);
    const duration = new Date(result.listing!.expires_at!).getTime() - new Date(result.listing!.published_at!).getTime();
    assert.equal(Math.round(duration / 86400000), 7);
    assert.equal((await getPublicListings()).some((listing) => listing.id === listingId), true);
  });

  test('one listing can consume three distinct credits across initial publication and two republishes', async () => {
    db.credits.push(
      { id: 'credit-1', profile_id: ownerId, payment_id: 'payment-1', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'USED', used_listing_id: listingId, created_at: new Date().toISOString() },
      { id: 'credit-2', profile_id: ownerId, payment_id: 'payment-2', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() },
      { id: 'credit-3', profile_id: ownerId, payment_id: 'payment-3', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() },
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      db.listings[0].status = 'EXPIRED';
      db.listings[0].expires_at = new Date(Date.now() - 1000).toISOString();
      assert.equal((await republishListing(listingId, ownerId)).success, true);
    }
    assert.deepEqual(db.credits.map((credit) => credit.used_listing_id), [listingId, listingId, listingId]);
    assert.equal(db.credits.filter((credit) => credit.status === 'USED').length, 3);
  });

  test('corporate credit type comes from package code even when price changes', async () => {
    db.packages.find((pkg) => pkg.code === 'CORPORATE_14_DAY')!.price = 9999;
    const order = await createCheckoutOrder(ownerId, 'CORPORATE_14_DAY', { corporateProfileId: storeId });
    const result = await completePaymentOrder(order.orderId, 'FLC-CORP-PRICE-CHANGE');
    assert.equal(result.success, true);
    assert.equal(result.credit?.credit_type, 'CORPORATE');
  });

  test('another profile cannot consume the listing owner credit', async () => {
    db.credits.push({ id: 'owner-credit', profile_id: ownerId, payment_id: 'payment-owner', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() });
    const result = await republishListing(listingId, siblingId);
    assert.equal(result.success, false);
    assert.equal(db.credits[0].status, 'AVAILABLE');
  });

  test('canonical creation rejects category-specific photo overflow and invalid categories', async () => {
    const images = (count: number) => Array.from({ length: count }, (_, index) => ({ storage_path: `image-${index}.jpg`, is_cover: index === 0, sort_order: index, size_bytes: 10 }));
    db.credits.push({ id: 'creation-credit', profile_id: ownerId, payment_id: 'payment-create', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() });
    const base = { seller_type: 'INDIVIDUAL', subcategory: 'Test', title: 'Test ilan', description: 'Test', price: 1000 };
    assert.equal((await createListingWithCredit({ ...base, category: 'vehicle', images: images(4) }, ownerId)).success, false);
    assert.equal((await createListingWithCredit({ ...base, category: 'property', images: images(6) }, ownerId)).success, false);
    assert.equal((await createListingWithCredit({ ...base, category: 'other', images: images(1) }, ownerId)).success, false);
    assert.equal(db.credits[0].status, 'AVAILABLE');

    const propertyPayload = {
      ...base,
      category: 'property',
      subcategory: 'Ev / Daire',
      location: 'Rockford Hills',
      floor: 1,
      room_count: '1+1',
      furnished: false,
      market_value: 100000,
      furniture_value: null,
      building_type: 'Normal',
      balcony: false,
    };
    assert.equal(listingUnionSchema.safeParse({ ...propertyPayload, images: images(5) }).success, true);
    assert.equal(listingUnionSchema.safeParse({ ...propertyPayload, images: images(6) }).success, false);
  });

  test('SECURITY DEFINER RPCs are service-role only and used-listing index is non-unique', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926020000_business_logic_phase_1.sql'), 'utf8');
    assert.doesNotMatch(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_credits_used_listing/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_listing_credits_used_listing/);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.complete_sanboard_payment\\(TEXT, TEXT\\) FROM ${role}`));
      assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.create_listing_with_credit\\(UUID, TEXT, UUID, JSONB, JSONB, JSONB\\) FROM ${role}`));
      assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.republish_listing_with_credit\\(UUID, UUID\\) FROM ${role}`));
    }
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.complete_sanboard_payment\(TEXT, TEXT\) TO service_role/);
    assert.doesNotMatch(migration, /v_payment\.amount\s*=\s*1750/);
    assert.match(migration, /v_package\.price <= 0 OR v_payment\.amount <> v_package\.price/);
    assert.match(migration, /v_package\.code = 'CORPORATE_SUBSCRIPTION_30_DAY'/);
    assert.match(migration, /v_package\.seller_type = 'CORPORATE'/);
    assert.match(migration, /v_package\.duration_days = 30/);
    assert.match(migration, /v_package\.code = 'STANDARD_7_DAY'[\s\S]*v_package\.seller_type = 'INDIVIDUAL'[\s\S]*v_package\.duration_days = 7/);
    assert.match(migration, /v_package\.code = 'CORPORATE_14_DAY'[\s\S]*v_package\.seller_type = 'CORPORATE'[\s\S]*v_package\.duration_days = 14/);
    assert.match(migration, /owner_profile_id = v_payment\.profile_id[\s\S]*moderation_status = 'ACTIVE'[\s\S]*subscription_status = 'ACTIVE'[\s\S]*subscription_expires_at > NOW\(\)/);
  });

  test('reconciliation uses character-scoped editor auth and preserves notification constraints', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926030000_production_schema_reconciliation.sql'), 'utf8');
    assert.match(migration, /FROM public\.character_profiles[\s\S]*id = p_editor_profile_id[\s\S]*user_id = p_editor_user_id/);
    assert.doesNotMatch(migration, /SELECT role INTO v_editor_role FROM public\.users/);
    assert.match(migration, /COALESCE\(v_editor_role, ''\) <> 'ADMIN'[\s\S]*p_editor_profile_id <> v_listing\.seller_profile_id/);
    assert.doesNotMatch(migration, /favorites[\s\S]{0,400}public\.is_admin\(\)/);
    assert.doesNotMatch(migration, /DROP CONSTRAINT IF EXISTS notifications_type_check/);
    assert.doesNotMatch(migration, /ADD CONSTRAINT notifications_type_check/);
  });

  test('preflight is read-only and inventories functions, notification types and health conflicts', () => {
    const preflight = readFileSync(join(process.cwd(), 'supabase/scripts/phase1_reconciliation_preflight.sql'), 'utf8');
    const sqlWithoutComments = preflight.replace(/^\s*--.*$/gm, '');
    assert.doesNotMatch(sqlWithoutComments, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
    assert.match(preflight, /pg_get_function_identity_arguments/);
    assert.match(preflight, /pg_get_functiondef/);
    assert.match(preflight, /notifications_type_check/);
    assert.match(preflight, /GROUP BY type/);
    assert.match(preflight, /profile_user_mismatch_count/);
    assert.match(preflight, /CORPORATE_SUBSCRIPTION_30_DAY/);
  });

  test('SOLD listing cannot be republished by expiration logic', async () => {
    db.listings[0].status = 'SOLD';
    db.credits.push({ id: 'credit-sold', profile_id: ownerId, payment_id: 'payment-y', package_id: 'pkg-individual', credit_type: 'INDIVIDUAL', status: 'AVAILABLE', created_at: new Date().toISOString() });
    const result = await republishListing(listingId, ownerId);
    assert.equal(result.success, false);
    assert.equal(db.listings[0].status, 'SOLD');
    assert.equal(db.credits[0].status, 'AVAILABLE');
  });

  test('corporate credit is isolated to its purchasing store', async () => {
    db.listings[0] = { ...db.listings[0], seller_type: 'CORPORATE', corporate_profile_id: storeId } as any;
    db.credits.push({ id: 'wrong-store-credit', profile_id: ownerId, payment_id: 'payment-z', package_id: 'pkg-corporate', credit_type: 'CORPORATE', corporate_profile_id: 'another-store', status: 'AVAILABLE', created_at: new Date().toISOString() });
    const result = await republishListing(listingId, ownerId);
    assert.equal(result.success, false);
    assert.equal(db.credits[0].status, 'AVAILABLE');
  });

  test('favorite count is global while membership is profile scoped and refresh-authoritative', async () => {
    db.listings[0].status = 'ACTIVE';
    db.listings[0].expires_at = new Date(Date.now() + 86400000).toISOString();
    await toggleFavorite(siblingId, listingId);
    const repo = new MemoryListingRepository();
    const ownerState = (await repo.getFavoriteStates([listingId], ownerId))[listingId];
    const siblingState = (await repo.getFavoriteStates([listingId], siblingId))[listingId];
    assert.equal(ownerState.count, 1);
    assert.equal(siblingState.count, 1);
    assert.equal(ownerState.isFavorited, false);
    assert.equal(siblingState.isFavorited, true);
    const refreshed = await getUserFavorites(siblingId);
    assert.equal(refreshed[0].favorite_count, 1);
    assert.equal(refreshed[0].is_favorited, true);
  });
});