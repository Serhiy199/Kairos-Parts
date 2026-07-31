# Stage Production SEO 0 — Indexing and Discoverability Audit

Дата аудиту: 2026-07-31

Production: `https://kairos-parts.com.ua`

Режим: audit-only

Статус доказів: код і зовнішні HTTP/DNS/TLS перевірки виконано; live Nginx configuration та live process environment — `NOT VERIFIED`.

## 1. Executive summary

Сайт технічно доступний Googlebot-подібному клієнту: apex HTTPS повертає `200`, основний контент і H1 присутні у server-rendered HTML, `lang="uk"`, глобального `noindex` або production `X-Robots-Tag` на перевірених публічних сторінках немає. Проте crawl/indexing foundation не готовий.

Ключові результати:

- `https://kairos-parts.com.ua/robots.txt` повертає `404 text/html`, реалізації robots у репозиторії немає.
- `https://kairos-parts.com.ua/sitemap.xml` повертає `404 text/html`, реалізації sitemap у репозиторії немає.
- `https://kairos-parts.com.ua` і `https://www.kairos-parts.com.ua` обидва повертають `200` без редиректу між hosts; canonical tags на перевірених production-сторінках відсутні.
- Root metadata не має `metadataBase`, canonical, Open Graph URL, Twitter, robots, icons або manifest (`app/layout.tsx:25-28`).
- Shared URL helper використовує `APP_BASE_URL`, потім `NEXTAUTH_URL`, потім fallback `https://kairos-parts.vercel.app` (`lib/site-url.ts:1-8`). У локальному environment `APP_BASE_URL` також вказує на Vercel origin (`.env.local:47`). Отже, metadata для Logistics і detail БВ техніки може формувати non-production canonical.
- `/login`, `/register`, `/forgot-password`, `/admin/login`, `/request` не мають явного `noindex`; valid `/request/status/[token]` також не має route-level metadata. Це створює ризик індексації auth/transactional/token URLs.
- Поточний source містить `/logistics`, але production повертає `404`; `/advantages` також повертає `404`, проте це відповідає source feature gate `ADVANTAGES_PAGE_ENABLED = false` (`app/(public)/advantages/page.tsx:21,104-107`).
- 13 конкретних production URLs зараз повертають `200` і є кандидатами для першого sitemap: 6 статичних сторінок (`/`, `/about`, `/how-it-works`, `/contacts`, `/categories`, `/used-equipment`) та 7 category URLs.
- У репозиторії знайдено 118 route patterns: 65 page routes і 53 API routes. Для поточного sitemap виключаються 110 patterns: 46 protected page patterns, 53 API patterns і 11 public/auth/technical/unavailable patterns. Залишаються 8 indexable page patterns; один з них, `/used-equipment/[slug]`, наразі не має підтверджених опублікованих concrete URLs.
- Зовнішній пошуковий probe `site:kairos-parts.com.ua` і `site:www.kairos-parts.com.ua` не повернув результатів. Це індикатор, але не заміна Google Search Console і не остаточний доказ відсутності індексації.

Висновок: **NOT READY** для керованого production indexing. Перший наступний етап має одночасно встановити єдиний canonical origin, `metadataBase`, robots/sitemap і явний noindex для excluded surfaces, після чого потрібна окрема production validation.

## 2. Git and environment baseline

| Check | Result |
|---|---|
| Branch | `develop` |
| HEAD | `c11feaa63bc57e6dd60783635224fd4c8e079dc4` (`c11feaa fix: package Tesseract worker for Vercel OCR`) |
| Working tree before audit | clean; staged, unstaged і untracked files відсутні |
| Last 5 commits | `c11feaa`, `eb5adda`, `4bfd9bc`, `aac9867`, `6cb51fa` |
| Remote | `origin git@github.com:Serhiy199/Kairos-Parts.git` |
| Protected branch concern | робота не виконується у `main`/`master`; поточна гілка `develop` |
| Next.js | `^15.1.3` у `package.json` |
| Router | App Router (`app/**/page.tsx`, `app/**/layout.tsx`, `app/api/**/route.ts`) |

Git commands виконувалися з per-command `safe.directory`; global Git configuration не змінювалася.

## 3. Application and routing architecture

- Root layout: `app/layout.tsx`.
- Route groups:
  - `app/(public)` — marketing, catalog, request/status і Logistics surfaces;
  - `app/(auth)` — client auth/invitation surfaces;
  - `app/(staff-auth)` — staff login;
  - `app/client` — CLIENT protected area;
  - `app/admin` — MANAGER/ADMIN protected area;
  - `app/api` — 53 route handlers.
- Nested layouts: `app/(public)/layout.tsx`, `app/(auth)/layout.tsx`, `app/client/layout.tsx`, `app/admin/layout.tsx`, `app/admin/directories/layout.tsx`.
- Pages Router не знайдено.
- `middleware.ts:70-72` має matcher лише для `/login`, `/client/:path*`, `/admin/:path*`.
- `next.config.ts` не задає redirects, rewrites або headers; SEO-related `X-Robots-Tag` там відсутній.
- `app/robots.*`, `app/sitemap.*`, `app/manifest.*`, `public/robots.txt`, `public/sitemap.xml` відсутні.
- Знайдено 65 page patterns і 53 API patterns, разом 118.

