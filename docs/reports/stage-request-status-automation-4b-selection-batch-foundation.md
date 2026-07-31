# Stage Request Status Automation 4B — Selection batch foundation

Дата виконання: 2026-07-27.

## 1. Executive summary

У `develop` створено dormant domain і persistence foundation для versioned approval cycle:

```text
Request
└─ RequestSelectionBatch (revision)
   └─ RequestSelectionBatchItem (typed immutable snapshot + future decision)
```

Реалізовано два enums, request-scoped atomic revision counter, additive migration, PostgreSQL
partial unique index для одного active `SENT` batch, typed snapshot builder, canonical SHA-256,
explicit lifecycle matrix, transaction-composable create/transition services, role guards,
typed errors, Audit Log, labels і ізольований verification suite.

Жоден production action не підключено. Поточні send, client approval, `visibleToClient`, Request
status automation, Telegram, CommercialOffer, Invoice та Change Request flows не змінилися.
Configured remote Neon опитано лише командою `prisma migrate status`; migrations не
застосовувалися і дані не змінювалися.

## 2. Git і стан гілки develop

Pre-check:

```text
branch: develop
HEAD: 18ecc7e9345012f64145292a65c620c9905187f1
HEAD message: docs: audit request approval cycle architecture
Stage 4A commit contained by: develop
git status --short: empty
main: f8601836ead73caf7611fd65e2b9db1495042425
```

Feature branch, checkout `main`, rebase, merge та push не виконувалися.

## 3. Вихідний стан після Stage 4A

Повністю перечитано:

```text
docs/reports/stage-request-status-automation-2-domain-transition-service.md
docs/reports/stage-request-status-automation-3-draft-selection-trigger.md
docs/reports/stage-request-status-automation-4a-approval-cycle-architecture-audit.md
```

Stage 4A затвердив `RequestSelectionBatch` як єдине source of truth approval cycle, typed
immutable snapshots, partial unique active-cycle invariant та
`Request.selectionRevisionCounter`. Stage 4B реалізує лише foundation, не production activation.

## 4. Фактичні source models і snapshot mapping

| Source | Snapshot | Тип |
| --- | --- | --- |
| `RequestItem.id` | `sourceRequestItemId` | nullable FK після snapshot creation |
| `RequestItem.updatedAt` | `sourceUpdatedAt` | `DateTime` |
| `RequestItem.equipmentType` | `equipmentType` | `String?` |
| `RequestItem.name` | `itemName` | `String` |
| `RequestItem.brand` | `brand` | `String?` |
| `RequestItem.catalogNumber` | `catalogNumber` | `String?` |
| `RequestItem.analogNumber` | `analogNumber` | `String?` |
| `RequestItem.quantity` | `quantity` | `Int` |
| `RequestItem.unit` | `unit` | `String` |
| `RequestItem.availability` | `availability` | `String?` |
| `RequestItem.deliveryTime` | `deliveryTime` | `String?` |
| `RequestItem.salePrice` | `approvedUnitPrice` | `Decimal(12,2)?` |
| `RequestItem.currency` | `currency` | `String` |
| `RequestItem.comment` | `managerComment` | `String?` |
| `RequestItem.vehicleId` | `vehicleIdSnapshot` | `String?`, value snapshot, не FK |
| `Vehicle.name` + display helper | `vehicleDisplayName` | `String?` |
| `Vehicle.manufacturer` | `vehicleBrand` | `String?` |
| `Vehicle.model` | `vehicleModel` | `String?` |
| `Vehicle.year` | `vehicleYear` | `Int?` |
| `Vehicle.vinOrSerial` | `vehicleVin` | `String?` |

Internal `purchasePrice` і `supplierName` не snapshot-яться. Окремих source SKU,
compatibility/description або price-basis fields у `RequestItem` немає; нові вигадані domain fields
не додавалися.

## 5. Додані Prisma enums

