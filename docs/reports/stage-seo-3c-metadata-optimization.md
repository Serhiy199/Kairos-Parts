# Stage SEO 3C — Metadata Optimization

Дата: 2026-08-03

## 1. Executive summary

У `develop` оптимізовано лише metadata для `/`, `/how-it-works` і `/logistics`. Єдине джерело title/description залишилося в `lib/seo.ts`; чинний `createPublicMetadata()` синхронізує SEO, Open Graph і Twitter metadata та зберігає self-canonical і `index, follow`.

Visible page content delta дорівнює `0`: три page-файли не змінювалися, їх SHA-256 до/після однаковий. Sitemap, robots, routes, structured data, legal/about/contacts/used-equipment metadata, БД та infrastructure не змінювалися. Усі обов'язкові tests, lint, typecheck, build, локальна HTML-перевірка й browser QA пройшли.

## 2. Git baseline

| Check | Result |
| --- | --- |
| Branch | `develop` |
| Baseline HEAD | `28e77ff68fab4426127dac6751a08a5d740659e7` |
| Baseline commit | `refactor: remove public category routes` |
| Stage SEO 3A ancestry | PASS, `28e77ff...` є ancestor `develop` |
| `git diff --check` | PASS |
| Stash | Один старий сторонній stash; не застосовувався і не змінювався |
| Pre-existing untracked files | Stage SEO 3B report і production release SEO3A report |

Очікування повністю clean tree не виконувалося ще до Stage 3C через два untracked reports. Обидва не перетинаються з implementation scope, збережені без перезапису й не включаються до Stage 3C commit.

## 3. Scope and constraints

Дозволений diff обмежено centralized metadata descriptors, target regression test, npm script і цим report. Заборонені visible content, H1–H3, абзаци, CTA, layout, links, footer, forms, sitemap, robots, canonical paths, routes, structured data, DB/Prisma, Nginx, DNS, Search Console, push, merge та deploy не змінювалися.

## 4. Stage SEO 3B inputs

Повністю прочитано:

- `docs/reports/stage-seo-3b-search-intent-keyword-mapping-audit.md`;
- `docs/reports/stage-seo-3a-remove-public-category-routes.md`;
- `docs/reports/stage-production-seo-1-canonical-crawl-foundation.md`.

Використано підтверджене розмежування intent: `/` — Parts/commercial overview; `/how-it-works` — assisted online selection process; `/logistics` — agricultural Logistics. Legal pages не оптимізувалися під commercial queries. Старі audit-time production observations не вважалися поточним production proof.

## 5. Confirmed business rules

- Parts: Кагарлик і Кагарлицька територіальна громада; оригінальні деталі й перевірені аналоги залежать від конкретної заявки та постачальників.
- Сервіс працює із сільськогосподарською, вантажною та спеціальною технікою; сайт не є інтернет-магазином і не має checkout.
- Logistics: pickup у постачальників у межах Київської області; destination — база Kairos Parts у Кагарлику або господарства Кагарлицької територіальної громади; аудиторія — агропідприємства.
- Urgent, express, same-day SLA, region-wide delivery destination і гарантована наявність originals не заявляються.

## 6. Current metadata baseline

Metadata source: `lib/seo.ts` → `PUBLIC_PAGE_SEO`. Shared helper: `createPublicMetadata()`. Page-level metadata лише передає відповідний descriptor у factory.

| URL | Current title | Current description | Canonical | Robots | Source |
| --- | --- | --- | --- | --- | --- |
| `/` | Підбір запчастин для техніки — Kairos Parts | Kairos Parts допомагає бізнесу підібрати та замовити запчастини для аграрної, вантажної й спеціальної техніки. | `https://kairos-parts.com.ua/` | index, follow | `PUBLIC_PAGE_SEO.home` |
| `/how-it-works` | Як працює підбір запчастин — Kairos Parts | Сім зрозумілих кроків від створення заявки до погодження, доставки та збереження історії обслуговування техніки. | `https://kairos-parts.com.ua/how-it-works` | index, follow | `PUBLIC_PAGE_SEO.howItWorks` |
| `/logistics` | Kairos Logistics — доставка товарів для агропідприємств \| Kairos Parts | Забір товарів у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або в господарства Кагарлицької громади. | `https://kairos-parts.com.ua/logistics` | index, follow | `PUBLIC_PAGE_SEO.logistics` |

Baseline factory already produced matching `og:title`, `og:description`, `og:url`, Twitter title/description, `site_name=Kairos Parts`, `locale=uk_UA`, `type=website` and `card=summary`.

## 7. Homepage metadata changes

Title: `Підбір запчастин у Кагарлику | Kairos Parts` (43 characters).

