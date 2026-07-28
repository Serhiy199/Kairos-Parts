# Stage Request Status Automation 4C3 — Fix RequestItem edit persistence and false success feedback

## 1. Executive summary

Stage 4C3 централізує обидва production edit-flow `RequestItem` в одному
`updateRequestItem()` service. Service приймає trusted actor ID, exact item/request
identity, `expectedUpdatedAt` і валідовані values; атомарно перевіряє actor,
ownership та version, відсікає no-op, виконує conditional update, перечитує row,
перевіряє persisted values і лише після цього пише allowlisted Audit Log.

False green success усунуто: `item-updated` повертається лише після commit
підтвердженої зміни. No-op, validation, stale edit і DB failure мають окремі
controlled feedback states.

Focused Stage 4C3 harness та повний локальний regression suite пройшли.
Authenticated Vercel smoke і post-fix runtime logs мають статус `PENDING`, тому
що Stage 4C3 не push/deploy, а доступна browser session має роль `CLIENT`.

## 2. Git і branch state

- branch: `develop`;
- початковий working tree: clean;
- початковий `HEAD`: `84bd2fcfd7dd14ac0bf7de032011cc742238a533`;
- Stage 4C2 commit міститься у `develop`;
- `main`: `055200959f2ed8e1be628d46e91265f23cc93e61`;
- feature branch не створювалася;
- push не виконувався.

## 3. Runtime defect reproduction

Read-only audit погодженої Neon test/integration DB підтвердив проблемний record:

```text
requestId: cms4j2agx0001l2049j2dmslx
requestItemId: cms4j34o10001l504zxx2tkeb
active batch revision: 1
batch snapshot quantity: 2
live RequestItem quantity: 2
```

Після невдалого edit attempt:

```text
RequestItem.updatedAt: 2026-07-28T08:14:21.004Z
REQUEST_ITEM_UPDATED Audit Log: 2026-07-28T08:14:21.193Z
oldValue: null
newValue: null
```

Це доводить, що old flow виконав no-op `UPDATE`, змінив `updatedAt`, створив
порожній update audit і повернув green success, хоча approval content не змінився.

Попередній production code не зберігав submitted `FormData` і правильно не
логував full payload. Тому історичне фактичне значення `quantity` у request body
ретроспективно відновити неможливо. Static form audit підтвердив правильний
`name="quantity"`; focused test підтвердив actual `FormData quantity=4`.

## 4. Exact edit call chain

До fix:

```text
RequestItemForm
→ updateAdminRequestItem(formData)
→ parseRequestItemInput(formData)
→ prisma.requestItem.findFirst()
→ prisma.$transaction()
  → tx.requestItem.update()
  → buildAuditDiff()
  → writeAuditLog()
→ revalidatePath()
→ redirect ?result=item-updated
```

Після fix:

```text
RequestItemForm(quantity, itemId, requestId, expectedUpdatedAt)
→ updateAdminRequestItem()
→ parseRequestItemUpdateInput()
→ updateRequestItem()
→ prisma.$transaction()
  → actor DB validation
  → RequestItem + request ownership read
  → expectedUpdatedAt validation
  → changed-fields comparison
  → conditional updateMany()
  → read-after-write
  → persisted-value verification
  → allowlisted Audit Log
→ commit
→ revalidate
→ controlled feedback redirect
```

PATCH використовує той самий canonical service.

## 5. Root cause

Root cause false success був у contract старого update-flow:

1. Server Action і PATCH дублювали persistence logic.
2. `RequestItem.update()` виконувався навіть коли parsed values дорівнювали DB row.
3. Returned row використовувався лише для Audit Log і не перевірявся проти
   intended values.
4. Empty diff не блокував `REQUEST_ITEM_UPDATED`.
5. Після commit Server Action безумовно redirect-ив на `item-updated`.
6. Не було `expectedUpdatedAt`, conditional write або stale-edit protection.

Отже no-op міг змінити лише `updatedAt`, залишити quantity `2`, створити empty
audit і показати success. Stage 4C1 після цього коректно бачив однакові hashes.

## 6. Edit form field mapping

