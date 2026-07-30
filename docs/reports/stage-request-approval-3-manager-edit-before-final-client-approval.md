# Stage Request Approval 3 — Manager editing before final client approval

## 1. Мета

Дозволити active `ADMIN`/`MANAGER` коригувати mutable `RequestItem` до
фінального aggregate submit клієнта, не змінюючи вже опублікований immutable
`RequestSelectionBatch`. Після client finalization усі mutation та follow-up
production paths мають бути заблоковані.

## 2. Початковий стан

Початкові pre-checks:

```text
branch: develop
HEAD: d60c3adba2d2841e62fb5ff01b223e41e5e37b61
status:
 M app/(public)/about/page.tsx
```

Сторонній `app/(public)/about/page.tsx` належить іншій роботі й не редагувався
у цьому Stage.

До змін:

- `createRequestItemDraft()` дозволяв будь-який статус, крім `COMPLETED` і
  `CANCELLED`;
- blocked canonical transition після create не завжди rollback-ив item;
- `updateRequestItem()` перевіряв actor, version і approved provenance, але не
  повну Request lifecycle policy;
- delete мав approved/invoice guards, але не Request status/finalization guard;
- CRM приховував edit/delete лише для approved item provenance;
- production resend loader міг перейти до legacy follow-up eligibility після
  finalized batch;
- resend semantic diff і supersede transaction уже існували.

## 3. Existing mutation guards

Підтверджені чинні механізми:

- create + audit + `SELECTION_DRAFT_CREATED` виконувалися в одній transaction;
- edit використовував `expectedUpdatedAt`, conditional `updateMany`, read-after-
  write invariant, no-op detection та audit only on change;
- delete блокував approved finalized provenance та invoiced item;
- `requireCrmSession()` / `getCrmApiSession()` захищали UI/API adapters;
- batch transitions мали conditional status update;
- partial unique index
  `RequestSelectionBatch_one_sent_per_request` не дозволяє два `SENT` batch.

## 4. New manager mutation policy

Canonical helper:

```text
assertManagerSelectionMutationAllowed()
```

Policy:

| Request status | Active SENT | Create/Edit/Delete |
| --- | ---: | --- |
| `NEW` | 0 | дозволено |
| `IN_PROGRESS` | 0 | дозволено |
| `OFFER_PREPARING` | 0 | дозволено як normalized `IN_PROGRESS` |
| `WAITING_APPROVAL` | рівно 1 | дозволено |
| `AWAITING_INVOICE` | будь-який | заборонено |
| `INVOICE_SENT` | будь-який | заборонено |
| `AWAITING_SHIPMENT` / legacy delivery | будь-який | заборонено |
| `COMPLETED` / `CANCELLED` | будь-який | заборонено |

Додатково будь-який finalized `APPROVED`, `PARTIALLY_APPROVED` або `REJECTED`
batch блокує mutations незалежно від Request status. Actor має бути active
`ADMIN` або `MANAGER`.

## 5. Mutable items vs immutable batch

Create/edit/delete змінюють лише `RequestItem`.

Вони не оновлюють:

- `RequestSelectionBatch`;
- `RequestSelectionBatchItem`;
- `snapshotHash`;
- `sourceUpdatedAt`;
- client-visible current revision.

До нового publish клієнт продовжує бачити попередній active `SENT` snapshot.

## 6. Unpublished changes model

Використано чинний canonical:

```text
deriveRequestSelectionResendEligibility()
```

У read model додано:

```text
hasUnpublishedSelectionChanges
finalizedSelectionLocked
```

Live items перетворюються через `buildRequestSelectionSnapshot()`, а
client-visible content порівнюється через
`hashRequestSelectionApprovalContent()`.

Semantic diff враховує add/remove, порядок current snapshot, quantity, price,
currency, name, catalog/analog numbers, availability, delivery time, manager
comment і vehicle snapshot. `updatedAt`, `supplierName` та `purchasePrice`
самі по собі не створюють false positive.

## 7. CRM behavior

У `WAITING_APPROVAL`:

- create/edit/delete доступні, якщо є рівно один active `SENT` batch;
- без semantic changes показується
  `Клієнт бачить актуальну версію підбору`;
- зі змінами показується `Є ненадіслані зміни` та пояснення, що клієнт бачить
  попередню revision;
- publish action має назву `Оновити підбір для клієнта`.

Після finalization показується read-only summary, а create/edit/delete/publish
controls не рендеряться.

