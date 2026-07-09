import type { UserRole } from './roles';

export const PUBLIC_ROUTE_PREFIXES = [
  '/',
  '/about',
  '/how-it-works',
  '/categories',
  '/contacts',
  '/request',
  '/login',
  '/admin/login',
  '/register',
  '/forgot-password'
] as const;

export const CLIENT_ROUTE_PREFIXES = ['/client'] as const;

export const CRM_ROUTE_PREFIXES = ['/admin'] as const;

export const ADMIN_ONLY_ROUTE_PREFIXES = ['/admin/settings', '/admin/categories', '/admin/manufacturers', '/admin/change-requests'] as const;

export function isPublicPath(pathname: string) {
  if (pathname === '/') {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some((prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

export function requiredRolesForPath(pathname: string): UserRole[] | null {
  if (isPublicPath(pathname)) {
    return null;
  }

  if (ADMIN_ONLY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return ['ADMIN'];
  }

  if (CLIENT_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return ['CLIENT'];
  }

  if (CRM_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return ['MANAGER', 'ADMIN'];
  }

  return null;
}

export function canAccessPath(pathname: string, role?: UserRole | null) {
  const requiredRoles = requiredRolesForPath(pathname);

  if (!requiredRoles) {
    return isPublicPath(pathname);
  }

  return Boolean(role && requiredRoles.includes(role));
}

export function defaultRedirectForRole(role?: UserRole | null) {
  if (role === 'CLIENT') {
    return '/client';
  }

  if (role === 'MANAGER' || role === 'ADMIN') {
    return '/admin';
  }

  return '/login';
}
