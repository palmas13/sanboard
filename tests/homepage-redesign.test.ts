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
    assert.match(page, /isListingActivelyFeatured/);
    assert.doesNotMatch(page, /mock|migration|schema/i);
  });

  test('hero keeps canonical CTAs and decorative cards are not interactive', () => {
    const hero = source('src/components/home/HeroShowcase.tsx');
    assert.match(hero, /href="\/ilan-ver"/);
    assert.match(hero, /href="\/ilanlari-kesfet"/);
    assert.match(hero, /\/home\/sanboard-background1\.png/);
    assert.match(hero, /aria-hidden="true"/);
    assert.doesNotMatch(hero, /<button|cursor-pointer/);
  });

  test('hero polish uses real counters, stable typewriter and decorative notes', () => {
    const page = source('src/app/page.tsx');
    const stats = source('src/lib/db/homepage-stats.ts');
    const dynamic = source('src/components/home/HeroDynamicContent.tsx');
    const hero = source('src/components/home/HeroShowcase.tsx');
    assert.match(page, /getHomepageStats\(allListings\.length\)/);
    assert.match(stats, /offer_threads/);
    assert.match(stats, /from\('users'\)/);
    assert.match(dynamic, /requestAnimationFrame/);
    assert.match(dynamic, /prefers-reduced-motion/);
    assert.match(dynamic, /ilan oluştur/);
    assert.match(dynamic, /complete \? 1050 : 105/);
    assert.match(dynamic, /empty \? 260 : 65/);
    assert.match(dynamic, /Toplam Kullanıcı/);
    assert.ok(dynamic.indexOf("label: 'Teklif Sayısı'") < dynamic.indexOf("label: 'Aktif İlan'"));
    assert.match(hero, /Hayalindeki araca/);
  });

  test('real homepage cards use canonical listing and corporate links', () => {
    const marketplace = source('src/components/home/HomepageMarketplace.tsx');
    const rotator = source('src/components/home/HomepageListingRotator.tsx');
    assert.match(marketplace, /getListingUrl\(listing\)/);
    assert.match(marketplace, /getCorporateUrl\(seller\)/);
    assert.match(rotator, /getListingUrl\(listing\)/);
    assert.match(rotator, /<FavoriteButton/);
    assert.match(marketplace, /<FavoriteButton/);
    assert.doesNotMatch(marketplace, /listing\.location \|\| listing\.subcategory/);
    assert.doesNotMatch(rotator, /listing\.location \|\| listing\.subcategory/);
    assert.match(rotator, /listing\.category === 'vehicle'/);
    assert.match(rotator, /<Tag/);
    assert.match(marketplace, /quality=\{90\}/);
    assert.match(rotator, /quality=\{88\}/);
  });

  test('hero decorative cards serve original public assets without optimizer recompression', () => {
    const hero = source('src/components/home/HeroShowcase.tsx');
    assert.match(hero, /\/home\/Vinewood Crest Estate\.webp/);
    assert.match(hero, /\/home\/Grotti Turismo R\.webp/);
    assert.match(hero, /\/home\/Nagasaki Shinobi\.png/);
    assert.match(hero, /fill unoptimized[\s\S]*quality=\{95\}/);
    assert.doesNotMatch(hero, /optimizeListingImage|thumbnail|resolveMediaUrl/);
  });

  test('homepage corporate sellers require active non-expired membership', () => {
    const page = source('src/app/page.tsx');
    assert.match(page, /dealer\.subscription_status === 'ACTIVE'/);
    assert.match(page, /dealer\.subscription_expires_at/);
    assert.match(page, /getTime\(\) > now/);
    assert.match(page, /dealer\.moderation_status === 'ACTIVE'/);
  });

  test('vehicle and property columns autoplay in groups of three without manual controls', () => {
    const rotator = source('src/components/home/HomepageListingRotator.tsx');
    assert.match(rotator, /listings\.slice\(index \* 3, index \* 3 \+ 3\)/);
    assert.match(rotator, /window\.setTimeout/);
    assert.match(rotator, /\(current \+ 1\) % pages\.length/);
    assert.match(rotator, /onMouseEnter/);
    assert.match(rotator, /onFocusCapture/);
    assert.match(rotator, /visibilitychange/);
    assert.doesNotMatch(rotator, /ChevronLeft|ChevronRight|homepage-arrow/);
  });

  test('featured showcase uses the dedicated homepage-only label', () => {
    const marketplace = source('src/components/home/HomepageMarketplace.tsx');
    assert.match(marketplace, />Öne Çıkarılan<\/span>/);
  });

  test('section controls use a shared two-row header rhythm without fixed link padding', () => {
    const css = source('src/app/globals.css');
    assert.match(css, /\.homepage-section-header \{[^}]*display: grid/);
    assert.match(css, /grid-template-columns: minmax\(0,1fr\) auto/);
    assert.doesNotMatch(css, /\.homepage-see-all \{[^}]*padding-right/);
    assert.match(css, /\.homepage-section-header \{[^}]*min-height: 58px[^}]*margin-bottom: \.65rem/);
    assert.match(css, /\.homepage-rotator-viewport \{[^}]*overflow: hidden/);
    assert.doesNotMatch(css, /\.homepage-listing-stack \{[^}]*min-height: 22rem/);
  });

  test('responsive four-column and reduced-motion styles remain present', () => {
    const css = source('src/app/globals.css');
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]*minmax\(340px,1\.14fr\)[\s\S]*minmax\(340px,1\.14fr\)/);
    assert.match(css, /@media \(max-width: 639px\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.doesNotMatch(css, /\.homepage-rotator-controls|\.homepage-arrow/);
  });
});