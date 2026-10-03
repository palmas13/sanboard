import { NextRequest, NextResponse } from 'next/server';
import {
  clearCharacterSelectionCookieOnResponse,
  clearSessionCookieOnResponse,
  createSessionToken,
  getCharacterSelectionContext,
  getServerSession,
  setSessionCookieOnResponse,
} from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit';
import { getUserRepository } from '@/lib/db/repositories';
import { isTestExternalAccountId, isTestLoginEnabled } from '@/lib/auth/test-login';

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  if (!session.profileId) return NextResponse.json({ authenticated: false, session: null }, { status: 401 });

  const repo = getUserRepository();
  const [user, profile] = await Promise.all([
    repo.getUserById(session.userId),
    repo.getProfileById(session.profileId),
  ]);
  if (user && isTestExternalAccountId(user.external_user_id) && !isTestLoginEnabled()) {
    return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  }
  if (!user || user.status !== 'ACTIVE' || !profile || profile.user_id !== session.userId) {
    return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    session: { ...session, role: profile.role || 'USER', profileId: profile.id },
    user: { ...user, role: profile.role || 'USER' },
    profile,
    isTestIdentity: isTestExternalAccountId(user.external_user_id),
  });
}

export async function POST(req: NextRequest) {
  try {
    const currentSession = await getServerSession(req);
    const selectionContext = currentSession ? null : getCharacterSelectionContext(req);
    const authenticatedUserId = currentSession?.userId || selectionContext?.userId;
    if (!authenticatedUserId) return NextResponse.json({ error: 'Geçerli bir hesap veya karakter seçim oturumu gerekir.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const characterId = String(body.characterId || body.profileId || '').trim();
    if (!characterId) return NextResponse.json({ error: 'characterId parametresi zorunludur.' }, { status: 400 });

    const userRepository = getUserRepository();
    const [user, profile] = await Promise.all([userRepository.getUserById(authenticatedUserId), userRepository.getProfileById(characterId)]);
    if (!user) return NextResponse.json({ error: 'Hesap bulunamadı.' }, { status: 401 });
    if (isTestExternalAccountId(user.external_user_id) && !isTestLoginEnabled()) {
      return NextResponse.json({ error: 'Test login devre dışı.' }, { status: 404 });
    }
    if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Bu hesap ile oturum açılamaz.' }, { status: 403 });

    if (!profile) {
      const verifiedCharacter = selectionContext?.characters?.find((character) => character.externalCharacterId === characterId);
      if (!verifiedCharacter) return NextResponse.json({ error: 'Seçilen karakter doğrulanamadı.', code: 'character_invalid' }, { status: 403 });
      return NextResponse.json({ success: false, onboardingRequired: true, characterId: verifiedCharacter.externalCharacterId }, { status: 409 });
    }
    if (profile.user_id !== authenticatedUserId) return NextResponse.json({ error: 'Bu karakter profili oturum hesabına ait değil.' }, { status: 403 });

    const role = profile.role || 'USER';
    const token = createSessionToken({ userId: user.id, role, profileId: profile.id });
    const isSwitch = Boolean(currentSession?.profileId && currentSession.profileId !== profile.id);
    await recordAuditEvent({ eventType: isSwitch ? 'CHARACTER_SWITCHED' : 'CHARACTER_SELECTED', userId: user.id, profileId: profile.id, metadata: { characterName: profile.full_name, previousProfileId: currentSession?.profileId || null } });

    const response = NextResponse.json({ success: true, user: { ...user, role }, profile, profileId: profile.id, isTestIdentity: isTestExternalAccountId(user.external_user_id) });
    setSessionCookieOnResponse(response, token);
    clearCharacterSelectionCookieOnResponse(response);
    response.cookies.set('sanboard_profile_id', profile.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('sanboard_user_id', user.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('sanboard_role', role, { path: '/', maxAge: 86400, sameSite: 'lax' });
    return response;
  } catch (error: any) {
    const status = String(error?.message || '').includes('identifier collision') ? 409 : 500;
    return NextResponse.json({ error: error?.message || 'Oturum oluşturulamadı.' }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentSession = await getServerSession(req);
    if (currentSession?.userId) await recordAuditEvent({ eventType: 'AUTH_LOGOUT', userId: currentSession.userId, profileId: currentSession.profileId || null });
    const response = NextResponse.json({ success: true });
    clearSessionCookieOnResponse(response);
    clearCharacterSelectionCookieOnResponse(response);
    response.cookies.set('gtaw_oauth_attempt', '', { path: '/', maxAge: 0, httpOnly: true });
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}