# Kairos Parts — Stage Logistics 4A

## 1. Мета етапу

Контрольовано активувати migration `20260729120000_add_logistics_persistence_foundation` лише у PostgreSQL БД, яка обслуговує Vercel staging для гілки `develop`, попередньо створивши backup і не змінюючи application code.

Результат: migration успішно застосована; Stage Logistics 5 не починався.

## 2. Початковий Git-стан

- Основний worktree: `D:\Copy_WSL_Project\Kairos Parts`.
- Активна гілка: `develop`.
- Початковий `HEAD`: `9b668efff1ea71b658065faa64a3f93b0975aaa1` (`feat: add logistics public request form`).
- Stage Logistics 3 commit: `42919844a01a573365f76b778ae04539fbbbaef8`.
- Staging area до початку був порожній.
- Паралельні зміни `package.json` і `docs/reports/stage-request-status-automation-5a3b-logistics-build-stabilization.md` залишалися поза staging та не використовувалися для activation.

## 3. Clean activation worktree

- Detached worktree: `C:\Users\Admin\AppData\Local\Temp\Kairos-Logistics-4A-Activation`.
- Commit: `9b668efff1ea71b658065faa64a3f93b0975aaa1`.
- Git-команди у worktree виконувалися з per-command `safe.directory`; global Git config не змінювався.
- Dependencies не встановлювалися. Для перевірок використано вже наявний dependency tree; для фінального build його копію розміщено лише в ignored `node_modules` тимчасового worktree.
- Runtime-код у clean worktree не редагувався.
- Після завершення перевірок clean worktree видалено командою `git worktree remove`; metadata очищено через `git worktree prune`.

## 4. Staging environment source

Environment отримано з наявного ignored локального `.env.local` та звірено з repository topology reports, Vercel project metadata і Neon console.

Підтверджено:

- Vercel project: `kairos-parts`;
- Vercel project ID: `prj_YIWQSdRXmSNAP6pcepoz7YCfW3v7`;
- Vercel `productionBranch`: `develop`;
- latest READY Vercel deployment належав гілці `develop`;
- deployment SHA на момент перевірки: `f5357e9d4bd5c103e11858ed47c016515d62de2a`;
- пов’язаний Neon project: `kairos-parts-db`;
- Neon project ID: `wispy-union-45179062`;
- target Neon branch: `main`, ID `br-shy-scene-asvlr6d1`.

У цьому проєкті Vercel target `production` є business staging/test-контуром гілки `develop`; VPS production працює з `main` та іншою PostgreSQL topology.

## 5. Masked database identity

- Provider: Neon PostgreSQL.
- Host: `ep-wandering-thunder-****.c-4.eu-central-1.aws.neon.tech` (direct, non-pooler).
- Port: `5432`.
- Database: `neondb`.
- User: `n***`.
- SSL mode: `require`.
- PostgreSQL: `17.10`.
- Read-only SQL підтвердив `current_database() = neondb`, порт `5432` і замаскованого користувача.
- Connection fingerprint без пароля: `sha256:a533048beb4bc05fe6f0b82236a9bd545864de5fa3e84e8cea539745713cb4a2`.

Target не є VPS production: host належить Neon, тоді як задокументована VPS production БД є локальним для VPS PostgreSQL на `127.0.0.1:5432`, database `kairos_parts`.

## 6. Prisma connection configuration

- `prisma.config.ts` завантажує `.env`, потім `.env.local`.
- `prisma/schema.prisma` використовує `DATABASE_URL` як pooled runtime URL і `DATABASE_URL_UNPOOLED` як `directUrl`.
- Для migration CLI використано наявний `DATABASE_URL_UNPOOLED`, що вказує на direct Neon endpoint.
- Config, schema та env-файли не змінювалися; secret values не друкувалися й не додавалися до Git.

## 7. Migration artifact review

Migration із Stage Logistics 3 не змінювалася між commit `42919844a01a573365f76b778ae04539fbbbaef8` і activation `HEAD`.

Повторний review підтвердив additive artifact:

- три Logistics enums;
- мінімальні Logistics values у `AuditEntityType` і `AuditAction`;
- sequence `logistics_request_number_seq`;
- чотири погоджені таблиці;
- FK, check constraints та indexes;
- рівно 13 одноразових tariff inserts.

Пошук не виявив `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, destructive `ALTER COLUMN`, coordinates, maps або routes. Migration не містить secrets і не змінює Telegram або Notification data.

Pre-activation checks:

- `check-logistics-persistence-foundation.ts`: PASS (`models=4`, `cities=13`, `constraints=7`);
- `check-logistics-address-provider.ts`: PASS (`cities=13`, `errorCodes=9`);
- `check-logistics-request-form.ts`: PASS (`cities=13`, `formulaCases=5`, `submit=disabled`);
- `prisma validate`: PASS;
- `prisma generate`: PASS.

## 8. Pre-migration migrate status

`prisma migrate status` знайшов 42 repository migrations. Єдиною unapplied migration була:

```text
20260729120000_add_logistics_persistence_foundation
```

Failed migrations, history divergence, modified-applied migrations або unknown migration records не виявлено.

## 9. Pending migration set

Повний pending set складався рівно з одного елемента:

```text
20260729120000_add_logistics_persistence_foundation
```

Тому `prisma migrate deploy`, який застосовує всі pending migrations, не міг захопити сторонню migration.

## 10. Pre-migration baseline

Migration metadata:

- `_prisma_migrations`: 41 records;
- applied/finished: 41;
- unfinished: 0;
- rolled back: 0;
- target migration records: 0.

Останні migrations були завершені; найновіша перед activation — `20260728151000_add_invoice_selection_provenance`.

Core row counts:

| Table | Before |
| --- | ---: |
| `User` | 10 |
| `ClientProfile` | 6 |
| `Company` | 1 |
| `CompanyMember` | 1 |
| `Request` | 41 |
| `RequestItem` | 43 |
| `Notification` | 38 |
| `AuditLog` | 191 |

До migration `LogisticsTariffCity`, `LogisticsRequest`, `LogisticsPickupPoint`, `LogisticsInternalComment` і `logistics_request_number_seq` були відсутні. Drift не виявлено. PII не читалася.

## 11. Backup

Використано provider-native Neon branch snapshot, оскільки локальні `pg_dump`/`pg_restore` не були встановлені.

- Provider path: Neon project `wispy-union-45179062` / branch `br-fancy-resonance-asnzk8e8`.
- Branch name: `pre-logistics-4a-20260729-072941`.
- Parent: `main` (`br-shy-scene-asvlr6d1`).
- Method: Neon branch data and schema at current point in time.
- Created: `2026-07-29 07:30:11 +03:00`.
- Auto-delete: `Never`.
- Provider result: branch forked successfully in `0.55 s`.
- Size at creation: `0 kB`; storage delta: `0 kB` (Neon copy-on-write branch metric).
- Local file path: N/A — provider-native branch, local dump artifact не створювався.
- Local SHA-256: N/A — provider-native branch не має локального dump-файлу.

Backup branch повторно перевірено після activation. Password не відкривався й не копіювався. Backup не додано до Git і не відновлювався.

## 12. Activation gate

- [x] Target — Vercel/`develop` staging DB.
- [x] Production VPS не є target.
- [x] Clean detached worktree на Stage Logistics 4 commit.
- [x] Migration artifact не змінений.
- [x] Stage 2/3/4 checks PASS.
- [x] `prisma validate` PASS.
- [x] `prisma generate` PASS.
- [x] Migration history без divergence/failure.
- [x] Pending лише Logistics migration.
- [x] Backup створено й перевірено.
- [x] Baseline counts зафіксовано.

Усі activation gates були підтверджені до write-команди.

## 13. Migration deploy

Єдина DB mutation:

```text
prisma migrate deploy
```

Результат:

- exit code: `0`;
- duration: `3.439 s`;
- applied migration: `20260729120000_add_logistics_persistence_foundation`;
- Prisma output: `All migrations have been successfully applied`.

Команда не повторювалася. Manual SQL, `migrate resolve`, seed, reset, db push/pull або test inserts не виконувалися.

## 14. Post-migration migrate status

Post-activation `prisma migrate status`:

- 42 repository migrations;
- `Database schema is up to date!`;
- pending migrations: 0;
- failed migrations: 0;
- divergence: не виявлено.

## 15. Applied migration record

Для `20260729120000_add_logistics_persistence_foundation` підтверджено:

- рівно один `_prisma_migrations` record;
- checksum `5bab8c9c05d2e0aa6e778e1272d99d510d6b9fabe423e388aeb7ce90fbe76d75`;
- `finished_at` заданий;
- `rolled_back_at` відсутній;
- `applied_steps_count = 1`;
- migration logs порожні, failure відсутній.

Загальна кількість migration records збільшилася з 41 до 42.

## 16. Enums verification

Підтверджено точні значення:

- `LogisticsRequestStatus`: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- `LogisticsDestinationType`: `KAIROS_BASE`, `FARM`;
- `LogisticsAddressProvider`: `MOCK`, `GOOGLE`.

До `AuditEntityType` додано `LOGISTICS_REQUEST`, `LOGISTICS_TARIFF_CITY`.

До `AuditAction` додано `LOGISTICS_REQUEST_CREATED`, `LOGISTICS_STATUS_CHANGED`, `LOGISTICS_INTERNAL_COMMENT_CREATED`, `LOGISTICS_TARIFF_UPDATED`.

Audit runtime не змінювався.

## 17. Tables, sequence, columns and constraints

Catalog підтвердив таблиці:

- `LogisticsTariffCity` — 7 columns;
- `LogisticsRequest` — 25 columns;
- `LogisticsPickupPoint` — 10 columns;
- `LogisticsInternalComment` — 5 columns.

Підтверджено ownership fields `clientId`/`companyId`; tariff, destination і pricing snapshots; `idempotencyKey`; pickup/farm address-provider snapshots; relation `authorUserId`.

Sequence `logistics_request_number_seq` існує. Default для `LogisticsRequest.requestNumber` формує `'LG-' || lpad(nextval(...), 6, '0')`; sequence не споживався тестовим insert.

Catalog містить 18 constraints, включно з PK/FK та погодженими checks:

- tariff price nonnegative;
- request number format;
- idempotency nonblank;
- canonical phone format;
- pickup count;
- nonnegative money snapshots;
- ownership consistency;
- destination consistency.

Unique idempotency та request-number rules також підтверджені indexes.

## 18. Index verification

Catalog містить 16 indexes разом із primary-key indexes. Підтверджено:

- unique tariff code;
- active tariff;
- unique request number;
- unique idempotency key;
- status/createdAt;
- client/createdAt;
- company/createdAt;
- tariff relation;
- request createdAt;
- pickup request;
- internal comment chronology;
- internal comment author.

Додаткові indexes вручну не створювалися.

## 19. Initial tariff verification

Read-only query повернув рівно 13 active records:

| Code | Name | Price |
| --- | --- | ---: |
| `MYRONIVKA` | Миронівка | 1600.00 |
| `OBUKHIV` | Обухів | 1700.00 |
| `UZYN` | Узин | 1800.00 |
| `VASYLKIV` | Васильків | 2000.00 |
| `BILA_TSERKVA` | Біла Церква | 2200.00 |
| `BORYSPIL` | Бориспіль | 2400.00 |
| `KYIV_RIGHT_BANK` | Київ — правий берег | 2500.00 |
| `KYIV_LEFT_BANK` | Київ — лівий берег | 2600.00 |
| `BROVARY` | Бровари | 2700.00 |
| `IRPIN` | Ірпінь | 2900.00 |
| `BUCHA` | Буча | 2900.00 |
| `BEREZAN` | Березань | 3000.00 |
| `VYSHHOROD` | Вишгород | 3200.00 |

Codes унікальні; Ірпінь і Буча є окремими rows; усі `isActive = true`. Ціни є фінальними VAT-inclusive values. Rows для доплати `500 грн` або додаткових міст відсутні. Seed/upsert не виконувався.

## 20. Existing-data regression

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `User` | 10 | 10 | 0 |
| `ClientProfile` | 6 | 6 | 0 |
| `Company` | 1 | 1 | 0 |
| `CompanyMember` | 1 | 1 | 0 |
| `Request` | 41 | 41 | 0 |
| `RequestItem` | 43 | 43 | 0 |
| `Notification` | 38 | 38 | 0 |
| `AuditLog` | 191 | 191 | 0 |

Нові table counts:

- `LogisticsTariffCity`: 13;
- `LogisticsRequest`: 0;
- `LogisticsPickupPoint`: 0;
- `LogisticsInternalComment`: 0.

Existing business data, Notification records і пов’язані з чинним клієнтським Telegram flow дані не змінилися.

## 21. Static/runtime regression

У clean worktree:

- `prisma generate`: PASS;
- Stage 2 address-provider check: PASS;
- Stage 3 persistence-foundation check: PASS;
- Stage 4 request-form check: PASS, submit remains disabled;
- `eslint .`: PASS;
- `tsc --noEmit`: PASS;
- `next build`: PASS.

Build підтвердив routes `/logistics`, `/logistics/request`, `/api/logistics/addresses/autocomplete` і `/api/logistics/addresses/resolve`. Є лише наявні warnings `jose` про `CompressionStream`/`DecompressionStream` в Edge Runtime; compilation, type validation і static generation завершилися успішно.

Browser runtime QA і створення Logistics request навмисно не виконувалися. Google provider не підключався; Stage 4 mock foundation і disabled submit не змінювалися.

## 22. Security and secret handling

- Повні URLs, passwords, tokens і raw env не виводилися у звіт.
- DB user і hostname замасковані.
- Fingerprint не містить password.
- Neon connection password не відкривався й не копіювався.
- Vercel variables не змінювалися.
- Backup не зберігався в repository.
- PII та business rows не читалися; використовувалися лише aggregate counts.

## 23. Files changed

Єдиний дозволений tracked artifact Stage Logistics 4A:

```text
docs/reports/stage-logistics-4a-staging-migration-activation.md
```

Application code, `prisma/schema.prisma`, migration SQL, scripts, `package.json`, `.env.example`, Google, Telegram, Vercel configuration і VPS configuration не змінювалися цим етапом.

## 24. Verification results

| Verification | Result |
| --- | --- |
| Target identity and Vercel/`develop` binding | PASS |
| Production VPS exclusion | PASS |
| Clean activation worktree | PASS |
| Additive migration review | PASS |
| Stage 2/3/4 checks | PASS |
| `prisma validate` / `prisma generate` | PASS |
| Pending set exactly one target migration | PASS |
| Native backup creation and verification | PASS |
| `prisma migrate deploy` | PASS, exit 0 |
| Post-migration status | PASS, up to date |
| Migration record/catalog verification | PASS |
| Exact 13 tariffs | PASS |
| Existing-data counts unchanged | PASS |
| Lint/typecheck/build | PASS |

## 25. Known limitations

- Backup є provider-native copy-on-write Neon branch, тому локальні dump path, byte size і SHA-256 не застосовні; provider IDs і timestamp є recovery reference.
- Native backup не відновлювався, оскільки restore є окремою destructive дією і не потрібен після успішної activation.
- Browser request submission і runtime DB writes заборонені scope цього етапу.
- Build warnings `jose` існували поза migration scope і не блокують build.

## 26. Production confirmation

Production VPS, production PostgreSQL, `main`, deployment configuration і VPS files не відкривалися для mutation та не змінювалися. Єдина DB mutation виконана на підтвердженому Neon target Vercel/`develop` staging.

Чинний клієнтський Telegram-бот не змінювався. Staff bot не реалізовувався. Google Places не підключався.

## 27. Stage Logistics 5 readiness

Persistence schema активована, migration history clean, тарифи перевірені, existing data не змінилася, static checks і production build пройшли. Blocker для Stage Logistics 5 не виявлено.

Stage Logistics 5 у межах цього етапу не починався.
