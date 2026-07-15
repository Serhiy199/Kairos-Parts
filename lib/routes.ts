export const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/how-it-works',
  '/categories',
  '/categories/[slug]',
  '/contacts',
  '/request',
  '/request/status/[token]'
] as const;

export const AUTH_ROUTES = ['/login', '/admin/login', '/register', '/forgot-password'] as const;

export const CLIENT_ROUTES = [
  '/client',
  '/client/requests',
  '/client/requests/[id]',
  '/client/vehicles',
  '/client/vehicles/[id]',
  '/client/documents',
  '/client/profile'
] as const;

export const ADMIN_ROUTES = [
  '/admin',
  '/admin/requests',
  '/admin/requests/[id]',
  '/admin/billing-settings',
  '/admin/clients',
  '/admin/categories',
  '/admin/manufacturers',
  '/admin/settings'
] as const;

export const API_ROUTES = [
  '/api/auth/*',
  '/api/requests',
  '/api/requests/[id]',
  '/api/requests/status/[token]',
  '/api/client/requests',
  '/api/client/vehicles',
  '/api/client/documents',
  '/api/admin/requests',
  '/api/admin/requests/[id]',
  '/api/admin/requests/[id]/status',
  '/api/admin/requests/[id]/assign',
  '/api/admin/requests/[id]/comments',
  '/api/categories',
  '/api/categories/[slug]',
  '/api/admin/categories',
  '/api/admin/subcategories',
  '/api/admin/manufacturers',
  '/api/vehicles',
  '/api/documents',
  '/api/telegram/webhook',
  '/api/ocr',
  '/api/notifications'
] as const;