```prisma
enum RequestSelectionBatchStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  SUPERSEDED
}

enum RequestSelectionBatchItemStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Item-level `SUPERSEDED` та batch `PARTIALLY_APPROVED/CHANGES_REQUESTED/CANCELLED/EXPIRED` не
додавалися.

## 6. Request.selectionRevisionCounter

До `Request` додано:

```prisma
selectionRevisionCounter Int @default(0)
selectionBatches         RequestSelectionBatch[]
```

Migration додає `NOT NULL DEFAULT 0` і check `>= 0`. Existing requests не backfill-яться окремим
script; PostgreSQL заповнює additive column значенням `0`.

## 7. RequestSelectionBatch model

Фактичні поля:

```text
id
requestId
revision
status
snapshotSchemaVersion
snapshotHash
createdByUserId nullable
sentAt
approvedAt
rejectedAt
supersededAt
createdAt
updatedAt
items
```

Constraints/indices:

```text
unique(requestId, revision)
index(requestId, status)
index(createdByUserId)
index(createdAt)
check revision >= 1
check snapshotSchemaVersion >= 1
check lowercase SHA-256 format
partial unique(requestId) WHERE status='SENT'
```

`createdByUserId` nullable у persistence, але create service завжди вимагає active trusted actor.
Nullable relation зберігає batch після фізичного видалення user.

## 8. RequestSelectionBatchItem model

Model містить:

- parent batch і deterministic `position`;
- nullable source relation;
- `PENDING/APPROVED/REJECTED`;
- nullable future decision actor, timestamps і client comment;
- typed snapshot із розділу 4;
- `snapshotSchemaVersion`, per-item `snapshotHash`;
- `createdAt/updatedAt`.

Constraints/indices:

```text
unique(batchId, position)
unique(batchId, sourceRequestItemId)
index(batchId, status)
index(sourceRequestItemId)
index(snapshotHash)
index(decisionByUserId)
check position >= 1
check quantity >= 1
check approvedUnitPrice IS NULL OR >= 0
check snapshotSchemaVersion >= 1
check lowercase SHA-256 format
```

PostgreSQL composite `UNIQUE` допускає кілька rows із `sourceRequestItemId=NULL`; це дозволяє
зберегти кілька orphan snapshots після видалення різних source items.

## 9. Typed immutable snapshot

`lib/request-selection/snapshot.ts` експортує:

```ts
buildRequestSelectionSnapshot(source)
stableSerializeRequestSelectionSnapshot(value)
sha256RequestSelectionSnapshot(value)
hashRequestSelectionBatchSnapshots(snapshots)
```

Builder валідовує item name, integer positive quantity, unit, non-negative nullable price,
currency та valid `updatedAt`. Output не містить internal cost, supplier або decision fields.

Snapshot immutability забезпечується architecture boundary: немає update API для snapshot
columns, lifecycle service змінює лише batch status/timestamps, а Stage 5 зможе змінювати лише
decision fields. DB trigger для заборони raw snapshot update не додавався.

## 10. Snapshot schema version

Єдина константа:

```ts
REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION = 1
```

Version записується в кожен batch, batch item, canonical hash input, service result та Audit Log.

## 11. Canonical serialization і SHA-256

Алгоритм:

1. Recursively normalize value.
2. `undefined` і `null` → `null`.
3. `Date` → ISO-8601 UTC.
4. `Prisma.Decimal` → canonical decimal string.
5. Array order зберігається.
6. Object keys сортуються ASCII lexical comparison на кожному рівні.
7. Canonical value серіалізується `JSON.stringify`.
8. UTF-8 bytes hash-яться Node `crypto.createHash('sha256')`.
9. Result — lowercase 64-character hex.

Per-item hash включає schema version, source ID/version, client-visible item, logistics,
price/currency/comment та vehicle snapshot. Не включає batch item ID, timestamps creation/update,
decision status/actor/timestamps.

Batch aggregate hash обчислюється з ordered list:

```text
[{ position, snapshotHash }, ...]
```

Object insertion order не впливає на hash.

## 12. Batch lifecycle matrix

| Current | Event | Result |
| --- | --- | --- |
| `DRAFT` | `SEND` | `SENT` |
| `DRAFT` | `SUPERSEDE` | `SUPERSEDED` |
| `SENT` | repeat `SEND` | noop |
| `SENT` | `APPROVE` | `APPROVED`, лише якщо всі items approved |
| `SENT` | `REJECT` | `REJECTED`, лише якщо є rejected item |
| `SENT` | `SUPERSEDE` | `SUPERSEDED` |
| target final | repeat same event | noop |
| `APPROVED/REJECTED/SUPERSEDED` | інша mutation | blocked `final_status_locked` |
| unsupported pair | any | blocked `invalid_transition` |

Enum ordering не використовується.

## 13. Active SENT invariant

Active approval cycle:

```text
RequestSelectionBatch.status = SENT
```

Application pre-check не є source of truth. Остаточний invariant захищає DB partial unique index.
Lifecycle service перетворює Prisma `P2002` під час `SEND` у
`ACTIVE_SENT_BATCH_CONFLICT`.

## 14. Partial unique index

Migration SQL:

```sql
CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"
  ON "RequestSelectionBatch"("requestId")
  WHERE "status" = 'SENT';
