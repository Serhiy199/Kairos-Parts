# Stage Request Approval 4 — Simplified invoice selection

## 1. Мета

Спростити canonical Invoice selection для нового aggregate Request Approval
flow: рахунок створюється з `APPROVED` items рівно одного finalized batch,
який клієнт фінально погодив. Історичний multi-finalized flow зберігає
explicit cumulative compatibility без зміни існуючих invoices.

## 2. Початковий invoice resolver

До Stage `resolveInvoiceSelection()`:

- читав усі `APPROVED`, `PARTIALLY_APPROVED` і `REJECTED` batches;
- накопичував `APPROVED` snapshots через `Map`;
- використовував `sourceRequestItemId`, а для detached snapshot —
  `snapshot:${item.id}`;
- новіший approved snapshot замінював старіший з тією самою identity;
- виключав batch items, уже пов’язані з `InvoiceItem`;
- встановлював `Invoice.selectionBatchId` на останній batch з approved item;
- не перевіряв active `SENT` перед cumulative resolution.

`createInvoiceFromApprovedRequestItems()` викликав resolver всередині
`Serializable` transaction, створював `DRAFT` Invoice та exact
`InvoiceItem.selectionBatchItemId`.

`sendInvoiceToClient()` є окремим canonical send workflow. Він перевіряє
active staff actor, ownership, `DRAFT`, непорожній Invoice та
`Request.status = AWAITING_INVOICE`, атомарно виконує send/status/audit і
надсилає Telegram notification після commit.

Початковий Git state:

```text
develop
8d7ba42 feat: allow selection edits before client approval
 M app/(public)/about/page.tsx
```

Під час Stage паралельно з’явилися сторонні diffs:

```text
 M app/admin/requests/page.tsx
M  components/client/client-selection-checkbox-list.tsx
```

Stage їх не редагував і не включав. Паралельна робота завершила їх окремими
commits:

```text
50551c6 refactor: remove category from CRM requests list
2171b0f style: stack client selection status above approval
```

## 3. Legacy cumulative behavior

Історичний cumulative resolver збережений як explicit
`resolveLegacyCumulativeSelection()`.

Він використовується лише коли Request має більше одного finalized batch.
Алгоритм зберігає стару identity replacement semantics:

```text
sourceRequestItemId
або snapshot:${batchItem.id}
```

Це не дає мовчки втратити approved legacy items. `SUPERSEDED` і `SENT`
ніколи не входять до legacy finalized query.

## 4. New simplified selection rule

Новий structural rule:

```text
active SENT batches = 0
AND finalized batches = 1
AND batch.status IN (APPROVED, PARTIALLY_APPROVED)
AND approved item count > 0
→ SIMPLIFIED_FINAL_BATCH
```

Рівно один finalized batch є однозначним source. Для старого
single-revision Request результат ідентичний, тому тут немає ризику втрати
історичних approvals.

Якщо finalized batches більше одного, resolver переходить у
`LEGACY_CUMULATIVE`.

Aggregate audit marker `CLIENT_SELECTION_SUBMITTED` існує, але має
`STANDARD` retention 45 днів. Тому canonical selection не залежить від
тимчасового audit marker.

## 5. Canonical finalized batch resolver

Створено:

```text
resolveCanonicalInvoiceBatch()
```

Resolver повертає typed result:

```text
batch
approvedItems
rejectedCount
sourceMode:
  SIMPLIFIED_FINAL_BATCH
  LEGACY_CUMULATIVE
```

Він спочатку перевіряє active `SENT`, потім читає лише finalized statuses.
Raw ambiguous arrays назовні не повертаються.

## 6. Active SENT guard

Перед finalized selection виконується query:

```text
requestId = target Request
status = SENT
```

Будь-який active `SENT` повертає:

```text
ACTIVE_SELECTION_REVIEW
```

Guard працює і в eligibility read, і повторно всередині Invoice creation
transaction. Старі approved batches не можуть обійти active review.

## 7. Approved item filtering

Для `SIMPLIFIED_FINAL_BATCH`:

- включаються лише `status = APPROVED`;
- `REJECTED` виключені;
- `PENDING` у finalized batch дає `PENDING_ITEMS_REMAIN`;
- `SUPERSEDED` виключені самим finalized query;
- snapshots сортуються за `position`, потім `id`;
- live `RequestItem.approvedByClient`, `includeInInvoice`,
  `visibleToClient` і live prices не читаються;
- missing approved price блокує creation;
- mixed approved currencies блокують creation;
- missing price у rejected/superseded item не блокує creation;
- уже invoiced approved batch item дає controlled blocker.

## 8. Invoice provenance

Для simplified flow:

```text
Invoice.selectionBatchId = canonical finalized batch.id
InvoiceItem.selectionBatchItemId = exact approved batch item.id
```

Commercial fields InvoiceItem копіюються з immutable batch item snapshot.
`requestItemId` залишається nullable compatibility linkage, але не є
canonical commercial source.

У legacy mode `Invoice.selectionBatchId` зберігає попередню semantics
останнього batch з approved item, а кожен `InvoiceItem` зберігає exact
cross-revision `selectionBatchItemId`.

## 9. Eligibility model

`InvoiceSelectionErrorCode` розрізняє:

- `REQUEST_NOT_FOUND`;
- `REQUEST_NOT_AWAITING_INVOICE`;
- `ACTIVE_SELECTION_REVIEW`;
- `NO_FINALIZED_APPROVED_BATCH`;
- `NO_APPROVED_ITEMS`;
- `PENDING_ITEMS_REMAIN`;
- `APPROVED_ITEM_PRICE_MISSING`;
- `APPROVED_ITEMS_CURRENCY_MISMATCH`;
- `APPROVED_ITEMS_ALREADY_INVOICED`;
- `INVOICE_ALREADY_EXISTS_FOR_SELECTION`;
- `LEGACY_SELECTION_AMBIGUOUS`.

`RequestInvoiceEligibility` також повертає `sourceMode`. Active `SENT` не
маскується як `NO_APPROVED_ITEMS`.

Current one-Invoice-per-Request application guard збережений для будь-якого
Invoice status, включно з `CANCELLED`.

## 10. Transaction and concurrency

Створено pure dependency-injected orchestration:

```text
createInvoiceSelectionTransactionWorkflow()
```

Production adapter:

```text
createInvoiceFromApprovedSelection()
→ Serializable transaction
→ createInvoiceFromApprovedSelectionTransaction()
→ resolveInvoiceSelection(tx, requestId)
→ repeat Request/active SENT/existing Invoice/finalized selection checks
→ load Request and billing snapshots
→ create DRAFT Invoice
→ create exact InvoiceItems
→ write financial audit
→ commit
```

`P2034` serialization conflict повторюється один раз. Якщо manager publish
створив `SENT` до transactional reread, повторний resolver повертає
`ACTIVE_SELECTION_REVIEW` і Invoice не створюється.

Unique `Invoice.selectionBatchId` та unique
`InvoiceItem.selectionBatchItemId` залишаються DB provenance guards.
One-Invoice-per-Request загалом залишається application-level.

Focused harness підтверджує:

- duplicate create залишає один Invoice;
- active review не доходить до Invoice create;
- InvoiceItem/create failure rollback;
- audit failure rollback;
- batch і Request status не мутуються під час Invoice creation.

## 11. Legacy compatibility

Backward-compatible strategy:

- один finalized batch — безпечний single-batch source;
- кілька finalized batches — explicit `LEGACY_CUMULATIVE`;
- structural inconsistency повертає controlled error;
- `SUPERSEDED` не бере участі;
- existing invoices не переписуються;
- nullable provenance для pre-batch invoices не змінюється;
- existing `SENT`, `PAID` та previously-sent `CANCELLED` invoice read paths
  не змінюються;
- cancellation/reissue не реалізовані.

## 12. CRM behavior

Active review:

> Клієнт ще не завершив погодження актуального підбору. Рахунок можна
> сформувати після фінального рішення.

Немає approved items:

> У погодженому підборі немає позицій для формування рахунку.

Existing Invoice:

> Для цієї заявки рахунок уже створено.

Legacy ambiguity:

> Заявка містить історичний багатоверсійний підбір. Перед формуванням
> рахунку потрібна перевірка даних.

