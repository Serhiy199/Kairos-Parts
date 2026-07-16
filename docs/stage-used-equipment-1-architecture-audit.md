# Stage Used Equipment 1 — Architecture Audit

## 1. Мета аудиту

Цей документ фіксує технічний план для модуля “Майданчик БВ техніки” у Kairos Parts.

Етап є audit/design-only:

- Prisma schema не змінювалась;
- migration не створювалась;
- routes/pages/API/actions не додавались;
- dependencies не додавались;
- upload/editor/navigation не змінювались.

Мета — визначити архітектуру, яку можна безпечно реалізовувати наступним етапом.

## 2. Поточний стан проєкту

У проєкті вже є:

- публічна сторінка `/used-equipment` як presentation/placeholder сторінка;
- пункт “Майданчик БВ техніки” у public header/footer;
- CRM layout з ролями `MANAGER` і `ADMIN`;
- клієнтський кабінет, заявки, техніка, документи, рахунки;
- локальні списки типів техніки;
- helper для виробників за типом техніки;
- reusable `SearchableCombobox`;
- локальне файлове сховище для request files/request documents;
- protected file download routes для заявок і документів.

У проєкті ще немає:

- Prisma models для БВ техніки;
- CRUD у CRM для БВ техніки;
- public catalog/detail для реальних оголошень;
- inquiry model для запитів по БВ техніці;
- persistent image storage для production;
- rich-text editor dependency;
- sanitizer dependency;
- rate limit / captcha / honeypot для public inquiry forms.

## 3. Поточні ролі і доступи

Поточні ролі:

- `CLIENT`;
- `MANAGER`;
- `ADMIN`;
- `GUEST`.

Поточна CRM логіка:

- `/admin/*` доступний для `MANAGER` і `ADMIN`;
- частина адмінських сторінок прихована у sidebar для `MANAGER`;
- `ADMIN_ONLY_ROUTE_PREFIXES` зараз містить `/admin/settings`, `/admin/categories`, `/admin/manufacturers`, `/admin/change-requests`.

Рекомендація для модуля БВ техніки:

- public catalog/detail — доступні гостям;
- CRM list/detail/create/edit — доступні `MANAGER` і `ADMIN`;
- publish/hide — дозволити `MANAGER` і `ADMIN`, якщо це операційна робота менеджера;
- archive/delete/settings — тільки `ADMIN`;
- hard delete не робити основним сценарієм.

Важливий технічний пункт: `/used-equipment` уже є в public navigation, але не доданий у `PUBLIC_ROUTE_PREFIXES`. Перед production запуском публічного каталогу його потрібно додати, інакше middleware/access helper може трактувати маршрут не так, як очікується.

## 4. Рекомендована модель даних

Основна модель:

```prisma
enum UsedEquipmentStatus {
  DRAFT
  PUBLISHED
  RESERVED
  SOLD
  ARCHIVED
}

enum UsedEquipmentInquiryStatus {
  NEW
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model UsedEquipment {
  id               String              @id @default(cuid())
  slug             String              @unique
  title            String
  equipmentType    String
  manufacturerId   String?
  manufacturerName String?
  model            String?
  year             Int?
  descriptionHtml  String              @db.Text
  internalComment  String?             @db.Text
  status           UsedEquipmentStatus @default(DRAFT)
  publishedAt      DateTime?
  reservedAt       DateTime?
  soldAt           DateTime?
  archivedAt       DateTime?
  createdById      String?
  updatedById      String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  manufacturer     Manufacturer?       @relation(fields: [manufacturerId], references: [id], onDelete: SetNull)
  images           UsedEquipmentImage[]
  inquiries        UsedEquipmentInquiry[]

  @@index([status])
  @@index([equipmentType])
  @@index([manufacturerId])
  @@index([createdAt])
  @@index([publishedAt])
}

model UsedEquipmentImage {
  id              String        @id @default(cuid())
  usedEquipmentId String
  fileName        String
  fileUrl         String
  storageKey      String?
  publicId        String?
  mimeType        String
  size            Int
  width           Int?
  height          Int?
  alt             String?
  sortOrder       Int           @default(0)
  isPrimary       Boolean       @default(false)
  createdAt       DateTime      @default(now())

  usedEquipment   UsedEquipment @relation(fields: [usedEquipmentId], references: [id], onDelete: Cascade)

  @@index([usedEquipmentId, sortOrder])
  @@index([usedEquipmentId, isPrimary])
}

model UsedEquipmentInquiry {
  id                String                     @id @default(cuid())
  usedEquipmentId   String
  status            UsedEquipmentInquiryStatus @default(NEW)
  name              String
  phone             String
  normalizedPhone   String?
  comment           String?                    @db.Text
  assignedManagerId String?
  internalComment   String?                    @db.Text
  createdAt         DateTime                   @default(now())
  updatedAt         DateTime                   @updatedAt
  processedAt       DateTime?

  usedEquipment     UsedEquipment              @relation(fields: [usedEquipmentId], references: [id], onDelete: Cascade)
  assignedManager   User?                      @relation(fields: [assignedManagerId], references: [id], onDelete: SetNull)

  @@index([usedEquipmentId])
  @@index([status])
  @@index([assignedManagerId])
  @@index([createdAt])
  @@index([normalizedPhone])
}
```

