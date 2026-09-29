import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vehicleCatalog } from '../src/lib/constants/vehicleCatalog';
import {
  VEHICLE_CATEGORIES, getVehicleBrandsByCategory, getVehicleModels, isMotorcycleCategory,
  isValidVehicleSelection, reconcileVehicleSelection, vehicleCategoryCatalog,
} from '../src/lib/constants/vehicleCategories';
import { vehicleListingSchema } from '../src/lib/validations/listing';

const canonical = Object.entries(vehicleCatalog).flatMap(([brand, models]) => models.map((model) => `${brand}\0${model}`));
const categorized = VEHICLE_CATEGORIES.flatMap((category) => Object.entries(vehicleCategoryCatalog[category])
  .flatMap(([brand, models]) => models.map((model) => `${brand}\0${model}`)));

describe('authoritative vehicle categories', () => {
  test('contains exactly the six authoritative categories', () => {
    assert.deepEqual(VEHICLE_CATEGORIES, ['Otomobil', 'Motosiklet', 'SUV', 'Pickup', 'ATV', 'Ticari']);
  });

  test('has bidirectional 402-model integrity and no duplicate assignment', () => {
    assert.equal(canonical.length, 402);
    assert.equal(categorized.length, 402);
    assert.equal(new Set(categorized).size, 402);
    assert.deepEqual([...categorized].sort(), [...canonical].sort());
  });

  test('preserves exact representative model-level assignments', () => {
    assert.ok(isValidVehicleSelection('Motosiklet', 'Dinka', 'Akuma'));
    assert.ok(isValidVehicleSelection('ATV', 'Dinka', 'Verus'));
    assert.ok(isValidVehicleSelection('ATV', 'Nagasaki', 'Street Blazer'));
    assert.deepEqual(getVehicleModels('SUV', 'Gallivanter'), ['Baller', 'Baller II', 'Baller LE', 'Baller LE LWB', 'Baller ST']);
    assert.ok(isValidVehicleSelection('Pickup', 'Vapid', 'Guardian'));
    assert.ok(isValidVehicleSelection('Otomobil', 'Karin', 'Sultan'));
    assert.deepEqual(getVehicleModels('Ticari', 'MTL'), ['Flatbed', 'Packer', 'Pounder', 'Tanker']);
    assert.deepEqual(getVehicleModels('Ticari', 'JoBuilt'), ['Hauler', 'Phantom']);
    assert.ok(isValidVehicleSelection('Ticari', 'Brute', 'Bus'));
    assert.ok(isValidVehicleSelection('SUV', 'Pfister', 'Astron'));
    assert.ok(isValidVehicleSelection('Otomobil', 'Pfister', 'Comet'));
  });

  test('filters brands by category', () => {
    assert.ok(getVehicleBrandsByCategory('SUV').includes('Gallivanter'));
    assert.ok(!getVehicleBrandsByCategory('Otomobil').includes('Gallivanter'));
    assert.ok(getVehicleBrandsByCategory('Otomobil').includes('Dinka'));
    assert.ok(getVehicleBrandsByCategory('Motosiklet').includes('Dinka'));
  });

  test('reconciles dependent selection state', () => {
    assert.deepEqual(reconcileVehicleSelection('SUV', 'Dinka', 'Verus'), { category: 'SUV', brand: '', model: '' });
    assert.deepEqual(reconcileVehicleSelection('Otomobil', 'Dinka', 'Akuma'), { category: 'Otomobil', brand: 'Dinka', model: '' });
    assert.deepEqual(reconcileVehicleSelection('Otomobil', 'Dinka', 'Blista'), { category: 'Otomobil', brand: 'Dinka', model: 'Blista' });
  });

  test('supports backend schema refinement semantics and motorcycle-only suspension reset', () => {
    const backendAccepts = (category: (typeof VEHICLE_CATEGORIES)[number], brand: string, model: string) =>
      isValidVehicleSelection(category, brand, model);
    assert.equal(backendAccepts('SUV', 'Gallivanter', 'Baller'), true);
    assert.equal(backendAccepts('Otomobil', 'Gallivanter', 'Baller'), false);
    assert.equal(backendAccepts('Motosiklet', 'Nagasaki', 'Blazer'), false);
    assert.equal(isMotorcycleCategory('Motosiklet'), true);
    assert.equal(isMotorcycleCategory('ATV'), false);
  });

  test('server schema accepts and rejects authoritative combinations', () => {
    const base = {
      category: 'vehicle' as const, title: 'Kategori Testi', description: 'Test', price: 1000,
      plate: 'LS 123', mileage: 10,
      images: [{ storage_path: 'test.webp', is_cover: true, size_bytes: 100, sort_order: 0 }],
    };
    const accepts = (subcategory: string, brand: string, model: string, suspension?: number | null) =>
      vehicleListingSchema.safeParse({ ...base, subcategory, brand, model, suspension }).success;

    assert.equal(accepts('Motosiklet', 'Dinka', 'Akuma'), true);
    assert.equal(accepts('Motosiklet', 'Dinka', 'Jester'), false);
    assert.equal(accepts('ATV', 'Dinka', 'Verus'), true);
    assert.equal(accepts('Otomobil', 'Dinka', 'Verus'), false);
    assert.equal(accepts('SUV', 'Gallivanter', 'Baller'), true);
    assert.equal(accepts('Pickup', 'Vapid', 'Sandking XL'), true);
    assert.equal(accepts('Motosiklet', 'Dinka', 'Akuma', 2), false);
    assert.equal(accepts('SUV', 'Gallivanter', 'Baller', 2), true);
  });

  test('shared individual/corporate forms and listing surfaces use category helpers', () => {
    const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
    const create = source('src/app/ilan-ver/yeni/page.tsx');
    const edit = source('src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx');
    for (const form of [create, edit]) {
      assert.match(form, /getVehicleBrandsByCategory/);
      assert.match(form, /getVehicleModels/);
      assert.match(form, /isValidVehicleSelection/);
      assert.match(form, /isMotorcycleCategory/);
    }
    assert.match(create, /isCorporate/);
    assert.match(source('src/components/listings/detail/VehicleDetailsPanel.tsx'), /vehicle_category !== 'Motosiklet'/);
    assert.match(source('src/components/compare/VehicleComparisonTable.tsx'), /vehicle_category !== 'Motosiklet'/);
  });

  test('legacy unknown categories fail closed without inventing a mapping', () => {
    assert.deepEqual(getVehicleBrandsByCategory('SUV / Off-Road / Kamyonet' as never), []);
    assert.deepEqual(getVehicleModels('SUV / Off-Road / Kamyonet' as never, 'Declasse'), []);
  });
});