| UI field | HTML name | FormData key | Parsed field | Prisma field |
| --- | --- | --- | --- | --- |
| Тип техніки | `equipmentType` | `equipmentType` | `equipmentType` | `equipmentType` |
| Назва | `name` | `name` | `name` | `name` |
| Виробник | `brand` | `brand` | `brand` | `brand` |
| Каталожний номер | `catalogNumber` | `catalogNumber` | `catalogNumber` | `catalogNumber` |
| Кількість | `quantity` | `quantity` | `quantity` | `quantity` |
| Одиниця | `unit` | `unit` | `unit` | `unit` |
| Наявність | `availability` | `availability` | `availability` | `availability` |
| Ціна | `salePrice` | `salePrice` | `salePrice` | `salePrice` |
| Валюта | `currency` | `currency` | `currency` | `currency` |
| Коментар | `comment` | `comment` | `comment` | `comment` |

Hidden concurrency field:

```text
expectedUpdatedAt → item.updatedAt.toISOString()
```

Quantity input не disabled, має `type="number"`, `min="1"` і знаходиться
всередині правильного edit form.

## 7. FormData and parser behavior

Додано `parseRequestItemUpdateInput()`, окремо від create parser.

Focused proof:

```text
FormData quantity="4"
→ parsed quantity=4
```

Parser:

- відхиляє missing/empty quantity;
- відхиляє `0`, negative, `NaN` і decimal string `4.0`;
- приймає лише safe positive integer;
- відхиляє duplicate FormData keys;
- нормалізує price comma `100,00 → 100.00`;
- не використовує truthiness або fallback до old quantity.

## 8. Server Action update flow

`updateAdminRequestItem()`:

- отримує actor лише з `requireCrmSession()`;
- читає `requestId`, `itemId`, `expectedUpdatedAt`;
- використовує update-specific parser;
- делегує canonical service;
- не виконує direct Prisma item update;
- revalidate-ить лише після changed commit;
- no-op redirect-ить на `item-no-changes`;
- stale edit redirect-ить на `item-stale`;
- validation/DB failures не показує як success;
- failure log містить лише IDs, expected version і error code.

## 9. API PATCH update flow

`PATCH /api/admin/request-items/[itemId]`:

- використовує `getCrmApiSession()`;
- вимагає `requestId` і `expectedUpdatedAt` у JSON body;
- використовує той самий parser та `updateRequestItem()`;
- повертає persisted DTO і `changedFields`;
- `validation_error`: HTTP 400;
- `forbidden`: HTTP 403;
- `not_found`: HTTP 404;
- `version_conflict`: HTTP 409;
- `update_failed`: HTTP 500;
- `no_changes`: HTTP 200 без update/audit/revalidation;
- raw Prisma error не повертається.

## 10. Canonical update service

Файл:

```text
lib/request-items/update.ts
```

API:

```ts
updateRequestItem({
  requestItemId,
  requestId,
  expectedUpdatedAt,
  actor: { id },
  values,
  requestContext
})
```

Result:

```ts
{
  outcome: 'changed' | 'no_changes',
  code: 'REQUEST_ITEM_UPDATED' | 'REQUEST_ITEM_NO_CHANGES',
  item: { id, requestId, vehicleId, quantity, updatedAt },
  changedFields
}
```

## 11. Numeric conversion

`RequestItem.quantity` у Prisma schema має type `Int`.

Update parser застосовує lexical positive-integer check і
`Number.isSafeInteger()`. `"4"` стає `4`; empty, zero, negative, decimal string
та non-finite input блокуються до transaction.

`salePrice` лишається nullable `Decimal(12,2)`. Для compare використовується
canonical `Prisma.Decimal(...).toString()`, тому `100.00` і persisted `100`
не створюють false diff.

## 12. Prisma update payload

Для quantity edit canonical payload містить:

```ts
data: {
  equipmentType,
  name,
  brand,
  catalogNumber,
  quantity: 4,
  unit,
  availability,
  salePrice,
  currency,
  comment
}
```

Update має conditional selector:

