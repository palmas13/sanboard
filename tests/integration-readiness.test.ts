import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getStorageProvider,
  resetStorageInstance,
  uploadListingImage,
  uploadProfileAvatar,
  uploadCorporateLogo,
  uploadCorporateBanner,
  CloudflareR2StorageProvider,
  MockStorageProvider,
} from '../src/lib/storage';
import {
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
  getSupabaseClient,
  getSupabaseAdminClient,
} from '../src/lib/db/supabase-client';
import {
  getListingRepository,
  getNotificationRepository,
  getUserRepository,
  getTicketRepository,
  getDealerRepository,
  getPaymentRepository,
} from '../src/lib/db/repositories';

describe('Integration Readiness & Abstraction Tests', () => {
  describe('Cloudflare R2 & Storage Abstraction', () => {
    it('CloudflareR2StorageProvider reports unavailable when env vars are not set', () => {
      const orig = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      try {
        const r2 = new CloudflareR2StorageProvider();
        assert.strictEqual(typeof r2.isAvailable(), 'boolean');
        assert.strictEqual(r2.isAvailable(), false);
      } finally {
        if (orig) process.env.CLOUDFLARE_R2_ACCOUNT_ID = orig;
      }
    });

    it('getStorageProvider throws explicit error when USE_MOCK_STORAGE is false and R2 is missing (silent fallback disabled)', () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      const origAccount = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      process.env.USE_MOCK_STORAGE = 'false';
      delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      resetStorageInstance();
      try {
        assert.throws(() => {
          getStorageProvider();
        }, /USE_MOCK_STORAGE is false, but Cloudflare R2 is missing/);
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        if (origAccount) process.env.CLOUDFLARE_R2_ACCOUNT_ID = origAccount;
        resetStorageInstance();
      }
    });

    it('getStorageProvider returns MockStorageProvider when USE_MOCK_STORAGE is true', () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      process.env.USE_MOCK_STORAGE = 'true';
      resetStorageInstance();
      try {
        const provider = getStorageProvider();
        assert.ok(provider);
        assert.strictEqual(provider.isAvailable(), true);
        assert.ok(provider instanceof MockStorageProvider);
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        resetStorageInstance();
      }
    });

    it('uploadListingImage rejects files exceeding 2MB limit in mock mode', async () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      process.env.USE_MOCK_STORAGE = 'true';
      resetStorageInstance();
      try {
        // 2.5 MB buffer
        const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024);
        const res = await uploadListingImage(largeBuffer, 'large-car.jpg', 'image/jpeg');
        assert.strictEqual(res.success, false);
        assert.match(res.error || '', /Dosya boyutu sınırı aşıldı/);
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        resetStorageInstance();
      }
    });

    it('uploadListingImage succeeds with valid buffer under 2MB in mock mode', async () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      process.env.USE_MOCK_STORAGE = 'true';
      resetStorageInstance();
      try {
        const smallBuffer = Buffer.from('fake-image-bytes-jpeg');
        const res = await uploadListingImage(smallBuffer, 'clean-car.jpg', 'image/jpeg');
        assert.strictEqual(res.success, true);
        assert.ok(res.url.startsWith('data:image/jpeg;base64,'));
        assert.ok(res.key.startsWith('listings/'));
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        resetStorageInstance();
      }
    });

    it('uploadProfileAvatar succeeds with valid avatar in mock mode', async () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      process.env.USE_MOCK_STORAGE = 'true';
      resetStorageInstance();
      try {
        const smallBuffer = Buffer.from('avatar-bytes');
        const res = await uploadProfileAvatar(smallBuffer, 'mavis-avatar.png', 'image/png');
        assert.strictEqual(res.success, true);
        assert.ok(res.url.startsWith('data:image/png;base64,'));
        assert.ok(res.key.startsWith('avatars/'));
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        resetStorageInstance();
      }
    });

    it('uploadCorporateLogo and uploadCorporateBanner succeed with valid assets in mock mode', async () => {
      const origMock = process.env.USE_MOCK_STORAGE;
      process.env.USE_MOCK_STORAGE = 'true';
      resetStorageInstance();
      try {
        const logoBuffer = Buffer.from('logo-bytes');
        const bannerBuffer = Buffer.from('banner-bytes');

        const logoRes = await uploadCorporateLogo(logoBuffer, 'apex-logo.webp', 'image/webp');
        const bannerRes = await uploadCorporateBanner(bannerBuffer, 'apex-banner.jpg', 'image/jpeg');

        assert.strictEqual(logoRes.success, true);
        assert.ok(logoRes.key.startsWith('dealers/logos/'));
        assert.strictEqual(bannerRes.success, true);
        assert.ok(bannerRes.key.startsWith('dealers/banners/'));
      } finally {
        process.env.USE_MOCK_STORAGE = origMock;
        resetStorageInstance();
      }
    });
  });

  describe('Supabase Client Abstraction (New API Key System)', () => {
    it('isSupabaseConfigured returns false when URL and Key are empty or missing', () => {
      assert.strictEqual(isSupabaseConfigured(), false);
      assert.strictEqual(isSupabaseAdminConfigured(), false);
    });

    it('isSupabaseConfigured strictly uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origPub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const origAnon = (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo-project.supabase.co';
        delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        // Even if legacy anon key is provided, without publishable key it must return false
        (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';
        assert.strictEqual(isSupabaseConfigured(), false);

        // When publishable key is provided, it returns true
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_staging_valid_key';
        assert.strictEqual(isSupabaseConfigured(), true);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origPub;
        if (origAnon) {
          (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnon;
        } else {
          delete (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }
      }
    });

    it('isSupabaseAdminConfigured strictly uses SUPABASE_SECRET_KEY', () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origSec = process.env.SUPABASE_SECRET_KEY;
      const origService = (process.env as any).SUPABASE_SERVICE_ROLE_KEY;

      try {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo-project.supabase.co';
        delete process.env.SUPABASE_SECRET_KEY;
        // Even if legacy service role key is set, without secret key it must return false
        (process.env as any).SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-key';
        assert.strictEqual(isSupabaseAdminConfigured(), false);

        // When secret key is set, it returns true
        process.env.SUPABASE_SECRET_KEY = 'sb_sec_staging_valid_key';
        assert.strictEqual(isSupabaseAdminConfigured(), true);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        process.env.SUPABASE_SECRET_KEY = origSec;
        if (origService) {
          (process.env as any).SUPABASE_SERVICE_ROLE_KEY = origService;
        } else {
          delete (process.env as any).SUPABASE_SERVICE_ROLE_KEY;
        }
      }
    });

    it('getSupabaseClient returns null and does NOT attempt network call when not configured', () => {
      const client = getSupabaseClient();
      assert.strictEqual(client, null);
      const adminClient = getSupabaseAdminClient();
      assert.strictEqual(adminClient, null);
    });
  });

  describe('Repository Factory & Business Continuity', () => {
    it('All repository factories instantiate cleanly', () => {
      const listingRepo = getListingRepository();
      const notificationRepo = getNotificationRepository();
      const userRepo = getUserRepository();
      const ticketRepo = getTicketRepository();
      const dealerRepo = getDealerRepository();
      const paymentRepo = getPaymentRepository();

      assert.ok(listingRepo);
      assert.ok(notificationRepo);
      assert.ok(userRepo);
      assert.ok(ticketRepo);
      assert.ok(dealerRepo);
      assert.ok(paymentRepo);
    });

    it('Listing repository can query public listings seamlessly', async () => {
      const repo = getListingRepository();
      const result = await repo.getPublicListings();
      assert.ok(result);
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });

    it('User repository can retrieve seeded profiles', async () => {
      const repo = getUserRepository();
      const profile = await repo.getProfileById('char-mavis-01');
      assert.ok(profile);
      assert.strictEqual(profile.full_name, 'Mavis Pierce');
    });

    it('Dealer repository can retrieve approved dealer store', async () => {
      const repo = getDealerRepository();
      const dealer = await repo.getDealerBySlug('apex-motors');
      assert.ok(dealer);
      assert.strictEqual(dealer.company_name, 'Apex Motors & Luxury Estates');
    });
  });
});