## 5. Manufacturer strategy

Рекомендований підхід: `manufacturerId + manufacturerName`.

Причина:

- `Manufacturer` уже існує і використовується у заявках;
- для БВ техніки можуть бути виробники, яких ще немає у каталозі;
- `manufacturerName` зберігає snapshot/custom значення, навіть якщо запис `Manufacturer` змінять або видалять;
- `manufacturerId` дозволяє фільтрувати й аналізувати стандартні виробники.

Правило:

- якщо менеджер обирає існуючого виробника — зберігаємо `manufacturerId` і `manufacturerName`;
- якщо вводить нового — на першому етапі можна зберігати тільки `manufacturerName`;
- створення нового `Manufacturer` у довіднику краще залишити окремою admin дією.

## 6. Equipment type strategy

Використати поточний `lib/vehicles/equipment-types.ts`.

Поле `equipmentType` у `UsedEquipment` має бути `String`, не Prisma enum.

Причина:

- список типів уже є в web/request і Telegram flows;
- зміна списку не потребуватиме migration;
- для MVP достатньо контрольованого string value зі списку `EQUIPMENT_TYPE_OPTIONS`.

## 7. Searchable combobox

Поточний `components/ui/searchable-combobox.tsx` можна повторно використати:

- для `equipmentType`;
- для `manufacturerName`;
- для залежних suggestions виробника після вибору типу техніки.

Поточний компонент уже має:

- keyboard navigation;
- empty state;
- hidden input для form submit;
- `required`;
- `aria-*` атрибути;
- controlled value.

Для майбутнього етапу варто не міняти сам компонент, а повторити патерн із `app/(public)/request/request-form.tsx`, де виробники підтягуються через `getManufacturersForEquipmentType`.

## 8. Slug strategy

Потрібен stable slug:

```text
manufacturer-or-type-model-year-shortId
```

Рекомендація:

- створити shared helper `lib/slug.ts`;
- транслітерувати кирилицю;
- нормалізувати пробіли/символи;
- додавати короткий suffix при конфлікті;
- не змінювати slug автоматично після публікації, щоб не ламати public URL.

У проєкті зараз є локальні `catalogSlug` реалізації у request/telegram code paths, але немає shared slug helper для нових сутностей.

## 9. Status model

Рекомендовані статуси:

- `DRAFT` — чернетка у CRM, не показується публічно;
- `PUBLISHED` — показується в каталозі й detail page;
- `RESERVED` — показується публічно з badge “Зарезервовано”;
- `SOLD` — не показується у стандартному списку, але direct URL може показувати “Продано” без форми запиту;
- `ARCHIVED` — приховано повністю з public, доступно в CRM.

Hard delete не рекомендується як основний сценарій.

## 10. Image storage recommendation

Поточний upload storage:

- локально пише у `uploads`;
- на Vercel пише у `os.tmpdir()/kairos-parts-uploads`;
- це не persistent storage для production;
- `fileUrl` часто `undefined`, а доступ відбувається через protected local read.

Для публічних фото БВ техніки рекомендовано використати Cloudinary.

Чому Cloudinary:

- persistent storage;
- public image delivery;
- thumbnails/transforms;
- WebP/AVIF оптимізація;
- `publicId` для видалення;
- зручно робити primary image, gallery і responsive sizes;
- не потрібно тримати public images у server filesystem.

Альтернативи:

- Vercel Blob — простіше, добре для файлів, але менше image-specific tooling;
- S3/R2 — гнучко, але більше інфраструктурної роботи;
- поточний local storage — не підходить для production photos на Vercel.

