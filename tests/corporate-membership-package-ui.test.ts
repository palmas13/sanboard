import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'src/app/hesabim/kurumsal/page.tsx'), 'utf8');
const types = readFileSync(join(process.cwd(), 'src/types/index.ts'), 'utf8');

describe('corporate membership package presentation', () => {
  test('offers accessible responsive Standard and Plus cards', () => {
    assert.match(page, /CORPORATE_SUBSCRIPTION_30_DAY/);
    assert.match(page, /CORPORATE_PLUS_30_DAY/);
    assert.match(page, /price: 5500/);
    assert.match(page, /price: 25000/);
    assert.match(page, /Ayda 20 ilan hakkı · 14 gün yayın/);
    assert.match(page, /Ayda 3 Boost kredisi/);
    assert.match(page, /Kullanılmayan haklarda rollover/);
    assert.match(page, /sm:grid-cols-2/);
    assert.match(page, /aria-label="Kurumsal üyelik paketleri"/);
    assert.match(page, /aria-label={`\$\{pkg\.name\} paketini seç`}/);
  });

  test('presents active package and separate entitlement counters', () => {
    assert.match(page, /Mevcut Paket/);
    assert.match(page, /active_package_name/);
    assert.match(page, /included_listing_credits/);
    assert.match(page, /included_boost_credits/);
    assert.match(page, /purchased_boost_credits/);
    assert.match(page, /Aynı Paketi Yenile/);
    assert.match(page, /active_package_code === 'CORPORATE_PLUS_30_DAY'/);
    assert.match(page, /dealer\.active_package_code && handleActivateSubscription\(dealer\.active_package_code\)/);
  });

  test('shows an announced confirmation state and declares API fields', () => {
    assert.match(page, /role="status"/);
    assert.match(page, /Paket seçiminiz onaylandı/);
    for (const field of ['active_package_code', 'active_package_name', 'active_package_price', 'included_listing_credits', 'included_boost_credits']) assert.match(types, new RegExp(field));
  });
});