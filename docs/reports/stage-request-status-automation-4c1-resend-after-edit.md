# Stage Request Status Automation 4C1 — Re-enable resend after editing sent selection

## 1. Executive summary

Stage 4C1 виправляє заблокований repeat-send після зміни вже надісланої позиції. Eligibility тепер обчислюється server-side відносно active `SENT` batch за approval-content hash, а не за legacy `visibleToClient`. Approval-critical зміна, додавання або видалення позиції активує створення повної нової revision; internal-only зміна не активує resend.

Локальна реалізація та regression suite пройшли. Authenticated Vercel smoke має статус `PENDING`, оскільки цей commit ще не push/deploy, а push за умовами етапу заборонено без окремої команди.

## 2. Git і branch state

Pre-check:

- branch: `develop`;
- початковий working tree: clean;
- початковий `HEAD`: `e9c35f1f8266edc24d9da45409e39565f6180ad2`;
- `73b3491ed9539441a8484656d04a22df42edaa9f` і `885ffb93ddbd78fca29cb91206c50071dc7b4dee` містяться в `develop`;
- `main`: `055200959f2ed8e1be628d46e91265f23cc93e61`;
- remote: `origin git@github.com:Serhiy199/Kairos-Parts.git`.

Feature branch не створювався. `main` не змінювався. Push не виконувався.

## 3. Browser smoke defect

Початковий authenticated smoke на Vercel показав:

1. revision 1 зберігає immutable `quantity = 2`;
2. live `RequestItem.quantity` змінюється на `3`;
3. client продовжує коректно бачити snapshot `2`;
4. admin send button лишається disabled, тому revision 2 неможливо створити через UI.

## 4. Root cause

| Файл | Умова | Поточна семантика до Stage 4C1 | Чому не працювало після edit |
| --- | --- | --- | --- |
| `app/admin/requests/[id]/page.tsx` | `items.filter((item) => !item.visibleToClient)` | Send selection складався лише з legacy hidden items | Після першого send item має `visibleToClient=true`, а edit не змінює цей flag |
| `app/admin/requests/[id]/page.tsx` | `disabled={hiddenItemCount === 0}` | Button залежав від кількості hidden items | Approval-critical зміна live item не впливала на `hiddenItemCount` |
| `lib/request-selection/send-for-approval.ts` | reject для `sourceItem.visibleToClient` | Server приймав лише ще не видимі client items | Навіть ручний form submit не дозволяв resend visible item |
| `RequestItem` edit flows | visibility не поверталась у draft | Legacy fallback залишався стабільним | Не існувало batch-relative dirty state |

`approvedByClient` не визначав send eligibility. Active `SENT` batch, source links і snapshot content у старій UI-умові не використовувалися.

## 5. Current disabled-button logic

До виправлення:

```text
hiddenItems = items where visibleToClient=false
disabled = hiddenItems.length === 0
```

Після виправлення:

```text
disabled = !eligibility.canSend
```

`eligibility.canSend` обчислюється з DB-side request lifecycle, current item set та порівняння current approval content з active `SENT` batch.

## 6. Approval-critical fields

| RequestItem / Vehicle source field | Snapshot field | Approval-critical | Resend required |
| --- | --- | ---: | ---: |
| `equipmentType` | `equipmentType` | так | так |
| `name` | `itemName` | так | так |
| `brand` | `brand` | так | так |
| `catalogNumber` | `catalogNumber` | так | так |
| `analogNumber` | `analogNumber` | так | так |
| `quantity` | `quantity` | так | так |
| `unit` | `unit` | так | так |
| `availability` | `availability` | так | так |
| `deliveryTime` | `deliveryTime` | так | так |
| `salePrice` | `approvedUnitPrice` | так | так |
| `currency` | `currency` | так | так |
| `comment` | `managerComment` | так | так |
| `vehicleId` | `vehicleIdSnapshot` | так | так |
| `vehicle.name` та derived display | `vehicleDisplayName` | так | так |
| `vehicle.manufacturer` | `vehicleBrand` | так | так |
| `vehicle.model` | `vehicleModel` | так | так |
| `vehicle.year` | `vehicleYear` | так | так |
| `vehicle.vinOrSerial` | `vehicleVin` | так | так |
| `supplierName` | — | ні | ні |
| `purchasePrice` | — | ні | ні |
| internal margin / audit fields | — | ні | ні |
| `updatedAt` | provenance `sourceUpdatedAt` | не визначає approval semantics | лише concurrency |
| generated IDs / decision fields | — | ні | ні |

