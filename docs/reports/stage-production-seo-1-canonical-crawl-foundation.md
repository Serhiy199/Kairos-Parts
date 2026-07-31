# Stage Production SEO 1 — Canonical and Crawl Foundation

Дата: 2026-07-31

Production origin: `https://kairos-parts.com.ua`

Режим: implementation, без deploy/push та без infrastructure/DB mutations.

## 1. Executive summary

У application code реалізовано canonical і crawl foundation:

- єдина production-safe source of truth для public origin;
- root `metadataBase`;
- deterministic `/robots.txt`;
- deterministic `/sitemap.xml` із 13 підтверджених URL;
- self-referencing canonical, Open Graph та базова Twitter metadata для indexable pages;
- унікальні metadata для шести static pages і семи category pages;
- layout-level `noindex,nofollow` для auth, staff auth, client та admin;
- page-level noindex для request/status і deferred Logistics routes;
- regression test для origin, sitemap, robots, canonical і noindex contracts.

Lint, typecheck, production build і regression test пройшли. Локальні Metadata Routes та representative
HTML checks пройшли. Локальний `/used-equipment` не зміг виконати pre-existing database query через
Windows TLS credential error; production Stage SEO 0 evidence для цього route — `200`. Application не
deployed, тому live production все ще має історичний SEO 0 state до наступного stage.

## 2. Git baseline

| Check | Result |
|---|---|
| Branch | `develop` |
| Baseline HEAD | `c11feaa63bc57e6dd60783635224fd4c8e079dc4` |
| Baseline status | лише untracked `docs/reports/stage-production-seo-0-indexing-audit.md` |
| Baseline ancestry | `c11feaa...` є ancestor поточного HEAD |
| Baseline `git diff --check` | PASS |
| Planned commit | `feat: add canonical crawl foundation` |

## 3. Scope and constraints

Виконано лише application code, tests і documentation. Не виконувались:

- Prisma schema/migration, manual database commands або database mutations;
- Nginx/DNS зміни;
- production environment changes;
- middleware `www` redirect;
- deploy/push;
- Google Search Console changes;
- navigation changes;
- додавання `/logistics` до sitemap.

## 4. Files changed

| Area | Files |
|---|---|
| Origin/SEO helpers | `lib/site-url.ts`, `lib/seo.ts` |
| Metadata Routes | `app/robots.ts`, `app/sitemap.ts` |
| Root metadata | `app/layout.tsx` |
| Indexable pages | `app/(public)/page.tsx`, `about/page.tsx`, `how-it-works/page.tsx`, `contacts/page.tsx`, `categories/page.tsx`, `categories/[slug]/page.tsx`, `used-equipment/page.tsx`, `used-equipment/[slug]/page.tsx` |
| Noindex coverage | `app/(auth)/layout.tsx`, `app/(staff-auth)/layout.tsx`, `app/client/layout.tsx`, `app/admin/layout.tsx`, `app/(public)/request/page.tsx`, `request/status/[token]/page.tsx`, `logistics/page.tsx`, `logistics/request/page.tsx` |
| Public/operational links | `lib/notifications/status-change.ts`, `lib/telegram/notifications.ts`, `lib/telegram/session.ts` |
| Regression | `scripts/check-seo-crawl-foundation.ts`, `package.json` |
| Documentation | SEO 0 follow-up і цей report |

## 5. Production origin implementation

`lib/site-url.ts` визначає:

```text
PUBLIC_SITE_ORIGIN=https://kairos-parts.com.ua
PUBLIC_SITE_URL=new URL(PUBLIC_SITE_ORIGIN)
```

`buildPublicUrl()`:

- завжди використовує apex HTTPS origin;
- не бере host із request/proxy headers;
- видаляє query/hash;
- видаляє trailing slash для non-root paths;
- зберігає `/` для root;
- не допускає origin switch.

`getAppBaseUrl()` у production завжди повертає public apex. У non-production дозволено validated
`APP_BASE_URL`/`NEXTAUTH_URL`; Vercel host відхиляється, fallback — `http://localhost:3000`. Це не
створює production crash за відсутньої env variable.

## 6. Vercel fallback removal

Видалено hardcoded `https://kairos-parts.vercel.app` із runtime URL builders:

- `lib/site-url.ts`;
- `lib/notifications/status-change.ts`;
- `lib/telegram/notifications.ts`;
- `lib/telegram/session.ts`.

SEO canonical, Open Graph URL, robots sitemap URL і sitemap entries використовують тільки
`buildPublicUrl()`. Operational invitation/Telegram links використовують centralized `buildAbsoluteUrl()`,
який у production також повертає apex. Generic `.vercel.app` згадується лише як заборонений hostname у
validation і regression assertion, не як fallback.

