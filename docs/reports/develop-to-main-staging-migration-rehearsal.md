# Kairos Parts — Staging Migration Rehearsal

Дата перевірки: 2026-07-31

Integration branch: `release/develop-to-main-20260731`

Перевірений commit: `b244acda634c76d782fb83136ff2a46f4cde7dbe`

Фінальне рішення: **NOT READY — BLOCKERS PRESENT**

## 1. Git branch publication

- Branch підтверджена як `release/develop-to-main-20260731`.
- Початковий working tree був чистим; незавершених merge, rebase або cherry-pick не було.
- Integration branch містить merge `1ef90ad` і audit commit `b244acd`.
- `origin/main` залишився на `055200959f2ed8e1be628d46e91265f23cc93e61`.
- `origin/develop` залишився на `cbec63224af29fe7b081b8e71b8ab14de700a38f`.
- Branch успішно запушена та синхронізована з `origin/release/develop-to-main-20260731`.
- Critical production files, PM2 configuration, workflow, Vercel policy і redirect-origin fix присутні.
- `stash@{0}: WIP Docker baseline before PM2 switch` не застосовувався і не видалявся.

## 2. Vercel Preview deployment

- Deployment ID: `dpl_DUN7V5YSUMmy4tfv2iDUVE7pFEQD`.
- URL: `https://kairos-parts-49mba09no-sergiys-projects-c8c24309.vercel.app`.
- Branch alias: `https://kairos-parts-git-release-devel-a1722c-sergiys-projects-c8c24309.vercel.app`.
- Git branch: `release/develop-to-main-20260731`.
- Git SHA: `b244acda634c76d782fb83136ff2a46f4cde7dbe`.
- Environment: Preview (`target = null`, project `live = false`).
- Status: `READY`.
- Region: `iad1`.
- Build duration: приблизно 109.788 s.
- Errors-only build log не містить build errors; зафіксовано `Build Completed`.

## 3. Staging database identity

Safe identity output:

```text
provider: postgresql / Neon
host: ep-wandering-thunder-aszf0fwz-pooler.c-4.eu-central-1.aws.neon.tech
direct host: ep-wandering-thunder-aszf0fwz.c-4.eu-central-1.aws.neon.tech
database: neondb
server: PostgreSQL 17.10
environment scope: Preview
production VPS host: NO
production database kairos_parts: NO
```

`DATABASE_URL` і `DATABASE_URL_UNPOOLED` вказували на одну базу. Повний URL, username, password і query parameters не логувалися.

## 4. Non-production safeguards

Guard пройдено до будь-якої migration-команди:

- host не `localhost`, `127.0.0.1` або `::1`;
- database name не `kairos_parts`;
- provider і host належать Neon;
- pooled і unpooled URLs посилаються на одну database;
- deployment має Preview scope;
- deployment branch і commit точно відповідають integration branch;
- Prisma під час status/deploy показав той самий safe Neon direct host;
- Vercel env використовувався через branch-scoped `vercel env run`, без повторного експорту secrets.

