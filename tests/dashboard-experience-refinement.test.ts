import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redactPrivateContact } from '@/lib/profiles/contact-privacy';
import { MemoryPaymentRepository } from '@/lib/db/repositories/memory/memory-payment-repo';
import { db } from '@/lib/db/store';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('dashboard experience refinement regressions', () => {
  test('private contact values are removed server-side', () => {
    const profile: any = { id: 'profile', user_id: 'user', full_name: 'Private Seller', avatar_url: '', phone: '555123', sanmail_email: 'private@sanmail.com', phone_visibility: 'PRIVATE', sanmail_visibility: 'PRIVATE', created_at: '', updated_at: '' };
    const redacted = redactPrivateContact(profile)!;
    assert.equal(redacted.phone, '');
    assert.equal(redacted.sanmail_email, '');
  });

  test('payment clear uses a profile cutoff and preserves payment rows', async () => {
    db.profiles = [{ id: 'profile', user_id: 'user', full_name: 'Buyer', avatar_url: '', phone: '', sanmail_email: '', created_at: '', updated_at: '' } as any];
    db.payments = [{ id: 'payment', profile_id: 'profile', order_id: 'order', amount: 2000, status: 'SUCCESS', created_at: '2026-09-26T12:00:00.000Z' } as any];
    const repo = new MemoryPaymentRepository();
    const result = await repo.clearUserPaymentHistory('profile');
    assert.equal(result.success, true);
    assert.equal(db.payments.length, 1);
    assert.deepEqual(await repo.getUserPayments('profile'), []);
  });

  test('public application route requires contact and location without accepting profile identity', () => {
    const route = source('src/app/api/dealers/apply/route.ts');
    assert.match(route, /!contactPhone \|\| !contactEmail \|\| !location/);
    assert.match(route, /profileId: actor\.profileId/);
    assert.doesNotMatch(route, /profileId: body/);
  });

  test('dashboard UI exposes consolidated profile, soft-clear, and full-page wizard', () => {
    assert.doesNotMatch(source('src/app/hesabim/layout.tsx'), /href: '\/hesabim\/iletisim'/);
    assert.match(source('src/app/hesabim/profil/page.tsx'), /phone_visibility/);
    assert.match(source('src/app/hesabim/odemeler/page.tsx'), /method: 'DELETE'/);
    assert.match(source('src/app/hesabim/kurumsal/basvuru/page.tsx'), /const steps = \['İşletme', 'İletişim', 'Faaliyet', 'Onay'\]/);
  });
});