## 7. robots.txt implementation

`app/robots.ts` повертає Next.js `MetadataRoute.Robots`:

```text
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /client
Disallow: /api
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /invitation
Disallow: /auth
Disallow: /request
Disallow: /logistics/request

Sitemap: https://kairos-parts.com.ua/sitemap.xml
```

`Disallow: /` відсутній. `_next/static`, CSS, JS та public images не блокуються. Robots не замінює
authorization; existing auth guards не змінювалися.

## 8. sitemap.xml implementation

`app/sitemap.ts` повертає `MetadataRoute.Sitemap`. Список формується з шести source-controlled static
paths і семи slugs із `lib/catalog/catalog-data.ts`.

Не додаються:

- `lastModified`, бо немає правдивого content timestamp;
- `changeFrequency`/`priority`, бо немає обґрунтованої потреби;
- dynamic БВ detail URLs, бо Stage SEO 0 не підтвердив жодного published concrete item;
- `/logistics`, бо production повертає `404`;
- query URLs або protected/technical routes.

## 9. Sitemap URL inventory

| URL | Source page | Status | Canonical | Included | Reason |
|---|---|---|---|---|---|
| `https://kairos-parts.com.ua/` | `app/(public)/page.tsx` | SEO 0 live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/about` | `app/(public)/about/page.tsx` | live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/how-it-works` | `app/(public)/how-it-works/page.tsx` | live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/contacts` | `app/(public)/contacts/page.tsx` | live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/categories` | `app/(public)/categories/page.tsx` | live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/used-equipment` | `app/(public)/used-equipment/page.tsx` | live `200` | self | Yes | confirmed public |
| `https://kairos-parts.com.ua/categories/agricultural-parts` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/truck-parts` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/tires-tubes` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/trailers-semitrailers` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/commercial-transport` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/universal-parts` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/categories/consumables` | category dynamic page | live `200` | self | Yes | confirmed slug |
| `https://kairos-parts.com.ua/logistics` | `app/(public)/logistics/page.tsx` | production `404` | intentionally absent | No | deferred |

## 10. Canonical implementation

`createPublicMetadata()` формує absolute self canonical і Open Graph URL із `buildPublicUrl()`.

Coverage:

- root;
- about;
- how-it-works;
- contacts;
- categories;
- усі сім category slugs через `generateMetadata`;
- used-equipment listing;
- published used-equipment detail, якщо такий route повертає item у майбутньому.

Invalid used-equipment/category details отримують noindex. Protected/transactional/deferred pages не
отримують indexable canonical. Next.js локально серіалізує root origin у HTML як
`https://kairos-parts.com.ua`; це URL-equivalent до `https://kairos-parts.com.ua/`, тоді як helper і
sitemap зберігають explicit root slash.

## 11. Public metadata coverage

Шість static descriptors централізовані у `PUBLIC_PAGE_SEO`. Category metadata походить із видимих
`name`/`description` у `catalog-data`. Кожна з 13 sitemap pages має:

- unique Ukrainian title;
- content-faithful Ukrainian description;
- self canonical;
- Open Graph title/description/url/siteName/locale/type;
- Twitter summary card;
- `robots: index, follow`.

Marketing content у body не переписувався.

## 12. Private and technical noindex coverage

| Route group | Source layout/page | Protected | Noindex | Notes |
|---|---|---:|---:|---|
| `/login`, `/register`, `/forgot-password`, invitations | `app/(auth)/layout.tsx` | mixed public auth | Yes | layout-level |
| `/admin/login` | `app/(staff-auth)/layout.tsx` | auth entry | Yes | new group layout |
| `/client/*` | `app/client/layout.tsx` | Yes | Yes | auth guard unchanged |
| `/admin/*` | `app/admin/layout.tsx` | Yes | Yes | role guard unchanged |
| `/request` | `app/(public)/request/page.tsx` | session-aware form | Yes | page-level |
| `/request/status/[token]` | corresponding page | token URL | Yes | page-level |
| `/logistics/request` | corresponding page | transactional form | Yes | existing noindex retained, canonical removed |
| `/logistics` | corresponding page | public source, production unavailable | Yes | temporary deferred policy |
| `/api/*` | route handlers | varies | n/a HTML | robots prefix; never in sitemap |
| `/advantages` | disabled route | n/a | Next 404 noindex | feature gate unchanged |

## 13. Logistics route decision

Source route і navigation link існують. Production Stage SEO 0 evidence — `404`; local built route —
`200`. Це підтверджує deployment/source mismatch, а не відсутність source implementation.

