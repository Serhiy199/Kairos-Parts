# Kairos Parts — Day 2 Database, Roles and API Design

## Що додано

Day 2 закладає доменну модель Kairos Parts MVP: Prisma schema, enum-и, TypeScript domain types, API contracts/placeholders і документацію для переходу до наступного етапу.

На цьому етапі не реалізовувалась бізнес-логіка, UI, Telegram flow, OCR виконання, email sending або file upload.

## Сутності Prisma

У `prisma/schema.prisma` додано:

- `User` — базовий акаунт, роль, контактні дані, optional `passwordHash` для credentials flow.
- `ClientProfile` — профіль клієнта з компанією, контактною особою, телефоном та email.
- `ManagerProfile` — профіль менеджера з display name.
- `Request` — центральна сутність заявки з номером, public status token, джерелом, статусом, guest/client полями, технікою, категоризацією та менеджером.
- `RequestFile` — файли заявки з `storageKey`, optional `fileUrl`, MIME type і розміром.
- `RequestStatusHistory` — історія зміни статусів.
- `RequestComment` — внутрішні CRM-коментарі менеджера або адміністратора.
- `Vehicle` — одиниця техніки клієнта.
- `Document` — документи, які можуть бути прив'язані до клієнта, заявки або техніки.
- `Category` — публічна/CRM категорія.
- `Subcategory` — підкатегорія в межах категорії.
- `Manufacturer` — виробник, optional linked to category/subcategory.
- `OCRResult` — результат OCR для заявки або файлу заявки.
- `Notification` — базовий запис повідомлення email/Telegram.

## Enum-и

У Prisma та TypeScript зафіксовано:

- `UserRole`: `GUEST`, `CLIENT`, `MANAGER`, `ADMIN`.
- `RequestSource`: `WEBSITE`, `CLIENT_DASHBOARD`, `TELEGRAM`, `MANAGER`.
- `RequestStatus`: `NEW`, `IN_PROGRESS`, `OFFER_PREPARING`, `WAITING_APPROVAL`, `ORDERED`, `IN_DELIVERY`, `COMPLETED`, `CANCELLED`.
- `NotificationChannel`: `EMAIL`, `TELEGRAM`.
- `NotificationStatus`: `PENDING`, `SENT`, `FAILED`.
- `OCRProvider`: `TESSERACT`, `GOOGLE_VISION`, `AWS_TEXTRACT`, `AZURE_VISION`, `OTHER`.

TypeScript джерела:

- `lib/auth/roles.ts`
- `lib/requests/statuses.ts`
- `lib/requests/sources.ts`
- `lib/requests/types.ts`
- `lib/catalog/types.ts`
- `lib/vehicles/types.ts`
- `lib/ocr/types.ts`
- `lib/notifications/types.ts`
- `lib/files/types.ts`

## Розмежування ролей

### Guest

Гість не зобов'язаний мати `User` або `ClientProfile`. Guest-заявка зберігається як `Request` з:

- `source = WEBSITE` або `TELEGRAM`;
- `clientId = null`;
- `guestName`, `guestPhone`, `guestEmail`, `companyName`;
- `requestNumber`;
- `publicStatusToken`.

Гість може бачити тільки public-safe статус за token.

### Client

Клієнт має `User` з `role = CLIENT` і `ClientProfile`.

Клієнтські заявки мають:

- `source = CLIENT_DASHBOARD`;
- `clientId`;
- optional `vehicleId`;
- історію, документи й файли, доступні тільки власнику.

Ownership має визначатися із session user, а не з frontend-supplied `userId`.

### Manager

Менеджер має `User` з `role = MANAGER` і `ManagerProfile`.

Менеджер може:

- переглядати CRM-заявки;
- змінювати статуси;
- призначати відповідального менеджера;
- додавати internal comments;
- переглядати файли, техніку, документи;
- бачити й коригувати OCR result.

### Admin

Адміністратор має `User` з `role = ADMIN`.

Адмін може:

- бачити всі заявки;
- керувати менеджерами;
- керувати категоріями, підкатегоріями, виробниками;
- змінювати статуси;
- переглядати базову аналітику;
- керувати налаштуваннями.

## Створення заявки з різних джерел

