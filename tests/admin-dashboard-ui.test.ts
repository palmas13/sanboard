import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/app/yonetim/page.tsx', 'utf8');
const css = readFileSync('src/app/yonetim/admin.module.css', 'utf8');

test('admin dashboard uses responsive sidebar and enriched-shape fallbacks', () => {
  assert.match(page, /aria-label="Yönetim bölümleri"/);
  assert.match(page, /data\?\.summary \|\| data\?\.stats/);
  assert.match(page, /data\?\.users\?\.items \|\| data\?\.users \|\| \[\]/);
  assert.match(page, /data\?\.reports\?\.items \|\| data\?\.reports \|\| \[\]/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.doesNotMatch(page, /Tabs Navigation|Sanboard Yönetim Paneli/);
  assert.doesNotMatch(page, /id: 'users'|activeTab === 'users'/);
  assert.match(page, /label: 'İlan Yönetimi'/);
  assert.match(page, /label: 'Kurumsal Yönetim'/);
  assert.match(page, /label: 'Destek Talepleri'/);
  assert.match(page, /<FaviconSettings \/>/);
});

test('operational sections expose scoped headers, search and detail inspection', () => {
  assert.match(page, /Global KPI cards intentionally belong to the overview only/);
  assert.match(page, /pageMeta\[activeTab\]\.title/);
  assert.match(page, /aria-label="Destek taleplerinde ara"/);
  assert.match(page, /aria-label="Ödemelerde ara"/);
  assert.match(page, /aria-labelledby="listing-dialog-title"/);
  assert.match(page, /aria-labelledby="payment-dialog-title"/);
  assert.match(page, />Yayından kaldır</);
});

test('report and corporate dialogs expose accessible modal semantics', () => {
  assert.match(page, /aria-labelledby="report-dialog-title"/);
  assert.match(page, /aria-labelledby="reject-application-title"/);
  assert.match(page, /aria-labelledby="store-manage-title"/);
  assert.match(page, /aria-labelledby="manual-subscription-title"/);
  assert.ok((page.match(/aria-modal="true"/g) || []).length >= 3);
  assert.match(page, /event\.key !== 'Escape'/);
  assert.match(page, /modalCloseRef\.current\?\.focus/);
});

test('report and corporate mutations only close dialogs after successful responses', () => {
  for (const handler of [
    'handleReportAction',
    'handleConfirmRejectApplication',
    'handleConfirmSuspendStore',
    'handleReactivateStore',
    'handleConfirmDeleteStore',
  ]) {
    const start = page.indexOf(`const ${handler}`);
    assert.notEqual(start, -1, `${handler} should exist`);
    const end = page.indexOf('\n  };', start);
    const source = page.slice(start, end);
    assert.match(source, /const response = await fetch/);
    assert.match(source, /if \(!response\.ok\) return;/);
    assert.match(source, /await fetchData\(\)/);
    assert.ok(source.indexOf('if (!response.ok) return;') < source.indexOf('await fetchData()'));
  }
});

test('corporate approval and manual membership actions expose loading, feedback and separated confirmation UX', () => {
  const approvalStart = page.indexOf('const handleApproveApplication');
  const approvalEnd = page.indexOf('\n  };', approvalStart);
  const approval = page.slice(approvalStart, approvalEnd);
  assert.match(approval, /setApplicationActionId\(applicationId\)/);
  assert.match(approval, /await response\.json/);
  assert.match(approval, /setCorporateFeedback\(\{ type: 'error'/);
  assert.match(approval, /await fetchData\(\)/);
  assert.match(page, /Onaylanıyor\.\.\./);
  assert.match(page, /Kurumsal başvuru onaylandı ve satıcı listesine taşındı/);
  assert.match(page, /Üyelik İşlemleri/);
  assert.match(page, /Üyeliği Manuel Aktifleştir/);
  assert.match(page, /Bu işlem için Fleeca ödemesi oluşturulmayacak/);
  assert.match(page, /1 takvim ayı/);
  assert.match(page, /action: 'manuallyActivateCorporateSubscription'/);
  assert.match(page, /setManualActivationModalOpen\(false\)[\s\S]*await fetchData\(\)/);
});