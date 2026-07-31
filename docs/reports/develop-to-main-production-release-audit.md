# Kairos Parts — Develop → Main Production Release Audit

Дата аудиту: 2026-07-31.

Рішення: **READY FOR STAGING VALIDATION**.

Цей документ фіксує read-only audit `origin/main` проти `origin/develop` і
локальний merge rehearsal у відокремленій гілці. Production VPS, production
database, GitHub Actions, Vercel environment, DNS, Nginx, Certbot і PM2 не
змінювалися.

## 1. Початковий стан Git

На початку:

- активна гілка: `develop`;
- working tree: чистий;
- `origin/main`: `055200959f2ed8e1be628d46e91265f23cc93e61`;
- `origin/develop`: `cbec63224af29fe7b081b8e71b8ab14de700a38f`;
- `git fetch origin --prune`: виконано;
- незавершених merge, cherry-pick або rebase не було;
- `.vercel/` не відстежувалася;
- `vercel.json` і `.gitignore` відстежувалися;
- старий Docker stash не застосовувався й не видалявся.

Збережений stash:

```text
stash@{0}: On infra/docker-production-baseline: WIP Docker baseline before PM2 switch
```

## 2. Divergence main/develop

`git rev-list --left-right --count origin/main...origin/develop`:

```text
10 88
```

Отже:

- лише в `main`: 10 commits;
- лише в `develop`: 88 commits;
- merge base: `1cf141696f9ff88d76f7bc5f24ea6ada9f84e60e`.

Трикрапковий diff функціональної частини `develop` містив 284 file records:

- 203 added;
- 81 modified;
- 0 deleted;
- 0 renamed.

Фінальний merge result відносно `origin/main`, до audit-only follow-up:

```text
278 files changed, 50074 insertions(+), 2313 deletions(-)
198 added, 80 modified, 0 deleted, 0 renamed
```

Зменшення з 284 до 278 пояснюється збереженням шести production-only файлів
із `main`, які прямий `origin/main..origin/develop` diff показував як відсутні
в `develop`.

## 3. Перелік функціональних змін

Основні категорії:

- application code: нові public, client, admin та API surfaces;
- auth/security: public-origin redirect fix, client/staff access hardening;
- request workflow: canonical transition service та нові status stages;
- approval workflow: immutable selection batches, aggregate та partial approval;
- invoices: provenance selection batch/item, presentation і send workflow;
- documents/files: provenance, client vehicle documents, request-file storage;
- vehicles: shared workflows, unified forms та document/image UX;
- OCR: Tesseract worker/runtime resolver і Cloudinary-backed file access;
- Cloudinary: authenticated request-file storage та migration tooling;
- logistics: public form, pricing, persistence, client/admin CRM, addresses;
- SEO: metadata, canonical URLs, `robots.txt`, `sitemap.xml`, icons;
- admin CRM: request, logistics, vehicle та workflow feedback changes;
- client cabinet: request approval, logistics, documents та vehicle flows;
- database schema: 11 нових migrations;
- CI/CD: Vercel branch policy; production workflow збережено з `main`;
- tests/check scripts: 26 `test:*` scripts;
- documentation: stage reports для request, logistics, OCR, SEO та documents.

Найризиковіші модулі:

1. `prisma/migrations/` і `prisma/schema.prisma`;
2. `lib/request-selection/`, `lib/requests/status-transition.ts`;
3. `lib/invoices/` та invoice actions;
4. `lib/files/`, `lib/ocr/`, `app/api/ocr/route.ts`;
5. `lib/logistics/` і logistics API/CRM routes;
6. production deploy artifact/runtime contract;
7. auth middleware та redirect-origin helper.

## 4. Production infrastructure preservation

Після merge rehearsal без змін від `origin/main` збережені blob-и:

