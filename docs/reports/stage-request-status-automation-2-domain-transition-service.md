# Stage Request Status Automation 2 — Domain model і transition service

Дата виконання: 2026-07-27.

## 1. Executive summary

У гілці `develop` створено domain foundation для контрольованих переходів `Request.status`:

- до `RequestStatus` additive додано `AWAITING_INVOICE` і `INVOICE_SENT`;
- створено migration лише з двома `ALTER TYPE ... ADD VALUE`;
- реалізовано explicit transition matrix без залежності від порядку enum;
- реалізовано `transitionRequestStatus()` із standalone та existing transaction режимами;
- додано conditional update, concurrency handling, idempotent no-op, manual/terminal/legacy guards;
- реальна зміна атомарно створює `RequestStatusHistory` і `AuditLog`;
- actor role читається з БД, а не довіряється browser payload;
- додано ізольовані unit/integration tests на наявній `tsx` + `node:assert` інфраструктурі;
- нові statuses отримали українські labels, descriptions, badge colors та Audit Log presentation;
- triggers зі Stages 3–6 не підключалися.

Configured `DATABASE_URL` веде на віддалений Neon, який не був підтверджений як local/test DB. Migration не застосовувалася. `prisma migrate status` був лише read-only і підтвердив, що нова migration pending.

## 2. Git і стан гілки develop

User окремо підтвердив використання фактичної основної гілки `develop` замість назви `developer` з початкового prompt.

Вихідний стан:

```text
branch: develop
HEAD: 8fd2fdf docs: audit request status automation flow
origin/develop: 8fd2fdf
git status --short: empty
```

`8fd2fdf` прийнято як еквівалент Stage 1 audit commit `f8601836`: вміст `docs/reports/stage-request-status-automation-1-audit.md` у двох commits ідентичний. `main` не checkout-илася і не змінювалася.

## 3. Вихідний стан після Stage 1

Перед реалізацією повністю прочитано:

```text
docs/reports/stage-request-status-automation-1-audit.md
```

Підтверджено:

- два чинні manual write paths напряму змінюють request status;
- централізованої matrix раніше не було;
- `RequestStatusHistory` має лише old/new status, actor ID і timestamp;
- `writeAuditLog()` transaction-composable та використовує allowlists;
- надійний approval cycle потребує окремого batch/revision рішення;
- Telegram залишається post-commit side effect;
- Stage 2 не повинен wiring-ити business triggers.

## 4. Поточний RequestStatus enum

Після Stage 2 фактичний enum:

```text
NEW
IN_PROGRESS
OFFER_PREPARING
WAITING_APPROVAL
AWAITING_INVOICE
INVOICE_SENT
AWAITING_SHIPMENT
ORDERED
IN_DELIVERY
COMPLETED
CANCELLED
```

Класифікація:

| Тип | Statuses |
| --- | --- |
| Automatic phases | `NEW`, `IN_PROGRESS`, `WAITING_APPROVAL`, `AWAITING_INVOICE`, `INVOICE_SENT` |
| Manual-only targets | `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED` |
| Terminal | `COMPLETED`, `CANCELLED` |
| Locked від automation | `AWAITING_SHIPMENT`, `ORDERED`, `IN_DELIVERY`, `COMPLETED`, `CANCELLED` |
| Legacy/deprecated-compatible | `OFFER_PREPARING`, `ORDERED`, `IN_DELIVERY` |

`Request.status` і надалі має default `NEW`. Existing enum values не перейменовувалися і не видалялися.

## 5. Додані enum values

Додано:

```text
AWAITING_INVOICE → Очікує рахунок
INVOICE_SENT → Рахунок надісланий
```

Backfill і зміна наявних requests не виконувалися.

## 6. Migration

Migration:

```text
prisma/migrations/20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses/migration.sql
```

SQL:

```sql
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_INVOICE';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SENT';
```

Migration:

- additive;
- не змінює таблиці або records;
- не робить backfill;
- не видаляє legacy values;
- не reset-ить дані;
- не застосовувалася до жодної DB.

## 7. Business events