```

Prisma schema містить звичайний `@@index([requestId, status])`; partial index навмисно
задекларовано raw SQL, бо Prisma schema не є достатнім source для цього PostgreSQL invariant.

## 15. Atomic revision allocation

У caller transaction:

```ts
const allocated = await tx.request.update({
  where: { id: request.id },
  data: {
    selectionRevisionCounter: { increment: 1 }
  },
  select: {
    selectionRevisionCounter: true
  }
});

revision = allocated.selectionRevisionCounter;
```

`MAX`, `count` і latest revision не використовуються. Request row update serialization дає
унікальні revisions concurrent DRAFT creates; unique `(requestId, revision)` є DB guard.

Якщо batch, item або Audit Log creation падає, outer Prisma transaction rollback-ить counter разом
з усіма rows. Tests підтверджують rollback на кожній failure boundary.

## 16. Batch creation service

Production export:

```ts
createRequestSelectionBatchDraft(input)
```

Testable factory:

```ts
createRequestSelectionBatchService(database)
```

Input:

```ts
{
  requestId,
  requestItemIds,
  actor: { id },
  expectedRequestItemVersions?,
  source?,
  requestContext?,
  tx?
}
```

Flow:

1. Reject empty/duplicate IDs.
2. Load Request, actor та requested source items.
3. Require active `ADMIN/MANAGER`, non-terminal Request.
4. Distinguish missing item from item іншої Request.
5. Preserve exact input ID order.
6. Optional optimistic check source `updatedAt`.
7. Build typed snapshots/hashes.
8. Atomic increment revision.
9. Create DRAFT batch та individual batch items.
10. Write one batch Audit Log.

Service не викликається application actions у Stage 4B.

## 17. Batch lifecycle service

Production export:

```ts
transitionRequestSelectionBatchStatus(input)
```

Testable factory:

```ts
createRequestSelectionBatchTransitionService(database)
```

Service повторно читає actor і batch, застосовує explicit matrix, aggregate guard, conditional:

```text
updateMany where id + expected current status
```

та встановлює тільки відповідний timestamp. Concurrent winner reread дає deterministic
noop/blocked; unresolved race дає `CONCURRENT_BATCH_STATUS_CHANGE`.

## 18. Actor і authorization guards

- Create DRAFT: active DB role `ADMIN` або `MANAGER`.
- `SEND/SUPERSEDE`: active DB role `ADMIN` або `MANAGER`.
- `APPROVE/REJECT`: active DB role `CLIENT`.
- missing actor: `ACTOR_NOT_FOUND`.
- inactive або wrong role: `ACTOR_NOT_ALLOWED`.

Input приймає тільки actor ID. Role/name/email не довіряються caller payload. `writeAuditLog()`
окремо формує actor snapshot із DB.

## 19. Transaction composability

Standalone:

```text
tx absent → exactly one database.$transaction(callback)
```

Existing transaction:

```text
tx supplied → use same Prisma.TransactionClient
             → no nested transaction
             → no global prisma in operation path
