# Stage Request Status Automation 4C — Send for approval trigger

## 1. Executive summary

Stage 4C підключив фактичну admin-дію «Відправити на погодження» до immutable
`RequestSelectionBatch` foundation зі Stage 4B. Усі DB-зміни виконуються в одній
транзакції: валідація source versions, supersede попереднього active `SENT`
batch, створення нової revision, `DRAFT → SENT`, legacy visibility/reset,
Audit Log та `SELECTION_SENT_FOR_APPROVAL`.

Telegram викликається лише після commit і не є source of truth. Schema та
migrations у цьому етапі не змінювалися.

## 2. Git і стан гілки develop

- Робоча гілка на початку і наприкінці реалізації: `develop`.
- Початковий `HEAD`: `1048546801aa2f9944f3e7be5ee9c10e7225a160`.
- Commit Stage 4B `1048546801aa2f9944f3e7be5ee9c10e7225a160` міститься у `develop`.
- `main` не checkout-ився і не змінювався.
- Push не виконувався.

## 3. Вихідний стан після Stage 4B

Stage 4B уже надав:

- `RequestSelectionBatch` і `RequestSelectionBatchItem`;
- атомарний `selectionRevisionCounter`;
- immutable snapshots і hashes;
- lifecycle `DRAFT/SENT/APPROVED/REJECTED/SUPERSEDED`;
- partial unique index для одного active `SENT` batch на Request;
- batch-level audit та typed errors;
- standalone і existing-transaction режими.

Production `sendAdminRequestItemsForApproval()` до Stage 4C напряму встановлював
`visibleToClient=true`, писав legacy audit і запускав Telegram, але не створював
batch та не застосовував domain status event.

## 4. Аудит production send entry points

| Файл | Function/action | Production | DB changes | Telegram | Canonical decision |
| ---- | --------------- | ---------: | ---------- | -------- | ------------------ |
| `app/admin/requests/[id]/page.tsx` | form action | так | ні | ні | Передає IDs та expected `updatedAt` |
| `app/admin/actions.ts` | `sendAdminRequestItemsForApproval()` | так | через service | через service | Єдиний trusted server entry point |
| `lib/request-selection/send-for-approval.ts` | `sendRequestSelectionForApproval()` | так | одна transaction | post-commit | Canonical orchestration service |
| API routes | окремого send flow не знайдено | ні | — | — | Не додавався |
| Alternate/bulk admin UI | не знайдено | ні | — | — | Не додавався |
| Telegram handlers/scripts | send flow не знайдено | ні | — | — | Не додавався |

Search охопив `sendAdminRequestItemsForApproval`, `visibleToClient`,
`approvedByClient`, Telegram helpers, admin/API/scripts. Інших production
entry points немає.

## 5. Canonical send service

API:

```ts
sendRequestSelectionForApproval({
  requestId,
  requestItemIds,
  expectedRequestItemVersions,
  actor: { id },
  requestContext
})
```

Factory `createSendRequestSelectionForApprovalService(database, dependencies)`
дозволяє isolated transaction tests. Production export прив'язаний до `prisma`
та фактичних Stage 4B/Stage 2 services.

Результат містить `batchId`, `revision`, `itemCount`, superseded batch,
кількість прихованих старих source items, outcome status transition та
post-commit notification result.

## 6. Authorization і actor source

Actor ID походить лише з `requireCrmSession().user.id`. FormData не може
підмінити actor. Stage 4B services повторно перевіряють існування, `ACTIVE`
status і роль `ADMIN`/`MANAGER`.

`CLIENT` та inactive actor отримують typed `ACTOR_NOT_ALLOWED`.
Unauthenticated request зупиняється `requireCrmSession()` до canonical service.

## 7. Selection validation

Перевіряються:

- Request існує;
- selection не порожня;
- IDs унікальні;
- кожен `RequestItem` існує;
- кожен item належить саме цьому Request;
- кожен selected item є поточною hidden draft position;
- expected versions повністю і однозначно відповідають selection;
- snapshot source проходить Stage 4B validation.

