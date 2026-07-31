# Stage Request Status Automation 3 — Draft selection trigger

Дата виконання: 2026-07-27.

## 1. Executive summary

У гілці `develop` підключено перший production trigger до Stage 2 transition service:

```text
успішний RequestItem draft create
→ SELECTION_DRAFT_CREATED
→ NEW переходить у IN_PROGRESS
```

Обидва production create paths тепер делегують одному `createRequestItemDraft()` service. `RequestItem.create`, item Audit Log, conditional status transition, `RequestStatusHistory` і status Audit Log виконуються в одній Prisma transaction.

Реалізовано:

- trusted actor тільки з server-side CRM session;
- примусове `visibleToClient=false`;
- `COMPLETED` і `CANCELLED` блокуються до create;
- concurrent terminal transition rollback-ить draft;
- `IN_PROGRESS` дає успішний `noop`;
- пізніші та legacy statuses не регресують;
- `blocked` у non-terminal ambiguous status не скасовує законний draft create;
- обидва production entry points мають однакову domain behavior;
- tests перевіряють atomicity, actor, history, audits, authorization, concurrency і regression;
- triggers Stages 4–6 не підключалися.

Нова migration не створювалася. Configured remote Neon не змінювався.

## 2. Git і стан гілки develop

Pre-check:

```text
branch: develop
HEAD: 73d77d952c34851ba572e52f8a6dce57f38b95cd
git status --short: empty
Stage 2 commit contained by: develop
main: f8601836ead73caf7611fd65e2b9db1495042425
```

Stage 2 commit:

```text
73d77d9 feat: add request status transition foundation
```

`main` не checkout-илася і не змінювалася. Feature branch не створювалася.

## 3. Вихідний стан після Stage 2

Перед змінами повністю перечитано:

```text
docs/reports/stage-request-status-automation-1-audit.md
docs/reports/stage-request-status-automation-2-domain-transition-service.md
```

Stage 2 уже надавав:

- `REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED`;
- explicit matrix;
- conditional status update;
- deterministic `changed/noop/blocked`;
- `CONCURRENT_STATUS_CHANGE`;
- existing transaction mode;
- atomic history та allowlisted status Audit Log;
- DB-based actor role guard.

Stage 3 не змінював transition matrix або Prisma schema.

## 4. Аудит RequestItem create flows

Fresh search охопив:

```text
RequestItem
requestItem.create
requestItem.createMany
requestItem.upsert
requestItem.update
requestItem.delete
visibleToClient
createRequestItem
addRequestItem
addSelectedPart
```

Результат:

| Файл | Функція/action | Хто викликає | Створює item | Потребує trigger | Рішення |
| --- | --- | --- | ---: | ---: | --- |
| `app/admin/actions.ts` | `createAdminRequestItem()` | CRM detail form, `ADMIN/MANAGER` | Так | Так | Делегує canonical service |
| `app/api/admin/requests/[id]/items/route.ts` | `POST` | Authenticated CRM API | Так | Так | Делегує canonical service |
| `app/admin/actions.ts` | `updateAdminRequestItem()` | CRM detail form | Ні, update | Ні | Не змінено |
| `app/api/admin/request-items/[itemId]/route.ts` | `PATCH/DELETE` | CRM API | Ні | Ні | Не змінено |
| `lib/change-requests/apply.ts` | approved item field update | Change Request review | Ні | Ні | Не змінено |
| `lib/commercial-offers/service.ts` | створення snapshot offer items | CRM offer flow | Не створює `RequestItem` | Ні | Не змінено |
| `lib/invoices/service.ts` | створення invoice items із request items | CRM invoice flow | Не створює `RequestItem` | Ні | Не змінено |
| `prisma/seed.ts` | dev fixtures | Explicit dev seed | `RequestItem` create не знайдено | Ні | Не змінено |
| scripts/tests | isolated mocks | Verification only | Не production DB | Ні | Без production trigger |

`requestItem.createMany` і `requestItem.upsert` для production flow не знайдені. Copy/duplicate/bulk create flow відсутній.

Після рефакторингу єдина production `requestItem.create()` знаходиться у:

```text
lib/request-items/create-draft.ts
```

## 5. Canonical create flow

Canonical service:

```text
lib/request-items/create-draft.ts
→ createRequestItemDraft()
```

Flow:

