import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sitemap from '@/app/sitemap';
import { companyLegalDetails } from '@/lib/company-details';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { siteContacts } from '@/lib/site-contacts';
import { buildPublicUrl } from '@/lib/site-url';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const occurrences = (source: string, value: string) => source.split(value).length - 1;

const pageSource = read('app/(public)/contacts/page.tsx');
const formSource = read('app/(public)/contacts/contact-form.tsx');
const legalSection = pageSource.slice(pageSource.indexOf('aria-labelledby="legal-information-title"'));

assert.equal(siteContacts.phone.display, '(068) 008 77 08');
assert.equal(siteContacts.phone.href, 'tel:+380680087708');
assert.equal(companyLegalDetails.legalPhone.display, '+38 (067) 668-08-08');
assert.equal(companyLegalDetails.legalPhone.href, 'tel:+380676680808');
assert.notEqual(siteContacts.phone.href, companyLegalDetails.legalPhone.href);
assert.equal(siteContacts.email.display, 'kairos_parts@ukr.net');
assert.equal(siteContacts.address.display, 'м. Кагарлик, вул. Миронівська, 33д');
assert.notEqual(siteContacts.address.display, companyLegalDetails.legalAddress.display);
assert.equal(siteContacts.telegram.display, '@kairos_parts_bot');
assert.equal(siteContacts.workingHours.display, 'Пн–Сб: 08:30–17:30');

assert.equal((pageSource.match(/<h1\b/g) ?? []).length, 1);
assert.equal(occurrences(pageSource, 'id="legal-information-title"'), 1);
assert.match(pageSource, /<h2[\s\S]*Юридична інформація/);
assert.doesNotMatch(pageSource, /Оберіть зручний спосіб зв’язку/);
assert.doesNotMatch(legalSection, /ОПЕРАТОР СЕРВІСУ/);
assert.match(
  legalSection,
  /Реквізити ТОВ «КАЙРОС ПАРТС» як оператора сервісу та володільця персональних даних\./
);

assert.match(legalSection, />Юридична особа</);
assert.match(legalSection, /companyLegalDetails\.shortName/);
assert.match(legalSection, /Повна назва:/);
assert.match(legalSection, /companyLegalDetails\.fullName/);
assert.match(legalSection, />ЄДРПОУ</);
assert.match(pageSource, /ЮРИДИЧНА АДРЕСА ТА АДРЕСА ДЛЯ ЛИСТУВАННЯ/);
assert.match(pageSource, /secondaryLabel: 'ТЕЛЕФОН У РЕКВІЗИТАХ'/);
assert.match(legalSection, />Письмові претензії</);

assert.equal(occurrences(pageSource, "label: 'EMAIL'"), 1);
assert.equal(occurrences(pageSource, 'siteContacts.email.display'), 2);
assert.equal(occurrences(pageSource, 'siteContacts.email.href'), 1);
assert.equal(occurrences(pageSource, 'companyLegalDetails.email.display'), 0);
assert.equal(occurrences(pageSource, 'companyLegalDetails.email.href'), 0);
assert.equal(occurrences(pageSource, 'companyLegalDetails.legalAddress.display'), 1);
assert.equal(occurrences(pageSource, 'siteContacts.address.display'), 2);
assert.equal(occurrences(pageSource, 'companyLegalDetails.legalPhone.display'), 2);
assert.equal(occurrences(pageSource, 'siteContacts.phone.display'), 2);
assert.doesNotMatch(legalSection, /label="Володілець персональних даних"/);
assert.doesNotMatch(legalSection, /label="Запити щодо персональних даних"/);
assert.match(legalSection, /Приймаються поштою за зазначеною в блоці контактів юридичною адресою\./);
assert.doesNotMatch(legalSection, /Письмові претензії приймаються[\s\S]*companyLegalDetails\.legalAddress\.display/);

const legalTitleIndex = pageSource.indexOf('id="legal-information-title"');
const legalEntityIndex = pageSource.indexOf('companyLegalDetails.shortName');
const contactGridIndex = pageSource.indexOf('Контактна інформація');
const edrpouIndex = pageSource.indexOf('companyLegalDetails.edrpou');
const formIndex = pageSource.indexOf('<ContactForm />');
const claimsIndex = pageSource.indexOf('Письмові претензії');
assert.ok(legalTitleIndex < legalEntityIndex);
assert.ok(legalEntityIndex < contactGridIndex);
assert.ok(edrpouIndex < formIndex);
assert.ok(formIndex < claimsIndex);
assert.equal(occurrences(pageSource, '<ContactForm />'), 1);

assert.match(pageSource, /ОФІС, СКЛАД, БАЗА, ПУНКТ ОБСЛУГОВУВАННЯ ТА ВИДАЧІ/);
assert.match(pageSource, /value: siteContacts\.address\.display,[\s\S]*Відвідування можливе без попереднього погодження/);
assert.match(pageSource, /secondaryLabel: 'ЮРИДИЧНА АДРЕСА',[\s\S]*companyLegalDetails\.legalAddress\.display/);
assert.match(pageSource, /lg:grid-cols-\[minmax\(0,0\.37fr\)_minmax\(0,0\.63fr\)\]/);
assert.match(pageSource, /overflow-hidden/);
assert.match(pageSource, /break-words/);
assert.match(pageSource, /focus-visible:outline/);

assert.match(formSource, /name="name"/);
assert.match(formSource, /name="company"/);
assert.match(formSource, /name="phone"/);
assert.match(formSource, /name="email"/);
assert.match(formSource, /name="topic"/);
assert.match(formSource, /name="message"/);
assert.match(formSource, /name="website"/);
assert.match(formSource, /name="consent"/);
assert.match(formSource, /type="checkbox"/);
assert.match(formSource, /required/);
assert.match(formSource, /href="\/privacy-policy"/);
assert.match(formSource, /Надсилання заявки через сайт не є автоматичним укладенням договору/);

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

const sitemapUrls = sitemap().map((entry) => entry.url);
assert.equal(sitemapUrls.length, 8);
assert.equal(new Set(sitemapUrls).size, 8);
assert.equal(sitemapUrls.includes(buildPublicUrl('/contacts')), true);

console.log(
  `stageLegal1FContacts=PASS layout=single-section emailGroups=1 sitemapUrls=${sitemapUrls.length} canonical=${String(metadata.alternates?.canonical)}`
);