Матриця відповідає фактичному Stage 4B snapshot builder.

## 7. Dirty detection architecture

Додано read-only `getRequestSelectionResendEligibility()` у `lib/request-selection/resend-eligibility.ts`.

Алгоритм:

1. завантажити Request, усі current `RequestItem` з vehicle projection і максимум два active `SENT` batch;
2. відхилити integrity error, якщо active `SENT` більше одного;
3. побудувати current canonical snapshot через Stage 4B builder;
4. отримати approval-content hash для current та active snapshot content;
5. зіставити items через `sourceRequestItemId`;
6. визначити item state і set-level additions/removals;
7. застосувати lifecycle та no-items guards;
8. повернути full replacement IDs і актуальні `updatedAt`.

Service нічого не змінює в DB і не довіряє browser hash.

## 8. Snapshot hash comparison

Stage 4B persisted `snapshotHash` включає provenance `sourceUpdatedAt`. Тому пряме порівняння нового persisted-style hash зі старим `snapshotHash` дало б false positive після internal-only edit.

Stage 4C1 використовує той самий canonical serializer і SHA-256 helper, але над окремою approval-content projection, яка містить всі client-visible snapshot fields і не містить source timestamps/IDs. Active approval hash також перераховується з immutable stored batch fields. Це зберігає hash-based semantics та гарантує, що `supplierName`, `purchasePrice` або лише новий `updatedAt` не активують resend.

## 9. updatedAt concurrency role

`updatedAt` лишається optimistic concurrency precondition:

- server-rendered page передає current DB `RequestItem.updatedAt`;
- send service повторно читає item у transaction;
- mismatch повертає `SOURCE_ITEM_VERSION_CONFLICT`;
- browser не передає snapshot values або hash;
- після edit revalidation оновлює hidden expected version.

`updatedAt` не визначає approval dirty state.

## 10. Resend eligibility service

Public API:

- `getRequestSelectionResendEligibility({ requestId, tx? })`;
- `deriveRequestSelectionResendEligibility()` для deterministic tests;
- typed `RequestSelectionResendEligibilityError`.

Read model містить:

- request status;
- active batch ID/revision;
- item states;
- current та active approval hashes тільки server-side;
- current/active source versions;
- not-sent/new/changed/unchanged/removal sets;
- canonical full replacement IDs;
- `canSend` і reason.

## 11. Live item to batch item matching

Primary key matching: `RequestSelectionBatchItem.sourceRequestItemId`.

- source link + equal approval hash → `UNCHANGED`;
- source link + different approval hash → `CHANGED_AFTER_SEND`;
- current item без source link в active batch → `NEW_AFTER_SEND`;
- відсутній active batch → `NOT_SENT`;
- `sourceRequestItemId=null` не падає і не відновлює deleted live item.

## 12. Added / changed / removed item detection

- added: current source ID відсутній в active batch;
- changed: source ID збігається, approval-content hash відрізняється;
- removed: active source ID відсутній у current set або old batch source link вже `null`.

Removed old snapshot лишається immutable у revision 1 та не входить до revision 2. Removal активує resend, якщо існує хоча б один current item. Якщо після removal current set порожній, button лишається disabled відповідно до explicit no-items rule; empty approval batch не створюється.

## 13. Full replacement revision policy

Обрано `full replacement batch`, не delta.

