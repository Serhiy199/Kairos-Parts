# Stage TG-4 — Align Telegram request form with website request form

## Goal

Telegram request creation now follows the same business structure as the website `/request` form.

The CRM receives a complete request from Telegram with the same key fields as a web request:

- contact;
- phone;
- company;
- email;
- equipment type;
- manufacturer / brand;
- model;
- vehicle year;
- VIN / serial number;
- description / comment;
- optional extra comment;
- optional file / photo / document.

## Profile Prefill

After the user shares a phone number, the bot still requires an existing CLIENT account.

If the client is found, the bot links Telegram to the `ClientProfile` and shows:

- contact name;
- company name;
- phone;
- email.

The user then confirms by pressing `Продовжити створення заявки`.

If the phone is not registered, the bot does not start the request flow and shows only:

- `Зареєструватися`;
- `Увійти`.

## Telegram Steps

The request flow now collects:

1. `equipmentType` — equipment type;
2. `manufacturer` — manufacturer / brand;
3. `model` — equipment model;
4. `vehicleYear` — vehicle year;
5. `vinOrSerial` — VIN / serial / chassis number;
6. `description` — required request description;
7. `extraComment` — optional;
8. files/photos/documents — optional;
9. summary;
10. final confirmation.

## Validation

- Vehicle year must be an integer from `1950` to `2100`.
- Description must contain at least 5 characters.
- File size limit is 20 MB.
- Supported file formats: JPG, PNG, PDF, XLS, XLSX, CSV, DOC, DOCX.

## Optional Fields

The user can press `Пропустити` for:

- extra comment;
- file/photo/document.

## Summary

Before creation, the bot shows a summary with:

- contact details from the client account;
- equipment data collected in Telegram;
- description;
- optional extra comment;
- attached file names or `не додано`.

The summary actions are:

- `Створити заявку`;
- `Скасувати`;
- `Почати заново`.

The edit button is not included in TG-4 and can be added later if needed.

## Request Creation

On confirmation, the bot creates a `Request` with:

- `source = TELEGRAM`;
- linked `clientId`;
- linked `companyId` when the client belongs to a company;
- `companyName`;
- `manufacturerId` found or created by manufacturer name;
- `equipmentType`;
- `model`;
- `vehicleYear`;
- `vinOrSerial`;
- `description` including the optional extra comment when provided;
- uploaded Telegram files attached as `RequestFile` records.

## Draft Storage

No Prisma schema change was required.

New temporary Telegram form fields are stored inside existing `TelegramDraftRequest.fileMetadata` JSON:

- `manufacturer`;
- `model`;
- `vehicleYear`;
- `vinOrSerial`;
- `extraComment`;
- `email`;
- `files`.

Old draft sessions with unsupported steps are safely cleared with a message asking the user to start again.

## Not Changed

- Telegram registration gate logic.
- Phone normalization.
- TG-2 request item notification logic.
- TG-3 invoice notification logic.
- Invoice logic.
- RequestItem approval logic.
- Prisma schema and migrations.
- Storage provider.

## Verification

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — blocked locally by Windows `EPERM` while replacing Prisma query engine DLL.
- `npx.cmd prisma generate --no-engine` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed after rerun; the first attempt hit a transient Next page-data module lookup error.
- `git diff --check` — passed.

## Blockers

No code blocker is known before manual Telegram smoke testing.