- `.nvmrc`;
- `ecosystem.config.cjs`;
- `.github/workflows/deploy-production.yml`;
- `scripts/deploy-production.sh`;
- `scripts/rollback-production.sh`;
- `.gitignore`;
- `middleware.ts`;
- `lib/auth/redirect-url.ts`;
- `scripts/check-production-redirect-origin.ts`;
- `prisma.config.ts`.

Також збережені production ADMIN bootstrap artifacts:

- `scripts/bootstrap-production-admin.ts`;
- `scripts/check-production-admin-bootstrap.ts`;
- `docs/reports/production-admin-bootstrap.md`;
- scripts `admin:bootstrap` і `admin:bootstrap:check` у `package.json`.

`develop` окремо не містив production workflow, deploy/rollback scripts і
ADMIN bootstrap artifacts, але merge з `main` їх не видалив. `.nvmrc` лишився
зі значенням `24`, `ecosystem.config.cjs` — із PM2 `next start` на
`127.0.0.1:3000`.

Відстежуваних Docker/Docker Compose файлів у фінальному tree немає.

## 5. Vercel deployment policy

Фінальний `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false,
      "develop": true
    }
  }
}
```

Тому push у `main` не повинен автоматично створювати Vercel deployment, а
`develop` лишається staging branch. Vercel environment не змінювався.

## 6. Redirect-origin regression protection

Збережена послідовність визначення public origin:

```text
x-forwarded-host + x-forwarded-proto
→ APP_BASE_URL
→ request.nextUrl.origin
```

`middleware.ts`, `lib/auth/redirect-url.ts` і
`scripts/check-production-redirect-origin.ts` ідентичні `origin/main`.

Результат:

```text
npm run auth:redirect-origin:check → PASS
productionRedirectOrigin=PASS
```

Helper не hardcode-ить production host і тому використовує Vercel forwarded
host на staging та Nginx forwarded host на VPS.

## 7. Prisma migrations inventory

У `origin/main` є 36 migrations, у `origin/develop` — 47. Усі 36 migrations
із `main` присутні в `develop`; старі migration SQL не змінювалися.