Створено строгий `RequestStatusEvent`:

```text
SELECTION_DRAFT_CREATED
SELECTION_SENT_FOR_APPROVAL
CLIENT_SELECTION_APPROVED
INVOICE_SENT
MANUAL_SET_AWAITING_SHIPMENT
MANUAL_SET_COMPLETED
MANUAL_SET_CANCELLED
```

Generic `MANUAL_STATUS_CHANGE` свідомо не створено: raw target status не повинен обходити explicit matrix, а Stage 7 окремо визначить ADMIN override policy.

## 8. Transition matrix

Matrix реалізовано у `resolveRequestStatusTransition(currentStatus, event)`.

Основний automatic chain:

```text
NEW
  --SELECTION_DRAFT_CREATED-->
IN_PROGRESS
  --SELECTION_SENT_FOR_APPROVAL-->
WAITING_APPROVAL
  --CLIENT_SELECTION_APPROVED-->
AWAITING_INVOICE
  --INVOICE_SENT-->
INVOICE_SENT
```

Legacy `OFFER_PREPARING + SELECTION_SENT_FOR_APPROVAL` дозволено як сумісний перехід у `WAITING_APPROVAL`.

Manual events мають лише три explicit targets. Enum order, numeric index або порівняння phase position не використовуються.

## 9. Manual і terminal guards

Правила:

- automatic event у `COMPLETED` або `CANCELLED` повертає `blocked: terminal_status`;
- automatic event у `AWAITING_SHIPMENT`, `ORDERED` або `IN_DELIVERY` повертає `blocked: manual_status_locked`;
- unsupported/backward combination повертає `blocked: invalid_transition`;
- manual event у той самий target повертає `noop: already_in_target_status`;
- terminal status не можна перевести manual event-ом в інший status;
- automatic event не може встановити manual-only status, бо target виводиться лише з explicit event matrix.

## 10. Actor і authorization invariants

Public actor input:

```ts
type RequestStatusActor = {
  id: string;
};
```

Service не приймає role/name/email із payload як джерело authorization. Він читає actor role з `User` у тій самій transaction.

Guards:

- `CLIENT_SELECTION_APPROVED` — тільки DB role `CLIENT`;
- selection draft/send та invoice event — `ADMIN` або `MANAGER`;
- усі manual events — `ADMIN` або `MANAGER`;
- CLIENT не може виконати staff manual event;
- MANAGER/ADMIN не можуть маскувати дію під client-only event.

Caller майбутнього integration stage все одно відповідає за authentication, ownership і request scope.

## 11. Архітектура transitionRequestStatus()

Основний API:

```ts
transitionRequestStatus({
  requestId,
  event,
  actor: { id },
  reason?,
  metadata?,
  tx?
})
```

Result union:

```text
changed  → previousStatus, nextStatus, historyId, auditLogId
noop     → currentStatus, idempotency reason
blocked  → currentStatus, domain reason
```

Typed `RequestStatusTransitionError` відрізняє:

```text
REQUEST_NOT_FOUND
ROLE_NOT_ALLOWED
CONCURRENT_STATUS_CHANGE
```

`INVALID_TRANSITION`, terminal і manual lock повертаються контрольованим `blocked` result, а не generic exception.

Для isolated tests додано factory:

```ts
createRequestStatusTransitionService(database)
```

Production export використовує canonical `prisma`.

## 12. Transaction composability

Standalone:

```text
tx не передано
→ database.$transaction(...)
→ Request update + history + audit
→ один commit
```

Existing transaction:

```text
tx передано
→ service використовує саме цей tx
→ nested transaction не відкривається
→ global prisma у transaction path не використовується
```

Test підтвердив: standalone відкриває одну transaction, existing `tx` — нуль внутрішніх transactions.

## 13. Conditional update і concurrency

Status update:

```ts
updateMany({
  where: {
    id: request.id,
    status: expectedCurrentStatus
  },
  data: {
    status: targetStatus
  }
})
```

При `count !== 1` service перечитує актуальний status:

- якщо parallel winner уже досяг idempotent state — повертає `noop`;
- якщо актуальний state locked/terminal/invalid — повертає відповідний `blocked`;
- якщо event усе ще мав би виконатися, повертає typed `CONCURRENT_STATUS_CHANGE`;
- history/audit для невиконаного update не створюються.

Blind overwrite і success response при невиконаному update відсутні.

## 14. Idempotency

Idempotent pairs:

| Current status | Repeat event | Result |
| --- | --- | --- |
| `IN_PROGRESS` | `SELECTION_DRAFT_CREATED` | `noop` |
| `WAITING_APPROVAL` | `SELECTION_SENT_FOR_APPROVAL` | `noop` |
| `AWAITING_INVOICE` | `CLIENT_SELECTION_APPROVED` | `noop` |
| `INVOICE_SENT` | `INVOICE_SENT` | `noop` |
| Manual target | відповідний manual event | `noop` |

`noop` не створює `RequestStatusHistory` або `AuditLog`.

`eventKey` підтримується як allowlisted correlation metadata, але schema-level unique event constraint не додано, бо migration цього етапу навмисно обмежена двома enum values. Status-based conditional update забезпечує transition idempotency.

## 15. RequestStatusHistory

При реальній зміні створюється рівно один record:

```text
requestId
oldStatus
newStatus
changedByUserId
createdAt
```

History створюється після успішного conditional update у тій самій transaction.

Поточна model не має reason/event/metadata fields. Її не розширювали, щоб migration залишилася enum-only. Business event і reason зберігаються в пов’язаному Audit Log event.

`noop` і `blocked` history не створюють.

## 16. Audit Log

Використовується актуальний `writeAuditLog()`.

Один успішний transition створює:

```text
entityType: REQUEST
entityId: requestId
entityLabel: requestNumber
action: REQUEST_STATUS_CHANGED
category: STANDARD
oldValue: { status: previousStatus }
newValue: { status: nextStatus }
metadata:
  businessEvent
  reason
  automatic
  source
  eventKey
  correlationId
  triggerEntityType
  triggerEntityId
```

Усі payload fields проходять explicit allowlists і чинний secret/PII sanitizer. Повний `Request` у before/after не пишеться.

Actor snapshot (`actorName`, `actorEmail`, `actorRole`) читається `writeAuditLog()` із server-side DB user. Test підтвердив snapshot і lowercase email.

Status update, history та Audit Log атомарні. Tests підтвердили rollback status/history при history або audit failure.

## 17. Status labels і UI compatibility

У `lib/requests/statuses.ts` додано:

- українські labels;
- descriptions;
- badge colors у межах чинної м’якої palette;
- order `AWAITING_INVOICE=4`, `INVOICE_SENT=5`, shipment/legacy aliases `=6`.

У `lib/audit-log/presentation.ts` додано labels нових та раніше непокритих request statuses.

`REQUEST_STATUSES`, який живить чинні filters і CRM manual dropdown, навмисно не розширено новими automatic statuses. Отже manual dropdown у Stage 2 не отримав нових можливостей і продовжує працювати як раніше. Raw enum values на status badges/public surfaces не показуються, бо shared maps повні.

Повне оновлення filters/dashboard і hardening manual dropdown залишається Stage 7.

## 18. Tests

Додано:

```text
scripts/check-request-status-transition.ts
npm.cmd run test:request-status
```

Unit coverage:

- усі затверджені automatic steps;
- repeat/idempotent events;
- terminal/manual locks;
- backward/unsupported transitions;
- legacy lock;
- manual cancel/complete;
- same-target manual no-op.

Isolated integration coverage:

- conditional update;
- один history;
- один audit;
- no-op/blocked без writes;
- request not found;
- role mismatch для CLIENT і MANAGER;
- concurrent winner як no-op;
- unresolved concurrency error;
- standalone transaction;
- existing transaction без nesting;
- rollback при history failure;
- rollback при audit failure;
- actor snapshot;
- PII-safe before/after та allowlisted metadata.

Результат:

```text
Request status transition unit/integration verification passed.
```

