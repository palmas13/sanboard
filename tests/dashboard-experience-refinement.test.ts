import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redactPrivateContact } from '@/lib/profiles/contact-privacy';
import { MemoryPaymentRepository } from '@/lib/db/repositories/memory/memory-payment-repo';
import { db } from '@/lib/db/store';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('dashboard experience refinement regressions', () => {
  test('private contact values are removed server-side', () => {
    const profile: any = { id: 'profile', user_id: 'user', full_name: 'Private Seller', avatar_url: '', phone: '555123', sanmail_email: 'private@sanmail.com', phone_visibility: 'PRIVATE', sanmail_visibility: 'PRIVATE', created_at: '', updated_at: '' };
    const redacted = redactPrivateContact(profile)!;
    assert.equal(redacted.phone, '');
    assert.equal(redacted.sanmail_email, '');
  });

  test('payment clear uses a profile cutoff and preserves payment rows', async () => {
    db.profiles = [{ id: 'profile', user_id: 'user', full_name: 'Buyer', avatar_url: '', phone: '', sanmail_email: '', created_at: '', updated_at: '' } as any];
    db.payments = [{ id: 'payment', profile_id: 'profile', order_id: 'order', amount: 2000, status: 'SUCCESS', created_at: '2026-09-26T12:00:00.000Z' } as any];
    const repo = new MemoryPaymentRepository();
    const result = await repo.clearUserPaymentHistory('profile');
    assert.equal(result.success, true);
    assert.equal(db.payments.length, 1);
    assert.deepEqual(await repo.getUserPayments('profile'), []);
  });

  test('public application route requires contact and location without accepting profile identity', () => {
    const route = source('src/app/api/dealers/apply/route.ts');
    assert.match(route, /!contactPhone \|\| !contactEmail \|\| !location/);
    assert.match(route, /profileId: actor\.profileId/);
    assert.doesNotMatch(route, /profileId: body/);
  });

  test('dashboard UI exposes consolidated profile, soft-clear, and full-page wizard', () => {
    assert.doesNotMatch(source('src/app/hesabim/layout.tsx'), /href: '\/hesabim\/iletisim'/);
    assert.match(source('src/app/hesabim/profil/page.tsx'), /phone_visibility/);
    assert.match(source('src/app/hesabim/odemeler/page.tsx'), /method: 'DELETE'/);
    assert.match(source('src/app/hesabim/kurumsal/basvuru/page.tsx'), /const steps = \['İşletme', 'İletişim', 'Faaliyet', 'Onay'\]/);
  });

  test('corporate applications tolerate the pre-migration production schema', () => {
    const repo = source('src/lib/db/repositories/supabase/supabase-dealer-repo.ts');
    assert.match(repo, /missingContactColumns/);
    assert.match(repo, /PGRST204/);
    assert.match(repo, /legacyResult/);
  });

  test('discovery navigation, hero and terms experience stay polished', () => {
    const navbar = source('src/components/layout/Navbar.tsx');
    const home = source('src/app/page.tsx');
    const hero = source('src/components/home/HeroTypewriter.tsx');
    const explore = source('src/app/ilanlari-kesfet/page.tsx');
    const infoCenter = source('src/app/kesfet/page.tsx');
    const footer = source('src/components/layout/Footer.tsx');
    const terms = source('src/app/kullanim-kosullari/page.tsx');
    assert.match(navbar, />Keşfet/);
    assert.doesNotMatch(navbar, />X</);
    assert.doesNotMatch(hero, /hero-caret/);
    assert.match(home, /max-w-4xl flex-col items-center text-center/);
    assert.match(home, /href="\/ilan-ver"/);
    assert.match(home, /href="\/ilanlari-kesfet"/);
    assert.doesNotMatch(home, /Los Santos ilan deneyimi/);
    assert.match(home, /hero-eyebrow-label/);
    assert.match(hero, /justify-center/);
    assert.match(explore, /href: '\/arac'/);
    assert.match(explore, /href: '\/mulk'/);
    assert.match(explore, /Araç mı arıyorsun\?/);
    assert.match(explore, /Mülk mü arıyorsun\?/);
    for (const section of ['sss', 'kullanim-kosullari', 'gizlilik', 'hakkimizda']) {
      assert.match(navbar, new RegExp(`/kesfet\\?section=${section}`));
      assert.match(footer, new RegExp(`/kesfet\\?section=${section}`));
      assert.match(infoCenter, new RegExp(`key: '${section}'`));
    }
    assert.match(infoCenter, /PageProps<'\/kesfet'>/);
    assert.match(terms, /IC · Los Santos/);
    assert.match(terms, /OOC · Platform sınırları/);
    assert.match(terms, /RMT/);
    assert.match(terms, /Platform ve Hesaplar/);
    assert.match(terms, /İlan Yayınlama Kuralları/);
    assert.match(terms, /İletişim ve Satış/);
    assert.match(terms, /Kurumsal Hesaplar/);
    assert.match(terms, /Ücretler ve Süreler/);
    assert.match(terms, /Yaptırımlar ve İhlaller/);
    assert.match(terms, /\$2\.000/);
    assert.match(terms, /7 gün/);
    assert.match(terms, /SanMail/);
  });

  test('requested profile, discovery and listing copy regressions stay fixed', () => {
    const profile = source('src/app/hesabim/profil/page.tsx');
    const navbar = source('src/components/layout/Navbar.tsx');
    const infoCenter = source('src/app/kesfet/page.tsx');
    const vehicles = source('src/app/arac/page.tsx');
    const properties = source('src/app/mulk/page.tsx');
    const popular = source('src/components/home/PopularShowcase.tsx');
    assert.doesNotMatch(profile, /<h3[^>]*>Kimlik<\/h3>/);
    assert.doesNotMatch(profile, /<h3[^>]*>İletişim<\/h3>/);
    assert.match(navbar, /Keşfet Akışı/);
    assert.doesNotMatch(infoCenter, />Sanboard Rehberi</);
    assert.match(vehicles, /<span>Araç İlanları<\/span>/);
    assert.doesNotMatch(vehicles, /Los Santos Araç İlanları/);
    assert.match(properties, /<span>Mülk İlanları<\/span>/);
    assert.doesNotMatch(properties, /Los Santos Mülk İlanları/);
    assert.doesNotMatch(popular, /Canlı Vitrin/);
  });

  test('property view switch preserves URL-owned filters and renders both modes', () => {
    const page = source('src/app/mulk/page.tsx');
    const view = source('src/components/listings/PropertyListingsView.tsx');
    const sortBar = source('src/components/listings/ListingSortBar.tsx');
    assert.match(page, /<PropertyListingsView listings=\{listings\} \/>/);
    assert.match(view, /sanboard_property_view/);
    assert.match(view, /viewMode === 'list'/);
    assert.match(view, /data-testid="property-list-view"/);
    assert.match(view, /data-testid="property-grid-view"/);
    assert.match(view, /<ActiveFilterChips baseRoute="\/mulk" \/>/);
    assert.doesNotMatch(view, /router\.push|URLSearchParams/);
    assert.match(sortBar, /new URLSearchParams\(searchParams\.toString\(\)\)/);
    assert.match(sortBar, /aria-pressed=\{viewMode === 'list'\}/);
    assert.match(sortBar, /aria-pressed=\{viewMode === 'grid'\}/);
  });

  test('dashboard navigation uses accent icons, corporate styling and reduced motion', () => {
    const layout = source('src/app/hesabim/layout.tsx');
    const css = source('src/app/globals.css');
    assert.doesNotMatch(layout, /badge: isCorporateIdentity \? 'PRO'/);
    assert.match(layout, /data-corporate-item=\{item\.isCorporate/);
    for (const accent of ['orange-400', 'blue-400', 'amber-400', 'rose-400', 'emerald-400', 'violet-400']) {
      assert.match(layout, new RegExp(accent));
    }
    assert.match(layout, /dashboard-page-enter/);
    assert.match(css, /dashboard-heading-enter/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /dashboard-page-enter > :first-child \{ animation: none; \}/);
  });
});