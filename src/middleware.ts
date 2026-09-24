import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/hesabim', '/yonetim', '/ilan-ver'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Convenient alias: /hesabim/magazam -> /hesabim/kurumsal
  if (pathname === '/hesabim/magazam') {
    const url = req.nextUrl.clone();
    url.pathname = '/hesabim/kurumsal';
    return NextResponse.redirect(url);
  }

  // Check protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected) {
    const sessionCookie = req.cookies.get('sanboard_session')?.value;
    const profileIdCookie = req.cookies.get('sanboard_profile_id')?.value;

    // If completely unauthenticated (no session cookie at all), redirect to login
    if (!sessionCookie && !profileIdCookie) {
      const loginUrl = new URL('/giris', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/hesabim/:path*',
    '/yonetim/:path*',
    '/ilan-ver/:path*',
  ],
};