Middleware не запускається для marketing routes та `/api/*`. Це означає, що `/about`, `/categories`, `/used-equipment` не залежать від session middleware. Protected page boundaries реалізовані matcher-ом і server layout guards.

## 4. Public route inventory

Позначення status: `LIVE` — зовнішній GET без cookies 2026-07-31; `CODE` — висновок зі source. `Canonical` показує фактичний production HTML, якщо route доступний.

| Route | Classification | Source | Status | Indexable | Sitemap | Canonical | Notes |
|---|---|---|---|---|---|---|---|
| `/` | PUBLIC_INDEXABLE | `app/(public)/page.tsx` | LIVE `200` | Yes | Yes | absent | SSR H1; generic title/English description |
| `/about` | PUBLIC_INDEXABLE | `app/(public)/about/page.tsx` | LIVE `200` | Yes | Yes | absent | SSR H1; generic inherited metadata |
| `/advantages` | TECHNICAL/DISABLED | `app/(public)/advantages/page.tsx` | LIVE `404` | No | No | absent | `ADVANTAGES_PAGE_ENABLED=false`, `notFound()` |
| `/how-it-works` | PUBLIC_INDEXABLE | `app/(public)/how-it-works/page.tsx` | LIVE `200` | Yes | Yes | absent | SSR H1; generic inherited metadata |
| `/contacts` | PUBLIC_INDEXABLE | `app/(public)/contacts/page.tsx` | LIVE `200` | Yes | Yes | absent | unique title/description |
| `/logistics` | PUBLIC_INDEXABLE, DEPLOY BLOCKED | `app/(public)/logistics/page.tsx` | LIVE `404`; CODE route exists | Not until `200` | Deferred | unavailable live | source canonical uses shared URL helper |
| `/logistics/request` | PUBLIC_NOINDEX | `app/(public)/logistics/request/page.tsx` | LIVE `404`; CODE route exists | No | No | unavailable live | source already sets `robots.index=false` |
| `/categories` | PUBLIC_INDEXABLE | `app/(public)/categories/page.tsx` | LIVE `200` | Yes | Yes | absent | no unique metadata; orphan from global navigation |
| `/categories/[slug]` (`/categories/agricultural-parts`) | PUBLIC_INDEXABLE | `app/(public)/categories/[slug]/page.tsx` | LIVE `200` | Yes | Yes | absent | H1: Запчастини до сільгосптехніки |
| `/categories/truck-parts` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/categories/tires-tubes` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/categories/trailers-semitrailers` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/categories/commercial-transport` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/categories/universal-parts` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/categories/consumables` | PUBLIC_INDEXABLE | same dynamic source | LIVE `200` | Yes | Yes | absent | generic inherited metadata |
| `/used-equipment` | PUBLIC_INDEXABLE | `app/(public)/used-equipment/page.tsx` | LIVE `200` | Yes | Yes | absent | unique title/description; empty catalog at audit time |
| `/used-equipment/[slug]` | PUBLIC_INDEXABLE CONDITIONAL | `app/(public)/used-equipment/[slug]/page.tsx` | no concrete live link found | Published `200` only | Conditional | source-generated | include only published canonical items |
| `/request` | PUBLIC_NOINDEX | `app/(public)/request/page.tsx` | LIVE `200` | No | No | absent | unauthenticated page is login/register gateway; no explicit noindex |
| `/request/status/[token]` | PUBLIC_NOINDEX | `app/(public)/request/status/[token]/page.tsx` | invalid token LIVE `404`; valid token not requested | No | No | absent | token-bearing status URL; valid response metadata NOT VERIFIED |

`/advantages` згаданий у ТЗ, але не є існуючою live page. `/logistics` існує у поточному source, але не у перевіреному production deployment. Route `/categories` не входить у global navigation (`components/layout/public-layout.tsx:12-18`) і має inbound links лише всередині власного subtree.

## 5. Protected and excluded route inventory

### Auth, transactional and technical pages

| Route | Classification | Source | Expected unauthenticated status | Indexable | Sitemap | Explicit noindex |
|---|---|---|---|---|---|---|
| `/login` | PUBLIC_NOINDEX | `app/(auth)/login/page.tsx` | LIVE `200` | No | No | No |
| `/register` | PUBLIC_NOINDEX | `app/(auth)/register/page.tsx` | LIVE `200` | No | No | No |
| `/forgot-password` | PUBLIC_NOINDEX | `app/(auth)/forgot-password/page.tsx` | LIVE `200` | No | No | No |
| `/invitation/manager/[token]` | PUBLIC_NOINDEX | `app/(auth)/invitation/manager/[token]/page.tsx` | CODE `200/semantic state` | No | No | Yes |
| `/invitation/manager/complete` | PUBLIC_NOINDEX | `app/(auth)/invitation/manager/complete/page.tsx` | CODE `200` | No | No | Yes |
| `/admin/login` | PUBLIC_NOINDEX | `app/(staff-auth)/admin/login/page.tsx` | LIVE `200` | No | No | No |
| `/request` | PUBLIC_NOINDEX | `app/(public)/request/page.tsx` | LIVE `200` | No | No | No |
| `/request/status/[token]` | PUBLIC_NOINDEX | `app/(public)/request/status/[token]/page.tsx` | CODE `200/404` | No | No | No |
| `/logistics/request` | PUBLIC_NOINDEX | `app/(public)/logistics/request/page.tsx` | LIVE `404` in current deployment | No | No | Yes in source |
| `/advantages` | TECHNICAL/DISABLED | `app/(public)/advantages/page.tsx` | LIVE/CODE `404` | No | No | Next 404 noindex |
| `/logistics` | TEMPORARILY_EXCLUDED | `app/(public)/logistics/page.tsx` | LIVE `404` | No until live `200` | Deferred | Next 404 noindex live |

### CLIENT protected pages

Усі patterns нижче — `AUTH_PROTECTED`, не indexable і не входять у sitemap. Без cookies `/client` повернув `307` на `/login?next=%2Fclient`.

| Route | Source | Expected status |
|---|---|---|
| `/client` | `app/client/page.tsx` | `307` unauthenticated / `200` CLIENT |
| `/client/change-requests` | `app/client/change-requests/page.tsx` | same boundary |
| `/client/documents` | `app/client/documents/page.tsx` | same boundary |
| `/client/invoices/[invoiceId]/print` | `app/client/invoices/[invoiceId]/print/page.tsx` | same boundary |
| `/client/logistics` | `app/client/logistics/page.tsx` | same boundary |
| `/client/logistics/[id]` | `app/client/logistics/[id]/page.tsx` | same boundary |
| `/client/profile` | `app/client/profile/page.tsx` | same boundary |
| `/client/requests` | `app/client/requests/page.tsx` | same boundary |
| `/client/requests/[id]` | `app/client/requests/[id]/page.tsx` | same boundary |
| `/client/vehicles` | `app/client/vehicles/page.tsx` | same boundary |
| `/client/vehicles/new` | `app/client/vehicles/new/page.tsx` | same boundary |
| `/client/vehicles/[id]` | `app/client/vehicles/[id]/page.tsx` | same boundary |
| `/client/vehicles/[id]/photos` | `app/client/vehicles/[id]/photos/page.tsx` | same boundary |

### ADMIN/MANAGER protected pages

Усі patterns нижче — `ADMIN_PROTECTED`, не indexable і не входять у sitemap. Без cookies `/admin` повернув `307` на `/admin/login?next=%2Fadmin`.

| Route | Source |
|---|---|
| `/admin` | `app/admin/page.tsx` |
| `/admin/audit-log` | `app/admin/audit-log/page.tsx` |
| `/admin/audit-log/[id]` | `app/admin/audit-log/[id]/page.tsx` |
| `/admin/billing-settings` | `app/admin/billing-settings/page.tsx` |
| `/admin/categories` | `app/admin/categories/page.tsx` |
| `/admin/change-requests` | `app/admin/change-requests/page.tsx` |
| `/admin/clients` | `app/admin/clients/page.tsx` |
| `/admin/clients/[id]` | `app/admin/clients/[id]/page.tsx` |
| `/admin/clients/[id]/vehicles/new` | `app/admin/clients/[id]/vehicles/new/page.tsx` |
| `/admin/companies` | `app/admin/companies/page.tsx` |
| `/admin/companies/[id]` | `app/admin/companies/[id]/page.tsx` |
| `/admin/companies/[id]/vehicles/new` | `app/admin/companies/[id]/vehicles/new/page.tsx` |
| `/admin/contact-messages` | `app/admin/contact-messages/page.tsx` |
| `/admin/contact-messages/[id]` | `app/admin/contact-messages/[id]/page.tsx` |
| `/admin/directories` | `app/admin/directories/page.tsx` |
| `/admin/directories/equipment-types` | `app/admin/directories/equipment-types/page.tsx` |
| `/admin/directories/manufacturers` | `app/admin/directories/manufacturers/page.tsx` |
| `/admin/invoices/[invoiceId]/print` | `app/admin/invoices/[invoiceId]/print/page.tsx` |
| `/admin/logistics` | `app/admin/logistics/page.tsx` |
| `/admin/logistics/[id]` | `app/admin/logistics/[id]/page.tsx` |
| `/admin/logistics/tariffs` | `app/admin/logistics/tariffs/page.tsx` |
| `/admin/manufacturers` | `app/admin/manufacturers/page.tsx` |
| `/admin/requests` | `app/admin/requests/page.tsx` |
| `/admin/requests/[id]` | `app/admin/requests/[id]/page.tsx` |
| `/admin/settings` | `app/admin/settings/page.tsx` |
| `/admin/team` | `app/admin/team/page.tsx` |
| `/admin/team/[userId]/activity` | `app/admin/team/[userId]/activity/page.tsx` |
| `/admin/used-equipment/inquiries` | `app/admin/used-equipment/inquiries/page.tsx` |
| `/admin/used-equipment/inquiries/[id]` | `app/admin/used-equipment/inquiries/[id]/page.tsx` |
| `/admin/used-equipment/items` | `app/admin/used-equipment/items/page.tsx` |
| `/admin/used-equipment/items/new` | `app/admin/used-equipment/items/new/page.tsx` |
| `/admin/used-equipment/items/[id]/edit` | `app/admin/used-equipment/items/[id]/edit/page.tsx` |
| `/admin/vehicles/[vehicleId]/edit` | `app/admin/vehicles/[vehicleId]/edit/page.tsx` |

### API inventory

Усі 53 patterns — classification `API`, `Indexable=No`, `Sitemap=No`. Middleware matcher їх не охоплює; access control реалізується route-level і не є robots-механізмом.

| Route patterns | Source area |
|---|---|
| `/api/admin/categories`; `/api/admin/subcategories`; `/api/admin/manufacturers`; `/api/admin/clients` | `app/api/admin/**/route.ts` |
| `/api/admin/change-requests`; `/api/admin/change-requests/[id]`; `/api/admin/change-requests/[id]/approve`; `/api/admin/change-requests/[id]/reject` | `app/api/admin/change-requests/**/route.ts` |
| `/api/admin/commercial-offers/[offerId]`; `/api/admin/commercial-offers/[offerId]/send`; `/api/admin/commercial-offers/[offerId]/items/[itemId]` | `app/api/admin/commercial-offers/**/route.ts` |
| `/api/admin/documents/[documentId]/download`; `/api/admin/files/[fileId]`; `/api/admin/vehicle-documents/[documentId]/download` | `app/api/admin/**/route.ts` |
| `/api/admin/request-documents/[documentId]`; `/api/admin/request-documents/[documentId]/file`; `/api/admin/request-items/[itemId]` | `app/api/admin/**/route.ts` |
| `/api/admin/requests`; `/api/admin/requests/[id]`; `/api/admin/requests/[id]/assign`; `/api/admin/requests/[id]/comments`; `/api/admin/requests/[id]/commercial-offers`; `/api/admin/requests/[id]/documents`; `/api/admin/requests/[id]/items`; `/api/admin/requests/[id]/status` | `app/api/admin/requests/**/route.ts` |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` |
| `/api/categories`; `/api/categories/[slug]` | `app/api/categories/**/route.ts` |
| `/api/client/change-requests`; `/api/client/change-requests/[id]/cancel` | `app/api/client/change-requests/**/route.ts` |
| `/api/client/commercial-offers/[offerId]`; `/api/client/commercial-offers/[offerId]/approve`; `/api/client/commercial-offers/[offerId]/reject` | `app/api/client/commercial-offers/**/route.ts` |
| `/api/client/documents`; `/api/client/documents/[documentId]/download`; `/api/client/files/[fileId]`; `/api/client/request-documents/[documentId]/file` | `app/api/client/**/route.ts` |
| `/api/client/requests`; `/api/client/vehicles`; `/api/client/vehicles/[id]`; `/api/client/vehicle-documents/[documentId]/download` | `app/api/client/**/route.ts` |
| `/api/documents`; `/api/notifications`; `/api/ocr`; `/api/vehicles` | corresponding `app/api/**/route.ts` |
| `/api/logistics/addresses/autocomplete`; `/api/logistics/addresses/resolve`; `/api/logistics/quote`; `/api/logistics/requests` | `app/api/logistics/**/route.ts` |
| `/api/requests`; `/api/requests/[id]`; `/api/requests/status/[token]` | `app/api/requests/**/route.ts` |
| `/api/telegram/webhook` | `app/api/telegram/webhook/route.ts` |