## 11. Image limits

Рекомендовані правила:

- мінімум 1 фото для публікації;
- максимум 10 фото на одну одиницю техніки;
- максимальний розмір одного фото: 8 MB;
- дозволені формати: JPG, JPEG, PNG, WEBP;
- зберігати `sortOrder`;
- мати `isPrimary`;
- видаляти/замінювати фото тільки через CRM;
- public catalog використовує тільки primary image.

## 12. Rich text editor

У проєкті зараз немає rich-text editor dependency.

Рекомендований варіант: TipTap.

Причина:

- добре працює з React/Next;
- можна обмежити toolbar;
- HTML output зрозумілий для збереження;
- легше контролювати allowed marks/nodes.

MVP toolbar:

- bold;
- italic;
- underline;
- headings H2/H3;
- unordered/ordered lists;
- link;
- clear formatting.

Не рекомендується в MVP:

- вставка images/video у rich text;
- custom HTML blocks;
- tables у description.

## 13. Sanitization

Потрібен server-side sanitizer.

Рекомендація: `sanitize-html`.

Allowed tags:

- `p`;
- `br`;
- `strong`, `b`;
- `em`, `i`;
- `u`;
- `h2`, `h3`, `h4`;
- `ul`, `ol`, `li`;
- `a`;
- `blockquote`.

Allowed attributes:

- для `a`: `href`, `target`, `rel`.

Заборонити:

- `script`;
- inline event handlers;
- `style`;
- `iframe`;
- `img`;
- `javascript:` URLs;
- `data:` URLs.

Sanitization має виконуватись на server action/API save, не лише в editor UI.

## 14. Public routes

Рекомендовані routes:

- `/used-equipment` — public catalog;
- `/used-equipment/[slug]` — public detail page.

Публічний catalog:

- показує тільки `PUBLISHED` і `RESERVED`;
- приховує `DRAFT`, `ARCHIVED`;
- `SOLD` не показує у списку за замовчуванням;
- має pagination;
- без фільтрів у першому етапі, якщо scope потрібно тримати вузьким.

Detail page:

- показує gallery;
- title, type, manufacturer, model, year;
- sanitized description;
- status badge;
- inquiry form `Імʼя + телефон`;
- не показує CRM/internal fields.

## 15. CRM routes

Рекомендована структура:

- `/admin/used-equipment/items`;
- `/admin/used-equipment/items/new`;
- `/admin/used-equipment/items/[id]`;
- `/admin/used-equipment/items/[id]/edit`;
- `/admin/used-equipment/inquiries`;
- `/admin/used-equipment/inquiries/[id]`.

Чому не `/admin/used-equipment/[id]` одразу:

- буде менше конфліктів між list, create, inquiries і dynamic route;
- простіше розширювати модуль.

Sidebar label:

- `БВ техніка`;
- окремий badge для `Запити БВ`, якщо кількість нових inquiries стане важливою.

## 16. CRM create/edit UX

Create form:

- title;
- equipment type combobox;
- manufacturer combobox;
- model;
- year;
- description editor;
- image upload;
- status `DRAFT` за замовчуванням;
- save draft;
- publish.

Edit form:

- редагування текстових полів;
- gallery reorder;
- set primary image;
- delete image;
- change status.

Для `PUBLISHED` бажано вимагати:

- title;
- equipmentType;
- description;
- at least one image.

## 17. Inquiry flow

Public inquiry form:

- name;
- phone;
- optional comment.

Server logic:

- знайти `UsedEquipment` по slug/id;
- перевірити, що статус public (`PUBLISHED` або `RESERVED`);
- нормалізувати телефон;
- створити `UsedEquipmentInquiry` зі статусом `NEW`;
- не довіряти title/status із frontend payload;
- показати українське success/error повідомлення.

Anti-spam для MVP:

- honeypot field;
- мінімальний duplicate guard: той самий normalized phone + usedEquipmentId + `NEW` за короткий проміжок;
- rate limit/IP protection можна додати окремо.

## 18. CRM inquiry management

CRM list:

- date;
- equipment;
- name;
- phone;
- status;
- manager;
- updatedAt.

Actions:

- mark `IN_PROGRESS`;
- mark `COMPLETED`;
- mark `CANCELLED`;
- assign manager, якщо потрібно;
- internal comment.

У першому етапі не потрібні:

- email/Telegram notifications;
- conversation history;
- public account binding;
- invoice integration.

## 19. Pagination

Public catalog:

- page-based pagination;
- `take = 12`;
- `?page=2`;
- page 1 canonical без query або canonical на `/used-equipment`;
- page N canonical `/used-equipment?page=N`;
- якщо page invalid або менше 1 — redirect/normalize на page 1;
- якщо page більше total pages — показати empty state або redirect на останню сторінку.

CRM list:

- `take = 25`;
- `?page=2`;
- server-side count;
- не вантажити всі записи одразу.

## 20. SEO

Catalog:

- title/description;
- canonical;
- noindex для query states, якщо зʼявляться фільтри без SEO стратегії.

Detail:

- title із назви техніки;
- description зі sanitized text excerpt;
- Open Graph image з primary image;
- canonical `/used-equipment/[slug]`;
- `BreadcrumbList`.

Structured data:

- не додавати Product/Offer schema, якщо немає ціни й ecommerce purchase flow;
- можна додати базовий `Vehicle`/`Product` schema пізніше, якщо дані будуть достатньо повні.

## 21. Accessibility

Потрібно:

- alt text для primary/gallery images;
- keyboard-accessible gallery;
- visible focus states;
- form labels;
- українські validation messages;
- status badges з текстом, не тільки кольором;
- buttons не мають бути тільки icon-only без aria-label.

## 22. Security

Основні правила:

- rich text sanitize on save;
- validate image mime/extension/size server-side;
- не довіряти public form payload;
- не приймати `status`, `usedEquipmentId`, `managerId` із public form без DB перевірки;
- public inquiry має працювати тільки для public statuses;
- CRM actions мають перевіряти `MANAGER`/`ADMIN`;
- hard delete тільки `ADMIN` і тільки після перевірки залежностей;
- image delete має видаляти і DB record, і remote asset.

## 23. Storage cleanup

Для Cloudinary:

- у DB зберігати `publicId`;
- при delete image викликати Cloudinary destroy;
- при archive item фото не видаляти;
- при hard delete item спочатку видалити remote assets, потім DB records;
- у разі помилки remote delete — не приховувати помилку silently.

Для Vercel Blob/S3/R2 логіка аналогічна: потрібен storage key і explicit delete.

## 24. Reuse existing code

Використати:

- `SearchableCombobox`;
- `EQUIPMENT_TYPE_OPTIONS`;
- `getManufacturersForEquipmentType`;
- current public layout/design system;
- current admin layout/card/table style;
- current role helpers from `lib/admin/access.ts`.

Не копіювати:

- локальний request document storage як production photo storage;
- request item approval logic;
- invoice/commercial offer logic.

## 25. Рекомендована послідовність Stage 2

1. Додати Prisma enums/models/migration.
2. Додати shared slug helper.
3. Додати storage adapter для Cloudinary.
4. Додати sanitizer helper.
5. Додати CRM list/create/edit.
6. Додати gallery upload/reorder.
7. Додати public catalog/detail.
8. Додати inquiry form/API.
9. Додати CRM inquiries.
10. Додати docs + smoke test.

## 26. Що потребує підтвердження перед Stage 2

Потрібно підтвердити:

- storage provider: рекомендовано Cloudinary;
- чи `MANAGER` може publish/hide, чи тільки `ADMIN`;
- чи `SOLD` показувати у public list, чи тільки direct detail;
- максимальну кількість фото: рекомендовано 10;
- чи потрібна ціна на БВ техніку у першому MVP. Поточна рекомендація — не додавати ціну в Stage 2, якщо замовник не просив.

## 27. Blockers

Критичних блокерів для початку Stage 2 немає.

Перед production-ready реалізацією потрібно вирішити:

- persistent image storage;
- rich-text editor + sanitizer dependency;
- public route allowlist для `/used-equipment`;
- anti-spam minimum для inquiry form;
- exact permission matrix для publish/archive/delete.

## 28. Висновок

Рекомендована архітектура: окремий модуль `UsedEquipment` з image gallery, public statuses, inquiry flow і CRM management.

Модуль має бути незалежним від Request/Invoice business logic, але повторно використовувати:

- типи техніки;
- manufacturer suggestions;
- public/admin layouts;
- role helpers;
- дизайн-систему Kairos Parts.

Основне технічне рішення перед реалізацією — вибрати persistent image storage. Для цього модуля найкраще підходить Cloudinary.
