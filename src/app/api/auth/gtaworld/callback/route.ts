import { NextRequest, NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import {
  clearLoginAttemptCookie,
  GTAWORLD_OAUTH_ATTEMPT_COOKIE,
  verifyLoginAttemptToken,
} from '@/lib/auth/login-attempt';
import {
  clearCharacterSelectionCookieOnResponse,
  clearSessionCookieOnResponse,
  createCharacterSelectionToken,
  createSessionToken,
  setCharacterSelectionCookieOnResponse,
  setSessionCookieOnResponse,
} from '@/lib/auth/session';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { GtaWorldProviderNotConfiguredError, RealGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/real-provider';

function redirectWithClearedAttempt(req: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, req.url));
  clearLoginAttemptCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const attempt = verifyLoginAttemptToken(req.cookies.get(GTAWORLD_OAUTH_ATTEMPT_COOKIE)?.value || '');
  if (!attempt) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'expired_missing_or_invalid_attempt' } });
    return redirectWithClearedAttempt(req, '/giris?error=invalid_attempt');
  }

  const state = req.nextUrl.searchParams.get('state');
  if (!state || state !== attempt.state) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'state_missing_or_mismatch' } });
    return redirectWithClearedAttempt(req, '/giris?error=invalid_attempt');
  }

  if (req.nextUrl.searchParams.has('error') || req.nextUrl.searchParams.has('error_description')) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'upstream_oauth_error' } });
    return redirectWithClearedAttempt(req, '/giris?error=oauth_denied');
  }

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'missing_authorization_code' } });
    return redirectWithClearedAttempt(req, '/giris?error=missing_code');
  }

  try {
    const provider = new RealGtaWorldAuthProvider();
    const accessToken = await provider.exchangeCodeForToken(code);
    const externalAccount = await provider.fetchAccount(accessToken);
    const { user, profiles } = await syncExternalGameAccount(externalAccount);

    if (user.status !== 'ACTIVE') {
      await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', userId: user.id, metadata: { category: 'account_banned' } });
      return redirectWithClearedAttempt(req, '/giris?error=account_banned');
    }

    const selectedProfile = profiles.length === 1 ? profiles[0] : undefined;
    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
      profileId: selectedProfile?.id || null,
      metadata: { provider: 'gtaworld', characterCount: profiles.length, autoSelected: Boolean(selectedProfile) },
    });

    if (selectedProfile) {
      await recordAuditEvent({
        eventType: 'CHARACTER_SELECTED',
        userId: user.id,
        profileId: selectedProfile.id,
        metadata: { characterName: selectedProfile.full_name, autoSelected: true },
      });
    }

    const destination = selectedProfile
      ? attempt.redirect
      : `/karakter-sec?redirect=${encodeURIComponent(attempt.redirect)}`;
    const response = NextResponse.redirect(new URL(destination, req.url));
    clearLoginAttemptCookie(response);

    if (selectedProfile) {
      setSessionCookieOnResponse(response, createSessionToken({
        userId: user.id,
        profileId: selectedProfile.id,
        role: selectedProfile.role || 'USER',
      }));
      clearCharacterSelectionCookieOnResponse(response);
      response.cookies.set('sanboard_user_id', user.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_role', selectedProfile.role || 'USER', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_profile_id', selectedProfile.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
    } else {
      clearSessionCookieOnResponse(response);
      setCharacterSelectionCookieOnResponse(response, createCharacterSelectionToken(user.id));
      response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
      response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
      response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    }
    return response;
  } catch (error) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'provider_or_sync_exception' } });
    const errorCode = error instanceof GtaWorldProviderNotConfiguredError ? 'provider_not_configured' : 'auth_failed';
    return redirectWithClearedAttempt(req, `/giris?error=${errorCode}`);
  }
}