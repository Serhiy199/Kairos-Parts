# Stage TG-6.1 — PDF links and dashboard stabilization

## Summary

This stage stabilizes the invoice Telegram flow after TG-6 and fixes dashboard horizontal overflow.

Scope:

- Telegram invoice PDF delivery diagnostics;
- Telegram invoice/request deep links;
- admin/client dashboard horizontal scroll prevention;
- no Prisma schema changes;
- no migration.

## Why the PDF may not have arrived

The text Telegram invoice notification was sent successfully, so a Telegram recipient exists.

The likely failure point was after text delivery:

- PDF generation;
- PDF font asset availability in Vercel serverless;
- multipart `sendDocument`;
- Telegram API response.

Before this fix, PDF failure was recorded only as a generic failed message. That made production debugging too opaque.

## Fix applied

`sendTelegramInvoiceSentNotification` now records safer diagnostics for PDF delivery:

- `invoiceId`;
- `invoiceNumber`;
- `requestId`;
- `chatIdExists`;
- `pdfGenerated`;
- `pdfBufferSize`;
- `pdfFilename`;
- `documentSent`;
- safe error message.

No Telegram token, database URL, full chat id, or secrets are logged.

The server also writes controlled `console.info` / `console.warn` entries for Vercel runtime logs.

## sendDocument behavior

The existing `sendTelegramDocument` helper still uses Telegram Bot API `sendDocument` with `FormData`.

The request sends:

- `chat_id`;
- PDF `document`;
- filename;
- caption.

The invoice status transition remains fail-open. If PDF generation or `sendDocument` fails, the invoice remains `SENT`.

## Telegram URLs

Before this stage, invoice buttons used login redirect URLs:

```text
/login?next=/client/invoices/{invoiceId}/print
/login?next=/client/requests/{requestId}
```

In production this could end at `/client` after login, so Telegram looked like it opened only the client dashboard.

Now Telegram invoice buttons use direct absolute URLs:

```text
{APP_BASE_URL}/client/invoices/{invoiceId}/print
{APP_BASE_URL}/client/requests/{requestId}
```

The request-items approval notification also uses a direct request URL.

If the user is not authenticated, the protected client route should handle the login flow.

## Horizontal scroll source

The highest-risk overflow source was the admin request detail layout:

- `xl:grid-cols-[1fr_360px]` did not constrain the left column with `minmax(0, 1fr)`;
- nested request-item grids used fixed fractional columns without `minmax(0, ...)`;
- some wide table wrappers did not explicitly cap themselves with `max-w-full`;
- the dashboard shell did not explicitly set `max-w-full` on the content wrapper.

## Dashboard layout fix

Updated layout and request detail sections to use:

- `minmax(0, 1fr)` for the main column;
- `min-w-0` on grid children;
- `max-w-full overflow-x-auto` around wide tables;
- `max-w-full` on the dashboard content wrapper.

The fix targets the overflowing elements instead of globally hiding overflow on `body`.

## Files changed

- `lib/telegram/notifications.ts`
- `components/layout/dashboard-shell.tsx`
- `app/admin/requests/[id]/page.tsx`
- `app/client/requests/[id]/page.tsx`
- `docs/stage-tg-6-1-pdf-links-dashboard-stabilization.md`

## Prisma

Prisma schema was not changed.

No migration is needed.

## Checks

Completed:

- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- `git diff --check` - passed.

`prisma generate --no-engine` was not needed.

## Smoke test after redeploy

Telegram:

1. Send an invoice for a client with `telegramChatId`.
2. Confirm text notification arrives.
3. Confirm PDF document arrives.
4. If PDF does not arrive, check the latest Telegram `Notification` record and Vercel logs for the safe diagnostic fields.
5. Click “Переглянути рахунок” and verify it opens `/client/invoices/{invoiceId}/print`.
6. Click “Відкрити заявку” and verify it opens `/client/requests/{requestId}`.

Dashboard:

1. Open `/admin/requests/[id]`.
2. Open `/admin/requests`.
3. Open `/client/requests/[id]`.
4. Open `/client/requests`.
5. Verify there is no horizontal scrollbar on the whole document.
6. Wide tables may still scroll only inside their own wrappers.
