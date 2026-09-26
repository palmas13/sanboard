import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { GET as getFollow, POST as setFollow } from '@/app/api/dealers/[id]/follow/route';
import { getListingCoverPath, sortListingImages } from '@/lib/listings/images';
import { resolveMediaUrl } from '@/lib/media/url';
import { notifyNewFollowerBestEffort } from '@/lib/db/follow-notifications';
import { MemoryUserRepository } from '@/lib/db/repositories/memory/memory-user-repo';
import { SupabaseUserRepository } from '@/lib/db/repositories/supabase/supabase-user-repo';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { POST as setFavorite } from '@/app/api/favorites/route';

describe('Critical listing image and corporate follow regressions', () => {
  const accountId = 'follow-account';
  const mavisId = 'follow-mavis';
  const raviId = 'b0de6077-d32b-42dc-909f-d12719749f96';
  const externalRaviId = '44444444-4444-4444-4444-444444444443';
  const outsiderId = 'follow-outsider';
  const storeId = 'follow-store';
  const externalMavisId = '77701';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [
      { id: mavisId, user_id: accountId, external_character_id: externalMavisId, full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: 'mavis@sanmail.com', phone: '1', created_at: '', updated_at: '' },
      { id: raviId, user_id: accountId, external_character_id: externalRaviId, full_name: 'Ravi Blumon', avatar_url: '', sanmail_email: 'ravi@sanmail.com', phone: '2', role: 'USER', created_at: '', updated_at: '' },
      { id: outsiderId, user_id: 'other-account', full_name: 'Other', avatar_url: '', sanmail_email: 'other@sanmail.com', phone: '3', created_at: '', updated_at: '' },
    ];
    db.dealers = [{ id: storeId, profile_id: outsiderId, owner_profile_id: outsiderId, company_name: 'Store', slug: 'store', description: '', logo_url: '', banner_url: '', address: '', phone: '', sanmail_email: '', purpose: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', created_at: '', updated_at: '' }] as any;
    db.followers = [];
    db.favorites = [];
    db.notifications = [];
  });

  function request(profileId: string, method = 'GET', body?: unknown) {
    const token = createSessionToken({ userId: accountId, role: 'USER', profileId });
    return new NextRequest(`http://localhost/api/dealers/${storeId}/follow?profileId=${outsiderId}`, {
      method,
      headers: { cookie: `sanboard_session=${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  test('listing images use cover, sort_order and deterministic secondary ordering', () => {
    const images = [
      { id: 'b', listing_id: 'l', storage_path: 'listings/b.webp', sort_order: 1, is_cover: false, size_bytes: 1, created_at: '2026-01-02' },
      { id: 'c', listing_id: 'l', storage_path: 'listings/c.webp', sort_order: 0, is_cover: false, size_bytes: 1, created_at: '2026-01-01' },
      { id: 'a', listing_id: 'l', storage_path: 'listings/a.webp', sort_order: 9, is_cover: true, size_bytes: 1, created_at: '2026-01-03' },
    ];
    assert.deepEqual(sortListingImages(images).map((image) => image.id), ['a', 'c', 'b']);
    assert.equal(getListingCoverPath(images), 'listings/a.webp');
    assert.equal(resolveMediaUrl(getListingCoverPath(images)), 'https://cdn.sanboard.xyz/listings/a.webp');
  });

  test('production listing gallery has no Tesla/Unsplash fallback and renders neutral empty state', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/listings/ListingGallery.tsx'), 'utf8');
    assert.doesNotMatch(source, /photo-1617788138017-80ad40651399|images\.unsplash\.com/);
    assert.match(source, /Fotoğraf bulunamadı/);
  });

  test('follow is idempotent, character-scoped, and ignores injected profile IDs', async () => {
    const params = { params: Promise.resolve({ id: storeId }) };
    const first = await (await setFollow(request(mavisId, 'POST', { isFollowing: true, profileId: outsiderId }), params)).json();
    const duplicate = await (await setFollow(request(mavisId, 'POST', { isFollowing: true, profileId: outsiderId }), params)).json();
    assert.equal(first.isFollowing, true);
    assert.equal(duplicate.followerCount, 1);
    assert.equal(db.followers.length, 1);
    assert.equal(db.followers[0].follower_profile_id, mavisId);
    assert.equal(db.notifications.filter((notification) => notification.type === 'NEW_FOLLOWER').length, 1);

    const raviState = await (await getFollow(request(raviId), params)).json();
    assert.equal(raviState.isFollowing, false);
    assert.equal(raviState.followerCount, 1);

    const removed = await (await setFollow(request(mavisId, 'POST', { isFollowing: false }), params)).json();
    assert.equal(removed.isFollowing, false);
    assert.equal(removed.followerCount, 0);
  });

  test('follow canonicalizes an external character session ID before mutation', async () => {
    const params = { params: Promise.resolve({ id: storeId }) };
    const response = await setFollow(request(externalMavisId, 'POST', { isFollowing: true }), params);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.isFollowing, true);
    assert.equal(data.followerCount, 1);
    assert.equal(db.followers[0].follower_profile_id, mavisId);
  });

  test('UUID-shaped external character ID resolves to Ravi canonical profile for active profile, favorite and follow', async () => {
    const repo = new MemoryUserRepository();
    assert.equal((await repo.getProfileById(raviId))?.id, raviId);
    assert.equal((await repo.getProfileById(externalRaviId))?.id, raviId);
    assert.equal((await repo.getProfileById(externalMavisId))?.id, mavisId);
    assert.equal(await repo.getProfileById('unknown-character'), null);

    const staleSessionRequest = request(externalRaviId, 'POST', { isFollowing: true });
    const resolved = await resolveOwnedActiveProfile(staleSessionRequest);
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.profileId, raviId);

    const listingId = db.listings[0]?.id;
    assert.ok(listingId);
    const favoriteResponse = await setFavorite(new NextRequest('http://localhost/api/favorites', {
      method: 'POST',
      headers: {
        cookie: staleSessionRequest.headers.get('cookie') || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ listingId, isFavorited: true, profileId: mavisId }),
    }));
    assert.equal(favoriteResponse.status, 200);
    assert.ok(db.favorites.some((favorite) => favorite.profile_id === raviId));
    assert.equal(db.favorites.some((favorite) => favorite.profile_id === mavisId), false);

    const params = { params: Promise.resolve({ id: storeId }) };
    const followResponse = await setFollow(staleSessionRequest, params);
    assert.equal(followResponse.status, 200);
    assert.ok(db.followers.some((follow) => follow.follower_profile_id === raviId));
    assert.equal(db.followers.some((follow) => follow.follower_profile_id === mavisId), false);
  });

  test('profile identifier collision fails safely instead of selecting either profile', async () => {
    db.profiles.push({
      id: externalRaviId,
      user_id: 'collision-account',
      full_name: 'Collision Profile',
      avatar_url: '',
      sanmail_email: 'collision@sanmail.com',
      phone: '9',
      created_at: '',
      updated_at: '',
    });

    const repo = new MemoryUserRepository();
    await assert.rejects(
      () => repo.getProfileById(externalRaviId),
      /Character profile identifier collision/
    );
  });

  test('Supabase getProfileById checks canonical and external namespaces without trusting UUID format', async () => {
    const profiles = [
      db.profiles.find((profile) => profile.id === mavisId)!,
      db.profiles.find((profile) => profile.id === raviId)!,
    ];
    const queriedColumns: string[] = [];
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: (column: 'id' | 'external_character_id', value: string) => ({
            maybeSingle: async () => {
              queriedColumns.push(column);
              return {
                data: profiles.find((profile) => profile[column] === value) || null,
                error: null,
              };
            },
          }),
        }),
      }),
    };
    const repo = new SupabaseUserRepository();
    (repo as any).getAdminClient = () => fakeClient;

    assert.equal((await repo.getProfileById(raviId))?.id, raviId);
    assert.deepEqual(queriedColumns.splice(0), ['id', 'external_character_id']);

    assert.equal((await repo.getProfileById(externalRaviId))?.id, raviId);
    assert.deepEqual(queriedColumns.splice(0), ['id', 'external_character_id']);

    assert.equal((await repo.getProfileById(externalMavisId))?.id, mavisId);
    assert.deepEqual(queriedColumns.splice(0), ['external_character_id']);

    assert.equal(await repo.getProfileById('unknown-character'), null);
    assert.deepEqual(queriedColumns.splice(0), ['external_character_id']);

    profiles.push({
      id: externalRaviId,
      user_id: 'collision-account',
      full_name: 'Collision Profile',
      avatar_url: '',
      sanmail_email: 'collision@sanmail.com',
      phone: '9',
      created_at: '',
      updated_at: '',
    });
    await assert.rejects(
      () => repo.getProfileById(externalRaviId),
      /Character profile identifier collision/
    );
  });

  test('character switch signs the resolved canonical profile id', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/auth/session/route.ts'), 'utf8');
    assert.match(source, /getUserRepository\(\)\.getProfileById\(String\(characterId\)\)/);
    assert.match(source, /const targetProfileId = profile\?\.id \|\| characterId/);
    assert.match(source, /createSessionToken\(\{[\s\S]*profileId: targetProfileId/);
  });

  test('notification failure does not turn a successful follow relation into a failure', async () => {
    const errors: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };

    try {
      await assert.doesNotReject(() => notifyNewFollowerBestEffort(
        {
          recipientProfileId: outsiderId,
          followerName: 'Mavis Pierce',
          corporateProfileId: storeId,
        },
        async () => { throw new Error('notifications_type_check'); }
      ));
      assert.equal(errors.length, 1);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('notification reconciliation preserves canonical types and preflight is read-only', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926040000_notification_types_reconciliation.sql'), 'utf8');
    const preflight = readFileSync(join(process.cwd(), 'supabase/scripts/notification_types_preflight.sql'), 'utf8');
    const canonicalTypes = [
      'LISTING_PRICE_DROP', 'LISTING_PRICE_CHANGE', 'SUPPORT_REPLY', 'SYSTEM',
      'LISTING_EXPIRES_SOON', 'CORPORATE_APPLICATION_APPROVED',
      'CORPORATE_APPLICATION_REJECTED', 'NEW_CORPORATE_LISTING', 'NEW_FOLLOWER',
      'CORPORATE_SUBSCRIPTION_EXPIRING', 'CORPORATE_STORE_SUSPENDED',
      'CORPORATE_STORE_REACTIVATED', 'CORPORATE_STORE_DELETED',
    ];

    for (const type of canonicalTypes) {
      assert.match(migration, new RegExp(`'${type}'`));
      assert.match(preflight, new RegExp(`'${type}'`));
    }
    assert.match(preflight, /pg_get_constraintdef/);
    assert.match(preflight, /GROUP BY type/);
    assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });
});