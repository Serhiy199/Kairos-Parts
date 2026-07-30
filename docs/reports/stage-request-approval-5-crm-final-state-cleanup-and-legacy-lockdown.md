# Stage Request Approval 5 — CRM final state cleanup and legacy flow lockdown

## 1. Мета

Закріпити aggregate client submission як єдиний активний спосіб погодження,
перевести finalized і legacy views у read-only режим та заблокувати створення
post-final follow-up revisions без зміни схеми БД або Stage 4 invoice selection.

## 2. Початковий стан

- гілка: `develop`;
- початковий HEAD: `57de5d3 refactor: create invoices from final approved selection`;
- `app/(public)/about/page.tsx` уже мав сторонні unstaged-зміни;
- active checkbox/aggregate flow був реалізований;
- CRM mutation policy уже блокував finalized batches;
- старі per-item Server Action/service залишалися доступними напряму;
- legacy client fallback залишав стару checkbox-форму активною;
- send contract ще містив недосяжні production-гілки
  `FOLLOW_UP_REJECTED`.

## 3. Active flow vs legacy flow

Active flow:

```text
IN_PROGRESS
→ INITIAL
→ WAITING_APPROVAL + SENT
→ manager semantic edit
→ RESEND_ACTIVE
→ old SENT becomes SUPERSEDED
→ new SENT
→ one aggregate client submit
→ AWAITING_INVOICE або CANCELLED
```

Legacy historical flow може містити кілька finalized revisions, historical
follow-up, per-item decisions, rejection comments і cumulative invoices. Ці
дані залишаються доступними для читання, але не створюються новими production
paths.

## 4. Inventory of legacy controls and paths

| Path/component/service | Досяжність до Stage | Рішення | Причина |
|---|---|---|---|
| `components/client/client-selection-decision-controls.tsx` | Не монтувався active page, але імпортував callable Server Action | Видалено | Dead per-item approve/reject form |
| `app/client/actions.ts::decideClientSelectionItemAction` | Callable Server Action | Видалено | Aggregate submit є єдиним active mutation |
| `lib/request-selection/client-decision.ts` | Callable через старий action і tests | Видалено | Старий per-item domain service міг створювати mutation/audit/history |
| `app/client/actions.ts::approveClientRequestItemsAction` | Callable зі legacy fallback | Видалено | Mutable `RequestItem` approval не є canonical flow |
| `components/client/client-legacy-selection-section.tsx` | Active лише коли batch history відсутня | Залишено read-only | Потрібне відображення historical `RequestItem` data |
| `FOLLOW_UP_REJECTED` у send contract | UI був прихований, contract/action/domain приймали legacy mode | Видалено з contract, explicit action/domain rejection | Post-final follow-up заборонений |
| `deriveRequestSelectionFollowUpEligibility()` | Не викликався production eligibility service | Залишено як historical regression model | Сумісність із historical semantics без mutation path |
| `NEW_FOLLOW_UP` presentation state | Недосяжний production finalized flow | Залишено для historical fixtures | Не змінює persisted records |
| `FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL` history event | Не створюється новим send service | Залишено read-only | Історичні status/audit records мають коректно відображатися |
| `RequestSelectionBatch.status = SUPERSEDED` | Active pre-final resend та historical revisions | Залишено | Це canonical Stage 3 resend, а не post-final follow-up |
| `clientComment` DB/read-model fields | Historical rejection comments | Залишено read-only | Видалення потребувало б schema/data migration |

## 5. CRM final-state cleanup

Для `APPROVED`, `PARTIALLY_APPROVED` і `REJECTED`:

- `managerMutationsAllowed` не показує create/edit/delete controls;
- selection publish/update form не монтується;
- backend create/update/delete services повторно використовують
  `assertManagerSelectionMutationAllowed`;
- finalized batch state перевіряється незалежно від `Request.status`;
- canonical helper text не закликає до доопрацювання чи повторного надсилання.

## 6. Client final-state cleanup

`ClientSelectionCheckboxList` монтується лише для active `SENT`. Finalized batch
рендериться Server Component-ом через read-only item cards:

- немає checkbox;
- немає aggregate submit;
- немає approve/reject buttons;
- немає rejection textarea;
- persisted client comment показується як звичайний read-only текст.

