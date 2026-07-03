# Day 11: Request Status Page, Notifications and OCR

## Реалізовано

Day 11 додає прозорий public status flow, базові notification records після зміни статусу та manual OCR-підказки для менеджера в CRM.

## Статуси

Технічні enum values у Prisma не змінювалися destructive migration-ом.

Використовується єдиний helper:

```text
lib/requests/statuses.ts
```

Статуси:

- `NEW` — Нова заявка
- `IN_PROGRESS` — В роботі
- `OFFER_PREPARING` — Формується пропозиція
- `WAITING_APPROVAL` — Очікує погодження
- `ORDERED` — Замовлено
- `IN_DELIVERY` — В дорозі
- `COMPLETED` — Завершено
- `CANCELLED` — Скасовано

Helper містить labels, descriptions, badge colors, order та format/meta functions.

## Public Status Page

Сторінка:

```text
/request/status/[token]
```

Доступна без авторизації, але тільки через `publicStatusToken`.

Показує клієнту:

- номер заявки;
- поточний статус;
- опис статусу;
- дату створення;
- дату останнього оновлення;
- джерело заявки;
- тип техніки;
- компанію, якщо є;
- короткий опис;
- public timeline зі status history.

Не показує:

- internal comments;
- manager-only notes;
- приватні storage paths;
- повний список файлів;
- CRM-only поля.

Якщо token не знайдено, сторінка повертає стандартний not found без розкриття CRM-даних.

## Status History

Status history already existed from Day 9 and is used by:

- public status page;
- CRM request detail page.

When manager/admin changes status, `RequestStatusHistory` is created with:

- `requestId`;
- `oldStatus`;
- `newStatus`;
- `changedByUserId`;
- `createdAt`.

## CRM Status Improvements

CRM request detail page now:

- uses shared Ukrainian status labels;
- shows current status;
- keeps status history timeline;
- shows latest notifications;
- displays a note that status changes create notification records and try to notify the client.

## Notifications

Implemented service:

```text
lib/notifications/status-change.ts
```

When status changes:

1. Request status and status history are updated.
2. Notification service runs after the status transaction.
3. Status update does not fail if notification delivery fails.

Supported behavior:

- Telegram request with `chatId` metadata: create `TELEGRAM` notification and try to send Telegram message.
- Request with email: create `EMAIL` notification with `PENDING` status.
- No channel: create failed notification record.

## Telegram Notification

Telegram message format:

```text
Статус вашої заявки оновлено.

Заявка: KP-...
Новий статус: ...
Переглянути статус:
https://.../request/status/...
```

The status link uses `APP_BASE_URL` or `NEXTAUTH_URL`.

Telegram token is never logged or committed.

## Email Notification Placeholder

No SMTP, Resend, SendGrid, or other provider was added.

If email is available, the app creates an `EMAIL` notification record with `PENDING` status. Real email delivery remains a separate future step.

## OCR

Implemented service:

```text
lib/ocr/service.ts
```

OCR is manual, not automatic.

Manager/admin can run OCR from:

```text
/admin/requests/[id]
```

The OCR service:

- works only on image request files;
- tries to read the current local storage path;
- uses `tesseract.js` with `eng+ukr`;
- stores result in `OCRResult`;
- stores possible part/serial-like token when detected;
- stores a safe OCRResult error note when file is not available or OCR fails.

This avoids blocking request creation and avoids heavy automatic serverless work.

## Manual OCR Correction

CRM shows each `OCRResult` with:

- file name;
- provider;
- confidence;
- raw text;
- possible part/serial hint;
- created date;
- textarea for corrected text.

Manual correction saves to:

```text
OCRResult.correctedText
```

## OCR Limitations

- Photo quality strongly affects recognition.
- Glare, shadows, blur, angle and dirt reduce accuracy.
- OCR does not guarantee a correct part number.
- OCR result is only a manager hint, not the source of truth.
- Manager must verify and correct OCR text manually.
- Current local file storage is not production-safe on Vercel; long-term file OCR needs object storage.

## Files Changed

- `app/(public)/request/status/[token]/page.tsx`
- `app/api/requests/status/[token]/route.ts`
- `app/api/ocr/route.ts`
- `app/admin/actions.ts`
- `app/admin/requests/[id]/page.tsx`
- `lib/requests/statuses.ts`
- `lib/notifications/status-change.ts`
- `lib/ocr/service.ts`
- `docs/day-11-status-ocr-notifications.md`

## Not Implemented On Day 11

- Full email provider.
- SMS.
- Viber.
- Client-manager chat.
- Commercial proposals.
- Payment.
- Delivery tracking.
- Supplier integrations.
- Full PDF/Excel/DOC parser.
- Day 12 final handoff/deploy work.

## Blockers For Day 12

No code blocker for Day 12.

Before final production handoff, verify:

- Day 10 `TelegramDraftRequest` migration is applied in the live DB.
- Vercel env variables are set.
- Telegram webhook is installed.
- Local file storage is replaced or accepted as MVP-limited for Vercel.
