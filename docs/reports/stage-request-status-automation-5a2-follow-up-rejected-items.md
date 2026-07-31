# Stage Request Status Automation 5A2 — Follow-up approval cycle for rejected items and post-edit refresh

## 1. Executive summary

Реалізовано окремий post-decision follow-up cycle для змінених `REJECTED` і нових `RequestItem`. Раніше погоджені snapshots не надсилаються повторно, approval-critical зміни та delete погодженого source item блокуються server-side, а Invoice selection стала cumulative між finalized revisions. Schema і migrations не змінювалися.

## 2. Git and branch state

Робота виконана безпосередньо в `develop` від `4c1ec2b8e1d92f89de3810e4d88d5f4dc9f606f9`. Початковий working tree був clean. `main` до і після роботи вказує на `055200959f2ed8e1be628d46e91265f23cc93e61`. Push не виконувався.

## 3. Confirmed business rule

`APPROVED` snapshot є незмінною підставою для Invoice. `REJECTED` source item можна змінити або видалити; новий item може бути replacement. Follow-up batch є delta і містить лише changed rejected/new unsent items. Уже створений Invoice блокує follow-up.

## 4. Current blocked follow-up behavior

До Stage 5A2 без active `SENT` batch eligibility переходила до initial логіки: finalized decisions не були основою нового циклу, а `AWAITING_INVOICE` не входив до sendable statuses. Через це після partial approval edit не активував кнопку.

## 5. Current resend eligibility audit

| Latest batch status | Поведінка до Stage 5A2 | Поведінка Stage 5A2 |
| --- | --- | --- |
| `SENT` | full replacement resend | full replacement resend з незмінним active-cycle правилом |
| `APPROVED` | фактично `NOT_SENT`/status blocked | approved sources locked; тільки справді new items можуть бути follow-up |
| `PARTIALLY_APPROVED` | finalized batch і decisions ігнорувалися | approved locked; changed rejected/new формують delta |
| `REJECTED` | finalized batch і decisions ігнорувалися | changed rejected/new формують delta |
| `SUPERSEDED` | не є client decision | не використовується як finalized source |

`visibleToClient` не є canonical eligibility signal. Canonical signal — immutable snapshot, `sourceRequestItemId`, item decision і approval-content hash. Invoice status тепер враховується.

## 6. Finalized cycle resolver

`createRequestSelectionResendEligibilityService()` читає active `SENT`, finalized batches зі статусами `APPROVED | PARTIALLY_APPROVED | REJECTED` у revision-desc order та поточний Invoice. Latest finalized batch є `sourceBatch`; повна finalized історія використовується для cumulative approved lock/provenance. Newer `SENT` має пріоритет і блокує follow-up.

## 7. Follow-up eligibility model

`deriveRequestSelectionFollowUpEligibility()` повертає explicit `mode: FOLLOW_UP_REJECTED`, `sourceBatch`, `currentInvoice`, `approvedLockedItemIds`, `rejectedEditableItemIds`, `changedRejectedItemIds`, `newItemIds`, `removedRejectedSourceIds`, canonical `eligibleItemIds`, `canSend` і typed reason. Item states: `LOCKED_APPROVED`, `UNCHANGED_REJECTED`, `CHANGED_REJECTED`, `NEW_FOLLOW_UP`.

## 8. Approved item lock

`lib/request-items/update.ts` перевіряє finalized approved provenance перед будь-яким фактичним approval-critical update і повертає `APPROVED_REQUEST_ITEM_LOCKED`. Такий самий guard додано до `lib/change-requests/apply.ts`, тому Change Request apply не обходить lock. No-op без зміни значень дозволений. Internal-only fields не входять до цього canonical admin update endpoint і не впливають на approval hash.

## 9. Rejected item edit policy

Rejected live item лишається editable. Порівнюється normalized approval-content hash поточного item з rejected snapshot. Лише approval-critical відмінність дає `CHANGED_REJECTED`; незмінений rejected item не стає кандидатом.

## 10. New replacement item policy

Live item без finalized snapshot provenance визначається як `NEW_FOLLOW_UP`. Replacement FK не додано: відсутність у попередніх approval batches достатня для delta cycle.

## 11. Removed rejected source behavior

