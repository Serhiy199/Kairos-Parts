# Stage Request Status Automation 4D — Immutable batch UI read model

## 1. Executive summary

Stage 4D перевів approval surface у `/client/requests/[id]` на авторизовану
immutable read model. За наявності активного `RequestSelectionBatch(status=SENT)`
клієнт бачить тільки snapshot-поля `RequestSelectionBatchItem`; mutable
`RequestItem` у режимі `BATCH` не читається. Реалізовано явні режими `BATCH`,
`LEGACY` та `EMPTY`. Жодної client approval mutation або Stage 5 transition не
додано.

## 2. Git і стан гілки develop

Робота виконана безпосередньо у `develop`. Вихідний `HEAD`:
`73b3491ed9539441a8484656d04a22df42edaa9f`, commit Stage 4C присутній.
Окрему гілку не створено, `main` не checkout-илася і не змінювалася. До початку
роботи working tree був чистий.

## 3. Вихідний стан після Stage 4C

Stage 4C атомарно створює та надсилає immutable batch, переводить `Request` у
`WAITING_APPROVAL` і revalidate-ить `/client/requests/{id}`. До Stage 4D
клієнтська detail page продовжувала читати mutable `RequestItem` та викликати
legacy `approveClientRequestItemsAction`.

## 4. Аудит client request detail

| UI block | Current source до 4D | Mutable | New source | Stage 4D action |
| --- | --- | ---: | --- | --- |
| Header/details | `Request` | так | `Request` | без змін |
| Approval items | `Request.items` | так | active `SENT` batch items | замінено у `BATCH` |
| Legacy approval | `RequestItem` | так | `RequestItem` | ізольований fallback |
| Invoices | `Invoice` + `InvoiceItem` | так | без змін | збережено |
| Request documents | `RequestDocument` | так | без змін | збережено |
| Files | `File` relation | так | без змін | збережено |

Сторінка вже мала server-side CLIENT session, company/personal access predicate,
dynamic rendering, public status link, repeat request, invoices, documents і
files.

## 5. Current approval UI entry points

- Detail page раніше напряму рендерила `approveClientRequestItemsAction`.
- `createClientRequestItemEditAction` існує у `app/client/actions.ts`, але на
  detail page не рендериться.
- Generic Change Request має окрему client surface.
- Commercial offer approve/reject actions існують окремо; detail page не
  рендерила `CommercialOffer` до Stage 4D.

## 6. Authorized read service

`lib/request-selection/client-read-model.ts` повторно читає actor і request на
сервері, перевіряє `role=CLIENT`, `status=ACTIVE`, наявність `ClientProfile`,
access scope, а потім визначає active batch. Prisma `select` є explicit і
повертає тільки client-safe поля. Production export прив'язаний до `prisma`,
factory export дає ізольовані tests без remote DB.

## 7. Company-scoped access

Для company request потрібен membership actor-а саме в `request.companyId`. Для
personal request потрібен збіг `request.clientId` з actor `ClientProfile.id`.
Невідповідність повертає typed `REQUEST_ACCESS_DENIED`; UI не змішує дані іншої
компанії.

## 8. Active SENT batch resolution

Запит фільтрує тільки `{ requestId, status: 'SENT' }`, бере максимум два rows і
сортує за revision. `DRAFT` та `SUPERSEDED` не є active. Якщо знайдено понад один
`SENT`, повертається `ACTIVE_BATCH_INTEGRITY_ERROR`; mixed UI або довільний вибір
не допускається.

Status mismatch між active `SENT` batch та `Request.status` логуються як
integrity warning, але snapshot не приховується і reconciliation/mutation не
виконується.

## 9. Client-safe immutable mapper

Mapper серіалізує `Decimal`/`Date` у plain strings, формує окремий vehicle
snapshot і не повертає:

- `sourceRequestItemId`;
- `snapshotHash`;
- VIN;
- purchase/internal cost;
- supplier data;
- internal provenance IDs.

## 10. BATCH / LEGACY / EMPTY modes

- `BATCH`: є один active `SENT`; джерело позицій — тільки snapshot rows.
- `LEGACY`: active `SENT` відсутній, але є visible legacy `RequestItem`.
- `EMPTY`: немає ні active batch, ні visible legacy items; це нормальний стан.

Fallback не створює batch, не виконує backfill і не змішує два джерела.

## 11. Batch header і revision UX

Batch header показує `revision`, `sentAt`, label status `SENT` і кількість
snapshot items. Label-и беруться з centralized
`lib/request-selection/presentation.ts`.

## 12. Snapshot item UI

Картка показує snapshot `itemName`, brand/equipment type, catalog/analog numbers,
quantity/unit, availability, delivery time, approved unit price, manager comment,
vehicle snapshot і item decision status. Live `RequestItem` та current `Vehicle`
у `BATCH` не читаються.

## 13. Price і quantity formatting

Formatting працює зі serialized decimal string без втрати precision через
`Number`. Null price показується точним текстом «Ціна уточнюється» і не показує
currency. Quantity зберігає snapshot decimal representation та додає unit.

## 14. Vehicle snapshot policy

Показуються лише `vehicleDisplayName`, brand, model і year зі snapshot. VIN не
включено до client mapper/UI, хоча request details продовжує показувати власний
request VIN за попередньою UX policy. Current `Vehicle` relation у batch item не
читається.

## 15. Item decision badges

