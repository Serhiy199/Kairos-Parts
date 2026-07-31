# Stage Request Status Automation 5 — Client approval trigger

## 1. Executive summary

Stage 5 adds canonical item-level CLIENT decisions for immutable `RequestSelectionBatch` revisions. A full approval changes the batch to `APPROVED` and applies `CLIENT_SELECTION_APPROVED`, moving the Request from `WAITING_APPROVAL` to `AWAITING_INVOICE`. A rejection changes the batch to `REJECTED` and leaves the Request in `WAITING_APPROVAL`.

## 2. Git і branch state

Work was performed directly on `develop` from `5804db229d58c918c08e2cc5c57002e661c52059`. `main` remained at `055200959f2ed8e1be628d46e91265f23cc93e61`. The intended single commit message is `feat: approve request selections through immutable batches`. Push was not authorized and was not performed.

## 3. Preconditions after Stage 4C3

Stage 4C3 was present at the starting HEAD. Stage 2 already provided `CLIENT_SELECTION_APPROVED`; Stage 4B provided batch/item persistence; Stage 4C provided send/resend lifecycle; Stage 4D provided immutable client read models.

## 4. Legacy approval flow audit

`approveClientRequestItemsAction()` remains available only through `ClientLegacySelectionSection`. BATCH UI does not import or call it. Legacy fields `approvedByClient`, `includeInInvoice`, and `approvedAt` are not written by the new decision service.

## 5. Canonical decision service

`lib/request-selection/client-decision.ts` owns the new `decideClientSelectionItem()` operation. It accepts exact `requestId`, `batchId`, `batchItemId`, `expectedRevision`, decision, actor and an optional safe comment.

## 6. Actor and company authorization

The service reloads the actor inside the transaction and requires `CLIENT`, `ACTIVE`, and a `ClientProfile`. Company Requests require an actual matching `CompanyMember`; personal Requests require the matching `ClientProfile`.

## 7. Active batch and revision guards

Decisions require the exact revision and the unique `SENT` batch for the Request. `DRAFT`, `SUPERSEDED`, unrelated and stale revisions are blocked. Same-decision retries against a just-finalized target state are deterministic noops.

## 8. Request lifecycle guards

The mutable decision path requires Request status `WAITING_APPROVAL`. It does not repair inconsistent status and returns `REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION`.

## 9. Item decision lifecycle

The only writes are `PENDING → APPROVED` or `PENDING → REJECTED`. The service sets `decisionByUserId`, one decision timestamp, clears the opposite timestamp, and stores the controlled domain comment. Same decisions are noops; opposite decisions return `BATCH_ITEM_DECISION_CONFLICT`.

## 10. Rejection comment policy

REJECT requires trimmed plain text of 3–500 characters. HTML, markup, scripts and control characters are rejected. APPROVE comments are optional. The full rejection comment is stored only in `RequestSelectionBatchItem.clientComment`.

## 11. Batch aggregate algorithm

After the conditional item write, the service rereads grouped item statuses in the same transaction. REJECT immediately invokes batch `REJECT`. APPROVE invokes batch `APPROVE` only when the non-empty aggregate is entirely `APPROVED`.

## 12. Partial approval behavior

When approved items coexist with `PENDING` items, the batch stays `SENT` and the Request stays `WAITING_APPROVAL`.

## 13. Full approval behavior

When every item is `APPROVED`, the existing batch lifecycle service changes `SENT → APPROVED`. The existing Request transition service then changes `WAITING_APPROVAL → AWAITING_INVOICE`.

## 14. Rejection behavior

The first valid rejection changes `SENT → REJECTED`. Remaining controls are locked by the final batch status. The Request stays `WAITING_APPROVAL`; no backward Request transition is introduced.

## 15. Request CLIENT_SELECTION_APPROVED transition

The implementation calls `transitionRequestStatus()` with `REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED`, reason `Клієнт погодив усі позиції актуальної версії підбору`, `batchId`, `revision`, and source `CLIENT_CABINET`. There is no direct Request status update.

## 16. Transaction boundary

Actor, access, Request, batch, item and revision checks; conditional item write; aggregate read; item audit; batch lifecycle; Request history and Request audit all run in one interactive transaction. Top-level operations use `Serializable`, `maxWait: 5000`, and `timeout: 10000`. There are no Telegram or network calls inside it.

## 17. Conditional updates and concurrency

The item mutation uses `updateMany` constrained by `id`, `batchId`, and `status: PENDING`. `P2034` receives one bounded retry. Batch and Request services retain their conditional updates and idempotent transition resolution. Neon verification concurrently approved two remaining items: both calls succeeded, with one batch transition and one Request transition.

## 18. RequestStatusHistory

Only full approval creates history through `transitionRequestStatus()`. Neon positive verification produced exactly one record. Rejection produced zero records.

## 19. Audit Log

The approved additive vocabulary is:

- `AuditEntityType.REQUEST_SELECTION_BATCH_ITEM`;
- `REQUEST_SELECTION_ITEM_APPROVED`;
- `REQUEST_SELECTION_ITEM_REJECTED`.

Item audit records contain status before/after and bounded metadata (`requestId`, `batchId`, `revision`, decision, source and `hasComment`). Full comments and immutable snapshots are excluded. Existing batch and Request transition services create their own canonical audits.

## 20. Legacy field compatibility

Legacy mutable approval fields remain unchanged for historical/LEGACY mode. BATCH decisions use only `RequestSelectionBatchItem` state. No automatic synchronization into legacy fields was added.

## 21. Client UI controls

`ClientSelectionDecisionControls` provides per-item `Погодити` and `Відхилити` controls only for `SENT/PENDING`. Final item states show `Ви погодили цю позицію` or `Позицію відхилено`; final batches have no active controls.