Description: `Підбір оригінальних запчастин і перевірених аналогів для сільськогосподарської, вантажної та спеціальної техніки в Кагарлику й Кагарлицькій територіальній громаді.` (163 characters).

Title зберігає primary service, brand і natural local signal без переліку всіх equipment subtypes. Description описує request-led selection, а не гарантовану складську наявність.

## 8. How-it-works metadata changes

Title: `Як відбувається підбір запчастин онлайн | Kairos Parts` (54 characters).

Description: `Дізнайтеся, як Kairos Parts підбирає запчастини за моделлю техніки, VIN, серійним або каталожним номером, фото чи списком позицій та погоджує оригінали й аналоги.` (162 characters).

Обрано рекомендований process-first варіант `Як відбувається...`: він чітко відділяє informational/process intent від commercial/local homepage intent і не дублює H1. Перелік identification inputs описує доступні способи, а не обов'язковий VIN-only flow.

## 9. Logistics metadata changes

Title: `Логістика для агропідприємств у Кагарлику | Kairos Logistics` (60 characters).

Description: `Забір товарів і запчастин у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або господарств Кагарлицької територіальної громади.` (166 characters).

Title зберігає окремий Kairos Logistics brand і звужує audience/geography. Description навмисно розрізняє pickup region та delivery destinations.

| URL | Previous title | New title | Previous description | New description |
| --- | --- | --- | --- | --- |
| `/` | Підбір запчастин для техніки — Kairos Parts | Підбір запчастин у Кагарлику \| Kairos Parts | Kairos Parts допомагає бізнесу підібрати та замовити запчастини для аграрної, вантажної й спеціальної техніки. | Підбір оригінальних запчастин і перевірених аналогів для сільськогосподарської, вантажної та спеціальної техніки в Кагарлику й Кагарлицькій територіальній громаді. |
| `/how-it-works` | Як працює підбір запчастин — Kairos Parts | Як відбувається підбір запчастин онлайн \| Kairos Parts | Сім зрозумілих кроків від створення заявки до погодження, доставки та збереження історії обслуговування техніки. | Дізнайтеся, як Kairos Parts підбирає запчастини за моделлю техніки, VIN, серійним або каталожним номером, фото чи списком позицій та погоджує оригінали й аналоги. |
| `/logistics` | Kairos Logistics — доставка товарів для агропідприємств \| Kairos Parts | Логістика для агропідприємств у Кагарлику \| Kairos Logistics | Забір товарів у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або в господарства Кагарлицької громади. | Забір товарів і запчастин у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або господарств Кагарлицької територіальної громади. |

## 10. Forbidden claims audit

| Forbidden phrase | Present before | Present after | Result |
| --- | ---: | ---: | --- |
| магазин / інтернет-магазин | No | No | PASS |
| купити / купити онлайн | No | No | PASS |
| Кагарлицький район | No | No | PASS |
| термінова / експрес доставка | No | No | PASS |
| доставка день у день / same-day | No | No | PASS |
| доставка по всій Київській області | No | No | PASS |
| логістика для будь-якого бізнесу | No | No | PASS |
| гарантована наявність оригінальних запчастин | No | No | PASS |

Meta keywords, hidden keyword arrays, Vercel, localhost і `www` не додано. Target strings унікальні й написані як natural descriptions, а не keyword lists.

## 11. Open Graph and Twitter synchronization

`createPublicMetadata()` для кожної сторінки повертає exact SEO title/description як OG і Twitter title/description. OG URL дорівнює self-canonical; `siteName=Kairos Parts`, `locale=uk_UA`, `type=website`. Twitter card збережено `summary`. OG/Twitter images не змінювалися.

## 12. Canonical and robots preservation

| URL | Canonical after | Robots after | Result |
| --- | --- | --- | --- |
| `/` | `https://kairos-parts.com.ua/` (HTML URL-equivalent serialization без trailing slash) | index, follow | PASS |
| `/how-it-works` | `https://kairos-parts.com.ua/how-it-works` | index, follow | PASS |
| `/logistics` | `https://kairos-parts.com.ua/logistics` | index, follow | PASS |

Canonical origin залишається production apex `https://kairos-parts.com.ua`.

## 13. Visible-content preservation

Visible page content delta: `0`.

| Component | Expected unchanged | Result |
| --- | --- | --- |
| Three page source files | Byte-for-byte unchanged | PASS, SHA-256 before=after |
| H1 | Exact text unchanged | PASS |
| H2/H3, paragraphs, cards, lists | No source diff | PASS |
| CTA, navigation, internal links | No source diff | PASS |
| Layout, footer, forms, notices | No source diff | PASS |
| Structured visible content | No source diff | PASS |

H1 before/after:

