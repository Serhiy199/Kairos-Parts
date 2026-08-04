# Stage Request Approval Telegram Notification — Client Approval Finalized

## 1. Executive status

`STAGE REQUEST APPROVAL TELEGRAM NOTIFICATION PASSED`

Реалізація, focused/regression checks, lint, typecheck і production build пройшли. Реальна Telegram-група, Preview та production не використовувалися.

## 2. Existing flow audit

- Finalize entrypoint: `submitClientSelectionAction()` у `app/client/actions.ts`.
- Finalize service: `submitClientSelection()` / `createSubmitClientSelectionService()` у `lib/request-selection/client-submission.ts`.
- Транзакція: Prisma interactive transaction з `Serializable`, `maxWait: 5000`, `timeout: 15000`.
- Aggregate counts: `totalCount = batch.items.length`, `approvedCount = approvedIds.length`, `rejectedCount = rejectedIds.length`.
- Immutable revision: актуальний `RequestSelectionBatch` має точну `revision`, єдиний active `SENT` batch і лише `PENDING` items; фіналізація переводить batch у `APPROVED`, `PARTIALLY_APPROVED` або `REJECTED`.
- Request transitions: `CLIENT_SELECTION_APPROVED` переводить `WAITING_APPROVAL → AWAITING_INVOICE`; `CLIENT_SELECTION_REJECTED_ALL` переводить `WAITING_APPROVAL → CANCELLED`.
- Повторна фіналізація: узгоджений повтор вже finalized batch повертає `outcome: noop`; інший результат повертає `SUBMISSION_CONFLICT`.
- Internal Telegram helper: `notifyClientApprovalFinalized()` → `sendStaffTelegramMessage()`.
- Staff group configuration: `TELEGRAM_MANAGER_CHAT_ID` + `TELEGRAM_BOT_TOKEN`; ізольований fallback — `STAFF_TELEGRAM_CHAT_ID` + `STAFF_TELEGRAM_BOT_TOKEN` при `STAFF_TELEGRAM_NOTIFICATIONS_ENABLED=true`.
- CRM route: `/admin/requests/<requestId>`.
- Origin: `buildAbsoluteUrl()` / `getAppBaseUrl()`; production завжди використовує `https://kairos-parts.com.ua`, Vercel origin відхиляється як development override.
- Чинна `Notification` table не має event key/unique constraint. Нова migration не потрібна, бо persistent finalized batch/status guard уже забезпечує single-send trigger для першого `outcome: changed`.

## 3. Implementation

Changed files:

- `lib/request-selection/client-submission.ts`
- `lib/staff-telegram/messages.ts`
- `lib/staff-telegram/notifications.ts`
- `scripts/check-request-approval-ui-2-aggregate-submission.ts`
- `scripts/check-telegram-client-approval-finalized.ts`
- `package.json`
- `docs/reports/stage-request-approval-telegram-client-approval-finalized.md`

Event: `CLIENT_APPROVAL_FINALIZED`.

Payload містить лише `requestId`, `batchId`, public request number, `approvedCount`, `totalCount` та фактичний final request status. Email, телефон, адреса, документи, файли, VIN і приватні коментарі не передаються.

- `approvedCount > 0` + фактичний `AWAITING_INVOICE`: invoice-ready повідомлення.
- `approvedCount = 0` + фактичний `CANCELLED`: client-cancellation повідомлення.
- Staff notification запускається після успішного завершення DB transaction.
- Telegram HTTP request не виконується всередині DB transaction.
- Помилка transport не змінює успішний approval result і не відкочує статус.

## 4. Message templates

Approved:

```text
✅ Клієнт погодив підібрані позиції

Заявка: KP-...
Погоджено позицій: X із Y

Можна формувати рахунок.
```

Cancelled:

```text
❌ Клієнт скасував заявку на етапі погодження

Заявка: KP-...
Погоджено позицій: 0 із Y
Клієнт не погодив жодної з підібраних позицій.

Формування рахунку не потрібне.
```

Обидва повідомлення мають inline-кнопку `Відкрити заявку в CRM` з URL формату `https://kairos-parts.com.ua/admin/requests/<requestId>` у production.

## 5. Idempotency

- Persistent key/guard: exact finalized `RequestSelectionBatch` revision і final batch status.
- Trigger: тільки `result.outcome === 'changed'` після committed transaction.
- Ідентичний повтор: `outcome: noop`, staff helper не викликається.
- Конфліктний повтор: `SUBMISSION_CONFLICT`, staff helper не викликається.
- Concurrent identical submission: один `changed`, один `noop`; одна notification call.
- Автоматичний retry після Telegram failure навмисно відсутній, щоб не створити duplicate без окремого persistent outbox.
- Prisma migration changes: 0.

## 6. Tests

PASS:

- `npx prisma validate`
- `npx prisma generate`
- `npm run test:telegram-client-approval-finalized`
- `npm run test:request-selection-batch`
- `npm run test:request-status`
- `npm run test:request-status-stage5`
- `npm run test:request-status-stage5a`
- `npm run test:request-status-stage5a1`
- `npm run test:request-status-stage5a2`
- `npm run test:request-status-stage5a3`
- `npm run test:request-status-stage6`
- `npm run test:request-approval-ui-1`
- `npm run test:request-approval-ui-2`
- `npm run test:request-approval-stage3`
- `npm run test:request-approval-stage4`
- `npm run test:request-approval-stage6`
- `npm run test:invoice-presentation`
- `npm run test:telegram-manager-request-created`
- `npm run test:telegram-client-request-lifecycle`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Focused behavioral coverage підтвердила approved, partial, zero-approved, identical retry/noop, conflicting retry, transaction rollback без notification, concurrent finalization та fail-open Telegram exception.

## 7. Manual QA

- Approved scenario: verified through dependency-injected captured transport; PASS.
- Cancelled scenario: verified through dependency-injected captured transport; PASS.
- Duplicate retry: verified; one call only; PASS.
- Telegram failure: verified with throwing mock; DB result/status remain successful; PASS.
- Browser/Preview QA: NOT PERFORMED — цей stage не змінює UI, а доступ до окремих Preview test fixtures не був потрібний для static/local verification.
- Real Telegram send: NOT PERFORMED — production group was explicitly protected.
- Desktop/mobile: NOT APPLICABLE — UI changes: 0.

## 8. Explicit non-changes

```text
Client Telegram bot changes: 0
Approval business logic changes: 0
Status-machine changes: 0
Invoice-generation changes: 0
Prisma migration changes: 0
Production DB changes: 0
Production Telegram sends: 0
Deployments: 0
```

## 9. Git state

- Branch: `develop`.
- Commit message: `feat: notify managers when client approval is finalized`.
- Commit SHA: generated by the scoped commit that includes this report and recorded in the final response (a commit cannot embed its own SHA without rewriting itself).
- Staged scope: only the seven files listed in section 3.
- Pre-existing untracked reports remain untracked and excluded from the commit.
- Push: not performed.
- Merge: not performed.
- Deploy: not performed.
