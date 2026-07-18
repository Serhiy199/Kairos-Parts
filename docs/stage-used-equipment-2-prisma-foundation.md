# Stage Used Equipment 2 — Prisma Foundation

## 1. Scope етапу

Реалізовано тільки data foundation для модуля “Майданчик БВ техніки”:

- Prisma enums;
- Prisma models;
- relations;
- indexes;
- migration;
- shared status helpers;
- технічний report.

Не реалізовувались CRM UI, public catalog, inquiry forms, Cloudinary SDK, upload logic, TipTap, sanitizer, pagination UI або навігація.

## 2. Додані enums

Додано `UsedEquipmentStatus`:

- `DRAFT` — чернетка, не публічна;
- `PUBLISHED` — опубліковано;
- `RESERVED` — зарезервовано;
- `SOLD` — продано;
- `ARCHIVED` — архівовано замість hard delete.

Додано `UsedEquipmentInquiryStatus`:

- `NEW` — нова заявка;
- `IN_PROGRESS` — в роботі;
- `COMPLETED` — оброблена;
- `CANCELLED` — скасована.

## 3. Додані models

Додано:

- `UsedEquipment`;
- `UsedEquipmentImage`;
- `UsedEquipmentInquiry`.

Модулі `Request`, `RequestItem`, `RequestDocument`, `Invoice`, `Company`, `ClientProfile`, `ChangeRequest`, Telegram flow і PDF logic не змінювались.

## 4. Основні поля моделей

`UsedEquipment`:

- `slug`;
- `title`;
- `equipmentType`;
- `manufacturerId`;
- `manufacturerName`;
- `model`;
- `year`;
- `description`;
- `internalComment`;
- `status`;
- `createdById`;
- `updatedById`;
- `publishedAt`;
- `reservedAt`;
- `soldAt`;
- `archivedAt`;
- timestamps.

`UsedEquipmentImage`:

- `usedEquipmentId`;
- `url`;
- `cloudinaryPublicId`;
- `sortOrder`;
- `isPrimary`;
- `alt`;
- `width`;
- `height`;
- `format`;
- `bytes`;
- timestamps.

`UsedEquipmentInquiry`:

- `usedEquipmentId`;
- `equipmentTitle`;
- `name`;
- `phone`;
- `normalizedPhone`;
- `status`;
- `assignedManagerId`;
- `internalComment`;
- `source`;
- `processedAt`;
- timestamps.

## 5. Relations із User

У `User` додано back-relations:

- `usedEquipmentCreated`;
- `usedEquipmentUpdated`;
- `usedEquipmentInquiries`.

У `UsedEquipment`:

- `createdBy` — required relation до `User`, `onDelete: Restrict`;
- `updatedBy` — optional relation до `User`, `onDelete: SetNull`.

У `UsedEquipmentInquiry`:

- `assignedManager` — optional relation до `User`, `onDelete: SetNull`.

Role validation для `MANAGER`/`ADMIN` буде на рівні майбутніх server actions/API, не на рівні DB.

## 6. Relation із Manufacturer

`UsedEquipment.manufacturerId` звʼязаний із `Manufacturer.id`.

Decision:

- `onDelete: SetNull`;
- у `Manufacturer` додано back-relation `usedEquipment`;
- видалення або зміна довідника виробників не має ламати картку БВ техніки.

## 7. Snapshot fields

Додано snapshot fields:

- `UsedEquipment.manufacturerName`;
- `UsedEquipmentInquiry.equipmentTitle`.

Причина:

- публічна картка зберігає назву виробника на момент створення;
- inquiry зберігає назву техніки на момент звернення;
- редагування довідника або title не переписує історичний зміст заявки.

## 8. Archive strategy

Hard delete у першій версії не планується.

Для техніки додано:

- `status = ARCHIVED`;
- `archivedAt`.

Archive приховуватиме техніку з public catalog на майбутньому UI/API етапі.

## 9. SOLD behavior foundation

Для `SOLD` додано:

- enum value `SOLD`;
- поле `soldAt`;
- shared helper `isUsedEquipmentPublic`, який вважає `SOLD` публічним;
- shared helper `canSubmitUsedEquipmentInquiry`, який не дозволяє inquiry для `SOLD`.

UI-етап має показувати badge `Продано` і блокувати кнопку запиту.

## 10. Image metadata structure

`UsedEquipmentImage` підтримує:

- кілька фото на одну одиницю техніки;
- порядок через `sortOrder`;
- головне фото через `isPrimary`;
- Cloudinary public URL;
- Cloudinary public ID;
- alt text;
- width/height;
- format;
- bytes.

Invariant “тільки одне primary photo на техніку” не закладено partial unique index у Prisma schema. Його потрібно забезпечити transaction/server action на upload/edit етапі.

## 11. Cloudinary public ID strategy

Поле:

```text
cloudinaryPublicId String
```

Воно потрібне для:

- delete/destroy asset;
- transformations;
- cleanup;
- незалежності від URL parsing.

Cloudinary SDK, credentials і upload logic не додавались.

## 12. Inquiry status flow

Базовий flow:

```text
NEW → IN_PROGRESS → COMPLETED
NEW → CANCELLED
IN_PROGRESS → CANCELLED
```

Це лише foundation. Actions, forms і CRM transitions будуть реалізовані окремо.

## 13. Indexes

`UsedEquipment`:

- `@@index([status])` — public/CRM status filtering;
- `@@index([manufacturerId])` — future manufacturer filter;
- `@@index([createdAt])` — CRM ordering;
- `@@index([publishedAt])` — public ordering;
- `@@index([status, publishedAt])` — public catalog pagination.

`UsedEquipmentImage`:

- `@@index([usedEquipmentId])`;
- `@@index([usedEquipmentId, sortOrder])`;
- `@@index([usedEquipmentId, isPrimary])`.

`UsedEquipmentInquiry`:

- `@@index([usedEquipmentId])`;
- `@@index([status])`;
- `@@index([assignedManagerId])`;
- `@@index([createdAt])`;
- `@@index([status, createdAt])`;
- `@@index([normalizedPhone])`.

## 14. Cascade / Restrict / SetNull decisions

- `UsedEquipment.manufacturer` — `SetNull`, бо snapshot `manufacturerName` залишається.
- `UsedEquipment.createdBy` — `Restrict`, щоб не втратити автора техніки.
- `UsedEquipment.updatedBy` — `SetNull`, бо це optional audit-like звʼязок.
- `UsedEquipmentImage.usedEquipment` — `Cascade`, бо images є child records техніки.
- `UsedEquipmentInquiry.usedEquipment` — `Restrict`, щоб не втратити історію заявок.
- `UsedEquipmentInquiry.assignedManager` — `SetNull`, якщо user буде видалений.

Cloudinary asset cleanup не реалізовувався і не виконується DB cascade.

## 15. Migration name

Створено migration:

```text
20260718045439_add_used_equipment_foundation
```

## 16. Migration SQL review

SQL переглянуто.

У migration є тільки:

- `CREATE TYPE`;
- `CREATE TABLE`;
- `CREATE INDEX`;
- `ALTER TABLE ... ADD CONSTRAINT` для foreign keys.

У migration немає:

- `DROP`;
- reset database;
- destructive alter unrelated columns;
- змін існуючих Request/Invoice/Telegram моделей;
- видалення даних.

## 17. Чи застосована migration локально

Окрема local DB migration не запускалась, бо поточний Prisma datasource у `.env.local` вказує на Neon PostgreSQL.

## 18. Чи застосована migration до Neon

Так.

Команда:

```bash
npx.cmd prisma migrate deploy
```

Після deploy:

```text
Database schema is up to date!
```

Secrets або database URL у report не виводились.

## 19. Prisma validation results

Виконано:

```bash
npx.cmd prisma format
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate status
```

Результат:

- `prisma format` — passed;
- `prisma validate` — passed;
- `prisma generate` — passed;
- `prisma migrate status` — database schema is up to date.

## 20. Typecheck / lint / build

Виконано:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Результат:

- `typecheck` — passed;
- `lint` — passed;
- `build` — passed;
- Next.js згенерував 43 static pages.

## 21. Shared status helpers

Створено:

```text
lib/used-equipment/status.ts
```

Додано:

- `USED_EQUIPMENT_STATUS_LABELS`;
- `USED_EQUIPMENT_INQUIRY_STATUS_LABELS`;
- `getUsedEquipmentStatusLabel`;
- `getUsedEquipmentInquiryStatusLabel`;
- `isUsedEquipmentPublic`;
- `canSubmitUsedEquipmentInquiry`.

`isUsedEquipmentPublic`:

- `PUBLISHED` — true;
- `RESERVED` — true;
- `SOLD` — true;
- `DRAFT` — false;
- `ARCHIVED` — false.

`canSubmitUsedEquipmentInquiry`:

- true тільки для `PUBLISHED`;
- `RESERVED`, `SOLD`, `DRAFT`, `ARCHIVED` не приймають нові заявки.

## 22. Що навмисно не реалізовано

Не реалізовано:

- Cloudinary SDK;
- upload API;
- image upload UI;
- image preview;
- CRM navigation;
- CRM list/create/edit pages;
- TipTap;
- `sanitize-html`;
- public catalog;
- public detail page;
- inquiry form;
- CRM inquiries UI;
- badges;
- notifications;
- Telegram changes;
- filters/search/sorting controls;
- pagination UI.

## 23. Blocker або next step для Етапу 3

Кодового blocker для Етапу 3 немає.

Наступний етап може починатися з одного з двох напрямків:

1. CRM foundation для керування БВ технікою.
2. Cloudinary upload foundation для фото.

Перед upload етапом потрібно додати Cloudinary SDK і використати credentials тільки з environment variables.