As a representative live probe, `/api/categories` returned `501 application/json`; API URLs must remain outside sitemap regardless of whether they are public, protected, implemented or stubbed.

## 6. Current robots.txt state

Repository:

- `app/robots.ts` / `.tsx`: absent.
- `public/robots.txt`: absent.
- duplicate/conflicting implementation: none, because no implementation exists.

Production GET/HEAD:

| URL | Status | Content-Type | Redirect | User-agent/Allow/Disallow/Sitemap |
|---|---:|---|---|---|
| `https://kairos-parts.com.ua/robots.txt` | `404` | `text/html; charset=utf-8` | none | none; Next 404 HTML |

`User-agent: * / Disallow: /` не знайдено. Це не позитивна robots policy: crawler отримує відсутній файл і не отримує sitemap discovery або exclusions.

## 7. Current sitemap.xml state

Repository:

- `app/sitemap.ts` / `.tsx`: absent.
- `public/sitemap.xml`: absent.
- sitemap package/config: не знайдено.

Production:

| URL | Status | Content-Type | Redirect | XML URLs |
|---|---:|---|---|---:|
| `https://kairos-parts.com.ua/sitemap.xml` | `404` | `text/html; charset=utf-8` | none | 0 |

Відповідь не є XML, sitemap index відсутній. Тому перевірка origins, private routes, redirects, `lastModified` і XML validity завершується результатом **not applicable: sitemap does not exist**.

