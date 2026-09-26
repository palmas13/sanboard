import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db/store';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { adaptGtaWorldApiUser, ExternalGameAccount } from '@/lib/integrations/gtaworld/types';
import { MockGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/mock-provider';
import { RealGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/real-provider';
import { MockFleecaPaymentProvider } from '@/lib/integrations/fleeca/mock-provider';
import { RealFleecaPaymentProvider } from '@/lib/integrations/fleeca/real-provider';
import { validateExternalPayment, VerifiedExternalPayment } from '@/lib/integrations/fleeca/types';

const account = (characters: ExternalGameAccount['characters']): ExternalGameAccount => ({
  externalAccountId: 'external-account-9001',
  characters,
});

describe('external integrations foundation contracts', () => {
  beforeEach(() => {
    process.env.DATA_STORE = 'memory';
    db.users = [];
    db.profiles = [];
  });

  test('raw GTA World fields are adapted once into opaque canonical account and characters', () => {
    const result = adaptGtaWorldApiUser({
      id: 12345,
      username: 'ignored-by-business-layer',
      character: [
        { id: 'external-char-A', firstname: 'Alex', lastname: 'Stone' },
        { id: 'char_10001', firstname: 'Jordan', lastname: 'Reed' },
        { id: '550e8400-e29b-41d4-a716-446655440000', firstname: 'Morgan', lastname: 'Hale' },
      ],
    });
    assert.equal(result.externalAccountId, '12345');
    assert.deepEqual(result.characters.map((item) => item.externalCharacterId), [
      'external-char-A', 'char_10001', '550e8400-e29b-41d4-a716-446655440000',
    ]);
    assert.equal(result.characters[0].avatarUrl, null);
  });

  test('unknown account supports three characters, rename, and a later character without changing canonical IDs', async () => {
    const first = await syncExternalGameAccount(account([
      { externalCharacterId: 'external-char-A', displayName: 'Alex Stone' },
      { externalCharacterId: 'external-char-B', displayName: 'Jordan Reed' },
      { externalCharacterId: 'external-char-C', displayName: 'Morgan Hale' },
    ]));
    const ids = new Map(first.profiles.map((profile) => [profile.external_character_id, profile.id]));
    const second = await syncExternalGameAccount(account([
      { externalCharacterId: 'external-char-A', displayName: 'Alex Stone' },
      { externalCharacterId: 'external-char-B', displayName: 'Jordan Vale' },
      { externalCharacterId: 'external-char-C', displayName: 'Morgan Hale' },
      { externalCharacterId: 'external-char-D', displayName: 'Taylor North' },
    ]));
    assert.equal(second.user.id, first.user.id);
    assert.equal(second.profiles.length, 4);
    assert.equal(second.profiles.find((profile) => profile.external_character_id === 'external-char-B')?.full_name, 'Jordan Vale');
    assert.equal(second.profiles.find((profile) => profile.external_character_id === 'external-char-B')?.id, ids.get('external-char-B'));
  });

  test('mock and real GTA World providers expose the same canonical application contract', async () => {
    const mock = new MockGtaWorldAuthProvider();
    const snapshot = await mock.fetchAccount('mock-token');
    assert.equal(typeof snapshot.externalAccountId, 'string');
    assert.ok(snapshot.characters.every((character) => typeof character.externalCharacterId === 'string'));
    assert.equal(typeof new RealGtaWorldAuthProvider().fetchAccount, 'function');
  });

  test('Fleeca provider boundary has explicit local/test mock and real implementations', () => {
    assert.equal(typeof new MockFleecaPaymentProvider().verifyPayment, 'function');
    assert.equal(typeof new RealFleecaPaymentProvider().verifyPayment, 'function');
    const selection = readFileSync(join(process.cwd(), 'src/lib/integrations/fleeca/index.ts'), 'utf8');
    assert.match(selection, /USE_MOCK_FLEECA === 'true'/);
    assert.match(selection, /DATA_STORE !== 'supabase'/);
    assert.match(selection, /NODE_ENV !== 'production'/);
  });

  test('payment verification accepts success and rejects pending, failed, amount, payer, and purpose mismatch', () => {
    const expected = {
      orderReference: 'order-1', payerReference: 'profile-B', amount: 2000,
      currency: 'GTA_DOLLAR', purposeReference: 'STANDARD_7_DAY',
    };
    const base: VerifiedExternalPayment = {
      externalTransactionId: 'transaction-1', status: 'VERIFIED', occurredAt: new Date().toISOString(), ...expected,
    };
    assert.equal(validateExternalPayment(base, expected).verified, true);
    assert.deepEqual(validateExternalPayment({ ...base, status: 'PENDING' }, expected), { verified: false, reason: 'PENDING' });
    assert.deepEqual(validateExternalPayment({ ...base, status: 'FAILED' }, expected), { verified: false, reason: 'FAILED' });
    assert.deepEqual(validateExternalPayment({ ...base, amount: 1999 }, expected), { verified: false, reason: 'WRONG_AMOUNT' });
    assert.deepEqual(validateExternalPayment({ ...base, payerReference: 'profile-C' }, expected), { verified: false, reason: 'WRONG_PAYER' });
    assert.deepEqual(validateExternalPayment({ ...base, purposeReference: 'OTHER' }, expected), { verified: false, reason: 'WRONG_PURPOSE' });
  });

  test('duplicate external payment remains protected by the existing completion layer contract', () => {
    const memory = readFileSync(join(process.cwd(), 'src/lib/db/payments.ts'), 'utf8');
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260926020000_business_logic_phase_1.sql'), 'utf8');
    assert.match(memory, /farklı bir sağlayıcı işlem kimliğiyle zaten tamamlanmış/);
    assert.match(migration, /uq_payments_external_payment_id/);
    assert.match(migration, /Bu sağlayıcı işlemi başka bir ödeme için kullanılmış/);
  });

  test('production integration modules contain no named fixture dependency', () => {
    for (const path of [
      'src/lib/auth/gtaworld-sync.ts',
      'src/lib/integrations/gtaworld/real-provider.ts',
      'src/lib/integrations/fleeca/real-provider.ts',
      'src/app/api/checkout/route.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), path), 'utf8');
      assert.doesNotMatch(source, /Mavis|Ravi|Zade|fixture UUID|demo account|seed account/i);
    }
  });
});