```

Create, revision counter, snapshots та audit атомарні. Lifecycle status/timestamp та audit також
атомарні.

## 20. Concurrency та idempotency

- Concurrent DRAFT creation: atomic counter дає різні revisions; обидва batches дозволені.
- Concurrent SEND різних batches: partial unique index допускає одного winner.
- Concurrent same-batch transition: conditional update + reread.
- Repeat same event у target state: noop без duplicate Audit Log.
- Snapshot race: transaction зберігає content і `sourceUpdatedAt`, прочитані одним source query.
  Default isolation не гарантує, що source не зміниться одразу після read; Stage 4C має передавати
  `expectedRequestItemVersions` із selection UI або додати locking policy.
- Create service уже підтримує optional expected versions і повертає `SOURCE_ITEM_CHANGED`.

## 21. Audit Log

Додано entity:

```text
REQUEST_SELECTION_BATCH
```

Actions:

```text
REQUEST_SELECTION_BATCH_CREATED
REQUEST_SELECTION_BATCH_SENT
REQUEST_SELECTION_BATCH_APPROVED
REQUEST_SELECTION_BATCH_REJECTED
REQUEST_SELECTION_BATCH_SUPERSEDED
```

Create записує один batch event із request ID, revision, status, item count, schema version,
bounded source item IDs та snapshot count. Lifecycle записує before/after status, request ID,
revision та event. Чинний sanitizer відхиляє hash-named audit keys, тому SHA-256 зберігається в
batch/item tables, але не дублюється в Audit Log.

Full snapshots, VIN, comments, prices, customer identity, URLs, secrets і tokens в Audit Log не
пишуться. Окремий Audit Log на кожен snapshot item не створюється.

## 22. Error model

Typed `RequestSelectionBatchError` codes:

```text
REQUEST_NOT_FOUND
ACTOR_NOT_FOUND
ACTOR_NOT_ALLOWED
EMPTY_SELECTION
DUPLICATE_REQUEST_ITEM_IDS
REQUEST_ITEM_NOT_FOUND
REQUEST_ITEM_NOT_IN_REQUEST
REQUEST_TERMINAL
SOURCE_ITEM_INVALID
SOURCE_ITEM_CHANGED
REVISION_ALLOCATION_FAILED
ACTIVE_SENT_BATCH_CONFLICT
SNAPSHOT_BUILD_FAILED
BATCH_CREATE_FAILED
BATCH_NOT_FOUND
CONCURRENT_BATCH_STATUS_CHANGE
```

Matrix/aggregate business results використовують `noop` або `blocked` із
`final_status_locked`, `invalid_transition`, `empty_batch`, `items_not_fully_approved` чи
`no_rejected_items`. Raw Prisma details не є public contract.

## 23. Labels і presentation foundation

Створено centralized maps без UI integration:

```text
DRAFT       → Чернетка
SENT        → Надіслано на погодження
APPROVED    → Погоджено
REJECTED    → Відхилено
SUPERSEDED  → Замінено новішою версією

PENDING     → Очікує рішення
APPROVED    → Погоджено
REJECTED    → Відхилено
```

Audit Log presentation отримав entity/action labels.

## 24. Migration

Migration:

```text
prisma/migrations/20260727183000_add_request_selection_batch_foundation/migration.sql
```

Вона:

- додає два selection enums і additive Audit enum values;
- додає counter;
- створює дві tables, FKs, checks, unique constraints та indices;
- вручну створює partial unique index;
- не виконує data backfill;
- не змінює `visibleToClient`, `approvedByClient` або Request statuses;
- не торкається CommercialOffer/Invoice.

Ordering:

```text
20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses
→ 20260727183000_add_request_selection_batch_foundation
```

## 25. Backward compatibility

Policy — forward-only. Existing requests не отримують fake batches/revisions. Legacy send/client
approval flows продовжують працювати без змін до 4C/4D/5. New tables залишаються порожніми в
runtime, доки production caller не буде окремо підключений.

## 26. Tests

Команда:

```text
npm.cmd run test:request-selection-batch
```

Покрито:

- exact typed mapping, version, secret exclusions;
- deterministic key/Decimal/null/Date canonicalization;
- hash changes для quantity/catalog/vehicle/source version;
- decision/generated fields не впливають;
- revision `0→1→2`, concurrent allocation, rollback;
- ADMIN/MANAGER, CLIENT/inactive/missing actor;
- missing/foreign/duplicate/empty items, terminal requests, expected version;
- deterministic order, source link, one batch audit;
- standalone/existing transaction;
- full lifecycle matrix, aggregate guards, timestamps, noops;
- conditional/concurrent transition, active SENT conflict;
- audit failure rollback;
- static additive migration/partial-index checks;
- static absence of production imports.

Tests mock-based й перевіряють transaction semantics із commit/rollback state clone. Real
PostgreSQL partial-index execution не запускалася через відсутність точно ідентифікованої safe
local/test DB.

## 27. Regression results

PASS:

```text
npm.cmd run test:request-selection-batch
npm.cmd run test:request-status
npm.cmd run test:request-status-stage3
npx.cmd tsx scripts/check-admin-audit-log-2.ts
npx.cmd tsx scripts/check-admin-audit-log-3.ts
npx.cmd tsx scripts/check-admin-audit-log-4.ts
npx.cmd tsx scripts/check-admin-audit-log-5.ts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Build compiled all admin/client/public/API routes. Browser/authenticated runtime regression не
виконувалася, оскільки production flows не змінювалися і test credentials не входили в scope.

