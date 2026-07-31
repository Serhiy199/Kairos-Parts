# Stage Request Status Automation 4A — Approval cycle architecture audit

Дата аудиту: 2026-07-27.

## 1. Executive summary

Єдиним source of truth циклу погодження має бути новий aggregate `RequestSelectionBatch` із
незмінними typed snapshots у `RequestSelectionBatchItem`.

Поточні `RequestItem.visibleToClient`, `approvedByClient`, `includeInInvoice` та `approvedAt`
описують mutable live rows і не ідентифікують revision. `CommercialOffer` уже snapshot-ить частину
даних, але є окремим фінансовим документом: його send/approve actions не викликаються фактичним
request-item approval UI, він не відображається на client/admin request detail, не містить повного
технічного snapshot і не гарантує один active cycle.

Затверджена архітектура:

- один request має послідовні batch revisions;
- не більше одного batch у `SENT` на request;
- кожен batch містить non-empty immutable snapshot рівно тих items, які надіслано;
- рішення є item-level; «погоджено повністю» означає, що всі items active `SENT` batch мають
  `APPROVED`;
- перше відхилення завершує batch як `REJECTED`, а request лишається `WAITING_APPROVAL`;
- новий send supersede-ить попередній незавершений cycle у тій самій transaction;
- Telegram є post-commit notification і не визначає DB success;
- старі records не backfill-яться автоматично.

Stage 4B може починатися після review цього рішення. Невирішеного schema blocker немає. Окремим
business decision лишається лише можливе повернення `WAITING_APPROVAL → IN_PROGRESS`; воно не
потрібне для запропонованого flow і не входить до 4B.

## 2. Git і стан гілки develop

Pre-check:

```text
branch: develop
HEAD: c4f4c82427015b8b4c96acfa71068261c0246491
HEAD message: feat: update request status when selection draft starts
git status --short: empty
main: f8601836ead73caf7611fd65e2b9db1495042425
```

Stage 3 commit міститься у `develop`. `main` не checkout-илася і не змінювалася. Аудит не
опитував application data у configured remote Neon і не виконував DB writes.

## 3. Вихідний стан після Stage 3

Повністю перечитано:

```text
docs/reports/stage-request-status-automation-1-audit.md
docs/reports/stage-request-status-automation-2-domain-transition-service.md
docs/reports/stage-request-status-automation-3-draft-selection-trigger.md
```

Stage 2 надав `SELECTION_SENT_FOR_APPROVAL` і `CLIENT_SELECTION_APPROVED`, explicit matrix,
conditional transition та caller-transaction mode. Stage 3 централізував create draft item у
`lib/request-items/create-draft.ts` і підключив лише `SELECTION_DRAFT_CREATED`.

Stage 2 migration із `AWAITING_INVOICE` та `INVOICE_SENT` лишалася pending на configured remote
Neon за останньою read-only перевіркою. Це deployment blocker для runtime triggers, але не blocker
для локальної additive реалізації 4B.

## 4. Поточні Prisma models і approval fields

| Model | Релевантні поля/relations | Фактична роль |
| --- | --- | --- |
| `Request` | `status`, `items`, `commercialOffers`, `invoices`, `statusHistory` | Корінь request lifecycle |
| `RequestItem` | `visibleToClient`, `approvedByClient`, `includeInInvoice`, `approvedAt` | Mutable live selection |
| `CommercialOffer` | `status`, amounts, comments, timestamps, items | Окремий фінансовий документ |
| `CommercialOfferItem` | optional `requestItemId`, name/brand/catalog/quantity/price snapshot | Неповний snapshot offer |
| `Invoice` | status, totals, seller/buyer snapshots, items | Рахунок |
| `InvoiceItem` | optional `requestItemId`, item/price snapshot | Фінансовий snapshot |
| `ChangeRequest` | generic `entityType/entityId`, field diff, status | Окремий review змін |
| `Notification` | request/user/channel/status/message/sentAt | Delivery attempt без event key/retry count |
| `RequestStatusHistory` | old/new/actor/time | Історія лише request status |
| `AuditLog` | typed entity/action/category + sanitized JSON | Append-only business audit |

`RequestItem` не має `sentAt`, revision, active batch ID, explicit rejection, decision actor або
immutable version. `CommercialOfferItem.requestItemId` та `InvoiceItem.requestItemId` мають
`onDelete: SetNull`, але зберігають власні snapshots.

## 5. Поточний send-for-approval flow

Єдиний фактичний entry point для item selection:

```text
app/admin/requests/[id]/page.tsx
→ form action sendAdminRequestItemsForApproval
→ app/admin/actions.ts
```

Алгоритм:

1. `requireCrmSession()` допускає active `ADMIN/MANAGER`.
2. Поза transaction читаються всі hidden item IDs request.
3. Transaction виконує `updateMany(visibleToClient=false → true)` та
   `REQUEST_ITEMS_SENT_FOR_APPROVAL`.
4. Після commit викликається `sendTelegramRequestItemsApprovalNotification()`.
5. Revalidate admin/client request surfaces.

JSON API для цього item send не знайдено. Окремий
`POST /api/admin/commercial-offers/[offerId]/send` надсилає Commercial Offer і не є item-selection
send.

Поточний send не створює snapshot/revision, не викликає `SELECTION_SENT_FOR_APPROVAL`, читає IDs до
transaction і не захищений request-level lock або idempotency key.

## 6. Поточний client approval/rejection flow

Знайдені entry points:

| Entry point | Поведінка |
| --- | --- |
| `app/client/requests/[id]/page.tsx` → `approveClientRequestItemsAction()` | Погоджує вибрану підмножину всіх visible live items; unselected скидає |
| `approveClientCommercialOfferAction()` | `CommercialOffer SENT → APPROVED`; action існує, але request detail її не рендерить |
| `rejectClientCommercialOfferAction()` | `CommercialOffer SENT → REJECTED` із comment; action існує, але request detail її не рендерить |
| `/client/change-requests` → `createClientChangeRequestAction()` | Generic request на зміну |
| request item contextual action → `createClientRequestItemEditAction()` | Change Request для `name`, `catalogNumber`, `quantity`, `comment` |
| `/admin/change-requests` → approve/reject actions | Після approval може змінити visible live item |

`approveClientRequestItemsAction()`:

- company/personal scope перевіряється через `requestAccessWhere()`;
- empty selection заборонена;
- selected rows отримують `approvedByClient=true`, `includeInInvoice=true`, `approvedAt=now`;
- усі інші visible rows скидаються;
- `Request.status` не перевіряється і не змінюється;
- repeat submit переписує `approvedAt` та створює новий Audit Log;
- два company clients мають last-write-wins.

Explicit item reject action/comment відсутні. Unselected item лише не погоджений. Commercial Offer
approve/reject є паралельним, не інтегрованим approval contract.

## 7. Draft, visibility і approval semantics

Фактичні значення:

```text
draft item             = visibleToClient=false
sent/client-visible    = visibleToClient=true
selected by client     = approvedByClient=true
invoice source flag    = includeInInvoice=true
approval timestamp     = approvedAt
```

`visibleToClient` є presentation/workflow projection, а не доказом send revision.
`approvedByClient` є mutable останнім вибором на live row, а не доказом погодження незмінного
контенту.

## 8. Mutable live-item problem

Проблема існує і є blocker для direct wiring Stage 5:

- staff update/delete дозволені після send;
- approved Change Request може змінити visible item;
- `quantity`, `salePrice`, name, catalog data та vehicle relation можуть змінитися після approval;
- client UI читає live rows;
- invoice створюється з поточного live row, а не з того, що клієнт бачив;
- старі й нові send cycles змішані через один boolean;
- delete source item стирає саме approval row.

Отже current flags не доводять, що клієнт погодив конкретні quantity/price/compatibility дані.

## 9. CommercialOffer як approval source

Переваги:

- має own lifecycle `DRAFT/SENT/APPROVED/REJECTED/EXPIRED/CANCELLED`;
- items snapshot-ять name, brand, catalog number, quantity, unit, price, availability, comment;
- sent rows не редагуються через чинний service;
- approve/reject authorization company-scoped і transactional.

Недоліки:

- current item-send flow не створює/не надсилає offer;
- client/admin request detail не читає `commercialOffers`;
- snapshot пропускає `analogNumber` під час create, `equipmentType`, vehicle identity,
  `deliveryTime` та source updated version;
- offer створюється з усіх request items, а не exact selected drafts;
- номер формується через unsafe `count + 1`;
- немає one-active-offer invariant;
- status updates unconditional після pre-read;
- approval фінансової пропозиції семантично не дорівнює погодженню підбору;
- кілька pricing/document variants і один technical approval cycle — різні aggregates.

Однозначне рішення: `CommercialOffer` **не підходить** як source of truth selection approval.
Він лишається downstream фінансовим документом.

## 10. RequestSelectionBatch як approval source

Aggregate:

```text
Request
└─ RequestSelectionBatch revision N
   └─ RequestSelectionBatchItem immutable content + mutable decision
```

Batch дає exact membership, revision identity, immutable client surface, active-cycle invariant,
stale protection і стабільне походження future offers/invoices. Source item може редагуватися або
видалятися: nullable FK стане `NULL`, але typed snapshot збережеться.

`snapshotHash` — SHA-256 canonical serialization typed snapshot rows у стабільному `position`
порядку. Він є integrity/correlation evidence, але не замінює заборону update snapshot columns у
service/static checks.

## 11. Порівняльна архітектурна матриця

| Критерій | RequestItem flags | CommercialOffer | RequestSelectionBatch |
| --- | --- | --- | --- |
| Exact cycle membership | Ні | Частково | Так |
| Immutable technical snapshot | Ні | Неповний | Так |
| Revisions | Ні | Неформальні | Explicit |
| One active cycle | Ні | Ні | Partial unique index |
| Item-level decisions | Mutable flags | Ні | Так |
| Stale approval protection | Ні | Status only | Batch/status/version guards |
| Financial-document separation | Так | Ні | Так |
| Current UI compatibility | Так | Ні | Потребує migration |
| Safe future invoice provenance | Ні | Частково | Так |

## 12. Затверджене source of truth

`RequestSelectionBatch` — єдине source of truth approval cycle.

`RequestItem` лишається manager working data. `CommercialOffer` та `Invoice` лишаються downstream
documents. Жоден із їхніх status/flags не може самостійно означати selection approval.

## 13. Batch lifecycle

Statuses Stage 4B:

```text
DRAFT → SENT → APPROVED
          └──→ REJECTED
DRAFT/SENT/REJECTED → SUPERSEDED при новій revision
```

| From | Event | To | Guard |
| --- | --- | --- | --- |
| none | create | `DRAFT` | non-terminal request, non-empty valid selection |
| `DRAFT` | send | `SENT` | snapshots complete; one-active invariant |
| `SENT` | all items approved | `APPROVED` | conditional active batch update |
| `SENT` | any item rejected | `REJECTED` | reason/comment policy |
| `DRAFT/SENT/REJECTED` | newer revision sent | `SUPERSEDED` | same request, older revision |
| final | repeat same event | unchanged/noop | idempotent |

`PARTIALLY_APPROVED`, `CHANGES_REQUESTED`, `CANCELLED`, `EXPIRED` не потрібні у 4B. Partial
decision визначається item decisions при batch `SENT`. Request cancellation блокує decisions;
expiry/cancel semantics потребували б окремого business rule.

## 14. Active cycle invariant

Active approval cycle — batch із:

```text
requestId = X AND status = SENT
```

DB invariant:

```sql
CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"
ON "RequestSelectionBatch" ("requestId")
WHERE "status" = 'SENT';
```

Prisma 6.1 schema не виражає цей partial unique index достатньо надійно, тому він має бути explicit
SQL у reviewed migration. Service додатково бере request row lock/Serializable transaction,
supersede-ить existing `SENT` і conditionally активує новий batch. DB constraint є останньою лінією
захисту.

## 15. Revision numbering

Не використовувати `MAX(revision)+1` або `count+1`.

Додати `Request.selectionRevisionCounter Int @default(0)`. У locked/Serializable transaction
виконати atomic increment і використати повернуте значення як revision. Разом із
`@@unique([requestId, revision])` це:

- не створює duplicates при concurrent send;
- не перевикористовує видалені revision numbers;
- допускає gaps після rollback/retry як безпечну норму;
- не залежить від кількості збережених batches.

## 16. Immutable snapshot policy

Зберігати typed columns, не opaque JSON. Typed columns дають decimal/type constraints, queryable
invoice/offer source, явну migration compatibility та allowlisted rendering. JSON простіший для
evolution, але переносить validation у application, ускладнює індексацію, diff та фінансову
точність. Для versioning достатньо `snapshotSchemaVersion`.

| Source | Snapshot field | Рішення |
| --- | --- | --- |
| identity | `requestItemId` nullable | Link, не source of truth |
| ordering | `position` | Snapshot |
| concurrency | `sourceItemUpdatedAt` | Snapshot |
| item | `equipmentType` | Snapshot |
| item | `name` | Snapshot, required |
| item | `brand` | Snapshot |
| item | `catalogNumber` | Snapshot |
| item | `analogNumber` | Snapshot |
| item | `quantity` | Snapshot, required/check > 0 |
| item | `unit` | Snapshot |
| item | `availability` | Snapshot |
| item | `deliveryTime` | Snapshot |
| item | `salePrice` as `price` | Snapshot Decimal(12,2), nullable policy rejected before send |
| item | `currency` | Snapshot |
| item | `comment` | Snapshot description |
| vehicle link | `vehicleId` nullable | Link |
| vehicle | `vehicleName`, `vehicleType`, `vehicleManufacturer`, `vehicleModel`, `vehicleYear`, `vehicleVinOrSerial` | Snapshot |
| integrity | `contentHash` | SHA-256 per item |
| schema | `snapshotSchemaVersion` | Integer |