```text
id = requestItemId
requestId = requestId
updatedAt = expectedUpdatedAt
```

`purchasePrice`, `supplierName`, visibility та approval flags edit form не змінює.

## 13. Read-after-write verification

Після `updateMany(count=1)` service виконує `findUnique()` у тій самій
transaction і порівнює всі editable persisted fields із desired values.

Failure conditions:

- `count != 1` → `REQUEST_ITEM_VERSION_CONFLICT`;
- row зник → `REQUEST_ITEM_UPDATE_NOT_PERSISTED`;
- будь-яке persisted mismatch → `REQUEST_ITEM_UPDATE_NOT_PERSISTED`.

Success DTO формується лише з reread persisted row.

## 14. Transaction and Audit Log

Одна transaction охоплює:

```text
actor validation
→ item/request/version read
→ no-op decision
→ conditional update
→ read-after-write
→ persisted verification
→ Audit Log
```

Audit failure rollback-ить item update. Revalidation і feedback знаходяться
після commit. Nested transaction і external calls відсутні.

Audit містить лише changed allowlisted fields. Для quantity:

```text
before: { quantity: 2 }
after: { quantity: 4 }
```

No-op не створює audit.

## 15. Concurrent edit protection

Edit form передає current `updatedAt`. Service порівнює його після DB read і
повторно використовує у conditional update.

Stale result:

```text
REQUEST_ITEM_VERSION_CONFLICT
Позицію вже було змінено. Оновіть сторінку та повторіть редагування.
```

Новіша зміна мовчки не перезаписується.

## 16. No-op behavior

Якщо intended values дорівнюють persisted row:

- `outcome=no_changes`;
- Prisma update не виконується;
- `updatedAt` не змінюється;
- Audit Log не створюється;
- revalidation не запускається;
- green success не показується;
- UI показує warning `Змін у позиції не виявлено.`

## 17. False success root cause

Historical DB evidence показує empty-diff audit і changed `updatedAt` при
quantity `2 → 2`. Старий action не перевіряв changed fields або persisted
expectation і безумовно повертав `item-updated`. Саме це створювало false green
success.

Після fix success можливий лише коли:

```text
conditional update count = 1
AND reread row matches intended values
AND Audit Log succeeded
AND transaction committed
```

## 18. Feedback behavior

- `item-updated` → green success;
- `item-no-changes` → amber warning;
- `item-validation-error` → red error;
- `item-stale` → amber warning;
- `item-update-error` → red error.

Stage 4C2 typed presentation зберігає text marker, `role="alert"` для errors і
controlled server-side mapping.

## 19. Revalidation and cache

Після changed commit:

```text
/admin
/admin/requests
/admin/requests/{requestId}
```

Existing related vehicle path revalidate-иться, якщо item має `vehicleId`.
Revalidation не виконується всередині transaction або при no-op.

Admin detail page має `dynamic='force-dynamic'`; нового cache layer немає.

## 20. Resend eligibility integration

Admin page читає live `Request.items`. Eligibility читає live `RequestItem` і
порівнює approval-content hash з immutable active batch snapshot.

Focused result:

```text
before: live 2 / revision 1 snapshot 2 → NOTHING_TO_SEND
after:  live 4 / revision 1 snapshot 2 → CHANGED_AFTER_SEND
canSend: true
```

Badge `Змінено після надсилання` і enabled send button походять із existing
Stage 4C1 presentation.

Client BATCH mode продовжує читати `RequestSelectionBatchItem`; revision 1
залишається quantity `2`. Revision 2 snapshot source після resend має quantity `4`.

## 21. Tests

Додано:

```text
npm.cmd run test:request-status-stage4c3
```

Result: `47 checks passed`.

Coverage:

- FormData/parser numeric policy;
- duplicate/missing fields;
- quantity `2 → 4`;
- returned and reread persisted quantity `4`;
- correct item/request;
- ADMIN/MANAGER allow, CLIENT deny;
- stale conflict;
- no-op without update/audit;
- audit failure rollback;
- persisted mismatch rollback;
- controlled feedback;
- Server Action/PATCH canonical wiring;
- revalidation after service;
- eligibility unchanged → changed;
- immutable revision 1 `2`;
- revision 2 source `4`.

