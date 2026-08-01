# Stage Legal 1D — Legal Pages Layout Simplification

## 1. Executive summary

Layout `/privacy-policy` і `/terms-of-use` спрощено до одного повноширинного документа в стандартному `kp-container`. Блоки «Зміст», sidebar, sticky navigation і окремі вузькі identity cards видалено. Володілець персональних даних та оператор сервісу стали першими основними секціями й використовують ті самі page-local section components, що й решта документа. Юридичний зміст, реквізити, metadata, sitemap, footer і form integrations збережені.

## 2. Git baseline

- Branch: `develop`.
- Початковий HEAD: `6d3bf446710d0378448763f45fe781d03aefbd78` (`feat: add terms of use`).
- Working tree до змін: clean.
- Legal 1B `ce55ba2dde0cfb53ea922dccc934dff473f18684`: ancestor `develop`.
- Legal 1C `6d3bf446710d0378448763f45fe781d03aefbd78`: ancestor `develop`.
- Pull, reset, rebase, merge і production operations не виконувалися.

## 3. Scope and constraints

Scope обмежено двома legal page components, новим target regression, `package.json` і цим report. Не змінювалися footer, форми, notices, server actions, metadata/SEO implementation, sitemap, robots, БД, Prisma schema/migrations, production configuration або зовнішні сервіси.

## 4. Previous legal page layout

Обидві сторінки використовували desktop grid `34% / 66%`. Ліва sticky `<aside>` містила окрему identity card і navigation card «Зміст», а основний документ займав лише праву колонку. Через це документ був вужчим за доступний container і після видалення navigation міг залишити порожню колонку.

| Page | Element | Before | After |
| --- | --- | --- | --- |
| Privacy | Content navigation | Sticky sidebar зі змістом | Видалено |
| Privacy | Володілець даних | Окрема вузька card у sidebar | Перша повноширинна `PolicySection` |
| Privacy | Document | 66% desktop grid column | Повна ширина `kp-container` |
| Terms | Content navigation | Sticky sidebar зі змістом | Видалено |
| Terms | Оператор сервісу | Окрема вузька card у sidebar | Перша повноширинна `TermsSection` |
| Terms | Document | 66% desktop grid column | Повна ширина `kp-container` |

## 5. Table of contents removal

З обох сторінок видалено заголовок «Зміст», `<nav>`, `<ol>`, anchor-link rendering, декоративний container і масиви `sections`. Section `id` збережені для accessibility та прямих посилань. Порожньої колонки не залишилося.

## 6. Privacy owner section normalization

`controller` переміщено на перше місце серед основних секцій і перейменовано на `1. Володілець персональних даних`. Реквізити з колишньої identity card перенесено в цю `PolicySection`: повна й скорочена назва, ЄДРПОУ, юридична адреса та email для запитів. Колишній загальний розділ збережено другим із заголовком `2. Загальні положення`.

## 7. Terms operator section normalization

`operator` переміщено на перше місце й має заголовок `1. Оператор сервісу`. У тій самій `TermsSection` збережено повну й скорочену назву, ЄДРПОУ, юридичну адресу та email. Загальні положення перенесено на друге місце без зміни їхнього тексту.

## 8. Full-width section layout

Зовнішній wrapper обох документів тепер має лише `kp-container`. Усередині нього один `article` займає всю доступну ширину container, а всі `PolicySection`/`TermsSection` мають однакову фактичну ширину. `lg:grid-cols-*`, legal `<aside>`, sticky positioning і вузька document column відсутні.

## 9. Shared component changes

Новий shared component не створювався: дві сторінки вже мали page-local `PolicySection` і `TermsSection` з однаковим структурним підходом. Identity blocks переведено на ці наявні helpers. Це уникнуло позаскоупного refactor і не додало client boundary.

## 10. Content preservation

Privacy зберігає 19 секцій, Terms — 24. Збережено section IDs, effective dates, retention, request status, approvals/documents, upload rules, liability, claims, applicable law і legal-review caveats. Зміни тексту обмежені перенесенням identity details із sidebar та мінімальною перестановкою/нумерацією перших двох заголовків.

## 11. Metadata and SEO preservation

`lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts` і footer не змінювалися. Canonical залишилися `/privacy-policy` та `/terms-of-use`, robots — `index, follow`, sitemap — 15 унікальних URL без exact `/categories`.

## 12. Responsive browser QA

Production-like build запущено локально. На 1280×720 обидва документи мали `article` шириною 1217 px, а всі внутрішні секції — однакові 1135 px. На 390×844 усі секції мали однакові 293 px. Для обох viewport підтверджено: один H1, правильний перший H2, відсутність «Змісту» й aside, no horizontal overflow, no full-screen overlay, footer/legal links на місці та чиста console.

## 13. Regression tests

Додано `test:legal-layout-1d`. Він перевіряє відсутність visible contents navigation, aside/sticky/two-column patterns, правильний порядок owner/operator, використання section helpers, 19/24 секції, реквізити, canonical, `index, follow`, footer links, 15 sitemap URL і відсутність `/categories`. Legal 1A/1B/1C та SEO assertions не послаблювалися.

## 14. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run test:legal-layout-1d` | PASS | Privacy 19, Terms 24, sitemap 15 |
| `npm run test:legal-terms-1c` | PASS | 24 sections, canonical preserved |
| `npm run test:legal-privacy-1b` | PASS | 19 sections, canonical preserved |
| `npm run test:legal-contacts-1a` | PASS | Consent and canonical preserved |
| `npm run test:seo-crawl-foundation` | PASS | 15 URLs, 10 robots exclusions |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run build` | PASS | Next.js 15.5.19, 58 pages generated |
| Local HTTP | PASS | Privacy і Terms: 200, one H1, correct canonical |
| Desktop browser 1280×720 | PASS | Equal section widths, no sidebar/overflow/overlay |
| Mobile browser 390×844 | PASS | Equal section widths, no sidebar/overflow/overlay |
| Browser console | PASS | No warning/error entries on either page |
| `git diff --check` | PASS | Whitespace errors відсутні; повторити після commit |

## 15. Files changed

- `app/(public)/privacy-policy/page.tsx`
- `app/(public)/terms-of-use/page.tsx`
- `scripts/check-stage-legal-1d-legal-pages-layout-simplification.ts`
- `package.json`
- `docs/reports/stage-legal-1d-legal-pages-layout-simplification.md`

## 16. Deferred work

Не виконувалися нове юридичне редагування, shared legal component refactor, versioned acceptance logging, cookie/analytics work або production publishing. Формальне versioned acceptance залишається окремим потенційним Stage Legal 2.

## 17. Production approval checklist

- Переглянути локальний commit і цей report.
- За потреби перевірити Vercel Preview окремо після дозволеного push.
- Повторити Legal/SEO/build gates на release candidate.
- Окремо затвердити develop-to-main merge.
- Окремо затвердити production deploy.
- Після deploy виконати live desktop/mobile, canonical і sitemap smoke.

## 18. Final conclusion

Stage Legal 1D реалізує лише погоджене спрощення legal layout: content navigation і sidebar видалені, identity sections уніфіковані, документи використовують повну ширину стандартного container. Юридичний зміст та інтеграції збережені; DB, production і release operations залишилися поза scope.
