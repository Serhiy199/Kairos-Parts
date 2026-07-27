# Stage Request Status Automation 1 — Аудит поточної реалізації

Дата аудиту: 2026-07-27.

## 1. Executive summary

Поточна реалізація не має автоматичної state machine для `Request.status`. Статус створюється як `NEW`, а надалі змінюється лише вручну через дві паралельні CRM-точки: `updateAdminRequestStatus()` та `PATCH /api/admin/requests/[id]/status`. Обидві точки записують `RequestStatusHistory` і `AuditLog`, але не перевіряють дозволеність переходу, terminal/manual lock, регресію чи no-op. Server Action після commit запускає notification, API route — ні.

Затверджений ланцюжок не можна реалізувати лише wiring-ом наявних enum values:

- `NEW`, `IN_PROGRESS`, `WAITING_APPROVAL`, `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED` існують;
- `AWAITING_INVOICE` («Очікує рахунок») і `INVOICE_SENT` («Рахунок надісланий») відсутні;
- `OFFER_PREPARING`, `ORDERED`, `IN_DELIVERY` залишаються у Prisma enum, але UI нормалізує їх до `IN_PROGRESS` або `AWAITING_SHIPMENT`; формального deprecated marker немає.

Наявні бізнес-події вже достатньо чіткі для трьох переходів:

- успішний create першого `RequestItem` з `visibleToClient=false`;
- успішний `updateMany` під час `sendAdminRequestItemsForApproval()`;
- успішний `Invoice DRAFT -> SENT` у `sendInvoiceToClient()`.

Client approval є архітектурним blocker для Stage 5: `RequestItem` має лише `visibleToClient`, `approvedByClient`, `includeInInvoice`, `approvedAt`; немає approval revision/batch, `sentAt`, active selection set або explicit rejection state. Поточний UI дозволяє клієнту вибрати підмножину видимих позицій, тому «усі позиції актуального циклу погоджено» однозначно визначити не можна.

Рекомендація: Stage 2 має додати централізований transition service, два additive enum values, conditional transition guards, reason/event metadata у history та unit matrix. Бізнес-операції повинні викликати service всередині своєї transaction; зовнішні notifications мають залишитися post-transaction і не визначати успіх внутрішнього переходу.

## 2. Git і стан робочого дерева

Pre-check:

```text
branch: main
HEAD: ba66d53 Merge branch 'infra/production-admin-bootstrap'
git status --short: empty
```

Останні п’ять commits:

```text
ba66d53 Merge branch 'infra/production-admin-bootstrap'
1a7e671 feat(admin): add guarded production admin bootstrap
aa4d636 Merge branch 'infra/github-actions-production-deploy'
3f2bff2 ci: add manual PM2 production deployment workflow
20a88dc docs: finalize PM2 integration report
```

Незакомічених або сторонніх змін до аудиту не було. Аудит безпечний для паралельної роботи. Application code, Prisma schema, migrations і дані БД не змінювалися. Live DB не опитувалася: identity локального `DATABASE_URL` у межах audit-only завдання не підтверджувалася, а code/schema evidence достатньо для плану.

Post-check результати наведені у розділі 25.

## 3. Поточна модель заявки та enum статусів

Джерело істини schema: `prisma/schema.prisma`.

```prisma
enum RequestStatus {
  NEW
  IN_PROGRESS
  OFFER_PREPARING
  WAITING_APPROVAL
  AWAITING_SHIPMENT
  ORDERED
  IN_DELIVERY
  COMPLETED
  CANCELLED
}
```

`Request.status` має тип PostgreSQL/Prisma enum `RequestStatus`, `NOT NULL`, default `NEW` та index `@@index([status])`.

Статуси створені двома migrations:

- `prisma/migrations/20260702094758_init_kairos_parts_schema/migration.sql` — початковий enum без `AWAITING_SHIPMENT`, `Request.status` і `RequestStatusHistory`;
- `prisma/migrations/20260709120000_add_awaiting_shipment_request_status/migration.sql` — additive `AWAITING_SHIPMENT`.

Migration для вилучення чи формальної deprecation `OFFER_PREPARING`, `ORDERED`, `IN_DELIVERY` немає. Вони залишаються валідними DB values.

Порівняння із затвердженою бізнес-моделлю:

| Бізнес-статус | Рекомендований enum | Стан |
| --- | --- | --- |
| Нова | `NEW` | Є |
| Підбір у роботі | `IN_PROGRESS` | Є |
| Очікує підтвердження | `WAITING_APPROVAL` | Є |
| Очікує рахунок | `AWAITING_INVOICE` | Немає |
| Рахунок надісланий | `INVOICE_SENT` | Немає |
| Очікує на відвантаження | `AWAITING_SHIPMENT` | Є |
| Виконано | `COMPLETED` | Є |
| Скасовано | `CANCELLED` | Є |

## 4. Карта поточних статусів

