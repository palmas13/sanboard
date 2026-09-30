import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listingUnionSchema } from '@/lib/validations/listing';

const image = (index: number) => ({
  storage_path: `/property-${index}.webp`,
  size_bytes: 1000,
  sort_order: index,
  is_cover: index === 0,
});

const property = (overrides: Record<string, unknown> = {}) => ({
  category: 'property', subcategory: 'Ev / Daire', title: 'Satılık Ev', description: '', price: 100000,
  location: 'Los Santos', floor: 1, room_count: '2+1', furnished: false, market_value: 90000,
  furniture_value: null, building_type: 'Normal', balcony: false, images: [image(0)], ...overrides,
});

test('property validation requires market value and enforces furnished furniture value consistency', () => {
  assert.equal(listingUnionSchema.safeParse(property()).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ market_value: undefined })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: true, furniture_value: null })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: true, furniture_value: 15000 })).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: false, furniture_value: 15000 })).success, false);
});

test('property accepts at most five images while vehicle stays capped at three', () => {
  assert.equal(listingUnionSchema.safeParse(property({ images: Array.from({ length: 5 }, (_, i) => image(i)) })).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ images: Array.from({ length: 6 }, (_, i) => image(i)) })).success, false);
});

test('create/edit/detail surfaces use property values, category image limit and safe JSON parsing', () => {
  const create = readFileSync('src/app/ilan-ver/yeni/page.tsx', 'utf8');
  const edit = readFileSync('src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx', 'utf8');
  const detail = readFileSync('src/components/listings/detail/PropertyDetailsPanel.tsx', 'utf8');
  const uploader = readFileSync('src/components/forms/PhotoUploader.tsx', 'utf8');
  for (const source of [create, edit]) {
    assert.match(source, /market_value/);
    assert.match(source, /furniture_value/);
    assert.match(source, /readJsonResponse/);
    assert.match(source, /maxImages=\{category === 'property' \? 5 : 3\}/);
  }
  assert.match(detail, /Market Değeri/);
  assert.match(detail, /Eşya Bedeli/);
  assert.match(uploader, /maxImages = 3/);
});