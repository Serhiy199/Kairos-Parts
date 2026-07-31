import type { MetadataRoute } from 'next';

import { catalogCategories } from '@/lib/catalog/catalog-data';
import { PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl } from '@/lib/site-url';

export const STATIC_SITEMAP_PATHS = [
  PUBLIC_PAGE_SEO.home.path,
  PUBLIC_PAGE_SEO.about.path,
  PUBLIC_PAGE_SEO.howItWorks.path,
  PUBLIC_PAGE_SEO.contacts.path,
  PUBLIC_PAGE_SEO.logistics.path,
  PUBLIC_PAGE_SEO.usedEquipment.path
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const categoryPaths = catalogCategories.map((category) => `/categories/${category.slug}` as const);

  return [...STATIC_SITEMAP_PATHS, ...categoryPaths].map((path) => ({
    url: buildPublicUrl(path)
  }));
}
