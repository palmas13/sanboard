import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import { createLoginAttemptToken, setLoginAttemptCookie } from '@/lib/auth/login-attempt';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';
import { GtaWorldProviderNotConfiguredError, RealGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/real-provider';

export async function GET(req: NextRequest) {
  const redirect = normalizeInternalRedirect(req.nextUrl.searchParams.get('redirect'));
  try {
    const provider = new RealGtaWorldAuthProvider();
    const state = crypto.randomBytes(32).toString('base64url');
    const authorizeUrl = provider.getAuthorizeUrl(state);

    await recordAuditEvent({ eventType: 'AUTH_OAUTH_STARTED', metadata: { provider: 'gtaworld', redirect } });
    const response = NextResponse.redirect(authorizeUrl);
    setLoginAttemptCookie(response, createLoginAttemptToken(state, redirect));
    return response;
  } catch (error) {
    const errorCode = error instanceof GtaWorldProviderNotConfiguredError ? 'provider_not_configured' : 'oauth_init_failed';
    return NextResponse.redirect(new URL(`/giris?error=${errorCode}`, req.url));
  }
}