| Migration | main | develop | Нова для production | Risk |
| --- | ---: | ---: | ---: | --- |
| `20260702094758_init_kairos_parts_schema` | так | так | ні | baseline |
| `20260703141000_add_telegram_draft_requests` | так | так | ні | baseline |
| `20260708090000_add_request_items` | так | так | ні | baseline |
| `20260708110000_add_request_documents` | так | так | ні | baseline |
| `20260708130000_add_commercial_offers` | так | так | ні | baseline |
| `20260708150000_add_companies` | так | так | ні | baseline |
| `20260708170000_add_change_requests` | так | так | ні | baseline |
| `20260708190000_add_vehicle_archive_fields` | так | так | ні | baseline |
| `20260708210000_add_audit_logs` | так | так | ні | baseline |
| `20260709120000_add_awaiting_shipment_request_status` | так | так | ні | baseline |
| `20260713120000_add_request_vehicle_year` | так | так | ні | baseline |
| `20260713150000_add_request_item_invoice_selection` | так | так | ні | baseline |
| `20260714100000_add_invoices` | так | так | ні | baseline |
| `20260715070703_add_billing_details` | так | так | ні | baseline |
| `20260715110000_add_client_billing_details` | так | так | ні | baseline |
| `20260715130000_add_client_telegram_link` | так | так | ні | baseline |
| `20260718045439_add_used_equipment_foundation` | так | так | ні | baseline |
| `20260718120000_add_contact_messages` | так | так | ні | baseline |
| `20260718160000_simplify_used_equipment_statuses` | так | так | ні | baseline |
| `20260719090000_normalize_vehicle_ownership` | так | так | ні | baseline |
| `20260719120000_add_vehicle_images` | так | так | ні | baseline |
| `20260719150000_add_vehicle_document_management` | так | так | ні | baseline |
| `20260719170000_add_company_and_client_documents` | так | так | ні | baseline |
| `20260720100000_add_equipment_taxonomy_management` | так | так | ні | baseline |
| `20260720140000_add_staff_lifecycle_and_auth_version` | так | так | ні | baseline |
| `20260720180000_add_manager_invitations` | так | так | ні | baseline |
| `20260721100000_add_sequential_invoice_numbers` | так | так | ні | baseline |
| `20260721130000_add_sequential_request_numbers` | так | так | ні | baseline |
| `20260721140000_add_request_manufacturer_snapshot` | так | так | ні | baseline |
| `20260721170000_add_request_item_equipment_type_snapshot` | так | так | ні | baseline |
| `20260721190000_add_user_normalized_phone` | так | так | ні | baseline |
| `20260722140000_add_auth_rate_limit_buckets` | так | так | ні | baseline |
| `20260722141000_add_vehicle_name` | так | так | ні | baseline |
| `20260722160000_extend_audit_log_foundation` | так | так | ні | baseline |
| `20260722200000_add_critical_audit_actions` | так | так | ні | baseline |
| `20260723120000_add_auth_audit_events` | так | так | ні | baseline |
| `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses` | ні | так | так | LOW |
| `20260727183000_add_request_selection_batch_foundation` | ні | так | так | MEDIUM |
| `20260728120000_add_request_selection_item_audit_events` | ні | так | так | LOW |
| `20260728150000_add_partially_approved_selection_batch_status` | ні | так | так | LOW |
| `20260728151000_add_invoice_selection_provenance` | ні | так | так | MEDIUM |
| `20260729120000_add_logistics_persistence_foundation` | ні | так | так | MEDIUM |
| `20260729160000_add_manual_logistics_addresses` | ні | так | так | MEDIUM |
| `20260729230000_add_logistics_preferred_delivery_date` | ні | так | так | LOW |
| `20260730120000_add_individual_logistics_pricing` | ні | так | так | MEDIUM |
| `20260730123000_add_document_source_provenance` | ні | так | так | HIGH |
| `20260730170000_add_request_file_cloudinary_storage` | ні | так | так | HIGH |

## 8. Migration SQL risk analysis

Усі 11 нових SQL-файлів прочитані повністю.

| Migration | Основний ризик | Lock/downtime | Data loss | Preconditions / postconditions |
| --- | --- | --- | --- | --- |
| `20260727120000...statuses` | два `ALTER TYPE ... ADD VALUE` | короткий enum lock | ні | PostgreSQL 17; enum values доступні |
| `20260727183000...batch_foundation` | `ALTER Request`, нові таблиці, checks, unique indexes, FKs | MEDIUM | ні | existing `Request` rows отримують counter `0`; один active `SENT` |
| `20260728120000...audit_events` | enum vocabulary | LOW | ні | нові audit values доступні |
| `20260728150000...partially_approved` | enum value | LOW | ні | status доступний наступним migrations/code |
| `20260728151000...invoice_provenance` | nullable columns, unique indexes, FKs | MEDIUM | ні | existing rows лишаються `NULL`; provenance links валідні |
| `20260729120000...logistics_foundation` | багато DDL, sequence, 13 seed rows | MEDIUM | ні | tariff codes унікальні; `LG-*` sequence працює |
| `20260729160000...manual_addresses` | enum, drop/recreate check, nullable locality | MEDIUM | ні | existing logistics rows мають пройти новий check |
| `20260729230000...preferred_date` | nullable date columns та enum | LOW | ні | existing rows не блокуються |
| `20260730120000...individual_pricing` | drop `NOT NULL`, drop/recreate pricing check | MEDIUM | ні | existing FIXED rows повинні задовольнити contract |
| `20260730123000...document_source` | table-wide backfill, `SET NOT NULL`, index | HIGH | ні | uploader role mapping; після backfill немає `NULL` |
| `20260730170000...request_file_storage` | backfill, три `SET NOT NULL`, checks, indexes | HIGH | ні | кожен file має валідний `Request`; legacy rows стають `MIGRATION_PENDING` |

