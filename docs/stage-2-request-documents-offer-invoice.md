# Stage 2: RequestDocument attachments for offer / invoice

## Що додано

Stage 2 додає MVP+ рівень документів заявки: менеджер може прикріпити до заявки зовнішньо підготовлений файл комерційної пропозиції, рахунку, специфікації, акту або іншого документа.

Це не модуль `CommercialOffer` і не генерація PDF. Система тільки зберігає attachment metadata, файл і прапорець видимості для клієнта.

## Prisma

Додано enum:

- `RequestDocumentType`

Значення:

- `COMMERCIAL_OFFER`
- `INVOICE`
- `SPECIFICATION`
- `ACT`
- `OTHER`

Додано model:

- `RequestDocument`

Ключові поля:

- `requestId`
- `type`
- `title`
- `fileName`
- `fileUrl`
- `storageKey`
- `mimeType`
- `size`
- `visibleToClient`
- `uploadedById`
- `createdAt`
- `updatedAt`

Relations:

- `Request.requestDocuments`
- `User.uploadedDocuments`

Migration-файл:

`prisma/migrations/20260708110000_add_request_documents/migration.sql`

Migration підготовлена, але не застосована до Neon/production-like DB у межах цього Stage 2 без окремого підтвердження.

## Backend

Додано admin API:

- `GET /api/admin/requests/[id]/documents`
- `POST /api/admin/requests/[id]/documents`
- `PATCH /api/admin/request-documents/[documentId]`
- `DELETE /api/admin/request-documents/[documentId]`

Додано file access routes:

- `GET /api/admin/request-documents/[documentId]/file`
- `GET /api/client/request-documents/[documentId]/file`

Додано CRM server actions:

- `createAdminRequestDocument`
- `updateAdminRequestDocument`
- `deleteAdminRequestDocument`

## Upload і storage

Файли request documents зберігаються через local upload helper у:

`uploads/request-documents/[requestId]/...`

У БД зберігаються:

- `fileName`
- `storageKey`
- `fileUrl`
- `mimeType`
- `size`

Frontend не отримує private `storageKey`.

Для production на Vercel локальне `uploads` не є persistent storage. Для стабільного production flow потрібно буде перейти на Vercel Blob, S3 або Cloudflare R2 без зміни бізнес-логіки `RequestDocument`.

## Validation

При створенні документа:

- `type` обовʼязковий;
- `title` обовʼязковий;
- файл обовʼязковий;
- максимальний розмір: 20 MB;
- дозволені формати: PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG.

При оновленні metadata:

- можна змінити `type`;
- можна змінити `title`;
- можна змінити `visibleToClient`.

## CRM UI

У CRM-картці заявки додано блок:

`Документи заявки`

Менеджер бачить:

- тип документа;
- назву;
- імʼя файлу;
- дату завантаження;
- хто завантажив;
- прапорець видимості для клієнта;
- link для відкриття файлу;
- редагування metadata;
- видалення документа;
- форму додавання нового документа.

## Client dashboard

У клієнтській сторінці заявки додано блок:

`Документи по заявці`

Клієнт бачить тільки документи, де:

`visibleToClient = true`

Клієнту не показуються:

- hidden documents;
- `storageKey`;
- `uploadedById`;
- службова інформація.

У `/client/documents` також додано видимі request documents, щоб клієнт міг бачити їх у загальному списку документів.

## File access security

Admin file route:

- доступний тільки MANAGER / ADMIN;
- відкриває будь-який `RequestDocument` для CRM;
- не показує private storage path.

Client file route:

- доступний тільки CLIENT;
- перевіряє ownership через `request.clientId`;
- відкриває тільки `visibleToClient = true`;
- не дозволяє доступ до чужих або hidden documents.

Local file reader перевіряє:

- `storageKey` не absolute path;
- `storageKey` не містить `..`;
- final path лишається всередині `uploads`.

## Public status page

Public status page у Stage 2 не показує request documents.

Причина: для public token flow потрібен окремий безпечний download contract. На цьому етапі документи доступні тільки authenticated CLIENT у кабінеті та MANAGER/ADMIN у CRM.

## Що не входить у Stage 2

Не реалізовано:

- `CommercialOffer`;
- `CommercialOfferItem`;
- PDF generation;
- invoice templates;
- автоматичні реквізити;
- ПДВ;
- автоматичні суми;
- погодження пропозиції клієнтом;
- оплата;
- BAS / 1C integrations;
- company multi-user accounts;
- Change Approval Workflow.

## Перевірено

На рівні коду:

- Prisma schema valid;
- Prisma Client generated;
- TypeScript typecheck passed.

Повний final check виконується перед завершенням задачі:

- `npx prisma generate`
- `npx prisma validate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Blocker для Stage 3

Технічного blocker для переходу до Stage 3 немає після застосування migration у потрібному середовищі.

Перед Stage 3 потрібно вирішити production storage strategy для файлів, якщо тестування має проходити на Vercel production/preview з реальними attachment-файлами.
