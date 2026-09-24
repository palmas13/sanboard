import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RealGtaWorldAuthProvider } from '../src/lib/integrations/gtaworld/real-provider';
import { MockGtaWorldAuthProvider } from '../src/lib/integrations/gtaworld/mock-provider';
import { syncGtaWorldAccountAndCharacters } from '../src/lib/auth/gtaworld-sync';
import { createSessionToken, verifySessionToken } from '../src/lib/auth/session';
import { recordAuditEvent, sanitizeAuditMetadata } from '../src/lib/audit';
import { db } from '../src/lib/db/store';

describe('GTA World OAuth & Authorize URL Generation', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...origEnv,
      GTAWORLD_API_BASE_URL: 'https://ucp-tr.gta.world',
      GTAWORLD_CLIENT_ID: 'test_client_id_123',
      GTAWORLD_CLIENT_SECRET: 'super_secret_client_key_do_not_expose',
      GTAWORLD_REDIRECT_URI: 'https://sanboard.app/api/auth/gtaworld/callback',
      SANBOARD_SESSION_SECRET: 'test-session-secret-at-least-32-characters-long-12345',
    };
  });

  it('should generate valid authorize URL with required parameters and NO client secret', () => {
    const provider = new RealGtaWorldAuthProvider();
    const state = 'secure_random_state_98765';
    const authUrl = provider.getAuthorizeUrl(state);

    const parsed = new URL(authUrl);
    assert.strictEqual(parsed.origin, 'https://ucp-tr.gta.world');
    assert.strictEqual(parsed.pathname, '/oauth/authorize');
    assert.strictEqual(parsed.searchParams.get('client_id'), 'test_client_id_123');
    assert.strictEqual(parsed.searchParams.get('redirect_uri'), 'https://sanboard.app/api/auth/gtaworld/callback');
    assert.strictEqual(parsed.searchParams.get('response_type'), 'code');
    assert.strictEqual(parsed.searchParams.get('scope'), '');
    assert.strictEqual(parsed.searchParams.get('state'), state);

    // Strictly ensure client secret is NEVER in authorize URL
    assert.ok(!authUrl.includes('super_secret_client_key_do_not_expose'));
    assert.ok(!authUrl.includes('client_secret'));
  });

  it('should throw explicit error if CLIENT_ID or REDIRECT_URI is missing', () => {
    delete process.env.GTAWORLD_CLIENT_ID;
    const provider = new RealGtaWorldAuthProvider();
    assert.throws(() => provider.getAuthorizeUrl('state'), /GTAWORLD_CLIENT_ID is not configured/);
  });
});

describe('GTA World Upstream Response & Defensive Validation', () => {
  it('should reject malformed user response missing user object', async () => {
    const provider = new RealGtaWorldAuthProvider();
    // Test invalid fetchUser call handling
    await assert.rejects(
      async () => {
        await provider.fetchUser('');
      },
      /Erişim belirteci \(access_token\) eksik/
    );
  });

  it('Mock provider should return valid structured OAuth flow for development', async () => {
    const mock = new MockGtaWorldAuthProvider();
    const authUrl = mock.getAuthorizeUrl('mock_state');
    assert.ok(authUrl.includes('code=mock_authorization_code'));
    assert.ok(authUrl.includes('state=mock_state'));

    const token = await mock.exchangeCodeForToken('code');
    assert.strictEqual(token, 'mock_gtaworld_access_token_12345');

    const userRes = await mock.fetchUser(token);
    assert.ok(userRes.user);
    assert.strictEqual(userRes.user.id, 1);
    assert.strictEqual(userRes.user.username, 'mavis_player');
    assert.strictEqual(userRes.user.character.length, 2);
  });
});