## 8. Metadata and canonical audit

Root metadata (`app/layout.tsx:25-28`) містить лише:

- `title: Kairos Parts`;
- generic English description.

Відсутні:

- `metadataBase`;
- `alternates.canonical`;
- shared Open Graph/Twitter metadata;
- Open Graph URL/images;
- robots policy;
- icons/manifest metadata.

Окрема metadata знайдена лише для `/advantages`, `/contacts`, `/logistics`, `/logistics/request`, `/used-equipment`, `/used-equipment/[slug]` і двох invitation routes. `/`, `/about`, `/how-it-works`, `/categories`, category detail, `/request`, login/register/reset і більшість інших pages успадковують generic metadata.

У production HTML:

- canonical відсутній на всіх 13 перевірених `200` indexable URLs;
- `og:url` відсутній на перевірених live pages;
- `/contacts` і `/used-equipment` мають унікальні title/description;
- `/`, `/about`, `/how-it-works`, `/categories` і всі 7 category pages мають title `Kairos Parts` та generic English description.

Origin search у runtime-relevant code:

- `lib/site-url.ts:2` — fallback `https://kairos-parts.vercel.app`;
- `lib/telegram/session.ts`, `lib/telegram/notifications.ts` — такий самий Vercel fallback для links;
- `lib/notifications/status-change.ts` — `APP_BASE_URL || NEXTAUTH_URL`;
- `app/(auth)/actions.ts:58` — `http://localhost` використовується лише як parser base для relative auth URL, не metadata;
- `ecosystem.config.cjs:7` — `127.0.0.1` є loopback bind behind Nginx, не public metadata.

