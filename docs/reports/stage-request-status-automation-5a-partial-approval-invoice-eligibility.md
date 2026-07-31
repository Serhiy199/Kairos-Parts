# Stage Request Status Automation 5A — Partial approval and invoice eligibility

## 1. Executive summary

Stage 5A додає завершений mixed outcome для immutable selection batch і робить
цей batch єдиним джерелом позицій для рахунку. Перший reject більше не закриває
batch. Рахунок для partial approval містить тільки `APPROVED` snapshot items.

## 2. Git and branch state

Робота виконана безпосередньо у фактичній основній гілці `develop` від
`10a6cf976081201faeeb2d8dfb21aed065d3f7c6`. `main` не checkout і не змінювалася.
Push не виконувався.

## 3. Confirmed business rule

| Aggregate | Batch | Request | Invoice |
| --- | --- | --- | --- |
| є `PENDING` | `SENT` | `WAITING_APPROVAL` | disabled |
| усі `APPROVED` | `APPROVED` | `AWAITING_INVOICE` | усі items |
| `APPROVED` + `REJECTED`, без `PENDING` | `PARTIALLY_APPROVED` | `AWAITING_INVOICE` | лише approved |
| усі `REJECTED` | `REJECTED` | `WAITING_APPROVAL` | disabled |

## 4. Current Stage 5 behavior

До Stage 5A перший `REJECTED` item негайно викликав batch event `REJECT`, тому
решта `PENDING` items ставала недоступною для рішень, а mixed approval не міг
дійти до invoice-eligible стану.

## 5. Root cause of invoice ineligibility

Старий invoice service читав live `RequestItem`, фільтрував
`approvedByClient/includeInInvoice/visibleToClient` і перетворював відсутню
`salePrice` на zero. Цей шлях не був прив'язаний до immutable batch revision.

| Current source | Current filter | Problem | New source |
| --- | --- | --- | --- |
| live `RequestItem` | legacy approval flags | mutable, без revision provenance | latest finalized immutable batch |

## 6. PARTIALLY_APPROVED enum and migration

Додано `RequestSelectionBatchStatus.PARTIALLY_APPROVED` через additive migration
`20260728150000_add_partially_approved_selection_batch_status`.

```sql
ALTER TYPE "RequestSelectionBatchStatus"
  ADD VALUE IF NOT EXISTS 'PARTIALLY_APPROVED';
```

## 7. Batch lifecycle matrix

`SENT -> PARTIALLY_APPROVED` дозволений тільки event
`PARTIALLY_APPROVE`. `APPROVED`, `PARTIALLY_APPROVED`, `REJECTED` і
`SUPERSEDED` є terminal batch states; повтор того самого event є noop.

## 8. Aggregate decision algorithm

Після кожного успішного item CAS update виконується `groupBy(status)`. При
`pendingCount > 0` batch не змінюється. При нулі pending обирається рівно один
event: `APPROVE`, `PARTIALLY_APPROVE` або `REJECT`.

## 9. Pending decision behavior

Approve або reject окремої позиції з іншими pending позиціями повертає
`batchOutcome: unchanged`; batch лишається `SENT`, controls для інших pending
items активні.

## 10. Full approval behavior

Коли `approvedCount = totalCount`, batch переходить у `APPROVED`, Request — у
`AWAITING_INVOICE`, invoice selection містить усі snapshot items.

## 11. Partial approval behavior

Коли `approvedCount > 0`, `rejectedCount > 0`, `pendingCount = 0`, batch
переходить у `PARTIALLY_APPROVED`, а Request — у `AWAITING_INVOICE`.

## 12. All rejected behavior

Коли `rejectedCount = totalCount`, batch стає `REJECTED`. Request не
переходить і лишається `WAITING_APPROVAL`; invoice eligibility відсутня.

## 13. Request status transition

Full і partial finalization повторно використовують canonical event
`CLIENT_SELECTION_APPROVED`. Hidden backward transition або Stage 6 event не
додавалися.

## 14. RequestStatusHistory

Canonical Request transition створює одну history row для переходу
`WAITING_APPROVAL -> AWAITING_INVOICE`. Item decisions і all-rejected
finalization не створюють зайвих Request history rows.

## 15. Audit Log

Item audit лишився per-decision:
`REQUEST_SELECTION_ITEM_APPROVED/REJECTED`. Додано batch audit
`REQUEST_SELECTION_BATCH_PARTIALLY_APPROVED`. Batch і Request metadata містять
`batchId`, `revision`, `totalCount`, `approvedCount`, `rejectedCount` і
`partial`; client comment не копіюється в metadata.

## 16. Client UI

UI показує localized batch state, approved/rejected counts і окремі тексти для
full, partial та all-rejected outcomes. Текст про закриття після першого reject
видалено. Controls доступні тільки для `SENT/PENDING`.

## 17. Admin UI

Admin summary локалізує status, показує item decisions і approved/rejected
counts. Raw enum у status badge не виводиться.

## 18. Invoice eligibility source

`getRequestInvoiceEligibility()` і `resolveInvoiceSelection()` є canonical
read/guard API. Eligibility вимагає Request `AWAITING_INVOICE` і latest batch
зі status `APPROVED` або `PARTIALLY_APPROVED`.

