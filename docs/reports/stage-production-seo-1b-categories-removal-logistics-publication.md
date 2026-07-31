# Stage Production SEO 1B — Remove Categories Landing and Publish Logistics

Дата: 2026-07-31

Production origin: `https://kairos-parts.com.ua`

Режим: local implementation у `develop`, без push і deploy.

## 1. Executive summary

Exact landing route `/categories` видалено з application source та sitemap. Дочірній dynamic route `/categories/[slug]` і всі сім його canonical сторінок збережено. Два exact links із дочірньої category page на видалену landing прибрано: верхнє повернення тепер веде на головну, нижній дубльований link видалено.

Публічну `/logistics` переведено з temporary `noindex,nofollow` на централізовані indexable metadata: self-canonical, Open Graph URL, унікальні title/description та `index,follow`. `/logistics` замінила `/categories` у sitemap, тому inventory залишився рівно 13 URL. `/logistics/request` не змінювалася: route повертає `200`, має `noindex,nofollow`, не має canonical і відсутня в sitemap.

Static regression, lint, typecheck, production build і локальна HTTP validation пройшли. Production, database та infrastructure не змінювалися.

## 2. Git baseline

| Check | Result |
|---|---|
| Initial branch | `main`, clean, synchronized with `origin/main` |
| Work branch | `develop` |
| Baseline HEAD | `2e77d97e81616150652fcc82065ced76fcbc4829` |
| Baseline remote state | `develop...origin/develop`, clean |
| Baseline `git diff --check` | PASS |
| Required local commit message | `fix: replace categories landing with logistics in sitemap` |

## 3. Scope and constraints

Змінено лише public routes, SEO metadata/sitemap, route inventory, regression script і цей report. Заборони дотримано: без DB/schema/migrations, production environment, Nginx, DNS, Search Console, dependency upgrade, access-control weakening, push або deploy.

## 4. Previous SEO state

Stage SEO 1 створив production-safe apex origin, robots, sitemap із 13 URL, canonical metadata та noindex policy. У тому inventory `/categories` була indexable sitemap landing, а `/logistics` навмисно залишалася temporary noindex і поза sitemap до окремого рішення про публікацію. Stage 1B змінює саме цю пару URL без розширення загального sitemap inventory.

## 5. `/categories` route analysis

Exact route формував лише `app/(public)/categories/page.tsx`. Окремого categories layout немає. Сім дочірніх URL формує незалежний `app/(public)/categories/[slug]/page.tsx` із `generateStaticParams()` на основі `catalogCategories`; він не імпортував landing component.

Єдиними exact UI links на `/categories` були два елементи у child page: «Назад до всіх категорій» і «До всіх категорій». BreadcrumbList або інший JSON-LD із `/categories` не знайдено. Prefix `/categories` у `PUBLIC_ROUTE_PREFIXES` збережено, бо він визначає public access для дочірніх routes і не є internal link.

## 6. `/categories` removal

Файл `app/(public)/categories/page.tsx` видалено. Redirect і replacement landing не створювалися. Новий production build більше не містить exact `/categories` page; локальний production server повернув `404` і стандартний `noindex` для цієї URL.

Exact route також прибрано з descriptive `PUBLIC_ROUTES` у `lib/routes.ts`. API routes `/api/categories*` та protected `/admin/categories` не змінювалися.

## 7. Internal link and breadcrumb cleanup

| Source | Previous target | New behavior |
|---|---|---|
| `app/(public)/categories/[slug]/page.tsx`, верхнє повернення | `/categories` | `/`, label `← На головну` |
| `app/(public)/categories/[slug]/page.tsx`, нижня secondary CTA | `/categories` | Link видалено; primary request CTA збережено |

Пошук у `app/(public)` і `components` не виявив інших exact `href`, structured-data URL або `buildPublicUrl('/categories')` references.

## 8. Child category route preservation