`localhost`, `127.0.0.1`, Vercel URL та historical deployment URLs у docs/scripts не трактувалися як production metadata. Build artifacts, `.git`, `.next`, `node_modules`, logs/backups виключалися з висновків.

## 9. Noindex and X-Robots-Tag audit

| Layer | Result |
|---|---|
| Root metadata | global `noindex` absent |
| Public page metadata | explicit `noindex` only on `/logistics/request`; Logistics landing explicitly indexable in source |
| Auth metadata | manager invitation routes have `index:false, follow:false`; login/register/reset/staff login do not |
| Client/admin layouts | no robots metadata |
| Middleware | no `X-Robots-Tag` manipulation |
| `next.config.ts` headers | no headers section / no `X-Robots-Tag` |
| Production public `200` headers | `X-Robots-Tag` absent |
| Production `/client`, `/admin` redirect headers | `X-Robots-Tag` absent |
| Production 404 HTML | Next injects `<meta name="robots" content="noindex">` |
| Live Nginx config | `NOT VERIFIED`; HTTP behavior shows no `X-Robots-Tag` on checked responses |

Global noindex **не знайдено**. Проблема протилежна: excluded `200` pages не мають явного noindex.

## 10. Middleware and authentication audit

Evidence:

- matcher: `middleware.ts:70-72`;
- public branch and redirects: `middleware.ts:35-67`;
- role prefixes: `lib/auth/permissions.ts:3-21,31-48`;
- client layout calls `requireClientSession()` before rendering;
- admin layout calls `requireCrmSession()` before rendering.

Live unauthenticated behavior:

| Route | First response | Target | Final |
|---|---:|---|---:|
| `/client` | `307` | `/login?next=%2Fclient` | `200` login |
| `/admin` | `307` | `/admin/login?next=%2Fadmin` | `200` staff login |

Public pages `/`, `/about`, `/how-it-works`, `/contacts`, `/categories`, `/used-equipment` повернули прямий `200`, без redirect на login. User-agent-specific logic у middleware не знайдено. `/api/*` не входить у matcher і не може потрапити у sitemap, якого наразі немає.

Важлива окрема знахідка: `PUBLIC_ROUTE_PREFIXES` не містить `/advantages` або `/used-equipment` (`lib/auth/permissions.ts:3-15`), але поточний matcher не запускає middleware на цих шляхах. Це не блокує їх зараз, однак створює fragile contract при майбутньому розширенні matcher.

## 11. Domain and redirect normalization

DNS:

| Host | A record |
|---|---|
| `kairos-parts.com.ua` | `187.127.85.46` |
| `www.kairos-parts.com.ua` | `187.127.85.46` |

Redirect behavior:

| Input | Hops | Final | Result |
|---|---:|---|---|
| `http://kairos-parts.com.ua/` | 1 redirect | `https://kairos-parts.com.ua/` | `301 -> 200` |
| `https://kairos-parts.com.ua/` | 0 | same | `200` |
| `http://www.kairos-parts.com.ua/` | 1 redirect | `https://www.kairos-parts.com.ua/` | `301 -> 200` |
| `https://www.kairos-parts.com.ua/` | 0 | same | `200` |

TLS для обох hosts:

- authorized: true;
- protocol: TLS 1.3;
- certificate CN: `kairos-parts.com.ua`;
- SAN: `kairos-parts.com.ua`, `www.kairos-parts.com.ua`;
- issuer: Let’s Encrypt YE1;
- validity observed: 2026-07-25 through 2026-10-23.

