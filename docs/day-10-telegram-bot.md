# Day 10: Telegram Bot and Request Creation

## Реалізовано

Day 10 додає базовий Telegram bot flow для створення заявки через `@kairos_parts_bot`.

Користувач може:

- запустити бот через `/start`;
- підтвердити номер телефону кнопкою Telegram;
- пройти короткий сценарій збору заявки;
- додати фото або документ;
- підтвердити створення заявки;
- отримати номер заявки та посилання на публічний статус.

## `/start`

Команда `/start`:

1. скидає попередній draft;
2. створює або оновлює `TelegramDraftRequest`;
3. надсилає привітання;
4. показує кнопку `Поділитися номером телефону`.

До підтвердження номера бот не переходить до збору заявки.

## Підтвердження Номера

Бот приймає тільки Telegram `contact` message.

Якщо користувач вводить номер текстом, бот просить натиснути кнопку `Поділитися номером телефону`.

Якщо contact належить іншому Telegram user, бот не приймає його і просить поділитися власним номером.

## Кроки Заявки

Після підтвердження номера бот збирає:

1. імʼя;
2. назву компанії або `Пропустити`;
3. тип техніки;
4. опис потреби;
5. фото/файл або `Пропустити`;
6. підтвердження заявки.

Заявка не створюється до натискання `Підтвердити заявку`.

## Фото І Файли

Підтримуються:

- Telegram `photo`;
- Telegram `document`.

Metadata тимчасово зберігається в `TelegramDraftRequest.fileMetadata`.

Після підтвердження заявки сервіс:

1. викликає Telegram Bot API `getFile`;
2. завантажує файл через Telegram file endpoint;
3. зберігає файл через поточний local storage helper;
4. створює запис `RequestFile`.

Якщо файл не вдається завантажити, заявка все одно створюється, а `RequestFile` отримує fallback metadata зі storage key `telegram/<fileId>`.

## Створення Заявки В CRM

Після підтвердження створюється `Request`:

- `source = TELEGRAM`;
- `status = NEW`;
- `requestNumber` генерується через існуючий `generateRequestNumber`;
- `publicStatusToken` генерується через існуючий `generatePublicStatusToken`;
- `guestName`, `guestPhone`, `companyName`, `equipmentType`, `description` заповнюються з Telegram draft;
- створюється `RequestStatusHistory` зі статусом `NEW`;
- створюється internal `RequestComment` з Telegram metadata.

Заявка доступна в існуючій CRM/admin panel через source filter `Telegram`.

## Звʼязок З ClientProfile

MVP-логіка:

- бот нормалізує підтверджений phone;
- шукає існуючий `ClientProfile` за phone або `User.phone`;
- якщо match знайдено, заявка привʼязується до `clientId`;
- якщо match не знайдено, заявка створюється як guest Telegram request.

Новий повноцінний `ClientProfile` автоматично не створюється.

## Status Link

Після створення бот надсилає:

- номер заявки;
- public status link.

Base URL береться з:

1. `APP_BASE_URL`;
2. `NEXTAUTH_URL`;
3. fallback: relative path `/request/status/<token>`.

## Env Variables

Потрібно додати в `.env.local` і Vercel Environment Variables:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
APP_BASE_URL=
```

Реальні token/secret не комітяться і не логуються.

## Webhook

Endpoint:

```text
POST /api/telegram/webhook
```

Webhook захищений header:

```text
X-Telegram-Bot-Api-Secret-Token
```

Значення має збігатися з `TELEGRAM_WEBHOOK_SECRET`.

Setup details описані в `docs/telegram-bot-setup.md`.

## Database

Додано Prisma model:

```text
TelegramDraftRequest
```

Migration:

```text
prisma/migrations/20260703141000_add_telegram_draft_requests/migration.sql
```

Ця таблиця потрібна для serverless-safe draft/session state.

## Storage Note

Поточний Telegram file handler використовує local file storage. Це достатньо для MVP/local flow, але на Vercel filesystem ephemeral. Для production-safe файлів потрібен object storage, наприклад Vercel Blob або S3-compatible storage.

## Не Реалізовувалось На Day 10

- Viber;
- OCR execution;
- Telegram-кабінет;
- історія заявок у Telegram;
- чат менеджера з клієнтом через CRM;
- оплата;
- комерційні пропозиції;
- погодження КП;
- email notifications;
- розширені Telegram-меню.

## Блокери Для Day 11

Функціональний код Day 10 готовий, але перед live-тестом webhook потрібно застосувати migration для `TelegramDraftRequest` у Neon/Vercel DB і додати Telegram env variables у Vercel.

Day 11 можна починати після перевірки, що Telegram webhook створює заявку в CRM на staging/production DB.
