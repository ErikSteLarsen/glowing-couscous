import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';
import { parseApplicationUserId } from '@/lib/auth-principal';
import { loginPathFor } from '@/lib/auth-callback';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const hasValidUser = parseApplicationUserId(user?.id) !== null;
  const role = user?.role;
  const hasValidRole = role === 'COACH' || role === 'ATHLETE';

  if (pathname.startsWith('/api/')) return NextResponse.next();

  if (!user || !hasValidUser) {
    if (pathname.startsWith('/coach') || pathname.startsWith('/athlete') || pathname === '/setup') {
      return NextResponse.redirect(new URL(loginPathFor(pathname + req.nextUrl.search), req.url));
    }
    return NextResponse.next();
  }

  if (!hasValidRole && pathname !== '/setup') {
    if (pathname.startsWith('/share/')) return NextResponse.next();
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  if (pathname === '/setup' && hasValidRole) {
    return NextResponse.redirect(new URL('/athlete', req.url));
  }

  if (pathname.startsWith('/coach')) {
    return NextResponse.redirect(new URL('/athlete', req.url));
  }

  if (pathname === '/' && role) {
    return NextResponse.redirect(new URL('/athlete', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
