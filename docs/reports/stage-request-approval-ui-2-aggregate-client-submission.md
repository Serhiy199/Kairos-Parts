# Stage Request Approval UI 2 — Aggregate client submission

## 1. Мета

Реалізувати одну фінальну CLIENT-операцію для active immutable selection batch:
checked `RequestSelectionBatchItem.id` стають `APPROVED`, unchecked —
`REJECTED`, batch та Request фіналізуються атомарно, а active UI більше не
використовує per-item approve/reject mutations.

## 2. Початковий стан

Початковий Git state:

```text
branch: develop
HEAD: d31cdbad2d8fca0035df351daf328e67d9f83cc8
 M app/(public)/about/page.tsx
```

Staging був порожній. Сторонній `app/(public)/about/page.tsx` не редагувався,
не форматувався і не включається до цього Stage.

Stage UI 1 уже надавав local `ReadonlySet<string>`, checkbox для
`SENT/PENDING`, summary і keyed reset за `batchId:revision`, але не мав
aggregate submit.

## 3. Current per-item flow

Попередній canonical per-item flow:

```text
ClientSelectionDecisionControls
→ decideClientSelectionItemAction()
→ decideClientSelectionItem()
→ один PENDING item стає APPROVED або REJECTED
→ після останнього рішення фіналізуються batch і Request
```

Reject вимагав `clientComment`. Per-item service мав ownership, optimistic
guards, item audit, batch aggregate та Request transition.

Новий active checkbox UI більше не монтує `ClientSelectionDecisionControls` і
не викликає `decideClientSelectionItemAction`. Старий component, Server Action
і `client-decision.ts` залишені для compatibility/tests та окремого cleanup
Stage.

## 4. Aggregate submission contract

Canonical input:

```ts
type SubmitClientSelectionInput = {
  requestId: string;
  batchId: string;
  expectedRevision: number;
  approvedBatchItemIds: string[];
  actor: { id: string };
  source?: AuditSource;
  requestContext?: AuditRequestContext;
  tx?: Prisma.TransactionClient;
};
```

`approvedBatchItemIds` містить лише `RequestSelectionBatchItem.id`. Payload не
містить `RequestItem.id`, `sourceRequestItemId`, position, decision map,
comment, rejection reason, batch status або Request status.

Порожній масив є валідним reject-all command. Duplicate/blank IDs дають
controlled `DUPLICATE_BATCH_ITEM_ID`; silent deduplication не виконується.

## 5. Authorization and ownership

`submitClientSelection()` у transaction повторно перевіряє:

- actor існує;
- `role=CLIENT`;
- `status=ACTIVE`;
- існує `ClientProfile`;
- Request існує;
- personal ownership через `request.clientId`, або company ownership через
  active membership;
- batch належить submitted Request.

Чужий CLIENT отримує `REQUEST_ACCESS_DENIED`. ADMIN, MANAGER, inactive або
CLIENT без profile отримують `ACTOR_NOT_ALLOWED`.

Application layer додатково використовує `requireClientSession()`, але domain
service не покладається лише на session.

## 6. Transaction model

Standalone execution використовує:

```text
isolationLevel: Serializable
maxWait: 5 seconds
timeout: 15 seconds
one retry on Prisma P2034
```

В одній transaction:

1. читаються actor, Request і exact batch;
2. перевіряються ownership, revision, status та active batch identity;
3. завантажуються всі batch items;
4. валідуються approved IDs;
5. selected `PENDING → APPROVED`;
6. unchecked `PENDING → REJECTED`;
7. ставляться decision actor і timestamps, `clientComment=null`;
8. batch conditional transition;
9. Request canonical transition;
10. Request status invariant reread;
11. aggregate audit write;
12. commit.

Будь-яка невідповідність count, transition failure, invariant failure або
audit failure rollback-ить усі item, batch, Request, history та audit changes.

## 7. Decision mapping

Backend, а не UI, визначає рішення:

```text
item.id ∈ approvedBatchItemIds → APPROVED
item.id ∉ approvedBatchItemIds → REJECTED
```

Для approved:

- `decisionByUserId=CLIENT`;
- `approvedAt=now`;
- `rejectedAt=null`;
- `clientComment=null`.

Для rejected:

- `decisionByUserId=CLIENT`;
- `approvedAt=null`;
- `rejectedAt=now`;
- `clientComment=null`.

Новий flow не вимагає й не записує rejection comment.

## 8. Batch finalization

| Approved count | Batch event | Result |
|---:|---|---|
| `total` | `APPROVE` | `APPROVED` |
| `1..total-1` | `PARTIALLY_APPROVE` | `PARTIALLY_APPROVED` |
| `0` | `REJECT` | `REJECTED` |