HTTP→HTTPS нормалізація працює. Host normalization **не працює**: apex і `www` є двома окремими `200` origins. Фактичний canonical origin не встановлено ні redirect-ом, ні canonical tag. Рекомендований єдиний origin: `https://kairos-parts.com.ua`.

## 12. Production HTTP and HTML evidence

GET/HEAD виконувалися без authentication cookies з user-agent `SEOAudit/1.0`. Час — один вимір, не performance benchmark.

| Route | Status | Time ms (GET sample) | Content-Type | gzip | Title | Description | Robots | Canonical | H1 in SSR HTML |
|---|---:|---:|---|---|---|---|---|---|---|
| `/` | 200 | 257 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/about` | 200 | 66 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/advantages` | 404 | 116 | HTML | yes | Kairos Parts / 404 | generic | noindex | absent | no content H1 |
| `/how-it-works` | 200 | 70 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/contacts` | 200 | 61 | HTML | yes | unique | unique UK | absent | absent | yes |
| `/logistics` | 404 | 49 | HTML | yes | 404 | generic | noindex | absent | 404 |
| `/categories` | 200 | 74 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/used-equipment` | 200 | 409 | HTML | yes | unique | unique UK | absent | absent | yes |
| `/request` | 200 | 120 | HTML | yes | Kairos Parts | generic EN | absent | absent | login-gateway H1 |
| `/login` | 200 | 136 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/register` | 200 | 79 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/forgot-password` | 200 | 53 | HTML | yes | Kairos Parts | generic EN | absent | absent | no H1 detected |
| `/admin/login` | 200 | 68 | HTML | yes | Kairos Parts | generic EN | absent | absent | yes |
| `/robots.txt` | 404 | 50 | HTML | yes | 404 | generic | noindex | absent | 404 |
| `/sitemap.xml` | 404 | 45 | HTML | yes | 404 | generic | noindex | absent | 404 |

Усі 7 concrete category pages повернули `200`, SSR H1 і generic inherited metadata без canonical. На перевірених ключових URLs 5xx або runtime error не знайдено. Response має `server: nginx/1.24.0 (Ubuntu)`, `x-powered-by: Next.js`; статичні pages мали `cache-control: s-maxage=31536000`, dynamic `/used-equipment` — `private, no-cache, no-store`.

Mobile viewport metadata присутня у production HTML: `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## 13. Internal linking audit

Позитивне:

- global navigation і footer використовують Next `<Link>`/звичайні anchors, не JavaScript-only click handlers (`components/layout/public-layout.tsx:12-18,27,38-55,78-84`);
- logo веде на relative `/`, тому не hardcode-ить localhost/Vercel;
- live root links на `/`, `/about`, `/how-it-works`, `/used-equipment`, `/contacts`, `/login`, `/request` повертають валідні destinations;
- category listing має crawlable `<Link>` на всі 7 category pages (`app/(public)/categories/page.tsx:23-35`).

Проблеми:

- `/categories` не присутній у global navigation і не знайдений серед links перевірених основних live pages; це orphan landing, хоча його дочірні сторінки доступні з нього.
- production navigation не містить `/logistics`, хоча current source його містить (`components/layout/public-layout.tsx:15`). Це ще один доказ source/deployment drift.
- `/advantages` навмисно disabled і не має бути linked/indexed.
- live catalog БВ техніки не містив detail links, бо опублікованих items під час аудиту не виявлено.
- internal links на localhost, staging або Vercel у перевіреному production HTML не знайдено.

## 14. Structured data audit

У runtime source не знайдено:

- `application/ld+json`;
- `schema.org`;
- JSON-LD helpers;
- `Organization`;
- `WebSite`;
- `BreadcrumbList`.

Structured data state: **absent**. Вигаданих rating/review/address/price schema також не знайдено. Додавання schema не входило в цей audit-only етап.

## 15. Production origin configuration

Поточний URL contract:

```text
APP_BASE_URL
  -> NEXTAUTH_URL
  -> https://kairos-parts.vercel.app
