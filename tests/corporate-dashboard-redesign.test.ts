import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const corporate = readFileSync(join(process.cwd(), 'src/app/hesabim/kurumsal/page.tsx'), 'utf8');

describe('corporate marketplace dashboard redesign', () => {
  test('keeps store identity compact and makes verification secondary', () => {
    assert.match(corporate, /\{dealer\.company_name\}[\s\S]*Doğrulanmış kurumsal profil/);
    assert.match(corporate, /Premium Satıcı/);
    assert.doesNotMatch(corporate, /ONAYLI KURUMSAL PROFİL/);
    assert.match(corporate, /Kurumsal İlan Ver/);
    assert.match(corporate, /Mağaza Bilgilerini Düzenle/);
  });

  test('shows useful real-data stats and canonical boost allowance', () => {
    assert.match(corporate, /stats\.activeListings/);
    assert.match(corporate, /followerCount/);
    assert.match(corporate, /CORPORATE_PERIOD_BOOST_ALLOWANCE/);
    assert.match(corporate, /getSubscriptionRemainingLabel\(dealer\.subscription_expires_at\)/);
    assert.match(corporate, /canRenewCorporateSubscription/);
  });

  test('uses optimized cover-only cards with responsive marketplace hierarchy', () => {
    assert.match(corporate, /data-testid="corporate-listing-card"/);
    assert.match(corporate, /getListingCover\(l\)/);
    assert.match(corporate, /<Image[\s\S]*fill[\s\S]*sizes=/);
    assert.doesNotMatch(corporate, /<Image[\s\S]*preload/);
    assert.match(corporate, /sm:flex-row/);
    assert.match(corporate, /İlanı Gör/);
  });

  test('keeps management actions in an accessible overflow menu', () => {
    assert.match(corporate, /aria-haspopup="menu"/);
    assert.match(corporate, /role="menu"/);
    assert.match(corporate, /role="menuitem"/);
    assert.match(corporate, /İlanı Düzenle/);
    assert.match(corporate, /Öne Çıkar/);
    assert.match(corporate, /İlanı Kapat/);
    assert.match(corporate, /openCloseListingModal\(l\)/);
  });

  test('filters and searches only the listing data already returned by the page', () => {
    assert.match(corporate, /Kurumsal İlanlar/);
    assert.match(corporate, /Kurumsal ilanlarda ara/);
    assert.match(corporate, /İlan türü filtresi/);
    assert.match(corporate, /İlan durumu filtresi/);
    assert.match(corporate, /Süresi Dolan/);
    assert.match(corporate, /Satılan/);
    assert.match(corporate, /filteredListings\.map/);
  });
});