| Enum value | Українська назва | Де використовується | Поточний тип керування | Примітка |
| --- | --- | --- | --- | --- |
| `NEW` | Нова заявка | create flows, UI, filters, dashboard | Default + ручний | Початковий canonical status |
| `IN_PROGRESS` | Підбір у роботі | UI, filters, dashboard, seed | Ручний | Потрібен auto trigger від першого draft item |
| `OFFER_PREPARING` | Підбір у роботі | schema, label/badge compatibility | Legacy, не selectable | `normalizeRequestStatusForSelection()` зводить до `IN_PROGRESS` |
| `WAITING_APPROVAL` | Очікує підтвердження | UI, filters, dashboard, seed | Ручний | Потрібен auto trigger від send-for-approval |
| `AWAITING_SHIPMENT` | Очікує на відвантаження | UI, filters | Ручний | Manual lock, але не terminal: може перейти у `COMPLETED`/`CANCELLED` |
| `ORDERED` | Очікує на відвантаження | schema, label/badge compatibility | Legacy, не selectable | Нормалізується до `AWAITING_SHIPMENT` |
| `IN_DELIVERY` | Очікує на відвантаження | schema, label/badge compatibility | Legacy, не selectable | Нормалізується до `AWAITING_SHIPMENT` |
| `COMPLETED` | Виконано | UI, filters, dashboards | Ручний terminal | Автоматичні події не повинні змінювати |
| `CANCELLED` | Скасовано | UI, filters, dashboards | Ручний terminal | Автоматичні події не повинні змінювати |

`lib/requests/statuses.ts` є централізованим presentation/config модулем, але не domain transition service. `REQUEST_STATUSES` містить лише шість canonical/selectable statuses. `REQUEST_STATUS_ORDER` уже має проміжок до `COMPLETED=7`, однак `AWAITING_SHIPMENT` зараз має order `4`; після додавання етапів рекомендований порядок: `AWAITING_INVOICE=4`, `INVOICE_SENT=5`, `AWAITING_SHIPMENT=6`.

Автоматичних переходів між поточними статусами немає.

## 5. Усі точки зміни статусу

Пошук охопив Prisma create/update/upsert, `RequestStatus`, `RequestStatusHistory`, Server Actions, API routes, Telegram, seed, raw SQL та background code. Runtime raw SQL для зміни `Request.status` не знайдено.

| Файл | Функція/action | Хто викликає | Старий статус | Новий статус | Перевірки | History | Audit Log |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `app/api/requests/route.ts` | `POST` | Authenticated `CLIENT` | Немає | `NEW` | Session, role, input, vehicle ownership | Ні | Ні |
| `lib/telegram/session.ts` | `createTelegramRequest()` | Telegram flow після client lookup | Немає | `NEW` | Draft/client/vehicle validation | Так, nested create; actor null | Ні |
| `app/admin/actions.ts` | `updateAdminRequestStatus()` | `MANAGER` або `ADMIN` | Будь-який DB status | Будь-який із `REQUEST_STATUSES` | Auth + role + allowlist; transition guard відсутній | Так, transaction | Так, `REQUEST_STATUS_CHANGED`; notification після commit |
| `app/api/admin/requests/[id]/status/route.ts` | `PATCH` | `MANAGER` або `ADMIN` | Будь-який DB status | Будь-який із `REQUEST_STATUSES` | Auth + role + allowlist; transition guard відсутній | Так, transaction | Так; notification відсутній |
| `prisma/seed.ts` | `request.upsert()` + `ensureStatusHistory()` | Dev seed | Existing/none | `NEW`, `IN_PROGRESS`, `WAITING_APPROVAL` | `ALLOW_DEV_SEED`; development only | Так, окремо від upsert | Ні |

`lib/change-requests/apply.ts` виконує `tx.request.update()`, але `REQUEST_FIELD_ALIASES` дозволяє лише `description`, `equipmentType`, `model`, `vinOrSerial`; status mass assignment через Change Request не допускається.

Основні висновки:

- два production write-paths ручного status дублюють logic;
- обидва читають current status до transaction;
- немає allowed transition matrix;
- same-status submit створює зайві history/audit/notification;
- terminal/manual statuses не захищені;
- API і Server Action мають різну post-commit поведінку;
- `CLIENT` не може напряму передати довільний `Request.status`.

## 6. RequestStatusHistory

Модель:

```text
RequestStatusHistory
- id
- requestId
- oldStatus nullable
- newStatus
- changedByUserId nullable
- createdAt
```

Є cascade від `Request`, `changedByUserId` має `onDelete: SetNull`. Немає:

- `reasonCode`;
- comment/reason;
- `source`;
- event/business key;
- metadata;
- correlation з item batch/invoice;
- unique/idempotency constraint.

Manual status update записує `Request` і history в одній transaction. Telegram create також створює initial history nested. Client dashboard create у `app/api/requests/route.ts` history не створює. Dev seed upsert і `ensureStatusHistory()` не є однією transaction. Отже статус може існувати без history.

Обидва manual handlers завжди створюють history, навіть коли `oldStatus === newStatus`. Через read-before-transaction два паралельні handlers можуть записати однаковий `oldStatus`, тоді як один із переходів фактично відбувся вже з іншого status.

Відображення:

- CRM detail: `app/admin/requests/[id]/page.tsx`, newest first, actor + `newStatus`;
- public page: `app/(public)/request/status/[token]/page.tsx`, oldest first, без actor;
- public API: `app/api/requests/status/[token]/route.ts`;
- client request detail не показує власну timeline, лише посилання на public status page.

Public page синтезує current row лише коли history повністю порожня. Якщо history застаріла, але не порожня, current status може бути відсутнім у timeline. CRM позначає будь-який null actor як «Система», що не відрізняє initial import, Telegram creation і майбутню system automation.

Рекомендовані reason codes:

- `REQUEST_CREATED`;
- `SELECTION_DRAFT_CREATED`;
- `SELECTION_SENT_FOR_APPROVAL`;
- `CLIENT_SELECTION_APPROVED`;
- `INVOICE_SENT`;
- `MANUAL_SET_AWAITING_SHIPMENT`;
- `MANUAL_SET_COMPLETED`;
- `MANUAL_SET_CANCELLED`;
- `ADMIN_OVERRIDE`.