```

Evidence: `lib/site-url.ts:1-8`. Той самий pattern частково дублюється у Telegram/notification code.

Sanitized local URL variables:

| Variable | Local state | SEO implication |
|---|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` (`.env.local:22`) | unsuitable as production metadata |
| `VERCEL_URL` | empty (`.env.local:43`) | not used by shared helper |
| `APP_BASE_URL` | `https://kairos-parts.vercel.app` (`.env.local:47`) | would generate Vercel canonical/OG URL |
| `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `APP_URL`, `AUTH_URL` | not found in inspected local files | no canonical source of truth |

Live VPS process environment and Nginx file were not read in this task: `NOT VERIFIED`. Production HTML does not expose canonical/OG URL, тому live `APP_BASE_URL` неможливо вивести з HTML. URL values above are origins only; secrets не читалися і не виводилися.

## 16. Findings by severity

### Critical

| Severity | Finding | Evidence | Impact | Recommended fix |
|---|---|---|---|---|
| Critical | Єдиний canonical origin не встановлено; apex і `www` обидва `200`, canonical tags відсутні, helper має Vercel fallback | live four-origin redirect test; `lib/site-url.ts:1-8`; root metadata | duplicate-host indexing, split signals, можливі canonical на `vercel.app` | обрати apex, зробити one-hop `301` з `www`, встановити production-only site origin/`metadataBase`, видалити Vercel fallback із SEO path |

### High

| Severity | Finding | Evidence | Impact | Recommended fix |
|---|---|---|---|---|
| High | `robots.txt` і `sitemap.xml` відсутні | files absent; live `404 text/html` | немає crawl policy і sitemap discovery | додати `app/robots.ts`, `app/sitemap.ts`, XML/headers validation |
| High | Auth, transactional і token pages без explicit noindex | live `/login`, `/register`, `/forgot-password`, `/admin/login`, `/request`; source status-token page | index bloat; token/query URLs можуть потрапити у search | nested noindex metadata/layouts; explicit noindex for status/token and form routes |
| High | Production/source drift: `/logistics` source route є, live повертає `404`; navigation також відрізняється | source files and nav vs live GET | sitemap plan може містити неіснуючий URL; реліз SEO не можна валідувати на поточному build | перед sitemap inclusion встановити deployment provenance і підтвердити `200` |
| High | Більшість indexable pages не має canonical і unique metadata | 11/13 concrete indexable URLs без unique title/description; 13/13 без canonical | слабка релевантність, duplicate titles, нестабільна canonicalization | shared metadata factory + route-specific metadata/generateMetadata |

### Medium

| Severity | Finding | Evidence | Impact | Recommended fix |
|---|---|---|---|---|
| Medium | `/categories` orphan from global navigation | `components/layout/public-layout.tsx:12-18`; live link inventory | weaker discovery/internal PageRank | додати relevant nav/home link |
| Medium | Pagination canonical policy для `/used-equipment?page=N` відсутня | `app/(public)/used-equipment/page.tsx:17-23`; no canonical | duplicate/query-state ambiguity | define page-aware canonical and sitemap policy |
| Medium | Structured data відсутня | runtime source search | missed rich entity/context signals | add truthful Organization/WebSite and applicable breadcrumbs after metadata foundation |
| Medium | `PUBLIC_ROUTE_PREFIXES` не синхронізований з усіма public routes | `lib/auth/permissions.ts:3-15` | future matcher expansion could accidentally redirect public pages | centralize route policy or add regression test |

### Low

| Severity | Finding | Evidence | Impact | Recommended fix |
|---|---|---|---|---|
| Low | Generic root description англійською на Ukrainian site | `app/layout.tsx:25-28`, live HTML | poor snippet quality/brand clarity | replace with Ukrainian route-specific descriptions |
| Low | Icons/manifest/Twitter metadata absent | metadata inventory | incomplete presentation/discoverability | add after crawl foundation |
| Low | `x-powered-by` і exact Nginx version exposed | live headers | minor fingerprinting, not indexing blocker | consider suppressing in separate hardening change |

## 17. Exact recommended implementation stages

### Stage SEO 1 — canonical and crawl foundation

1. Define one server-only constant for `https://kairos-parts.com.ua`.
2. Set root `metadataBase`.
3. Remove `vercel.app` fallback from SEO canonical generation; fail validation in production if canonical origin is invalid.
4. Add route groups/layout metadata for `index,follow` marketing pages and `noindex,nofollow` auth/protected/transactional/token pages.
5. Add one-hop `301` from `www` HTTPS to apex HTTPS in Nginx; separately validate all four origins.
6. Do not include `/logistics` until production returns `200`.

Acceptance: apex is the only `200` origin; all 13 current indexable URLs emit absolute apex canonical; excluded `200` pages emit noindex.

### Stage SEO 2 — robots and sitemap

1. Implement `app/robots.ts`.
2. Implement `app/sitemap.ts` using only canonical `200` URLs.
3. Add the 6 static live pages, 7 known categories and published used-equipment detail records.
4. Exclude auth, client, admin, API, request forms, token status URLs and query states.
5. Add sitemap URL to robots.
6. Validate status, content type, XML, origins, duplicates, redirects and URL counts.

### Stage SEO 3 — metadata and canonical coverage

1. Add unique Ukrainian title/description for home, about, how-it-works, categories and each category.
2. Add page-aware metadata for used-equipment listing/details.
3. Add Open Graph URL/images and Twitter cards based on the same canonical helper.
4. Decide pagination canonical explicitly.
5. Add regression checks that ban localhost, IP, Vercel/preview origins in rendered SEO tags.

### Stage SEO 4 — structured data

Add only evidence-backed `Organization`, `WebSite` and relevant `BreadcrumbList`. Do not invent ratings, reviews, address, price or availability.

### Stage SEO 5 — Search Console onboarding

After production validation: verify the apex HTTPS property/domain property, submit sitemap, inspect representative URLs, review Page Indexing/Crawl Stats. Search Console changes require separate approval.

### Stage SEO 6 — production validation

Run no-cookie desktop/mobile checks, Googlebot-like fetches, redirect/canonical parity, robots tester, XML validation, Rich Results validation and post-deploy regression. Record exact deployment commit/build provenance.