Preview variables були доступні для `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `APP_BASE_URL`, `NEXTAUTH_URL`, auth secrets, Cloudinary і Telegram. Їх значення не включені у звіт. Тимчасовий env snapshot після DB checks видалено.

## 5. Pre-migration backup

Backup було створено до контрольного `prisma migrate deploy`, але вже після виявлення, що всі release migrations раніше застосовані до staging. Отже, це валідний pre-command snapshot, але не snapshot стану до первинного застосування 11 migrations.

```text
path: C:\Users\Admin\AppData\Local\Temp\kairos-staging-rehearsal-b244acd\neon-before-release-migrations.dump
format: PostgreSQL custom
size: 290708 bytes
SHA-256: 87c266e9b8a715c6bd4702931abbf950ec69f9448bc5f1753eb5fa42fd3c0955
pg_restore --list: PASS
checksum file: neon-before-release-migrations.dump.sha256
```

Використано `pg_dump 18.1` з `--no-owner --no-privileges`. Dump і checksum не додані в Git.

## 6. Pre-migration migration status

```text
repository migrations: 47
applied in staging: 47
pending: 0
failed: 0
rolled back: 0
non-empty migration logs: 0
Prisma status: Database schema is up to date
```

Очікування промпту про 11 pending migrations не підтвердилося: усі 11 уже були записані в `_prisma_migrations` до початку rehearsal.

## 7. Pre-migration data inventory

PII, filenames, URLs та row contents не виводилися.

| Table | Rows |
|---|---:|
| `Document` | 0 |
| `RequestFile` | 9 |
| `Request` | 50 |
| `RequestDocument` | 1 |
| `Vehicle` | 10 |
| `VehicleImage` | 6 |
| `OCRResult` | 4 |
| `_prisma_migrations` | 47 |

`Document`:

- `source IS NULL`: 0;
- source distribution відсутній, бо таблиця порожня;
- orphan client/company/request/vehicle references: 0.

`RequestFile`:

- `storageKey IS NULL`: 0;
- `fileUrl IS NULL`: 9; non-NULL: 0;
- provider: `CLOUDINARY = 1`, `LEGACY_LOCAL = 8`;
- status: `AVAILABLE = 1`, `MIGRATION_PENDING = 8`;
- source: `CLIENT_FORM = 1`, `LEGACY = 4`, `TELEGRAM = 4`;
- duplicate storage-key groups: 0;
- orphan request references: 0.

Також отримано 0 orphan references для `RequestDocument`, `VehicleImage` і `OCRResult`.

## 8. Pending migrations

Фактично pending було 0. SQL review охопив усі 11 release migrations:

| Migration | Purpose | Risk |
|---|---|---|
| `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses` | Додає два `RequestStatus` | low |
| `20260727183000_add_request_selection_batch_foundation` | Approval-cycle tables, enums, indexes, checks і FKs | high |
| `20260728120000_add_request_selection_item_audit_events` | Audit vocabulary | low |
| `20260728150000_add_partially_approved_selection_batch_status` | Partial approval enum | low |
| `20260728151000_add_invoice_selection_provenance` | Invoice provenance columns, unique indexes і FKs | medium |
| `20260729120000_add_logistics_persistence_foundation` | Logistics schema, sequence, constraints і 13 tariff rows | high |
| `20260729160000_add_manual_logistics_addresses` | Manual address mode і replacement checks | medium |
| `20260729230000_add_logistics_preferred_delivery_date` | Preferred-date fields і audit action | low |
| `20260730120000_add_individual_logistics_pricing` | Nullable pricing fields і pricing contract check | high |
| `20260730123000_add_document_source_provenance` | `Document.source` backfill і NOT NULL guard | high |
| `20260730170000_add_request_file_cloudinary_storage` | Storage metadata backfill, checks та indexes | high |

`Document.source` SQL використовує safe sequence: nullable column → `LEGACY` fallback → uploader-role refinement → NULL guard → NOT NULL. `RequestFile` SQL вимагає чинний request relation, залишає legacy files у `LEGACY_LOCAL/MIGRATION_PENDING` і прямо не намагається підтвердити локальні bytes.

## 9. Migration execution

Після backup, inventory і SQL review виконано лише дозволену команду:

```text
command: npx prisma migrate deploy
start UTC: 2026-07-31T09:58:26.2743332Z
finish UTC: 2026-07-31T09:58:35.1028114Z
duration: 8.774 s
exit code: 0
result: No pending migrations to apply
```

Жодна migration повторно не застосовувалася. `migrate dev`, `db push`, `reset`, `resolve` і seed не запускалися.

## 10. Post-migration status

```text
repository migrations: 47
applied: 47
pending: 0
failed: 0
rolled back: 0
non-empty logs: 0
Prisma status: Database schema is up to date
```

Кожна з 11 release migrations присутня рівно один раз, має завершене застосування і не має failed record.

## 11. Document source backfill validation

- Before/after row count: `0 → 0`.
- `source IS NULL`: `0 → 0`.
- Orphan relations: `0 → 0`.
- Column, enum, NOT NULL model contract та index присутні.
- Результат: migration structurally rehearsed, але data backfill path **не був exercised**, бо source table порожня.

Це blocker для повного доказу data migration rehearsal на репрезентативній staging DB.

## 12. RequestFile storage backfill validation

- Before/after row count: `9 → 9`.
- Required metadata NULL: `0 → 0`.
- Duplicate storage keys: `0 → 0`.
- Orphan requests: `0 → 0`.
- Один новіший file має `CLOUDINARY/AVAILABLE`; вісім legacy files мають очікуваний `LEGACY_LOCAL/MIGRATION_PENDING`.
- `fileUrl` не розкривався; усі 9 значень NULL.
- Row deletion або relation loss не виявлено.

Вісім pending legacy assets потребують окремої керованої storage migration/verification, але не є помилкою SQL backfill.

## 13. Schema validation

- `npx prisma validate`: PASS.
- `npx prisma generate`: PASS, Prisma Client `6.19.3`.
- Required release columns: `18/18`.
- Перевірені key constraints: `10/10`.
- Перевірені key indexes: `10/10`.
- `DocumentSource`: `CLIENT,MANAGER,ADMIN,SYSTEM,LEGACY`.
- `RequestFileStorageProvider`: `CLOUDINARY,LEGACY_LOCAL`.
- `RequestFileStorageStatus`: `AVAILABLE,MISSING,MIGRATION_PENDING,MIGRATION_FAILED`.

## 14. Regression checks

- `npm ci`: PASS; 533 packages installed from lockfile; lockfile не змінено.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; Next.js `15.5.19`, 57 static pages generated.
- `npm run auth:redirect-origin:check`: PASS.
- Prisma validate/generate: PASS.
- Domain regression: **26 PASS / 0 FAIL / 0 SKIPPED**.

26 check scripts запускалися як окрема regression suite, а не як частина build.

## 15. Vercel routing smoke

Частковий результат:

- один connector request до `/` отримав application HTML з HTTP 200;
- HTML містив очікуваний title, icons і canonical;
- exact deployment runtime logs за останні 24 години: один HTTP 200 і 0 error/fatal logs;
- подальша route matrix для `/`, `/login`, `/admin/login`, `/client`, `/admin`, `/request`, `/logistics`, `/logistics/request`, `/robots.txt`, `/sitemap.xml` отримала HTTP 302 до Vercel SSO через Deployment Protection;
- у спостережених locations не було `localhost` або `kairos-parts.com.ua`, але це Vercel SSO redirect, а не application redirect.

Очікувані application redirects `/client → /login?next=/client` і `/admin → /admin/login?next=/admin` live не підтверджені. Налаштування Deployment Protection не змінювалися.

## 16. Auth smoke

**BLOCKED / NOT EXECUTED.** Cookie-aware browser access був відхилений browser security policy, а connector не утримав Vercel SSO session. Staging ADMIN/MANAGER/CLIENT credentials не передавалися. Login, role isolation, logout і session persistence live не підтверджені.

## 17. Request workflow smoke

**BLOCKED / NOT EXECUTED.** Без authenticated Preview session не створювалися staging requests і не виконувалися status/approval/invoice mutations. Static/domain regression для відповідних lifecycle сценаріїв пройшла 26/26, але вона не замінює live workflow smoke.

## 18. Files/OCR smoke

**BLOCKED / NOT EXECUTED.** Окремий staging Cloudinary namespace не підтверджений. Код формує спільні prefixes `kairos-parts/requests/...`, `kairos-parts/vehicle-documents/...` та `kairos-parts/vehicles/...` без environment prefix. Через ризик використання production Cloudinary credentials upload, retrieval, OCR persistence і deletion не запускалися.

Focused storage/OCR regression checks PASS. Для exact deployment не знайдено runtime error/fatal logs; історичні OCR packaging errors належать іншим deployment IDs і не зараховувалися як помилки цього Preview.

## 19. Vehicle documents smoke

**BLOCKED / NOT EXECUTED.** Authenticated client/admin session відсутня, а Cloudinary environment isolation не доведена. Backend foundation і unified-form regression checks PASS, але live upload/view/download authorization не підтверджені.

## 20. Logistics smoke

**BLOCKED / NOT EXECUTED.** Public routes захищені Vercel SSO; request creation не виконувалося, щоб не створювати зовнішні Telegram side effects за неоднозначних credentials. Logistics form regression PASS (`cities=13`, `formulaCases=5`, submit enabled). Live address provider, quote, persistence, lists/details, tariff та individual pricing не підтверджені.

## 21. SEO smoke

- Static crawl foundation check: PASS; `sitemapUrls=13`, `robotsExclusions=10`.
- Canonical origin: `https://kairos-parts.com.ua` — це свідома SEO canonical policy, не auth redirect.
- Один отриманий Preview HTML підтвердив canonical, metadata та icon links.
- Live `/robots.txt` і `/sitemap.xml` route responses після цього були заблоковані Vercel SSO; повний live SEO smoke не завершений.

