import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import { validateFaviconFile } from '@/app/api/admin/settings/favicon/route';

const source = (path: string) => fs.readFileSync(path, 'utf8');

describe('favicon settings', () => {
  it('updates every rel icon link immediately with the versioned URL', () => {
    const component = source('src/components/admin/FaviconSettings.tsx');
    assert.match(component, /document\.head\.querySelectorAll<HTMLLinkElement>/);
    assert.match(component, /link\[rel~="icon"\]/);
    assert.match(component, /updateDocumentFavicon\(versionedFaviconUrl\(nextFavicon\)\)/);
  });

  it('advertises and processes PNG, JPEG and WEBP but not ICO', () => {
    const component = source('src/components/admin/FaviconSettings.tsx');
    const storage = source('src/lib/storage/index.ts');
    assert.match(component, /accept="image\/png,image\/jpeg,image\/webp"/);
    assert.match(component, /ICO bu dönüştürücü tarafından desteklenmez/);
    assert.doesNotMatch(component, /image\/x-icon|vnd\.microsoft\.icon/);
    assert.match(storage, /\['png', 'jpeg', 'webp'\]/);
  });

  it('uses immutable objects and explicit private database privileges', () => {
    assert.match(source('src/lib/storage/index.ts'), /site\/favicon\/\$\{id\}\.png/);
    assert.match(source('src/lib/storage/r2-provider.ts'), /max-age=31536000, immutable/);
    const sql = source('supabase/migrations/20260927030000_site_favicon_settings.sql');
    assert.match(sql, /references public\.character_profiles\(id\)/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all privileges .* anon, authenticated/);
    assert.match(sql, /grant select, insert, update, delete .* service_role/);
  });

  it('deduplicates legal links and uses the current year', () => {
    const footer = source('src/components/layout/Footer.tsx');
    assert.equal((footer.match(/section=gizlilik/g) || []).length, 1);
    assert.equal((footer.match(/section=kullanim-kosullari/g) || []).length, 1);
    assert.match(footer, /new Date\(\)\.getFullYear\(\)/);
  });
});

describe('favicon route validation behavior', () => {
  it('returns 415 for a declared MIME outside the allowlist', () => {
    const result = validateFaviconFile(
      new File(['svg'], 'favicon.svg', { type: 'image/svg+xml' })
    );
    assert.equal(result?.status, 415);
    assert.match(result?.error || '', /PNG, JPEG veya WEBP/);
  });

  it('returns 413 for an oversized file before MIME validation', () => {
    const result = validateFaviconFile(
      new File([new Uint8Array(1024 * 1024 + 1)], 'favicon.svg', {
        type: 'image/svg+xml',
      })
    );
    assert.equal(result?.status, 413);
    assert.match(result?.error || '', /en fazla 1 MB/);
  });
});