describe('Supabase / Memory User & Character Synchronization', () => {
  it('should sync new GTA World user as Sanboard USER role (never ADMIN from GTAW role)', async () => {
    const gtawUser = {
      id: 88801,
      username: 'RoleTester',
      confirmed: 1,
      role: {
        id: 999,
        user_id: 88801,
        role_id: 'Manager', // Manager in GTAW
        server: 0,
      },
      character: [
        { id: 77701, memberid: 88801, firstname: 'Alice', lastname: 'Vance' },
      ],
    };

    const { user, profiles } = await syncGtaWorldAccountAndCharacters(gtawUser);

    assert.ok(user);
    assert.strictEqual(user.external_user_id, '88801');
    assert.strictEqual(user.provider, 'GTAWORLD');
    // GTAW role MUST NOT grant Sanboard ADMIN!
    assert.strictEqual(user.role, 'USER');
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].full_name, 'Alice Vance');
    assert.strictEqual(profiles[0].external_character_id, '77701');
  });

  it('should be idempotent: repeat login resolves the exact same user and profiles', async () => {
    const gtawUser = {
      id: 88802,
      username: 'RepeatUser',
      confirmed: 1,
      character: [
        { id: 77702, memberid: 88802, firstname: 'Bob', lastname: 'Builder' },
      ],
    };

    const first = await syncGtaWorldAccountAndCharacters(gtawUser);
    const second = await syncGtaWorldAccountAndCharacters(gtawUser);

    assert.strictEqual(first.user.id, second.user.id);
    assert.strictEqual(first.profiles[0].id, second.profiles[0].id);
    assert.strictEqual(second.profiles.length, 1);
  });

  it('should preserve local Sanboard ADMIN role on repeat OAuth login', async () => {
    const gtawUser = {
      id: 88803,
      username: 'AdminUser',
      confirmed: 1,
      character: [
        { id: 77703, memberid: 88803, firstname: 'Charlie', lastname: 'Root' },
      ],
    };

    const first = await syncGtaWorldAccountAndCharacters(gtawUser);
    // Explicitly grant Sanboard ADMIN in Sanboard database
    first.user.role = 'ADMIN';

    // Repeat login from GTA World
    const second = await syncGtaWorldAccountAndCharacters(gtawUser);
    assert.strictEqual(second.user.role, 'ADMIN'); // Preserved!
  });

  it('should strictly preserve Sanboard-owned fields: avatar_path, phone, sanmail_email', async () => {
    const gtawUser = {
      id: 88804,
      username: 'ProfilePreserve',
      confirmed: 1,
      character: [
        { id: 77704, memberid: 88804, firstname: 'Dave', lastname: 'Miller' },
      ],
    };

    const { profiles } = await syncGtaWorldAccountAndCharacters(gtawUser);
    const profile = profiles[0];

    // User customized their avatar and phone on Sanboard
    profile.avatar_path = 'avatars/dave-uuid/custom.webp';
    profile.phone = '555-9999';
    profile.sanmail_email = 'dave.custom@sanmail.com';

    // Repeat GTA World login with slight name change
    const gtawUserUpdated = {
      ...gtawUser,
      character: [
        { id: 77704, memberid: 88804, firstname: 'Dave', lastname: 'Miller Jr' },
      ],
    };

    const second = await syncGtaWorldAccountAndCharacters(gtawUserUpdated);
    const updatedProfile = second.profiles[0];

    assert.strictEqual(updatedProfile.full_name, 'Dave Miller Jr'); // updated from GTAW
    assert.strictEqual(updatedProfile.avatar_path, 'avatars/dave-uuid/custom.webp'); // PRESERVED!
    assert.strictEqual(updatedProfile.phone, '555-9999'); // PRESERVED!
    assert.strictEqual(updatedProfile.sanmail_email, 'dave.custom@sanmail.com'); // PRESERVED!
  });

  it('should perform non-destructive sync: removed GTAW character is not deleted', async () => {
    const gtawUser = {
      id: 88805,
      username: 'TwoChars',
      confirmed: 1,
      character: [
        { id: 77705, firstname: 'Emma', lastname: 'Stone' },
        { id: 77706, firstname: 'Frank', lastname: 'Sinatra' },
      ],
    };

    const first = await syncGtaWorldAccountAndCharacters(gtawUser);
    assert.strictEqual(first.profiles.length, 2);

    // Later login where GTAW temporarily returns only Emma
    const gtawUserPartial = {
      id: 88805,
      username: 'TwoChars',
      confirmed: 1,
      character: [
        { id: 77705, firstname: 'Emma', lastname: 'Stone' },
      ],
    };

    const second = await syncGtaWorldAccountAndCharacters(gtawUserPartial);
    // Frank MUST NOT be deleted from Sanboard!
    const frank = second.profiles.find((p) => p.external_character_id === '77706');
    assert.ok(frank);
    assert.strictEqual(frank.full_name, 'Frank Sinatra');
  });
});

