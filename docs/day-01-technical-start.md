# Kairos Parts — Day 1 Technical Start

## Що створено

Day 1 підготував технічний фундамент Next.js fullstack проєкту для Kairos Parts MVP без реалізації бізнес-логіки наступних етапів.

Створено:

- Next.js App Router структуру з TypeScript.
- Tailwind CSS конфігурацію з токенами з `docs/design-system.md`.
- Глобальні CSS variables для основної палітри Kairos Parts.
- Public, client dashboard і admin/CRM layout shells.
- Skeleton сторінки для запланованих маршрутів.
- API route placeholders для майбутніх модулів.
- `.env.example` без реальних секретів.
- Prisma placeholder з PostgreSQL datasource і enum ролей.
- Модульні папки для майбутньої реалізації.

## Структура проєкту

```txt
app/
  (public)/
    page.tsx
    about/page.tsx
    how-it-works/page.tsx
    categories/page.tsx
    categories/[slug]/page.tsx
    contacts/page.tsx
    request/page.tsx
    request/status/[token]/page.tsx
  (auth)/
    login/page.tsx
    register/page.tsx
    forgot-password/page.tsx
  admin/
    page.tsx
    requests/page.tsx
    requests/[id]/page.tsx
    clients/page.tsx
    categories/page.tsx
    manufacturers/page.tsx
    settings/page.tsx
  api/
    auth/[...nextauth]/route.ts
    requests/route.ts
    requests/[id]/route.ts
    categories/route.ts
    vehicles/route.ts
    documents/route.ts
    telegram/webhook/route.ts
    ocr/route.ts
    notifications/route.ts
  client/
    page.tsx
    requests/page.tsx
    requests/[id]/page.tsx
    vehicles/page.tsx
    vehicles/[id]/page.tsx
    documents/page.tsx
    profile/page.tsx
components/
  layout/
  ui/
features/
  admin-crm/
  auth/
  catalog/
  client-dashboard/
  client-documents/
  client-vehicles/
  file-upload/
  notifications/
  ocr-service/
  public-website/
  requests/
  roles-permissions/
  telegram-bot/
lib/
  api/
  auth/
  requests/
prisma/
  schema.prisma
docs/
  design-system.md
  day-01-technical-start.md
```

## Передбачені модулі

- Public website.
- Categories / subcategories / manufacturers.
- Requests.
- Client dashboard.
- Client vehicles.
- Client documents.
- Manager CRM.
- Telegram bot.
- OCR service.
- Notifications.
- Auth.
- Roles / permissions.
- File upload.

На Day 1 ці модулі зафіксовані як структура папок і README placeholders. Реальна логіка буде додаватися наступними етапами.

## Заплановані маршрути

### Публічна частина

- `/`
- `/about`
- `/how-it-works`
- `/categories`
- `/categories/[slug]`
- `/contacts`
- `/request`
- `/request/status/[token]`

### Auth

- `/login`
- `/register`
- `/forgot-password`

### Кабінет клієнта

- `/client`
- `/client/requests`
- `/client/requests/[id]`
- `/client/vehicles`
- `/client/vehicles/[id]`
- `/client/documents`
- `/client/profile`

### CRM / admin

- `/admin`
- `/admin/requests`
- `/admin/requests/[id]`
- `/admin/clients`
- `/admin/categories`
- `/admin/manufacturers`
- `/admin/settings`

### API

- `/api/auth/*`
- `/api/requests`
- `/api/requests/[id]`
- `/api/categories`
- `/api/vehicles`
- `/api/documents`
- `/api/telegram/webhook`
- `/api/ocr`
- `/api/notifications`

API routes на Day 1 повертають `501 not_implemented`, щоб не створювати псевдо-логіку до проєктування доменної моделі.

## Ролі користувачів

Ролі зафіксовані в `lib/auth/roles.ts` і `prisma/schema.prisma`:

- `GUEST` — переглядає сайт, створює разову заявку без реєстрації, отримує номер заявки та status link.
- `CLIENT` — має кабінет, історію заявок, парк техніки, документи, повторні заявки та автопідстановку даних.
- `MANAGER` — обробляє заявки в CRM.
- `ADMIN` — керує CRM налаштуваннями, довідниками та системними правилами.

## `.env` змінні

`.env.example` містить:

```env
DATABASE_URL=

NEXTAUTH_URL=
NEXTAUTH_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

FILE_STORAGE_DRIVER=local
FILE_UPLOAD_MAX_SIZE_MB=20

OCR_PROVIDER=tesseract
OCR_API_KEY=

APP_BASE_URL=
```

Реальні секрети не додаються в репозиторій.

## Prisma / database placeholder

`prisma/schema.prisma` містить:

- `generator client`;
- PostgreSQL datasource через `DATABASE_URL`;
- enum `UserRole`;
- коментар, що детальна доменна модель буде реалізована на Day 2.

На Day 1 не створювались таблиці заявок, користувачів, техніки, документів, повідомлень або OCR-результатів.

## Layout principles

Інтерфейс базується на `docs/design-system.md`:

- темний navy header/sidebar;
- жовто-золотий CTA accent;
- світла content area;
- білі картки;
- стримані B2B dashboard і CRM shells;
- таблиці та форми будуть додані після доменного проєктування.

## Що не реалізовувалось на Day 1

- Повна база даних.
- Повний кабінет клієнта.
- Повна CRM.
- Telegram bot flow.
- OCR flow.
- Форми заявок.
- Повний auth flow.
- Реальні API ключі.
- Production deploy.
- Онлайн-оплата, кошик, Viber, Нова пошта, BAS/ERP, API постачальників, кабінет постачальника.

## Наступні кроки Day 2

1. Спроєктувати доменну модель Prisma: users, accounts, requests, request files, vehicles, documents, categories, manufacturers, statuses, notifications.
2. Уточнити ownership rules: гість проти клієнта, клієнтські заявки, доступ менеджера та admin.
3. Спроєктувати API contracts для заявок, статусів, файлів, техніки, документів і CRM.
4. Підготувати auth strategy для Auth.js / NextAuth.
5. Визначити file storage abstraction і OCR service boundary.
6. Після затвердження моделі створити першу міграцію Prisma.
