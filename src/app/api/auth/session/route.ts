import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookieOnResponse, clearSessionCookieOnResponse, getServerSession } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit';
import { getUserRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  return NextResponse.json({ authenticated: true, session });
}

export async function POST(req: NextRequest) {
  try {
    const currentSession = await getServerSession(req);
    if (!currentSession?.userId) return NextResponse.json({ error: 'Karakter değiştirmek için geçerli bir hesap oturumu gerekir.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const characterId = String(body.characterId || body.profileId || '').trim();
    if (!characterId) return NextResponse.json({ error: 'characterId parametresi zorunludur.' }, { status: 400 });

    const userRepository = getUserRepository();
    const user = await userRepository.getUserById(currentSession.userId);
    if (!user) return NextResponse.json({ error: 'Hesap bulunamadı.' }, { status: 401 });
    if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Bu hesap ile oturum açılamaz.' }, { status: 403 });

    const profile = await userRepository.getProfileById(characterId);
    if (!profile) return NextResponse.json({ error: 'Karakter profili bulunamadı.' }, { status: 404 });
    if (profile.user_id !== currentSession.userId) return NextResponse.json({ error: 'Bu karakter profili oturum hesabına ait değil.' }, { status: 403 });

    const role = profile.role || 'USER';
    const token = createSessionToken({ userId: user.id, role, profileId: profile.id });
    const isSwitch = Boolean(currentSession.profileId && currentSession.profileId !== profile.id);
    await recordAuditEvent({ eventType: isSwitch ? 'CHARACTER_SWITCHED' : 'CHARACTER_SELECTED', userId: user.id, profileId: profile.id, metadata: { characterName: profile.full_name, previousProfileId: currentSession.profileId || null } });

    const response = NextResponse.json({ success: true, user: { ...user, role }, profileId: profile.id });
    setSessionCookieOnResponse(response, token);
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
    response.cookies.set('sanboard_profile_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_user_id', '', { path: '/', maxAge: 0 });
    response.cookies.set('sanboard_role', '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}