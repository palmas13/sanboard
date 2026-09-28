import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('footer and kesfet UI refinements', () => {
  test('footer keeps one legal navigation set and copyright in the main composition', () => {
    const footer = source('src/components/layout/Footer.tsx');
    assert.equal((footer.match(/section=gizlilik/g) || []).length, 1);
    assert.equal((footer.match(/section=kullanim-kosullari/g) || []).length, 1);
    assert.doesNotMatch(footer, /justify-between gap-4 pt-6/);
    assert.match(footer, /data-testid="footer-copyright"/);
    assert.match(footer, /© \{new Date\(\)\.getFullYear\(\)\} Sanboard/);
  });

  test('navbar and footer share the new common brand asset', () => {
    const logo = source('src/components/common/SanboardLogo.tsx');
    const navbar = source('src/components/layout/Navbar.tsx');
    const footer = source('src/components/layout/Footer.tsx');
    assert.match(logo, /\/brand\/sanboard-mark\.png/);
    assert.match(navbar, /<SanboardLogo size="md"/);
    assert.match(footer, /<SanboardLogo size="md"/);
  });

  test('kesfet content starts directly without a repeated active-section hero', () => {
    const page = source('src/app/kesfet/page.tsx');
    assert.match(page, /data-testid="info-content-panel"/);
    assert.doesNotMatch(page, /ActiveIcon|activeSection\.label|activeSection\.description/);
    assert.doesNotMatch(page, /<header className="mb-8 border-b/);
    for (const section of ['sss', 'kullanim-kosullari', 'gizlilik', 'hakkimizda']) {
      assert.match(page, new RegExp(`key: '${section}'`));
    }
    assert.match(page, /href=\{`\/kesfet\?section=\$\{section\.key\}`\}/);
  });

  test('FAQ uses an accessible full-row animated button trigger', () => {
    const accordion = source('src/components/faq/FaqAccordion.tsx');
    const page = source('src/app/kesfet/page.tsx');
    assert.match(page, /<FaqAccordion items=\{group\.items\} \/>/);
    assert.match(accordion, /<button/);
    assert.match(accordion, /type="button"/);
    assert.match(accordion, /aria-expanded=\{isOpen\}/);
    assert.match(accordion, /aria-controls=\{panelId\}/);
    assert.match(accordion, /w-full cursor-pointer/);
    assert.match(accordion, /focus-visible:ring-2/);
    assert.match(accordion, /duration-200/);
    assert.match(accordion, /grid-rows-\[1fr\]/);
    assert.match(accordion, /grid-rows-\[0fr\]/);
    assert.match(accordion, /aria-hidden=\{!isOpen\}/);
    assert.match(accordion, /ChevronDown/);
  });

  test('kesfet keeps the four content areas separate and uses the requested copy', () => {
    const page = source('src/app/kesfet/page.tsx');
    const categoryOrder = ['Genel', 'Platform', 'Gizlilik & Güvenlik'].map((title) => page.indexOf(`title: '${title}'`));
    assert.ok(categoryOrder.every((index) => index >= 0));
    assert.deepEqual([...categoryOrder].sort((a, b) => a - b), categoryOrder);
    assert.match(page, /Sanboard; araç ve mülk sahiplerinin ilanlarını yayınlayabildiği/);
    assert.match(page, /Sanboard’da teklif sistemi nasıl çalışır\?/);
    assert.match(page, /title: 'Platformun Amacı'/);
    assert.match(page, /title: 'Hizmetin Kötüye Kullanılması'/);
    assert.match(page, /const privacyItems = \[/);
    assert.match(page, /title: 'İletişim Bilgilerinin Görünürlüğü'/);
    assert.match(page, /const aboutItems = \[/);
    assert.match(page, /title: 'Sanboard’un Amacı'/);
    assert.match(page, /title: 'Nasıl Çalışır\?'/);
    assert.doesNotMatch(page, /İlanlar ve hesap|İletişim ve güvenlik|Los Santos’un ilan platformu|Araç pazarı|Mülk portföyü/);
    assert.match(page, /activeKey === 'sss' && <FaqContent \/>/);
    assert.match(page, /activeKey === 'kullanim-kosullari' && <TermsContent \/>/);
    assert.match(page, /activeKey === 'gizlilik' && <PrivacyContent \/>/);
    assert.match(page, /activeKey === 'hakkimizda' && <AboutContent \/>/);
  });
});