Коли eligibility dirty, нова revision включає всі current `RequestItem` у deterministic order. Browser form і server-side canonical set мають точно збігатися. Partial, extra або tampered selection відхиляється як `SOURCE_ITEM_INVALID`.

## 14. Admin item badges

Admin UI показує текстовий badge:

- `NOT_SENT` → `Чернетка`;
- `UNCHANGED` → `Надіслано`;
- `CHANGED_AFTER_SEND` → `Змінено після надсилання`;
- `NEW_AFTER_SEND` → `Нова позиція`.

Legacy approval/invoice badges лишилися без redesign.

## 15. Send button activation

Button active, коли:

- request status є `IN_PROGRESS`, `OFFER_PREPARING` або `WAITING_APPROVAL`;
- є хоча б один current item;
- є `NOT_SENT`, `NEW_AFTER_SEND`, `CHANGED_AFTER_SEND` або removal.

Button disabled, коли:

- current items відсутні;
- усі current items `UNCHANGED` і removals відсутні;
- request lifecycle blocked.

## 16. Edit-flow revalidation

`/admin`, `/admin/requests` і `/admin/requests/{requestId}` revalidate після:

- admin Server Action item update/delete;
- admin RequestItem API `PATCH`/`DELETE`;
- approved `REQUEST_ITEM` Change Request;
- admin vehicle edit;
- client direct vehicle edit;
- approved `VEHICLE` Change Request.

Request item creation route вже мав потрібну revalidation. Client immutable read model не змінювався.

## 17. Repeat send transaction

У тій самій transaction:

1. перевіряються Request, actor і lifecycle;
2. eligibility перераховується з DB;
3. ownership, current versions і exact full set перевіряються повторно;
4. active revision 1 переходить `SENT → SUPERSEDED`;
5. створюється full replacement revision 2 `DRAFT`;
6. revision 2 переходить `DRAFT → SENT`;
7. legacy selected flags reset;
8. Request transition event викликається;
9. audit events записуються;
10. Telegram notification виконується лише після commit.

Будь-яка transaction failure rollback-ить supersede, new batch, flags, audit і status transition.

## 18. Request status behavior

Initial send з `IN_PROGRESS` або `OFFER_PREPARING` переводить Request у `WAITING_APPROVAL`.

Repeat send:

```text
WAITING_APPROVAL → WAITING_APPROVAL
```

Transition service повертає idempotent `noop`. Reopen з пізніших lifecycle statuses не додано.

## 19. RequestStatusHistory

Для same-status repeat send новий `RequestStatusHistory` не створюється. Також не створюється duplicate `REQUEST_STATUS_CHANGED`.

## 20. Audit Log

Зберігаються Stage 4C events:

- `REQUEST_SELECTION_BATCH_SUPERSEDED`;
- `REQUEST_SELECTION_BATCH_CREATED`;
- `REQUEST_SELECTION_BATCH_SENT`;
- `REQUEST_ITEMS_SENT_FOR_APPROVAL`.

У безпечну metadata додано reason, changed/new/removed counts та previous revision. Full snapshots, VIN, supplier, purchase price, comments і secret URLs не записуються.

## 21. Concurrency

- stale item version → `SOURCE_ITEM_VERSION_CONFLICT`, batch не створюється;
- active batch already replaced → fresh eligibility повертає duplicate/stale operation;
- two concurrent resends захищені transaction rollback та existing partial unique active-`SENT` index;
- batch creation повторно перевіряє source versions перед snapshot;
- item deletion/addition після page load порушує exact canonical set або source existence;
- loser transaction не залишає partial batch/status history.

## 22. UI text and UX

Використано:

- changed: `Після останнього надсилання позиції було змінено. Надішліть нову версію клієнту на погодження.`;
- unchanged: `Усі актуальні позиції вже входять до останньої надісланої версії.`;
- new: `Є нові позиції, які ще не входять до надісланої версії.`;
- removed: `Склад добірки змінився після останнього надсилання. Створіть нову версію для клієнта.`;
- blocked: lifecycle-safe message без technical hash/snapshot terminology.