Server Component отримує read model без client-side fetch. Server Action
залишається mutation adapter, тому RSC boundary не передає Prisma/Date/Set або
інші несеріалізовані domain objects у Client Component.

## 8. Update selection transaction

Адаптовано canonical:

```text
sendRequestSelectionForApproval()
```

Для `RESEND_ACTIVE` action передає exact:

- `expectedActiveBatchId`;
- `expectedActiveRevision`;
- усі canonical live item IDs;
- `expectedRequestItemVersions`.

В одній Serializable transaction:

1. повторно читаються Request і actor;
2. повторно обчислюється semantic eligibility;
3. читається не більше одного active `SENT` batch;
4. перевіряються exact batch ID/revision;
5. перевіряються exact live item versions;
6. old `SENT` conditional transition стає `SUPERSEDED`;
7. атомарно increment-иться `selectionRevisionCounter`;
8. створюється `DRAFT` та immutable snapshot items;
9. `DRAFT` стає `SENT`;
10. Request отримує canonical `WAITING_APPROVAL` noop;
11. visibility та aggregate audit записуються до commit.

## 9. Revision and supersede behavior

Old revision не видаляється й отримує `SUPERSEDED`.

New revision:

- має наступний atomic revision number;
- містить повний поточний live selection;
- включає added items;
- не включає deleted items;
- містить edited canonical values;
- стає єдиним active `SENT`.

Client loader як і раніше читає лише active `SENT`; keyed checkbox state
використовує `batchId:revision`, тому старий local selection не переноситься.

## 10. Finalization locks

Backend guard виконується в create/edit/delete services і не залежить від
прихованих UI controls.

Canonical повідомлення:

> Клієнт уже завершив погодження. Підбір зафіксований і більше не може бути
> змінений. Для додаткових деталей потрібно створити нову заявку.

`AWAITING_INVOICE`, `INVOICE_SENT`, shipment/terminal statuses та finalized
batch блокують mutation.

## 11. Follow-up restrictions

Production `getRequestSelectionResendEligibility()` більше не активує legacy
follow-up після finalized batch. Він повертає:

```text
finalizedSelectionLocked=true
canSend=false
reason=REQUEST_STATUS_BLOCKED
```

Forged `FOLLOW_UP_REJECTED` command також блокується всередині
`sendRequestSelectionForApproval()`.

Legacy pure helper `deriveRequestSelectionFollowUpEligibility()` і historical
presentation залишилися фізично в репозиторії для backward-compatible reads,
але active production path їх не викликає.

## 12. Concurrency

Manager item mutations і selection publish використовують Serializable
transactions. Client aggregate submit уже використовує Serializable.

Publish додатково має:

- exact active batch ID/revision;
- conditional `SENT → SUPERSEDED`;
- exact item versions;
- DB partial unique active-`SENT` index;
- mapping Prisma `P2034` у controlled active batch conflict.

Race manager publish vs client submit може завершити лише одну зміну active
batch; друга transaction отримує stale/conflict і rollback.

## 13. Audit

Збережено existing audit actions:

- `REQUEST_ITEM_CREATED`;
- `REQUEST_ITEM_UPDATED`;
- `REQUEST_ITEM_DELETED`;
- `REQUEST_SELECTION_BATCH_SUPERSEDED`;
- `REQUEST_SELECTION_BATCH_CREATED`;
- `REQUEST_SELECTION_BATCH_SENT`;
- `REQUEST_ITEMS_SENT_FOR_APPROVAL`.

Aggregate publish metadata включає old/new batch linkage через
`supersededBatchId`, `previousRevision`, `batchId`, `revision`, counts та:

```text
updateReason=MANAGER_UPDATED_BEFORE_CLIENT_FINAL_DECISION
```

Full snapshots і зайві PII до aggregate audit не додаються. No-change publish
не створює audit.

## 14. Notifications

Notification викликається лише після успішного commit.

Для `RESEND_ACTIVE` текст:

> Менеджер оновив підбір за вашою заявкою. Перевірте актуальний список позицій
> перед погодженням.

Failure не rollback-ить revision і повертається як warning. Transport, env та
Telegram infrastructure не змінювалися.

## 15. Tests

Додано:

```text
scripts/check-request-approval-stage3-manager-edit-before-final.ts
```

Focused coverage:

- status/actor/active/finalized mutation matrix;
- semantic unchanged/add/remove/change/internal-only/revert;
- delete success/finalized block/audit rollback;
- exact active revision source wiring;
- Serializable guards;
- follow-up production lock;
- CRM messages/controls;
- client keyed revision reset;
- updated notification copy.