Усі routes збережені, присутні у build manifest, мають self-canonical, `index,follow` та локально повернули `200`:

- `/categories/agricultural-parts`;
- `/categories/truck-parts`;
- `/categories/tires-tubes`;
- `/categories/trailers-semitrailers`;
- `/categories/commercial-transport`;
- `/categories/universal-parts`;
- `/categories/consumables`.

## 9. `/logistics` metadata changes

Metadata перенесено до спільного `PUBLIC_PAGE_SEO.logistics` і застосовано через `createPublicMetadata()`. Це забезпечує однакову production-safe canonical/OG/robots policy з іншими indexable public pages.

Title:

```text
Kairos Logistics — доставка товарів для агропідприємств | Kairos Parts
```

Description:

```text
Забір товарів у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або в господарства Кагарлицької громади.
```

Open Graph title/description відповідають цим значенням; `og:url` — production canonical.

## 10. `/logistics` canonical and indexing state

Локальна production validation:

```text
status: 200
robots: index, follow
canonical: https://kairos-parts.com.ua/logistics
og:url: https://kairos-parts.com.ua/logistics
```

Canonical має HTTPS apex origin, без `www`, Vercel, localhost, query або trailing alias.

## 11. Sitemap changes

`/categories` замінено на `/logistics` у тій самій позиції static inventory. Новий sitemap має рівно 13 unique apex HTTPS URL.

| URL | Previous state | New state | Included | Indexable |
|---|---|---|---:|---:|
| `https://kairos-parts.com.ua/` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/about` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/how-it-works` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/contacts` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories` | included | removed / expected 404 | No | No |
| `https://kairos-parts.com.ua/logistics` | excluded / noindex | added / indexable | Yes | Yes |
| `https://kairos-parts.com.ua/used-equipment` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/agricultural-parts` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/truck-parts` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/tires-tubes` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/trailers-semitrailers` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/commercial-transport` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/universal-parts` | included | unchanged | Yes | Yes |
| `https://kairos-parts.com.ua/categories/consumables` | included | unchanged | Yes | Yes |

Повний новий порядок:

```text
https://kairos-parts.com.ua/
https://kairos-parts.com.ua/about
https://kairos-parts.com.ua/how-it-works
https://kairos-parts.com.ua/contacts
https://kairos-parts.com.ua/logistics
https://kairos-parts.com.ua/used-equipment
https://kairos-parts.com.ua/categories/agricultural-parts
https://kairos-parts.com.ua/categories/truck-parts
https://kairos-parts.com.ua/categories/tires-tubes
https://kairos-parts.com.ua/categories/trailers-semitrailers
https://kairos-parts.com.ua/categories/commercial-transport
https://kairos-parts.com.ua/categories/universal-parts
https://kairos-parts.com.ua/categories/consumables
```

## 12. Robots validation

`app/robots.ts` не змінювався. `Allow: /` збережено; `/logistics/request` залишається окремим disallow prefix. Це правило не блокує exact `/logistics`. `/categories` не додано до Disallow, тому crawler після deploy зможе отримати її `404`, а дочірні category routes залишаться crawlable.

## 13. Regression tests

`test:seo-crawl-foundation` оновлено для перевірки:

- exact absence `/categories` і presence `/logistics` у sitemap;
- 13 URL у точному порядку та без duplicates;
- усіх семи child category paths;
- відсутнього landing source та наявного child source;
- Logistics index/follow і canonical;
- Logistics request noindex/nofollow та sitemap exclusion;
- відсутності exact `/categories` UI/structured-data links;
- єдиного apex HTTPS origin без `www`, Vercel, localhost, query/hash;
- незмінної robots policy.

Результат: `seoCrawlFoundation=PASS sitemapUrls=13 robotsExclusions=10 canonicalOrigin=https://kairos-parts.com.ua`.

## 14. Build and validation results

