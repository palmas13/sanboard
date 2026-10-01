import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { getGalleryPreloadPlan } from '@/lib/listings/gallery-preload';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('listing gallery hybrid image delivery', () => {
  const gallery = source('src/components/listings/ListingGallery.tsx');
  const similarCard = source('src/components/listings/SimilarListingCard.tsx');
  const homepageCards = source('src/components/home/HomepageListingRotator.tsx');

  test('main gallery and lightbox use the same direct unoptimized media URL', () => {
    assert.match(gallery, /const imageUrl = resolveMediaUrl\(currentImage\.storage_path\)/);
    assert.match(gallery, /<Image src=\{imageUrl\} alt=\{title\} fill priority unoptimized onLoad=\{startGalleryPreload\}/);
    assert.match(gallery, /<Image src=\{imageUrl\} alt=\{title\} fill unoptimized sizes="90vw"/);
    assert.doesNotMatch(gallery, /quality=\{92\}|quality=\{95\}|\/_next\/image/);
  });

  test('preloading starts only after the initial gallery image loads and remains optional', () => {
    assert.match(gallery, /onLoad=\{startGalleryPreload\}/);
    assert.match(gallery, /if \(selectedIdx !== 0 \|\| preloadStartedRef\.current/);
    assert.match(gallery, /if \(typeof window === 'undefined' \|\| typeof window\.Image === 'undefined'\) return/);
    assert.match(gallery, /const image = new window\.Image\(\)/);
    assert.match(gallery, /image\.src = url/);
    assert.match(gallery, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); move\(-1\); \}\}/);
    assert.match(gallery, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); move\(1\); \}\}/);
  });

  test('vehicle galleries preload every remaining unique image without the current image', () => {
    const plan = getGalleryPreloadPlan(['cover', 'second', 'third'], 0, 'vehicle');
    assert.deepEqual(plan, { immediate: ['third', 'second'], deferred: [] });
    assert.equal(plan.immediate.includes('cover'), false);
  });

  test('property galleries preload adjacent images first and defer the remaining images', () => {
    const plan = getGalleryPreloadPlan(['cover', 'second', 'third', 'fourth', 'fifth'], 0, 'property');
    assert.deepEqual(plan.immediate, ['fifth', 'second']);
    assert.deepEqual(plan.deferred, ['third', 'fourth']);
    assert.match(gallery, /requestIdleCallback/);
    assert.match(gallery, /setTimeout\(\(\) => preloadUrls\(plan\.deferred\), 750\)/);
  });

  test('two-image galleries deduplicate the adjacent preload and never preload the current URL', () => {
    const plan = getGalleryPreloadPlan(['cover', 'second'], 0, 'property');
    assert.deepEqual(plan, { immediate: ['second'], deferred: [] });

    const duplicateUrlPlan = getGalleryPreloadPlan(['cover', 'second', 'second'], 0, 'vehicle');
    assert.deepEqual(duplicateUrlPlan, { immediate: ['second'], deferred: [] });
  });

  test('data saver and constrained connections stop after adjacent preloads', () => {
    const plan = getGalleryPreloadPlan(['cover', 'second', 'third', 'fourth', 'fifth'], 0, 'property', true);
    assert.deepEqual(plan, { immediate: ['fifth', 'second'], deferred: [] });
    assert.match(gallery, /connection\?\.saveData === true/);
    assert.match(gallery, /effectiveType === 'slow-2g'/);
    assert.match(gallery, /effectiveType === '2g'/);
  });

  test('optimized card surfaces retain Next Image derivatives', () => {
    assert.match(similarCard, /import Image from 'next\/image'/);
    assert.match(similarCard, /quality=\{86\}/);
    assert.doesNotMatch(similarCard, /unoptimized/);
    assert.match(homepageCards, /import Image from 'next\/image'/);
    assert.match(homepageCards, /quality=\{88\}/);
    assert.doesNotMatch(homepageCards, /unoptimized/);
  });
});