## 28. Database safety

`npx.cmd prisma migrate status` виконано read-only проти configured remote Neon. Результат:

```text
38 migrations found
pending:
20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses
20260727183000_add_request_selection_batch_foundation
```

Non-zero exit означає pending migrations, не application failure.

Не виконувалися:

```text
prisma migrate dev
prisma migrate deploy
prisma db push
prisma migrate reset
prisma db seed
```

Stage 4B migration не застосовувалася до жодної DB. Remote/production data не змінювалися.

## 29. Змінені файли

```text
docs/reports/stage-request-status-automation-4b-selection-batch-foundation.md
lib/audit-log/contracts.ts
lib/audit-log/presentation.ts
lib/request-selection/lifecycle.ts
lib/request-selection/presentation.ts
lib/request-selection/service.ts
lib/request-selection/snapshot.ts
package.json
prisma/migrations/20260727183000_add_request_selection_batch_foundation/migration.sql
prisma/schema.prisma
scripts/check-request-selection-batch.ts
```

Generated Prisma Client оновлено лише в ignored `node_modules` і не додається до Git.

## 30. Відомі обмеження

- Real PostgreSQL migration/partial-index test pending.
- Stage 2 і Stage 4B migrations pending на configured remote Neon.
- Snapshot immutability не захищена DB trigger; service API не надає snapshot update.
- `approvedUnitPrice` nullable, бо source `salePrice` nullable; Stage 4C має визначити send guard.
- Item decision mutation service свідомо лишається Stage 5.
- Lifecycle `APPROVE/REJECT` foundation очікує, що Stage 5 уже встановив item statuses.
- Lifecycle foundation перевіряє DB role, але client company/personal ownership навмисно лишається
  обов’язком Stage 5 caller/domain integration.
- Source-row lock не додано; Stage 4C має використати `expectedRequestItemVersions`/locking.
- No form/business idempotency key для DRAFT creation; кожен валідний command створює нову revision.
- Manager CRM scope залишається global відповідно до чинної authorization model.

## 31. Що свідомо не входило у Stage 4B

Не змінювалися й не підключалися:

```text
sendAdminRequestItemsForApproval()
approveClientRequestItemsAction()
visibleToClient / approvedByClient / approvedAt
SELECTION_SENT_FOR_APPROVAL / CLIENT_SELECTION_APPROVED
Request status
Telegram
client/admin request UI
Change Request
CommercialOffer / CommercialOfferItem
Invoice / InvoiceItem
legacy data
```

Stage 4C, 4D і 5 не починалися.

## 32. Готовність до Stage 4C

Локальний code foundation готовий; schema/domain blocker для Stage 4C відсутній.

Перед runtime/production activation Stage 4C має:

1. Застосовувати Stage 2 → Stage 4B migrations лише через окремо погоджений deploy.
2. Визначити required-price send guard.
3. Передати expected item `updatedAt` або взяти source locks.
4. Atomic create/supersede/send batch і Request transition в одній transaction.
5. Обробити `ACTIVE_SENT_BATCH_CONFLICT`.
6. Залишити Telegram post-commit/durable notification.

Configured remote DB з pending migrations є deployment blocker, але не blocker для розробки Stage
4C у гілці.

## 33. Підсумковий висновок

Stage 4B реалізував versioned approval aggregate без активації production behavior. Revision
allocation атомарна, snapshots typed і hash-stable, active `SENT` захищений DB partial unique
index, lifecycle explicit та conditional, audit PII-safe і transaction-composable.

Legacy flow не змінився, migrations не застосовані, remote data не мутувалися. Після review цього
foundation можна починати окремий Stage 4C, зберігаючи deployment gate для pending migrations.