Client-provided IDs не є авторизаційним джерелом: ownership та actor
перевіряються server-side всередині транзакції.

## 8. Nullable price policy

`salePrice=null` не блокує send. Stage 4B snapshot зберігає його як
`approvedUnitPrice=null`; значення не перетворюється на `0`.

Поточний UX погоджує сумісність/позицію, а не гарантує фінальну price
completeness. CommercialOffer та Invoice зберігають свої окремі guards.
У фактичній schema `currency` є required string із default `UAH`; Stage 4C
його не послаблював.

## 9. Source version protection

Admin form передає для кожного hidden item точний ISO `updatedAt`. Service
порівнює всі versions перед mutation, після чого Stage 4B create service
повторно перевіряє їх у тій самій transaction перед snapshot creation.

Mismatch дає `SOURCE_ITEM_VERSION_CONFLICT`; UI просить оновити сторінку.

## 10. Transaction boundary

Один зовнішній `prisma.$transaction()` охоплює:

1. Request/status validation.
2. Active `SENT` lookup та duplicate-operation guard.
3. Source ownership/version/draft validation.
4. `SUPERSEDE` попереднього active batch.
5. Створення нової immutable revision.
6. `DRAFT → SENT`.
7. Legacy visibility та approval reset.
8. Legacy Request audit.
9. `SELECTION_SENT_FOR_APPROVAL` через transition service.
10. Batch audits, Request status history та Request status audit.

Stage 4B services отримують той самий `tx`; nested independent transactions
немає. Будь-яка DB/domain помилка rollback-ить весь цикл, включно з revision
counter.

## 11. Active batch supersede

Якщо існує active `SENT` batch, він переходить у `SUPERSEDED` через
`transitionRequestSelectionBatchStatus()`. Його snapshots не змінюються.

Якщо concurrent actor уже змінив lifecycle старого batch, поточна transaction
отримує controlled `BATCH_SUPERSEDE_FAILED` і rollback.

## 12. New revision creation

`createRequestSelectionBatchDraft()` викликається з ordered IDs, expected
versions, trusted actor, `ADMIN_CRM`, request context і тим самим `tx`.

Revision виділяється атомарним increment `Request.selectionRevisionCounter`.
Помилка пізніше у flow rollback-ить increment.

## 13. Batch DRAFT → SENT

Новий batch одразу після creation переходить через lifecycle event `SEND`.
Empty aggregate guard, actor guard і partial unique active-`SENT` invariant
залишаються відповідальністю Stage 4B service/database.

Blocked/concurrent result не вважається успіхом та rollback-ить transaction.

## 14. Legacy visibleToClient compatibility

Поточний client read model читає `RequestItem` з
`where: { visibleToClient: true }`; Stage 4D snapshot read model ще не
підключений.

Тому selected source items нового batch отримують `visibleToClient=true`.
Source items попереднього superseded batch, яких немає у новій selection,
отримують `visibleToClient=false`. Це не дозволяє legacy UI змішати revisions.

Ризик до Stage 4D: client approval все ще працює з live `RequestItem`, а не з
immutable batch items.

## 15. Legacy approval flags

Лише selected source items нової revision отримують:

```text
approvedByClient=false
approvedAt=null
includeInInvoice=false
visibleToClient=true
```

Це прибирає stale approval/invoice state для нової revision. Старі items, які
не увійшли до selection, лише приховуються; їхні approval flags не reset-яться.

## 16. Request SELECTION_SENT_FOR_APPROVAL transition

Прямого `Request.status` update у canonical service немає. Викликається:

```text
transitionRequestStatus(SELECTION_SENT_FOR_APPROVAL)
```

Transitions:

- `IN_PROGRESS → WAITING_APPROVAL`;
- `OFFER_PREPARING → WAITING_APPROVAL`;
- `WAITING_APPROVAL → noop`.

## 17. Repeat send behavior

Repeat send у `WAITING_APPROVAL`:

