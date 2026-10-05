import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'src/app/hesabim/kurumsal/page.tsx'), 'utf8');
const types = readFileSync(join(process.cwd(), 'src/types/index.ts'), 'utf8');
const repository = readFileSync(join(process.cwd(), 'src/lib/db/repositories/supabase/supabase-dealer-repo.ts'), 'utf8');

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

  test('loads existing profiles and their service-role-only membership summary through the admin repository client', () => {
    const lookup = repository.match(/async getDealerByProfileId[\s\S]*?\n  }\n\n  async getAllDealers/)?.[0] || '';
    assert.match(lookup, /const client = this\.getAdminClient\(\)/);
    assert.match(lookup, /from\('corporate_profiles'\)[\s\S]*eq\('owner_profile_id', profileId\)/);
    assert.match(lookup, /client\.rpc\('get_corporate_membership_summary'/);
    assert.match(lookup, /return membershipSummary[\s\S]*mapCorporateProfile/);
    assert.doesNotMatch(lookup, /const client = this\.getClient\(\)/);
  });

  test('does not interpret a failed corporate profile request as dealer absence', () => {
    assert.match(page, /if \(!dealerRes\.ok\) \{\s*throw new Error\(data\.error \|\| 'Kurumsal profil alınamadı\.'\);\s*\}/);
    assert.match(page, /setDealerLoadError\(err\?\.message \|\| 'Kurumsal profil alınamadı\.'\)/);
    assert.match(page, /dealerLoadError \? \([\s\S]*Kurumsal Profil Yüklenemedi[\s\S]*Tekrar Dene[\s\S]*\) : dealer\?\.moderation_status/);
  });

  test('keeps approved inactive or expired profiles in package selection instead of the application CTA', () => {
    assert.match(page, /dealer\?\.status === 'APPROVED' && dealer\?\.subscription_status === 'ACTIVE' && !isSubscriptionExpired/);
    assert.match(page, /\) : dealer\?\.status === 'APPROVED' \? \([\s\S]*CORPORATE_MEMBERSHIP_PACKAGES\.map/);
    assert.match(page, /\) : \([\s\S]*CASE 5: NEW APPLICATION[\s\S]*Başvuruyu Başlat/);
  });
});