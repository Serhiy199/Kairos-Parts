# Kairos Parts — Vercel test DB Stage 2/4B migration activation

Дата виконання: 2026-07-28.

## 1. Executive summary

Stage 2 і Stage 4B migrations успішно застосовано до погодженої test/integration database `kairos-parts-db`, яку використовує Vercel Production target гілки `develop`.

Safety gates пройдені до mutation:

- datasource endpoint точно збігся з `ep-wandering-thunder-aszf0fwz`;
- Vercel і Neon dashboards підтвердили resource/project `kairos-parts-db`;
- owner-provided manual proof зіставив цей endpoint із `kairos-parts-db` і відрізнив його від `kairos-parts-staging`;
- до deploy створено окрему Neon restore branch від `main`;
- baseline мав рівно 36 applied і дві очікувані pending migrations без unfinished/failed rows;
- migration SQL additive і non-destructive.

`npx.cmd prisma migrate deploy` застосував migrations у правильному порядку. Post-deploy стан — 38/38 successful, schema up to date. Stage 2 enums, Stage 4B enums/tables/counter/FKs/checks/indices і partial unique index підтверджені SQL. Real-DB invariant test пройшов у transaction із повним `ROLLBACK`; test records не залишилися.

VPS database, `main`, Vercel bindings і `kairos-parts-staging` не змінювалися. Manual redeploy не виконувався.

## 2. Git і branch state

Pre-check:

```text
branch: develop
HEAD: 727fc2b9cee151a12fd92eb22f22bfe1c30fb405
working tree: clean
main: 055200959f2ed8e1be628d46e91265f23cc93e61
```

У `HEAD` підтверджено ancestry required commits:

```text
73d77d952c34851ba572e52f8a6dce57f38b95cd
c4f4c82427015b8b4c96acfa71068261c0246491
1048546801aa2f9944f3e7be5ee9c10e7225a160
73b3491ed9539441a8484656d04a22df42edaa9f
885ffb93ddbd78fca29cb91206c50071dc7b4dee
```

Останні docs-only audit commits також присутні:

```text
135807f docs: record test database migration activation
727fc2b docs: audit deployment and database topology
```

`main` не checkout-илась і її ref не змінювався.

## 3. Vercel develop topology

Підтверджена topology:

```text
develop
→ Vercel project kairos-parts
→ Vercel target production
→ *.vercel.app
→ Neon kairos-parts-db
→ endpoint ep-wandering-thunder-aszf0fwz
→ neondb / public
```

Linked identifiers:

```text
project: kairos-parts
project ID: prj_YIWQSdRXmSNAP6pcepoz7YCfW3v7
team ID: team_Q4tt0g8CoJoV4SNQirt12UQf
Vercel resource ID: store_663bA6A698ci2hds
Neon project ID: wispy-union-45179062
```

Live Vercel integration inspection показав resource `kairos-parts-db` як `Available`, `Owned`, product `Neon`, connected to `kairos-parts`.

## 4. Manual Neon endpoint proof

Owner вручну перевірив Neon Dashboard → Connect і надав mapping:

```text
kairos-parts-db
→ ep-wandering-thunder-aszf0fwz-pooler.c-4.eu-central-1.aws.neon.tech

kairos-parts-staging
→ ep-purple-king-as4ibhd1-pooler.c-4.eu-central-1.aws.neon.tech
```

Під час цього task live Neon dashboard для `kairos-parts-db` додатково показав:

```text
project: kairos-parts-db
project ID: wispy-union-45179062
default branch: main
main branch ID: br-shy-scene-asvlr6d1
primary compute: ep-wandering-thunder-aszf0fwz
```

Таким чином endpoint-to-project mapping підтверджений owner evidence, Vercel resource metadata і live Neon project metadata.

## 5. Confirmed kairos-parts-db identity

Fail-closed URL parsing і read-only SQL повернули:

```text
provider: Neon PostgreSQL
pooled host: ep-wandering-thunder-aszf0fwz-pooler.c-4.eu-central-1.aws.neon.tech
direct host: ep-wandering-thunder-aszf0fwz.c-4.eu-central-1.aws.neon.tech
endpoint fingerprint: ep-wandering-thunder-aszf0fwz
port: 5432
database: neondb
schema: public
database user: n***
PostgreSQL: 17.10
```

Server address у SQL identity був Neon-internal `169.254.254.254`; це не VPS loopback `127.0.0.1`.

Vercel `production` env pull у новий temporary file не виконувався: platform security gate заблокував retrieval усіх unrelated production secrets як надмірний scope. Замість обходу використано наявний ignored `.env.local`, чий endpoint повторно звірено з live Vercel/Neon metadata та owner proof. Нового env-файлу не створено.

## 6. Restore point / backup

До migration deploy у Neon створено data-and-schema branch:

```text
name: pre-stage-2-4b-migrations-20260728
branch ID: br-curly-paper-asnsokes
parent: main
parent branch ID: br-shy-scene-asvlr6d1
created: 2026-07-28 11:51:11 +03:00
auto-delete: Never
```

Branch створена з поточного стану `kairos-parts-db/main` до застосування migrations. Вона не підключалася до Vercel project/runtime. Neon показав її як child branch з нульовим storage delta одразу після створення.

Local `pg_dump` не використовувався, оскільки пріоритетна Neon branch була доступна й успішно створена.

## 7. Migration SQL review

Tracked files:

```text
prisma/migrations/20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses/migration.sql
prisma/migrations/20260727183000_add_request_selection_batch_foundation/migration.sql
```

Stage 2 містить лише:

```sql
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_INVOICE';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SENT';
```

Stage 4B additive:

- створює `RequestSelectionBatchStatus` і `RequestSelectionBatchItemStatus`;
- додає Audit Log enum values;
- додає `Request.selectionRevisionCounter INTEGER NOT NULL DEFAULT 0`;
- створює `RequestSelectionBatch` і `RequestSelectionBatchItem`;
- додає checks, foreign keys, regular/unique indices;
- створює unique `(requestId, revision)`;
- створює partial unique `SENT` index.

`DROP`, `TRUNCATE`, destructive enum operations, DML cleanup, manual backfill і default status changes відсутні. Existing migration SQL не редагувався.

## 8. Baseline migration state

До deploy:

```text
repository migrations: 38
_prisma_migrations rows: 36
applied: 36
unfinished/failed: 0
rolled back: 0
target applied: 0
last applied: 20260723120000_add_auth_audit_events
```

Pending були рівно:

```text
20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses
20260727183000_add_request_selection_batch_foundation
```

`npx.cmd prisma migrate status` завершився expected exit code `1` лише через ці дві pending migrations.

## 9. Baseline schema state

До deploy read-only SQL підтвердив:

```text
RequestStatus.AWAITING_INVOICE: absent
RequestStatus.INVOICE_SENT: absent
RequestSelectionBatch: absent
RequestSelectionBatchItem: absent
Request.selectionRevisionCounter: absent
```

Це повністю відповідало очікуваному pre-migration baseline.

## 10. Migration deploy

Виконана команда:

```text
npx.cmd prisma migrate deploy
```

Datasource у Prisma output:

```text
PostgreSQL neondb / public
ep-wandering-thunder-aszf0fwz.c-4.eu-central-1.aws.neon.tech
```

Порядок:

```text
1. 20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses
2. 20260727183000_add_request_selection_batch_foundation
```

Prisma result:

```text
All migrations have been successfully applied.
```

`migrate dev`, `db push`, `migrate reset`, `seed`, `migrate resolve` і manual DDL не запускалися.

## 11. Post-deploy Prisma status

Повторна команда:

```text
npx.cmd prisma migrate status
```

Результат:

```text
38 migrations found
Database schema is up to date!
```

## 12. _prisma_migrations verification

Post-deploy:

```text
total: 38
applied: 38
unfinished: 0
rolled back: 0
```

Target rows:

| Migration | Started UTC | Finished UTC | rolled_back_at | logs |
|---|---|---|---|---|
| `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses` | `2026-07-28T08:54:11.809Z` | `2026-07-28T08:54:12.014Z` | `NULL` | `NULL` |
| `20260727183000_add_request_selection_batch_foundation` | `2026-07-28T08:54:12.088Z` | `2026-07-28T08:54:12.392Z` | `NULL` | `NULL` |

## 13. Stage 2 RequestStatus enum verification

Усі existing values збережені. Post-deploy enum:

```text
NEW
IN_PROGRESS
OFFER_PREPARING
WAITING_APPROVAL
ORDERED
IN_DELIVERY
COMPLETED
CANCELLED
AWAITING_SHIPMENT
AWAITING_INVOICE
INVOICE_SENT
```

`AWAITING_INVOICE` і `INVOICE_SENT` присутні.

## 14. Stage 4B enums verification

`RequestSelectionBatchStatus`:

```text
DRAFT
SENT
APPROVED
REJECTED
SUPERSEDED
```

`RequestSelectionBatchItemStatus`:

```text
PENDING
APPROVED
REJECTED
```

## 15. Request selection tables

`to_regclass` підтвердив:

```text
"RequestSelectionBatch"
"RequestSelectionBatchItem"
```

Через `information_schema.columns` звірено всі batch/item columns, включно з typed snapshot fields, lifecycle timestamps, source/decision relations, hashes, prices, vehicle snapshots та timestamps.

## 16. Request selectionRevisionCounter

Column:

```text
name: selectionRevisionCounter
type: integer
nullable: NO
default: 0
check: selectionRevisionCounter >= 0
```

Manual backfill не виконувався.

## 17. Constraints and foreign keys

Підтверджено:

- `RequestSelectionBatch.requestId → Request.id`, `ON DELETE CASCADE`;
- `createdByUserId → User.id`, `ON DELETE SET NULL`;
- `RequestSelectionBatchItem.batchId → RequestSelectionBatch.id`, `ON DELETE CASCADE`;
- nullable `sourceRequestItemId → RequestItem.id`, `ON DELETE SET NULL`;
- nullable `decisionByUserId → User.id`, `ON DELETE SET NULL`;
- primary keys;
- unique `(requestId, revision)`;
- unique `(batchId, position)`;
- unique `(batchId, sourceRequestItemId)`;
- revision/position/quantity/non-negative-price/schema-version/hash checks.

## 18. Partial unique SENT index

DB index definition:

```sql
CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"
ON public."RequestSelectionBatch" USING btree ("requestId")
WHERE (status = 'SENT'::"RequestSelectionBatchStatus");
```

Це підтверджує expected `UNIQUE(requestId) WHERE status='SENT'` semantics.

## 19. Real-DB transaction test

Isolated test виконав:

```text
BEGIN
→ insert isolated Request
→ insert two DRAFT batches
→ first DRAFT → SENT
→ second DRAFT → SENT rejected with PostgreSQL 23505
→ first SENT → SUPERSEDED
→ second DRAFT → SENT succeeds
→ ROLLBACK
```

Result:

```text
two DRAFT allowed: PASS
first SENT allowed: PASS
duplicate SENT rejected: PASS
SENT after SUPERSEDED allowed: PASS
transaction rolled back: PASS
remaining Request rows: 0
remaining batch rows: 0
```

Реальні business requests не використовувалися.

## 20. Existing Request compatibility

Post-migration aggregate:

```text
total_requests: 33
null_counter_count: 0
min_counter: 0
max_counter: 0
non_zero_counter_count: 0
```

Усі 33 existing Requests отримали сумісний non-null default `0`. Fake batches/revisions не створювалися.

## 21. Regression tests

PASS:

```text
npm.cmd run test:request-status
npm.cmd run test:request-status-stage3
npm.cmd run test:request-selection-batch
npm.cmd run test:request-status-stage4c
npm.cmd run test:request-status-stage4d
```

Stage 4D result: `24/24`.

Audit Log regressions PASS:

```text
npx.cmd tsx scripts/check-admin-audit-log-2.ts
npx.cmd tsx scripts/check-admin-audit-log-3.ts
npx.cmd tsx scripts/check-admin-audit-log-4.ts
npx.cmd tsx scripts/check-admin-audit-log-5.ts
```

## 22. Build and static checks

PASS:

```text
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Next.js `15.5.19` build compiled successfully і згенерував усі 46 static pages. Generated Prisma Client залишився лише в ignored `node_modules`.

## 23. Vercel runtime readiness

Live deployment listing після migration:

```text
branch: develop
target: production
state: READY
commit: 727fc2b9cee151a12fd92eb22f22bfe1c30fb405
message: docs: audit deployment and database topology
```

Цей commit містить Stage 2–4D code, обидві migration directories і актуальну Prisma schema. Vercel build уже згенерував runtime artifact із цієї schema. DB тепер 38/38.

Manual redeploy не потрібен і не виконувався. Runtime готовий до окремого authenticated browser smoke.

## 24. VPS isolation confirmation

Попередній topology audit підтвердив:

```text
Vercel: remote Neon / neondb / ep-wandering-thunder-aszf0fwz
VPS: local PostgreSQL / kairos_parts / 127.0.0.1:5432
```

Усі mutation commands цього task використовували exact Neon direct host. SSH/VPS write operations, PM2 restart, Nginx changes і VPS migrations не виконувалися.

## 25. Database safety

- Target identity перевірена до deploy і повторно в post-deploy output.
- Restore branch створена до першої schema mutation.
- Застосовано рівно дві tracked migrations через Prisma.
- Manual DDL/DML поза isolated rolled-back index test не виконувались.
- Index test не залишив records.
- `kairos-parts-staging` не підключалася й не змінювалася.
- Vercel environment variables/resource bindings не змінювалися.
- Secrets, passwords і full URLs не виводились та не записувались у tracked files.

## 26. Known limitations

- Vercel Production env pull у новий temporary file був заблокований через надмірний unrelated-secret scope; identity доведено наявним ignored datasource, live Vercel/Neon metadata та owner manual mapping.
- Authenticated browser flow не запускався: credentials/session не входили в task.
- Optional full application DB-backed lifecycle smoke не запускався; real PostgreSQL invariant перевірено спеціалізованим isolated transaction test.
- Restore branch існує як rollback source, але destructive restore rehearsal не виконувався.
- VPS migration state не перечитувався повторно, оскільки жодна команда до VPS не виконувалась і physical isolation уже доведена окремим audit.

## 27. Next authenticated smoke task

Окреме завдання з погодженими test credentials має перевірити на Vercel:

1. staff створює/редагує selection draft;
2. Request переходить `NEW → IN_PROGRESS`;
3. staff надсилає immutable batch;
4. Request переходить `IN_PROGRESS → WAITING_APPROVAL`;
5. client бачить саме active `SENT` snapshot;
6. legacy mutable rows не змінюють batch UI;
7. повторний send і supersede obey active-cycle invariant;
8. Audit Log не містить PII/secrets.

## 28. Stage 5 readiness

```text
Stage 5 local development: READY
Stage 5 Vercel runtime testing: READY після окремого authenticated Stage 3–4D browser smoke
Stage 5 VPS/production activation: NOT AUTHORIZED / NOT READY
```

Stage 5 у межах цього task не починався.

## 29. Final conclusion

`kairos-parts-db` однозначно підтверджена як погоджена Vercel `develop` test/integration database. Restore branch `br-curly-paper-asnsokes` зберігає pre-migration state. Stage 2 і Stage 4B migrations застосовані штатно, `_prisma_migrations` має 38 successful rows, schema up to date, а real-DB partial unique invariant працює.

Application regressions, Audit Log regressions, lint, typecheck і build пройшли. Current Vercel deployment уже містить потрібний код і готовий до окремого authenticated browser smoke. VPS, `main`, `kairos-parts-staging`, Vercel configuration та real business records не змінювалися.