- supersede попередній active `SENT`;
- створює наступну revision;
- переводить її у `SENT`;
- зберігає Request у `WAITING_APPROVAL`;
- не створює повторний `RequestStatusHistory`;
- створює supersede/create/send/legacy batch-cycle audits.

## 18. Request lifecycle guards

Send дозволено лише з:

```text
IN_PROGRESS
OFFER_PREPARING
WAITING_APPROVAL
```

`NEW`, `AWAITING_INVOICE`, `INVOICE_SENT`, `AWAITING_SHIPMENT`, `ORDERED`,
`IN_DELIVERY`, `COMPLETED`, `CANCELLED` блокуються
`REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND`.

Manual status race додатково ловиться CAS/decision у Stage 2 transition service;
помилка rollback-ить batch transaction.

## 19. Telegram post-commit flow

Після успішного повернення `database.$transaction()` викликається чинний
`sendTelegramRequestItemsApprovalNotification({ requestId })`.

Message та inline button не змінювалися. URL лишається:

```text
/client/requests/{requestId}
```

Notification table використовується чинним helper як `PENDING → SENT/FAILED`.

## 20. Telegram failure behavior

Telegram failure не кидається назад у DB transaction і не rollback-ить `SENT`
batch. Result містить:

```text
status=failed
errorCode=TELEGRAM_NOTIFICATION_FAILED
retryable=true
```

Admin UI показує warning, не raw Telegram/Prisma details. Операція DB
залишається успішною.

## 21. Idempotency

Очевидний double click зменшено client pending-button guard.

Server guard порівнює ordered source IDs та source versions з active `SENT`
batch. Повтор того самого payload дає `DUPLICATE_SEND_OPERATION` до mutation.

Справжній repeat send із новими hidden draft items є новою revision, а не
duplicate.

## 22. Concurrency

Захист складається з:

- expected `updatedAt` check;
- повторного version check у Stage 4B snapshot creation;
- atomic revision counter;
- optimistic lifecycle updates;
- partial unique index `RequestSelectionBatch_one_sent_per_request`.

При двох одночасних sends лише один може завершитися з active `SENT`. Loser
отримує stale/version, supersede conflict або
`ACTIVE_SENT_BATCH_CONFLICT`; його transaction rollback-иться.

## 23. RequestStatusHistory

History створює лише Stage 2 transition service і лише при реальній зміні
status. First send створює один запис; repeat у `WAITING_APPROVAL` — жодного.

## 24. Audit Log

В одній transaction створюються:

- `REQUEST_SELECTION_BATCH_CREATED`;
- `REQUEST_SELECTION_BATCH_SENT`;
- за потреби `REQUEST_SELECTION_BATCH_SUPERSEDED`;
- legacy `REQUEST_ITEMS_SENT_FOR_APPROVAL` з `batchId` і `revision`;
- `REQUEST_STATUS_CHANGED` лише якщо status реально змінився.

Audit failure rollback-ить transaction і мапиться на
`AUDIT_WRITE_FAILED`. Request context передається batch та legacy audits.
Stage 2 status audit API поки не приймає `AuditRequestContext`; це не
розширювалося в Stage 4C.

## 25. Revalidation і UI compatibility

Після commit revalidate:

- `/admin`;
- `/admin/requests`;
- `/admin/requests/{requestId}`;
- `/client`;
- `/client/requests`;
- `/client/requests/{requestId}`.

UI зміни мінімальні: hidden IDs/versions, controlled messages і pending submit
button. Batch history/revision selector/client snapshot UI не додавалися.

## 26. Error model

Canonical typed codes:

```text
REQUEST_NOT_FOUND
ACTOR_NOT_FOUND
ACTOR_NOT_ALLOWED
EMPTY_SELECTION
DUPLICATE_REQUEST_ITEM_IDS
REQUEST_ITEM_NOT_FOUND
REQUEST_ITEM_NOT_IN_REQUEST
SOURCE_ITEM_VERSION_CONFLICT
SOURCE_ITEM_INVALID
REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND
ACTIVE_SENT_BATCH_CONFLICT
DUPLICATE_SEND_OPERATION
BATCH_CREATE_FAILED
BATCH_SUPERSEDE_FAILED
BATCH_SEND_FAILED
VISIBILITY_UPDATE_FAILED
AUDIT_WRITE_FAILED
REQUEST_STATUS_TRANSITION_FAILED
TELEGRAM_NOTIFICATION_FAILED
```

