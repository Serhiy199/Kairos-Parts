import type { MetadataRoute } from 'next';

import { buildPublicUrl } from '@/lib/site-url';

export const ROBOTS_DISALLOW_PATHS = [
  '/admin',
  '/client',
  '/api',
  '/login',
  '/register',
  '/forgot-password',
  '/invitation',
  '/auth',
  '/request',
  '/logistics/request'
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...ROBOTS_DISALLOW_PATHS]
    },
    sitemap: buildPublicUrl('/sitemap.xml')
  };
}