Використовується existing
`transitionRequestSelectionBatchStatus({ tx })`. Його aggregate guards
повторно перевіряють, що items повністю відповідають target state, а
conditional `SENT` update не дозволяє одночасний supersede/finalize.

## 9. Request status transitions

All/partial використовують existing automatic event:

```text
CLIENT_SELECTION_APPROVED
WAITING_APPROVAL → AWAITING_INVOICE
AWAITING_INVOICE → noop для follow-up
```

Zero-selection отримав explicit automatic CLIENT-only event:

```text
CLIENT_SELECTION_REJECTED_ALL
WAITING_APPROVAL → CANCELLED
AWAITING_INVOICE → CANCELLED
```

Manual CRM event не використовується. Event входить до automatic set, тому
canonical status audit має `automatic=true`.

## 10. Idempotency

Для finalized `APPROVED`, `PARTIALLY_APPROVED` або `REJECTED` batch service:

1. сортує persisted approved batch item IDs;
2. сортує submitted IDs;
3. перевіряє exact equality;
4. перевіряє, що approved + rejected = total;
5. перевіряє відповідність aggregate count і persisted batch status.

Exact retry повертає:

```text
outcome=noop
reason=identical_submission
```

Без нового audit, history, notification або timestamps.

Інший submitted set повертає `SUBMISSION_CONFLICT` і не змінює persisted
decisions.

## 11. Concurrency and stale revision

Stale guards:

- exact `batch.id`;
- exact `requestId`;
- exact `revision`;
- `batch.status=SENT`;
- рівно один active `SENT` batch з тим самим ID/revision;
- усі items ще `PENDING`;
- conditional item update counts;
- conditional batch transition;
- Serializable transaction.

Double identical submit серіалізується як `changed + noop`. Double conflicting
submit — `changed + conflict`. Якщо manager supersede commit-иться першим,
CLIENT отримує `STALE_SELECTION_REVISION` і жоден item не змінюється. Якщо
CLIENT finalize commit-иться першим, supersede більше не може змінити
finalized batch.

## 12. Audit and history

Збережені canonical записи:

1. Batch transition audit:
   `REQUEST_SELECTION_BATCH_APPROVED`,
   `REQUEST_SELECTION_BATCH_PARTIALLY_APPROVED` або
   `REQUEST_SELECTION_BATCH_REJECTED`.
2. Request transition audit: `REQUEST_STATUS_CHANGED`.
3. Aggregate audit:
   `REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED` з metadata
   `event=CLIENT_SELECTION_SUBMITTED`.

Aggregate metadata:

```text
requestId
batchId
revision
totalItems
approvedItems
rejectedItems
batchResult
requestResult
```

Full item snapshots, product descriptions, PII та comments не пишуться.

Новий flow не створює item-level audit на кожну позицію: aggregate audit
фіксує один user command, а batch/Request audits — його lifecycle effects.
Legacy per-item flow продовжує власні item-level audit events.

`RequestStatusHistory` створюється canonical service лише для changed
`AWAITING_INVOICE` або `CANCELLED` transition. Noop, stale, validation,
forbidden, conflict та rollback history не створюють.

## 13. Client UI

`ClientSelectionCheckboxList` тепер:

- показує активну кнопку `Надіслати погодження`;
- передає `requestId`, `batchId`, `revision` і checked IDs;
- не передає unchecked IDs;
- отримує Server Action як injected prop від server
  `ClientApprovalBatchSection`;
- використовує `useTransition`, toast і `router.refresh()`;
- не очищає selection до server result;
- після success/stale закриває dialog і refresh-ить server state;
- після validation/network error зберігає local `Set`.

Finalized batch не має eligible items, тому не показує submit button або
interactive checkbox.

## 14. Confirmation behavior

Для selected items dialog показує:

- `X із Y`;
- попередження, що unchecked стануть непогодженими;
- immutable decision warning;
- buttons `Повернутися до перегляду` і
  `Підтвердити та надіслати`.

Для zero-selection dialog окремо повідомляє:

- жодної позиції не погоджено;
- Request буде скасовано;
- Invoice не формуватиметься;
- confirm button: `Підтвердити відмову`.

Dialog має `role=alertdialog`, `aria-modal`, title/description relations,
initial button focus та Escape close до початку pending.

## 15. Pending and error states

Після confirm:

- `pending=true`;
- усі checkbox disabled;
- summary submit button disabled;
- dialog buttons disabled;
- повторний handler guard `if (pending) return`;
- label `Надсилаємо погодження…`.

Success/noop показує toast і refresh. Stale показує controlled warning,
закриває old dialog і refresh-ить revision. Validation/conflict/error не
очищає local selection. Network exception показує error toast і дозволяє
повторити submit.

