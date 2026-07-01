# Kairos Parts — Day 3 Project Environment and Auth Foundation

## Що створено

Day 3 підготував робочий технічний каркас для наступних етапів:

- Prisma client singleton для Next.js dev mode.
- Auth.js / NextAuth foundation.
- Auth.js-compatible Prisma schema models.
- Credentials-ready auth structure без увімкненого password login.
- Role-based access helpers.
- Middleware для захисту `/client/*` і `/admin/*`.
- Public layout footer і Telegram CTA placeholder.
- Seed foundation для локальних test users.

Day 3 не реалізовує публічний сайт, форми заявок, CRM actions, Telegram flow, OCR або production-ready auth.

## Git status

У робочій директорії є `.git`, але це порожня директорія без git metadata. Через це `git status` повертає:

```txt
fatal: not a git repository (or any of the parent directories): .git
```

Git не готовий до комітів. Репозиторій не переініціалізовувався, бо це треба робити тільки після окремого погодження.

## Prisma client

Prisma singleton створено в `lib/prisma.ts`.

Принцип:

- один `PrismaClient` у production;
- повторне використання global singleton у Next.js dev mode;
- логування `error`/`warn` у development;
- `DATABASE_URL` залишається в `.env.example`.

Міграції не запускались. `prisma/schema.prisma` готовий до майбутнього `prisma migrate dev` після підтвердження реальної local development database URL.

## Auth.js / NextAuth foundation

Створено:

- `auth.ts` — server-side NextAuth instance з `PrismaAdapter`.
- `lib/auth/config.ts` — split auth config з Credentials provider.
- `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler з `runtime = 'nodejs'`.
- `types/next-auth.d.ts` — type augmentation для `session.user.id` і `session.user.role`.

Credentials provider підготовлений, але реальна перевірка пароля навмисно не ввімкнена. `verifyPassword` зараз повертає `false`, доки не буде обраний і реалізований password hashing підхід. Це не дає створити небезпечний hardcoded login.

OAuth providers не додавались.

## Role-based access

Ролі:

- `CLIENT`
- `MANAGER`
- `ADMIN`

Guest не є авторизованим користувачем. Guest — це anonymous user для public site і разової заявки.

Файли:

- `lib/auth/roles.ts`
- `lib/auth/permissions.ts`
- `middleware.ts`

Правила:

- public routes доступні всім;
- `/client/*` доступний тільки `CLIENT`;
- `/admin/*` доступний `MANAGER` або `ADMIN`;
- `/admin/settings` зарезервований як admin-only foundation.

Middleware використовує `getToken` з `next-auth/jwt` і `NEXTAUTH_SECRET`.

## Layout-и

### Public layout

Є:

- dark navy header;
- базова навігація;
- CTA `Створити заявку`;
- footer;
- Telegram CTA placeholder;
- палітра з `docs/design-system.md`.

### Client dashboard layout

Є:

- окремий dashboard shell;
- dark navy sidebar;
- сторінки-заглушки dashboard, requests, vehicles, documents, profile;
- візуальний поділ від public layout.

### Admin / CRM layout

Є:

- dark navy sidebar;
- CRM dashboard shell;
- навігація dashboard, requests, clients, categories, manufacturers, settings;
- B2B CRM-style content area.

## Routes

Public:

- `/`
- `/about`
- `/how-it-works`
- `/categories`
- `/categories/[slug]`
- `/contacts`
- `/request`
- `/request/status/[token]`

Auth:

- `/login`
- `/register`
- `/forgot-password`

Client:

- `/client`
- `/client/requests`
- `/client/requests/[id]`
- `/client/vehicles`
- `/client/vehicles/[id]`
- `/client/documents`
- `/client/profile`

Admin:

- `/admin`
- `/admin/requests`
- `/admin/requests/[id]`
- `/admin/clients`
- `/admin/categories`
- `/admin/manufacturers`
- `/admin/settings`

API contracts from Day 2 remain available as placeholders.

## Seed / test users

Створено `prisma/seed.ts`.

Seed foundation передбачає:

- `client@example.test`
- `manager@example.test`
- `admin@example.test`

Паролі не створюються і не документуються. `passwordHash` залишається `null`, тому ці users не є login-ready credentials accounts.

Seed додатково захищений:

```txt
ALLOW_DEV_SEED=true
```

Без цього env-прапорця seed завершується помилкою. `npx prisma db seed` не запускався, бо реальна локальна `DATABASE_URL` не налаштована і destructive/database кроки не входять у Day 3.

Seed command налаштований у `prisma.config.ts`:

```ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts'
  }
});
```

## Local run

Після встановлення залежностей:

```bash
npm run dev
```

або для конкретного host/port:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Production check:

```bash
npm run build
npm run start
```

## Verification commands

Day 3 verification:

```bash
npx prisma generate
npm run typecheck
npm run build
```

## Що не реалізовувалось навмисно

- Повний login/register flow.
- Forgot/reset password.
- Production-ready password hashing.
- OAuth providers.
- Форми заявок.
- Клієнтська бізнес-логіка.
- Парк техніки business actions.
- Документи та file upload.
- CRM business actions.
- Telegram bot flow.
- OCR.
- Email sending.
- Production deploy.
- Shop/cart/payment/Viber/Нова пошта/BAS/ERP.

## Блокери для Day 4

Функціональних блокерів для Day 4 немає.

Технічні нотатки перед комітами або deployment:

- git metadata треба відновити або ініціалізувати після погодження;
- потрібна реальна local `DATABASE_URL` перед міграцією;
- потрібно обрати password hashing library перед увімкненням credentials login.
- `next-auth/jwt` у middleware може давати Edge Runtime warning під час build; це не блокує збірку, але перед production deployment варто перевірити фінальну Auth.js middleware стратегію.