Для idempotency доцільні optional `eventKey` і constrained metadata. Історичні rows можуть залишатися з null у нових optional fields.

## 7. Audit Log

Актуальна функція — `writeAuditLog()` у `lib/audit-log/service.ts`. Вона:

- приймає `Prisma.TransactionClient` або global client;
- snapshot-ить user actor (`actorName`, `actorEmail`, `actorRole`);
- підтримує `USER`, `SYSTEM`, `ANONYMOUS`;
- sanitizes `oldValue`, `newValue`, `metadata` через explicit allowlists;
- відсікає passwords, hashes, tokens, cookies, secrets і private URLs;
- задає retention за category.

`REQUEST_STATUS_CHANGED` і `REQUEST` уже існують; новий AuditAction для автоматичного переходу не потрібен. Category для lifecycle transition може залишитися `STANDARD`.

Статична перевірка `scripts/check-admin-audit-log-2.ts` забороняє direct create поза service та update/delete/upsert AuditLog у application code. Повний журнал захищений ADMIN-only routes. `MANAGER` activity page фільтрується fixed actor ID і не є повним журналом.

Рекомендований запис кожного status transition:

```text
entityType: REQUEST
entityId: request.id
action: REQUEST_STATUS_CHANGED
category: STANDARD
actor: user, який ініціював бізнес-подію
oldValue: { status }
newValue: { status }
metadata:
  source
  reasonCode
  businessEvent
  triggerEntityType
  triggerEntityId
  automatic
  eventKey
```

Automatic transition, що синхронно є наслідком user action, має зберігати реального `MANAGER`/`ADMIN`/`CLIENT` actor, а не приховувати його за `SYSTEM`. `SYSTEM` actor доречний для окремого reconciliation/background process. Business audit (`REQUEST_ITEM_CREATED`, `REQUEST_ITEMS_SENT_FOR_APPROVAL`, `REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED`, `INVOICE_SENT`) і status audit повинні бути окремими, але створюватися в одній transaction та мати correlation metadata.

`lib/audit-log/presentation.ts` не має labels для всіх request statuses (`WAITING_APPROVAL`, `AWAITING_SHIPMENT` і legacy values можуть показуватися raw). Нові enum values також потребуватимуть presentation labels.

## 8. Створення та редагування підібраних позицій

Поточна модель — `RequestItem`.

Approval-related fields:

```text
visibleToClient Boolean @default(false)
approvedByClient Boolean @default(false)
includeInInvoice Boolean @default(false)
approvedAt DateTime?
```

Окремого item status немає. «Чернетка» технічно означає `visibleToClient=false`. Create завжди примусово встановлює false, незалежно від payload.

Write-paths:

- Server Actions у `app/admin/actions.ts`: create/update/delete;
- API routes:
  - `POST /api/admin/requests/[id]/items`;
  - `PATCH /api/admin/request-items/[itemId]`;
  - `DELETE /api/admin/request-items/[itemId]`;
- approved Change Request може редагувати allowlisted fields видимої позиції.

Усі CRM paths вимагають active `MANAGER` або `ADMIN`. Bulk create/import не знайдено. Створення першої позиції не відрізняється від другої; request item count у transaction не перевіряється. Duplicates не блокуються.

Create/update/delete та AuditLog є transactional. Жодна операція не змінює `Request.status` і не перевіряє current request status. Тому позицію можна створити, редагувати або видалити у `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED` чи legacy manual state.

Найкраща технічна подія для `NEW -> IN_PROGRESS`:

```text
успішний RequestItem.create
AND created.visibleToClient = false
AND current Request.status = NEW
```

Перехід має відбутися в тій самій transaction, що й item create та item audit. Порожня/невалідна позиція не проходить parser; downstream failure rollback-ить create. Видалення єдиної draft-позиції не повинно автоматично повертати статус назад. Create у пізнішому/locked status має залишити status без змін або бути окремо заборонений UI/domain policy.

Server Action та API route дублюють item logic; trigger потрібно інтегрувати через спільний domain service, інакше одна точка залишиться без automation.

## 9. Відправлення позицій клієнту

Точна дія — `sendAdminRequestItemsForApproval()` у `app/admin/actions.ts`.

Алгоритм:

1. `MANAGER`/`ADMIN` session.
2. Read усіх `visibleToClient=false` IDs.
3. Transactional `updateMany(... visibleToClient=true)`.
4. Якщо count > 0 — `REQUEST_ITEMS_SENT_FOR_APPROVAL` AuditLog.
5. Після commit — `sendTelegramRequestItemsApprovalNotification()`.

Немає:

- `sentAt` на item;
- batch/revision ID;
- explicit pending/rejected status;
- snapshot current selection;
- email delivery у цій дії;
- Request status transition.

Клієнт бачить позиції одразу після DB commit, навіть якщо Telegram відсутній або failed. Telegram створює `Notification(PENDING)` і переводить її у `SENT`/`FAILED`; failure не rollback-ить DB state. Це правильна межа консистентності.

Отже trigger для `IN_PROGRESS -> WAITING_APPROVAL` — успішний DB update із `updated.count > 0`, а не Telegram success. Transition слід включити в ту саму transaction до notification.

Повторне відправлення без нових hidden items повертає no-op. Подвійний клік зазвичай дає один update і один zero-count result, але read IDs відбувається поза transaction; явного request-level idempotency key немає. Нові hidden items можуть бути додані паралельно після первинного read і не потрапити у цей send.

