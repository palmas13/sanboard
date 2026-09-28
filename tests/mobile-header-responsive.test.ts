import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('mobile header responsive regressions', () => {
  test('listing action stays available on desktop but is absent from the mobile menu', () => {
    const navbar = source('src/components/layout/Navbar.tsx');
    assert.match(navbar, /href="\/ilan-ver" className="btn-primary hidden[^\"]*sm:inline-flex"/);
    assert.equal((navbar.match(/href="\/ilan-ver"/g) || []).length, 1);
  });

  test('mobile navigation is viewport-bound and independently scrollable', () => {
    const navbar = source('src/components/layout/Navbar.tsx');
    assert.match(navbar, /aria-controls="mobile-navigation-panel"/);
    assert.match(navbar, /id="mobile-navigation-panel"/);
    assert.match(navbar, /fixed inset-x-0 top-\[68px\]/);
    assert.match(navbar, /max-h-\[calc\(100dvh-68px\)\] overflow-y-auto overscroll-contain/);
    assert.match(navbar, /md:hidden/);
  });

  test('notifications use a mobile viewport panel and preserve the desktop dropdown', () => {
    const notifications = source('src/components/notifications/NotificationDropdown.tsx');
    assert.match(notifications, /fixed inset-x-3 top-\[76px\]/);
    assert.match(notifications, /max-h-\[calc\(100dvh-88px\)\]/);
    assert.match(notifications, /sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-auto sm:mt-2/);
    assert.match(notifications, /sm:max-h-\[360px\]/);
    assert.match(notifications, /sm:opacity-0 sm:group-hover:opacity-100/);
  });
});