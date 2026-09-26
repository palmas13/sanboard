import { NextRequest, NextResponse } from 'next/server';
import { getGtaWorldAuthProvider, isMockGtaWorldAuthEnabled } from '@/lib/integrations/gtaworld';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import {
  clearCharacterSelectionCookieOnResponse,
  clearSessionCookieOnResponse,
  createCharacterSelectionToken,
  createSessionToken,
  setCharacterSelectionCookieOnResponse,
  setSessionCookieOnResponse,
} from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const isMock = isMockGtaWorldAuthEnabled();

  // 1. Read and validate OAuth attempt cookie
  const attemptCookie = req.cookies.get('gtaw_oauth_attempt')?.value;
  let attemptState: string | undefined;
  let targetRedirect = '/';
  if (isMock) {
    targetRedirect = searchParams.get('redirect') || '/';
  }

  if (attemptCookie) {
    try {
      const parsed = JSON.parse(attemptCookie);
      attemptState = parsed.state;
      if (parsed.redirect && typeof parsed.redirect === 'string') {
        targetRedirect = parsed.redirect;
      }
      // Check attempt expiration (max 10 minutes)
      if (parsed.timestamp && Date.now() - parsed.timestamp > 10 * 60 * 1000) {
        attemptState = undefined; // Expired
      }
    } catch {
      // Malformed cookie
    }
  }

  const provider = getGtaWorldAuthProvider();

  // In real mode, enforce attempt cookie as defense-in-depth AND validate state parameter
  if (!isMock) {
    // 1. Attempt cookie check (Defense-in-depth: proves this browser recently initiated an attempt)
    if (!attemptState) {
      await recordAuditEvent({
        eventType: 'AUTH_LOGIN_FAILURE',
        metadata: { category: 'expired_or_missing_attempt' },
      });
      return NextResponse.redirect(new URL('/giris?error=invalid_attempt', req.url));
    }

    const stateParam = searchParams.get('state');

    // 2. Strict State Verification:
    // If returned, state must strictly match attempt state.
    if (stateParam) {
      if (stateParam !== attemptState) {
        await recordAuditEvent({
          eventType: 'AUTH_LOGIN_FAILURE',
          metadata: { category: 'state_mismatch' },
        });
        return NextResponse.redirect(new URL('/giris?error=invalid_attempt', req.url));
      }
    } else {
      // If state was NOT returned by GTA World:
      // An attempt cookie alone does NOT cryptographically bind the returned code to the request.
      // Real OAuth activation MUST remain blocked until state support is confirmed with the provider.
      if (provider.oauthStateSupport !== 'supported') {
        await recordAuditEvent({
          eventType: 'AUTH_LOGIN_FAILURE',
          metadata: {
            category: 'oauth_state_unverified_or_unsupported',
            oauthStateSupport: provider.oauthStateSupport,
          },
        });
        return NextResponse.redirect(new URL('/giris?error=oauth_state_unsupported', req.url));
      }
    }
  }

  // 2. Check for OAuth error responses from provider
  const oauthError = searchParams.get('error') || searchParams.get('error_description');
  if (oauthError) {
    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_FAILURE',
      metadata: { category: 'upstream_oauth_error' },
    });
    return NextResponse.redirect(new URL('/giris?error=oauth_denied', req.url));
  }

  // 3. Extract code parameter
  const code = searchParams.get('code');
  if (!code) {
    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_FAILURE',
      metadata: { category: 'missing_authorization_code' },
    });
    return NextResponse.redirect(new URL('/giris?error=missing_code', req.url));
  }

  // 4. Server-side token exchange and user sync
  try {
    // Exchange code for access token (never persisted or logged)
    const accessToken = await provider.exchangeCodeForToken(code);

    // Fetch user and characters from GTA World /api/user
    const externalAccount = await provider.fetchAccount(accessToken);

    if (!externalAccount.externalAccountId) {
      throw new Error('Geçersiz GTA World kullanıcı verisi.');
    }

    // Synchronize user and characters into Sanboard
    const { user, profiles } = await syncExternalGameAccount(externalAccount);

    if (user.status !== 'ACTIVE') {
      await recordAuditEvent({
        eventType: 'AUTH_LOGIN_FAILURE',
        userId: user.id,
        metadata: { category: 'account_banned' },
      });
      return NextResponse.redirect(new URL('/giris?error=account_banned', req.url));
    }

    // 5. Establish Sanboard HMAC Session
    const isSingleCharacter = profiles.length === 1;
    const selectedProfile = isSingleCharacter ? profiles[0] : undefined;

    // Audit login success
    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
      profileId: selectedProfile?.id || null,
      metadata: {
        provider: 'gtaworld',
        externalUserId: externalAccount.externalAccountId,
        characterCount: profiles.length,
        autoSelected: isSingleCharacter,
      },
    });

    if (selectedProfile) {
      await recordAuditEvent({
        eventType: 'CHARACTER_SELECTED',
        userId: user.id,
        profileId: selectedProfile.id,
        metadata: {
          characterName: selectedProfile.full_name,
          autoSelected: true,
        },
      });
    }

    // Determine target URL:
    // If exactly 1 character, go to target redirect.
    // If multiple characters, go to /karakter-sec so user can choose.
    const destinationUrl = isSingleCharacter
      ? targetRedirect
      : `/karakter-sec?redirect=${encodeURIComponent(targetRedirect)}`;

    const response = NextResponse.redirect(new URL(destinationUrl, req.url));

    if (selectedProfile) {
      const token = createSessionToken({
        userId: user.id,
        role: selectedProfile.role || 'USER',
        profileId: selectedProfile.id,
      });
      setSessionCookieOnResponse(response, token);
      clearCharacterSelectionCookieOnResponse(response);
    } else {
      clearSessionCookieOnResponse(response);
      setCharacterSelectionCookieOnResponse(response, createCharacterSelectionToken(user.id));
    }

    // Clear temporary OAuth attempt cookie
    response.cookies.set('gtaw_oauth_attempt', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
    });

    // Set routing cookies
    if (selectedProfile) {
      response.cookies.set('sanboard_user_id', user.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_role', selectedProfile.role || 'USER', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('sanboard_profile_id', selectedProfile.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
    } else {
      response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
      response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
      response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    }

    return response;
  } catch (err: any) {
    await recordAuditEvent({
      eventType: 'AUTH_LOGIN_FAILURE',
      metadata: {
        category: 'sync_or_token_exception',
      },
    });

    return NextResponse.redirect(new URL('/giris?error=auth_failed', req.url));
  }
}
