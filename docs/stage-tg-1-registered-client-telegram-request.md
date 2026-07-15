# Stage TG-1: Registered client for Telegram request

## Goal

Telegram requests can be created only by a client who already has a Kairos Parts client account.

## Changes

- Added Telegram linkage fields to `ClientProfile`:
  - `telegramUserId`;
  - `telegramChatId`.
- Added phone normalization helper for comparing Ukrainian phone formats:
  - `+380501111111`;
  - `380501111111`;
  - `0501111111`.
- Telegram contact sharing now checks the shared phone against existing CLIENT accounts.
- If a matching client is found:
  - the Telegram user is linked to the client profile;
  - `telegramChatId` is saved;
  - the request flow continues.
- If a matching client is not found:
  - no draft request is kept;
  - no CRM request is created;
  - the bot shows registration/login instructions and buttons.
- Telegram request creation no longer falls back to guest requests.

## User message for unknown phone

```text
Ми не знайшли клієнтський кабінет із цим номером телефону.

Щоб створити заявку через Telegram, спочатку зареєструйтеся або увійдіть у кабінет Kairos Parts.
```

## Buttons

- `Зареєструватися` -> `/register?next=/request`
- `Увійти` -> `/login?next=/request`
- `Відкрити кабінет` -> `/client`

## Database

Migration prepared:

```text
prisma/migrations/20260715130000_add_client_telegram_link/migration.sql
```

The migration must be applied to the target Neon/Vercel database before production Telegram testing.

## Not changed

- Telegram webhook secret/token handling.
- Request status flow.
- CRM request management.
- Client registration logic.
- File upload handling inside Telegram flow.

## Manual smoke test checklist

1. Use a Telegram account and share a phone that exists on a CLIENT account.
2. Confirm the bot continues to the request flow.
3. Confirm `ClientProfile.telegramChatId` is saved.
4. Complete a Telegram request.
5. Confirm the created request has `source = TELEGRAM`, `clientId` set, and no `guestPhone`.
6. Share a phone that does not exist in the system.
7. Confirm the bot shows the registration/login message.
8. Confirm no request is created for the unknown phone.

## Blockers

No code blockers found. Database migration is required before end-to-end testing on Vercel.
