import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const homepage = read('app/(public)/page.tsx');
const about = read('app/(public)/about/page.tsx');
const howItWorks = read('app/(public)/how-it-works/page.tsx');
const contacts = read('app/(public)/contacts/page.tsx');
const advantages = read('app/(public)/advantages/page.tsx');
const publicLayout = read('components/layout/public-layout.tsx');
const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const heroBeforeSecondSection = (source: string) => source.split('</section>', 1)[0] ?? source;
const backdropUsageCount = (homepage.match(/<HomepageSectionBackdrop \/>/g) ?? []).length;

const checks = [
  {
    name: 'homepage duplicate fleet panel is removed',
    pass: !homepage.includes('heroFleetHighlights')
      && !homepage.includes('Кожне замовлення автоматично поповнює цифрову історію вашої техніки.')
  },
  {
    name: 'homepage hero keeps both primary CTAs',
    pass: heroBeforeSecondSection(homepage).includes('Створити заявку')
      && heroBeforeSecondSection(homepage).includes('Надіслати заявку в Telegram')
  },
  {
    name: 'homepage hero punctuation is updated exactly',
    pass: homepage.includes('Kairos Parts — сервіс для B2B-клієнтів аграрної та транспортної галузі</p>')
      && homepage.includes('Для аграрної, вантажної та спеціальної техніки\n')
  },
  {
    name: 'three homepage sections reuse one backdrop component',
    pass: backdropUsageCount === 3
  },
  {
    name: 'about hero CTA is removed while final CTA remains',
    pass: !heroBeforeSecondSection(about).includes('Створити заявку')
      && about.includes('Створити заявку')
  },
  {
    name: 'how-it-works hero CTAs are removed while final CTA remains',
    pass: !heroBeforeSecondSection(howItWorks).includes('Створити заявку')
      && !heroBeforeSecondSection(howItWorks).includes('Надіслати заявку в Telegram')
      && howItWorks.includes('Створити заявку')
      && howItWorks.includes('Надіслати в Telegram')
  },
  {
    name: 'contacts hero CTAs are removed while contact channels remain',
    pass: !heroBeforeSecondSection(contacts).includes('Створити заявку')
      && !heroBeforeSecondSection(contacts).includes('Написати в Telegram')
      && contacts.includes(telegramBotUrl)
  },
  {
    name: 'advantages is absent from shared navigation',
    pass: !publicLayout.includes("href: '/advantages'")
  },
  {
    name: 'advantages route returns notFound without deleting page content',
    pass: advantages.includes('const ADVANTAGES_PAGE_ENABLED = false')
      && advantages.includes('notFound()')
      && advantages.includes('const advantages = [')
  }
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}: ${check.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