## 10. Підтвердження або відхилення клієнтом

Фактична дія — `approveClientRequestItemsAction()` у `app/client/actions.ts`.

Authorization:

- active `CLIENT` session;
- `getClientAccessContext()`;
- `requestAccessWhere()` обмежує personal/company ownership;
- submitted item IDs мають належати visible items цієї request.

Семантика дії:

- selected visible items: `approvedByClient=true`, `includeInInvoice=true`, `approvedAt=now`;
- усі інші visible items: `approvedByClient=false`, `includeInInvoice=false`, `approvedAt=null`;
- `REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED` AuditLog із CLIENT actor;
- все виконується transactionally.

Це selection model, а не «approve all». Partial selection дозволена й прямо використовується для invoice. Повністю відхилити всі позиції неможливо, бо empty selection відхиляється як `item-selection-required`. Explicit rejection state/reason відсутні. Повторний submit тієї самої selection знову змінює `approvedAt` і створює AuditLog. Duplicate IDs у payload не deduplicate-яться і можуть завищити audit count.

Умова «усі видимі items мають `approvedByClient=true`» може бути обчислена, але не означає «усі актуальні позиції поточного циклу»:

- немає revision/batch;
- видимі items різних send cycles змішані;
- старі items не snapshot-яться;
- manager може редагувати або видалити visible/approved item;
- немає marker активного selection set;
- паралельні CLIENT submits мають last-write-wins.

Тому на основі поточної schema надійно визначити затверджене правило не можна.

Мінімальна additive архітектурна зміна має створити versioned approval aggregate. Рекомендований варіант:

```text
RequestSelectionBatch
- id
- requestId
- revision
- status: DRAFT | SENT | APPROVED | REJECTED | SUPERSEDED
- sentAt
- decidedAt
- createdById

RequestSelectionBatchItem
- batchId
- requestItemId
- snapshot/decision
```

Альтернатива — зробити `CommercialOffer` єдиним approval aggregate, бо він уже snapshot-ить items і має `DRAFT/SENT/APPROVED/REJECTED`. Однак його UI наразі фактично не підключений до request detail, тоді як production flow використовує `RequestItem` selection. Обидва джерела істини одночасно використовувати не можна; рішення потрібне до Stage 4/5.

## 11. Рахунки, документи та CommercialOffer

### Invoice

Окрема production model `Invoice` існує. Статуси: `DRAFT`, `SENT`, `PAID`, `CANCELLED`; є `sentAt`, invoice items, billing snapshots та audit events.

`createInvoiceFromApprovedRequestItems()` створює invoice лише з items, де:

```text
approvedByClient=true
includeInInvoice=true
visibleToClient=true
```

`sendInvoiceToClient()` у `lib/invoices/service.ts` є надійною подією «рахунок надісланий»:

- перевіряє CRM role;
- в transaction вимагає `Invoice.status=DRAFT` і non-empty items;
- встановлює `status=SENT`, `sentAt=now`;
- створює `INVOICE_SENT` financial AuditLog;
- після commit намагається надіслати Telegram text/PDF;
- notification failure не rollback-ить invoice.

Отже `Request -> INVOICE_SENT` має залежати від успішного DB transition invoice, не від Telegram, PDF open/download або file upload.

Concurrency guard invoice наразі не conditional: два паралельні transactions потенційно можуть обидва прочитати `DRAFT` до update. Stage 6 має застосувати conditional update/locking та compose request transition у цій самій transaction.

### RequestDocument і Document

`RequestDocumentType` містить `INVOICE`, `COMMERCIAL_OFFER`, `SPECIFICATION`, `ACT`, `OTHER`. Upload може одразу поставити `visibleToClient=true`; metadata можна змінити пізніше. Окремої send action для `RequestDocument` немає.

`Document` є generic owner/request/vehicle file без document type. Простий upload/visibility будь-якого `Document` не може бути invoice trigger.

Навіть `RequestDocument(type=INVOICE, visibleToClient=true)` не є достатньо надійним trigger, бо:

- не пов’язаний із `Invoice.id`;
- не має invoice lifecycle/status;
- upload і send семантично змішані;
- файл може бути manual/legacy attachment.

### CommercialOffer

`CommercialOffer` є окремою snapshot entity зі status lifecycle та audit events. `sendCommercialOffer()` змінює `DRAFT -> SENT`; client approve/reject services існують. Але request detail UI не використовує цей aggregate, а send offer не є send invoice. Його не можна трактувати як `INVOICE_SENT`.

PDF generation/open (`app/admin/invoices/[invoiceId]/print/page.tsx`, client print page) є rendering/read event, не send event.

## 12. Ручна зміна статусів

CRM dropdown використовує всі шість `REQUEST_STATUSES` для `MANAGER` і `ADMIN`:

```text
NEW
IN_PROGRESS
WAITING_APPROVAL
AWAITING_SHIPMENT
COMPLETED
CANCELLED
```

Legacy statuses не selectable, але detail normalizes їх до canonical option. Server Action та API whitelist payload, тому arbitrary string/legacy value через ці paths не проходить. Дозволеність переходу не перевіряється: можна встановити попередній status, перейти напряму в terminal, повторно записати той самий status або «відкрити» `COMPLETED/CANCELLED`.

Рекомендована модель:

- `MANAGER` і `ADMIN`: normal manual actions лише `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED`;
- automatic statuses не показувати у звичайному manual dropdown;
- exceptional override automatic phase — лише `ADMIN`, окрема action/UI, mandatory reason, explicit confirmation, history reason `ADMIN_OVERRIDE`;
- `COMPLETED` і `CANCELLED` — terminal;
- `AWAITING_SHIPMENT` — manual lock від automation, але дозволяє manual `COMPLETED` або `CANCELLED`;
- legacy `ORDERED`/`IN_DELIVERY` трактувати як `AWAITING_SHIPMENT` lock.

## 13. UI, badges, filters і dashboards

Центральні labels/badges/descriptions знаходяться у `lib/requests/statuses.ts`; `components/client/status-badge.tsx` використовує їх без raw fallback. Для всіх поточних Prisma values labels і colors є.

Покриті surfaces:

- admin dashboard/list/detail;
- admin client/company request views;
- client dashboard/list/detail;
- client vehicle pages;
- public status page/API;
- manual notification message;
- AuditLog presentation частково.

Проблеми:

- admin filters і manual dropdown показують лише `REQUEST_STATUSES`, тому legacy statuses не можна відфільтрувати;
- admin dashboard cards не включають `AWAITING_SHIPMENT` і legacy alias counts;
- `OFFER_PREPARING`, `ORDERED`, `IN_DELIVERY` group counts не агрегуються до canonical cards;
- client pending approval badge визначається за visible `approvedByClient=false`, незалежно від `Request.status`;
- AuditLog presentation не перекладає всі request status values;
- нові `AWAITING_INVOICE`/`INVOICE_SENT` потребуватимуть label, description, badge, order, filters, dashboard, notification та audit presentation;
- dedicated exports/analytics/email templates зі status mapping не знайдені.

Mobile request views використовують той самий `StatusBadge`, тому окремого mobile mapping немає.

## 14. Authorization і payload security

Позитивні властивості:

- CRM Server Actions викликають `requireCrmSession()`;
- CRM API routes викликають `getCrmApiSession()`;
- активна current-user state перевіряється server-side;
- `CLIENT` status mutation відсутня;
- client approval scope захищений `requestAccessWhere()` та item membership;
- item parser не дозволяє client/CRM payload напряму виставити request status;
- Change Request allowlist не містить status;
- Audit payload має PII/secrets denylist.

Ризики:

| Severity | Ризик |
| --- | --- |
| High | `MANAGER` та `ADMIN` можуть змінити будь-яку request у будь-який canonical status без transition/terminal guard |
| High | Client approval не перевіряє request status або active approval batch |
| High | Item create/edit/delete/send не перевіряють manual/terminal request status |
| Medium | CRM item logic продубльована між Server Actions та API; майбутній trigger легко пропустити в одному path |
| Medium | Manager бачить і редагує весь CRM flow, не лише assigned requests; UI прямо зазначає, що assignment scoping не ввімкнено |
| Medium | `requestId` у invoice/offer wrapper використовується для redirect/revalidate, тоді як service працює за `invoiceId`/`offerId`; mismatched payload не змінює чужий invoice для staff, але може revalidate/redirect не той detail |
| Medium | Same/replayed Server Action/API request не має business idempotency key |
| Medium | Duplicate `itemIds` у client approval не нормалізуються |
| Low | Public status token відкриває status/history за possession; це поточний навмисний contract, але token leakage лишається access risk |

Next Server Actions мають framework request protections; JSON API status mutation все одно потребує session та CRM role. Основний ризик не mass assignment, а відсутність domain transition policy та replay/concurrency guards.

## 15. Транзакційність, concurrency та idempotency

### Поточний стан

- manual status: request read до transaction, потім unconditional update + history + audit;
- item create/update/delete: business row + audit transactional;
- send approval: visibility update + audit transactional, Telegram post-transaction;
- client approval: item updates + audit transactional, але request/items snapshot read до transaction;
- invoice send: invoice status + audit transactional, Telegram post-transaction;
- жоден із request transitions не використовує conditional `where: { id, status: expected }`;
- немає optimistic version/event key.

Наслідки:

- lost update між двома managers;
- history може мати неправильний `oldStatus`;
- duplicate history/audit на same transition;
- client double submit оновлює timestamps повторно;
- parallel invoice send може дублювати send audit;
- business row і майбутній request status можуть розійтися, якщо trigger додати після commit.

### Рекомендований pattern

```text
authenticate + authorize
→ validate payload and ownership
→ transaction:
   1. load/lock or conditionally validate current business aggregate
   2. perform business data update
   3. derive business event from committed DB facts
   4. transitionRequestStatus(tx, event, actor, eventKey)
      - resolve target
      - block regression/manual lock
      - conditional update where id + expected status
      - RequestStatusHistory
      - REQUEST_STATUS_CHANGED AuditLog
   5. business AuditLog
→ commit
→ post-transaction notification
```

`transitionRequestStatus()` має приймати caller transaction, а не відкривати власну. Conditional update count `0` повинен призвести до re-read і deterministic `no-op`/`blocked`/retry, не до blind overwrite. Для serializable failures допустимий bounded retry на service boundary.

## 16. Виявлені проблеми й ризики