Не знайдено:

- `DROP TABLE`;
- `DROP COLUMN`;
- `DELETE`;
- `TRUNCATE`;
- rename table/column;
- manual transaction blocks;
- destructive enum recreation.

Важливі деталі:

- `Document.source` backfill спочатку ставить `LEGACY`, потім уточнює за
  uploader role та аварійно зупиняється, якщо лишився `NULL`;
- `RequestFile` backfill має `WHERE request.id = file.requestId` і аварійно
  зупиняється для orphaned/unresolved rows;
- остання migration додає audit enum values без `IF NOT EXISTS`; це коректно
  за незміненої Prisma history, але повторне ручне виконання SQL не є
  idempotent;
- unique indexes на nullable invoice provenance не конфліктують з існуючими
  `NULL`;
- `ON DELETE CASCADE` застосовується до дочірніх immutable batch/logistics
  entities, `SET NULL` — до actor/source provenance;
- PostgreSQL 17 підтримує використані enum operations.

Для двох HIGH migrations перед production потрібні:

1. актуальний `pg_dump`;
2. safe row counts для `Document` і `RequestFile`;
3. orphan precheck для `RequestFile.requestId`;
4. staging timing;
5. post-migration перевірка `NULL`, indexes, constraints та migration history.

## 9. Migration ordering

Порядок папок монотонний від `20260727120000` до `20260730170000`.

- duplicate timestamp folders: немає;
- перейменованих/видалених старих migrations: немає;
- migration у `main`, якої немає в `develop`: немає;
- modified old migration SQL: немає;
- залежності дотримані: batch → partial status → invoice provenance;
- logistics foundation перед manual addresses, preferred date та individual pricing;
- schema state відповідає 47 migrations і проходить Prisma validation.

Production `_prisma_migrations` у цьому етапі не читалася, тому applied-history
alignment має бути підтверджений окремо на staging і production preflight.

## 10. Dependency changes

Між branch manifests немає top-level version upgrade, add або remove.
Конфлікт полягав у placement:

- `origin/main`: `prisma` і `dotenv` у `dependencies`;
- `origin/develop`: ті самі версії у `devDependencies`;
- фінальний result: `prisma` і `dotenv` у `dependencies`.

Це обов’язково, бо VPS виконує `npm ci --omit=dev`, після чого запускає
`prisma migrate deploy`, а `prisma.config.ts` імпортує `dotenv`.

Перевірені пакети:

- Prisma / `@prisma/client`: `6.19.3` із lockfile;
- `tsx`: dev-only; production runtime його не потребує;
- `cloudinary`: runtime dependency;
- `tesseract.js`: runtime dependency;
- `tesseract.js-core`: транзитивно доступний і трасується;
- `sharp`: Next.js runtime dependency;
- `node-telegram-bot-api`: runtime dependency;
- Next.js: `15.5.19` із lockfile;
- Auth.js / `next-auth`: `5.0.0-beta.31` із lockfile;
- PDFKit: runtime dependency.

`npm ci --no-audit --no-fund` завершився успішно. Dependency upgrade або
`npm audit fix` не виконувалися.

## 11. Production artifact compatibility

Production workflow збережений і виконує:

```text
npm ci → lint → typecheck → build → deterministic archive
→ VPS npm ci --omit=dev → prisma migrate deploy → PM2 reload → health check
```

Сумісність:

- `prisma` і `dotenv` доступні після `--omit=dev`;
- artifact містить `.next`, `public`, `prisma`, manifests, configs і PM2 config;
- `.next/cache`, `.env*`, uploads, logs, coverage і private keys виключені;
- uploads лишаються shared symlink;
- `public` включає SEO icons та logistics/about assets;
- `next.config.ts` має `serverExternalPackages` для Tesseract;
- output tracing охоплює Tesseract worker/core для `/api/ocr` і
  `/admin/requests/[id]`;
