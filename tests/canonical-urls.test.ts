import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getCorporateUrl, getListingUrl, isListingPublicId, parseListingRouteIdentifier, slugify } from '@/lib/urls';

describe('canonical public URLs', () => {
  test('slugify normalizes Turkish characters and punctuation', () => {
    assert.equal(slugify('İŞYERİ • ÇOK ŞIK & ÖZEL!'), 'isyeri-cok-sik-ozel');
  });

  test('listing URLs use the title and immutable six-digit public id', () => {
    assert.equal(getListingUrl({ id: 'uuid', public_id: '482731', title: 'Temiz Sultan RS!' }), '/ilan/temiz-sultan-rs-482731');
    assert.equal(getListingUrl({ id: 'legacy-uuid', title: 'Legacy' }), '/ilan/legacy-uuid');
  });

  test('route parser only accepts a valid final public id', () => {
    assert.deepEqual(parseListingRouteIdentifier('temiz-sultan-rs-482731'), { publicId: '482731' });
    assert.deepEqual(parseListingRouteIdentifier('550e8400-e29b-41d4-a716-446655440000'), { legacyId: '550e8400-e29b-41d4-a716-446655440000' });
    assert.deepEqual(parseListingRouteIdentifier('550e8400-e29b-41d4-a716-446655482731'), { legacyId: '550e8400-e29b-41d4-a716-446655482731' });
    assert.equal(isListingPublicId('012345'), false);
    assert.equal(isListingPublicId('482731'), true);
  });

  test('corporate URL uses the stable stored slug', () => {
    assert.equal(getCorporateUrl({ id: 'dealer-uuid', slug: 'apex-motors-2' }), '/kurumsal/apex-motors-2');
  });
});