| Severity | Проблема | Наслідок |
| --- | --- | --- |
| Blocker | Немає `AWAITING_INVOICE` та `INVOICE_SENT` | Затверджений lifecycle не представлений у DB |
| Blocker | Немає approval batch/revision/active selection set | Неможливо довести approval усіх items актуального циклу |
| High | Немає centralized transition service/matrix | Regression і terminal overwrite можливі |
| High | Manual status read поза transaction + unconditional update | Lost update, неправильний history |
| High | Business actions не перевіряють terminal/manual lock | Закриті заявки можна продовжувати змінювати; майбутня automation ризикує регресією |
| High | Client approval last-write-wins без revision | Два users/submits можуть перезаписати рішення |
| Medium | Server Action/API status logic продубльована | Різна поведінка notification/revalidation |
| Medium | Client dashboard create не створює initial history | Неповна timeline |
| Medium | Same-status manual update не є no-op | Duplicate history/audit/notification |
| Medium | Send-for-approval не має `sentAt`/revision | Повторні цикли не ідентифікуються |
| Medium | Invoice send check не conditional | Parallel send може дублювати side effects/audit |
| Medium | Generic `RequestDocument(INVOICE)` співіснує з `Invoice` | Ризик обрати хибний trigger |
| Medium | Dashboard/filter не агрегує legacy statuses | Неточні operational counts |
| Low | History не має reason/source/metadata | Слабка діагностика automation |
| Low | Null history actor показується як «Система» | Неоднозначне походження |
| Low | Audit presentation має неповний status dictionary | Raw enum у журналі |

## 17. Запропонована transition matrix

Запропоновані нові canonical statuses: `AWAITING_INVOICE`, `INVOICE_SENT`.

| Поточний статус | Business event | Цільовий статус | Результат | Причина |
| --- | --- | --- | --- | --- |
| `NEW` | `SELECTION_DRAFT_CREATED` | `IN_PROGRESS` | changed | Перша валідна hidden item створена |
| `IN_PROGRESS` | `SELECTION_DRAFT_CREATED` | — | no-op | Друга/наступна draft item |
| Будь-який пізніший canonical | `SELECTION_DRAFT_CREATED` | — | no-op | Заборона регресії |
| `OFFER_PREPARING` | `SELECTION_DRAFT_CREATED` | — | no-op | Legacy phase еквівалентна `IN_PROGRESS` |
| `NEW` або `IN_PROGRESS` | `SELECTION_SENT_FOR_APPROVAL` | `WAITING_APPROVAL` | changed | DB зафіксувала sent approval batch; `NEW` дозволено як recovery |
| `WAITING_APPROVAL` | `SELECTION_SENT_FOR_APPROVAL` | `WAITING_APPROVAL` | no-op/new revision | Повторний цикл не змінює phase |
| `AWAITING_INVOICE` або `INVOICE_SENT` | `SELECTION_SENT_FOR_APPROVAL` | — | blocked | Повернення потребує окремого approved reopen rule |
| `WAITING_APPROVAL` | `CLIENT_SELECTION_APPROVED` | `AWAITING_INVOICE` | changed | Лише всі items active batch approved |
| `WAITING_APPROVAL` | partial/rejected decision | — | no-op | Рахунок ще не можна створювати за правилом «усі» |
| `AWAITING_INVOICE` | `INVOICE_SENT` | `INVOICE_SENT` | changed | `Invoice DRAFT -> SENT` committed |
| `INVOICE_SENT` | повторний `INVOICE_SENT` | — | no-op | Idempotency, без duplicate history |
| `INVOICE_SENT` | `MANUAL_SET_AWAITING_SHIPMENT` | `AWAITING_SHIPMENT` | changed | Нормальний manual operational step |
| `AWAITING_SHIPMENT` | `MANUAL_SET_COMPLETED` | `COMPLETED` | changed | Manual completion |
| Будь-який non-terminal | `MANUAL_SET_CANCELLED` | `CANCELLED` | changed | Manual cancellation із reason |
| `AWAITING_SHIPMENT` | будь-який automatic event | — | blocked | Manual lock |
| `ORDERED` або `IN_DELIVERY` | будь-який automatic event | — | blocked | Legacy manual lock |
| `COMPLETED` або `CANCELLED` | будь-який automatic event | — | blocked | Terminal |

Відкриття `COMPLETED/CANCELLED`, повернення з `INVOICE_SENT` до approval та реакція на cancellation уже sent invoice не входять до normal matrix. Якщо бізнес це дозволить, потрібен окремий ADMIN-only event з reason, не implicit regression.

## 18. Рекомендована архітектура

Пропонований API:

```ts
type RequestStatusBusinessEvent =
  | 'SELECTION_DRAFT_CREATED'
  | 'SELECTION_SENT_FOR_APPROVAL'
  | 'CLIENT_SELECTION_APPROVED'
  | 'INVOICE_SENT'
  | 'MANUAL_SET_AWAITING_SHIPMENT'
  | 'MANUAL_SET_COMPLETED'
  | 'MANUAL_SET_CANCELLED'
  | 'ADMIN_OVERRIDE';

type RequestTransitionResult =
  | { outcome: 'changed'; from: RequestStatus; to: RequestStatus; historyId: string }
  | { outcome: 'no-op'; status: RequestStatus; reason: string }
  | { outcome: 'blocked'; status: RequestStatus; reason: string }
  | { outcome: 'invalid'; status: RequestStatus; reason: string };

transitionRequestStatus(tx, {
  requestId,
  event,
  actor,
  eventKey,
  trigger,
  requestContext
}): Promise<RequestTransitionResult>
```

Рекомендовані модулі:

- `lib/requests/status-events.ts` — event types, reason codes;
- `lib/requests/status-transitions.ts` — pure matrix/legacy phase normalization;
- `lib/requests/status-service.ts` — DB conditional update + history + audit;
- presentation `lib/requests/statuses.ts` не повинен містити mutation logic.

