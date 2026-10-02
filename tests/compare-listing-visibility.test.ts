import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getVehicleComparisonSections } from '@/components/compare/VehicleComparisonTable';
import type { Listing } from '@/types';

const vehicle = (id: string, overrides: Partial<NonNullable<Listing['vehicle_details']>> = {}): Listing => ({
  id, public_id: id === 'a' ? '580570' : '580571', listing_number: id === 'a' ? '#SB-592359' : '#SB-123456', seller_profile_id: `seller-${id}`,
  category: 'vehicle', subcategory: 'Otomobil', title: id === 'a' ? 'Albany Buccaneer Satılık' : 'Dinka Akuma Satılık', description: 'Test', price: id === 'a' ? 20000 : 45000, location: null, status: 'ACTIVE', created_at: '', updated_at: '',
  vehicle_details: { listing_id: id, vehicle_category: 'Otomobil', brand: id === 'a' ? 'Albany' : 'Dinka', model: id === 'a' ? 'Buccaneer' : 'Akuma', plate: 'LS-001', mileage: 12000, engine_upgrade: id === 'a' ? 2 : 3, transmission_upgrade: 1, brake_upgrade: 2, turbo: true, subwoofer: false, trade_available: true, fuel_type: 'BENZIN', ...overrides },
});

describe('comparison redesign and listing number presentation', () => {
  test('comparison fields are grouped under the intended categories', () => {
    const sections = getVehicleComparisonSections(vehicle('a'), vehicle('b'));
    assert.deepEqual(sections.map((section) => section.key), ['general', 'performance', 'comfort', 'security', 'other']);
    const keys = Object.fromEntries(sections.map((section) => [section.key, section.rows.map((row) => row.key)]));
    assert.deepEqual(keys.general, ['price', 'category', 'brand', 'model', 'mileage', 'fuel']);
    assert.deepEqual(keys.performance, ['engine-health', 'engine-upgrade', 'brake-upgrade', 'transmission-upgrade', 'turbo', 'suspension']);
    assert.deepEqual(keys.comfort, ['subwoofer', 'trade']);
    assert.deepEqual(keys.security, ['lock', 'alarm', 'anti-theft']);
    assert.deepEqual(keys.other, ['plate', 'factory-price']);
  });

  test('different and same raw values remain distinguishable without winner semantics', () => {
    const rows = getVehicleComparisonSections(vehicle('a'), vehicle('b', { mileage: 12000, turbo: true })).flatMap((section) => section.rows);
    const engine = rows.find((row) => row.key === 'engine-upgrade')!;
    const mileage = rows.find((row) => row.key === 'mileage')!;
    assert.notEqual(engine.rawA ?? null, engine.rawB ?? null);
    assert.equal(mileage.rawA ?? null, mileage.rawB ?? null);
  });

  test('motorcycle comparisons omit suspension while other categories keep it', () => {
    const motorcycle = vehicle('a', { vehicle_category: 'Motosiklet', brand: 'Dinka', model: 'Akuma', suspension: null });
    assert.equal(getVehicleComparisonSections(motorcycle, null).flatMap((section) => section.rows).some((row) => row.key === 'suspension'), false);
    assert.equal(getVehicleComparisonSections(vehicle('a', { suspension: 2 }), null).flatMap((section) => section.rows).some((row) => row.key === 'suspension'), true);
  });

  test('mobile comparison uses stacked value cards without forced horizontal table overflow', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/compare/VehicleComparisonTable.tsx'), 'utf8');
    assert.match(source, /grid-cols-2/);
    assert.match(source, /md:grid-cols-\[minmax\(150px,0\.8fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
    assert.doesNotMatch(source, /overflow-x-auto|min-w-\[500px\]|<table/);
    assert.match(source, /data-different=\{isDifferent/);
  });

  test('public listing surfaces do not render listing_number while the private owner dashboard may manage by it', () => {
    const paths = ['src/components/listings/ListingCard.tsx', 'src/app/ilan/[id]/page.tsx', 'src/app/hesabim/favorilerim/page.tsx', 'src/app/arac/karsilastir/page.tsx', 'src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx', 'src/app/yonetim/page.tsx'];
    for (const path of paths) assert.doesNotMatch(readFileSync(join(process.cwd(), path), 'utf8'), /listing_number|#SB-/, `${path} must not present listing numbers`);
    assert.match(readFileSync(join(process.cwd(), 'src/app/hesabim/ilanlarim/page.tsx'), 'utf8'), /listing\.listing_number/);
    const canonicalTests = readFileSync(join(process.cwd(), 'tests/canonical-urls.test.ts'), 'utf8');
    assert.match(canonicalTests, /immutable six-digit public id/);
    assert.match(canonicalTests, /temiz-sultan-rs-482731/);
  });
});