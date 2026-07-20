import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { canAccessPath, defaultRedirectForRole, isPublicPath, requiredRolesForPath } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/roles';

function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-kairos-pathname', pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = requiredRolesForPath(pathname);

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === 'https:'
  });
  const hasCurrentLifecycleClaims = Boolean(
    token?.userId &&
      token.status === 'ACTIVE' &&
      Number.isInteger(token.authVersion) &&
      !token.sessionInvalid
  );
  const role = hasCurrentLifecycleClaims ? (token?.role as UserRole | undefined) : undefined;

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
    return nextWithPathname(request, pathname);
  }

  if (canAccessPath(pathname, role)) {
    return nextWithPathname(request, pathname);
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = hasCurrentLifecycleClaims
    ? defaultRedirectForRole(role)
    : pathname.startsWith('/admin')
      ? '/admin/login'
      : '/login';
  redirectUrl.searchParams.set('next', pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/login', '/client/:path*', '/admin/:path*']
};