Не snapshot-ити client-hidden `purchasePrice` і `supplierName`. `visibleToClient`,
`approvedByClient`, `includeInInvoice`, `approvedAt` є workflow/decision fields, а не approved
content. Поточних окремих `description`/`compatibility` полів у `RequestItem` немає; `comment`,
equipment та vehicle fields покривають фактичний contract. Якщо business вводить structured
compatibility, це окрема additive field + snapshot migration.

## 17. Proposed Prisma schema

Conceptual schema, не реалізована в цьому stage:

```prisma
enum RequestSelectionBatchStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  SUPERSEDED
}

enum RequestSelectionDecision {
  PENDING
  APPROVED
  REJECTED
}

model Request {
  // existing fields
  selectionRevisionCounter Int @default(0)
  selectionBatches         RequestSelectionBatch[]
}

model User {
  // existing fields
  selectionBatchesCreated RequestSelectionBatch[] @relation("SelectionBatchCreatedBy")
  selectionItemDecisions RequestSelectionBatchItem[] @relation("SelectionItemDecidedBy")
}

model RequestItem {
  // existing fields
  selectionBatchItems RequestSelectionBatchItem[]
}

model Vehicle {
  // existing fields
  selectionBatchItems RequestSelectionBatchItem[]
}

model RequestSelectionBatch {
  id                    String @id @default(cuid())
  requestId             String
  request               Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  revision              Int
  status                RequestSelectionBatchStatus @default(DRAFT)
  snapshotSchemaVersion Int @default(1)
  snapshotHash          String @db.Char(64)
  createdById           String?
  createdBy             User? @relation("SelectionBatchCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  sentAt                DateTime?
  decidedAt             DateTime?
  rejectedAt            DateTime?
  supersededAt          DateTime?
  supersededById        String?
  supersededBy          RequestSelectionBatch? @relation("SelectionBatchSupersession", fields: [supersededById], references: [id], onDelete: SetNull)
  supersedes            RequestSelectionBatch[] @relation("SelectionBatchSupersession")
  items                 RequestSelectionBatchItem[]
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([requestId, revision])
  @@index([requestId, status])
  @@index([createdById])
  @@index([supersededById])
}

model RequestSelectionBatchItem {
  id                  String @id @default(cuid())
  batchId             String
  batch               RequestSelectionBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  requestItemId       String?
  requestItem         RequestItem? @relation(fields: [requestItemId], references: [id], onDelete: SetNull)
  position            Int
  sourceItemUpdatedAt DateTime
  equipmentType       String?
  name                String
  brand               String?
  catalogNumber       String?
  analogNumber        String?
  quantity            Int
  unit                String
  availability        String?
  deliveryTime        String?
  price               Decimal @db.Decimal(12, 2)
  currency            String
  comment             String?
  vehicleId           String?
  vehicle             Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  vehicleName         String?
  vehicleType         String?
  vehicleManufacturer String?
  vehicleModel        String?
  vehicleYear         Int?
  vehicleVinOrSerial  String?
  contentHash         String @db.Char(64)
  decision            RequestSelectionDecision @default(PENDING)
  decidedById         String?
  decidedBy           User? @relation("SelectionItemDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt           DateTime?
  decisionComment     String?
  createdAt           DateTime @default(now())

  @@unique([batchId, position])
  @@unique([batchId, requestItemId])
  @@index([batchId, decision])
  @@index([requestItemId])
  @@index([decidedById])
}
```

Migration SQL також має додати check constraints `revision > 0`, `position > 0`, `quantity > 0`,
`price >= 0` та decision/timestamp consistency. `supersededById` доцільно зробити self-FK
`onDelete: SetNull`. Snapshot rows не мають application update API; decision updates allowlist-ять
лише decision fields.

Optional downstream links, additive у 4B або перед першою інтеграцією:

```text
CommercialOffer.selectionBatchId nullable
CommercialOfferItem.selectionBatchItemId nullable
Invoice.selectionBatchId nullable
InvoiceItem.selectionBatchItemId nullable
```

