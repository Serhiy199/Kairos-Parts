import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sitemap from '@/app/sitemap';
import { buildPublicUrl } from '@/lib/site-url';

const layoutSource = readFileSync(join(process.cwd(), 'components/layout/public-layout.tsx'), 'utf8');
const footerStart = layoutSource.indexOf('<footer');
assert.ok(footerStart >= 0, 'The shared public footer must exist.');

const footerSource = layoutSource.slice(footerStart);
const logoIndex = footerSource.indexOf('src="/images/kairos-logo.png"');
const privacyIndex = footerSource.indexOf('href="/privacy-policy"');
const termsIndex = footerSource.indexOf('href="/terms-of-use"');

assert.ok(logoIndex >= 0, 'Footer logo must remain present.');
assert.ok(privacyIndex > logoIndex, 'Privacy link must be rendered under the footer logo.');
assert.ok(termsIndex > privacyIndex, 'Terms link must follow the Privacy link under the footer logo.');
assert.doesNotMatch(
  footerSource,
  /Єдина точка контакту для підбору та постачання запчастин/
);
assert.equal((footerSource.match(/href="\/privacy-policy"/g) ?? []).length, 1);
assert.equal((footerSource.match(/href="\/terms-of-use"/g) ?? []).length, 1);
assert.equal((layoutSource.match(/\{ href: '\/contacts', label: 'Контакти' \}/g) ?? []).length, 1);
assert.match(footerSource, /\{navItems\.map\(\(item\) => \(/);
assert.match(footerSource, /aria-label="Правова інформація"/);
assert.match(footerSource, /href="\/privacy-policy"[\s\S]*focus-visible:outline/);
assert.match(footerSource, /href="\/terms-of-use"[\s\S]*focus-visible:outline/);
assert.match(layoutSource, /<Link href="\/"[^>]*aria-label="Kairos Parts">[\s\S]*src="\/images\/kairos-logo\.png"/);

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 8);
assert.equal(new Set(sitemapUrls).size, 8);
assert.equal(sitemapUrls.includes(buildPublicUrl('/privacy-policy')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/terms-of-use')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/categories')), false);

console.log(
  `stageLegal1EFooter=PASS privacyLinks=1 termsLinks=1 contactsLinks=1 sitemapUrls=${sitemapUrls.length}`
);
