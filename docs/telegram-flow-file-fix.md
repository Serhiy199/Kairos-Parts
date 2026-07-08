# Telegram Flow and CRM File Opening Fix

## Scope

This note documents the Telegram bot flow update and the CRM file-opening fix. It does not change Auth, statuses, OCR logic, notifications, commercial offers, invoice templates, or Prisma schema.

## Telegram Flow

Current draft flow:

1. `AWAITING_CONTACT`
2. `ASK_NAME`
3. `ASK_COMPANY`
4. `ASK_EQUIPMENT`
5. `ASK_PARTS`
6. `ASK_DESCRIPTION`
7. `ASK_FILES`
8. `CONFIRM`

After the equipment type question, the bot asks:

```text
Вкажіть каталожний номер та назву запчастини, яку шукаєте.
Якщо позицій декілька — напишіть їх одним повідомленням.
```

The step is optional. The user can press or type `Пропустити`. If skipped, the bot goes directly to the file/photo step so a prepared request file can be attached.

If the user enters parts text, it is stored in draft metadata and shown in the confirmation summary as `Запчастини / каталожні номери`.

## Draft Storage

No Prisma migration is required.

`TelegramDraftRequest.fileMetadata` stores a JSON payload with:

- `files`: Telegram photo/document metadata;
- `partsText`: optional catalog number / part name text.

Older draft metadata stored as a plain array of files is still supported.

## CRM Description

When a Telegram request is confirmed, `Request.description` is generated as structured text:

```text
Тип техніки: ...

Каталожний номер / назва запчастини:
...

Опис потреби / коментар:
...

Джерело: Telegram
```

This applies only to Telegram-created requests.

## Telegram Files and Photos

For Telegram photos, the largest photo variant is used. For documents, the bot uses the Telegram document metadata.

The bot calls Telegram `getFile`, downloads the file server-side, and saves it to local request file storage:

```text
uploads/request-files/<requestId>/<safe-file-name>
```

`RequestFile.storageKey` stores the internal local storage key. Telegram token URLs are not stored as frontend URLs.

## CRM File Opening

CRM opens request files through:

```text
/api/admin/files/[fileId]
```

The route:

- requires MANAGER or ADMIN access;
- reads the file by `RequestFile.storageKey`;
- prevents path traversal;
- returns `Content-Type` and inline `Content-Disposition`;
- does not expose the Telegram bot token in frontend URLs.

## Vercel Limitation

Local filesystem uploads are suitable for local/dev testing, but Vercel serverless filesystem is not persistent production storage. Production should use persistent object storage, such as Vercel Blob or another private storage layer with signed or protected download routes.
