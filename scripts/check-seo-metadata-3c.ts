import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STATIC_SITEMAP_PATHS } from '@/app/sitemap';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';
import { buildPublicUrl, PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

const EXPECTED_TARGETS = {
  home: {
    path: '/',
    title: 'Підбір запчастин у Кагарлику | Kairos Parts',
    description:
      'Підбір оригінальних запчастин і перевірених аналогів для сільськогосподарської, вантажної та спеціальної техніки в Кагарлику й Кагарлицькій територіальній громаді.'
  },
  howItWorks: {
    path: '/how-it-works',
    title: 'Як відбувається підбір запчастин онлайн | Kairos Parts',
    description:
      'Дізнайтеся, як Kairos Parts підбирає запчастини за моделлю техніки, VIN, серійним або каталожним номером, фото чи списком позицій та погоджує оригінали й аналоги.'
  },
  logistics: {
    path: '/logistics',
    title: 'Логістика для агропідприємств у Кагарлику | Kairos Logistics',
    description:
      'Забір товарів і запчастин у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або господарств Кагарлицької територіальної громади.'
  }
} as const;

const EXPECTED_PRESERVED = {
  about: {
    path: '/about',
    title: 'Про Kairos Parts — підбір запчастин для бізнесу',
    description:
      'Дізнайтеся, як Kairos Parts організовує підбір, постачання та цифрову історію запчастин для техніки підприємств.'
  },
  contacts: {
    path: '/contacts',
    title: 'Контакти Kairos Parts — зв’язок із командою',
    description:
      'Контактні канали, адреса та юридична інформація Kairos Parts для звернень щодо запчастин, документів і співпраці.'
  },
  privacyPolicy: {
    path: '/privacy-policy',
    title: 'Політика конфіденційності | Kairos Parts',
    description:
      'Інформація про те, які персональні дані обробляє Kairos Parts, для чого вони використовуються, як захищаються та як подати запит щодо своїх даних.'
  },
  termsOfUse: {
    path: '/terms-of-use',
    title: 'Умови користування | Kairos Parts',
    description:
      'Правила користування сайтом Kairos Parts, особистим кабінетом, заявками, документами та іншими функціями сервісу.'
  },
  usedEquipment: {
    path: '/used-equipment',
    title: 'БВ техніка — Kairos Parts',
    description:
      'Публічний каталог перевіреної вживаної аграрної, вантажної та спеціальної техніки Kairos Parts.'
  }
} as const;

const FORBIDDEN_METADATA_PHRASES = [
  'магазин',
  'купити',
  'Кагарлицький район',
  'термінова',
  'експрес',
  'день у день',
  'same-day',
  'доставка по всій Київській області',
  'логістика для будь-якого бізнесу',
  'гарантована наявність оригінальних запчастин'
] as const;

const EXPECTED_PAGE_HEADINGS = [
  {
    file: 'app/(public)/page.tsx',
    fragments: ['Підберемо запчастини для вашої техніки', 'за одним запитом']
  },
  {
    file: 'app/(public)/how-it-works/page.tsx',
    fragments: ['Від заявки до доставки —', 'зрозумілий процес у 7 кроків']
  },
  {
    file: 'app/(public)/logistics/page.tsx',
    fragments: ['Оперативне забезпечення підприємств критично важливими ТМЦ']
  }
] as const;

assert.deepEqual(PUBLIC_PAGE_SEO.home, EXPECTED_TARGETS.home);
assert.deepEqual(PUBLIC_PAGE_SEO.howItWorks, EXPECTED_TARGETS.howItWorks);
assert.deepEqual(PUBLIC_PAGE_SEO.logistics, EXPECTED_TARGETS.logistics);

assert.deepEqual(PUBLIC_PAGE_SEO.about, EXPECTED_PRESERVED.about);
assert.deepEqual(PUBLIC_PAGE_SEO.contacts, EXPECTED_PRESERVED.contacts);
assert.deepEqual(PUBLIC_PAGE_SEO.privacyPolicy, EXPECTED_PRESERVED.privacyPolicy);
assert.deepEqual(PUBLIC_PAGE_SEO.termsOfUse, EXPECTED_PRESERVED.termsOfUse);
assert.deepEqual(PUBLIC_PAGE_SEO.usedEquipment, EXPECTED_PRESERVED.usedEquipment);

for (const target of Object.values(EXPECTED_TARGETS)) {
  const metadata = createPublicMetadata(target);
  const canonical = buildPublicUrl(target.path);

  assert.equal(metadata.title, target.title);
  assert.equal(metadata.description, target.description);
  assert.equal(String(metadata.alternates?.canonical), canonical);
  assert.equal(metadata.openGraph?.title, target.title);
  assert.equal(metadata.openGraph?.description, target.description);
  assert.equal(metadata.openGraph && 'url' in metadata.openGraph ? String(metadata.openGraph.url) : '', canonical);
  assert.equal(metadata.openGraph?.siteName, 'Kairos Parts');
  assert.equal(metadata.openGraph?.locale, 'uk_UA');
  assert.equal(metadata.openGraph && 'type' in metadata.openGraph ? metadata.openGraph.type : '', 'website');
  assert.equal(metadata.twitter?.title, target.title);
  assert.equal(metadata.twitter?.description, target.description);
  assert.equal(metadata.twitter && 'card' in metadata.twitter ? metadata.twitter.card : '', 'summary');
  assert.deepEqual(metadata.robots, { index: true, follow: true });

  const combinedMetadata = `${target.title}\n${target.description}`.toLocaleLowerCase('uk-UA');
  for (const phrase of FORBIDDEN_METADATA_PHRASES) {
    assert.equal(
      combinedMetadata.includes(phrase.toLocaleLowerCase('uk-UA')),
      false,
      `${target.path} metadata must not contain forbidden phrase: ${phrase}`
    );
  }
}

assert.match(EXPECTED_TARGETS.home.title, /Підбір запчастин/);
assert.match(EXPECTED_TARGETS.home.title, /Кагарлик/);
assert.match(EXPECTED_TARGETS.home.title, /Kairos Parts/);
for (const fragment of ['оригінальних запчастин', 'аналогів', 'сільськогосподарськ', 'Кагарлику', 'Кагарлицькій територіальній громаді']) {
  assert.match(EXPECTED_TARGETS.home.description, new RegExp(fragment));
}

assert.match(EXPECTED_TARGETS.howItWorks.title, /підбір запчастин онлайн/i);
for (const fragment of ['моделлю техніки', 'VIN', 'серійним або каталожним номером', 'фото чи списком позицій', 'оригінали й аналоги']) {
  assert.match(EXPECTED_TARGETS.howItWorks.description, new RegExp(fragment));
}

for (const fragment of ['Логістика', 'агропідприємств', 'Кагарлику', 'Kairos Logistics']) {
  assert.match(EXPECTED_TARGETS.logistics.title, new RegExp(fragment));
}
assert.match(EXPECTED_TARGETS.logistics.description, /постачальників у межах Київської області/);
assert.match(EXPECTED_TARGETS.logistics.description, /до бази Kairos Parts у Кагарлику або господарств Кагарлицької територіальної громади/);

assert.equal(PUBLIC_SITE_ORIGIN, 'https://kairos-parts.com.ua');
assert.deepEqual(STATIC_SITEMAP_PATHS, [
  '/',
  '/about',
  '/how-it-works',
  '/contacts',
  '/privacy-policy',
  '/terms-of-use',
  '/logistics',
  '/used-equipment'
]);
assert.equal(STATIC_SITEMAP_PATHS.some((path) => path.startsWith('/categories')), false);

const seoSource = readFileSync(join(process.cwd(), 'lib/seo.ts'), 'utf8');
assert.doesNotMatch(seoSource, /\bkeywords\s*:/i);
assert.doesNotMatch(seoSource, /<meta\s+[^>]*name=["']keywords["']/i);

for (const { file, fragments } of EXPECTED_PAGE_HEADINGS) {
  const source = readFileSync(join(process.cwd(), file), 'utf8');
  assert.match(source, /<h1(?:\s|>)/);
  for (const fragment of fragments) {
    assert.equal(source.includes(fragment), true, `${file} must preserve H1 fragment: ${fragment}`);
  }
}

console.log(
  `seoMetadata3c=PASS targets=${Object.keys(EXPECTED_TARGETS).length} sitemapUrls=${STATIC_SITEMAP_PATHS.length} canonicalOrigin=${PUBLIC_SITE_ORIGIN}`
);
