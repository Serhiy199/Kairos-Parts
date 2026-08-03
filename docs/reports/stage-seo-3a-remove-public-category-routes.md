# Stage SEO 3A — Remove Public Category Routes Completely

## 1. Executive summary

Публічний SEO/landing-розділ категорій повністю прибрано з `develop`. Загальний `/categories` уже не мав source page до початку етапу; єдиний dynamic route `app/(public)/categories/[slug]/page.tsx`, який генерував сім дочірніх сторінок, видалено. Sitemap скорочено до 8 затверджених canonical URL. Public category links, breadcrumb nodes і structured-data references у чинному UI відсутні.

Внутрішні `/admin/categories`, `/api/categories`, `/api/categories/[slug]`, Prisma/CRM сутності та бізнес-довідник `lib/catalog/catalog-data.ts` не змінювалися.

## 2. Git baseline

- Branch: `develop`.
- Baseline HEAD: `eb6f5e01ff663ce1b1ac631e683dded89132a470` (`style: recompose contacts information`).
- На pre-check робоче дерево вже містило незакомічений Stage SEO 3A diff: видалення dynamic page, sitemap/route registry/permission/test updates і новий target test. Ці зміни були проаудитовані перед продовженням; reset, clean, rebase або перезапис не виконувалися.
- `git diff --check` на baseline не виявив whitespace errors (Git показував лише інформаційні LF→CRLF warnings для робочої копії).

## 3. Previous public category architecture

- `/categories` source page був видалений раніше.
- `app/(public)/categories/[slug]/page.tsx` використовував `generateStaticParams()` і `catalogCategories`, генеруючи сім дочірніх landing pages.
- Dynamic page містив власні metadata/canonical, опис категорії, підкатегорії, виробників і CTA на `/request`.
- Category URLs додавалися в sitemap на основі `catalogCategories`.

## 4. Route dependency audit

Перевірено `app/(public)/categories`, public layout/header/mobile/footer, homepage, `/how-it-works`, sitemap, robots, route registries, permission prefixes, metadata helpers, JSON-LD/breadcrumb patterns, scripts, package scripts і історичні docs/reports.

Результат:

- єдиним source public route був `[slug]/page.tsx`;
- окремих category layout/loading/error/not-found/catch-all files немає;
- у чинному public UI немає `href`, JSON-LD URL або breadcrumb URL на `/categories` чи `/categories/*`;
- `lib/catalog/catalog-data.ts` після видалення page не імпортується public landing routes, але збережений як бізнес-довідник поза дозволеним destructive scope;
- `/admin/categories` та `/api/categories*` є внутрішніми/службовими surface і навмисно збережені.

## 5. Removed route files

Видалено:

- `app/(public)/categories/[slug]/page.tsx`.

Це прибирає всі сім dynamic category pages. Порожня директорія `[slug]` не створює App Router route і не потрапляє в Git.

## 6. Shared code preservation/removal

Видалено лише public-route references:

- `/categories/[slug]` із `PUBLIC_ROUTES`;
- `/categories` із `PUBLIC_ROUTE_PREFIXES`;
- імпорт і sitemap mapping `catalogCategories`;
- category expectations із SEO regression.

Збережено:

- `lib/catalog/catalog-data.ts`;
- Prisma schema/models і дані БД;
- admin/client CRM components;
- `/admin/categories`;
- `/api/categories`, `/api/categories/[slug]`, `/api/admin/categories`;
- category enums, classifications і request/business logic.

## 7. Navigation and internal link cleanup

Dependency audit не знайшов чинних public clickable links на `/categories` або `/categories/*`, тому header, mobile menu, homepage cards і footer не потребували контентної заміни. Route registry і auth public-prefix registry очищені від public category entries. Автоматичної заміни links на `/` не виконувалося.

## 8. Homepage impact

Головна сторінка збережена без переписування. Інформаційні блоки про напрями техніки залишилися некаталожним описом сервісу; category links у них відсутні. Browser QA підтвердив відсутність порожніх карток і horizontal overflow.

## 9. Structured data and breadcrumb cleanup

У чинних public source files не знайдено `BreadcrumbList`, `ItemList`, `item`, `url` або navigation entries, які посилаються на `/categories`. Видалений dynamic page не залишає category metadata/canonical чи breadcrumb surface. Загальні metadata, `Organization`/`WebSite`-related SEO contracts не змінювалися.

## 10. Sitemap changes

Sitemap тепер містить рівно 8 unique canonical URL у такому порядку:

1. `https://kairos-parts.com.ua/`
2. `https://kairos-parts.com.ua/about`
3. `https://kairos-parts.com.ua/how-it-works`
4. `https://kairos-parts.com.ua/contacts`
5. `https://kairos-parts.com.ua/privacy-policy`
6. `https://kairos-parts.com.ua/terms-of-use`
7. `https://kairos-parts.com.ua/logistics`
8. `https://kairos-parts.com.ua/used-equipment`

Жодного `/categories` URL у sitemap немає. Нові URL для компенсації кількості не додавалися.

## 11. Robots decision

