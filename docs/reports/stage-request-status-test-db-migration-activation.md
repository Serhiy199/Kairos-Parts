# Stage Request Status — Test database migration activation

## 1. Executive summary

Операцію зупинено на mandatory safety gate до `prisma migrate deploy`.
Окрему test/Preview database не вдалося однозначно ідентифікувати. Vercel
metadata показує один `DATABASE_URL`, scoped одночасно на `production`,
`preview` і `development`, без branch override для `develop`. Pulled Preview
datasource має той самий безпечний URL/Neon-project fingerprint, що й локальний
configured datasource. Тому застосування migrations могло змінити database,
яку використовує Vercel Production.

Жодна migration не застосована, schema/data не змінені.

## 2. Git і branch state

- Branch: `develop`.
- Baseline HEAD: `885ffb93ddbd78fca29cb91206c50071dc7b4dee`.
- Working tree перед preflight: clean.
- `main` не checkout-илася і не змінювалася.
- Migration SQL files tracked у Git.

## 3. Vercel environment identity

Linked project:

- project: `kairos-parts`;
- project ID: `prj_YIWQSdRXmSNAP6pcepoz7YCfW3v7`;
- team ID: `team_Q4tt0g8CoJoV4SNQirt12UQf`;
- CLI authentication: confirmed;
- CLI version: `57.0.0`.

Vercel project/deployment metadata показало, що актуальні deployment-и branch
`develop` мають `target=production`, а не Preview. Preview variables були
pulled окремо через:

```text
npx.cmd vercel@latest env pull .env.vercel-preview.local --environment=preview --yes --scope sergiys-projects-c8c24309
```

Production env не pull-ився. Тимчасовий Preview env був gitignored і видалений
після preflight.

## 4. Test database identity

Безпечні компоненти pulled Preview datasource:

- provider: Neon PostgreSQL;
- host: `ep-wandering-thunder-aszf0fwz-pooler.c-4.eu-central-1.aws.neon.tech`;
- endpoint identifier: `ep-wandering-thunder-aszf0fwz-pooler`;
- database: `neondb`;
- schema: `public`;
- port: PostgreSQL default.

Read-only SQL підтвердив `current_database()=neondb`,
`current_schema()=public`, port `5432`. Database username, password і full URL
не виводилися.

## 5. Production isolation evidence

Production isolation **не підтверджена**:

1. `vercel env ls --format json` повернув один encrypted `DATABASE_URL` entry з
   targets `production`, `preview`, `development`.
2. Окремого `preview/develop` override немає.
3. Preview URL fingerprint повністю збігається з existing local datasource
   fingerprint.
4. Preview `DATABASE_NEON_PROJECT_ID` fingerprint також збігається.
5. Branch `develop` зараз деплоїться Vercel як `target=production`.

Це достатній STOP-сигнал: datasource не можна назвати isolated test DB.

## 6. Backup / restore readiness

Vercel Marketplace metadata показує два available Neon resources:

- `kairos-parts-db`;
- `kairos-parts-staging`.

Однак env metadata не зіставляє Preview `DATABASE_URL` з
`kairos-parts-staging`; навпаки, чинний database binding спільний для всіх
targets. Branch identity, disposable status і конкретний restore point для
pulled datasource не підтверджені. `pg_dump` не створювався, бо deployment gate
вже завершився STOP і production-shared datasource не можна використовувати як
test target.

## 7. Baseline migration status

Read-only `npx.cmd prisma migrate status`:

- 38 migrations у repository;
- 36 applied records у `_prisma_migrations`;
- unfinished/failed active records: `0`;
- target applied records: `0`;
- pending:
  - `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses`;
  - `20260727183000_add_request_selection_batch_foundation`.

Exit code `1` є очікуваним для pending state.

## 8. Migration SQL review

Stage 2 SQL є additive і містить лише:

```sql
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_INVOICE';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SENT';
```