## 16. Legacy compatibility

Залишені без змін:

- `decideClientSelectionItemAction`;
- `decideClientSelectionItem`;
- `ClientSelectionDecisionControls`;
- rejection comment parsing та DB column;
- `ClientLegacySelectionSection`;
- historical read-only `clientComment`;
- manager/admin batch presentation.

Active `SENT/PENDING` checkbox UI не має доступу до старих per-item controls.

## 17. Tests

Додано `test:request-approval-ui-2`, який покриває:

- all/partial/zero decision mapping;
- Request і batch targets;
- nullable rejection comment;
- unknown/foreign/duplicate IDs;
- foreign/inactive/non-CLIENT actor;
- superseded/wrong revision;
- exact noop і conflicting retry;
- item/batch/Request/audit failure rollback;
- history/audit counts;
- double identical/conflicting submit;
- submit-vs-supersede;
- absence of `PENDING` у finalized batch;
- UI button/dialog/zero text/pending guards;
- action payload і domain wiring.

Оновлено:

- UI 1 test для нового active aggregate button без втрати local-state proof;
- core Request transition test для `CLIENT_SELECTION_REJECTED_ALL`;
- Stage 4D source assertion: active batch тепер очікує aggregate checkbox
  component, а legacy action залишається ізольованим.

Regression suite включає batch foundation, Stage 4C–4D, Stage 5, 5A, 5A1,
5A2, 5A3, 6 та UI 1.

## 18. Validation

Фінальні checks:

```text
npx.cmd prisma validate — PASS
npm.cmd run lint — PASS
npm.cmd run typecheck — PASS
npm.cmd run test:request-approval-ui-2 — PASS
npm.cmd run test:request-approval-ui-1 — PASS
npm.cmd run test:request-status — PASS
npm.cmd run test:request-selection-batch — PASS
npm.cmd run test:request-status-stage4c — PASS
npm.cmd run test:request-status-stage4c1 — PASS
npm.cmd run test:request-status-stage4c2 — PASS
npm.cmd run test:request-status-stage4c3 — PASS
npm.cmd run test:request-status-stage4d — PASS (24/24)
npm.cmd run test:request-status-stage5 — PASS
npm.cmd run test:request-status-stage5a — PASS
npm.cmd run test:request-status-stage5a1 — PASS
npm.cmd run test:request-status-stage5a2 — PASS
npm.cmd run test:request-status-stage5a3 — PASS
npm.cmd run test:request-status-stage6 — PASS
git diff --check — PASS
```

Build не запускається через сторонній dirty
`app/(public)/about/page.tsx`, відповідно до Stage safety gate.

## 19. Changed files

- `app/client/actions.ts`;
- `components/client/client-approval-batch-section.tsx`;
- `components/client/client-selection-checkbox-list.tsx`;
- `lib/client/request-feedback.ts`;
- `lib/request-selection/client-submission.ts`;
- `lib/requests/status-transition.ts`;
- `scripts/check-request-approval-ui-1-checkbox-selection.ts`;
- `scripts/check-request-approval-ui-2-aggregate-submission.ts`;
- `scripts/check-request-status-stage4d-read-model.ts`;
- `scripts/check-request-status-transition.ts`;
- `package.json`;
- цей report.

## 20. Not changed

- Prisma schema та migrations;
- database data;
- invoice selection/creation/cancellation;
- manager item edit rules;
- resend/follow-up business rules;
- Telegram transport/env;
- deployment;
- legacy rejection-comment field;
- `app/(public)/about/page.tsx`.

## 21. Known limitations

- manager edit/resend rules у `WAITING_APPROVAL` ще не змінені цим Stage;
- follow-up cleanup ще не виконаний;
- invoice resolver ще не спрощений;
- legacy per-item backend actions залишаються в коді;
- rejection-comment column не видалено;
- durable notification outbox не реалізований;
- готового manager notification helper для aggregate completion немає, тому
  цей Stage не надсилає notification;
- authenticated browser/mobile QA та live DB concurrency test не виконувалися;
  proof є dependency-injected transaction harness і static validation.

## 22. Next Stage

Наступний окремий Stage може:

1. прибрати legacy per-item production contracts після підтвердження відсутніх
   callers;
2. узгодити manager edit/resend policy після aggregate submit;
3. очистити follow-up semantics для cancelled zero-selection;
4. додати manager completion notification через existing staff channel;
5. окремо вирішити active follow-up invoice eligibility;
6. виконати authenticated browser і real PostgreSQL concurrency QA.

## 23. Git state

Перед commit staging має містити лише aggregate service/action/UI, canonical
event, focused/regression tests, package script і цей report.

`app/(public)/about/page.tsx` залишається тільки unstaged modification. Push не
виконується.