У цьому stage:

- route не додано до sitemap;
- canonical і `og:url` видалено;
- встановлено temporary `noindex,nofollow`;
- navigation/deploy не змінювалися.

Повернення route до indexable policy дозволене лише після production deploy і direct `200` validation.

## 14. WWW duplication decision

Application завжди сигналізує apex canonical, але redirect не додано. `www -> apex` залишається Nginx
responsibility, оскільки Stage SEO 0 не мав live config evidence і middleware redirect може конфліктувати
з reverse proxy topology.

## 15. Regression tests

Додано `npm run test:seo-crawl-foundation`.

Test перевіряє:

1. exact production origin;
2. production operational URL не підмінюється Vercel/local env;
3. відсутність Vercel/localhost/IP/`www` у canonical origin;
4. 13 unique sitemap URLs з одним apex origin;
5. відсутність protected prefixes і `/logistics`;
6. metadata/canonical/OG/robots для всіх 13 sitemap inputs;
7. robots allow/exclusions і sitemap reference;
8. noindex source coverage для auth/client/admin/request/status/Logistics.

## 16. Validation results

| Check | Result | Evidence |
|---|---|---|
| `npm run test:seo-crawl-foundation` | PASS | `sitemapUrls=13`, `robotsExclusions=10`, exact origin |
| `npm run typecheck` | PASS | `tsc --noEmit`, exit 0 |
| `npm run lint` | PASS | `eslint .`, exit 0 |
| `npm run build` | PASS | Next 15.5.19; compiled, typechecked, 57/57 static pages generated |
| Build route inventory | PASS | `/robots.txt` and `/sitemap.xml` emitted as static Metadata Routes |
| Local `/robots.txt` | PASS | `200 text/plain`; Allow, 10 exclusions, sitemap; no global disallow |
| Local `/sitemap.xml` | PASS | `200 application/xml`; valid urlset shape; 13/13 unique; one apex origin |
| Sitemap exclusions | PASS | no `/logistics`, auth, admin, client, API or query URLs |
| Local public HTML | PASS | representative root/about/categories/category pages: `200`, unique metadata, apex canonical, index/follow |
| Local auth HTML | PASS | `/login` `200` with `noindex,nofollow` |
| Local protected boundary | PASS | `/client` remains `307` to `/login?next=%2Fclient` |
| Local deferred Logistics | PASS | source route `200`, `noindex,nofollow`, canonical/OG URL absent |
| Local `/used-equipment` runtime | LIMITED | `500` from Prisma Windows TLS credential error; metadata present; SEO 0 production route was `200` |
| `git diff --check` | PASS before commit | exit 0 |

## 17. Remaining risks

- Application changes are not deployed; live robots/sitemap/canonical remain unverified.
- Live Nginx config, process environment і deployment provenance залишаються `NOT VERIFIED`.
- `www` still returns `200` until infrastructure normalization.
- Local Windows Prisma TLS limitation prevented a successful local dynamic catalog response; no database
  credentials were printed and no DB mutation occurred. Existing route code attempted only its normal
  read query before the TLS connection failed.
- Published used-equipment detail metadata remains runtime-unverified because no concrete live item was
  discovered in SEO 0.
- Search Console coverage is unavailable.

## 18. Required production infrastructure follow-up

Next stage must:

1. read and back up exact live Nginx config;
2. verify apex and `www` server blocks;
3. deploy this exact commit;
4. add one-hop permanent `www` HTTPS to apex HTTPS normalization in Nginx;
5. validate all four HTTP/HTTPS origins;
6. verify live robots, sitemap, canonical, noindex and headers;
7. confirm `/logistics` production decision before changing its noindex/sitemap state.

## 19. Google Search Console readiness

Code foundation is ready for live validation, але Search Console onboarding ще не готовий. Sitemap не
слід submit-ити, доки exact commit не deployed, `www` normalization не пройшла і live robots/sitemap/
canonical checks не підтверджені.

## 20. Final conclusion

Stage SEO 1 acceptance виконано на code/build рівні:

- canonical origin centralized;
- Vercel fallback removed from public/runtime link builders;
- robots and sitemap implemented;
- 13 confirmed URLs included;
- public canonical/metadata і excluded noindex coverage implemented;
- Logistics deferred;
- auth behavior preserved;
- regression, lint, typecheck and build pass.

Nginx, DNS, DB, production server/environment і Search Console не змінювалися. Push/deploy не виконано.
Наступний етап: **Stage Production SEO 2 — Production Domain Normalization and Live Validation**.