## 18. Proposed sitemap URL list

### Include now after SEO foundation (13 concrete URLs)

```text
https://kairos-parts.com.ua/
https://kairos-parts.com.ua/about
https://kairos-parts.com.ua/how-it-works
https://kairos-parts.com.ua/contacts
https://kairos-parts.com.ua/categories
https://kairos-parts.com.ua/categories/agricultural-parts
https://kairos-parts.com.ua/categories/truck-parts
https://kairos-parts.com.ua/categories/tires-tubes
https://kairos-parts.com.ua/categories/trailers-semitrailers
https://kairos-parts.com.ua/categories/commercial-transport
https://kairos-parts.com.ua/categories/universal-parts
https://kairos-parts.com.ua/categories/consumables
https://kairos-parts.com.ua/used-equipment
```

### Conditional

- `https://kairos-parts.com.ua/used-equipment/{slug}` — only published, visible, canonical items returning direct `200`; zero concrete URLs confirmed in this audit.
- `https://kairos-parts.com.ua/logistics` — add only after the intended source is deployed and production returns direct `200` with apex canonical.

Do not add `/advantages` while the feature gate returns `404`. `lastModified` should come from a real content update timestamp; do not use request/build time for static pages.

## 19. Proposed robots exclusions

Recommended logical exclusions:

```text
/admin/
/client/
/api/
/login
/register
/forgot-password
/invitation/
/request
/request/status/
/logistics/request
```

Also emit:

```text
Sitemap: https://kairos-parts.com.ua/sitemap.xml
```

Robots exclusions are crawl hints, not authorization. Auth/session guards remain mandatory. For public auth/form/token pages, add meta robots or `X-Robots-Tag` noindex in addition to any robots rule; blocking crawl before Google sees noindex can delay removal.

## 20. Risks and blockers

- Live Nginx config unread in this audit: exact `server` blocks, redirect rule source and hidden header directives are `NOT VERIFIED`; observed HTTP behavior is verified.
- Live VPS environment unread: current `APP_BASE_URL`/`NEXTAUTH_URL` are `NOT VERIFIED`.
- Search Console inaccessible/not changed: coverage, crawl stats and submitted sitemap state are `NOT VERIFIED`.
- No valid status token was requested to avoid exposing or touching business data; valid `/request/status/[token]` HTML/headers are `NOT VERIFIED`.
- No authenticated client/admin requests were made; only unauthenticated boundaries verified.
- No published used-equipment item existed in discovered live HTML, so detail canonical/OG rendering is `NOT VERIFIED`.
- Production deployment provenance is unknown in this task; live `/logistics` and navigation do not match current source.
- Search-engine `site:` probe is not authoritative.

## 21. Commands and checks executed

Read-only/local:

```text
git -c safe.directory=... branch --show-current
git -c safe.directory=... status --short
git -c safe.directory=... log -5 --oneline
git -c safe.directory=... remote -v
git -c safe.directory=... rev-parse HEAD
rg --files app public
rg metadataBase|canonical|openGraph|robots|noindex|nofollow|X-Robots-Tag|schema.org|application/ld+json ...
Get-Content package.json, layouts, middleware.ts, next.config.ts, permissions and public pages
sanitized URL-key inspection of .env.local/.env.example
```

External read-only:

```text
DNS A lookups for apex and www
TLS handshake/certificate inspection for apex and www
manual redirect-chain GET for four HTTP/HTTPS origins
GET and HEAD without cookies for required public/protected/robots/sitemap URLs
HTML extraction: title, description, robots, googlebot, canonical, og:url, lang, H1, internal hrefs
site:kairos-parts.com.ua and site:www.kairos-parts.com.ua search probes
```

No load testing, authentication cookies, server writes, DNS changes, Search Console changes or database queries were used.

## 22. Final conclusion

Stage Production SEO 0 виконано як audit-only. Код application, конфігурацію, database, Nginx, DNS і production deployment не змінено. Єдиний створений artifact — цей звіт.

Підсумковий стан:

- robots: absent in code, production `404`;
- sitemap: absent in code, production `404`;
- global noindex: not found;
- effective production canonical origin: **not established**;
- recommended canonical origin: `https://kairos-parts.com.ua`;
- current concrete indexable sitemap candidates: 13;
- current excluded repository patterns: 110 of 118;
- Critical: duplicate/uncontrolled origins and unsafe canonical URL source;
- High: missing robots/sitemap, missing noindex on excluded surfaces, deployment drift, incomplete canonical/metadata coverage.

Рекомендований наступний етап: **Stage SEO 1 — canonical and crawl foundation**, з окремим explicit approval на code/Nginx changes і наступною production validation.

## Implementation follow-up

Stage Production SEO 1 реалізовано у scoped commit з message `feat: add canonical crawl foundation`.
Історичні production findings цього звіту не переписувалися. Application changes ще не deployed;
live Nginx, DNS, production environment і Search Console не змінювалися. Деталі реалізації та
validation наведено у `docs/reports/stage-production-seo-1-canonical-crawl-foundation.md`.
