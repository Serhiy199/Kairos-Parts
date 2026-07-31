# Stage Request Status Automation 5A1 — Fix partial approval Request transition and status dropdown fallback

## 1. Executive summary

Read-only аудит Neon підтвердив Variant B: business transition вже зберіг `Request.status = AWAITING_INVOICE`, а CRM dropdown показував `NEW` через presentation fallback. Stage 5A1 прибирає цей fallback, розділяє live current status і manual actions, додає атомарний post-transition invariant та структуровану invoice eligibility діагностику.

## 2. Git and branch state

Робота виконана безпосередньо в `develop` від `eb6bf664b67888d5f1c1af8f487a29d11fa34fc8`. `main` залишився на `055200959f2ed8e1be628d46e91265f23cc93e61`. Feature branch, merge, rebase і push не виконувалися.

## 3. Browser defect reproduction

Authenticated Vercel smoke до виправлення показав batch «Частково погоджено», одну `APPROVED` та одну `REJECTED` позицію, але manual dropdown візуально показував «Нова заявка», а кнопка рахунку була disabled. Після локальної зміни deployment не виконувався, тому повторний browser smoke чесно залишається pending.

## 4. Persisted DB state

Read-only аудит для Request `cms4j2agx0001l2049j2dmslx`:

- Request: `AWAITING_INVOICE`, `updatedAt = 2026-07-28T11:14:04.116Z`.
- Останній batch: revision `4`, id `cms4qjwc8000dk004pnrcmhwz`, `PARTIALLY_APPROVED`, `sentAt = 2026-07-28T11:13:00.022Z`, `approvedAt = 2026-07-28T11:14:03.554Z`.
- Counts: `APPROVED = 1`, `REJECTED = 1`, `PENDING = 0`.
- History: один перехід `WAITING_APPROVAL → AWAITING_INVOICE` о `2026-07-28T11:14:04.310Z`.
- Invoice відсутній; у погодженої snapshot-позиції `approvedUnitPrice = NULL`.

## 5. Exact finalization call chain

`decideClientSelectionItemAction()` → `decideClientSelectionItem()` → conditional `RequestSelectionBatchItem.updateMany()` → aggregate `groupBy()` → `transitionRequestSelectionBatchStatus(PARTIALLY_APPROVE)` → `transitionRequestStatus(CLIENT_SELECTION_APPROVED)` → `RequestStatusHistory` і Request audit → post-transition reread/invariant → transaction commit → revalidation `/client/requests`, `/client/requests/{id}`, `/admin`, `/admin/requests`, `/admin/requests/{id}`.

Фактичний pre-transition status був `WAITING_APPROVAL`, event — `CLIENT_SELECTION_APPROVED`, target — `AWAITING_INVOICE`. За persisted history результат був `changed`; після commit live status — `AWAITING_INVOICE`.

## 6. Root cause

`normalizeRequestStatusForSelection()` повертав `NEW` для кожного status, відсутнього в legacy `REQUEST_STATUSES`. `AWAITING_INVOICE` не був manual option, тому uncontrolled `<select defaultValue>` показував fallback `NEW`. Статус не скидався в DB.

Кнопка рахунку була disabled з іншої, коректної причини: погоджена snapshot-позиція не мала `approvedUnitPrice`.

## 7. Request transition matrix

Stage 2 matrix вже містила правильний explicit transition:

`WAITING_APPROVAL + CLIENT_SELECTION_APPROVED → AWAITING_INVOICE`.

CLIENT actor дозволений для automatic event; `AWAITING_INVOICE` не manual-only; metadata `partial` не змінює guard.

## 8. Transition result handling

Caller тепер приймає лише:

- `changed` із `nextStatus = AWAITING_INVOICE`;
- target `noop` із `currentStatus = AWAITING_INVOICE`.

`blocked`, wrong-status `noop`, wrong target або post-transition persisted mismatch породжують `REQUEST_APPROVAL_FINALIZATION_INVARIANT_FAILED`.

## 9. Batch/Request atomic invariant

Після batch finalization Request перечитується в тій самій Prisma transaction. Для `APPROVED` або `PARTIALLY_APPROVED` з `approvedCount > 0` persisted status обов’язково має бути `AWAITING_INVOICE`. Typed error скасовує item decision, batch finalization, history та audits. Behavioral test підтвердив rollback `PARTIALLY_APPROVED → SENT` у transaction draft і `PENDING` для останньої item.

## 10. Unexpected status writes audit

Пошук `request.update`, `request.updateMany` і status literals показав, що єдиний runtime write до `Request.status` у `app/` та `lib/` виконується в `lib/requests/status-transition.ts`. Client action не передає manual status. Redirect/revalidation не викликають status action. `NEW` у request creation є expected initial value, не reset.

## 11. Manual status dropdown root cause

Стара логіка викликала `normalizeRequestStatusForSelection(request.status)` і використовувала результат як `defaultValue`. Exhaustive fallback перетворював `AWAITING_INVOICE` та `INVOICE_SENT` на `NEW`.

## 12. Current-status vs manual-options UX

CRM окремо server-rendered показує `Поточний статус: {REQUEST_STATUS_LABELS[request.status]}`. Нижче select «Ручна дія» має порожній required placeholder і лише дозволені manual statuses.

## 13. Manual form isolation

Status form, invoice form, manager form і item forms є sibling forms; nested form немає. Status payload має hidden `intent=manual-status-change`. Invoice button та item actions не можуть submit status form.

## 14. Status labels and presentation maps