`robots.ts` не змінювався. `/categories` не додано до `Disallow`, тому після майбутнього production deploy Google зможе повторно просканувати старі URL, побачити справжній `404` і поступово прибрати їх з індексу.

## 12. SEO keyword mapping impact

Майбутня SEO-мапа більше не повинна призначати запити на `/categories/*` або передбачати приховані category landing pages. Теми агрозапчастин, вантажних запчастин, шин, причепів, комерційного транспорту, універсальних деталей і витратних матеріалів слід розподіляти між `/`, `/how-it-works`, `/logistics` та окремо погодженими майбутніми content pages. На цьому етапі SEO copy і keyword lists не додавалися.

Історичні audit/release reports не переписувалися: вони залишаються evidence попереднього стану, а цей report фіксує новий baseline.

## 13. Regression tests

Додано npm script `test:seo-remove-public-categories` і `scripts/check-seo-remove-public-categories.ts`. Він перевіряє source absence, sitemap count/list, відсутність public UI/structured-data/breadcrumb URLs, очищення route registries, robots visibility і збереження ключових route files.

Результати:

- `npm run test:seo-remove-public-categories` — PASS (`removedRoutes=8`, `sitemapUrls=8`, `publicSources=28`).
- `npm run test:seo-crawl-foundation` — PASS (`sitemapUrls=8`).
- Legal 1A — PASS.
- Legal 1B — PASS (`sitemapUrls=8`).
- Legal 1C — PASS (`sitemapUrls=8`).
- Legal 1D — PASS (`sitemapUrls=8`).
- Legal 1E — PASS (`sitemapUrls=8`).
- Legal 1F — PASS (`sitemapUrls=8`).
- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; build manifest не містить public `/categories` route.

## 14. Route validation

Production-like `next start` validation виконано локально на built application. Для ізоляції від сторонньої Preview/production DB `DATABASE_URL` був переданий як порожній/недоступний для цього тимчасового процесу; БД не читалася і не змінювалася.

Category routes:

- `/categories` — `404`.
- `/categories/agricultural-parts` — `404`.
- `/categories/truck-parts` — `404`.
- `/categories/tires-tubes` — `404`.
- `/categories/trailers-semitrailers` — `404`.
- `/categories/commercial-transport` — `404`.
- `/categories/universal-parts` — `404`.
- `/categories/consumables` — `404`.

Preserved routes:

- `/`, `/about`, `/how-it-works`, `/contacts`, `/logistics`, `/used-equipment`, `/privacy-policy`, `/terms-of-use`, `/request`, `/logistics/request`, `/sitemap.xml`, `/robots.txt` — `200`.

Перший локальний probe із завантаженим `.env.local` дав `/used-equipment` `500` через зовнішню DB connectivity. Контрольний ізольований запуск без DB використовував передбачений `ErrorState` fallback і підтвердив `200`; це не пов’язано з category-route diff.

## 15. Responsive browser QA

Перевірено built application:

- viewport `1280×720`: `/`, `/how-it-works`, `/request`, `/logistics`, direct category URL;
- viewport `390×844`: ті самі ключові сторінки та direct category URL;
- category links — 0;
- direct category pages показують стандартний `404`;
- horizontal overflow — відсутній на всіх перевірених сторінках;
- mobile menu відкривається і містить `/about`, `/how-it-works`, `/logistics`, `/used-equipment`, `/contacts`, `/login`, `/request`, без category links;
- CTA destination `/request` працює (`200`);
- browser console warnings/errors — 0.

## 16. Files changed

- Deleted: `app/(public)/categories/[slug]/page.tsx`.
- Updated: `app/sitemap.ts`.
- Updated: `lib/routes.ts`.
- Updated: `lib/auth/permissions.ts`.
- Updated: `package.json`.
- Updated: `scripts/check-seo-crawl-foundation.ts`.
- Added: `scripts/check-seo-remove-public-categories.ts`.
- Updated Legal 1B–1F regression scripts to approved 8-URL sitemap baseline.
- Added: `docs/reports/stage-seo-3a-remove-public-category-routes.md`.

## 17. Production deployment checklist

1. Merge approved local commit from `develop` only through the normal release flow.
2. Re-run required CI/static gates.
3. Confirm production build manifest has no public category route.
4. Deploy application without DB migrations.
5. Verify all 8 old URLs return `404` on production.
6. Verify all 8 canonical sitemap URLs return expected success responses.
7. Verify production sitemap and robots responses.

Push, merge і deploy не входили в цей етап і не виконувалися.

## 18. Search Console follow-up

Після окремо погодженого production deploy:

1. повторно подати/прочитати `https://kairos-parts.com.ua/sitemap.xml` у Google Search Console;
2. проінспектувати кілька старих `/categories/*` URL і підтвердити `404`;
3. не блокувати старі URL у robots;
4. відстежити поступове вилучення category pages з індексу.

## 19. Final conclusion

Stage SEO 3A реалізовано в межах public SEO/landing routing. Вісім старих category URL мають `404`, sitemap містить рівно 8 canonical URL, public UI не містить category links, а внутрішні CRM/API/business category surfaces збережені. DB, Prisma migrations, production environment, push, merge і deploy не змінювалися.