FK до snapshot rows — `onDelete: SetNull`; parent request і далі cascade-ить усі aggregates.

## 18. Send transaction design

До transaction:

- authenticate active `ADMIN/MANAGER`;
- parse `requestId`, explicit selected source item IDs та idempotency key;
- obtain request context for audit; жодних network calls.

У `Serializable` transaction:

1. Lock/read Request; block `COMPLETED/CANCELLED` та validate allowed status.
2. Read selected items **inside** transaction with request ownership, hidden-state and
   `updatedAt` expectations; reject empty, duplicates, foreign request, missing price/invalid data.
3. Atomic increment `selectionRevisionCounter`.
4. Create `DRAFT` batch and immutable typed snapshots/hashes.
5. Mark any previous `SENT` batch `SUPERSEDED`.
6. Conditional `DRAFT → SENT`; partial unique index enforces one active sent batch.
7. Mark only selected source items `visibleToClient=true` as compatibility projection.
8. Call `transitionRequestStatus(tx, SELECTION_SENT_FOR_APPROVAL, actor, batch correlation)`.
9. Write batch/item-send Audit Logs and request history/status audit atomically.

Після commit:

- create/deliver idempotent Telegram notification;
- revalidate admin/client lists and detail;
- return success even if Telegram failed.

`visibleToClient` тимчасово лишається для backward-compatible badges/legacy pages, але client
approval surface має читати active batch snapshot. Нові source edits після send не змінюють
snapshot; наступне погодження вимагає нової revision.

## 19. Telegram failure semantics

Однозначно: DB send успішний, якщо transaction committed, навіть коли Telegram не доставлено.

Поточна реалізація вже не rollback-ить visibility при Telegram failure і створює
`Notification(PENDING → SENT/FAILED)`. Недоліки: notification створюється після commit без durable
outbox guarantee, не має unique event key/attempt count/next retry/error field; error дописується у
`message`.

Для 4C:

- durable notification/outbox intent із batch ID створювати в send transaction;
- unique key `selection-batch:<batchId>:sent:telegram:<recipientUserId>`;
- post-commit worker/inline first attempt;
- `attemptCount`, `lastErrorCode`, `nextAttemptAt`, bounded exponential retry;
- manual resend використовує той самий event key/attempt record;
- Telegram deep link містить batch/revision identity;
- не логувати chat ID, payload secrets або full snapshot.

## 20. Client approval algorithm

1. Authenticate active `CLIENT`; derive actor only from session.
2. Resolve company/personal request access.
3. Усередині `Serializable` transaction resolve batch by submitted ID and require it is the only
   active `SENT` batch for request.
4. Verify each submitted batch item belongs to batch; reject unknown/duplicate/stale IDs.
5. Conditional item update `PENDING → APPROVED` або `PENDING → REJECTED`.
6. Repeat identical decision is deterministic noop; opposite repeat is conflict.
7. Re-read aggregate counts under lock.
8. If any item rejected: conditional batch `SENT → REJECTED`; Request stays `WAITING_APPROVAL`.
9. Else if `PENDING=0` and every item is `APPROVED`: batch `SENT → APPROVED`, then
   `CLIENT_SELECTION_APPROVED → AWAITING_INVOICE`.
10. Item/batch audits, RequestStatusHistory і status audit commit in one transaction.

«Усі позиції» — всі non-empty items саме active batch; optional items у Stage 5 не існують.
Approve-all button дозволений як одна atomic command, що погоджує всі `PENDING` items. Item-level
buttons також дозволені. Два clients однієї company можуть діяти, але conditional decisions дають
one winner та фіксують конкретного actor.

## 21. Rejection і changes flow

Рекомендований contract:

- client відхиляє конкретний batch item із обов’язковим коротким reason/comment;
- перше rejection завершує active batch як `REJECTED`;
- Request лишається `WAITING_APPROVAL`;
- manager редагує/створює working `RequestItem`;
- новий send створює нову revision; rejected/old batch стає `SUPERSEDED`, зберігаючи
  `rejectedAt`, audit та `supersededById`;
- generic Change Request може лишитися каналом пропозиції зміни, але не змінює snapshot і не
  reopen-ить batch.

`WAITING_APPROVAL → IN_PROGRESS` **не додавати**. Якщо бізнесу потрібен видимий rework phase, це
окреме рішення, новий event/matrix change і окремий stage. Поточний flow може без regression
лишатися `WAITING_APPROVAL` до нової revision.

## 22. CommercialOffer linkage

Рекомендований зв’язок:

