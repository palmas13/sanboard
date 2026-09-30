import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listingUnionSchema } from '@/lib/validations/listing';
import { getJsonPayloadSizeBytes, toListingImageReferences } from '@/lib/listings/image-references';
import { readJsonResponse } from '@/lib/http/json-response';

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
    assert.match(source, /readJsonResponse/);
    assert.match(source, /maxImages=\{category === 'property' \? 5 : 3\}/);
  }
  assert.match(detail, /Market Değeri/);
  assert.match(detail, /Eşya Bedeli/);
  assert.match(uploader, /maxImages = 3/);
  assert.match(uploader, /new FormData\(\)/);
  assert.match(uploader, /fetch\('\/api\/listing-images'/);
  assert.doesNotMatch(uploader, /readAsDataURL|FileReader/);
});