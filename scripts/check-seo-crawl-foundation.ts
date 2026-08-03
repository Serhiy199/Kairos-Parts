import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import robots, { ROBOTS_DISALLOW_PATHS } from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
  createPublicMetadata,
  NOINDEX_METADATA,
  PUBLIC_PAGE_SEO
} from '@/lib/seo';
import {
  buildAbsoluteUrl,
  buildPublicUrl,
  getAppBaseUrl,
  PUBLIC_SITE_ORIGIN
} from '@/lib/site-url';

const FORBIDDEN_ORIGIN_PARTS = ['vercel.app', 'localhost', '127.0.0.1', 'www.'];
const FORBIDDEN_SITEMAP_PREFIXES = ['/admin', '/client', '/api', '/login', '/register', '/auth'];
const EXPECTED_SITEMAP_PATHS = [
  '/',
  '/about',
  '/how-it-works',
  '/contacts',
  '/privacy-policy',
  '/terms-of-use',
  '/logistics',
  '/used-equipment'
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

assert.equal(PUBLIC_SITE_ORIGIN, 'https://kairos-parts.com.ua');
assert.equal(buildPublicUrl('/'), 'https://kairos-parts.com.ua/');
assert.equal(buildPublicUrl('/about/'), 'https://kairos-parts.com.ua/about');
assert.equal(buildPublicUrl('/about?preview=1#section'), 'https://kairos-parts.com.ua/about');

const originalRuntimeEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  appBaseUrl: process.env.APP_BASE_URL,
  nextAuthUrl: process.env.NEXTAUTH_URL
};

try {
  Reflect.set(process.env, 'NODE_ENV', 'production');
  process.env.APP_BASE_URL = 'https://unsafe-preview.vercel.app';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';

  assert.equal(getAppBaseUrl(), PUBLIC_SITE_ORIGIN);
  assert.equal(buildAbsoluteUrl('/client'), `${PUBLIC_SITE_ORIGIN}/client`);
} finally {
  if (originalRuntimeEnvironment.nodeEnv === undefined) {
    Reflect.deleteProperty(process.env, 'NODE_ENV');
  } else {
    Reflect.set(process.env, 'NODE_ENV', originalRuntimeEnvironment.nodeEnv);
  }
  process.env.APP_BASE_URL = originalRuntimeEnvironment.appBaseUrl;
  process.env.NEXTAUTH_URL = originalRuntimeEnvironment.nextAuthUrl;
}

for (const forbiddenPart of FORBIDDEN_ORIGIN_PARTS) {
  assert.equal(
    PUBLIC_SITE_ORIGIN.includes(forbiddenPart),
    false,
    `Canonical origin must not contain ${forbiddenPart}.`
  );
}

const sitemapEntries = sitemap();
const sitemapUrls = sitemapEntries.map((entry) => entry.url);

assert.equal(sitemapUrls.length, 8);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must be unique.');
assert.deepEqual(
  sitemapUrls,
  EXPECTED_SITEMAP_PATHS.map((path) => buildPublicUrl(path)),
  'Sitemap must contain the canonical 8-URL inventory in the expected order.'
);
assert.equal(sitemapUrls.includes(buildPublicUrl('/categories')), false);
assert.equal(sitemapUrls.includes(buildPublicUrl('/logistics')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/privacy-policy')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/terms-of-use')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/logistics/request')), false);

assert.equal(sitemapUrls.some((url) => new URL(url).pathname.startsWith('/categories')), false);

for (const urlValue of sitemapUrls) {
  const url = new URL(urlValue);

  assert.equal(url.origin, PUBLIC_SITE_ORIGIN);
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(
    FORBIDDEN_SITEMAP_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)),
    false,
    `Excluded route found in sitemap: ${url.pathname}`
  );
}

const expectedMetadataInputs = Object.values(PUBLIC_PAGE_SEO);

assert.equal(expectedMetadataInputs.length, 8);

