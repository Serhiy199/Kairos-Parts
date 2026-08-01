import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { companyLegalDetails } from '@/lib/company-details';
import { parseContactMessageFormData } from '@/lib/contact-messages';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { siteContacts } from '@/lib/site-contacts';
import { buildPublicUrl } from '@/lib/site-url';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const copyFormData = (source: FormData) => {
  const copy = new FormData();
  for (const [key, value] of source.entries()) copy.append(key, value);
  return copy;
};
const pageSource = read('app/(public)/contacts/page.tsx');
const formSource = read('app/(public)/contacts/contact-form.tsx');
const actionSource = read('app/(public)/contacts/actions.ts');
const schemaSource = read('prisma/schema.prisma');
const sitemapSource = read('app/sitemap.ts');
const publicLayoutSource = read('components/layout/public-layout.tsx');
const scopedPublicSources = [pageSource, formSource, read('lib/company-details.ts')].join('\n');

assert.equal(siteContacts.phone.display, '(068) 008 77 08');
assert.equal(siteContacts.phone.href, 'tel:+380680087708');
assert.equal(siteContacts.email.display, 'kairos_parts@ukr.net');
assert.equal(siteContacts.address.display, 'м. Кагарлик, вул. Миронівська, 33д');
assert.equal(siteContacts.workingHours.display, 'Пн–Сб: 08:30–17:30');
assert.equal(siteContacts.telegram.display, '@kairos_parts_bot');

assert.equal(companyLegalDetails.shortName, 'ТОВ «КАЙРОС ПАРТС»');
assert.equal(
  companyLegalDetails.fullName,
  'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «КАЙРОС ПАРТС»'
);
assert.equal(companyLegalDetails.edrpou, '46387973');
assert.equal(
  companyLegalDetails.legalAddress.display,
  '09201, Україна, Київська область, Обухівський район, м. Кагарлик, вул. Сергієнка, буд. 20'
);
assert.equal(companyLegalDetails.legalPhone.display, '+38 (067) 668-08-08');
assert.equal(companyLegalDetails.legalPhone.href, 'tel:+380676680808');
assert.equal(companyLegalDetails.email, siteContacts.email);
assert.equal(companyLegalDetails.personalDataController, companyLegalDetails.shortName);

assert.doesNotMatch(pageSource, /^['"]use client['"];?/m);
assert.match(pageSource, /createPublicMetadata\(PUBLIC_PAGE_SEO\.contacts\)/);
assert.match(pageSource, /ОФІС, СКЛАД, БАЗА, ПУНКТ ОБСЛУГОВУВАННЯ ТА ВИДАЧІ/);
assert.match(pageSource, /Відвідування можливе без попереднього погодження у робочі години\./);
assert.match(pageSource, /legal-information-title/);
assert.match(pageSource, /label="Телефон у реквізитах"/);
assert.match(pageSource, /label="Юридична адреса та адреса для листування"/);
assert.match(pageSource, /label="Володілець персональних даних"/);
assert.match(pageSource, /label="Запити щодо персональних даних"/);
assert.match(pageSource, /Письмові претензії приймаються поштою за юридичною адресою/);
assert.match(pageSource, /grid min-w-0/);
assert.match(pageSource, /overflow-hidden/);
assert.match(pageSource, /break-words/);

assert.match(formSource, /id="contact-consent"/);
assert.match(formSource, /name="consent"/);
assert.match(formSource, /type="checkbox"/);
assert.match(formSource, /defaultChecked=\{state\.values\.consent\}/);
assert.match(formSource, /consent: false/);
assert.match(formSource, /required/);
assert.match(formSource, /htmlFor="contact-consent"/);
assert.match(
  formSource,
  /Я ознайомився\(лася\) з/
);
assert.match(formSource, /Політикою конфіденційності/);
assert.match(formSource, /href="\/privacy-policy"/);
assert.match(formSource, /Надсилання заявки через сайт не є автоматичним укладенням договору/);
assert.doesNotMatch(scopedPublicSources, /\bIBAN\b|\bМФО\b|банківськ(?:ий|і|ого) рахун/iu);

const validForm = new FormData();
validForm.set('name', 'Іван Петренко');
validForm.set('company', 'ТОВ «Тест»');
validForm.set('phone', '+380671234567');
validForm.set('email', 'TEST@example.com');
validForm.set('topic', 'PARTS_REQUEST');
validForm.set('message', 'Потрібна консультація щодо запчастин.');
validForm.set('consent', 'on');

const validResult = parseContactMessageFormData(validForm);
assert.equal(validResult.ok, true);
if (validResult.ok) {
  assert.equal(validResult.data.email, 'test@example.com');
  assert.equal(validResult.data.phone, '+380671234567');
}

const missingConsentForm = copyFormData(validForm);
missingConsentForm.delete('consent');
const missingConsentResult = parseContactMessageFormData(missingConsentForm);
assert.equal(missingConsentResult.ok, false);
if (!missingConsentResult.ok) {
  assert.equal(missingConsentResult.isHoneypot, false);
  assert.ok(missingConsentResult.errors.consent);
}

const honeypotForm = copyFormData(validForm);
honeypotForm.set('website', 'https://spam.example');
const honeypotResult = parseContactMessageFormData(honeypotForm);
assert.equal(honeypotResult.ok, false);
if (!honeypotResult.ok) assert.equal(honeypotResult.isHoneypot, true);

assert.match(actionSource, /parseContactMessageFormData\(formData\)/);
assert.match(actionSource, /prisma\.contactMessage\.create/);
assert.doesNotMatch(actionSource, /telegram|Telegram/);
assert.match(schemaSource, /model ContactMessage[\s\S]*status\s+ContactMessageStatus\s+@default\(NEW\)/);
assert.match(sitemapSource, /PUBLIC_PAGE_SEO\.contacts\.path/);
assert.match(sitemapSource, /PUBLIC_PAGE_SEO\.privacyPolicy\.path/);
assert.doesNotMatch(sitemapSource, /terms-of-use/);
assert.match(publicLayoutSource, /siteContacts\.phone\.display/);
assert.match(publicLayoutSource, /siteContacts\.email\.display/);

const metadata = createPublicMetadata(PUBLIC_PAGE_SEO.contacts);
assert.equal(String(metadata.alternates?.canonical), buildPublicUrl('/contacts'));
assert.equal(
  metadata.robots && typeof metadata.robots === 'object' && 'index' in metadata.robots
    ? metadata.robots.index
    : null,
  true
);
assert.equal(
  metadata.robots && typeof metadata.robots === 'object' && 'follow' in metadata.robots
    ? metadata.robots.follow
    : null,
  true
);
assert.doesNotMatch(PUBLIC_PAGE_SEO.contacts.title, /46387973|IBAN|МФО/);

console.log(
  `stageLegal1AContacts=PASS canonical=${String(metadata.alternates?.canonical)} consent=required status=NEW`
);
