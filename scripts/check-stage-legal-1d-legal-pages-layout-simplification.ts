import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sitemap from '@/app/sitemap';
import { companyLegalDetails } from '@/lib/company-details';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl } from '@/lib/site-url';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const privacySource = read('app/(public)/privacy-policy/page.tsx');
const termsSource = read('app/(public)/terms-of-use/page.tsx');
const footerSource = read('components/layout/public-layout.tsx');

for (const [page, source] of [
  ['privacy', privacySource],
  ['terms', termsSource]
] as const) {
  assert.doesNotMatch(source, />\s*Зміст\s*</, `${page} must not render a contents heading.`);
  assert.doesNotMatch(source, /aria-label=["']Зміст/, `${page} must not render contents navigation.`);
  assert.doesNotMatch(source, /<aside\b/, `${page} must not render a legal sidebar.`);
  assert.doesNotMatch(source, /\blg:sticky\b|\blg:top-24\b/, `${page} must not keep sticky legal navigation.`);
  assert.doesNotMatch(source, /lg:grid-cols-\[minmax/, `${page} must not keep the two-column legal grid.`);
  assert.match(source, /<div className=["']kp-container["']>\s*<article/);
  assert.match(source, /<article className=["'][^"']*border-public-border[^"']*bg-public-card[^"']*px-6/);
}

const privacyControllerIndex = privacySource.indexOf('<PolicySection id="controller"');
const privacyGeneralIndex = privacySource.indexOf('<PolicySection id="general"');
assert.ok(privacyControllerIndex >= 0 && privacyControllerIndex < privacyGeneralIndex);
assert.match(privacySource, /<PolicySection id="controller" title="1\. Володілець персональних даних">/);
assert.equal((privacySource.match(/<PolicySection\b/g) ?? []).length, 19);

const termsOperatorIndex = termsSource.indexOf('<TermsSection id="operator"');
const termsGeneralIndex = termsSource.indexOf('<TermsSection id="general"');
assert.ok(termsOperatorIndex >= 0 && termsOperatorIndex < termsGeneralIndex);
assert.match(termsSource, /<TermsSection id="operator" title="1\. Оператор сервісу">/);
assert.equal((termsSource.match(/<TermsSection\b/g) ?? []).length, 24);

for (const source of [privacySource, termsSource]) {
  assert.match(source, /companyLegalDetails\.shortName/);
  assert.match(source, /companyLegalDetails\.edrpou/);
  assert.match(source, /companyLegalDetails\.legalAddress\.display/);
  assert.match(source, /companyLegalDetails\.email\.display/);
}
assert.equal(companyLegalDetails.shortName, 'ТОВ «КАЙРОС ПАРТС»');
assert.equal(companyLegalDetails.edrpou, '46387973');
assert.equal(companyLegalDetails.email.display, 'kairos_parts@ukr.net');

const privacyMetadata = createPublicMetadata(PUBLIC_PAGE_SEO.privacyPolicy);
const termsMetadata = createPublicMetadata(PUBLIC_PAGE_SEO.termsOfUse);
assert.equal(String(privacyMetadata.alternates?.canonical), buildPublicUrl('/privacy-policy'));
assert.equal(String(termsMetadata.alternates?.canonical), buildPublicUrl('/terms-of-use'));
assert.deepEqual(privacyMetadata.robots, { index: true, follow: true });
assert.deepEqual(termsMetadata.robots, { index: true, follow: true });

assert.match(footerSource, /href="\/privacy-policy"/);
assert.match(footerSource, /href="\/terms-of-use"/);
assert.match(footerSource, /\{ href: '\/contacts', label: 'Контакти' \}/);

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 15);
assert.equal(new Set(sitemapUrls).size, 15);
assert.equal(sitemapUrls.includes(buildPublicUrl('/privacy-policy')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/terms-of-use')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/categories')), false);

console.log(
  `stageLegal1DLayout=PASS privacySections=19 termsSections=24 sitemapUrls=${sitemapUrls.length}`
);
