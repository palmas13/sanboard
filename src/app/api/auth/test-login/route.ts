import { NextRequest, NextResponse } from 'next/server';
import { syncExternalGameAccount } from '@/lib/auth/gtaworld-sync';
import { createCharacterSelectionToken, clearSessionCookieOnResponse, setCharacterSelectionCookieOnResponse } from '@/lib/auth/session';
import { assertTestLoginAccountNamespace, isTestLoginEnabled } from '@/lib/auth/test-login';
import { MockGtaWorldAuthProvider } from '@/lib/integrations/gtaworld/mock-provider';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isTestLoginEnabled()) return NextResponse.json({ error: 'Test login devre dışı.' }, { status: 404 });

  try {
    const provider = new MockGtaWorldAuthProvider();
    const externalAccount = await provider.fetchAccount('temporary-test-login');
    assertTestLoginAccountNamespace(externalAccount);
    const { user, profiles } = await syncExternalGameAccount(externalAccount);
    if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Bu test hesabı ile oturum açılamaz.' }, { status: 403 });

    await recordAuditEvent({ eventType: 'AUTH_LOGIN_SUCCESS', userId: user.id, metadata: { provider: 'temporary-test-login', characterCount: profiles.length } });
    const redirect = req.nextUrl.searchParams.get('redirect') || '/';
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