Legacy fallback більше не має form або checkbox і позначений як
`Архівна версія` / `Лише перегляд`.

## 7. Final read-only summary

`buildFinalizedSelectionSummary()` є canonical pure presentation model для CRM
і client cabinet. Summary містить:

- headline для all-approved, partial і reject-all;
- approved/rejected/total counts;
- revision;
- дату фіналізації з `approvedAt` або `rejectedAt`;
- canonical detail без follow-up CTA.

## 8. Per-item action lockdown

Видалено старі:

- `decideClientSelectionItemAction`;
- `approveClientRequestItemsAction`;
- `ClientSelectionDecisionControls`;
- `client-decision.ts`.

Тому current deployment не має endpoint/action export для approve-one,
reject-one або mutation rejection comment. Нові mutation audit events
`REQUEST_SELECTION_ITEM_APPROVED`,
`REQUEST_SELECTION_ITEM_REJECTED` і
`REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED` цими legacy production paths більше не
створюються. Historical AuditLog rows не змінюються.

## 9. Follow-up service lockdown

`SendRequestSelectionForApprovalInput.mode` і result mode тепер допускають лише:

```text
INITIAL
RESEND_ACTIVE
```

Runtime guard відхиляє forged mode до транзакції з
`FINALIZED_SELECTION_LOCKED`. Усередині canonical transaction повторно
перевіряється `resendEligibility.finalizedSelectionLocked`; finalized batch не
може перейти до нового `SENT`.

## 10. Direct API/Action protection

- forged `FOLLOW_UP_REJECTED` у CRM Server Action повертає controlled
  `selection-finalized-locked`;
- forged domain input відхиляється до `$transaction`;
- `INITIAL`/`RESEND_ACTIVE` проти finalized request блокується canonical
  finalized-batch eligibility;
- item API routes делегують create/update/delete services із canonical mutation
  policy;
- blocked paths не змінюють `RequestItem`, не створюють batch, AuditLog або
  RequestStatusHistory.

## 11. Pre-final resend preservation

Для `WAITING_APPROVAL + one SENT` manager mutation policy лишається дозволеною.
Semantic diff як і раніше керує `canSend`; `RESEND_ACTIVE` перевіряє expected
batch id/revision та item versions, переводить старий batch у `SUPERSEDED`,
створює нову revision і надсилає Telegram notification після commit.

## 12. Invoice UI integration

- `AWAITING_INVOICE` показує finalized summary;
- create Invoice CTA керується виключно Stage 4 eligibility;
- active `SENT` зберігає blocker `ACTIVE_SELECTION_REVIEW`;
- для `CANCELLED` create Invoice form/CTA та eligibility warning не монтуються;
- existing invoice list, send/cancel/paid behavior і selection resolver не
  змінювалися.

## 13. Legacy history compatibility

Збережено:

- enum/status/data для `SUPERSEDED`;
- historical follow-up status event presentation;
- immutable batch snapshots;
- `clientComment`;
- legacy RequestItem flags як read-only historical facts;
- existing invoice provenance і legacy invoice ambiguity guard.

Жодних status rewrite, backfill або retroactive decision calculations не
виконувалося.

## 14. Feedback text cleanup

Видалено active mappings `follow-up-*` і старі per-item client decision
messages. Додано canonical CRM feedback:

> Клієнт уже завершив погодження. Підбір зафіксований і більше не може бути
> змінений. Для додаткових деталей потрібно створити нову заявку.

Reject-all summary повідомляє про завершення без рахунку; partial summary —
про рахунок лише з погоджених позицій.

## 15. Audit behavior

Canonical aggregate submit, pre-final resend, invoice create/send і status
transition audit behavior не змінювався. Blocked legacy calls завершуються до
транзакції та не створюють mutation audit/history. Historical AuditLog rows і
presentation labels збережені.

## 16. Removed code

- per-item decision React form;
- per-item decision Server Action;
- per-item decision domain service;
- mutable legacy RequestItem approval Server Action;
- legacy client checkbox/form;
- post-final follow-up branches, typed errors і production feedback mappings;
- tests, що вимагали стару production mutation behavior.

## 17. Retained legacy code

