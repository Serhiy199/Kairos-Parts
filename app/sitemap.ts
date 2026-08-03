import type { MetadataRoute } from 'next';

import { PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl } from '@/lib/site-url';

export const STATIC_SITEMAP_PATHS = [
  PUBLIC_PAGE_SEO.home.path,
  PUBLIC_PAGE_SEO.about.path,
  PUBLIC_PAGE_SEO.howItWorks.path,
  PUBLIC_PAGE_SEO.contacts.path,
  PUBLIC_PAGE_SEO.privacyPolicy.path,
  PUBLIC_PAGE_SEO.termsOfUse.path,
  PUBLIC_PAGE_SEO.logistics.path,
  PUBLIC_PAGE_SEO.usedEquipment.path
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_SITEMAP_PATHS.map((path) => ({
    url: buildPublicUrl(path)
  }));
}
