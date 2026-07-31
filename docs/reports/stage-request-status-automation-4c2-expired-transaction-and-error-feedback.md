# Stage Request Status Automation 4C2 — Fix expired Prisma transaction client and error feedback

## 1. Executive summary

Stage 4C2 усуває runtime failure повторного send, який виникав на пізньому actor lookup у Prisma interactive transaction. Outer send service і раніше був єдиним owner transaction, але callback виконував багато послідовних remote Neon round-trips без explicit transaction options. Пізній `transitionRequestStatus()` досягав `tx.user.findUnique()` після закриття transaction за default timeout.

Fix:

- Request status transition перенесено ближче до середини callback — одразу після `DRAFT → SENT`;
- outer send transaction отримала scoped `maxWait=5000` і `timeout=15000`;
- callback винесено в explicit `executeTransaction()` і повертає лише fully awaited plain data;
- `P2028`/expired transaction отримує internal code `TRANSACTION_CLIENT_EXPIRED`;
- інші неочікувані transaction failures отримують `DATABASE_TRANSACTION_FAILED`;
- Telegram лишився post-commit і отримує тільки `{ requestId }`;
- admin feedback переведено на controlled `success/warning/error` model.

Локальні tests і regressions пройшли. Authenticated Vercel smoke має статус `PENDING` до окремо дозволених push/deploy.

## 2. Git і branch state

Pre-check:

- branch: `develop`;
- початковий working tree: clean;
- початковий `HEAD`: `c4bff6ef6e0a2671f356e1a8a88316bbd7dfc912`;
- Stage 4C1 commit міститься у `develop`;
- remote: `origin git@github.com:Serhiy199/Kairos-Parts.git`;
- feature branch не створювався;
- `main` не checkout-ився і не змінювався;
- push не виконувався.

## 3. Runtime defect reproduction

Фактичний authenticated Stage 4C1 smoke:

1. active revision 1 має `SENT`;
2. manager змінює `quantity: 2 → 3`;
3. eligibility показує `CHANGED_AFTER_SEND`;
4. send button стає active;
5. resend доходить до Request status transition;
6. Prisma повертає `Transaction not found` на `user.findUnique()`;
7. canonical service мапить помилку в `REQUEST_STATUS_TRANSITION_FAILED`;
8. outer transaction rollback-иться.

Focused Stage 4C2 test окремо моделює late query після попереднього default 5-second budget і відтворює `P2028`/`Transaction not found`.

## 4. Exact call chain

```text
app/admin/actions.ts
sendAdminRequestItemsForApproval()
  → sendRequestSelectionForApproval()
    → prisma.$transaction(executeTransaction)
      → request + actor lookup
      → resend eligibility
      → active batch + source version validation
      → transitionRequestSelectionBatchStatus(SUPERSEDE, tx)
      → createRequestSelectionBatchDraft(tx)
      → transitionRequestSelectionBatchStatus(SEND, tx)
      → transitionRequestStatus(SELECTION_SENT_FOR_APPROVAL, tx)
        → executeRequestStatusTransition(tx)
          → tx.request.findUnique()
          → tx.user.findUnique()  ← runtime failure before fix
```

Після fix status transition завершується одразу після `DRAFT → SENT` і до visibility/reset та final legacy audit. Уся послідовність все одно лишається в одній atomic transaction.

## 5. Root cause of expired transaction client

Root cause — не post-commit closure і не factory, збережена в module scope з old `tx`.

Фактичні умови:

- outer send transaction не передавала explicit `timeout`;
- Prisma interactive transaction використовувала default timeout;
- remote Neon додає network latency до кожного query;
- resend виконує supersede/create/audits/actor validation і status transition;
- `transitionRequestStatus()` був останнім великим domain call;
- його `tx.user.findUnique()` виконувався всередині callback, але transaction proxy уже була закрита Prisma engine за timeout.

Текст Prisma показував `prisma.user.findUnique()`, але operation ішла через переданий `Prisma.TransactionClient`, не через standalone global query path.

## 6. Transaction ownership model

Єдине правило:

```text
sendRequestSelectionForApproval() owns the outer transaction
```

`executeTransaction(tx)` завершує:

- request/actor validation;
- eligibility;
- source validation;
- supersede;
- draft batch creation та snapshots;
- Request status transition/history/audit;
- batch send;
- visibility/approval reset;
- legacy audit.

Після callback дозволені лише notification result mapping. Revalidation виконує Server Action після завершення canonical service.

## 7. Actor lookup lifecycle

Actor reads:

- initial send authorization — всередині outer transaction;
- Stage 4B batch create/transition authorization — з тим самим `tx`;
- Stage 2 Request status authorization — з тим самим `tx`;
- Audit actor snapshots — через `writeAuditLog(tx, ...)`.

Жоден actor lookup не виконується через returned callback або Telegram handler. Пізній Request status actor lookup перенесено раніше, поки transaction active.

## 8. Audit Log transaction lifecycle

Усі batch, status і legacy audits fully awaited всередині `executeTransaction()`. `writeAuditLog()` отримує саме outer `tx`, синхронно resolve-ить actor snapshot і створює row до callback return.

Audit promises, writer, callback або model accessor не повертаються назовні. Audit failure rollback-ить всю resend operation.

## 9. Batch/status services transaction lifecycle

Production factory services module-scoped і прив'язані до global Prisma лише для standalone mode. Кожен call у send flow явно передає `tx`, тому:

```text
tx present → execute on supplied tx → no nested transaction
```

Existing transaction і standalone APIs збережені. Focused tests перевіряють, що batch create, batch transition і Request transition отримують той самий outer transaction reference.

## 10. Post-commit Telegram isolation

Transaction result містить тільки:

```text
requestId
batchId
revision
itemCount
supersededBatchId
hiddenPreviousItemCount
requestStatusTransition
```

Після resolve:

```ts
dependencies.notify({ requestId: committed.requestId })
```

Telegram не отримує `tx`, transaction-bound service, Prisma model, lazy promise або actor loader. Telegram failure не rollback-ить DB і повертається як retryable notification failure.

## 11. Revalidation isolation

`revalidatePath()` виконується у `sendAdminRequestItemsForApproval()` лише після:

```text
await sendRequestSelectionForApproval(...)
```

Revalidation не входить у interactive transaction, не утримує її відкритою і не отримує `tx`.

## 12. Transaction timeout analysis

До fix explicit options не було; використовувався Prisma default interactive transaction timeout.

Всередині callback немає:

- Telegram/HTTP fetch;
- Vercel API;
- Cloudinary;
- email;
- `revalidatePath`;
- sleeps/retries.

Тривалість формувалася DB round-trips: повторна actor validation, batch lifecycle, revision allocation, snapshot rows, status/history та кілька audits. Для remote Neon 5-second default був недостатньо надійним.

Stage 4C2 не змінює global Prisma configuration. Лише approval-send transaction має explicit:

```text
maxWait: 5000 ms
timeout: 15000 ms
```

Timeout increase не є єдиним fix: late status transition перенесено раніше, callback boundary зроблено explicit, post-commit ізольовано, а expired error тепер класифікується окремо.

## 13. Refactor/fix

Основні зміни:

1. `executeTransaction(tx)` є explicit callback і повертає `SendRequestSelectionCommitResult`.
2. Status transition виконується одразу після batch `DRAFT → SENT`, до compatibility writes та final legacy audit.
3. Outer `$transaction` отримує scoped options.
4. `isExpiredPrismaTransactionError()` проходить cause chain без логування raw details.
5. Expired transaction → `TRANSACTION_CLIENT_EXPIRED`.
6. Інший unexpected transaction error → `DATABASE_TRANSACTION_FAILED`.
7. Server Action як і раніше показує лише controlled generic DB error text.

## 14. Atomic rollback guarantees

Focused test симулює expired status transition після supersede та revision allocation.

Після failure:

- old batch: `SENT`;
- new batch: відсутній;
- counter: лишається `1`;
- item visibility/approval: без змін;
- legacy audit: відсутній;
- Telegram: не викликаний.

Після retry:

- old batch: `SUPERSEDED`;
- new batch: revision 2, `SENT`;
- counter: `2`;
- approval flags reset;
- Request transition: idempotent `noop`.

## 15. Error code handling

Internal typed codes:

- `TRANSACTION_CLIENT_EXPIRED` — `P2028`, `Transaction not found`, old closed transaction;
- `DATABASE_TRANSACTION_FAILED` — інша unexpected outer transaction failure;
- existing domain codes не змінені;
- Telegram failure лишається `TELEGRAM_NOTIFICATION_FAILED`.

UI не показує raw Prisma message або internal code. DB failure redirect-иться на controlled `items-send-error`.

## 16. Feedback presentation root cause

| State source | Message | Style до fix | Expected |
| --- | --- | --- | --- |
| `result=items-sent-for-approval` | success | green | green |
| `result=items-sent-for-approval-notification-failed` | partial success | green | amber warning |
| `result=items-send-error` | DB failure | green | red error |

`resultMessage()` повертав лише string, а page завжди рендерила одну success class combination. Tone не був частиною model.

## 17. Typed feedback model

Додано `lib/admin/request-feedback.ts`:

```ts
type AdminActionFeedbackTone = 'success' | 'warning' | 'error';

type AdminActionFeedback = {
  tone;
  marker;
  message;
  className;
};
```

Query передає тільки controlled result code. Code мапиться server-side. Unknown/injected code повертає `null`; URL не може передати HTML або CSS class.

## 18. Success/error/warning styling

- success: `border-success/30 bg-[#E7F6EC] text-success`;
- warning: `border-accent/40 bg-[#FFF7E0] text-[#8A5B24]`;
- error: `border-danger/30 bg-danger/10 text-danger`.

Tone не передається лише кольором:

- `Успішно:`;
- `Увага:`;
- `Помилка:`.

Error має `role="alert"` та assertive live region. Success/warning мають `role="status"` і polite live region.

## 19. Tests

Додано:

```text
npm.cmd run test:request-status-stage4c2
```

Focused coverage:

- previous 5s late-query expiry reproduction;
- 15s scoped budget;
- `P2028` та nested cause detection;
- one outer transaction per attempt;
- same tx for all composable services;
- no tx-bound object in returned result;
- no post-close tx query;
- Telegram only after commit і plain `{requestId}`;
- expired failure rollback;
- old batch/counter preservation;
- retry success revision 2;
- success/error/warning feedback;
- red error and amber Telegram warning;
- `role="alert"`;
- unknown/XSS/class-injection code rejection;
- revalidation after canonical service.

## 20. Authenticated browser smoke

Статус: `PENDING`.

Stage 4C2 code не push/deploy у Vercel, а task прямо забороняє push без окремої команди. Тому новий runtime flow `quantity 2 → 3`, revision `1 → 2`, client snapshot 3 не оголошується як browser PASS.

Після окремо дозволених push/deploy потрібно повторити authenticated ADMIN/CLIENT smoke на погодженому test record.

## 21. Runtime log verification

Статус: `PENDING`.

Historical `Transaction not found` підтверджує defect до fix. Відсутність нових occurrences можна перевірити лише після deployment Stage 4C2 і фактичного resend у визначеному time window/request ID.

## 22. Regression results

PASS:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run test:request-status`;
- `npm.cmd run test:request-status-stage3`;
- `npm.cmd run test:request-selection-batch`;
- `npm.cmd run test:request-status-stage4c`;
- `npm.cmd run test:request-status-stage4c1`;
- `npm.cmd run test:request-status-stage4c2`;
- `npm.cmd run test:request-status-stage4d` — 24/24;
- Audit Log 2, 3, 4, 5 scripts;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

## 23. Prisma and DB safety

Prisma schema не змінювалась. Migration не створювалась. DDL та data mutation не виконувались. Test DB не використовувалась до deployment. VPS DB не змінювалась.

## 24. Changed files

- `app/admin/requests/[id]/page.tsx`;
- `lib/admin/request-feedback.ts`;
- `lib/request-selection/send-for-approval.ts`;
- `package.json`;
- `scripts/check-request-status-stage4c-send-trigger.ts`;
- `scripts/check-request-status-stage4c2-transaction-feedback.ts`;
- цей report.

## 25. Known limitations

- Authenticated Vercel smoke і new-log time-window verification pending deployment.
- Scoped 15s timeout не є durable protection від arbitrary DB/network outage; такі failures повертаються controlled error і rollback.
- Telegram досі не має durable outbox між DB commit і external delivery.
- Browser error-path smoke не моделювався на remote DB, щоб не мутувати test data до deployment.

## 26. What was intentionally excluded

Не додано:

- Stage 5;
- client approve/reject;
- batch item decisions;
- `CLIENT_SELECTION_APPROVED`;
- `WAITING_APPROVAL → AWAITING_INVOICE`;
- Change Request/CommercialOffer/Invoice redesign;
- schema/migration;
- VPS deployment;
- main merge;
- push.

## 27. Stage 5 readiness

Локальна розробка Stage 5: `READY` після зелених transaction/feedback та Stage 2–4D regressions.

Vercel runtime testing Stage 5: `NOT READY` до deployment Stage 4C2, authenticated repeat-send smoke і runtime log verification.

## 28. Final conclusion

Stage 4C2 локально усуває підтверджену late-query transaction expiry: transaction owner explicit, status actor lookup відбувається раніше, callback повертає plain data, post-commit Telegram/revalidation не мають доступу до `tx`, scoped timeout відповідає remote Neon workload, а rollback/retry покриті focused test. Error feedback більше не рендериться success-green: DB failure red, Telegram partial failure amber, success green. Зовнішнім gate лишається окремо дозволений Vercel deployment і authenticated smoke.