Адаптовано existing Stage 3, 4C, 4C2, 4C3 і 5A3 regressions до exact revision,
Serializable options та нового success feedback.

## 16. Validation

```text
npx.cmd prisma validate — PASS
npm.cmd run lint — PASS
npm.cmd run typecheck — PASS
npm.cmd run test:request-approval-stage3 — PASS
npm.cmd run test:request-status — PASS
npm.cmd run test:request-status-stage3 — PASS
npm.cmd run test:request-selection-batch — PASS
npm.cmd run test:request-status-stage4c — PASS
npm.cmd run test:request-status-stage4c1 — PASS
npm.cmd run test:request-status-stage4c2 — PASS
npm.cmd run test:request-status-stage4c3 — PASS (51 checks)
npm.cmd run test:request-status-stage4d — PASS (24/24)
npm.cmd run test:request-approval-ui-1 — PASS
npm.cmd run test:request-approval-ui-2 — PASS
npm.cmd run test:request-status-stage5 — PASS
npm.cmd run test:request-status-stage5a — PASS
npm.cmd run test:request-status-stage5a1 — PASS
npm.cmd run test:request-status-stage5a2 — PASS
npm.cmd run test:request-status-stage5a3 — PASS
npm.cmd run test:request-status-stage6 — PASS
git diff --check — PASS
```

Build не запускається через сторонній dirty
`app/(public)/about/page.tsx`, відповідно до safety gate Stage.

## 17. Changed files

Фінальний staged diff містить:

- `app/admin/actions.ts`;
- `app/admin/requests/[id]/page.tsx`;
- `app/api/admin/request-items/[itemId]/route.ts`;
- `app/api/admin/requests/[id]/items/route.ts`;
- `components/admin/request-selection-submit-button.tsx`;
- `docs/reports/stage-request-approval-3-manager-edit-before-final-client-approval.md`;
- `lib/admin/request-feedback.ts`;
- `lib/request-items/create-draft.ts`;
- `lib/request-items/delete.ts`;
- `lib/request-items/mutation-policy.ts`;
- `lib/request-items/update.ts`;
- `lib/request-selection/resend-eligibility.ts`;
- `lib/request-selection/send-for-approval.ts`;
- `lib/telegram/notifications.ts`;
- `package.json`;
- `scripts/check-request-approval-stage3-manager-edit-before-final.ts`;
- `scripts/check-request-status-stage3-draft-trigger.ts`;
- `scripts/check-request-status-stage4c-send-trigger.ts`;
- `scripts/check-request-status-stage4c2-transaction-feedback.ts`;
- `scripts/check-request-status-stage4c3-item-edit-persistence.ts`;
- `scripts/check-request-status-stage5a3-reactive-feedback.ts`.

## 18. Not changed

- Prisma schema;
- migrations;
- database data;
- client aggregate checkbox/all/partial/zero semantics;
- invoice resolver/creation/cancellation;
- Telegram transport/env;
- deployment;
- `app/(public)/about/page.tsx`.

## 19. Legacy compatibility

Збережено:

- immutable historical revisions;
- `SUPERSEDED`;
- old rejection comments read-only;
- legacy follow-up pure helper та presentation types;
- initial send з `IN_PROGRESS` / `OFFER_PREPARING`;
- invoice selection із finalized approved items.

Нові finalized production requests не можуть активувати follow-up mutations.

## 20. Known limitations

- invoice resolver ще не спрощений до одного finalized batch;
- legacy follow-up code може залишатися фізично в репозиторії;
- rejection-comment DB field не видалено;
- durable notification outbox не реалізований;
- destructive schema cleanup не виконувався;
- authenticated browser/mobile QA і live PostgreSQL concurrency test не
  виконувалися; proof базується на dependency-injected harness, canonical
  conditional updates, Serializable isolation та DB unique invariant.

## 21. Next Stage

Окремий Stage може безпечно:

1. видалити недосяжні legacy follow-up mutation branches після окремого impact
   audit;
2. спростити invoice resolver до погодженого single-cycle contract;
3. виконати authenticated browser/mobile та real-DB race QA;
4. розглянути durable notification outbox.

## 22. Git state

Перед commit staging має містити лише Stage Request Approval 3 files і цей
report.

`app/(public)/about/page.tsx` має залишитися тільки unstaged. Push не
виконується.