- `deriveRequestSelectionFollowUpEligibility()` — лише historical regression
  model, production service його не викликає;
- historical follow-up status event — для читання наявної history;
- `NEW_FOLLOW_UP` presentation state — для historical fixture compatibility;
- schema fields/statuses/comments — щоб не втратити дані;
- Stage 4 legacy invoice selection guard — для безпечного читання старих
  multi-revision requests.

## 18. Tests

Focused:

- `check-request-approval-stage5-final-state-lockdown.ts`: 50/50, усі 47
  обов'язкових cases покриті.

Approval regressions:

- UI 1 — pass;
- UI 2 — pass;
- Stage 3 manager edit — pass;
- Stage 4 invoice selection — pass, 55 checks;
- Stage 5 aggregate client approval — pass;
- Stage 5A partial / 5A1 / 5A2 lockdown / 5A3 — pass;
- Stage 4D read model — pass, 24/24.

Request item/selection/invoice/lifecycle:

- selection batch foundation — pass;
- draft trigger — pass;
- selection send, resend, transaction feedback, edit persistence — pass;
- invoice partial eligibility, invoice send, sequential numbering — pass;
- request status transition — pass.

Audit:

- Audit Log 3/4/5 — pass;
- Audit Log 2 — pre-existing false positive: suite recursively scans test
  fixtures and rejects `tx.auditLog.create` in
  `check-request-approval-stage4-simplified-invoice-selection.ts`. Production
  audit code не є джерелом failure; Stage 5 не переписував unrelated audit
  scanner.

## 19. Validation

- `npx.cmd prisma validate` — pass;
- `npm.cmd run lint` — pass після видалення єдиного локального warning;
- `npm.cmd run typecheck` — pass;
- `git diff --check` — pass;
- build не запускався: сторонній dirty
  `app/(public)/about/page.tsx` створює вказаний у prompt scope/safety risk;
- browser QA не запускався і залишається окремою runtime-перевіркою.

## 20. Changed files

Application:

- `app/admin/actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `app/client/actions.ts`;
- `app/client/requests/[id]/page.tsx`;
- `components/client/client-approval-batch-section.tsx`;
- `components/client/client-legacy-selection-section.tsx`;
- `components/client/client-selection-checkbox-list.tsx`;
- `components/client/client-selection-item-card.tsx`;
- `lib/admin/request-feedback.ts`;
- `lib/client/request-feedback.ts`;
- `lib/request-selection/client-read-model.ts`;
- `lib/request-selection/client-submission.ts`;
- `lib/request-selection/finalized-summary.ts`;
- `lib/request-selection/resend-eligibility.ts`;
- `lib/request-selection/send-for-approval.ts`.

Removed:

- `components/client/client-selection-decision-controls.tsx`;
- `lib/request-selection/client-decision.ts`.

Tests:

- focused Stage 5 script;
- scoped approval/read-model/follow-up regression updates.

Documentation:

- цей Stage report.

## 21. Not changed

- `prisma/schema.prisma`;
- migrations;
- database та historical records;
- Stage 4 invoice selection/service behavior;
- invoice send, cancel/reissue semantics;
- Telegram transport, bot tokens або notification transport;
- env, Vercel/VPS configuration, deployment;
- aggregate checkbox selection і zero-selection cancellation;
- `app/(public)/about/page.tsx` — сторонній diff не редагувався і не stage-ився.

## 22. Known limitations

- schema cleanup не виконаний;
- rejection-comment DB field збережений;
- historical follow-up data збережені;
- invoice cancellation/reissue не реалізовані;
- durable notification outbox не реалізований;
- live browser QA залишається окремою runtime-перевіркою;
- Audit Log 2 має описаний pre-existing test-fixture scanner false positive.

## 23. Next Stage

Наступний Stage може виконати окремий browser QA finalized all/partial/reject
views і, за окремим scope, виправити Audit Log 2 scanner так, щоб він перевіряв
production files, а не test fixtures. Schema/data cleanup потребує окремого
аудиту та migration approval.

## 24. Git state

- branch: `develop`;
- Stage commit message:
  `refactor: lock finalized request approval flow`;
- stage лише перелічені Stage 5 files;
- сторонній `app/(public)/about/page.tsx` лишається unstaged;
- push не виконується.