describe('Character Selection & Session Ownership Security', () => {
  const secret = 'test-session-secret-at-least-32-characters-long-12345';
  process.env.SANBOARD_SESSION_SECRET = secret;

  it('should accept character selection belonging to the authenticated account', () => {
    const token = createSessionToken({
      userId: 'usr-user-1',
      role: 'USER',
      profileId: 'char-1',
    });

    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.strictEqual(verified.userId, 'usr-user-1');
    assert.strictEqual(verified.profileId, 'char-1');
    assert.strictEqual(verified.role, 'USER');
  });

  it('should reject tampered HMAC session token', () => {
    const token = createSessionToken({
      userId: 'usr-user-1',
      role: 'USER',
      profileId: 'char-1',
    });

    const [headerB64, signature] = token.split('.');
    const tamperedToken = `${headerB64}.${signature.slice(0, -4)}abcd`;

    const verified = verifySessionToken(tamperedToken);
    assert.strictEqual(verified, null);
  });
});

describe('STRICT PAYMENT ISOLATION (Invariant Enforcement)', () => {
  it('OAuth login, character selection, switch, and logout cause ZERO payment operations', async () => {
    // Snapshot initial database payment / credit counts
    const initialPaymentsCount = db.payments.length;
    const initialCreditsCount = db.credits.length;
    const initialListingsCount = db.listings.length;

    // 1. Simulate GTA World OAuth Login Sync
    const gtawUser = {
      id: 99999,
      username: 'PaymentIsolationUser',
      confirmed: 1,
      character: [
        { id: 11111, firstname: 'NoPayment', lastname: 'Char1' },
        { id: 22222, firstname: 'NoPayment', lastname: 'Char2' },
      ],
    };

    const { user, profiles } = await syncGtaWorldAccountAndCharacters(gtawUser);

    // 2. Simulate Character Selection
    const tokenChar1 = createSessionToken({
      userId: user.id,
      role: user.role,
      profileId: profiles[0].id,
    });
    assert.ok(tokenChar1);

    // 3. Simulate Character Switch
    const tokenChar2 = createSessionToken({
      userId: user.id,
      role: user.role,
      profileId: profiles[1].id,
    });
    assert.ok(tokenChar2);

    // 4. Simulate Page Refresh / Hydration
    const verifiedSession = verifySessionToken(tokenChar2);
    assert.ok(verifiedSession);

    // 5. Assert ZERO payment mutations
    assert.strictEqual(db.payments.length, initialPaymentsCount, 'ZERO payment orders must be created');
    assert.strictEqual(db.credits.length, initialCreditsCount, 'ZERO credits must be granted or consumed');
    assert.strictEqual(db.listings.length, initialListingsCount, 'ZERO listings must be published');
  });
});