- production build створив 57 routes, включно з OCR, logistics,
  `robots.txt` і `sitemap.xml`;
- Cloudinary runtime не залежить від local dev path;
- `next start` працює зі standard `.next` artifact strategy.

Production artifact фактично не формувався і не завантажувався на VPS у цьому
етапі; локальний `next build` є readiness evidence, не live runtime proof.

## 12. Merge conflicts

`git merge --no-ff origin/develop` дав рівно один conflict:

```text
package.json
```

Причина:

- `main` додав production ADMIN scripts і runtime placement Prisma/dotenv;
- `develop` у тому самому scripts block додав 26 regression scripts та
  storage migration/audit scripts.

`package-lock.json`, `next.config.ts`, redirect files і production
infrastructure змерджилися автоматично.

## 13. Conflict resolution decisions

У `package.json` збережено:

- `admin:bootstrap`;
- `admin:bootstrap:check`;
- усі develop `test:*` scripts;
- `auth:redirect-origin:check`;
- storage audit/migration scripts;
- `prisma` і `dotenv` у runtime `dependencies`;
- усі інші develop runtime dependencies.

Глобальні `ours`/`theirs` не використовувалися. Lockfile вручну не
редагувався і пройшов `npm ci`.

Після першого regression run виправлено лише три check scripts:

- invoice та Stage 4C2 checks стали tolerant до LF/CRLF;
- logistics check синхронізовано з навмисним removal feature flags,
  individual pricing contract і актуальними surcharges.

Application/production runtime code цими follow-up змінами не змінювався.

## 14. Integration branch state

Гілка:

```text
release/develop-to-main-20260731
```

Створена від актуального `origin/main`. Merge commit:

```text
1ef90ad Merge remote-tracking branch 'origin/develop' into release/develop-to-main-20260731
```

`main` і `develop` локально не переписувалися. Push не виконувався.

## 15. Prisma validation/generate

На фінальному merge result:

```text
npx prisma validate → PASS
npx prisma generate → PASS
Prisma Client 6.19.3
```

Команди читали локальні env files через Prisma config, але не виконували DB
connection або schema mutation.

## 16. Staging migration rehearsal

Не виконувалося:

```text
prisma migrate status
prisma migrate deploy
```

Причина: локальні `DATABASE_URL` і `DATABASE_URL_UNPOOLED` присутні, але їхня
належність до погодженої staging/test DB не була однозначно підтверджена.
Значення URL або credentials не виводилися. Production DB не
використовувалася.

Це обов’язковий gate перед merge у `main`.

## 17. Regression checks

Фінальний суцільний run:

```text
TOTAL=26 PASS=26 FAIL=0
```

PASS:

- `test:request-status` і всі Stage 3, 4C–4D, 5–5A3, 6 variants;
- `test:request-selection-batch`;
- approval Stage 3, 4, 6 і UI 1/2;
- `test:invoice-presentation`;
- client vehicle documents Stage 2/3;
- OCR storage Stage 2;
- OCR runtime Stage 3;
- SEO crawl foundation;
- logistics address combobox/request form.

Окремо:

```text
auth:redirect-origin:check → PASS
```

Не запускалися:

- `admin:bootstrap` — mutation і production-specific operation;
- `admin:bootstrap:check` — DB identity не підтверджена;
- `audit:request-file-storage` — потребує погодженого DB/filesystem context;
- `migrate:request-files-cloudinary` — mutating migration tool;
- `db:seed` — заборонено.

## 18. Lint/typecheck/build

Фінальні результати:

```text
npm ci       PASS
npm run lint PASS
npm run typecheck PASS
npm run build PASS
```

Build:

- Next.js `15.5.19`;
- 57 routes;
- `robots.txt` і `sitemap.xml` generated;
- middleware compiled;
- OCR/logistics/admin/client routes compiled.

