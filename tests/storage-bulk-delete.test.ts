import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { MockStorageProvider } from '../src/lib/storage/mock-provider';
import { CloudflareR2StorageProvider } from '../src/lib/storage/r2-provider';

describe('storage bulk deletion', () => {
  it('mock treats missing objects as success and exposes injected partial failures', async () => {
    const mock = new MockStorageProvider({ failDeletesFor: ['avatars/fail.webp'] });
    await mock.upload(Buffer.from('x'), {
      fileName: 'ok.webp',
      contentType: 'image/webp',
      category: 'avatar',
      key: 'avatars/ok.webp',
    });

    const result = await mock.deleteMany([
      'avatars/ok.webp',
      'avatars/missing.webp',
      'avatars/fail.webp',
    ]);

    assert.equal(result.success, false);
    assert.deepEqual(result.results.map(({ key, success }) => ({ key, success })), [
      { key: 'avatars/ok.webp', success: true },
      { key: 'avatars/missing.webp', success: true },
      { key: 'avatars/fail.webp', success: false },
    ]);
    assert.deepEqual((await mock.list()).objects, []);
  });

  it('R2 chunks requests and maps service errors to per-key results', async () => {
    const env = {
      CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
      CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    };
    Object.assign(process.env, {
      CLOUDFLARE_R2_ACCOUNT_ID: 'account',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'access',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
      CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
    });

    try {
      const provider = new CloudflareR2StorageProvider();
      const commands: DeleteObjectsCommand[] = [];
      (provider as any).client = {
        send: async (command: DeleteObjectsCommand) => {
          commands.push(command);
          const keys = command.input.Delete?.Objects?.map((object) => object.Key) || [];
          return keys.includes('avatars/fail.webp')
            ? { Errors: [{ Key: 'avatars/fail.webp', Code: 'AccessDenied', Message: 'denied' }] }
            : {};
        },
      };
      const keys = Array.from({ length: 1001 }, (_, index) => `avatars/${index}.webp`);
      keys[1000] = 'avatars/fail.webp';

      const result = await provider.deleteMany(keys);

      assert.equal(commands.length, 2);
      assert.ok(commands.every((command) => command instanceof DeleteObjectsCommand));
      assert.equal(commands[0].input.Delete?.Objects?.length, 1000);
      assert.equal(commands[1].input.Delete?.Objects?.length, 1);
      assert.equal(result.success, false);
      assert.equal(result.results.length, keys.length);
      assert.deepEqual(result.results[1000], {
        key: 'avatars/fail.webp', success: false, error: 'denied',
      });
      assert.equal(result.results[999].success, true);
    } finally {
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