Historical rejected snapshot зберігається через nullable source link. Сам delete не створює порожній batch: без replacement `canSend=false`; за наявності new item follow-up містить тільки replacement.

## 12. Follow-up batch content policy

Зафіксовано два різні режими:

- pre-decision `RESEND_ACTIVE` — full replacement revision активного cycle;
- post-decision `FOLLOW_UP_REJECTED` — delta revision зі changed rejected/new items.

Approved, unchanged rejected, deleted historical та already invoiced items до delta не входять.

## 13. Follow-up send service

`sendRequestSelectionForApproval()` приймає explicit `INITIAL | RESEND_ACTIVE | FOLLOW_UP_REJECTED`. Для follow-up canonical candidates повторно перевіряються в Serializable транзакції, finalized batch не supersede-иться, новий batch проходить `DRAFT → SENT`, Telegram лишається post-commit. Audit metadata містить `followUp`, `followUpFromBatchId`, `followUpFromRevision`, `candidateCount`, `changedRejectedCount`, `newReplacementCount`.

## 14. Request status behavior

Додано event `FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL`. Для `WAITING_APPROVAL` і `AWAITING_INVOICE` він same-status noop. Після partial cycle Request не регресує з `AWAITING_INVOICE`. Follow-up після all-rejected першого cycle лишається `WAITING_APPROVAL` до першої finalized approval; тоді existing client decision transition переводить Request у `AWAITING_INVOICE`. All-rejected follow-up за наявності попередніх approvals залишає `AWAITING_INVOICE`.

## 15. Invoice lifecycle guards

Без Invoice follow-up дозволений. `DRAFT` повертає `INVOICE_DRAFT_EXISTS`; будь-який existing non-draft Invoice повертає `INVOICE_ALREADY_SENT`/блокує cycle. Існуючий Invoice не перебудовується і не доповнюється приховано. Duplicate Invoice guard лишився.

## 16. Cumulative approved selection

`resolveInvoiceSelection()` читає всі finalized batches у deterministic revision order, збирає `APPROVED` snapshots з усіх cycles та передає їх existing Invoice create flow. Це дає, наприклад, revision 1 item A + revision 2 item B2.

## 17. Deduplication and provenance

Canonical key — `sourceRequestItemId`; для legacy/null source fallback — snapshot `id`. Для одного source зберігається latest approved snapshot. `InvoiceItem.selectionBatchItemId` лишається точним immutable provenance кожного рядка, тому items одного Invoice можуть посилатися на різні batches без schema change. Already invoiced snapshot links виключаються.

## 18. Client follow-up UI

Active follow-up `SENT` batch залишається current approval surface. Заголовок змінюється на «Нові й оновлені позиції для погодження», а read model додає compact «Раніше погоджено: X позицій». Full revision history не додано.

## 19. Admin editing UX

Верхній decision block скорочено до status/count badges і rejection comments. Live cards показують derived badges. Для `LOCKED_APPROVED` edit/delete controls не рендеряться та показується пояснення; rejected/new controls лишаються активними.

## 20. Post-edit refresh

Admin edit — Server Action: спочатку commit, потім `revalidatePath('/admin')`, `/admin/requests`, current request path і redirect назад із `item-updated`. Redirect створює новий server render, тому badge, значення та button eligibility оновлюються без `F5`. API PATCH revalidates current request і повертає persisted item; browser-side form у цьому surface API не використовує. Change Request apply revalidates affected request detail.

## 21. Button eligibility and messages

Кнопка active лише для canonical delta candidates без active `SENT`, Invoice або blocked status. Додані окремі повідомлення для changed rejected, new replacement, removed-without-replacement, no changes, active batch, draft Invoice, sent Invoice та missing finalized source.

## 22. RequestStatusHistory

Same-status follow-up send не створює history. Follow-up finalization на вже `AWAITING_INVOICE` теж не дублює history. Перший реальний `WAITING_APPROVAL → AWAITING_INVOICE` лишається єдиним transition record.

## 23. Audit Log

Existing `REQUEST_ITEMS_SENT_FOR_APPROVAL`/batch actions використовуються з follow-up metadata. Повні snapshots до Audit Log не пишуться. Blocked edit/delete не створює оманливого success audit.

## 24. Error model

