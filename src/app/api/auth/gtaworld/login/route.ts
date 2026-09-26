import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGtaWorldAuthProvider, isMockGtaWorldAuthEnabled } from '@/lib/integrations/gtaworld';
import { recordAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const redirect = searchParams.get('redirect') || '/';
  const isMock = isMockGtaWorldAuthEnabled();

  // 1. Explicit mock mode still traverses callback + canonical account/profile sync.
  if (isMock) {
    const callbackUrl = new URL('/api/auth/gtaworld/callback', req.url);
    callbackUrl.searchParams.set('code', 'mock_authorization_code');
    callbackUrl.searchParams.set('redirect', redirect);
    return NextResponse.redirect(callbackUrl);
  }

  // 2. Real OAuth Mode
  try {
    const provider = getGtaWorldAuthProvider();

    // Check configuration
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;
    const redirectUri = process.env.GTAWORLD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/giris?error=oauth_config_missing', req.url)
      );
    }

    // Generate random state identifier for OAuth integrity and CSRF mitigation
    const state = crypto.randomBytes(32).toString('hex');

    // Audit log start of OAuth attempt
    await recordAuditEvent({
      eventType: 'AUTH_OAUTH_STARTED',
      metadata: {
        provider: 'gtaworld',
        redirect,
      },
    });

    const authorizeUrl = provider.getAuthorizeUrl(state);

    const response = NextResponse.redirect(authorizeUrl);

    // Save short-lived attempt cookie (10 min expiry)
    const isProd = process.env.NODE_ENV === 'production';
    const attemptPayload = JSON.stringify({ state, redirect, timestamp: Date.now() });

    response.cookies.set('gtaw_oauth_attempt', attemptPayload, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(`/giris?error=oauth_init_failed`, req.url)
    );
  }
}
