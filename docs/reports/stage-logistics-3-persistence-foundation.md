# Kairos Parts — Stage Logistics 3

## 1. Мета етапу

Stage Logistics 3 створює persistence foundation окремого Logistics bounded context: Prisma enums і моделі, additive migration, початкові тарифні міста, snapshots, ownership та внутрішні CRM-коментарі. Runtime-функціонал, форма, pricing, CRM, Google і Telegram не входили до етапу.

## 2. Початковий Git-стан

- Активна гілка: `develop`.
- Stage Logistics 2 підтверджено commit `4bd5d5ad68a63e1669242b5b6b34439ef59d251d`.
- Staging був порожній.
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma.config.ts` і `lib/logistics/tariff-cities.ts` не мали паралельного diff.
- У worktree були сторонні unstaged/untracked application-зміни; вони не редагувалися і не входять до Stage 3.
- До початку та протягом етапу DB-команди не виконувалися.

## 3. Existing Prisma conventions

Використано чинні conventions: `String @id @default(cuid())`, PostgreSQL, `Decimal @db.Decimal(12, 2)`, `createdAt`/`updatedAt`, explicit relation names лише за необхідності, `SetNull` для nullable historical ownership/author relations і `Cascade` для дочірніх aggregate records. Request numbering у наявному bounded context уже спирається на PostgreSQL sequence, тому Logistics використовує окрему race-safe sequence.

## 4. Logistics enums

Додано:

- `LogisticsRequestStatus`: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- `LogisticsDestinationType`: `KAIROS_BASE`, `FARM`;
- `LogisticsAddressProvider`: `MOCK`, `GOOGLE`.

`GOOGLE` є лише допустимим майбутнім snapshot value. Google provider не реалізовано й не підключено.

## 5. LogisticsTariffCity

`LogisticsTariffCity` містить stable unique `code`, display `name`, `price` як `Decimal(12,2)`, `isActive`, timestamps і relation до заявок. DB constraint забороняє від'ємну ціну. Relation із заявкою має `onDelete: Restrict`, тому використане тарифне місто не можна фізично видалити зі знищенням історичного зв'язку.

Coordinates, place ID, tariff revisions, VAT rate, effective dates і доплати `500 грн` не додавалися.

## 6. LogisticsRequest

`LogisticsRequest` містить:

- identity: `id`, `requestNumber`, `status`, timestamps;
- ownership: nullable `clientId`, nullable `companyId`;
- contact snapshots: `contactName`, `contactPhone`;
- tariff relation і snapshots: `tariffCityId`, `tariffCityCodeSnapshot`, `tariffCityNameSnapshot`, `baseTariffSnapshot`;
- destination snapshots;
- pricing snapshots;
- nullable `clientComment`;
- required unique `idempotencyKey`;
- relations до pickup points та internal comments.

Parts-модель `Request` не змінювалася.

## 7. LogisticsPickupPoint

`LogisticsPickupPoint` зберігає required `formattedAddress`, provider-neutral snapshot `addressProvider`, nullable `externalAddressId`, `normalizedLocality`, nullable `normalizedAdministrativeArea`, required `cargoDescription` і timestamps. Relation до заявки має aggregate `Cascade`.

Route order, `sequence`, `displayOrder`, coordinates, supplier contacts, weight і scheduling fields не додавалися.

## 8. LogisticsInternalComment

Окрема append-only модель містить request relation, nullable `authorUserId`, `body` і `createdAt`. `updatedAt`, edit/delete metadata та CLIENT projection не додано. Автор має `onDelete: SetNull`, а comment зберігається; видалення aggregate request каскадно видаляє його внутрішні коментарі.

Окрему `LogisticsStatusHistory` не створено. Статусні зміни мають аудититися через `AuditLog`; через retention policy AuditLog це не є гарантією постійного довгострокового timeline. Такий timeline потребуватиме окремого product рішення.

## 9. Guest і CLIENT ownership

Фактичні nullable ownership fields: `clientId` і `companyId`.

- guest: обидва `null`;
- personal CLIENT: `clientId` заданий, `companyId` — `null`;
- company context: задані обидва server-derived identifiers.

DB constraint забороняє `companyId` без `clientId`. Телефон не визначає ownership, guest request автоматично не claim-иться. Обидві relations мають `SetNull`; constraint означає, що видалення client для company-owned request потребує попереднього безпечного ownership transition, а не прихованого порушення інваріанта.

## 10. Destination invariants

Фактичні поля: `destinationType`, `baseAddressSnapshot`, `farmFormattedAddress`, `farmExternalAddressId`, `farmAddressProvider`, `farmNormalizedLocality`.

DB constraint вимагає:

- для `KAIROS_BASE`: nonblank `baseAddressSnapshot`, а всі farm fields — `null`;
- для `FARM`: `baseAddressSnapshot` — `null`, required nonblank formatted address і normalized locality, required provider; external provider ID залишається nullable відповідно до Stage 2 contract.

Базова адреса `м. Кагарлик, вул. Миронівська, 33д` буде записуватися application layer у Stage 5. Delivery не моделюється окремою stop.

## 11. Pricing snapshots

Фактичні поля: `pickupPointCount`, `baseTariffSnapshot`, `additionalPointsCharge`, `farmDeliveryCharge`, `totalPrice`.

У заявці є одна authoritative `totalPrice`. `finalPrice`, `confirmedPrice`, pricing status, override/reason і manager confirmation не додавалися. Pricing engine та формули не реалізовано.

## 12. Money і VAT representation

Усі суми мають `Decimal(12,2)` і DB constraints `>= 0`. Logistics contract завжди оперує кінцевими VAT-inclusive сумами, тому окремий `vatIncluded` boolean або VAT rate не зберігається: такий flag був би дублюванням незмінного доменного правила.

## 13. Request-number foundation

Migration створює окрему PostgreSQL sequence `logistics_request_number_seq`. `requestNumber` має unique constraint і DB default формату `LG-000001` через `nextval` та `lpad`. Це атомарна race-safe основа без `count() + 1`; application generator у Stage 3 не створювався.

## 14. Audit enum decision

Оскільки AuditLog використовує DB-backed enums, додано мінімальний vocabulary для наступних stages:

- entity types: `LOGISTICS_REQUEST`, `LOGISTICS_TARIFF_CITY`;
- actions: `LOGISTICS_REQUEST_CREATED`, `LOGISTICS_STATUS_CHANGED`, `LOGISTICS_INTERNAL_COMMENT_CREATED`, `LOGISTICS_TARIFF_UPDATED`.

AuditLog runtime calls не реалізовано.

## 15. Delete behavior

- tariff city → request: `Restrict`;
- request → pickup points/internal comments: `Cascade`;
- ClientProfile/Company → request: `SetNull`;
- User author → internal comment: `SetNull`.

Це зберігає історичні заявки й коментарі, водночас дозволяючи aggregate cleanup лише при явному видаленні самої Logistics-заявки.

## 16. Index strategy

- `LogisticsRequest.requestNumber` і `idempotencyKey`: unique indexes;
- `[status, createdAt]`: майбутній CRM queue/filter;
- `[clientId, createdAt]`: CLIENT list;
- `[companyId, createdAt]`: company-context list;
- `[tariffCityId]`: relation lookup;
- `[createdAt]`: chronological administrative list;
- `LogisticsPickupPoint.logisticsRequestId`: aggregate lookup;
- `[logisticsRequestId, createdAt]`: chronological internal comments;
- `LogisticsInternalComment.authorUserId`: author relation lookup;
- `LogisticsTariffCity.code`: unique lookup;
- `LogisticsTariffCity.isActive`: active tariff list.

`destinationType` index не додано, бо approved Stage 4 query pattern його не потребує.

## 17. DB constraints

Migration додає перевірки для:

- nonnegative tariff price;
- `LG-` request-number format;
- nonblank idempotency key;
- canonical `+380XXXXXXXXX` contact phone;
- `pickupPointCount >= 1`;
- nonnegative pricing snapshots;
- відсутності company ownership без client ownership;
- взаємовиключних `KAIROS_BASE`/`FARM` destination snapshots.

Application validation залишається обов'язковою у Stage 5; DB constraints є останньою лінією захисту.

## 18. Initial tariff cities

Migration artifact містить рівно 13 active rows зі Stage 2 stable codes:

| Code | Name | Price, грн, ПДВ включено |
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

Ірпінь і Буча є окремими rows. Додаткові `500 грн` не представлені тарифними rows і не додавалися повторно з VAT.

## 19. Tariff initialization strategy

Initial rows додано одноразовим `INSERT` у migration, що створює таблицю. Немає recurring seed, `upsert`, `ON CONFLICT ... UPDATE` або initializer, який перезаписує `price`/`isActive`. Тому майбутні ADMIN-зміни не будуть перезаписані повторним application seed.

Тарифи зараз існують лише як unapplied migration artifact.

## 20. Migration generation strategy

Перед зміною schema створено тимчасовий pre-change snapshot поза tracked worktree. Після `prisma format` і `prisma validate` перевірено `prisma migrate diff --help`, далі SQL створено offline schema-to-schema командою:

```text
prisma migrate diff --from-schema-datamodel <temporary-old-schema> --to-schema-datamodel prisma/schema.prisma --script
```

DB URL, migrations-directory comparison, shadow DB і network connection не використовувалися. Після generation SQL вручну доповнено additive sequence, CHECK constraints та 13 inserts. Тимчасовий snapshot видаляється після завершення review і не входить до Git.

## 21. Migration SQL review

Migration:

- створює лише нові Logistics enums/tables/indexes/FKs/checks і додає мінімальні Audit enum values;
- містить окрему sequence та всі 13 initial rows;
- не містить `DROP TABLE`, `TRUNCATE`, `DELETE`, `UPDATE` або destructive `ALTER COLUMN`;
- не змінює parts lifecycle, existing request tables, client Telegram data чи Notification;
- не містить secrets, coordinates, maps/routes tables.

## 22. DB activation prohibition

Migration створено, але не застосовано. Не виконувалися `migrate dev`, `migrate deploy`, `migrate reset`, `migrate status`, `db push`, `db pull`, `db seed`, `psql`, Prisma query або SQL query.

DB identity не перевірялася через network, жодна БД не змінювалася. `prisma validate` і `prisma generate` перевіряють schema/генерують client та не застосовують migration.

## 23. Static verification

Новий `scripts/check-logistics-persistence-foundation.ts` перевіряє enums, models, relations, money precision, ownership/destination foundation, required snapshots, unique keys, forbidden fields, additive SQL, sequence, constraints і точні 13 тарифів.

Результат:

```text
logisticsPersistenceFoundation=PASS models=4 cities=13 constraints=7
```

Число `constraints=7` у summary є групами перевірених request constraints; окремий tariff-price constraint також перевіряється.

## 24. Prisma validation/generation

- `npx.cmd prisma format` — PASS;
- `npx.cmd prisma validate` — PASS, schema valid;
- `npx.cmd prisma generate` — PASS, Prisma Client `v6.19.3`.

Ці команди не застосовували migration і не виконували DB queries.

## 25. Regression checks

- Stage 2 address-provider check — `logisticsAddressProvider=PASS cities=13 errorCodes=9`;
- `npm.cmd run lint` — PASS;
- `npm.cmd run typecheck` — PASS;
- `npm.cmd run build` — PASS, Next.js `15.5.19`, 49 pages;
- локальний regression check: `/logistics` — `200`, `/logistics/request` — `404`;
- CTA залишився disabled без request href;
- mock autocomplete і resolve endpoints — `200`;
- локальний test server зупинено, port закрито.

Production, external providers і DB runtime не тестувалися та не змінювалися.

## 26. Змінені файли

- `prisma/schema.prisma`;
- `prisma/migrations/20260729120000_add_logistics_persistence_foundation/migration.sql`;
- `scripts/check-logistics-persistence-foundation.ts`;
- `docs/reports/stage-logistics-3-persistence-foundation.md`.

`prisma format` виконав alignment наявних полів у трьох relation-heavy моделях; семантична зміна там обмежена новими Logistics relations.

## 27. Перевірки

Виконані offline/static перевірки:

- schema/migration semantic review;
- Stage 3 static check;
- Stage 2 regression script;
- Prisma format/validate/generate;
- lint;
- typecheck;
- production build;
- локальні HTTP regression checks;
- `git diff --check`.

Перед commit окремо виконується `git diff --cached --check` і перевірка точного staged file list.

## 28. Відомі обмеження

- Migration ще не застосована, тому tables/enums/tariffs не існують у жодній DB.
- Pricing engine, дві VAT-inclusive доплати `500 грн`, quote/create flow та idempotency generation/validation відкладені до Stage 5.
- Address provider `GOOGLE` є лише enum value; implementation відсутня.
- Постійної status history немає; AuditLog history залежатиме від його retention.
- Немає form, CRM/CLIENT projections, status mutations, internal-comment API або tariff admin.
- Deployment gate має окремо перевірити цільову PostgreSQL version, backup/readiness та застосувати migration лише після explicit approval.

## 29. Межі Stage Logistics 3

Не створено `/logistics/request`, не активовано CTA, не реалізовано pricing/request service, quote/create API, CRM, CLIENT routes, Google provider, coordinates, persistent rate-limit runtime, status mutation, tariff admin, Telegram або staff notification.

Чинний клієнтський Telegram-бот, application routes/UI, `Notification`, `prisma/seed.ts`, `prisma.config.ts`, `package.json` і паралельні файли не змінювалися цим етапом.

## 30. Readiness for Stage Logistics 4

Schema, unapplied additive migration, reference tariffs і static verification готові як persistence foundation. Stage Logistics 4 у межах цього завдання не починався.

Перед майбутньою DB activation потрібні окремі environment/backup/approval gates, але blocker для початку Stage Logistics 4 у межах погодженої послідовності не виявлено.