## 22. Dependency security triage

`npm audit --omit=dev` актуально показав **2 critical + 4 high = 6 runtime findings**. Загальний audit після `npm ci`, включно з dev tree, показав **2 critical + 5 high = 7**.

| Package | Severity | Direct | Installed | Triage |
|---|---|---:|---|---|
| `next-auth` | critical | yes | `5.0.0-beta.31` | Runtime auth path, reachable; Auth.js fail-open та related advisories |
| `@auth/core` | critical | no | `0.41.2` | Через `next-auth`/adapter; runtime reachable |
| `@auth/prisma-adapter` | high | yes | `2.11.2` | Успадковує vulnerable `@auth/core`; runtime auth persistence |
| `next` | high | yes | `15.5.19` | App Router/Server Actions/rewrites/image advisories; runtime reachable; fixed range починається з `15.5.21` для перелічених Next advisories |
| `postcss` | high | yes | `8.5.16` | Переважно CSS build pipeline; advisory включає source-map disclosure; fix available |
| `sharp` | high | no | `0.34.5` | Через Next image optimization; runtime image path потенційно reachable; patched line `>=0.35.0` |

`npm audit` повідомляє `fixAvailable = true`, але automatic fixes і dependency upgrades у цьому етапі заборонені. Critical runtime auth findings та reachable Next findings є merge blocker до окремого scoped remediation й повторної regression.