```text
Server Action або API
→ active CRM authentication
→ existing parser validation
→ createRequestItemDraft()
→ prisma.$transaction(async tx => {
    Request lookup + lifecycle guard
    RequestItem.create(visibleToClient=false)
    REQUEST_ITEM_CREATED Audit Log
    transitionRequestStatus({ tx, event: SELECTION_DRAFT_CREATED })
  })
→ scoped revalidation/response
```

Server Action і API більше не дублюють `RequestItem.create` та item audit transaction.

## 6. Draft semantics

`RequestItem` не має окремого status або `sentAt`.

Фактична семантика:

| Стан item | Поля |
| --- | --- |
| Draft | `visibleToClient=false` |
| Надіслано/видимо | `visibleToClient=true` |
| Погоджено клієнтом | `approvedByClient=true`, `approvedAt != null` |
| Включено в invoice | `includeInInvoice=true` |

Canonical service ігнорує `visibleToClient` із parsed input та завжди записує:

```text
visibleToClient=false
```

Отже Stage 3 trigger означає саме створення підготовчої чернетки, а не send-for-approval.

Поточна validation не вигадувалася заново. Використовується `parseRequestItemInput()` з чинними required/type/price/quantity rules.

## 7. Authorization і actor source

Server Action:

```text
requireCrmSession()
```

API:

```text
getCrmApiSession()
```

Обидві функції повторно звіряють session із current active `User` у DB та допускають лише `ADMIN/MANAGER`.

До canonical service передається тільки:

```ts
actor: {
  id: authenticatedSession.user.id
}
```

Role, name та email не читаються з form/JSON payload. `transitionRequestStatus()` повторно читає actor role з DB, а `writeAuditLog()` створює DB snapshot.

Поточна CRM authorization model є global для `MANAGER/ADMIN`: assignment/company scoping не ввімкнено. Тому будь-яка існуюча request у CRM доступна обом ролям; Stage 3 не створював паралельну ownership policy. Підміна неіснуючого `requestId` повертає controlled not-found і не створює item.

## 8. Request lifecycle guards

Остаточна policy:

| Request.status | Item create | Event result | Status behavior |
| --- | --- | --- | --- |
| `NEW` | Дозволено | `changed` | `IN_PROGRESS` |
| `IN_PROGRESS` | Дозволено | `noop` | Без зміни |
| `OFFER_PREPARING` | Дозволено | `blocked: invalid_transition` | Без регресії |
| `WAITING_APPROVAL` | Дозволено | `blocked: invalid_transition` | Без регресії; revision flow не вигадується |
| `AWAITING_INVOICE` | Дозволено | `blocked: invalid_transition` | Без зміни |
| `INVOICE_SENT` | Дозволено | `blocked: invalid_transition` | Без зміни |
| `AWAITING_SHIPMENT` | Дозволено | `blocked: manual_status_locked` | Без зміни |
| `ORDERED` | Дозволено | `blocked: manual_status_locked` | Без зміни |
| `IN_DELIVERY` | Дозволено | `blocked: manual_status_locked` | Без зміни |
| `COMPLETED` | Заборонено | Service не викликається | Controlled lifecycle error |
| `CANCELLED` | Заборонено | Service не викликається | Controlled lifecycle error |

Мінімальні однозначні guards додано лише для terminal statuses. Ambiguous later/legacy statuses не отримали непогодженого hard block.

Якщо request стає terminal після початкового guard, але до conditional transition, `terminal_status` result перетворюється на `REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION`, і вся transaction rollback-иться.

Canonical service розрізняє `REQUEST_NOT_FOUND`, `REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION` і `REQUEST_ITEM_CREATE_FAILED` без повернення Prisma details. Authentication/authorization та transition concurrency лишаються типізованими відповідними caller/Stage 2 boundaries.

## 9. Transaction boundary

В одній transaction виконуються:

```text
Request lookup
RequestItem.create
REQUEST_ITEM_CREATED Audit Log
Request conditional status update
RequestStatusHistory.create
REQUEST_STATUS_CHANGED Audit Log
```

`transitionRequestStatus()` отримує той самий `tx`; nested transaction і global Prisma у transition path не використовуються.

При failure item create, history або будь-якого audit write:

- item не залишається;
- status не змінюється;
- history не залишається;
- Audit Log не залишається.