Technical error codes напряму не рендеряться.

Next.js boundaries збережені: eligibility читається в async Server
Component, mutation лишається Server Action, domain selection і transaction
orchestration — server-side modules.

## 13. Audit

`INVOICE_CREATED` metadata тепер включає allowlisted:

```text
requestId
selectionBatchId
selectionRevision
selectionSourceMode
approvedItemCount
currency
total
```

Full item snapshots і зайві PII до metadata не додаються.

## 14. Tests

Створено:

```text
scripts/check-request-approval-stage4-simplified-invoice-selection.ts
npm.cmd run test:request-approval-stage4
```

Focused suite: PASS, 55 checks.

Також PASS:

- `test:request-approval-ui-1`;
- `test:request-approval-ui-2`;
- `test:request-approval-stage3`;
- `test:request-status-stage5`;
- `test:request-status-stage5a`;
- `test:request-status-stage5a1`;
- `test:request-status-stage5a2`;
- `test:request-status-stage5a3`;
- `test:request-status-stage6`;
- `test:request-status`;
- `test:request-status-stage3`;
- `test:request-selection-batch`;
- `test:request-status-stage4c`;
- `test:request-status-stage4c1`;
- `test:request-status-stage4c2`;
- `test:request-status-stage4c3` — 51 checks;
- `test:request-status-stage4d` — 24/24.

## 15. Validation

Фінальні результати:

```text
npx.cmd prisma validate — PASS
npm.cmd run lint — PASS
npm.cmd run typecheck — PASS
npm.cmd run test:request-approval-stage4 — PASS (55 checks)
git diff --check — PASS
```

Build не запускається, тому що у worktree є сторонній dirty файл:

```text
app/(public)/about/page.tsx
```

Build міг би включити або змінити артефакти паралельної роботи, тому
залишається окремою перевіркою після її commit.

## 16. Changed files

Stage scope:

- `app/admin/actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `docs/reports/stage-request-approval-4-simplified-invoice-selection.md`;
- `lib/admin/request-feedback.ts`;
- `lib/invoices/create-workflow.ts`;
- `lib/invoices/selection.ts`;
- `lib/invoices/service.ts`;
- `package.json`;
- `scripts/check-request-approval-stage4-simplified-invoice-selection.ts`;
- `scripts/check-request-status-stage5a-partial-invoice.ts`;
- `scripts/check-request-status-stage5a2-follow-up.ts`.

## 17. Not changed

- Prisma schema;
- migrations;
- database data;
- existing Invoice rows;
- aggregate client submit;
- checkbox UI;
- manager edit/resend;
- batch finalization;
- zero-selection cancellation;
- invoice send workflow;
- invoice cancellation/paid workflows;
- Telegram;
- env;
- deployment;
- `app/(public)/about/page.tsx`;
- `app/admin/requests/page.tsx`;
- `components/client/client-selection-checkbox-list.tsx`.

## 18. Known limitations

- Invoice cancellation recovery/reissue ще не реалізовано;
- one-Invoice-per-Request invariant залишається application-level;
- destructive schema cleanup не виконувався;
- legacy cumulative resolver залишається для історичних даних;
- durable notification outbox не реалізований;
- live PostgreSQL concurrency QA залишається окремою runtime-перевіркою;
- authenticated browser/mobile QA не виконувався;
- aggregate audit marker має 45-day retention, тому source mode визначається
  за безпечною structural cardinality, а не за audit marker.

## 19. Next Stage

Окремий Stage може:

1. спроєктувати cancellation recovery/reissue;
2. додати DB-level one-Invoice-per-Request policy після data audit;
3. виконати live PostgreSQL race QA;
4. виконати authenticated CRM browser/mobile QA;
5. розглянути durable notification outbox.

## 20. Git state

Перед commit staging має містити лише 11 Stage Request Approval 4 files.

Сторонній:

```text
app/(public)/about/page.tsx
```

має залишитися лише unstaged. `app/admin/requests/page.tsx` і
`components/client/client-selection-checkbox-list.tsx` тимчасово були
паралельними dirty/staged diffs, не редагувалися Stage і до фінального
staging уже були закомічені окремою роботою. Push не виконується.
