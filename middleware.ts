import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { canAccessPath, defaultRedirectForRole, isPublicPath, requiredRolesForPath } from '@/lib/auth/permissions';
import { buildPublicRedirectUrl } from '@/lib/auth/redirect-url';
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
  const isSessionExpiredLogin =
    (pathname === '/login' || pathname === '/admin/login') &&
    request.nextUrl.searchParams.get('error') === 'session-expired';

  if (!isSessionExpiredLogin && pathname === '/login' && role === 'CLIENT') {
    return NextResponse.redirect(buildPublicRedirectUrl(request, '/client'));
  }

  if (!isSessionExpiredLogin && pathname === '/login' && (role === 'MANAGER' || role === 'ADMIN')) {
    return NextResponse.redirect(buildPublicRedirectUrl(request, '/admin'));
  }

  if (!isSessionExpiredLogin && pathname === '/admin/login' && role === 'CLIENT') {
    return NextResponse.redirect(buildPublicRedirectUrl(request, '/client'));
  }

  if (!isSessionExpiredLogin && pathname === '/admin/login' && (role === 'MANAGER' || role === 'ADMIN')) {
    return NextResponse.redirect(buildPublicRedirectUrl(request, '/admin'));
  }

  if (!requiredRoles && isPublicPath(pathname)) {
    return nextWithPathname(request, pathname);
  }

  if (canAccessPath(pathname, role)) {
    return nextWithPathname(request, pathname);
  }

  const redirectPath = hasCurrentLifecycleClaims
    ? defaultRedirectForRole(role)
    : pathname.startsWith('/admin')
      ? '/admin/login'
      : '/login';
  const redirectUrl = buildPublicRedirectUrl(request, redirectPath);
  redirectUrl.searchParams.set('next', pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/login', '/client/:path*', '/admin/:path*']
};