`PENDING`, `APPROVED`, `REJECTED` відображаються через centralized Ukrainian
labels і різні візуальні badges. Stage 4D ці status не змінює.

## 16. Approval controls preparation

Обрано read-only Variant A: у `BATCH` показано пояснення, що approve/reject стане
доступним після активації нового циклу. Checkbox, form, server action та event
Stage 5 не підключені.

## 17. Legacy approval action isolation

Legacy action винесено в
`components/client/client-legacy-selection-section.tsx`. Вона рендериться лише
при `mode='LEGACY'`. Batch component не імпортує
`approveClientRequestItemsAction`, не має form або checkbox.

## 18. Change Request compatibility

Item-specific mutable action не рендериться у `BATCH`. Generic Change Request
surface не змінювалася. Batch-aware item change потребує окремої Stage 5 policy;
nullable `sourceRequestItemId` не використовується як гарантований зв'язок.

## 19. CommercialOffer / Invoice / documents compatibility

CommercialOffer code не змінено. Чинні invoice, request document і file blocks
на detail page збережено. Stage 4D не змінює їх queries, actions або statuses.

## 20. Mobile UX і accessibility

Batch UI використовує mobile-first single-column layout, `min-w-0`,
`break-words`, `[overflow-wrap:anywhere]`, responsive grids та wrap для badges.
Semantic `section`/`article`/headings збережені; status не передається лише
кольором, а має текстовий label. Статичний responsive audit пройдено.
Authenticated browser smoke не виконувався: у межах безпечного read-only етапу
не створювали client fixture/session у remote DB.

## 21. Data loading і serialization

Page лишається async Server Component з `dynamic='force-dynamic'`. Batch service
виконується server-side після основного access check. DTO містить plain strings,
numbers, booleans і null, тож не передає Prisma `Decimal`/`Date` у presentation
boundary.

## 22. Error handling

Визначено stable codes: `REQUEST_NOT_FOUND`, `ACTOR_NOT_FOUND`,
`ACTOR_NOT_ALLOWED`, `REQUEST_ACCESS_DENIED`,
`ACTIVE_BATCH_INTEGRITY_ERROR`, `BATCH_READ_FAILED`, `LEGACY_READ_FAILED`.
Authorization failures поводяться як not-found. Integrity/read failure показує
контрольований generic error лише у selection block; invoices/documents/files
не маскуються. Logs містять request ID/code, але не snapshot/customer payload.

## 23. Cache і revalidation

Новий cache layer не додано. Dynamic Server Component читає актуальний стан, а
Stage 4C уже викликає `revalidatePath('/client/requests/{id}')`. Додаткових
revalidation mutations у read-only Stage 4D немає.

## 24. Tests

Додано `npm.cmd run test:request-status-stage4d`: 24/24 checks PASS. Покрито
authorization, active batch resolution, multiple-SENT integrity, ordering,
safe mapper, null price, source deletion, live mutation independence,
`BATCH/LEGACY/EMPTY`, stable errors, formatting і static UI isolation.

## 25. Regression results

PASS:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run test:request-selection-batch`;
- `npm.cmd run test:request-status`;
- `npm.cmd run test:request-status-stage3`;
- `npm.cmd run test:request-status-stage4c`;
- `npm.cmd run test:request-status-stage4d` — 24/24;
- Audit Log 2, 3, 4, 5 verification scripts;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

## 26. Migration і DB safety

Schema/migrations не змінювалися. Read-only `npx.cmd prisma migrate status`
знайшов 38 migrations і підтвердив дві unapplied:

- `20260727120000_add_awaiting_invoice_and_invoice_sent_request_statuses`;
- `20260727183000_add_request_selection_batch_foundation`.

Exit code 1 означає pending state, а не regression. `migrate deploy/dev`,
backfill або будь-яка remote DB mutation не виконувалися.

## 27. Змінені файли

- `app/client/requests/[id]/page.tsx`;
- `components/client/client-approval-batch-section.tsx`;
- `components/client/client-legacy-selection-section.tsx`;
- `lib/request-selection/client-read-model.ts`;
- `lib/request-selection/client-presentation.ts`;
- `scripts/check-request-status-stage4d-read-model.ts`;
- `package.json`;
- цей report.

## 28. Відомі обмеження

- `BATCH` у Stage 4D є read-only; рішення клієнта — Stage 5.
- Legacy mutation тимчасово підтримується лише без active `SENT`.
- Authenticated browser E2E не доведено без test fixture/session.
- Data integrity все ще залежить від pending Stage 4B migration у цільовій DB.

## 29. Що свідомо не входило у Stage 4D

Не додано approval/rejection mutations, `CLIENT_SELECTION_APPROVED`, Request або
batch status updates, Change Request redesign, CommercialOffer/Invoice changes,
Telegram changes, schema/migration, backfill, deploy, push чи remote DB writes.

## 30. Готовність до Stage 5

UI та service boundary готові: active batch має stable ID/revision/items/status,
client-safe DTO та чітку read-only surface. Stage 5 може додати окремі
batch-aware commands з optimistic/concurrency guards, не повертаючись до
mutable live item як canonical source.

## 31. Підсумковий висновок

Stage 4D досягає immutable client approval read model: `SENT` snapshot є
source of truth, live changes/deletion не змінюють batch UI, access перевірено
server-side, legacy поведінка ізольована, а суміжні surfaces не змінено.
Обов'язкові static/build/regression checks пройдені; runtime browser QA і
застосування pending migrations чесно лишаються поза виконаним proof.
