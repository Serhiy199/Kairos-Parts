# Stage Request Status Automation 6 — Invoice sent trigger

## Executive summary

Stage 6 підключає canonical event `REQUEST_STATUS_EVENTS.INVOICE_SENT` до
надсилання рахунку. Успішний staff flow атомарно виконує:

```text
Invoice DRAFT → SENT
Request AWAITING_INVOICE → INVOICE_SENT
```

`Invoice.sentAt`, один `RequestStatusHistory`, Request
`REQUEST_STATUS_CHANGED` audit і Invoice `INVOICE_SENT` audit створюються в
одній transaction. Notification виконується тільки після commit. Schema,
migrations, Invoice contents, approval logic і Stage після `INVOICE_SENT` не
змінювалися.

## Canonical send flow

Server Action `sendAdminInvoice()` читає `requestId` та `invoiceId`, перевіряє
актуальну CRM session через `requireCrmSession()` і викликає
`sendInvoiceToClient({ invoiceId, expectedRequestId, audit })`.

Pure orchestration розміщено в `lib/invoices/send-workflow.ts`, а Prisma,
Audit Log, request transition і Telegram adapters — у
`lib/invoices/service.ts`. Це лишає production boundary canonical та дозволяє
перевірити transaction behavior без реальної DB mutation.

## Transaction

У `prisma.$transaction()` послідовно:

1. actor перечитується з DB;
2. дозволяється лише `ACTIVE` `ADMIN` або `MANAGER`, role має збігатися з
   validated session context;
3. Invoice читається разом із його `requestId`, Request status та item count;
4. `expectedRequestId` звіряється з фактичним Invoice;
5. дозволяються тільки `Invoice=DRAFT`, `Request=AWAITING_INVOICE` і
   непорожній Invoice;
6. `invoice.updateMany({ where: { id, status: 'DRAFT' } })` атомарно записує
   `SENT` і `sentAt`;
7. canonical request transition виконується з тим самим `tx`;
8. створюються Request history/audit;
9. створюється sanitized Invoice audit;
10. transaction commit-иться.

Якщо request transition, audit або concurrent guard завершується помилкою,
Invoice update rollback-иться разом з Request transition.

## Request transition

Використовується лише:

```ts
transitionRequestStatus({
  requestId,
  event: REQUEST_STATUS_EVENTS.INVOICE_SENT,
  actor: { id: actorId },
  metadata: {
    source: 'ADMIN_CRM',
    eventKey: REQUEST_STATUS_EVENTS.INVOICE_SENT,
    triggerEntityType: 'INVOICE',
    triggerEntityId: invoiceId
  },
  requestContext,
  tx
});
```

Direct `Request.update({ status: 'INVOICE_SENT' })` не додано. Existing
transition service створює один `RequestStatusHistory` і один
`REQUEST_STATUS_CHANGED` audit із:

```text
before: { status: AWAITING_INVOICE }
after:  { status: INVOICE_SENT }
```

Український label уже був canonical:
`INVOICE_SENT → Рахунок надісланий`.

## Idempotency and guards

Повторний виклик для вже `SENT` Invoice повертає `noop` до будь-якого update,
history, audit або notification. Original `sentAt` не змінюється.

Blocked:

- CLIENT, GUEST, `INVITED` або `DISABLED` actor;
- actor role mismatch;
- unknown Invoice;
- Invoice іншої Request;
- `PAID`/`CANCELLED` Invoice;
- Request не в `AWAITING_INVOICE`;
- empty Invoice;
- concurrent non-idempotent mutation.

UI показує send action лише для `DRAFT`; після `router.refresh()` статус
Invoice стає `Надіслано`, статус Request — `Рахунок надісланий`, а кнопка
зникає.

## Notification behavior

`sendTelegramInvoiceSentNotification()` викликається після успішного
`runTransaction()`. `status=sent` дає success:

```text
Рахунок надіслано клієнту.
```

Thrown error, `failed`, `skipped-no-recipient` або
`skipped-invoice-not-found` не rollback-ять DB і дають warning:

```text
Рахунок надіслано в кабінет клієнта, але повідомлення не доставлено.
```

DB/orchestration failure перетворюється Server Action у error:

```text
Не вдалося надіслати рахунок. Спробуйте ще раз.
```

Stage 5A3 `ReactiveActionForm` показує pending/toast і виконує
`router.refresh()` без full reload.

## Audit Log safety

Invoice audit використовує existing allowlist:
`invoiceNumber`, status/currency/totals/itemCount, Request/selection IDs і
timestamps. Request audit містить тільки before/after status та allowlisted
event metadata. Повні Invoice/InvoiceItems, PII, tokens, private URLs і secrets
не записуються.

## Tests

Додано:

```text
npm.cmd run test:request-status-stage6
```

Behavioral harness перевіряє:

- `DRAFT → SENT` та exact `sentAt`;
- `AWAITING_INVOICE → INVOICE_SENT`;
- один history, один Request audit, один Invoice audit;
- repeat send `noop` без duplicates;
- CLIENT та inactive actor blocked;
- Request/Invoice mismatch і wrong Request status blocked;
- simulated transition failure rollback-ить Invoice/Request/sentAt/audit;
- notification failure не rollback-ить committed DB state;
- canonical event/tx integration;
- success/warning/error feedback;
- reactive form, pending label, revalidation і no full reload;
- український status label.

Також повторно запускаються Stage 5A3, Prisma validate/generate, lint,
typecheck, build і `git diff --check`.

## Changed files

- `app/admin/actions.ts`;
- `lib/admin/request-feedback.ts`;
- `lib/invoices/send-workflow.ts`;
- `lib/invoices/service.ts`;
- `scripts/check-request-status-stage6-invoice-sent.ts`;
- `package.json` — тільки Stage 6 test command у Stage 6 commit;
- цей report.

## Known limitations

- Existing notification channel цього flow — Telegram; email не додано.
- PDF delivery behavior не змінювався.
- Additional Invoice, cancellation/reissue, payment, shipment transitions та
  Stage після `INVOICE_SENT` не входять у scope.
- Authenticated browser mutation не виконується без окремої test fixture/login
  session; reactive UI contract покривається focused Stage 5A3/Stage 6 checks.
- Unrelated untracked Stage 5A3B report і pre-existing
  `test:logistics-address-combobox` package diff не входять до Stage 6 commit.

## Conclusion

Invoice send і Request status transition тепер є однією атомарною,
idempotent DB operation з canonical history/audit. Notification ізольована
після commit, UI отримує typed reactive feedback, а approval та Invoice
contents залишаються незмінними.
