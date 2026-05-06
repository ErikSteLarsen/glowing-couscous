import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const role = user?.role;

  if (pathname.startsWith('/api/')) return NextResponse.next();

  if (!user) {
    if (pathname.startsWith('/coach') || pathname.startsWith('/athlete')) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  if (!role && pathname !== '/setup') {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  if (role === 'COACH' && pathname.startsWith('/athlete')) {
    return NextResponse.redirect(new URL('/coach', req.url));
  }

  if (role === 'ATHLETE' && pathname.startsWith('/coach')) {
    return NextResponse.redirect(new URL('/athlete', req.url));
  }

  if ((pathname === '/login' || pathname === '/signup') && role) {
    return NextResponse.redirect(new URL(role === 'COACH' ? '/coach' : '/athlete', req.url));
  }

  if (pathname === '/' && role) {
    return NextResponse.redirect(new URL(role === 'COACH' ? '/coach' : '/athlete', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
