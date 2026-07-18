# Fix Used Equipment - Remove manager Telegram notifications

## 1. Reason

Internal Telegram messages for new used-equipment viewing inquiries are no longer part of the approved business flow.

Managers now discover and process these inquiries through the CRM list and the server-rendered NEW badge.

## 2. Removed functionality

Removed only the manager Telegram path for `UsedEquipmentInquiry`:

- the notification call after public inquiry creation;
- the manager notification helper and its result types;
- the Telegram message and inline keyboard builder;
- the CRM button URL builder dedicated to this message;
- manager-notification diagnostics;
- `TELEGRAM_MANAGER_CHAT_ID` from `.env.example`;
- the phone display helper that had no callers outside this notification.

## 3. Preserved CRM and stabilization behavior

The following Stage 10/11 behavior remains active:

- public inquiry validation;
- honeypot handling;
- ten-minute duplicate guard;
- `PUBLISHED` equipment check;
- creation of a `UsedEquipmentInquiry` with status `NEW`;
- `equipmentTitle` snapshot and `source` persistence;
- CRM inquiry list and detail routes;
- server-side NEW count badge;
- status, assignee, internal comment, and `processedAt` workflow;
- centralized revalidation after public create and CRM update.

## 4. Environment configuration

`TELEGRAM_MANAGER_CHAT_ID` is no longer required locally or in Vercel.

The existing Telegram bot configuration remains unchanged for the client bot, request-item notifications, invoice notifications, and invoice PDF delivery.

## 5. Other Telegram flows

The fix does not modify:

- `lib/telegram/bot.ts`;
- `lib/telegram/notifications.ts`;
- Telegram request creation and registered-client gate;
- client request-item notifications;
- invoice text notifications;
- invoice PDF delivery;
- `TELEGRAM_BOT_TOKEN`, webhook configuration, `telegramChatId`, or `telegramUserId`.

## 6. Public inquiry flow after the fix

The flow is:

1. validate the public form;
2. handle the honeypot;
3. verify the equipment is `PUBLISHED`;
4. check the duplicate window;
5. create the inquiry;
6. revalidate CRM routes and badge;
7. return the existing Ukrainian success response.

No Telegram API call or manager-chat diagnostic is made.

## 7. CRM badge and revalidation

The NEW badge remains based on:

```text
UsedEquipmentInquiry.status = NEW
```

The shared revalidation helper remains in use after public create and CRM status update. It revalidates:

- `/admin` layout;
- `/admin/used-equipment/inquiries`;
- `/admin/used-equipment/inquiries/{id}` when applicable.

## 8. Verification

Completed technical checks:

- `npx.cmd prisma migrate status` - passed, database schema is up to date;
- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- active-code search - no `TELEGRAM_MANAGER_CHAT_ID`, notification call, manager-notification diagnostic, message builder, or orphan phone formatter remains;
- existing client Telegram bot, request-item notification, invoice notification, and PDF delivery modules still compile in the production build;
- `git diff --check` - passed before commit.

The repository has no configured `test` script, so no project test command was available.

No Prisma schema change or migration is required.

## 9. Manual QA status

The code path preserves inquiry creation, `NEW` status, snapshot/source persistence, duplicate handling, honeypot handling, PUBLISHED checks, and CRM revalidation.

A controlled browser/database smoke was not run in this fix because browser automation was unavailable in the current session. The remaining post-deploy check is:

1. submit one inquiry for `PUBLISHED` equipment;
2. confirm the NEW row and CRM badge;
3. move it to `IN_PROGRESS` and confirm the badge decreases;
4. confirm there is no manager Telegram attempt or related diagnostic.

No real client Telegram messages are required for this fix.