```text
CommercialOffer.selectionBatchId → approved RequestSelectionBatch
CommercialOfferItem.selectionBatchItemId → exact approved snapshot row
```

Правила:

- новий offer для automated flow створюється лише з `APPROVED` batch;
- один batch може мати кілька offers (версії pricing/document), але кожен offer має own immutable
  rows;
- quantity/name/technical origin — batch snapshot;
- offer price за замовчуванням — batch approved price; якщо price змінюється матеріально, потрібна
  нова approval revision, а не тихе редагування;
- offer може містити subset лише якщо business окремо дозволить; safe default — exact full batch;
- current offer approval лишається окремим legacy фінансовим decision і не переводить Request;
- nullable FK можна додати у 4B, enforcement у offer service — окремий later stage.

## 23. Invoice linkage

Поточний invoice service читає live `RequestItem` за трьома flags і snapshot-ить item та
seller/buyer дані. `Invoice` можна створити до надійного batch approval, бо Request status/active
batch не перевіряються.

Майбутній contract:

```text
Invoice.selectionBatchId → APPROVED batch
InvoiceItem.selectionBatchItemId → exact approved batch item
```

Invoice створюється лише з approved batch snapshot, не з live flags. Один approved batch може мати
кілька invoices лише за explicit policy; safe default — один non-cancelled invoice per approved
batch, enforced partial unique index або service guard.

`INVOICE_SENT` trigger має працювати від conditional `Invoice DRAFT → SENT` і використовувати
`invoice.requestId` + `selectionBatchId` у тій самій transaction. Поточний Invoice flow у 4A не
змінюється.

## 24. Authorization

Defense in depth:

- caller: active session, exact `ADMIN/MANAGER` send або `CLIENT` decision role;
- ownership: `requestAccessWhere()` + batch.requestId + batch item membership;
- domain: allowed Request status, active `SENT` batch, exact expected decision/status;
- DB: FKs, unique request/revision, partial unique active SENT, checks;
- actor ID лише із session; role повторно читає domain service;
- explicit DTO allowlists; не приймати revision/status/price/actor через mass assignment;
- opaque IDs не є authorization; foreign IDs повертають generic not-found/forbidden;
- idempotency key scoped до request+command+actor;
- current global CRM scope для `MANAGER` зберігається; assignment restriction не вигадується у 4B.

## 25. Audit Log і history

Додати `REQUEST_SELECTION_BATCH` і `REQUEST_SELECTION_BATCH_ITEM` до `AuditEntityType`.

| Action | entity | before/after | metadata |
| --- | --- | --- | --- |
| `REQUEST_SELECTION_BATCH_CREATED` | batch | status/revision/count/hash | requestId, source |
| `REQUEST_SELECTION_BATCH_SENT` | batch | `DRAFT→SENT` | requestId, revision, itemCount |
| `REQUEST_SELECTION_ITEM_APPROVED` | batch item | decision only | batchId, requestId, revision |
| `REQUEST_SELECTION_ITEM_REJECTED` | batch item | decision only | batchId, requestId, revision, reasonCode |
| `REQUEST_SELECTION_BATCH_APPROVED` | batch | `SENT→APPROVED` | counts |
| `REQUEST_SELECTION_BATCH_REJECTED` | batch | `SENT→REJECTED` | rejected item ID, reasonCode |
| `REQUEST_SELECTION_BATCH_SUPERSEDED` | batch | status only | supersededById/revision |
| existing `REQUEST_STATUS_CHANGED` | request | status only | batch correlation |

Actor — actual authenticated initiator; category `STANDARD`, а зміна approved price downstream може
бути `FINANCIAL_CRITICAL`. PII allowlist: IDs, revision, counts, statuses, reason code, hash; не
записувати full snapshots, comments, VIN, phone/email або Telegram IDs.

Окрема batch status-history table зараз не потрібна: immutable timestamps + append-only Audit Log
достатні. Request lifecycle продовжує використовувати `RequestStatusHistory`.

## 26. Concurrency та idempotency

| Сценарій | Захист/результат |
| --- | --- |
| Два managers send | Request lock + atomic counter + partial unique SENT; один serialization retry, не два active |
| Edit item під час send | Read/lock inside tx + expected `updatedAt`; edit або snapshot виграє, змішаний snapshot неможливий |
| Client approve vs supersede | Conditional batch `status=SENT`; один winner, stale command blocked |
| Double approve | `PENDING→APPROVED` conditional; repeat same decision noop |
| Telegram retry | Unique event key; повторна delivery attempt, не повторний batch send |
| Два company clients | Conditional item update; actor winner зафіксований, aggregate transition один |
| Старий browser tab | Batch ID + require active SENT; `SUPERSEDED` повертає stale conflict |
| Invoice vs last approval | Invoice requires already `APPROVED`; concurrent early create blocked/retry after commit |
| Manual Request status vs send | Request row lock + conditional transition; terminal/manual lock blocks send transaction |
| Request cancellation vs approval | Same request lock/conditional status; cancellation або decision wins, інша command blocked |