### Website

`POST /api/requests` створює guest-заявку:

- contact fields беруться з форми;
- `clientId` залишається `null`;
- створюються `requestNumber` і `publicStatusToken`;
- файли можуть бути додані окремим file upload flow на наступних етапах.

### Client Dashboard

`POST /api/requests` або майбутній client-specific action створює заявку:

- клієнт визначається із session;
- заявка прив'язується до `ClientProfile`;
- може бути прив'язана до `Vehicle`;
- контактні дані можуть автопідставлятися з профілю.

### Telegram

Telegram webhook резервується через `POST /api/telegram/webhook`.

На Day 2 flow не реалізований, але майбутня Telegram-заявка повинна мати:

- `source = TELEGRAM`;
- guest або matched client contact;
- public status token.

### Manager

Менеджер може створити заявку вручну в CRM з:

- `source = MANAGER`;
- optional client link;
- optional guest/company contact fields.

## Public status token

`publicStatusToken` є унікальним токеном у `Request`.

Правила:

- token не дорівнює `id` і не має бути вгадуваним;
- public endpoint повертає тільки safe data: номер заявки, поточний статус, public-safe history;
- CRM-only fields, comments, internal manager data, OCR raw review і документи не віддаються public endpoint-ом.

Endpoint:

- `GET /api/requests/status/[token]`

## Файли й документи

Для файлів заявки використовується `RequestFile`:

- `requestId`;
- `fileName`;
- `storageKey`;
- optional `fileUrl`;
- `mimeType`;
- `size`;
- `createdAt`.

Для документів використовується `Document`, який може бути прив'язаний до:

- `clientId`;
- `requestId`;
- `vehicleId`.

На Day 2 не реалізовано actual upload. `storageKey` закладає abstraction для local або майбутнього cloud storage driver.

## OCR-result

`OCRResult` зберігає:

- `requestId`;
- optional `fileId`;
- `rawText`;
- possible serial/part/model numbers;
- optional `correctedText`;
- optional `confidence`;
- `provider`.

OCR є допоміжним інструментом для менеджера. Raw result не вважається final business truth без ручної перевірки.

## API contracts

Усі Day 2 endpoint-и залишаються placeholders і повертають `501 not_implemented`, але відповідь містить контракт:

- `module`;
- `method`;
- `path`;
- `auth`;
- `summary`;
- optional `request`;
- optional `response`;
- optional `notes`.

### Requests

- `GET /api/requests`
- `POST /api/requests`
- `GET /api/requests/[id]`
- `PATCH /api/requests/[id]`
- `GET /api/requests/status/[token]`

### Client

- `GET /api/client/requests`
- `GET /api/client/vehicles`
- `POST /api/client/vehicles`
- `GET /api/client/documents`

### Admin / CRM

- `GET /api/admin/requests`
- `GET /api/admin/requests/[id]`
- `PATCH /api/admin/requests/[id]/status`
- `PATCH /api/admin/requests/[id]/assign`
- `POST /api/admin/requests/[id]/comments`

### Categories

- `GET /api/categories`
- `GET /api/categories/[slug]`
- `POST /api/admin/categories`
- `POST /api/admin/subcategories`
- `POST /api/admin/manufacturers`

### Integrations

- `POST /api/telegram/webhook`
- `POST /api/ocr`
- `POST /api/notifications`

## Що не реалізовувалось навмисно

- UI для Day 2.
- Auth.js session flow.
- Credentials login/register.
- Business logic створення заявки.
- Telegram bot сценарії.
- OCR execution.
- Email sending.
- File upload.
- Production deploy.
- Viber, shop/cart/payment, Нова пошта, BAS/ERP, supplier API.
- Prisma migration або destructive database operation.

## Day 3 next steps

1. Узгодити остаточну Prisma модель і ownership rules.
2. Підготувати `.env.local` для локального dev середовища без коміту секретів.
3. Виконати `prisma migrate dev` тільки після підтвердження database target.
4. Підключити Prisma client helper.
5. Підготувати Auth.js config і session role mapping.
6. Реалізувати перші read-only API handlers або request creation flow згідно з погодженим пріоритетом.
7. Додати базові validation schemas для API input.