`AWAITING_INVOICE` мапиться на «Очікує рахунок» у labels, descriptions і badge maps. `normalizeRequestStatusForSelection()` більше не підміняє невідомий для legacy-select automatic status на `NEW`.

## 15. Invoice eligibility diagnostics

`RequestInvoiceEligibility` тепер повертає top-level `requestStatus`, `batchStatus`, `approvedCount`, `rejectedCount`, `pendingCount` разом із `eligible/reason`. Reasons:

`REQUEST_NOT_AWAITING_INVOICE`, `NO_FINALIZED_APPROVED_BATCH`, `NO_APPROVED_ITEMS`, `PENDING_ITEMS_REMAIN`, `APPROVED_ITEM_PRICE_MISSING`, `APPROVED_ITEMS_CURRENCY_MISMATCH`, `INVOICE_ALREADY_EXISTS_FOR_SELECTION`.

Для defect Request результат залишається `eligible: false`, reason `APPROVED_ITEM_PRICE_MISSING`, Request `AWAITING_INVOICE`, batch `PARTIALLY_APPROVED`, counts `1/1/0`.

## 16. Invoice button UX

Disabled button тепер має human-readable reason і safe diagnostics без PII. Для missing price повідомлення пояснює потребу підготувати нову версію з ціною. Для валідного partial batch із ціною regression fixture підтверджує eligibility; button model використовує `eligibility.eligible`.

## 17. Revalidation and cache

Після client decision збережено всі потрібні revalidation paths: `/client/requests`, `/client/requests/{requestId}`, `/admin`, `/admin/requests`, `/admin/requests/{requestId}`. Admin loader читає live `Request.status`; batch summary читає immutable batch.

## 18. Feedback behavior

Green partial-success формується лише після успішного повернення transaction. Invariant error rollback-ить transaction і мапиться на `selection-finalization-invariant-failed`; client page показує червоний текст «Не вдалося завершити погодження…».

## 19. Existing inconsistent test data

Defect Request не був inconsistent: Request уже `AWAITING_INVOICE`. Repair не виконувався. Відсутню ціну не змінювали, бо це реальна invoice eligibility умова, а не status defect.

## 20. Tests

Додано `npm.cmd run test:request-status-stage5a1`. Stage 5 behavioral harness розширено mixed flow assertions, one history/audit і rollback при `blocked`. Stage 5A tests перевіряють structured diagnostics; Stage 5A1 tests — target result validation, manual-only options, strict intent, no `NEW` fallback та reason coverage.

## 21. Neon verification

Read-only persisted defect audit — PASS. Спроба isolated rollback fixture через actual Prisma client заблокована локальним Windows Schannel `P1011: Error opening a TLS connection`; WSL доступний, але Node у distribution відсутній. Fixture не був створений, persistent Neon data не змінювалися. Тому real service finalization/admin-loader verification — pending, не PASS.

## 22. Authenticated browser smoke

Pre-fix reproduction — confirmed. Post-fix browser smoke — pending deployment, оскільки push/deployment не дозволені цим завданням.

## 23. Runtime logs

Pre-fix Vercel logs не мали явної transition помилки. Post-fix logs для `REQUEST_APPROVAL_FINALIZATION_INVARIANT_FAILED` та інших кодів не перевірялися без deployment/smoke.

## 24. Regression results

PASS: Prisma validate/generate; Stage 2, 3, 4B, 4C, 4C1, 4C2, 4C3, 4D, 5, 5A, 5A1; Audit Log 2, 3, 4, 5; lint; typecheck; build; `git diff --check`.

## 25. Prisma and DB safety

Schema і migrations не змінювалися. Migration не створювалася. Neon під час фінальної verification спроби не був змінений. VPS DB не чіпали.

## 26. Changed files

- `lib/request-selection/client-decision.ts`
- `lib/requests/status-transition.ts`
- `lib/requests/statuses.ts`
- `lib/invoices/selection.ts`
- `lib/invoices/service.ts`
- `app/admin/actions.ts`
- `app/api/admin/requests/[id]/status/route.ts`
- `app/admin/requests/[id]/page.tsx`
- `app/client/actions.ts`
- `app/client/requests/[id]/page.tsx`
- `scripts/check-request-status-stage5-client-approval.ts`
- `scripts/check-request-status-stage5a-partial-invoice.ts`
- `scripts/check-request-status-stage5a1-partial-transition-dropdown.ts`
- `scripts/check-admin-audit-log-3.ts`
- `package.json`
- цей report.

## 27. Known limitations

Post-fix Neon service fixture, actual admin loader, authenticated browser flow, invoice creation/content і runtime logs залишаються pending через локальний Prisma TLS blocker та відсутність authorized deployment. Defect fixture без ціни навмисно не може активувати invoice button.

## 28. What was intentionally excluded

Stage 6, Invoice `DRAFT → SENT`, Request `AWAITING_INVOICE → INVOICE_SENT`, backward transitions, approval redesign, VPS deployment, schema/migrations і production reconciliation не реалізовувалися.

## 29. Stage 6 readiness

Локальна domain foundation готова після regression PASS. Vercel runtime testing Stage 6 ще не готове: спочатку потрібні push/deployment Stage 5A1 та post-deploy Stage 5A1 smoke.

## 30. Final conclusion

Root cause був presentation-only, а не persisted status loss. Stage 5A1 усуває false `NEW`, робить manual mutation strict, додає transaction invariant і точну invoice eligibility UX. Локальна regression suite проходить; live post-deploy verification має бути виконана окремо після дозволу на push/deployment.
