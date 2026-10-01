import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listingUnionSchema } from '@/lib/validations/listing';
import { getJsonPayloadSizeBytes, toListingImageReferences } from '@/lib/listings/image-references';
import { readJsonResponse } from '@/lib/http/json-response';
import { PropertyDetailsPanel } from '@/components/listings/detail/PropertyDetailsPanel';

const image = (index: number) => ({
  storage_path: `/property-${index}.webp`,
  size_bytes: 1000,
  sort_order: index,
  is_cover: index === 0,
});

const property = (overrides: Record<string, unknown> = {}) => ({
  category: 'property', subcategory: 'Ev / Daire', title: 'Satılık Ev', description: '', price: 100000,
  location: 'Los Santos', floor: 1, room_count: '2+1', room_number: 5, furnished: false, alarm: false, market_value: 90000,
  furniture_value: null, building_type: 'Normal', balcony: false, images: [image(0)], ...overrides,
});

test('property validation requires market value and enforces furnished furniture value consistency', () => {
  assert.equal(listingUnionSchema.safeParse(property()).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ market_value: undefined })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: true, furniture_value: null })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: true, furniture_value: 15000 })).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ furnished: false, furniture_value: 15000 })).success, false);
});

test('property room number is a required positive integer and mixed/alphabetic values are rejected', () => {
  assert.equal(listingUnionSchema.safeParse(property({ room_number: 12 })).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ room_number: 0 })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ room_number: 2_147_483_648 })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ room_number: 'ABC' })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ room_number: '12A' })).success, false);
  assert.equal(listingUnionSchema.safeParse(property({ room_number: '  ' })).success, false);
});

test('property detail renders alarm mapping, room number, terminology, and tolerates legacy nulls', () => {
  const listing = {
    id: 'property-detail-test', listing_number: '#SB-1', seller_profile_id: 'seller', category: 'property',
    subcategory: 'Ev / Daire', title: 'Test mülkü', description: '', price: 100000, location: 'Los Santos',
    status: 'ACTIVE', created_at: '', updated_at: '', property_details: {
      listing_id: 'property-detail-test', property_type: 'Ev / Daire', floor: 1, room_count: '2+1', room_number: 5,
      furnished: false, alarm: true, market_value: 90000, furniture_value: null, building_type: 'Normal', balcony: false,
    },
  } as any;
  const withAlarm = renderToStaticMarkup(React.createElement(PropertyDetailsPanel, { listing }));
  assert.match(withAlarm, /Alarm/);
  assert.match(withAlarm, />Var</);
  assert.match(withAlarm, /Oda No/);
  assert.match(withAlarm, />5</);
  assert.match(withAlarm, /Piyasa Fiyatı/);
  assert.doesNotMatch(withAlarm, /Market Değeri/);

  const withoutAlarm = renderToStaticMarkup(React.createElement(PropertyDetailsPanel, { listing: { ...listing, property_details: { ...listing.property_details, alarm: false } } }));
  assert.match(withoutAlarm, />Yok</);

  const legacy = renderToStaticMarkup(React.createElement(PropertyDetailsPanel, { listing: { ...listing, property_details: { ...listing.property_details, room_number: null, alarm: null } } }));
  assert.doesNotMatch(legacy, /Oda No/);
  assert.doesNotMatch(legacy, /Alarm/);
});

test('property accepts at most five images while vehicle stays capped at three', () => {
  assert.equal(listingUnionSchema.safeParse(property({ images: Array.from({ length: 5 }, (_, i) => image(i)) })).success, true);
  assert.equal(listingUnionSchema.safeParse(property({ images: Array.from({ length: 6 }, (_, i) => image(i)) })).success, false);
});

test('publish payload contains only compact image references and safely reports HTTP 413 HTML responses', async () => {
  const propertyImages = Array.from({ length: 5 }, (_, i) => ({ ...image(i), id: `image-${i}`, preview_url: `blob:${i}`, is_pending: true }));
  const references = toListingImageReferences(propertyImages);
  assert.equal(references.length, 5);
  assert.equal(references.some((item: any) => 'preview_url' in item || 'is_pending' in item || 'id' in item), false);
  assert.equal(references.some((item) => item.storage_path.startsWith('data:') || item.storage_path.startsWith('blob:')), false);
  assert.ok(getJsonPayloadSizeBytes(property({ images: references })) < 10_000);
  assert.throws(() => toListingImageReferences([{ ...image(0), storage_path: 'data:image/png;base64,abc' }]), /önce yüklenmelidir/);

  await assert.rejects(
    () => readJsonResponse(new Response('<html>too large</html>', { status: 413, headers: { 'content-type': 'text/html' } }), 'İlan yayınlanamadı.'),
    (error: Error) => {
      assert.match(error.message, /Fotoğraflar yükleme sınırını aştı/);
      assert.doesNotMatch(error.message, /Unexpected token|HTTP 413/);
      return true;
    }
  );
});

test('create/edit/detail surfaces use property values, category image limit and safe JSON parsing', () => {
  const create = readFileSync('src/app/ilan-ver/yeni/page.tsx', 'utf8');
  const edit = readFileSync('src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx', 'utf8');
  const detail = readFileSync('src/components/listings/detail/PropertyDetailsPanel.tsx', 'utf8');
  const uploader = readFileSync('src/components/forms/PhotoUploader.tsx', 'utf8');
  for (const source of [create, edit]) {
    assert.match(source, /market_value/);
    assert.match(source, /furniture_value/);
    assert.match(source, /room_number/);
    assert.match(source, /payload\.alarm = alarm/);
    assert.match(source, /Piyasa Fiyatı/);
    assert.match(source, /readJsonResponse/);
    assert.match(source, /maxImages=\{category === 'property' \? 5 : 3\}/);
  }
  assert.match(detail, /Piyasa Fiyatı/);
  assert.doesNotMatch(detail, /Market Değeri/);
  assert.match(detail, /Oda No/);
  assert.match(detail, /Alarm/);
  assert.match(detail, /Eşya Bedeli/);
  assert.match(uploader, /maxImages = 3/);
  assert.match(uploader, /new FormData\(\)/);
  assert.match(uploader, /fetch\('\/api\/listing-images'/);
  assert.doesNotMatch(uploader, /readAsDataURL|FileReader/);
});

test('forward migration adds nullable canonical columns, DB validation, RPC mapping, and read-only postflight', () => {
  const migration = readFileSync('supabase/migrations/20261001030000_property_alarm_and_room_number.sql', 'utf8');
  const postflight = readFileSync('supabase/scripts/property_alarm_and_room_number_postflight.sql', 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS room_number INTEGER/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS alarm BOOLEAN/);
  assert.match(migration, /CHECK \(room_number IS NULL OR room_number > 0\)/);
  assert.match(migration, /COALESCE\(jsonb_typeof\(p_details->'alarm'\), 'missing'\) <> 'boolean'/);
  assert.match(migration, /room_count, room_number, furnished, alarm/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_listing_with_credit/);
  assert.doesNotMatch(postflight, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
});