UI розкриває лише controlled result messages.

## 27. Tests

Додано `npm.cmd run test:request-status-stage4c`.

Harness перевіряє:

- `IN_PROGRESS` та `OFFER_PREPARING` send;
- `WAITING_APPROVAL` repeat/noop;
- later/terminal/`NEW` guards;
- first revision і repeat revision;
- supersede та old-source visibility policy;
- selected approval reset;
- nullable price без `0`;
- missing/foreign/duplicate/empty/stale selection;
- actor guards;
- duplicate operation;
- active partial-unique conflict mapping;
- rollback create/snapshot/supersede/send/status/audit/visibility failures;
- revision/history/visibility rollback;
- Telegram виключно після commit;
- Telegram failure без DB rollback.

Результат: passed.

## 28. Regression results

Passed:

- `npm.cmd run test:request-selection-batch`;
- `npm.cmd run test:request-status`;
- `npm.cmd run test:request-status-stage3`;
- `npx.cmd tsx scripts/check-admin-audit-log-2.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-3.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-4.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-5.ts`;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

Stage 4B та Audit Log 3 static assertions оновлено лише для нового canonical
production wiring; domain assertions не послаблені.

## 29. Migration і DB safety

- Prisma schema не змінювалася.
- Нова migration не створювалася.
- `npx.cmd prisma validate`: passed.
- `npx.cmd prisma generate`: passed.
- `npx.cmd prisma migrate status`: read-only, 38 migrations знайдено.
- Pending:
  - `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses`;
  - `20260727183000_add_request_selection_batch_foundation`.
- `migrate dev/deploy`, `db push` та інші remote mutations не запускалися.

Stage 4C production runtime залежить від застосування цих migrations окремим
авторизованим deployment process.

## 30. Змінені файли

- `app/admin/actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `components/admin/request-selection-submit-button.tsx`;
- `lib/request-selection/send-for-approval.ts`;
- `scripts/check-request-status-stage4c-send-trigger.ts`;
- `scripts/check-request-selection-batch.ts`;
- `scripts/check-admin-audit-log-3.ts`;
- `package.json`;
- цей report.

CommercialOffer, Invoice, client approval action, Prisma schema та migrations
не змінювалися.

## 31. Відомі обмеження

- Немає durable outbox/retry worker: чинний Notification record покращує
  observability, але process crash між commit і helper call може пропустити
  delivery.
- Client approval до Stage 4D продовжує працювати з live `RequestItem`.
- Немає browser E2E з authenticated ADMIN/CLIENT та реальною Telegram delivery;
  виконані code-backed harness і production build.
- Pending Stage 2/4B migrations не застосовані цим етапом.

## 32. Що свідомо не входило у Stage 4C

- client immutable batch read model;
- client batch approval trigger;
- revision history/selector UI;
- CommercialOffer/Invoice changes;
- outbox subsystem;
- deployment, remote migration, push.

## 33. Готовність до Stage 4D

Canonical active `SENT` batch і immutable item snapshots готові до client
read-model migration. Stage 4D має читати active batch items і перенести
approval decisions із live `RequestItem` на batch item lifecycle, після чого
legacy visibility coupling можна прибрати.

## 34. Готовність до Stage 5

Після Stage 4D можна будувати approval→invoice automation на immutable approved
revision. До цього Invoice лишається захищеним legacy query:
`approvedByClient=true`, `includeInInvoice=true`, `visibleToClient=true`.

## 35. Підсумковий висновок

Stage 4C готовий локально: є один canonical production send flow, усі DB-зміни
циклу атомарні, Request lifecycle змінюється лише domain service, Telegram
post-commit, stale/double-click/concurrency failures контрольовані, а regressions
і build проходять. Remote DB, `main` та production не змінені.