- `/`: `Підберемо запчастини для вашої техніки за одним запитом` = same;
- `/how-it-works`: `Від заявки до доставки — зрозумілий процес у 7 кроків` = same;
- `/logistics`: `Оперативне забезпечення підприємств критично важливими ТМЦ` = same.

SHA-256: home `DC214BB025A99068E2E8E519B947B49B5E193F99E20478CB78BEACF85FBE870A`; how `AB68AD065CE4C7EE4E32F462E775CE22137377775A95B34ABBFF39E89AF7D903`; logistics `8027DB29EEE54B63DFAA46D2A2A62DC807C160CCB2256EDD94E5437A120D6B4A`.

## 14. Sitemap preservation

`app/sitemap.ts` не змінювався. Local XML містить рівно 8 URL у затвердженому порядку: `/`, `/about`, `/how-it-works`, `/contacts`, `/privacy-policy`, `/terms-of-use`, `/logistics`, `/used-equipment`. `/categories` відсутній. `robots.txt` не змінювався, посилається на apex sitemap і не має global disallow.

## 15. Regression tests

Додано `npm run test:seo-metadata-3c`. Test перевіряє exact target metadata, збереження metadata інших п'яти pages, canonical/robots, OG/Twitter parity, forbidden claims, відсутність meta keywords, 8-URL sitemap без categories та exact H1 source fragments.

| Check | Result | Evidence |
| --- | --- | --- |
| `test:seo-metadata-3c` | PASS | targets=3, sitemapUrls=8 |
| `test:seo-remove-public-categories` | PASS | removedRoutes=8, sitemapUrls=8, publicSources=28 |
| `test:seo-crawl-foundation` | PASS | sitemapUrls=8, canonical apex |
| Legal Contacts 1A | PASS | canonical, consent/status contracts |
| Legal Privacy 1B | PASS | sections=19, sitemapUrls=8 |
| Legal Terms 1C | PASS | sections=24, sitemapUrls=8 |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm run build` | PASS | Next 15.5.19, 51/51 static pages |

Перший typecheck запуск виявив union-narrowing лише у новому test для OG/Twitter. Assertions виправлено через перевірку наявності ключів; повторні target test, lint і typecheck пройшли.

## 16. Local HTML validation

Production build піднято через `next start` на локальному порту. Тимчасовому процесу передано навмисно недоступний localhost `DATABASE_URL`, тому зовнішня/production DB не читалася і не змінювалася.

Для `/`, `/how-it-works`, `/logistics`: HTTP `200`; exact `<title>` і description; self-canonical; `robots=index, follow`; matching OG title/description/url; matching Twitter title/description; один exact unchanged H1. `/sitemap.xml`: `200`, 8 URL, categories absent. `/robots.txt`: `200`, apex sitemap, no global disallow. Local server після перевірки зупинено.

## 17. Browser smoke QA

Viewport `1280×720` і `390×844`: усі три routes відкрилися, body content присутній, H1/title/head правильні, horizontal overflow і Next.js error overlay відсутні. Desktop header navigation перевірено кліком `/` → `/how-it-works`; CTA — `/how-it-works` → `/request`. Mobile menu відкрився, navigation перевірено кліком `/` → `/logistics`.

Chrome extension surface показав один сторонній message-channel error від самого browser extension. Контрольний повтор у isolated in-app browser для трьох routes: application console errors `0`, warnings `0`, overlays `0`. Отже application console clean — PASS.

## 18. Files changed

- `lib/seo.ts` — шість target title/description values;
- `scripts/check-seo-metadata-3c.ts` — target regression;
- `package.json` — `test:seo-metadata-3c`;
- `docs/reports/stage-seo-3c-metadata-optimization.md` — цей evidence report.

Жоден page component не змінено.

## 19. Production approval checklist

Перед окремо дозволеним release: review commit scope; повторити CI tests/lint/typecheck/build; підтвердити exact commit у Preview; перевірити rendered metadata/H1; merge лише за окремим approval; production deploy без DB/schema changes; після deploy перевірити три live pages, sitemap=8 і categories=404. Цей етап не надає дозволу на push, merge або deploy.

## 20. Search Console follow-up

Лише після окремо погодженого production deploy: URL Inspection для трьох routes; request indexing за потреби; повторно submit/read apex sitemap; monitor query/snippet changes без негайних додаткових metadata переписувань. У цьому етапі Google Search Console не змінювався.

## 21. Final conclusion

Stage SEO 3C виконано локально в `develop` із metadata-only scope. Три intent owners отримали точні, унікальні й claim-safe title/description; OG/Twitter синхронні; canonical, robots, sitemap=8, `/categories` absence і metadata інших п'яти pages збережені. Visible content delta — `0`; усі validations PASS. DB, Prisma migrations/schema, Nginx, DNS, Search Console і production не змінювалися. Push, merge та deploy не виконувалися.
