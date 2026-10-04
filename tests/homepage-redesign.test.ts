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
    const featured = source('src/components/home/HomepageFeaturedRotator.tsx');
    assert.match(featured, /getListingUrl\(listing\)/);
    assert.match(marketplace, /getCorporateUrl\(seller\)/);
    assert.match(rotator, /getListingUrl\(listing\)/);
    assert.match(rotator, /<FavoriteButton/);
    assert.match(featured, /<FavoriteButton/);
    assert.doesNotMatch(marketplace, /listing\.location \|\| listing\.subcategory/);
    assert.doesNotMatch(rotator, /listing\.location \|\| listing\.subcategory/);
    assert.match(rotator, /listing\.category === 'vehicle'/);
    assert.match(rotator, /<Tag/);
    assert.match(featured, /quality=\{90\}/);
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
    const featured = source('src/components/home/HomepageFeaturedRotator.tsx');
    const marketplace = source('src/components/home/HomepageMarketplace.tsx');
    const badge = source('src/components/listings/FeaturedBadge.tsx');
    assert.match(featured, /<FeaturedBadge/);
    assert.match(featured, /icon="rocket"/);
    assert.match(marketplace, /SectionHeader icon=\{Rocket\} title="Öne Çıkan İlanlar"/);
    assert.match(badge, /icon === 'rocket' \? Rocket : Sparkles/);
    assert.doesNotMatch(featured, />Öne Çıkarılan</);
    assert.match(featured, /listing\.description/);
    assert.match(featured, /listing\.subcategory/);
    assert.match(featured, /formatCurrency\(listing\.price\)/);
    assert.match(featured, /day: '2-digit', month: 'short', year: 'numeric'/);
    assert.match(featured, /5000/);
    assert.match(featured, /visibilitychange/);
    assert.match(featured, /onFocusCapture/);
    assert.match(featured, /aspect-\[4\/3\]/);
    assert.match(featured, /line-clamp-2[\s\S]*listing\.title/);
    assert.match(featured, /line-clamp-3[\s\S]*listing\.description/);
    assert.match(featured, /homepage-featured-category/);
    assert.match(featured, /Önceki öne çıkan ilan/);
    assert.match(featured, /Sonraki öne çıkan ilan/);
  });

  test('featured showcase fills the shared desktop height as a hero card', () => {
    const css = source('src/app/globals.css');
    const featured = source('src/components/home/HomepageFeaturedRotator.tsx');
    assert.match(css, /\.homepage-featured-card \{[^}]*display: flex[^}]*flex-direction: column/);
    assert.match(css, /\.homepage-featured-body \{[^}]*flex: 1[^}]*flex-direction: column/);
    assert.match(css, /\.homepage-featured-footer \{[^}]*margin-top: auto/);
    assert.match(css, /\.homepage-featured-arrow \{[^}]*width: 1\.8rem[^}]*height: 1\.8rem/);
    assert.match(css, /\.homepage-featured-category \{[^}]*border-radius: 999px/);
    assert.match(css, /\.homepage-featured-viewport, \.homepage-featured-card \{ height: 100%; \}/);
    assert.match(css, /\.homepage-featured-media \{ min-height: 0; flex: 0 0 46%; aspect-ratio: auto; \}/);
    assert.match(css, /\.homepage-featured-body \{ flex: 1 1 54%; \}/);
    assert.match(featured, /line-clamp-3 shrink-0[\s\S]*listing\.description/);
    assert.match(featured, /homepage-featured-footer flex min-h-7 shrink-0/);
  });

  test('discovery surfaces use the requested headings and preserve descenders', () => {
    const discovery = source('src/app/ilanlari-kesfet/page.tsx');
    const info = source('src/app/kesfet/page.tsx');
    assert.match(discovery, /Sanboard&apos;da keşfet/);
    assert.match(discovery, /pb-2[\s\S]*leading-\[1\.03\]/);
    assert.match(info, />Keşfet Akışı<\/h1>/);
  });

  test('section controls use a shared two-row header rhythm without fixed link padding', () => {
    const css = source('src/app/globals.css');
    assert.match(css, /\.homepage-section-header \{[^}]*display: grid/);
    assert.match(css, /grid-template-columns: minmax\(0,1fr\) auto/);
    assert.doesNotMatch(css, /\.homepage-see-all \{[^}]*padding-right/);
    assert.match(css, /\.homepage-section-header \{[^}]*min-height: 58px[^}]*margin-bottom: \.65rem/);
    assert.match(css, /\.homepage-rotator-viewport \{[^}]*overflow: hidden/);
    assert.doesNotMatch(css, /\.homepage-listing-stack \{[^}]*min-height: 22rem/);
    assert.match(css, /\.homepage-marketplace-content \{[^}]*flex: 1/);
    assert.match(css, /\.homepage-marketplace-content > \* \{ flex: 1; \}/);
  });

  test('responsive four-column and reduced-motion styles remain present', () => {
    const css = source('src/app/globals.css');
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]*minmax\(340px,1\.14fr\)[\s\S]*minmax\(340px,1\.14fr\)/);
    assert.match(css, /@media \(max-width: 639px\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.doesNotMatch(css, /\.homepage-rotator-controls|\.homepage-arrow/);
  });

  test('homepage FAQ reuses the canonical FAQ source with auth-aware support routing', () => {
    const page = source('src/app/page.tsx');
    const faq = source('src/components/home/HomepageFaqSection.tsx');
    const data = source('src/data/faq.ts');
    const explore = source('src/app/kesfet/page.tsx');
    assert.match(page, /<WhySanboardSection \/>[\s\S]*<HomepageFaqSection \/>/);
    assert.match(explore, /import \{ faqGroups \} from '@\/data\/faq'/);
    assert.match(faq, /homepageFaqItems/);
    assert.match(data, /homepageQuestions\.map/);
    assert.equal((data.match(/^  '.*\?',?$/gm) || []).length, 6);
    assert.match(faq, /currentProfile \? supportPath : `\/giris\?redirect=/);
    assert.match(faq, /aria-expanded=\{isOpen\}/);
    assert.match(faq, /aria-controls=\{panelId\}/);
    assert.match(faq, /useState<number \| null>\(0\)/);
  });

  test('why and FAQ sections use one-time viewport reveals and reduced motion support', () => {
    const why = source('src/components/home/WhySanboardSection.tsx');
    const faq = source('src/components/home/HomepageFaqSection.tsx');
    const reveal = source('src/components/home/useHomepageReveal.ts');
    const css = source('src/app/globals.css');
    assert.match(why, /useHomepageReveal/);
    assert.match(faq, /useHomepageReveal/);
    assert.match(reveal, /IntersectionObserver/);
    assert.match(reveal, /prefers-reduced-motion: reduce/);
    assert.match(reveal, /observer\.disconnect\(\)/);
    assert.match(css, /\.homepage-why\[data-revealed="true"\]/);
    assert.match(css, /\.homepage-faq\[data-revealed="true"\]/);
    assert.match(css, /grid-template-columns: minmax\(0,43%\) minmax\(0,57%\)/);
  });
});