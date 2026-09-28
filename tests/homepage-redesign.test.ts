import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('homepage marketplace redesign', () => {
  test('server homepage uses real repositories and the existing boost source', () => {
    const page = source('src/app/page.tsx');
    assert.match(page, /getPublicListings\(\{ sort: 'newest' \}\)/);
    assert.match(page, /getAllDealers/);
    assert.match(page, /listing\.is_featured/);
    assert.match(page, /listing\.featured_until/);
    assert.doesNotMatch(page, /mock|migration|schema/i);
  });

  test('hero keeps canonical CTAs and decorative cards are not interactive', () => {
    const hero = source('src/components/home/HeroShowcase.tsx');
    assert.match(hero, /href="\/ilan-ver"/);
    assert.match(hero, /href="\/ilanlari-kesfet"/);
    assert.match(hero, /\/home\/hero-los-santos\.webp/);
    assert.match(hero, /aria-hidden="true"/);
    assert.doesNotMatch(hero, /<button|cursor-pointer/);
  });

  test('real homepage cards use canonical listing and corporate links', () => {
    const marketplace = source('src/components/home/HomepageMarketplace.tsx');
    const rotator = source('src/components/home/HomepageListingRotator.tsx');
    assert.match(marketplace, /getListingUrl\(listing\)/);
    assert.match(marketplace, /getCorporateUrl\(seller\)/);
    assert.match(rotator, /getListingUrl\(listing\)/);
  });

  test('shared rotator covers autoplay, manual navigation, pause and reduced motion', () => {
    const rotator = source('src/components/home/HomepageListingRotator.tsx');
    assert.match(rotator, /setInterval[\s\S]*5000/);
    assert.match(rotator, /onMouseEnter/);
    assert.match(rotator, /onFocusCapture/);
    assert.match(rotator, /visibilitychange/);
    assert.match(rotator, /prefers-reduced-motion/);
    assert.match(rotator, /aria-label=\{`Önceki/);
    assert.match(rotator, /aria-label=\{`Sonraki/);
    assert.match(rotator, /listings\.slice\(index \* 2, index \* 2 \+ 2\)/);
  });

  test('responsive four-column and reduced-motion styles remain present', () => {
    const css = source('src/app/globals.css');
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]*repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(css, /@media \(max-width: 639px\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });
});