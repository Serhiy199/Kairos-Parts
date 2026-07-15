# Fix — Telegram ClientProfile Prisma migration mismatch

## Problem

Vercel logs showed the Telegram webhook failing on contact / phone share:

```text
Invalid `prisma.clientProfile.findMany()` invocation:
The column `ClientProfile.telegramUserId` does not exist in the current database.
```

The deployed code expected Telegram linkage fields on `ClientProfile`, but the active Neon database had not applied the migration that creates those columns.

## Fields Used By Code

The current code uses:

- `ClientProfile.telegramUserId`
- `ClientProfile.telegramChatId`

The current schema contains both fields:

```prisma
telegramUserId String? @unique
telegramChatId String? @unique
```

No `telegramUsername` or `telegramPhone` field is currently used for `ClientProfile`.

## Migration Status

Migration already existed:

```text
prisma/migrations/20260715130000_add_client_telegram_link/migration.sql
```

It adds:

```sql
ALTER TABLE "ClientProfile" ADD COLUMN "telegramUserId" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN "telegramChatId" TEXT;

CREATE UNIQUE INDEX "ClientProfile_telegramUserId_key" ON "ClientProfile"("telegramUserId");
CREATE UNIQUE INDEX "ClientProfile_telegramChatId_key" ON "ClientProfile"("telegramChatId");
```

Initial `prisma migrate status` showed this migration as pending for the Neon database configured in `.env.local`.

## Applied Fix

Applied the existing migration with:

```bash
npx.cmd prisma migrate deploy
```

After deploy, `prisma migrate status` reports:

```text
Database schema is up to date!
```

## Verification

- `npx.cmd prisma migrate status` — passed after deploy.
- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — blocked locally by Windows `EPERM` while replacing Prisma query engine DLL.
- `npx.cmd prisma generate --no-engine` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

## Production Notes

If another production or preview database is used, apply the same committed migration there:

```bash
npx.cmd prisma migrate deploy
```

Then redeploy Vercel if the running deployment was built before the current Prisma client/code.

## Not Changed

- Telegram business logic was not changed.
- TG-2/TG-3 notification logic was not changed.
- Invoice logic was not changed.
- Request item logic was not changed.
- No secrets, tokens, or environment values were committed.

## Manual Smoke Test

After production migration/deploy:

1. Open the Telegram bot.
2. Send `/start`.
3. Share phone number.
4. Confirm `/api/telegram/webhook` no longer returns 500.
5. For registered phone numbers, the bot should continue request creation.
6. For unregistered phone numbers, the bot should show the registration/login message.
7. Confirm Vercel logs no longer contain `ClientProfile.telegramUserId does not exist`.