## 23. Known limitations

1. Усі 11 migrations уже були applied до початку rehearsal; первинний apply та backfill не спостерігалися.
2. Backup є snapshot до no-op deploy, але після історичного застосування 11 migrations.
3. `Document` має 0 rows; data backfill path не exercised.
4. Вісім `RequestFile` залишаються `LEGACY_LOCAL/MIGRATION_PENDING` за дизайном migration SQL.
5. Vercel Deployment Protection блокує повну route matrix та authenticated smoke.
6. Browser security policy не дозволила cookie-aware інтерактивний доступ до Preview.
7. Окремі staging Cloudinary namespace/account і Telegram bot identity не доведені.
8. Наявні 2 critical і 4 high runtime dependency findings.

## 24. Readiness decision

**NOT READY — BLOCKERS PRESENT**

Позитивні докази: integration branch і Preview відповідають exact SHA; DB однозначно non-production; backup валідний; schema 47/47; data integrity checks PASS; lint/typecheck/build/Prisma PASS; regression 26/26.

Негативне рішення зумовлене не schema drift, а відсутністю доказу первинного застосування migrations, неповним live Preview smoke, неоднозначністю third-party staging isolation і critical runtime dependency findings.

Цей висновок не означає readiness до production deploy.

## 25. Exact next-step checklist

До будь-якого merge у `main`:

1. Створити або визначити fresh non-production Neon branch/schema зі станом до 11 migrations.
2. Додати репрезентативні, неперсональні staging fixtures для `Document` і legacy `RequestFile` або погодити ризик порожнього backfill.
3. Повторити backup → inventory → 11 pending → deploy → before/after validation на fresh staging target.
4. Надати безпечний Preview access для route/auth smoke без зміни production policy.
5. Підтвердити окремий staging Cloudinary account або environment-prefixed namespace.
6. Підтвердити окремий staging Telegram bot/chat або вимкнути notifications для smoke.
7. Надати/підтвердити наявні staging ADMIN, MANAGER і CLIENT test accounts.
8. Виконати live auth, request workflow, files/OCR, vehicle documents і logistics smoke.
9. Окремим scoped етапом оновити vulnerable auth/Next/PostCSS/Sharp dependencies без `npm audit fix` навмання.
10. Повторити lint, typecheck, build, Prisma checks, 26 regression scripts і Preview smoke.

Після закриття blocker-ів застосувати main-merge checklist:

1. Review integration branch.
2. Confirm staging migrations up to date.
3. Confirm 26/26 regression checks PASS.
4. Confirm Vercel Preview smoke PASS.
5. Create fresh production `pg_dump`.
6. Verify `pg_restore --list`.
7. Create SHA-256 checksum.
8. Copy dump off VPS.
9. Verify production disk space.
10. Merge integration branch into `main`.
11. Run main lint/typecheck/build/checks.
12. Push `main`.
13. Manually run Deploy Production.
14. Verify 11 production migrations.
15. Verify PM2 and health check.
16. Verify `/client` and `/admin` redirects.
17. Verify test ADMIN login.
18. Run production smoke.

## 26. Blockers

- **B1 — Migration rehearsal provenance:** 11 migrations були applied раніше; fresh apply/backfill не відтворено.
- **B2 — Document backfill coverage:** `Document` порожня, тому backfill data path не exercised.
- **B3 — Preview access:** Deployment Protection і browser policy заблокували повний live smoke.
- **B4 — Third-party isolation:** staging Cloudinary namespace/account і Telegram identity не підтверджені; зовнішні mutations зупинені.
- **B5 — Security:** 2 critical + 4 high runtime dependency findings, включно з reachable auth і Next paths.

Production VPS, production PostgreSQL, Nginx, PM2, DNS, Certbot, GitHub Actions production deployment, GitHub Secrets, production users і `main` у межах цього етапу не змінювалися.
