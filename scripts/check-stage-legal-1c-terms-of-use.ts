import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import robots, { ROBOTS_DISALLOW_PATHS } from '@/app/robots';
import sitemap from '@/app/sitemap';
import { companyLegalDetails } from '@/lib/company-details';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl } from '@/lib/site-url';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const routePath = 'app/(public)/terms-of-use/page.tsx';

assert.equal(existsSync(join(process.cwd(), routePath)), true);

const pageSource = read(routePath);
const footerSource = read('components/layout/public-layout.tsx');
const registerSource = read('app/(auth)/register/register-form.tsx');
const registerActionSource = read('app/(auth)/actions.ts');
const partsSource = read('app/(public)/request/request-form.tsx');
const partsRouteSource = read('app/api/requests/route.ts');
const logisticsSource = read('components/public/logistics/logistics-request-form.tsx');
const logisticsRouteSource = read('app/api/logistics/requests/route.ts');
const contactSource = read('app/(public)/contacts/contact-form.tsx');

assert.doesNotMatch(pageSource, /^['"]use client['"];?/m);
assert.match(pageSource, /createPublicMetadata\(PUBLIC_PAGE_SEO\.termsOfUse\)/);
assert.equal(PUBLIC_PAGE_SEO.termsOfUse.title, 'Умови користування | Kairos Parts');
assert.equal(
  PUBLIC_PAGE_SEO.termsOfUse.description,
  'Правила користування сайтом Kairos Parts, особистим кабінетом, заявками, документами та іншими функціями сервісу.'
);

const metadata = createPublicMetadata(PUBLIC_PAGE_SEO.termsOfUse);
assert.equal(String(metadata.alternates?.canonical), buildPublicUrl('/terms-of-use'));
assert.equal(metadata.title, PUBLIC_PAGE_SEO.termsOfUse.title);
assert.equal(metadata.description, PUBLIC_PAGE_SEO.termsOfUse.description);
assert.equal(
  metadata.openGraph && 'url' in metadata.openGraph ? String(metadata.openGraph.url) : null,
  buildPublicUrl('/terms-of-use')
);
assert.deepEqual(metadata.robots, { index: true, follow: true });

assert.match(pageSource, /<h1[^>]*>[\s\S]*Умови користування/);
for (const sectionId of [
  'general', 'operator', 'scope', 'account', 'security', 'accuracy', 'requests',
  'request-status', 'approvals', 'logistics', 'vehicles-files', 'materials',
  'prohibited', 'restrictions', 'intellectual-property', 'availability',
  'external-services', 'liability', 'personal-data', 'claims', 'changes', 'law',
  'contacts', 'effective-date'
]) {
  assert.match(pageSource, new RegExp(`id=["']${sectionId}["']`));
}

assert.match(pageSource, /companyLegalDetails\.shortName/);
assert.match(pageSource, /companyLegalDetails\.edrpou/);
assert.match(pageSource, /companyLegalDetails\.legalAddress\.display/);
assert.match(pageSource, /companyLegalDetails\.email\.display/);
assert.equal(companyLegalDetails.shortName, 'ТОВ «КАЙРОС ПАРТС»');
assert.equal(companyLegalDetails.edrpou, '46387973');
assert.equal(companyLegalDetails.email.display, 'kairos_parts@ukr.net');

assert.match(pageSource, /Реєстрація та обліковий запис/);
assert.match(pageSource, /дані для входу/);
assert.doesNotMatch(pageSource, /\bcredentials\b|\bstaff roles\b|\bmaintenance\b|\buser-uploaded materials\b/i);
assert.match(pageSource, /Достовірність даних/);
assert.match(pageSource, /Створення та опрацювання заявок/);
assert.match(pageSource, /Logistics-заявки/);
assert.match(pageSource, /Вимоги до матеріалів користувача/);
assert.match(pageSource, /Заборонені дії/);
assert.match(pageSource, /Обмеження або припинення доступу/);
assert.match(pageSource, /Інтелектуальна власність/);
assert.match(pageSource, /Доступність сервісу і технічні роботи/);
assert.match(pageSource, /Межі відповідальності/);
assert.match(pageSource, /Офіційні звернення та претензії/);
assert.match(pageSource, /застосовується законодавство України/);
assert.match(pageSource, /1 серпня 2026 року/);
assert.match(
  pageSource,
  /Надсилання заявки через сайт не є автоматичним укладенням договору, підтвердженням наявності[\s\S]*остаточним підтвердженням замовлення/
);
assert.match(pageSource, /не є публічною офертою/);
assert.match(pageSource, /href="\/privacy-policy"/);
assert.doesNotMatch(pageSource, /\bIBAN\b|\bМФО\b|банківськ(?:і|их) реквізит/iu);
assert.doesNotMatch(pageSource, /умови оплати|повернення товару|гарантійний строк|фінансов(?:ий|і) штраф|арбітражн/iu);
assert.doesNotMatch(pageSource, /AI Vision/i);
assert.doesNotMatch(pageSource, /process\.env|DATABASE_URL|TELEGRAM_BOT_TOKEN|CLOUDINARY_URL/);

assert.match(footerSource, /href="\/privacy-policy"/);
assert.match(footerSource, /href="\/terms-of-use"/);
assert.match(footerSource, /href="\/contacts"/);
assert.match(footerSource, /aria-label="Правова інформація"/);

assert.match(registerSource, /Реєструючись, ви підтверджуєте, що ознайомилися з/);
assert.match(registerSource, /href="\/terms-of-use"/);
assert.match(registerSource, /href="\/privacy-policy"/);
assert.doesNotMatch(registerSource, /name="terms(?:Accepted|Consent)"|type="checkbox"/);
assert.match(registerActionSource, /export async function registerClient\(formData: FormData\)/);

assert.match(partsSource, /Надсилання заявки не є автоматичним укладенням договору/);
assert.match(partsSource, /href="\/terms-of-use"/);
assert.match(partsSource, /href="\/privacy-policy"/);
assert.match(partsSource, /<form onSubmit=\{handleSubmit\}/);
assert.match(partsRouteSource, /export async function POST\(request: Request\)/);

assert.match(logisticsSource, /Надсилання заявки на перевезення не є автоматичним укладенням договору/);
assert.match(logisticsSource, /гарантією виконання[\s\S]*у вибрану дату/);
assert.match(logisticsSource, /href="\/terms-of-use"/);
assert.match(logisticsSource, /href="\/privacy-policy"/);
assert.match(logisticsSource, /onSubmit=\{handleSubmit\}/);
assert.match(logisticsRouteSource, /export async function POST\(request: Request\)/);

assert.match(contactSource, /id="contact-consent"/);
assert.match(contactSource, /name="consent"/);
assert.match(contactSource, /required/);
assert.match(contactSource, /href="\/privacy-policy"/);

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 15);
assert.equal(new Set(sitemapUrls).size, 15);
assert.equal(sitemapUrls.includes(buildPublicUrl('/terms-of-use')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/privacy-policy')), true);
assert.equal(sitemapUrls.includes(buildPublicUrl('/categories')), false);

const robotsMetadata = robots();
assert.equal(
  ROBOTS_DISALLOW_PATHS.some((path) =>
    String('/terms-of-use') === String(path) || '/terms-of-use'.startsWith(`${path}/`)
  ),
  false
);
assert.equal(JSON.stringify(robotsMetadata).includes('/terms-of-use'), false);

console.log(
  `stageLegal1CTerms=PASS sections=24 sitemapUrls=${sitemapUrls.length} canonical=${String(metadata.alternates?.canonical)}`
);
