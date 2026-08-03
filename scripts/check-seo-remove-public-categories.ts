import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import robots, { ROBOTS_DISALLOW_PATHS } from '@/app/robots';
import sitemap from '@/app/sitemap';
import { buildPublicUrl } from '@/lib/site-url';

const CATEGORY_PATHS = [
  '/categories',
  '/categories/agricultural-parts',
  '/categories/truck-parts',
  '/categories/tires-tubes',
  '/categories/trailers-semitrailers',
  '/categories/commercial-transport',
  '/categories/universal-parts',
  '/categories/consumables'
] as const;

const EXPECTED_SITEMAP_PATHS = [
  '/',
  '/about',
  '/how-it-works',
  '/contacts',
  '/privacy-policy',
  '/terms-of-use',
  '/logistics',
  '/used-equipment'
] as const;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

assert.equal(existsSync(join(process.cwd(), 'app/(public)/categories/page.tsx')), false);
assert.equal(existsSync(join(process.cwd(), 'app/(public)/categories/[slug]/page.tsx')), false);

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 8);
assert.equal(new Set(sitemapUrls).size, 8);
assert.deepEqual(
  sitemapUrls,
  EXPECTED_SITEMAP_PATHS.map((path) => buildPublicUrl(path))
);
assert.equal(sitemapUrls.some((url) => new URL(url).pathname.startsWith('/categories')), false);

const publicSources = [
  ...sourceFiles(join(process.cwd(), 'app/(public)')),
  ...sourceFiles(join(process.cwd(), 'components/public')),
  ...sourceFiles(join(process.cwd(), 'components/layout'))
];

for (const sourcePath of publicSources) {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:href\s*=\s*|href\s*:|url\s*:|item\s*:)[^\n]*["'`]\/categories(?:\/|["'`])/,
    `Public category URL remains in UI, breadcrumb, or structured data: ${sourcePath}`
  );
}

const routeSource = readFileSync(join(process.cwd(), 'lib/routes.ts'), 'utf8');
const permissionsSource = readFileSync(join(process.cwd(), 'lib/auth/permissions.ts'), 'utf8');
assert.doesNotMatch(routeSource, /["'`]\/categories(?:\/\[slug\])?["'`]/);
assert.doesNotMatch(permissionsSource, /["'`]\/categories["'`]/);

for (const path of CATEGORY_PATHS) {
  assert.equal(
    ROBOTS_DISALLOW_PATHS.some((prefix) =>
      String(path) === String(prefix) || String(path).startsWith(`${String(prefix)}/`)
    ),
    false,
    `robots must allow crawlers to observe 404 for ${path}`
  );
}

const robotsMetadata = robots();
assert.equal(JSON.stringify(robotsMetadata).includes('/categories'), false);

for (const routeFile of [
  'app/(public)/page.tsx',
  'app/(public)/about/page.tsx',
  'app/(public)/how-it-works/page.tsx',
  'app/(public)/contacts/page.tsx',
  'app/(public)/logistics/page.tsx',
  'app/(public)/logistics/request/page.tsx',
  'app/(public)/used-equipment/page.tsx',
  'app/(public)/privacy-policy/page.tsx',
  'app/(public)/terms-of-use/page.tsx',
  'app/(public)/request/page.tsx'
]) {
  assert.equal(existsSync(join(process.cwd(), routeFile)), true, `Required route source missing: ${routeFile}`);
}

console.log(
  `seoRemovePublicCategories=PASS removedRoutes=${CATEGORY_PATHS.length} sitemapUrls=${sitemapUrls.length} publicSources=${publicSources.length}`
);
