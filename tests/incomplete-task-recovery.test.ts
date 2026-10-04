import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/store';
import { CHARACTER_SELECTION_COOKIE, createCharacterSelectionToken } from '@/lib/auth/session';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { GET as listCharacters } from '@/app/api/user/characters/route';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('incomplete previous task recovery', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    process.env.SANBOARD_SESSION_SECRET = 'recovery-test-session-secret-at-least-32-bytes';
    db.users = [];
    db.profiles = [];
  });

  test('three verified characters remain discoverable when only one local profile exists', async () => {
    const characters = [
      { externalCharacterId: 'verified-1', firstName: 'Alpha', lastName: 'One', displayName: 'Alpha One' },
      { externalCharacterId: 'verified-2', firstName: 'Beta', lastName: 'Two', displayName: 'Beta Two' },
      { externalCharacterId: 'verified-3', firstName: 'Gamma', lastName: 'Three', displayName: 'Gamma Three' },
    ];
    const { user } = await syncExternalGameAccount({ externalAccountId: 'verified-account', characters }, { createProfiles: false });
    db.profiles.push({ id: 'local-profile', user_id: user.id, external_character_id: 'verified-1', full_name: 'Alpha One', avatar_url: '', sanmail_email: '', phone: '', role: 'USER', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any);
    const token = createCharacterSelectionToken(user.id, characters);
    const response = await listCharacters(new NextRequest('http://localhost/api/user/characters', { headers: { cookie: `${CHARACTER_SELECTION_COOKIE}=${token}` } }));
    const payload = await response.json();
    assert.equal(payload.characters.length, 3);
    assert.deepEqual(payload.characters.map((item: any) => item.hasProfile), [true, false, false]);
    assert.equal(db.profiles.length, 1, 'discovery must not eagerly create profiles');
  });

  test('about and character selection contain exact required copy and links', () => {
    const about = source('src/app/hakkimizda/page.tsx');
    const picker = source('src/app/karakter-sec/CharacterSelectContent.tsx');
    assert.match(about, /\(\( Sanboard, [\s\S]*palmas[\s\S]*mavisim[\s\S]*Discord adreslerimiz üzerinden bize ulaşabilirsiniz\. \)\)/);
    assert.match(about, /https:\/\/discord\.com\/users\/1081946432401068125/);
    assert.match(about, /https:\/\/discord\.com\/users\/1008025961431830559/);
    assert.doesNotMatch(about, /gerçek para ticaretine aracılık etmez/);
    assert.match(picker, /\(\( Bir GTA World hesabı birden fazla karaktere sahip olabilir\. Her karakterin Sanboard profili bağımsızdır\. \)\)/);
    assert.match(picker, /Profil oluştur/);
    assert.match(picker, /text-amber-500/);
    assert.doesNotMatch(picker, /İlk kurulum gerekli/);
  });

  test('shared toast is wired to transient operations while field validation remains inline', () => {
    const favorite = source('src/components/listings/FavoriteButton.tsx');
    const offers = source('src/components/offers/OfferCenter.tsx');
    const support = source('src/app/hesabim/destek/page.tsx');
    const edit = source('src/app/hesabim/ilanlarim/[id]/duzenle/page.tsx');
    const toast = source('src/components/feedback/ToastProvider.tsx');
    assert.match(favorite, /showToast\(error instanceof Error \? error\.message : 'Favori işlemi tamamlanamadı\.', 'error'\)/);
    assert.match(offers, /useToast/);
    assert.match(offers, /Teklif gönderilemedi\.', 'error'/);
    assert.match(support, /showToast\(err\.message \|\| 'Talep oluşturulamadı\.', 'error'\)/);
    assert.match(edit, /setError\(title\.trim\(\) \? LISTING_TITLE_MAX_ERROR : 'İlan başlığı zorunludur\.'\)/);
    assert.match(toast, /fixed bottom-/);
    assert.match(toast, /sanboard-toast-enter/);
    assert.match(toast, /sanboard-toast-exit/);
  });

  test('package hierarchy and canonical featured badge cover required surfaces', () => {
    const packages = source('src/app/ilan-ver/paket/page.tsx');
    const compare = source('src/app/arac/karsilastir/page.tsx');
    const home = source('src/components/home/HomepageListingRotator.tsx');
    for (const path of ['src/components/listings/ListingCard.tsx', 'src/components/listings/VehicleListingRow.tsx', 'src/components/listings/PropertyListingRow.tsx']) {
      assert.match(source(path), /FeaturedBadge/);
    }
    assert.match(packages, /Yayınlayan Profil/);
    assert.match(packages, /İlan Hakkı/);
    assert.match(packages, /lg:grid-cols-2/);
    assert.match(compare, /<FeaturedBadge/);
    assert.doesNotMatch(compare, /ÖNE ÇIKAN/);
    assert.match(home, /<FeaturedBadge/);
  });

  test('admin removal remains on the canonical durable hard-purge lifecycle', () => {
    const admin = source('src/lib/db/admin.ts');
    const repo = source('src/lib/db/repositories/supabase/supabase-listing-repo.ts');
    const worker = source('src/lib/lifecycle/listing-purge-worker.ts');
    const migration = source('supabase/migrations/20261002030000_durable_listing_purge_and_media_jobs.sql');
    assert.match(admin, /removeListing\(listingId, 'SYSTEM_ADMIN'\)/);
    assert.match(repo, /close_listing_with_offers/);
    assert.match(repo, /ADMIN_PERMANENT_DELETE/);
    assert.match(repo, /enqueue_listing_purge_job/);
    assert.match(worker, /complete_listing_purge_media_key/);
    assert.match(worker, /finalize_listing_purge/);
    assert.match(migration, /DELETE FROM listings WHERE id=l\.id/);
    assert.match(migration, /listing_snapshot/);
  });
});