import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import robots, { ROBOTS_DISALLOW_PATHS } from '@/app/robots';
import sitemap from '@/app/sitemap';
import { companyLegalDetails } from '@/lib/company-details';
import { parseContactMessageFormData } from '@/lib/contact-messages';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl } from '@/lib/site-url';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const routePath = 'app/(public)/privacy-policy/page.tsx';

assert.equal(existsSync(join(process.cwd(), routePath)), true);

const pageSource = read(routePath);
const footerSource = read('components/layout/public-layout.tsx');
const formSource = read('app/(public)/contacts/contact-form.tsx');
const actionSource = read('app/(public)/contacts/actions.ts');
const companySource = read('lib/company-details.ts');

assert.doesNotMatch(pageSource, /^['"]use client['"];?/m);
assert.match(pageSource, /createPublicMetadata\(PUBLIC_PAGE_SEO\.privacyPolicy\)/);
assert.equal(PUBLIC_PAGE_SEO.privacyPolicy.title, 'Політика конфіденційності | Kairos Parts');
assert.equal(
  PUBLIC_PAGE_SEO.privacyPolicy.description,
  'Інформація про те, які персональні дані обробляє Kairos Parts, для чого вони використовуються, як захищаються та як подати запит щодо своїх даних.'
);

const metadata = createPublicMetadata(PUBLIC_PAGE_SEO.privacyPolicy);
assert.equal(String(metadata.alternates?.canonical), buildPublicUrl('/privacy-policy'));
assert.equal(metadata.title, PUBLIC_PAGE_SEO.privacyPolicy.title);
assert.equal(metadata.description, PUBLIC_PAGE_SEO.privacyPolicy.description);
assert.equal(metadata.openGraph && 'url' in metadata.openGraph ? String(metadata.openGraph.url) : null, buildPublicUrl('/privacy-policy'));
assert.deepEqual(metadata.robots, { index: true, follow: true });

assert.match(pageSource, /<h1[^>]*>[\s\S]*Політика конфіденційності/);
for (const sectionId of [
  'general', 'controller', 'data', 'sources', 'purposes', 'legal-bases', 'account',
  'requests', 'telegram', 'providers', 'retention', 'security', 'rights',
  'request-procedure', 'minors', 'external-links', 'changes', 'contacts', 'effective-date'
]) {
  assert.match(pageSource, new RegExp(`id=["']${sectionId}["']`));
}

assert.match(pageSource, /companyLegalDetails\.shortName/);
assert.match(pageSource, /companyLegalDetails\.edrpou/);
assert.match(pageSource, /companyLegalDetails\.legalAddress\.display/);
assert.match(pageSource, /companyLegalDetails\.email\.display/);
assert.match(companySource, /46387973/);
assert.match(companySource, /вул\. Сергієнка, буд\. 20/);
assert.match(companySource, /email: siteContacts\.email/);
assert.equal(companyLegalDetails.email.display, 'kairos_parts@ukr.net');
assert.match(pageSource, /cookies/iu);
assert.match(pageSource, /Cloudinary/);
assert.match(pageSource, /Telegram/);
assert.match(pageSource, /Права користувача/);
assert.match(pageSource, /Як подати запит щодо даних/);
assert.match(pageSource, /Дата набрання чинності/);
assert.match(pageSource, /1 серпня 2026 року/);
assert.match(pageSource, /не\s+гарантує абсолютної безпеки/);
assert.match(pageSource, /не використовуємо ці дані для маркетингового профілювання/);
assert.doesNotMatch(pageSource, /AI Vision/i);
assert.doesNotMatch(pageSource, /\bIBAN\b|\bМФО\b|банківськ(?:ий|і|ого) рахун/iu);
assert.doesNotMatch(pageSource, /process\.env|DATABASE_URL|TELEGRAM_BOT_TOKEN|CLOUDINARY_URL/);

assert.match(footerSource, /href="\/privacy-policy"/);
assert.match(footerSource, /Політика конфіденційності/);
assert.match(footerSource, /href="\/terms-of-use"/);

assert.match(formSource, /id="contact-consent"/);
assert.match(formSource, /name="consent"/);
assert.match(formSource, /type="checkbox"/);
assert.match(formSource, /defaultChecked=\{state\.values\.consent\}/);
assert.match(formSource, /consent: false/);
assert.match(formSource, /required/);
assert.match(formSource, /href="\/privacy-policy"/);
assert.match(formSource, /Політикою конфіденційності/);
assert.match(formSource, /Я ознайомився\(лася\) з/);
assert.match(actionSource, /parseContactMessageFormData\(formData\)/);
assert.match(actionSource, /prisma\.contactMessage\.create/);

const validForm = new FormData();
validForm.set('name', 'Тестовий користувач');
validForm.set('phone', '+380671234567');
validForm.set('topic', 'OTHER');
validForm.set('message', 'Тестове повідомлення для перевірки форми.');
validForm.set('consent', 'on');
assert.equal(parseContactMessageFormData(validForm).ok, true);
validForm.delete('consent');
const missingConsent = parseContactMessageFormData(validForm);
assert.equal(missingConsent.ok, false);
if (!missingConsent.ok) assert.ok(missingConsent.errors.consent);

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 8);
assert.equal(new Set(sitemapUrls).size, 8);
assert.equal(sitemapUrls.includes(buildPublicUrl('/privacy-policy')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/categories')), false);
assert.equal(sitemapUrls.includes(buildPublicUrl('/terms-of-use')), true);

const robotsMetadata = robots();
assert.equal(
  ROBOTS_DISALLOW_PATHS.some((path) =>
    String('/privacy-policy') === String(path) || '/privacy-policy'.startsWith(`${path}/`)
  ),
  false
);
assert.equal(JSON.stringify(robotsMetadata).includes('/privacy-policy'), false);

console.log(
  `stageLegal1BPrivacy=PASS sections=19 sitemapUrls=${sitemapUrls.length} canonical=${String(metadata.alternates?.canonical)}`
);