Окремого Jest/Vitest framework і безпечної local integration DB у репозиторії немає, тому real-PostgreSQL mutation tests не запускалися.

Також пройшли:

```text
Admin Audit Log 2 verification passed.
Admin Audit Log 3 verification passed.
Admin Audit Log 4 verification passed.
```

## 19. Regression results

Статично підтверджено:

- Prisma Client генерується;
- TypeScript exhaustive maps компілюються;
- lint проходить;
- production build компілює всі admin/client/public routes;
- старі і нові status presentation maps повні;
- чинні manual status handlers не змінені;
- registration/login code не змінювався;
- request list/detail code не змінювався;
- жоден business action не імпортує новий service.

Browser/runtime login, registration та role-authenticated request pages не виконувалися: Stage 2 не змінює UI flows, а test credentials/browser session не входили в scope. Build є static regression evidence, не live E2E proof.

## 20. Migration/DB safety

Environment audit:

```text
source: .env.local
database: neondb
host: ep-wandering-…eu-central-1.aws.neon.tech
environment class: remote Neon, local/test identity not confirmed
```

Виконано лише read-only:

```text
npx.cmd prisma migrate status
```

Результат: знайдено 37 migrations; нова migration pending. Команда завершилася non-zero саме через unapplied migration.

Не виконувалися:

```text
prisma migrate dev
prisma migrate deploy
prisma db push
prisma migrate reset
prisma db seed
```

Production DB не змінювалася. Migration не застосовувалася до жодної DB.

## 21. Змінені файли

```text
docs/reports/stage-request-status-automation-2-domain-transition-service.md
lib/audit-log/presentation.ts
lib/requests/status-transition.ts
lib/requests/statuses.ts
package.json
prisma/migrations/20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses/migration.sql
prisma/schema.prisma
scripts/check-request-status-transition.ts
```

Generated Prisma Client залишився у ignored `node_modules`; generated artifacts до Git не додаються.

## 22. Відомі обмеження

- `RequestStatusHistory` не має reason/event/metadata columns.
- Немає schema-level unique `eventKey`; conditional status update забезпечує idempotency саме status transition.
- Немає safe local/test PostgreSQL DB для real-DB integration test.
- Existing manual handlers досі мають стару unconditional logic; це навмисно Stage 7.
- Approval batch/revision/source-of-truth рішення не реалізовано і лишається blocker для Stages 4–5.
- New automatic statuses не додані в admin filter options до UI-hardening stage.

## 23. Що свідомо не входило у Stage 2

Не змінювалися і не підключали service:

- RequestItem create/edit/delete;
- send-for-approval;
- client approval;
- invoice send;
- CRM manual status Server Action;
- CRM manual status API route;
- Telegram notifications;
- client/admin UI layout;
- existing requests;
- reconciliation/backfill.

Прямі status updates, що лишилися поза service:

```text
app/admin/actions.ts → updateAdminRequestStatus()
app/api/admin/requests/[id]/status/route.ts → PATCH
```

Invoice status updates змінюють `Invoice.status`, а не `Request.status`, і також не wiring-илися.

## 24. Готовність до Stage 3

Blocker для Stage Request Status Automation 3 відсутній.

Stage 3 може інтегрувати `SELECTION_DRAFT_CREATED` у transaction створення draft `RequestItem`, передавши existing `tx`, authenticated staff actor і correlation metadata.

Перед Stages 4–5 необхідне окреме рішення та реалізація approval aggregate:

- `RequestSelectionBatch`; або
- формальне використання `CommercialOffer` як єдиного approval source of truth.

Stage 3 у межах цього завдання не розпочинався.

## 25. Підсумковий висновок

Stage 2 створив ізольований, transaction-composable і test-covered domain foundation. Automatic targets визначаються explicit business events, manual/terminal/legacy states захищені, concurrent update не маскується як success, а history та Audit Log записуються лише для фактичної зміни в одній transaction.

Migration безпечна й additive, але навмисно лишається unapplied через віддалений ідентифікаційно неоднозначний Neon environment. Чинні production flows не wiring-илися та не змінили поведінку.