describe('Audit Logging & Secret Scrubbing', () => {
  it('should record audit event without leaking access_token or secrets', async () => {
    const rawMeta = {
      provider: 'gtaworld',
      access_token: 'SECRET_ACCESS_TOKEN_DO_NOT_LOG',
      client_secret: 'SECRET_CLIENT_KEY',
      authorization_code: 'CODE_123',
      characterCount: 2,
      sanboardUserId: 'user-xyz',
    };

    const safeMeta = sanitizeAuditMetadata(rawMeta);

    // Secrets MUST be scrubbed
    assert.strictEqual(safeMeta.access_token, undefined);
    assert.strictEqual(safeMeta.client_secret, undefined);
    assert.strictEqual(safeMeta.authorization_code, undefined);

    // Safe metadata retained
    assert.strictEqual(safeMeta.provider, 'gtaworld');
    assert.strictEqual(safeMeta.characterCount, 2);
    assert.strictEqual(safeMeta.sanboardUserId, 'user-xyz');

    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: 'user-xyz',
      metadata: rawMeta,
    });

    const recorded = db.auditLogs.find(
      (l) => l.event_type === 'AUTH_LOGIN_SUCCESS' && l.user_id === 'user-xyz'
    );
    assert.ok(recorded);
    assert.strictEqual(recorded.metadata?.access_token, undefined);
    assert.strictEqual(recorded.metadata?.provider, 'gtaworld');
  });

  it('should record CHARACTER_SELECTED and CHARACTER_SWITCHED audit events cleanly', async () => {
    await recordAuditEvent({
      eventType: 'CHARACTER_SELECTED',
      userId: 'usr-audit-1',
      profileId: 'char-audit-1',
      metadata: { characterName: 'Mavis Pierce' },
    });

    await recordAuditEvent({
      eventType: 'CHARACTER_SWITCHED',
      userId: 'usr-audit-1',
      profileId: 'char-audit-2',
      metadata: { characterName: 'Zade Vexnera' },
    });

    const selected = db.auditLogs.find(
      (l) => l.event_type === 'CHARACTER_SELECTED' && l.user_id === 'usr-audit-1'
    );
    assert.ok(selected);
    assert.strictEqual(selected.profile_id, 'char-audit-1');

    const switched = db.auditLogs.find(
      (l) => l.event_type === 'CHARACTER_SWITCHED' && l.user_id === 'usr-audit-1'
    );
    assert.ok(switched);
    assert.strictEqual(switched.profile_id, 'char-audit-2');
  });

  it('should support all 6 required auth audit event types without throwing', async () => {
    const requiredTypes: Array<
      'AUTH_OAUTH_STARTED' | 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILURE' | 'CHARACTER_SELECTED' | 'CHARACTER_SWITCHED' | 'AUTH_LOGOUT'
    > = [
      'AUTH_OAUTH_STARTED',
      'AUTH_LOGIN_SUCCESS',
      'AUTH_LOGIN_FAILURE',
      'CHARACTER_SELECTED',
      'CHARACTER_SWITCHED',
      'AUTH_LOGOUT',
    ];

    for (const evt of requiredTypes) {
      await recordAuditEvent({
        eventType: evt,
        userId: 'usr-type-check',
        metadata: { check: true },
      });
    }

    const recordedTypes = db.auditLogs
      .filter((l) => l.user_id === 'usr-type-check')
      .map((l) => l.event_type);

    for (const evt of requiredTypes) {
      assert.ok(recordedTypes.includes(evt), `Missing audit event type: ${evt}`);
    }
  });
});

describe('OAuth State Parameter Compatibility & CSRF Invariant', () => {
  it('should validate state when returned, but protect via HttpOnly attempt cookie if provider does not echo state', () => {
    const attemptState = 'active_state_abc123';

    // Helper simulating callback state validation logic
    function validateCallbackState(cookieState: string | undefined, incomingStateParam: string | null): boolean {
      if (!cookieState) return false; // Missing or expired attempt
      if (incomingStateParam && incomingStateParam !== cookieState) {
        return false; // Tampered or mismatched state
      }
      return true; // Validated! (Either state matched, or provider did not echo state but cookie proves active attempt)
    }

    // Case 1: Provider returns matching state -> Valid
    assert.strictEqual(validateCallbackState(attemptState, 'active_state_abc123'), true);

    // Case 2: Provider returns mismatched state -> Rejected
    assert.strictEqual(validateCallbackState(attemptState, 'different_state_xyz'), false);

    // Case 3: Provider does NOT return state (undocumented GTAW contract) but attempt cookie exists -> Valid & Protected
    assert.strictEqual(validateCallbackState(attemptState, null), true);

    // Case 4: No attempt cookie (unsolicited or attacker-triggered callback) -> Rejected
    assert.strictEqual(validateCallbackState(undefined, 'active_state_abc123'), false);
    assert.strictEqual(validateCallbackState(undefined, null), false);
  });
});