Реалізовано `APPROVED_REQUEST_ITEM_LOCKED`, `APPROVED_REQUEST_ITEM_DELETE_BLOCKED`, `NO_FOLLOW_UP_SELECTION_CHANGES`, `FOLLOW_UP_ACTIVE_BATCH_EXISTS`, `FOLLOW_UP_INVOICE_DRAFT_EXISTS`, `FOLLOW_UP_INVOICE_ALREADY_SENT`, `FOLLOW_UP_REQUEST_STATUS_BLOCKED`, `FOLLOW_UP_SOURCE_BATCH_NOT_FOUND`, `FOLLOW_UP_SELECTION_INVALID`, `FOLLOW_UP_CANDIDATE_VERSION_CONFLICT`. API повертає controlled `409`, Server Actions — український feedback; raw Prisma errors не показуються.

## 25. Tests

Додано `npm.cmd run test:request-status-stage5a2`. Він перевіряє approved/rejected/new/removed classification, historical approved dominance, invoice guards, delete lock, delta content, cumulative immutable snapshots, deduplication, totals, status noops, UI/API/change-request guards і refresh wiring. Stage 2/3/4B, 4C–4D, 5–5A1 та Audit Log 2–5 regressions пройшли.

## 26. Neon verification

На configured remote Neon `neondb` виконано isolated `pg` fixture всередині `BEGIN/ROLLBACK`.

- partial revision 1: A approved, B rejected;
- revision 2: тільки B2, item count 1;
- cumulative approved count: 2;
- historical rejected B не входить до approved;
- all-rejected revision 1 + approved replacement revision 2: cumulative approved 1;
- обидва Request мали фінальний `AWAITING_INVOICE`;
- після `ROLLBACK` cleanup count: 0.

Це DB-level schema/data proof. Domain behavior покрите local service tests. Persistent Neon data не змінено.

## 27. Authenticated browser smoke

Pending. Код не push/deploy за прямою забороною, тому deployed authenticated partial-follow-up, replacement, approved-lock та Invoice guard smoke чесно не заявляються як PASS.

## 28. Runtime logs

Pending разом із deployment/browser smoke. Vercel logs для цього commit ще не існують. Local controlled guards не повертають raw `500` у перевірених API branches.

## 29. Regression results

PASS:

- `npx.cmd prisma validate`
- `npx.cmd prisma generate`
- усі request status commands від Stage 2 до Stage 5A2;
- `npx.cmd tsx scripts/check-admin-audit-log-2.ts` … `-5.ts`;
- `npm.cmd run lint` (після усунення двох warning потрібен фінальний rerun);
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `git diff --check`.

## 30. Prisma and DB safety

`prisma/schema.prisma` не змінено, migration не створювалася, `prisma migrate`, `db push`, reset і production/VPS mutations не виконувалися. Neon fixture повністю rollback.

## 31. Changed files

Основні зміни: admin actions/UI/API/feedback, client approval read model/UI, request item update/delete guards, Change Request apply guard, resend eligibility, send service, client decision finalization, Request status transition, Invoice selection, Stage 4C3/4D/5A fixtures, new Stage 5A2 test, `package.json` і цей report.

## 32. Known limitations

Немає workflow для додаткового Invoice після `SENT`, cancellation/reissue, reopening approved item або full revision history. Browser/runtime verification потребує окремо дозволеного push/deploy. DB fixture не є authenticated UI proof.

## 33. What was intentionally excluded

Не реалізовано Stage 6, `Invoice DRAFT → SENT`, `Request AWAITING_INVOICE → INVOICE_SENT`, backward status transition, additional Invoice, Invoice rebuild, VPS deployment або merge у `main`.

## 34. Stage 6 readiness

Local Stage 6 development ready: cumulative selection, immutable provenance та follow-up lifecycle мають tests і clean build. Vercel runtime testing не ready до push/deploy та authenticated Stage 5A2 smoke.

## 35. Final conclusion

Stage 5A2 локально і на rollback Neon fixture виконує затверджений follow-up lifecycle: approved data locked, rejected/new delta resendable, Request не регресує, Invoice guards явні, cumulative Invoice selection використовує immutable approved snapshots без duplicates. Для production/browser доказу потрібна окрема команда на push/deploy.