## 10. Інтеграція SELECTION_DRAFT_CREATED

Єдиний виклик production trigger знаходиться у:

```text
lib/request-items/create-draft.ts
```

Виклик:

```ts
transitionRequestStatus({
  requestId,
  event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
  actor,
  reason: 'Підібрану позицію створено як чернетку',
  metadata: {
    source: 'ADMIN_CRM',
    eventKey: `request-item:${item.id}`,
    triggerEntityType: 'REQUEST_ITEM',
    triggerEntityId: item.id
  },
  tx
})
```

Trigger запускається тільки після server validation і успішного `RequestItem.create`.

Окремий `count()` не виконується. Current request status є transition source of truth.

Legacy request із уже наявними items, але status `NEW`, при наступному валідному draft create перейде у `IN_PROGRESS`. Це forward-only repair від нової реальної події, не backfill і не reconciliation.

## 11. Changed/noop/blocked behavior

### `changed`

```text
NEW → IN_PROGRESS
```

Item, item audit, status, history та status audit commit-яться разом.

### `noop`

```text
IN_PROGRESS + SELECTION_DRAFT_CREATED
```

Item та item audit commit-яться. Status/history/status audit не дублюються.

### `blocked`

- `terminal_status`: item create заборонено/rollback;
- `manual_status_locked`: item дозволено, status без зміни;
- `invalid_transition`: item дозволено, status без зміни.

Automation policy не підміняє окрему lifecycle policy.

## 12. Concurrency та idempotency

Два managers можуть одночасно створити drafts у `NEW`:

1. обидва створюють валідний item у своїй transaction;
2. один conditional update виграє `NEW → IN_PROGRESS`;
3. другий `updateMany` отримує `count=0`;
4. fresh read бачить `IN_PROGRESS`;
5. другий event стає deterministic `noop`;
6. один history та один status audit.

Tests перевіряють first/second item і simulated parallel winner.

Паралельна manual status зміна не перезаписується: conditional update дає `noop`, `blocked` або typed `CONCURRENT_STATUS_CHANGE`. Unresolved concurrency rollback-ить item і не маскується як success.

Status-event idempotency не є form idempotency. Подвійний submit тієї самої форми все ще може створити два різні items; це відомий ризик чинної архітектури. Водночас status history/audit не дублюються після першого transition.

## 13. RequestStatusHistory

Для першого item у `NEW` створюється рівно один:

```text
oldStatus: NEW
newStatus: IN_PROGRESS
changedByUserId: authenticated actor ID
```

History не створюється:

- для другого item у `IN_PROGRESS`;
- для blocked transition;
- для invalid item;
- при item create failure;
- при transaction rollback.

## 14. Audit Log

Зберігаються два різні business facts:

1. `REQUEST_ITEM_CREATED`;
2. `REQUEST_STATUS_CHANGED`, лише коли status реально змінився.

Status audit:

```text
before: { status: NEW }
after: { status: IN_PROGRESS }
metadata:
  businessEvent: SELECTION_DRAFT_CREATED
  reason: Підібрану позицію створено як чернетку
  automatic: true
  source: ADMIN_CRM
  eventKey: request-item:<id>
  triggerEntityType: REQUEST_ITEM
  triggerEntityId: <id>
```

Item audit зберігає тільки чинний allowlisted snapshot. Повний item/request/form payload, PII, private URLs і secrets не пишуться.

Actor snapshot формується `writeAuditLog()` із DB:

```text
actorName
actorEmail
actorRole
```

Другий draft створює новий item audit, але не дублює status-change audit.

## 15. Revalidation і UI compatibility

Після успішного create обидва entry points revalidate:

```text
/admin
/admin/requests
/admin/requests/<requestId>
```

Server Action додатково зберігає чинну revalidation client vehicle detail.

Тому dashboard/list/detail отримують новий `IN_PROGRESS` badge. UI redesign або toast для automation не додано.

Для terminal guard додано лише controlled повідомлення:

```text
Не можна додавати позиції до виконаної або скасованої заявки.
```

Draft лишається невидимим клієнту.

## 16. Tests

Новий verification:

```text
scripts/check-request-status-stage3-draft-trigger.ts
npm.cmd run test:request-status-stage3
```

Покрито:

- повну matrix поведінку draft event для 11 statuses;
- lifecycle allow/deny table;
- first item `NEW → IN_PROGRESS`;
- one transaction;
- `visibleToClient=false`;
- one history;
- one item audit і one status audit;
- actor snapshot;
- allowlisted correlation metadata;
- second item no-op без duplicate history/status audit;
- simulated parallel winner;
- invalid parser input до transaction;
- item create failure;
- history failure rollback;
- status audit failure rollback;
- `COMPLETED/CANCELLED`;
- missing/spoofed request ID;
- CLIENT rollback/forbidden;
- MANAGER та ADMIN success;
- static authentication-before-service;
- відсутність direct create у Server Action/API;
- відсутність Stage 4–6 events у canonical service.

Окремо пройшов Stage 2 suite:

```text
npm.cmd run test:request-status
```

Real-DB integration і authenticated browser regression не запускалися, бо доступна конфігурація вказує лише на remote Neon із pending migration.

## 17. Regression results

Статично підтверджено:

- create form і admin API використовують canonical service;
- edit/delete flows не змінені;
- send-for-approval не змінений;
- client approval не змінений;
- Invoice flow не змінений;
- manual status flow не змінений;
- Telegram не імпортується canonical service;
- client item queries і visibility model не змінені;
- raw enum не додавався в UI;
- RequestItem validation не змінювалася.

Manual checklist із CRM request/history/full ADMIN Audit Log лишається pending. Це не позначено як runtime PASS.

## 18. Database і migration safety

Нова migration у Stage 3 не створювалася.

Read-only:

```text
npx.cmd prisma migrate status
```

Configured datasource:

```text
database: neondb
host: ep-wandering-…eu-central-1.aws.neon.tech
class: remote Neon; local/test identity не підтверджена
```

Результат:

```text
37 migrations found
20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses pending
```

Non-zero exit є очікуваним результатом pending Stage 2 migration, а не новою Stage 3 migration failure.

Не виконувалися:

```text
prisma migrate dev
prisma migrate deploy
prisma db push
prisma migrate reset
prisma db seed
```

Remote/production DB не змінювалася.

## 19. Змінені файли

```text
app/admin/actions.ts
app/admin/requests/[id]/page.tsx
app/api/admin/requests/[id]/items/route.ts
docs/reports/stage-request-status-automation-3-draft-selection-trigger.md
lib/request-items/create-draft.ts
package.json
scripts/check-request-status-stage3-draft-trigger.ts
```

Prisma schema та migrations не змінювалися.

## 20. Відомі обмеження

- Немає form idempotency key: double submit може створити duplicate item.
- Немає safe local/test PostgreSQL DB для real transaction test.
- Manual/browser regression pending.
- `MANAGER` має чинний global CRM scope; assignment/company write scoping не реалізовано.
- Ambiguous later statuses дозволяють draft item без status regression до затвердження revision/reopen policy.
- Stage 2 migration лишається pending на configured remote Neon.

## 21. Що свідомо не входило у Stage 3

Не змінювалися:

- RequestItem edit/delete;
- send-for-approval;
- approval batch/revision;
- client approve/reject;
- Commercial Offer;
- Invoice lifecycle;
- manual Request status;
- Telegram/email notifications;
- status dropdown;
- Prisma schema/migrations;
- existing data/reconciliation.

Не підключалися:

```text
SELECTION_SENT_FOR_APPROVAL
CLIENT_SELECTION_APPROVED
INVOICE_SENT
```

## 22. Готовність до Stage 4

Stage 3 technical scope завершено і не має власного blocker.

Для безпечного Stage 4 існує невирішений business/schema blocker:

```text
потрібно затвердити єдине джерело approval cycle:
RequestSelectionBatch або CommercialOffer
```

Без active batch/revision повторний send не має надійної cycle identity. Тому Stage 4 implementation не слід починати до цього рішення або явного включення batch design/implementation у scope Stage 4.

## 23. Підсумковий висновок

Stage 3 централізував усі production RequestItem create paths і атомарно підключив лише `SELECTION_DRAFT_CREATED`. Перша валідна draft у `NEW` переводить request в `IN_PROGRESS`; наступні та пізніші events не дублюють history/audit і не створюють regression.

Terminal requests захищені, actor trusted, item завжди hidden, а transaction failure не залишає partial state. Stage 4–6 behavior, schema та remote data не змінювалися.
