import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { canAccessPath, defaultRedirectForRole, isPublicPath, requiredRolesForPath } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/roles';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = requiredRolesForPath(pathname);

  if (!requiredRoles && isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  const role = token?.role as UserRole | undefined;

  if (canAccessPath(pathname, role)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = token ? defaultRedirectForRole(role) : '/login';
  redirectUrl.searchParams.set('next', pathname);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/client/:path*', '/admin/:path*']
};