## 22. Real DB verification

Read-only Neon audit виконано на test records і підтвердив defect:

```text
problem record: live 2, snapshot 2, empty-diff update audit
separate test record: live 4, snapshot revision 1 remains 2
```

Post-fix live mutation не виконувалась: Stage 4C3 ще не deployed, локальний
Windows Prisma connection отримав OS TLS credential error, а direct SQL mutation
не використовувалась як заміна production service. VPS DB не зачіпалась.

## 23. Authenticated browser smoke

Статус: `PENDING`.

Chrome session авторизована як `CLIENT`; direct admin URL redirect-иться у client
dashboard. Stage 4C3 code не push/deploy. Тому CRM refresh `4`, badge, active
button, resend revision 2 і client revision 2 не оголошуються як browser PASS.

Після окремо дозволених push/deploy потрібна authenticated ADMIN/MANAGER session.

## 24. Runtime logs

Статус post-fix verification: `PENDING`.

Failure-only structured logs містять:

```text
requestId
requestItemId
expectedUpdatedAt
errorCode
```

Full payload, price, supplier, PII, secrets і DB URL не логуються. Відсутність
нових errors можна довести лише після deployed smoke у визначеному time window.

## 25. Regression results

PASS:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run test:request-status`;
- `npm.cmd run test:request-status-stage3`;
- `npm.cmd run test:request-selection-batch`;
- `npm.cmd run test:request-status-stage4c`;
- `npm.cmd run test:request-status-stage4c1`;
- `npm.cmd run test:request-status-stage4c2`;
- `npm.cmd run test:request-status-stage4c3`;
- `npm.cmd run test:request-status-stage4d` — 24/24;
- Audit Log 2, 3, 4, 5;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

## 26. Prisma and DB safety

Prisma schema не змінювалась. Migration, enum, table або column не створювалися.
DDL не виконувалась. VPS DB не змінювалась.

Read-only query використовувалась лише для PII-safe defect evidence. Temporary
audit script видалено і до commit не входить.

## 27. Changed files

- `app/admin/actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `app/api/admin/request-items/[itemId]/route.ts`;
- `lib/admin/request-feedback.ts`;
- `lib/request-items/update.ts`;
- `lib/request-items/validation.ts`;
- `package.json`;
- `scripts/check-request-status-stage4c3-item-edit-persistence.ts`;
- цей report.

## 28. Known limitations

- Historical raw `FormData` не існує, бо production правильно не зберігав full
  submitted payload; root cause доведено через empty-diff DB/Audit evidence.
- Post-fix live DB, CRM refresh, resend та client snapshot потребують deployment.
- Доступна browser session не має ADMIN/MANAGER role.
- PATCH тепер вимагає full edit values, `requestId` та `expectedUpdatedAt`;
  production callers цього route у repository не знайдені.
- Optimistic concurrency захищає edit, але не додає general form idempotency key.

## 29. What was intentionally excluded

Не додано:

- Stage 5;
- client approve/reject;
- batch item decisions;
- нові status transitions;
- CommercialOffer/Invoice/Change Request redesign;
- schema/migration;
- deployment;
- VPS changes;
- main merge;
- push.

## 30. Stage 5 readiness

Локальна розробка Stage 5: `READY` після зелених Stage 2–4D, Stage 4C1–4C3 та
Audit Log regressions.

Vercel runtime testing Stage 5: `NOT READY` до deployment Stage 4C3,
authenticated `2 → 4 → revision 2` smoke і runtime log verification.

## 31. Final conclusion

Stage 4C3 локально усуває false-success contract та дублювання persistence:
Server Action і PATCH використовують один atomic service, quantity `4`
валідовується як Prisma `Int`, update прив'язаний до exact item/request/version,
persisted row reread і перевіряється, Audit Log rollback-safe, no-op не змінює
row і не показує success.

Локальний proof завершено. Live Vercel proof чесно лишається зовнішнім gate до
окремо дозволених push/deploy та ADMIN/MANAGER browser session.