Stage 4B SQL additive: створює batch enums/tables/indexes/FKs, додає
`Request.selectionRevisionCounter INTEGER NOT NULL DEFAULT 0` та partial unique
index:

```sql
CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"
  ON "RequestSelectionBatch"("requestId")
  WHERE "status" = 'SENT';
```

`DROP`, data cleanup, truncate або destructive rewrite відсутні.

## 9. Applied migrations

Не застосовано. Команда:

```text
npx.cmd prisma migrate deploy
```

навмисно **не запускалася**, оскільки test database identity не доведена.

## 10. Post-deploy Prisma status

Не застосовується: deploy не виконувався. Baseline status залишається з двома
pending migrations.

## 11. Stage 2 enum verification

Post-deploy verification не виконувалася. Target migration відсутня в
`_prisma_migrations`, тому `AWAITING_INVOICE` та `INVOICE_SENT` не заявляються
як deployed у цій database.

## 12. Stage 4B tables and columns

Read-only baseline SQL підтвердив:

- `RequestSelectionBatch` відсутня;
- `RequestSelectionBatchItem` відсутня;
- `Request.selectionRevisionCounter` відсутня.

Це узгоджується з pending Stage 4B migration.

## 13. Enums and constraints

Post-deploy batch enum/constraint verification не виконувалася, оскільки
migration не застосована.

## 14. Partial unique index verification

Migration SQL містить правильний partial unique index. Real database index
відсутній до deploy; deployed index не заявляється.

## 15. Real-DB transaction test

Не виконувався. DML навіть із `ROLLBACK` заборонено до підтвердження isolated
test database. Існуючі business records не використовувалися.

## 16. Existing Request counter verification

Не застосовується до поточної schema: column ще не існує. Backfill або ручний
SQL не виконувався.

## 17. Application regression checks

- `npx.cmd prisma validate`: PASS.
- `npx.cmd prisma generate`: PASS.
- Post-migration Stage 2–4D, Audit Log 2–5, lint/typecheck/build: NOT RUN,
  оскільки migration deployment був заблокований до mutation.

Mock/static suites не позначаються як real-DB verification.

## 18. Vercel test deployment readiness

NO-GO. Окремий Neon resource із назвою `kairos-parts-staging` існує, але не
доведено, що Preview/develop deployment використовує його. Поточний
`DATABASE_URL` binding охоплює Production/Preview/Development, а develop
deployment має production target.

Потрібно:

1. прив'язати `kairos-parts-staging` лише до Preview/develop;
2. створити branch-scoped Preview `DATABASE_URL` override;
3. підтвердити інший endpoint/project fingerprint;
4. підтвердити disposable branch або restore point;
5. повторити цей preflight.

## 19. Database safety

- `migrate deploy/dev/reset`, `db push`, `seed`, `resolve`: не запускалися.
- SQL writes/DML: не виконувалися.
- Production env не pull-ився.
- Full URLs, credentials, tokens і DB username не логувалися.
- Preview env-файл був ignored, не staged і видалений.
- Backup/dump files не створювалися.

## 20. Known limitations

- Vercel metadata не показало resource-to-env mapping для двох Neon resources.
- Neon branch identity/restore point не підтверджені.
- Post-deploy schema та runtime checks закономірно відсутні.
- Existing local/Preview datasource використовується також Production target,
  тому його не можна вважати test database.

## 21. Production deployment blockers

Mandatory blocker: database environment isolation. До будь-якого deploy
потрібен окремий branch-scoped Preview datasource, який не використовується
Production. Після цього потрібні backup/restore proof, baseline status і лише
тоді окремий `prisma migrate deploy`.

## 22. Final conclusion

Safety objective виконано, migration activation — ні. Prompt вимагав `STOP`,
якщо test identity неможливо однозначно довести; саме ця умова настала.
Production/shared database не змінена. Stage Request Status Automation 5
залишається runtime-blocked до коректного Preview database binding і
застосування двох migrations у справді isolated test environment.
