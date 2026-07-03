import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { canAccessPath, defaultRedirectForRole, isPublicPath, requiredRolesForPath } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/roles';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = requiredRolesForPath(pathname);

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === 'https:'
  });
  const role = token?.role as UserRole | undefined;

  if (pathname === '/login' && role === 'CLIENT') {
    return NextResponse.redirect(new URL('/client', request.url));
  }

  if (pathname === '/login' && (role === 'MANAGER' || role === 'ADMIN')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname === '/admin/login' && role === 'CLIENT') {
    return NextResponse.redirect(new URL('/client', request.url));
  }

  if (pathname === '/admin/login' && (role === 'MANAGER' || role === 'ADMIN')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (!requiredRoles && isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (canAccessPath(pathname, role)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = token ? defaultRedirectForRole(role) : pathname.startsWith('/admin') ? '/admin/login' : '/login';
  redirectUrl.searchParams.set('next', pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/login', '/client/:path*', '/admin/:path*']
};