## 19. Approved snapshot item selection

Invoice items будуються тільки з `RequestSelectionBatchItem.status =
APPROVED`. `REJECTED` та `PENDING` не включаються. Назва, quantity, unit,
price, currency, comment і каталожні дані беруться зі snapshot.

## 20. Price and currency guards

Будь-який approved item з `approvedUnitPrice = null` блокує рахунок кодом
`APPROVED_ITEM_PRICE_MISSING`; zero fallback видалено. Більше однієї currency
блокує рахунок кодом `APPROVED_ITEMS_CURRENCY_MISMATCH`.

## 21. Invoice creation flow audit

Role guard лишився поза транзакцією. Усередині Serializable transaction
повторно перевіряються Request, latest batch, finalized aggregate, duplicate
invoice, seller/buyer billing snapshots, item source і totals. Audit створюється
в тій самій транзакції.

## 22. Invoice provenance

Additive migration
`20260728151000_add_invoice_selection_provenance` додає nullable unique
`Invoice.selectionBatchId` і `InvoiceItem.selectionBatchItemId`, indexes та
`ON DELETE SET NULL` foreign keys. Нові invoices завжди записують обидва links.

## 23. Invoice button eligibility

Кнопка більше не залежить від legacy flags. Вона активна тільки коли canonical
eligibility повертає `eligible: true`; UI показує revision, approved/rejected
counts або точну blocked reason.

## 24. Concurrency and idempotency

Item decisions виконуються в Serializable transaction, item update має CAS
`status=PENDING`, batch update — CAS на current status; `P2034` повторюється
один раз. Invoice creation також повторює один `P2034`. Unique
`Invoice.selectionBatchId` і `InvoiceItem.selectionBatchItemId` перетворюють
double click/race на `invoice-selection-already-invoiced`.

## 25. Error and feedback model

Додано typed invoice selection codes для wrong Request status, missing/stale
batch, no approved items, missing price, currency mismatch і duplicate invoice.
Client feedback розрізняє pending reject, partial finalization, full approval та
all rejected.

## 26. Tests

Додано `test:request-status-stage5a`. Він перевіряє additive migrations,
lifecycle, mixed/full aggregates, stale/pending guard, approved-only selection,
missing price, currency mismatch, provenance, duplicate guard і UI wiring.
Stage 5 behavioral test оновлено для first-reject/pending, partial і all
rejected.

## 27. Neon migration activation

У `kairos-parts-db/main` перед migration створено manual snapshot
`main at 2026-07-28 13:47:52 UTC (manual)`. Pending list містив тільки дві
Stage 5A migrations; обидві застосовані `prisma migrate deploy`.

## 28. Real DB verification

Контрольний fixture у транзакції Neon дав:

```text
1 APPROVED
9 REJECTED
0 PENDING
batch PARTIALLY_APPROVED
Request AWAITING_INVOICE
invoice selection count 1
```

Rejected items були виключені. Виконано `ROLLBACK`; перевірка залишків
повернула zero. Через локальну Windows Prisma TLS помилку fixture був
DB-level через `pg`; domain-service поведінка покрита Stage 5/5A tests.

## 29. Authenticated browser smoke

Pending. Stage 5A не push/deploy за умовою завдання, тому браузерна перевірка
deployed partial/all-rejected/full-approved flows не могла бути чесно виконана.

## 30. Runtime logs

Pending разом із deployment/browser smoke. Vercel runtime logs для Stage 5A не
існують до deployment; PASS не заявляється.

## 31. Regression results

PASS: Request Status Stage 2, Stage 3, selection batch 4B, 4C, 4C1, 4C2, 4C3,
4D, Stage 5, Stage 5A. PASS: Admin Audit Log 2, 3, 4, 5. PASS: lint,
typecheck, build, Prisma validate/generate і `git diff --check`.

## 32. Prisma and DB safety

Schema changes additive й nullable. `reset`, `db push`, `TRUNCATE`, destructive
backfill і VPS DB не використовувалися. Restore snapshot створено до migration.

## 33. Changed files

Змінено Prisma schema/migrations, batch lifecycle/service/client decision/read
model/presentation, Request transition metadata, invoice selection/service,
client/admin UI feedback, Stage 4B/5 regression scripts, package script і цей
report. Тимчасові migration/Neon verification scripts видалені.

## 34. Known limitations

Після `PARTIALLY_APPROVED` Request орієнтований на invoice approved subset.
Автоматичний resend/reopen rejected items не реалізовано. Реальний concurrent
race і deployed browser flow лишаються runtime QA після окремого deployment.

## 35. What was intentionally excluded

Stage 6, Invoice `SENT` Request trigger, backward Request transitions,
автоматичний reopen/resend, VPS operations, push і deployment не виконувалися.

## 36. Stage 6 readiness

Локальна розробка Stage 6 готова після чистих checks і активованих Stage 5A
migrations у погодженій test DB. Vercel runtime testing Stage 6 не готовий до
push/deployment і Stage 5A browser smoke.

## 37. Final conclusion

Stage 5A реалізує погоджену aggregate matrix, immutable approved-only invoice
source, price/currency safety та provenance без зміни Stage 6 boundaries.
Локальні/DB checks пройдені; deployment-dependent QA чесно лишено pending.