for (const input of expectedMetadataInputs) {
  const metadata = createPublicMetadata(input);
  const canonical = metadata.alternates?.canonical;
  const openGraphUrl = metadata.openGraph && 'url' in metadata.openGraph ? metadata.openGraph.url : null;

  assert.equal(String(canonical), buildPublicUrl(input.path));
  assert.equal(String(openGraphUrl), buildPublicUrl(input.path));
  assert.equal(
    metadata.robots && typeof metadata.robots === 'object' && 'index' in metadata.robots
      ? metadata.robots.index
      : null,
    true
  );
}

assert.deepEqual(NOINDEX_METADATA.robots, {
  index: false,
  follow: false
});

assert.equal(existsSync(join(process.cwd(), 'app/(public)/categories/page.tsx')), false);
assert.equal(existsSync(join(process.cwd(), 'app/(public)/categories/[slug]/page.tsx')), false);

const logisticsSource = readFileSync(
  join(process.cwd(), 'app/(public)/logistics/page.tsx'),
  'utf8'
);
assert.match(logisticsSource, /createPublicMetadata\(PUBLIC_PAGE_SEO\.logistics\)/);
assert.doesNotMatch(logisticsSource, /index:\s*false|NOINDEX_METADATA/);

const logisticsMetadata = createPublicMetadata(PUBLIC_PAGE_SEO.logistics);
assert.equal(String(logisticsMetadata.alternates?.canonical), buildPublicUrl('/logistics'));
assert.equal(
  logisticsMetadata.robots && typeof logisticsMetadata.robots === 'object' && 'index' in logisticsMetadata.robots
    ? logisticsMetadata.robots.index
    : null,
  true
);
assert.equal(
  logisticsMetadata.robots && typeof logisticsMetadata.robots === 'object' && 'follow' in logisticsMetadata.robots
    ? logisticsMetadata.robots.follow
    : null,
  true
);

const logisticsRequestSource = readFileSync(
  join(process.cwd(), 'app/(public)/logistics/request/page.tsx'),
  'utf8'
);
assert.match(logisticsRequestSource, /index:\s*false/);
assert.match(logisticsRequestSource, /follow:\s*false/);

const publicUiSources = [
  ...sourceFiles(join(process.cwd(), 'app/(public)')),
  ...sourceFiles(join(process.cwd(), 'components'))
];

for (const sourcePath of publicUiSources) {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:href\s*=\s*|url\s*:\s*)["'`]\/categories(?:\/|["'`])|buildPublicUrl\(["'`]\/categories(?:\/|["'`])/,
    `Removed /categories routes must not remain linked or referenced in structured data: ${sourcePath}`
  );
}

const robotsMetadata = robots();
const robotsRules = Array.isArray(robotsMetadata.rules) ? robotsMetadata.rules : [robotsMetadata.rules];
const wildcardRule = robotsRules.find((rule) => rule.userAgent === '*');

assert.ok(wildcardRule);
assert.equal(wildcardRule.allow, '/');
const wildcardDisallow = Array.isArray(wildcardRule.disallow)
  ? wildcardRule.disallow
  : wildcardRule.disallow
    ? [wildcardRule.disallow]
    : [];
assert.deepEqual(wildcardDisallow, [...ROBOTS_DISALLOW_PATHS]);
assert.equal(wildcardDisallow.some((path) => String(path) === '/'), false);
assert.equal(robotsMetadata.sitemap, buildPublicUrl('/sitemap.xml'));

const protectedMetadataFiles = [
  'app/(auth)/layout.tsx',
  'app/(staff-auth)/layout.tsx',
  'app/admin/layout.tsx',
  'app/client/layout.tsx',
  'app/(public)/request/page.tsx',
  'app/(public)/request/status/[token]/page.tsx',
  'app/(public)/logistics/request/page.tsx'
];

for (const relativePath of protectedMetadataFiles) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');

  assert.match(source, /NOINDEX_METADATA|index:\s*false/);
}

console.log(
  `seoCrawlFoundation=PASS sitemapUrls=${sitemapUrls.length} robotsExclusions=${ROBOTS_DISALLOW_PATHS.length} canonicalOrigin=${PUBLIC_SITE_ORIGIN}`
);