Service responsibilities:

- один mapping event → target;
- current status/legacy/manual/terminal guards;
- conditional update;
- idempotent no-op;
- history та audit в caller transaction;
- actor snapshot через existing audit service;
- без notification/network calls.

Business handlers залишаються власниками своїх даних та notifications. Прямі `request.update({ status })` поза status service мають бути заборонені static check/test.

## 19. Backward compatibility і наявні заявки

Code audit не підтверджує фактичні production counts; live data не читалися.

Безпечна rollout policy:

- не перераховувати автоматично статуси всіх старих requests;
- automation застосовувати лише до нових бізнес-подій після deploy;
- зберегти legacy enum values і presentation aliases;
- old `OFFER_PREPARING` трактувати як phase `IN_PROGRESS`;
- old `ORDERED`/`IN_DELIVERY` трактувати як manual lock `AWAITING_SHIPMENT`;
- не синтезувати history заднім числом без окремого approved reconciliation.

Existing requests можуть мати:

- items, але `NEW`;
- visible items, але не `WAITING_APPROVAL`;
- approved items без active batch;
- sent invoice при старому request status;
- status без history;
- legacy status.

Автоматичний startup/backfill створив би масові, неаудовані або семантично неоднозначні переходи. Рекомендований окремий read-only reconciliation script, що показує лише counts/anomaly categories. Будь-який write repair — окрема ADMIN-approved операція з dry-run, exact scope, backup gate та audit.

## 20. План migration/data handling

Stage 2 additive migration:

1. Додати до `RequestStatus`:
   - `AWAITING_INVOICE`;
   - `INVOICE_SENT`.
2. Розглянути optional поля `RequestStatusHistory`:
   - `reasonCode String?`;
   - `source String?` або constrained enum;
   - `eventKey String?`;
   - `metadata Json?`.
3. Додати unique idempotency constraint для non-null event key, наприклад composite request/event key.
4. Не вилучати legacy enum values.
5. Не робити data backfill у migration.

Stage 4/5 schema decision:

- preferred `RequestSelectionBatch` + batch items; або
- formal adoption `CommercialOffer` як єдиного approval aggregate.

Перед production migration:

- schema/migration review;
- `prisma generate`;
- local integration DB;
- read-only production preflight counts за statuses/history/items/invoices;
- backup/restore readiness;
- `prisma migrate deploy`, без `db push`.

Після deploy automation працює forward-only. Reconciliation/backfill, якщо буде затверджений, має бути окремим stage/tool і не входить до deploy migration.

## 21. Test matrix

Наявного Jest/Vitest/Playwright suite та `npm test` немає. Є TypeScript static check scripts для AuditLog і Telegram flow, але немає request lifecycle/status integration tests.

| № | Сценарій | Рекомендований рівень | Ключова перевірка |
| --- | --- | --- | --- |
| 1 | Перша draft item у `NEW` | Integration | Item + `IN_PROGRESS` + history + audits atomic |
| 2 | Друга draft item | Unit + integration | Status no-op, без duplicate history |
| 3 | Edit draft item | Integration | Status не регресує/не дублюється |
| 4 | Delete єдиної draft item | Integration | Status не повертається в `NEW` |
| 5 | Send current batch | Integration + E2E | `WAITING_APPROVAL` після DB commit |
| 6 | Повторний send | Integration | New revision або deterministic no-op |
| 7 | Telegram failure після DB | Integration/manual | DB/status збережені, Notification failed |
| 8 | Approval однієї з кількох | Integration + E2E | Немає `AWAITING_INVOICE` |
| 9 | Approval усіх active batch items | Integration + E2E | Один перехід у `AWAITING_INVOICE` |
| 10 | Rejection одного item | Integration + E2E | Status лишається `WAITING_APPROVAL` |
| 11 | Повторний approval | Integration | Idempotent, без duplicate transition |
| 12 | `Invoice DRAFT -> SENT` | Integration + E2E | Request `INVOICE_SENT` atomic |
| 13 | Upload non-invoice document | Integration | Request status не змінюється |
| 14 | Draft після `INVOICE_SENT` | Unit + integration | No regression |
| 15 | Auto event після `AWAITING_SHIPMENT` | Unit + integration | Blocked/manual lock |
| 16 | Auto event після `COMPLETED` | Unit + integration | Blocked/terminal |
| 17 | Auto event після `CANCELLED` | Unit + integration | Blocked/terminal |
| 18 | Два managers одночасно | Integration | Conditional update, один winner |
| 19 | CLIENT передає status | Authorization integration | 403/validation, status unchanged |
| 20 | Чужа company/request/item | Authorization integration + E2E | Not found/forbidden |
| 21 | `RequestStatusHistory` | Integration | Exact old/new/actor/reason/eventKey |
| 22 | AuditLog | Integration + static check | Snapshot, allowlist, correlation, append-only |
| 23 | Badges/filters/dashboard | E2E + manual regression | Усі canonical/legacy labels і counts |
| 24 | Replay/idempotency | Integration | No duplicate history/audit/notification |

Додатково потрібні:

- unit table-driven test усієї transition matrix;
- migration test зі старими enum rows;
- integration test client/company ownership;
- E2E desktop/mobile lifecycle;
- manual production-like notification failure regression.

## 22. Поетапний implementation roadmap

### Stage Request Status Automation 2 — Domain model і transition service

