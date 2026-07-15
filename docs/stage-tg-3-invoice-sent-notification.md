# Stage TG-3 — Telegram notification when invoice is sent

## Scope

Stage TG-3 adds a Telegram notification when a CRM manager/admin sends an invoice to the client.

The notification is triggered only after an invoice successfully transitions from `DRAFT` to `SENT`.

## What Changed

- Added `sendTelegramInvoiceSentNotification` in `lib/telegram/notifications.ts`.
- Reused the existing Telegram recipient priority from request item approval notifications:
  1. primary company contact;
  2. request owner;
  3. first company member with a Telegram chat id.
- Added invoice notification call in `sendInvoiceToClient`.
- Telegram delivery is fail-open: invoice sending is not rolled back if Telegram is unavailable or the client has no linked Telegram chat.

## Message

The Telegram message includes:

- request number;
- invoice number;
- total invoice amount and currency;
- short instruction to open the invoice in the client cabinet.

The message does not attach or send a PDF file.

## Buttons

Telegram inline buttons:

- `Переглянути рахунок` -> `/login?next=/client/invoices/{invoiceId}/print`
- `Відкрити заявку` -> `/login?next=/client/requests/{requestId}`

The full URL is built from `APP_BASE_URL`, then `NEXTAUTH_URL`, then the production fallback domain.

## Notification Record

For recipients with a linked Telegram chat, a `Notification` record is created:

- `channel = TELEGRAM`;
- `status = PENDING` before delivery;
- `status = SENT` and `sentAt` after successful delivery;
- `status = FAILED` if Telegram delivery fails.

If no recipient is found, no notification record is created.

## Safety

- No Prisma schema changes.
- No migration required.
- No Telegram token is logged.
- Telegram delivery failure does not block invoice status updates.
- No invoice PDF is sent via Telegram.

## Verification

- `npx.cmd prisma generate` — blocked by Windows `EPERM` while replacing Prisma query engine DLL in `node_modules/.prisma/client`.
- `npx.cmd prisma generate --no-engine` — passed.
- `npx.cmd prisma validate` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

## Blockers

No known blockers for manual smoke testing after deployment.