## 19. Known vulnerabilities

Read-only `npm audit --omit=dev --json`:

```text
info=0 low=0 moderate=0 high=5 critical=2 total=7
```

Affected runtime graph:

- critical: `@auth/core`, `next-auth`;
- high: `@auth/prisma-adapter`, `next`, `postcss`, `sanitize-html`, `sharp`.

Audit повідомив `fixAvailable=true` лише для `sharp`; для інших findings
автоматичний fix недоступний. `npm audit fix` не запускався.

Lockfile versions цих пакетів однакові в `origin/main`, `origin/develop` і
merge result, тому findings не введені цим merge. Вони все одно потребують
окремого security/dependency upgrade етапу та risk triage до production
release.

## 20. Production backup requirements

Baseline dump, створений до production smoke testing, не замінює current
pre-release backup.

Перед production deploy необхідно:

1. створити новий consistent `pg_dump` поточної production DB;
2. перевірити exit code, розмір і checksum;
3. скопіювати dump поза VPS;
4. перевірити можливість прочитати archive metadata;
5. зафіксувати applied migration list;
6. окремо зафіксувати row counts `Document` і `RequestFile`.

## 21. Rollback limitations

`scripts/rollback-production.sh` перемикає лише application code release.
Prisma migrations є forward-only і автоматично не відкочуються.

Після успішного `prisma migrate deploy` rollback на старий code artifact може
бути несумісним зі зміненою schema. Для HIGH backfill migrations потрібен
restore plan із current dump, окреме рішення оператора та downtime window.

## 22. Files changed by rehearsal

Merge commit відносно `origin/main`:

```text
278 files
198 added
80 modified
0 deleted
0 renamed
```

Audit-only follow-up:

- `scripts/check-invoice-presentation.ts`;
- `scripts/check-request-status-stage4c2-transaction-feedback.ts`;
- `scripts/check-logistics-request-form.ts`;
- `docs/reports/develop-to-main-production-release-audit.md`.

Unrelated files не редагувалися. Production infrastructure files не
модифікувалися follow-up commit-ом.

## 23. Readiness decision

**READY FOR STAGING VALIDATION**

Обґрунтування:

- merge rehearsal завершено;
- production infrastructure, redirect fix і Vercel policy збережені;
- migration history не розходиться;
- dependency/runtime artifact contract узгоджений;
- lint, typecheck, build, Prisma validation/generate — PASS;
- усі 26 regression scripts — PASS.

Це ще не `READY FOR MAIN MERGE`, бо staging migration/runtime validation,
security triage і current production backup не завершені.

## 24. Exact next-step checklist

1. Review integration branch.
2. Push integration branch.
3. Validate Vercel staging.
4. Підтвердити safe metadata погодженої staging/test DB.
5. Виконати `prisma migrate status`.
6. Виконати `prisma migrate deploy` на staging/test DB.
7. Повторити `prisma migrate status` і regression/runtime smoke.
8. Triage 2 critical і 5 high runtime dependency findings.
9. Create current production `pg_dump`.
10. Copy dump off VPS.
11. Merge integration branch into `main`.
12. Run full `main` checks.
13. Push `main`.
14. Manually run `Deploy Production`.
15. Verify Prisma migrations.
16. Verify PM2.
17. Verify redirects.
18. Verify ADMIN login.
19. Run production smoke tests.

## 25. Blockers

Немає blocker-а для початку staging validation.

До merge у `main` блокують:

1. не виконаний migration rehearsal на однозначно підтвердженій staging/test DB;
2. не виконані Vercel staging runtime smoke tests;
3. не завершений security triage 2 critical і 5 high runtime findings;
4. не створений актуальний pre-release production `pg_dump`;
5. не виконана ручна перевірка HIGH backfills на representative staging data.

Integration branch не push-илася, `main` не змінювався, production не
змінювався.
