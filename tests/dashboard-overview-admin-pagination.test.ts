import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('dashboard overview and admin pagination regressions', () => {
  test('overview explains and exposes the available listing entitlement', () => {
    const overview = source('src/app/hesabim/page.tsx');
    assert.match(overview, /İlan Haklarım/);
    assert.match(overview, /creditPresentation\.total/);
    assert.match(overview, /stats\.individualCredits/);
    assert.match(overview, /stats\.corporateCredits/);
    assert.doesNotMatch(overview, /İlan Hakkı=|Süresi Dolan İlanlarım/);
    assert.match(overview, /Haklar yalnızca tanımlandıkları bireysel profil veya kurumsal mağaza kapsamında kullanılabilir/);
    assert.match(overview, /İlan Hakkımı Kullan/);
    assert.match(overview, /individualCredits/);
  });

  test('corporate inventory exposes active boost state and remaining time', () => {
    const corporate = source('src/app/hesabim/kurumsal/page.tsx');
    assert.match(corporate, /Aktif Boost/);
    assert.match(corporate, /formatTimeRemaining\(l\.featured_until\)/);
    assert.match(corporate, /dealer\.boost_credits/);
    assert.doesNotMatch(corporate, /boost_credits \?\? 0\}\/3/);
  });

  test('personal listing actions have a symmetric fixed-width layout', () => {
    const listings = source('src/app/hesabim/ilanlarim/page.tsx');
    assert.match(listings, /grid grid-cols-3 sm:grid-cols-1 items-stretch/);
    assert.match(listings, /sm:w-32/);
  });

  test('admin collections initially show 20 rows and load 20 more', () => {
    const admin = source('src/app/yonetim/page.tsx');
    assert.match(admin, /const ADMIN_PAGE_SIZE = 20/);
    assert.match(admin, /visibleCount\('listings'\)/);
    assert.match(admin, /visibleCount\('tickets'\)/);
    assert.match(admin, /visibleCount\('payments'\)/);
    assert.match(admin, /visibleCount\('reports'\)/);
    assert.match(admin, /visibleCount\('applications'\)/);
    assert.match(admin, /visibleCount\('dealers'\)/);
    assert.match(admin, /\+ ADMIN_PAGE_SIZE/);
    assert.match(admin, /Daha Fazla Göster/);
  });

  test('payment history clear remains a soft, explicitly described action', () => {
    const payments = source('src/app/hesabim/odemeler/page.tsx');
    const route = source('src/app/api/user/payments/route.ts');
    assert.match(payments, /method: 'DELETE'/);
    assert.match(payments, /yalnızca geçmişi bu karakter profilinin görünümünden kaldırır/);
    assert.match(route, /clearUserPaymentHistory\(actor\.profileId\)/);
  });
});