Serializable errors мають bounded retry лише для safe internal transaction (наприклад, 2–3
attempts). User command idempotency key не змінюється між retries. Deterministic noops не створюють
duplicate audit/history/notifications.

## 27. UI read model

Обрано Variant A: client бачить immutable active batch snapshot.

- request detail: active `SENT` batch або latest final revision, не live visible list для approval;
- item cards: snapshot fields + decision state;
- approve/reject: передають batch ID та batch item ID;
- comments: decision/change comments пов’язані з batch item;
- history: old revisions read-only;
- admin detail: working RequestItems окремо від revision history;
- refresh: завжди resolve current active batch, stale submitted ID блокується;
- Telegram deep link: request + batch revision anchor;
- `visibleToClient` лишається compatibility projection, але не authorization/source of truth.

Через суттєву зміну client/admin read model потрібен окремий Stage 4D після 4C і до Stage 5.

## 28. Backward compatibility

Без live-data query код дозволяє такі legacy cases: visible items без batch, approved flags без
batch, `WAITING_APPROVAL` без cycle, offer `SENT/APPROVED`, sent invoice, mixed hidden/visible,
mutable item після approval.

Policy — Variant A + C:

1. Automation only for newly created cycles після 4C.
2. No automatic backfill.
3. Read-only reconciliation report класифікує counts/anomalies.
4. Legacy request detail тимчасово використовує legacy UI, якщо batches відсутні.
5. Manual migration можлива лише для deterministic cases після окремого approval; history не
   вигадується.

Dry-run майбутнього reconciliation має показати request IDs/counts за категоріями, але не PII:
status, visible/approved/hidden counts, offers/invoices, candidate/not-candidate reason. Script у
4A не створюється.

## 29. Migration і deployment strategy

Additive ordering:

1. Додати два enums, AuditEntityType/AuditAction enum values.
2. Додати nullable/default `Request.selectionRevisionCounter`.
3. Створити batch і batch-item tables, FKs, regular unique/index/check constraints.
4. Створити partial unique active-SENT index raw SQL.
5. Опційно додати nullable offer/invoice linkage columns та indices.
6. `prisma generate`, validate, migration test на local PostgreSQL.
7. Deploy schema before application code that writes batches.
8. Deploy 4B dormant service; потім 4C send; потім 4D read model; потім Stage 5 decisions.

Не видаляти current flags/columns і не backfill у migration. PostgreSQL enum rollback не є
простим: application rollback має толерувати додані values; destructive enum removal не планувати.
Перед `migrate deploy`: read-only production preflight, backup/restore readiness і підтвердження,
що Stage 2 migration застосована.

## 30. Test matrix

| # | Scenario | Level |
| ---: | --- | --- |
| 1–4 | first revision, full snapshot, immutable after source edit, one active batch | integration |
| 5–10 | concurrent/repeat send, empty/hidden/foreign item, terminal request | unit + integration |
| 11–12 | `DRAFT→SENT`, Request `IN_PROGRESS→WAITING_APPROVAL` | integration |
| 13–15 | Telegram success/failure/retry | integration + manual |
| 16–20 | partial/full approval, item/batch rejection, supersede | unit + integration + E2E |
| 21–23 | stale revision, double approval, two clients | integration |
| 24–25 | foreign company, manager invoking client event | authorization integration |
| 26–29 | history, batch audit, request audit, rollback | integration + static check |
| 30 | invoice only after approved batch | integration |
| 31–32 | legacy visible/approved flags | integration + manual regression |
| 33–36 | full lifecycle, mobile, Telegram deep link, revalidation | E2E + manual regression |

Додатково: migration test partial unique/check constraints; canonical hash fixtures; source delete
retains snapshot; offer/invoice provenance; no snapshot fields in Audit Log.

## 31. Risks і blockers

