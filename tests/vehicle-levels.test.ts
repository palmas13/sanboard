import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getVehicleLevelOptions, normalizeVehicleLevel, VEHICLE_LEVEL_FIELDS } from '@/lib/listings/vehicle-levels';
import { vehicleListingSchema } from '@/lib/validations/listing';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const baseVehicle = {
  category: 'vehicle' as const,
  subcategory: 'Otomobil' as const,
  title: 'Test Aracı', description: 'Temiz araç', price: 1000,
  brand: 'Annis', model: 'Elegy Retro', plate: 'LS123', mileage: 100,
  images: [{ storage_path: 'test.webp', is_cover: true, size_bytes: 100, sort_order: 0 }],
};

describe('vehicle level fields', () => {
  test('canonical maximums and select options are exact', () => {
    assert.deepEqual(Object.fromEntries(Object.entries(VEHICLE_LEVEL_FIELDS).map(([key, value]) => [key, value.max])), {
      lock_level: 3, alarm_level: 4, anti_theft_level: 4, brake_upgrade: 3,
      engine_upgrade: 4, transmission_upgrade: 3, suspension: 4, turbo: 1,
    });
    for (const field of Object.keys(VEHICLE_LEVEL_FIELDS) as Array<keyof typeof VEHICLE_LEVEL_FIELDS>) {
      assert.deepEqual(getVehicleLevelOptions(field).map((option) => option.value), Array.from({ length: VEHICLE_LEVEL_FIELDS[field].max + 1 }, (_, index) => String(index)));
    }
  });

  test('backend rejects every value above its maximum', () => {
    for (const field of ['lock_level', 'alarm_level', 'anti_theft_level', 'brake_upgrade', 'engine_upgrade', 'transmission_upgrade', 'suspension'] as const) {
      assert.equal(vehicleListingSchema.safeParse({ ...baseVehicle, [field]: VEHICLE_LEVEL_FIELDS[field].max + 1 }).success, false, `${field} üst sınırı reddedilmeli`);
    }
    assert.equal(vehicleListingSchema.safeParse({ ...baseVehicle, turbo: 2 }).success, false);
  });

  test('stored and draft values normalize to valid selected values', () => {
    assert.equal(normalizeVehicleLevel(3, 'brake_upgrade'), '3');
    assert.equal(normalizeVehicleLevel('4', 'engine_upgrade'), '4');
    assert.equal(normalizeVehicleLevel('9', 'engine_upgrade'), '4');
  });

  test('create and edit forms use shared selects and localized labels', () => {
    const create = source('src/app/ilan-ver/yeni/page.tsx');
    const edit = source('src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx');
    for (const field of Object.keys(VEHICLE_LEVEL_FIELDS)) {
      assert.match(create, new RegExp(`getVehicleLevelOptions\\('${field}'\\)`));
      assert.match(edit, new RegExp(`getVehicleLevelOptions\\('${field}'\\)`));
    }
    assert.match(create, /VEHICLE_LEVEL_FIELDS\.brake_upgrade\.label/);
    assert.match(create, /VEHICLE_LEVEL_FIELDS\.engine_upgrade\.label/);
    assert.doesNotMatch(edit, /category === 'vehicle' \? 'Araç Kategorisi'/);
  });
});