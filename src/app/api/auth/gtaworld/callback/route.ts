import { NextRequest, NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import {
  clearLoginAttemptCookie,
  GTAWORLD_OAUTH_ATTEMPT_COOKIE,
  verifyLoginAttemptToken,
} from '@/lib/auth/login-attempt';
import {
  clearSessionCookieOnResponse,
  createCharacterSelectionToken,
  setCharacterSelectionCookieOnResponse,
} from '@/lib/auth/session';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { GtaWorldProviderNotConfiguredError, GtaWorldTokenError, GtaWorldUserError, RealGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/real-provider';
import crypto from 'crypto';

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
  const stateMatches = Boolean(state) && Buffer.byteLength(state!) === Buffer.byteLength(attempt.state) && crypto.timingSafeEqual(Buffer.from(state!), Buffer.from(attempt.state));
  if (!stateMatches) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'state_missing_or_mismatch' } });
    return redirectWithClearedAttempt(req, '/giris?error=oauth_invalid_state');
  }

  if (req.nextUrl.searchParams.has('error') || req.nextUrl.searchParams.has('error_description')) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'upstream_oauth_error' } });
    return redirectWithClearedAttempt(req, '/giris?error=oauth_cancelled');
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
    const { user } = await syncExternalGameAccount(externalAccount, { createProfiles: false });
    if (user.status !== 'ACTIVE') {
      await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', userId: user.id, metadata: { category: 'account_banned' } });
      return redirectWithClearedAttempt(req, '/giris?error=account_banned');
    }

    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
      profileId: null,
      metadata: { provider: 'gtaworld', characterCount: externalAccount.characters.length, autoSelected: false },
    });
    const destination = `/karakter-sec?redirect=${encodeURIComponent(attempt.redirect)}`;
    const response = NextResponse.redirect(new URL(destination, req.url));
    clearLoginAttemptCookie(response);
    clearSessionCookieOnResponse(response);
    setCharacterSelectionCookieOnResponse(response, createCharacterSelectionToken(user.id, externalAccount.characters.map((character) => ({ externalCharacterId: character.externalCharacterId, firstName: character.firstName || character.displayName, lastName: character.lastName || '' }))));
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    await recordAuditEvent({ eventType: 'AUTH_LOGIN_FAILURE', metadata: { category: 'provider_or_sync_exception' } });
    const errorCode = error instanceof GtaWorldProviderNotConfiguredError ? 'provider_not_configured' : error instanceof GtaWorldTokenError ? 'oauth_token_failed' : error instanceof GtaWorldUserError ? 'oauth_user_failed' : 'oauth_sync_failed';
    return redirectWithClearedAttempt(req, `/giris?error=${errorCode}`);
  }
}