- затвердити `AWAITING_INVOICE`/`INVOICE_SENT`;
- additive enum/history migration;
- event/reason types;
- pure transition matrix;
- caller-transaction status service;
- conditional update/idempotency;
- manual/terminal/legacy guards;
- history + AuditLog;
- table-driven unit tests і static prohibition direct status writes.

### Stage Request Status Automation 3 — Draft selection trigger

- об’єднати/делегувати Server Action та API item create logic;
- виклик `SELECTION_DRAFT_CREATED` в item-create transaction;
- тільки first effective transition;
- terminal/manual lock behavior;
- create/edit/delete/duplicate/bulk edge tests.

### Stage Request Status Automation 4 — Send for approval trigger

- затвердити batch aggregate;
- transactional create/send active batch;
- `SELECTION_SENT_FOR_APPROVAL`;
- `WAITING_APPROVAL`;
- repeat/double-click/new-item concurrency;
- Telegram post-commit failure tests.

### Stage Request Status Automation 5 — Client approval trigger

- рішення для всього active batch;
- explicit partial/rejection semantics;
- `CLIENT_SELECTION_APPROVED`;
- `AWAITING_INVOICE`;
- ownership, replay, parallel company-member decisions;
- integration та E2E.

### Stage Request Status Automation 6 — Invoice sent trigger

- conditional `Invoice DRAFT -> SENT`;
- compose `INVOICE_SENT` event у тій самій transaction;
- non-invoice document negative tests;
- multiple/cancelled invoice policy;
- Telegram/PDF post-commit behavior.

### Stage Request Status Automation 7 — Manual statuses і UI hardening

- normal manual actions лише `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED`;
- ADMIN override з reason;
- dropdown, badges, descriptions, filters, dashboards, audit labels;
- terminal/manual lock messaging;
- legacy status aggregation.

### Stage Request Status Automation 8 — Full lifecycle regression

- full E2E lifecycle;
- concurrency/replay;
- history/AuditLog;
- Telegram failure;
- migration/preflight;
- read-only reconciliation;
- rollback and production readiness documentation.

Такий поділ зберігає запропоновані stages, але batch/source-of-truth decision потрібно завершити у Stage 2 design і реалізувати на Stage 4 до client approval.

## 23. Перелік файлів для наступного етапу

Ймовірні Stage 2 files:

```text
prisma/schema.prisma
prisma/migrations/<timestamp>_add_request_status_automation_foundation/migration.sql
lib/requests/status-events.ts
lib/requests/status-transitions.ts
lib/requests/status-service.ts
lib/requests/statuses.ts
lib/audit-log/presentation.ts
scripts/check-request-status-transitions.ts
```

Наступні trigger/UI stages:

```text
app/admin/actions.ts
app/api/admin/requests/[id]/status/route.ts
app/api/admin/requests/[id]/items/route.ts
app/api/admin/request-items/[itemId]/route.ts
app/client/actions.ts
lib/invoices/service.ts
lib/telegram/notifications.ts
app/admin/requests/[id]/page.tsx
app/admin/requests/page.tsx
app/admin/page.tsx
app/client/requests/[id]/page.tsx
app/client/requests/page.tsx
app/client/page.tsx
app/(public)/request/status/[token]/page.tsx
app/api/requests/status/[token]/route.ts
components/client/status-badge.tsx
```

Batch implementation може додати окремі schema/service/UI files після рішення з розділу 10. Не слід змінювати всі перелічені файли в одному commit/stage.

## 24. Blockers і відкриті рішення

### Blockers

1. Для повного lifecycle відсутні два enum statuses.
2. Для Stage 5 немає надійного active approval cycle.
3. Потрібно обрати єдине джерело approval truth: new selection batch або `CommercialOffer`.

### Відкриті бізнес-рішення

- Чи partial selection є approval успішної підмножини, чи будь-яка unselected item блокує invoice?
- Чи клієнт може відхилити всі items і чи потрібен comment?
- Чи repeat send supersede-ить попередній batch?
- Чи manager може редагувати sent/approved item, чи потрібна нова revision?
- Що робити з request status, якщо єдиний sent invoice скасовано?
- Чи кілька invoices дозволяють один request залишати `INVOICE_SENT` назавжди? Рекомендація — так, без implicit regression.
- Чи `MANAGER` може exceptional override automatic phase, чи лише `ADMIN`? Рекомендація — лише `ADMIN`.
- Чи CRM assignment у майбутньому обмежує manager write access?

Stage 2 не має технічного blocker для старту: enum names, core matrix, service boundary, terminal rules і tests можна реалізувати. Але Stage 2 має зафіксувати approval aggregate decision; без нього Stage 4/5 починати не можна.

## 25. Підсумковий висновок

Поточна архітектура має добрі базові компоненти — Prisma enum/history, transactional AuditLog, item approval flags, separate `Invoice` lifecycle та post-commit Telegram notifications. Проте status lifecycle лишається ручним і не захищений domain rules.

Безпечна реалізація не повинна додавати розрізнені `request.update({ status })` у поточні actions. Спершу потрібен centralized transaction-composable service з additive statuses, monotonic matrix, manual/terminal locks, conditional update, history, audit та idempotency. Після цього triggers підключаються окремими stages.

Перевірки:

```text
git status --short: лише untracked audit report
git diff --check: PASS
npm.cmd run lint: PASS
npm.cmd run typecheck: PASS
```

Помилок до початку етапу не було; lint/typecheck errors не виявлено. У межах Stage 1 створено лише цей audit report. Stage Request Status Automation 2 не розпочинався.
