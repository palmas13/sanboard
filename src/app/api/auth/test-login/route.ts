import { NextRequest, NextResponse } from 'next/server';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { createCharacterSelectionToken, createSessionToken, clearSessionCookieOnResponse, setCharacterSelectionCookieOnResponse, setSessionCookieOnResponse } from '@/lib/auth/session';
import { assertTestLoginAccountNamespace, isTestLoginEnabled, reconcileTestLoginRoles, TEST_LOGIN_JOHN_CHARACTER_ID } from '@/lib/auth/test-login';
import { MockGtaWorldAuthProvider, resolveTestLoginAccountKey } from '@/lib/integrations/gtaworld/mock-provider';
import { recordAuditEvent } from '@/lib/audit';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isTestLoginEnabled()) return NextResponse.json({ error: 'Test login devre dışı.' }, { status: 404 });

  try {
    const accountKey = resolveTestLoginAccountKey(req.nextUrl.searchParams.get('account'));
    if (!accountKey) return NextResponse.json({ error: 'Geçersiz test hesabı.' }, { status: 400 });
    const provider = new MockGtaWorldAuthProvider(accountKey);
    const externalAccount = await provider.fetchAccount('temporary-test-login');
    assertTestLoginAccountNamespace(externalAccount);
    const { user, profiles: synchronizedProfiles } = await syncExternalGameAccount(externalAccount);
    const profiles = await reconcileTestLoginRoles(user, synchronizedProfiles);
    if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Bu test hesabı ile oturum açılamaz.' }, { status: 403 });

    await recordAuditEvent({ eventType: 'AUTH_LOGIN_SUCCESS', userId: user.id, metadata: { provider: 'temporary-test-login', accountKey, characterCount: profiles.length } });
    const redirect = normalizeInternalRedirect(req.nextUrl.searchParams.get('redirect'));
    if (accountKey === 'secondary') {
      const johnProfiles = profiles.filter((profile) => profile.external_character_id === TEST_LOGIN_JOHN_CHARACTER_ID && profile.user_id === user.id);
      if (johnProfiles.length !== 1) throw new Error('Default secondary test character could not be resolved unambiguously.');
      const john = johnProfiles[0];
      const response = NextResponse.redirect(new URL(redirect, req.url));
      clearSessionCookieOnResponse(response);
      setSessionCookieOnResponse(response, createSessionToken({ userId: user.id, profileId: john.id, role: john.role || 'USER' }));
      response.cookies.set('sanboard_profile_id', john.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_user_id', user.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_role', john.role || 'USER', { path: '/', maxAge: 86400, sameSite: 'lax' });
      return response;
    }
    const destination = `/karakter-sec?redirect=${encodeURIComponent(redirect)}&source=test`;
    const response = NextResponse.redirect(new URL(destination, req.url));
    clearSessionCookieOnResponse(response);
    setCharacterSelectionCookieOnResponse(response, createCharacterSelectionToken(user.id));
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL('/test-giris?error=test_login_failed', req.url));
  }
}