| Check | Result |
|---|---|
| `npm run test:seo-crawl-foundation` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS after production build refreshed stale `.next/types` for the deleted route |
| `npm run build` | PASS; 56/56 static pages; exact `/categories` absent; child route, Logistics, request, sitemap and robots present |
| `git diff --check` | PASS |

| Route | Previous behavior | Expected behavior | Validation |
|---|---|---|---|
| `/categories` | `200`, indexable | `404` | local `404`, Next noindex |
| `/logistics` | `200`, noindex in source | `200`, indexable | local `200`, index/follow, self-canonical |
| `/logistics/request` | `200`, noindex | unchanged | local `200`, noindex/nofollow, no canonical |
| seven `/categories/{slug}` routes | `200`, indexable | unchanged | all seven local `200`, build-generated |
| `/sitemap.xml` | 13 URL with `/categories` | 13 URL with `/logistics` | local `200`, 13 `<loc>` |
| `/robots.txt` | allow public, exclude request | unchanged | local `200` |

## 15. Files changed

- deleted `app/(public)/categories/page.tsx`;
- updated `app/(public)/categories/[slug]/page.tsx`;
- updated `app/(public)/logistics/page.tsx`;
- updated `app/sitemap.ts`;
- updated `lib/seo.ts`;
- updated `lib/routes.ts`;
- updated `scripts/check-seo-crawl-foundation.ts`;
- added `docs/reports/stage-production-seo-1b-categories-removal-logistics-publication.md`.

## 16. Production deployment checklist

1. Deploy the committed `develop` change to the VPS through the approved production release flow.
2. Confirm the deployed Git SHA before application restart.
3. Run `curl -sSI https://kairos-parts.com.ua/categories` and require final `404`.
4. Run `curl -sSI https://kairos-parts.com.ua/logistics` and require final `200`.
5. Inspect production Logistics HTML and require `index, follow` plus canonical `https://kairos-parts.com.ua/logistics`.
6. Confirm production title, description, `og:title`, `og:description` and `og:url`.
7. Fetch `https://kairos-parts.com.ua/logistics/request`; require expected route behavior and `noindex,nofollow`.
8. Fetch all seven category URLs; require `200`, index/follow and self-canonical.
9. Fetch `https://kairos-parts.com.ua/sitemap.xml`; require exactly the 13 URLs listed in section 11.
10. Confirm sitemap contains `/logistics`, excludes exact `/categories` and excludes `/logistics/request`.
11. Fetch `https://kairos-parts.com.ua/robots.txt`; confirm `/logistics` and child categories are crawlable and `/logistics/request` remains excluded.
12. Check PM2/Nginx logs for application errors without modifying their configuration.

## 17. Search Console follow-up

Search Console не змінювався. Після успішного production checklist Google автоматично перечитає ту саму canonical sitemap URL. За потреби повторно відкрити/подати `https://kairos-parts.com.ua/sitemap.xml`, а через URL Inspection запросити індексацію лише `https://kairos-parts.com.ua/logistics`. Не подавати Vercel URL і не подавати видалену `/categories`.

## 18. Remaining risks

- Код ще не deployed, тому production behavior цього commit не перевірено.
- До deploy production `/categories` може продовжувати повертати старий `200`, а `/logistics` — стару metadata policy.
- Google може деякий час зберігати `/categories` в index після першого production `404`; robots не повинні блокувати повторний crawl.
- Dynamic `/used-equipment` не входить до зміненого scope і не перевірявся через DB у цьому stage.

## 19. Final conclusion

Stage SEO 1B виконано локально: `/categories` видалена як page і повертає `404`; усі сім дочірніх category routes збережені; `/logistics` стала indexable з production self-canonical; sitemap залишився на 13 URL; `/logistics/request` зберегла noindex/exclusion. Усі code/build/runtime gates пройшли. Push, deploy, DB, migrations, Nginx, DNS і Search Console changes не виконувалися.