## 22. Reject UX

Reject uses an inline expandable textarea with `minLength=3`, `maxLength=500`, pending text, confirm button and cancel button. It does not use `prompt()` or a new modal framework.

## 23. Admin decision display

Admin Request detail now loads the latest batch and displays each immutable batch item as `Очікує рішення`, `Погоджено`, or `Відхилено`, including the safe client comment where present. A full revision-history UI was intentionally not added.

## 24. Feedback and revalidation

Typed redirects distinguish partial approval, full approval, rejection, noop, stale revision, conflict, access error, comment validation and generic DB failure. The action revalidates `/client/requests`, `/client/requests/{id}`, `/admin`, `/admin/requests`, and `/admin/requests/{id}`.

## 25. Error model

The service exposes all requested codes: `REQUEST_NOT_FOUND`, `ACTOR_NOT_FOUND`, `ACTOR_NOT_ALLOWED`, `REQUEST_ACCESS_DENIED`, `BATCH_NOT_FOUND`, `BATCH_ITEM_NOT_FOUND`, `BATCH_NOT_ACTIVE`, `STALE_SELECTION_REVISION`, `REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION`, `BATCH_ITEM_ALREADY_DECIDED`, `BATCH_ITEM_DECISION_CONFLICT`, `REJECTION_COMMENT_REQUIRED`, `REJECTION_COMMENT_INVALID`, `BATCH_TRANSITION_FAILED`, `REQUEST_STATUS_TRANSITION_FAILED`, `CONCURRENT_SELECTION_DECISION`, and `DATABASE_TRANSACTION_FAILED`. Raw Prisma errors are not returned to the client.

## 26. Tests

`npm.cmd run test:request-status-stage5` covers validation, lifecycle matrix, schema/audit vocabulary, source boundaries and in-memory transactional behavior: partial approval, full approval, same-decision noop, opposite-decision conflict, rejection, comment privacy, foreign-company access, role guard, stale revision and Request status guard.

## 27. Real DB verification

Target identity was confirmed as `ep-wandering-thunder-aszf0fwz`, database `neondb`, schema `public`. Migration `20260728120000_add_request_selection_item_audit_events` is recorded as finished and all three enum values exist.

Controlled temporary fixtures verified:

- concurrent positive flow: two item approvals, batch `APPROVED`, Request `AWAITING_INVOICE`, two item audits, one batch audit, one Request audit and one history;
- negative flow: item and batch `REJECTED`, Request still `WAITING_APPROVAL`, zero history, comment stored only in the domain field;
- cleanup: Request, Company, User and Audit leftovers were all zero.

## 28. Authenticated browser smoke

PENDING. The Stage 5 code was not pushed or deployed, so an authenticated Vercel browser test would only exercise the previous deployment. No false browser PASS is reported.

## 29. Runtime logs

Controlled concurrent verification emitted one expected Prisma serialization/write-conflict log before the bounded retry. Both callers completed successfully; there was no unhandled exception or HTTP 500 surface. No deployed Vercel log claim is made.

## 30. Regression results

PASS:

- Stage 2 request status;
- Stage 3 draft trigger;
- Stage 4B batch foundation;
- Stage 4C, 4C1, 4C2 and 4C3;
- Stage 4D read model;
- Stage 5;
- Admin Audit Log 2, 3, 4 and 5;
- Prisma validate/generate;
- lint, typecheck, production build;
- `git diff --check`.

Stage 4B/4C1/4D static assertions were narrowed to preserve their original invariants while allowing the explicitly authorized Stage 5 integration.

## 31. Prisma and DB safety

The decision fields already existed. The approved migration adds only three enum values; it does not alter tables or existing data. It was applied with `prisma migrate deploy` to the agreed Neon test DB. No reset, truncate, destructive migration, sequence change or VPS DB operation was performed.

## 32. Changed files

- `prisma/schema.prisma`;
- `prisma/migrations/20260728120000_add_request_selection_item_audit_events/migration.sql`;
- `lib/audit-log/contracts.ts`;
- `lib/audit-log/presentation.ts`;
- `lib/request-selection/client-decision.ts`;
- `lib/request-selection/client-read-model.ts`;
- `lib/requests/status-transition.ts`;
- `app/client/actions.ts`;
- `app/client/requests/[id]/page.tsx`;
- `components/client/client-approval-batch-section.tsx`;
- `components/client/client-selection-decision-controls.tsx`;
- `app/admin/requests/[id]/page.tsx`;
- `scripts/check-request-status-stage5-client-approval.ts`;
- three adjusted earlier regression scripts;
- `package.json`;
- this report.

## 33. Known limitations

Authenticated browser smoke and deployed runtime logs remain pending until a later authorized push/deployment. No bulk approve action was added. The service performs one bounded serialization retry; sustained contention returns a typed controlled error.

## 34. What was intentionally excluded

No Stage 6 Invoice sent trigger, Invoice creation/sending, CommercialOffer provenance, backward Request transition, automatic ChangeRequest, Telegram notification, bulk reject, redesign, full batch history UI, push, redeploy or VPS DB mutation was implemented.

## 35. Readiness for Invoice sent trigger

The Request can now canonically reach `AWAITING_INVOICE`, and the Stage 2 `INVOICE_SENT` transition foundation remains present. Stage 6 implementation itself is not included. Local implementation prerequisites are ready; Vercel runtime testing is not ready until this commit is pushed and deployed under separate authorization.

## 36. Final conclusion

Stage 5 is implemented and locally/regression/Neon-fixture verified. Immutable batch decisions, authorization, lifecycle guards, concurrency, history, audit, client controls, admin visibility and cleanup behaved as required. Browser/Vercel verification is honestly pending because push and deployment were outside authorization.