Layout і загальний дизайн секції не змінено.

## 23. Tests

Додано:

```text
npm.cmd run test:request-status-stage4c1
```

Покрито:

- no active / unchanged / critical-field changes;
- quantity, price, catalog, analog, brand, availability, delivery, comment, vehicle, equipment type;
- internal supplier/purchase price та `updatedAt`-only;
- new/removal/null source;
- no-items та blocked lifecycle;
- deterministic hash;
- UI badge/message/button/static safety;
- full replacement integration у Stage 4C harness;
- same-status noop, no duplicate history, legacy reset та rollback regressions.

## 24. Authenticated browser smoke

Статус: `PENDING`.

Новий код не push/deploy на Vercel, а push заборонено без прямої команди. Тому quantity `2 → 3`, revision `1 → 2`, client snapshot `3` і runtime Audit Log не оголошуються як browser `PASS`.

Після окремо погодженого push/deploy потрібно виконати повний 13-step authenticated сценарій на погодженому test record.

## 25. Regression results

PASS:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run test:request-status`;
- `npm.cmd run test:request-status-stage3`;
- `npm.cmd run test:request-selection-batch`;
- `npm.cmd run test:request-status-stage4c`;
- `npm.cmd run test:request-status-stage4c1`;
- `npm.cmd run test:request-status-stage4d` — 24/24;
- `npx.cmd tsx scripts/check-admin-audit-log-2.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-3.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-4.ts`;
- `npx.cmd tsx scripts/check-admin-audit-log-5.ts`;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

## 26. Schema and DB safety

Prisma schema не змінювалась. Migration не створювалась. DDL не виконувалась. Neon/VPS data не змінювались вручну. Eligibility повністю derived із existing `snapshotHash`-adjacent snapshot fields, `sourceUpdatedAt`, `sourceRequestItemId` і `RequestItem.updatedAt`.

## 27. Changed files

- `app/admin/actions.ts`;
- `app/admin/change-request-actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `app/admin/vehicles/actions.ts`;
- `app/api/admin/request-items/[itemId]/route.ts`;
- `app/client/vehicles/actions.ts`;
- `lib/request-selection/resend-eligibility.ts`;
- `lib/request-selection/send-for-approval.ts`;
- `lib/request-selection/snapshot.ts`;
- `package.json`;
- `scripts/check-request-status-stage4c-send-trigger.ts`;
- `scripts/check-request-status-stage4c1-resend-after-edit.ts`;
- цей report.

## 28. Known limitations

- Authenticated Vercel behavior не перевірено до push/deploy.
- Removal останньої current позиції не створює empty revision, бо explicit rule вимагає disabled button без items.
- UI не надає checkbox subset selection; revision автоматично є повним current set.
- Existing Telegram delivery не перевірявся в live runtime; post-commit ordering покрито Stage 4C harness.

## 29. What was intentionally excluded

Не додано:

- client approve/reject;
- batch decision mutations;
- `CLIENT_SELECTION_APPROVED`;
- `WAITING_APPROVAL → AWAITING_INVOICE`;
- Stage 5;
- Change Request redesign;
- CommercialOffer/Invoice/Telegram redesign;
- new statuses;
- legacy backfill;
- schema migration;
- VPS deployment або main merge.

## 30. Stage 5 readiness

Локальна розробка Stage 5: `READY` після зелених Stage 2–4D regression checks і Stage 4C1 implementation.

Vercel runtime testing Stage 5: `NOT READY` до push/deploy Stage 4C1 та фактичного authenticated browser smoke repeat-send flow.

## 31. Final conclusion

Stage 4C1 локально завершено: root cause усунено і в UI, і server-side; approval dirtiness визначається canonical approval hash; `updatedAt` використовується лише для concurrency; repeat send є full replacement revision із збереженням immutable history та same-status noop. Schema/DB/Stage 5 не змінювалися. Єдиний зовнішній gate — окремо дозволені push/deploy та authenticated Vercel smoke.