| Severity | Ризик | Mitigation |
| --- | --- | --- |
| High | Stage 2 migration pending on configured remote Neon | Apply only through separately approved deployment |
| High | Current client flow can approve mutable live data | Do not wire Stage 5 before 4B/4C/4D |
| High | Partial unique index is migration SQL, not Prisma annotation | Migration test + drift review |
| High | Source edit/delete races send | Transaction lock/version guard |
| Medium | Notification is not durable outbox | Extend in 4C |
| Medium | Company has multiple possible approvers | Conditional decisions + actor audit; authority policy retained |
| Medium | Legacy requests lack cycles | Forward-only + reconciliation |
| Low | Hash does not itself enforce immutability | No snapshot update API + static/integration tests |

Blocker для Stage 4B: **немає**. Blocker для production activation: pending migrations, відсутність
4C/4D/5 та production approval.

## 32. Implementation roadmap 4B–5

### Stage 4B — Selection batch foundation

- enums, models, relations, constraints та additive migration;
- atomic revision allocator;
- typed snapshot/hash builder;
- dormant create/supersede/resolve services;
- Audit Log enums/writers;
- unit/integration/static checks;
- без зміни current send, client UI, Telegram та Request status triggers.

### Stage 4C — Send for approval trigger

- canonical send service;
- explicit selected drafts;
- atomic batch create/snapshot/supersede/send;
- `SELECTION_SENT_FOR_APPROVAL`;
- compatibility visibility projection;
- post-commit durable Telegram delivery;
- revalidation/concurrency tests.

### Stage 4D — Approval read model migration

- admin working-items vs revisions UI;
- client immutable active batch UI;
- old revisions/history;
- stale handling, mobile, deep link;
- legacy fallback;
- без client decision trigger.

### Stage 5 — Client approval trigger

- item/approve-all/reject commands;
- active/stale/company guards;
- aggregate decision;
- `CLIENT_SELECTION_APPROVED`;
- history/audit/concurrency;
- invoice eligibility from approved batch.

## 33. Перелік файлів для наступних stages

Ймовірний 4B scope:

```text
prisma/schema.prisma
prisma/migrations/<timestamp>_add_request_selection_batches/migration.sql
lib/request-selection/contracts.ts
lib/request-selection/snapshot.ts
lib/request-selection/service.ts
lib/audit-log/presentation.ts
scripts/check-request-selection-batch.ts
package.json
docs/reports/stage-request-status-automation-4b-selection-batch-foundation.md
```

4C:

```text
app/admin/actions.ts
app/admin/requests/[id]/page.tsx
lib/request-selection/send.ts
lib/telegram/notifications.ts
lib/requests/status-transition.ts (лише якщо integration contract потребує)
tests/scripts Stage 4C
```

4D/5:

```text
app/client/requests/[id]/page.tsx
app/client/actions.ts
app/admin/requests/[id]/page.tsx
lib/client/access.ts
lib/request-selection/queries.ts
lib/invoices/service.ts
```

## 34. Фінальні архітектурні рішення

1. Source of truth: `RequestSelectionBatch`.
2. Immutable snapshot: так.
3. Snapshot fields: повний typed client-visible item/price/currency/vehicle contract із розділу 16.
4. Active batch: єдиний `status=SENT` batch request.
5. Revision: atomic `Request.selectionRevisionCounter`, не `MAX/count + 1`.
6. Approval: item-level із atomic approve-all convenience.
7. Full approval: non-empty active batch, усі items `APPROVED`, жодного `PENDING/REJECTED`.
8. Rejection: item rejection завершує batch `REJECTED`; новий send створює revision.
9. Request regression: ні; лишається `WAITING_APPROVAL`.
10. CommercialOffer: downstream, optional FK до approved batch та exact batch items.
11. Invoice: створюється з approved batch snapshot, optional FK до batch/items.
12. Telegram failure: не rollback-ить DB success.
13. Legacy: legacy UI/fallback + read-only reconciliation.
14. Backfill: автоматичний не потрібен; лише окремий deterministic/manual за approval.
15. Stage 4B: dormant schema/domain foundation, без production trigger/UI/Telegram.

## 35. Підсумковий висновок

Current `RequestItem` flags не можуть бути approval contract через mutable live-item problem.
`CommercialOffer` має корисний фінансовий snapshot, але змішує інший lifecycle і не підключений до
фактичного selection flow. Окремий `RequestSelectionBatch` найменш двозначно розділяє manager
working data, client-approved revision та downstream documents.

Архітектура готова до Stage 4B: typed immutable snapshots, one-active-SENT DB invariant, atomic
request-scoped revision counter, item decisions, explicit rejection/supersede rules і
transaction/post-commit boundaries визначені. Stage 4B у межах цього аудиту не розпочинався.
