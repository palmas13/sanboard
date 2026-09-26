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

describe('Critical listing image and corporate follow regressions', () => {
  const accountId = 'follow-account';
  const mavisId = 'follow-mavis';
  const raviId = 'follow-ravi';
  const outsiderId = 'follow-outsider';
  const storeId = 'follow-store';
  const externalMavisId = '77701';

  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.profiles = [
      { id: mavisId, user_id: accountId, external_character_id: externalMavisId, full_name: 'Mavis Pierce', avatar_url: '', sanmail_email: 'mavis@sanmail.com', phone: '1', created_at: '', updated_at: '' },
      { id: raviId, user_id: accountId, full_name: 'Ravi Blumon', avatar_url: '', sanmail_email: 'ravi@sanmail.com', phone: '2', created_at: '', updated_at: '' },
      { id: outsiderId, user_id: 'other-account', full_name: 'Other', avatar_url: '', sanmail_email: 'other@sanmail.com', phone: '3', created_at: '', updated_at: '' },
    ];
    db.dealers = [{ id: storeId, profile_id: outsiderId, owner_profile_id: outsiderId, company_name: 'Store', slug: 'store', description: '', logo_url: '', banner_url: '', address: '', phone: '', sanmail_email: '', purpose: '', status: 'APPROVED', moderation_status: 'ACTIVE', subscription_status: 'ACTIVE', created_at: '', updated_at: '' }] as any;
    db.followers = [];
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
});