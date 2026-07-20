# Stage Admin Users 1 — Manager Onboarding Audit

Дата аудиту: 20 липня 2026 року

Статус: **аудит завершено; Stage Admin Users 2 не розпочато.**

Scope: read-only аналіз коду, git history і агрегованих даних підключеної Neon DB. Prisma schema, Auth.js, registration, CRM UI, Neon data та environment variables не змінювалися.

## 1. Executive summary

- У застосунку є **один public registration route** (`/register`) і **одна registration Server Action** (`registerClient`). Вони створюють лише `CLIENT`.
- Prisma default для `User.role` також `CLIENT`, але фактичний registration path не покладається на default: він явно записує `role: 'CLIENT'`.
- Підміна `role` через public `FormData` не працює: action читає allowlist полів окремо, не читає `role` і не spread-ить payload у Prisma.
- Є лише Credentials provider. OAuth, magic-link, password reset та invitation flow не реалізовані.
- У CRM немає `/admin/users`, `/admin/team`, `/admin/managers` або `/admin/staff`, а також немає action/API для створення staff чи зміни ролі.
- ADMIN не може через application flow створити MANAGER або підвищити CLIENT до MANAGER. MANAGER також не може створити MANAGER чи змінити власну роль.
- Staff accounts створюються dev seed або ручною адміністративною операцією поза application flow. Безпечної production-процедури немає.
- Neon містить 6 CLIENT, 1 MANAGER і 1 ADMIN. Усі мають password hash. Окремого active/inactive статусу модель не має, тому називати ці записи «active» за даними schema некоректно.
- Поточні ADMIN і MANAGER збігаються з відомими seed fixtures; timestamps розділені приблизно 140 мс. Це сильний доказ seed-origin, але абсолютний provenance відсутній, бо `User` не має `createdBy`/`source`, а AuditLog не фіксує створення staff.
- Рекомендовано Stage Admin Users 2: ADMIN-only розділ `Команда`, invitation/set-password, status/deactivation, server-side session revalidation, last-ADMIN protection і audit trail.

Головний P0 для майбутнього onboarding: **не відкривати role/deactivation mutations, доки немає повторної серверної перевірки актуальної ролі/статусу, last-ADMIN safeguards та session invalidation.**

## 2. Current user roles and schema

Джерело: `prisma/schema.prisma:10-15`, `prisma/schema.prisma:145-173`.

| Role | Призначення за поточним кодом | Persisted user |
|---|---|---:|
| `GUEST` | Концептуальна роль для public permissions | Ні, у Neon 0 |
| `CLIENT` | Client cabinet та власні дані | Так |
| `MANAGER` | CRM | Так |
| `ADMIN` | CRM та admin-only operations | Так |

`User.role` має Prisma default `CLIENT`. Фактичний public registration також явно встановлює `CLIENT`.

`User` має `emailVerified`, `passwordHash`, `role`, `createdAt`, `updatedAt`, але **не має**:

- `isActive`;
- `disabledAt`;
- `deletedAt`;
- account `status`;
- `lastLoginAt`;
- session/version/revocation marker;
- `createdBy` або onboarding source.

`ManagerProfile` (`prisma/schema.prisma:268-275`) містить лише `userId`, `displayName` і timestamps. Він не задає permissions або lifecycle status.

`CompanyMember` не є staff-role model. Company membership не потрібен для CRM login: authorization спирається на `User.role`. Тому staff без Company membership не є auth defect.

`AuditEntityType` містить `USER`, але `AuditAction` не має staff lifecycle actions на кшталт `USER_INVITED`, `ROLE_CHANGED`, `USER_DEACTIVATED`.

## 3. Registration routes and actions

### 3.1 Public registration

| Поле | Фактичний стан |
|---|---|
| Route | `/register` |
| Page/form | `app/(auth)/register/page.tsx`, `app/(auth)/register/register-form.tsx` |
| Action | `registerClient` у `app/(auth)/actions.ts:43-113` |
| Access | Public; session/role guard відсутній |
| Input | `next`, `accountType`, company/tax/contact або first/last name, email, phone, password, confirmPassword |
| Приймає `role` | Ні |
| Server validation | Manual allowlist/trim, email regex, required fields, password match, min length 8 |
| Uniqueness | Pre-check за email або phone; також DB unique constraints |
| Password | Scrypt hash із random salt (`lib/auth/password.ts`) |
| User role | Явно `CLIENT` |
| Profile | Nested `ClientProfile.create` |
| Company | Не створюється |
| CompanyMember | Не створюється |
| Transaction | Один nested Prisma write; User + ClientProfile атомарні на рівні Prisma nested write |
| Side effects | Redirect на login; email/Telegram/audit event відсутні |

Business registration зберігає назву/ЄДРПОУ-подібний `taxId` у `ClientProfile`, але не створює `Company`.

Pre-check повертає окремий `error=exists`, тому public flow дає сигнал про існування email або phone. Це не role escalation, але є Low-severity enumeration finding.

### 3.2 CRM user creation

Відсутня. Пошук усіх `prisma.user.create/upsert/update/delete` знайшов лише:

1. public `registerClient`;
2. `prisma/seed.ts`.

CRM routes/actions не створюють `User`, не змінюють `User.role` і не встановлюють password.

### 3.3 Seed/bootstrap

`prisma/seed.ts:150-239` із `ALLOW_DEV_SEED=true` idempotently upsert-ить CLIENT, MANAGER і ADMIN, встановлює їм однаковий dev password hash і створює `ManagerProfile` для staff.

Seed:

- не читає `ADMIN_EMAIL`/`ADMIN_PASSWORD`;
- не є production bootstrap;
- не генерує invitation;
- при повторному запуску перезаписує role/password fixture accounts;
- має safeguard лише через `ALLOW_DEV_SEED=true`.

`prisma.config.ts` підключає `tsx prisma/seed.ts` до `prisma db seed`.

### 3.4 OAuth / adapter creation

OAuth provider відсутній. `lib/auth/config.ts:15-59` реєструє тільки Credentials. `PrismaAdapter` і стандартні `Account`/`VerificationToken` models присутні, але не створюють користувачів без provider flow. У Neon `Account = 0`.

## 4. Default role assignment

Однозначна відповідь:

> Новий користувач через звичайну реєстрацію отримує роль: `CLIENT`.

| Creation path | Role source | Result |
|---|---|---|
| `/register` → `registerClient` | Explicit server-side `role: 'CLIENT'` | `CLIENT` |
| Prisma create без role (гіпотетично) | `@default(CLIENT)` | `CLIENT` |
| OAuth login | Provider відсутній | Не застосовується |
| CRM admin action | Відсутня | Не застосовується |
| Dev seed | Explicit enum per fixture | CLIENT/MANAGER/ADMIN |
| Manual DB/Prisma Studio | Оператор задає role | Поза application safeguards |

## 5. Payload role escalation audit

Висновок: **public role escalation через payload не виявлена.**

Evidence у `app/(auth)/actions.ts:43-110`:

- `FormData` читається по одному ключу через `readString`;
- ключ `role` не читається;
- немає `Object.fromEntries(formData)`;
- немає `...input`, `...parsed.data` або mass assignment;
- Prisma data object явно перелічує поля;
- `role` hardcoded як `CLIENT`.

Payload із `role=ADMIN` або `role=MANAGER` буде проігноровано.

| Vector | Result | Severity |
|---|---|---|
| Hidden form field `role` | Ignored | Informational |
| Extra REST/Server Action field | Ignored | Informational |
| URL parameter `role` | Не читається | Informational |
| Client state tampering | Не впливає на Prisma mapping | Informational |
| CRM role update IDOR | Endpoint/action відсутній | Informational |

Production destructive security test не виконувався.

## 6. Existing CRM user/team UI

Знайдені user-adjacent routes:

| Route | Access | Що показує/робить | Staff management |
|---|---|---|---|
| `/admin/clients` | MANAGER, ADMIN | ClientProfile list | Ні |
| `/admin/clients/[id]` | MANAGER, ADMIN | Client detail, fleet/documents | Ні |
| `/admin/companies` | MANAGER, ADMIN | Companies | Ні |
| `/admin/companies/[id]` | MANAGER, ADMIN | Company/member linking | Працює лише з existing users; не створює staff |

Не існують:

- `/admin/users`;
- `/admin/team`;
- `/admin/managers`;
- `/admin/staff`.

В admin navigation (`app/admin/layout.tsx:12-23`) немає `Команда` або `Користувачі`.

Відсутній UI для:

- списку staff;
- створення MANAGER;
- CLIENT → MANAGER;
- MANAGER → CLIENT;
- деактивації/реактивації;
- hard delete staff;
- password reset іншого user;
- invitation/resend.

## 7. Current ADMIN and MANAGER creation mechanism

### Code/history evidence

- Initial repository вже містив dev seed із CLIENT/MANAGER/ADMIN fixtures.
- Commit `41b9752` розширив seed до login-ready test accounts із hashed password і `ManagerProfile`.
- `docs/auth-roles-login-flow.md` називає dev seed або direct administrative setup поточним internal process.
- `docs/dev-seed-test-accounts.md` документує лише dev/test use.
- Environment-based production bootstrap, idempotent `ensureAdmin`, one-off promotion script або migration SQL із staff rows не знайдені.

### Neon correlation

- Є рівно один ADMIN і один MANAGER.
- Обидва точно збігаються з відомими seed fixture identities; інших staff немає.
- MANAGER створений `2026-07-03T08:13:49.217Z`, ADMIN — `2026-07-03T08:13:49.357Z`.
- Обидва мають `ManagerProfile` і password hash.

Висновок: **поточні ADMIN і MANAGER з дуже високою ймовірністю створені dev seed.** Абсолютно довести спосіб створення неможливо, оскільки `User` не зберігає onboarding source/creator і відповідного audit event немає.

Окремі відповіді:

```text
ADMIN може створити нового MANAGER: ні
ADMIN може змінити роль існуючого користувача на MANAGER: ні
MANAGER може створити іншого MANAGER: ні
MANAGER може змінити власну роль: ні
CLIENT може підмінити роль: ні
```

Direct DB/Prisma Studio може змінити role поза application flow, але це не безпечний admin-flow.

## 8. Password reset and invitation flows

`/forgot-password` існує лише як placeholder (`app/(auth)/forgot-password/page.tsx`) з прямим повідомленням, що flow не реалізовано.

| Capability | Current state |
|---|---|
| Forgot password form/action | Немає |
| Reset password route/action | Немає |
| Reset token model/lifecycle | Немає active flow |
| Invitation model | Немає |
| Invite email | Немає |
| Set-password page | Немає |
| Token TTL | Не визначено |
| One-time consumption | Не реалізовано |
| Token hashing/revocation | Не реалізовано |
| Resend invite | Немає |

Standard Auth.js `VerificationToken` table існує, але provider/action, який її використовує, відсутній; у Neon записів 0. Не слід вважати наявність таблиці готовим reset/invite flow.

Відповіді:

```text
Чи можна зараз безпечно створити менеджера без встановлення пароля адміністратором? Ні.
Чи може менеджер отримати одноразове посилання та самостійно встановити пароль? Ні.
```

Existing reset flow повторно використати неможливо, бо його немає. Stage 2 має створити окремий invitation lifecycle або спільний безпечний token service.

## 9. Neon role inventory

Read-only audit виконано 20 липня 2026 року. Email, phone, password hashes, tokens і connection strings не виводилися.

| Role | Total | Login-ready (`passwordHash != null`) | Passwordless |
|---|---:|---:|---:|
| CLIENT | 6 | 6 | 0 |
| MANAGER | 1 | 1 | 0 |
| ADMIN | 1 | 1 | 0 |
| GUEST | 0 | 0 | 0 |

Додатково:

- staff без `ManagerProfile`: 0;
- staff без Company membership: 2; це не впливає на auth;
- case-insensitive duplicate email groups: 0;
- verified staff (`emailVerified != null`): 0;
- OAuth/adapter `Account`: 0;
- `VerificationToken`: 0;
- persisted `Session`: 0;
- users із непростроченою persisted session: 0.

Оскільки session strategy = `jwt`, відсутність rows у `Session` не означає відсутність browser JWT cookies.

**Active ADMIN/MANAGER count:** schema не має active flag, тому окремий authoritative active count недоступний. Практичний credentials-ready inventory: 1 ADMIN і 1 MANAGER.

## 10. Active/deactivation behavior

Деактиваційної моделі немає. `Credentials.authorize` (`lib/auth/config.ts:22-57`) перевіряє:

1. email/password;
2. наявність password hash;
3. role у CLIENT/MANAGER/ADMIN;
4. password hash.

Він не може перевірити inactive state, бо такого state немає. `emailVerified` також не є login requirement.

Auth.js використовує `session.strategy = 'jwt'`. `jwt` callback записує role при sign-in, а на наступних requests не перечитує User з DB. Отже ручне пониження role або майбутня деактивація без session-version/revalidation не припинить уже виданий JWT до його expiry.

```text
Чи можна зараз деактивувати менеджера без видалення? Ні.
Чи блокується login inactive user? Не застосовується: inactive status відсутній.
Чи припиняються активні сесії після ручної зміни role/видалення? Не гарантовано; JWT зберігає стару role.
```

## 11. Last ADMIN protection

Application flow для role change/deactivation/deletion відсутній, тому через поточний UI/API останнього ADMIN видалити або понизити не можна.

Водночас немає reusable safeguards для майбутніх mutations:

- count active ADMIN у transaction;
- заборона self-demotion/self-deactivation;
- заборона видалення останнього active ADMIN;
- concurrent-safe last-admin lock;
- session revocation після role/status change.

Це не поточний public exploit path, але **P0 prerequisite** перед Stage 2. Direct DB operation може залишити систему без ADMIN.

## 12. Actual permissions matrix

Матриця заповнена за server-side guards, а не за декларативними `ROLE_CAPABILITIES`.

| Дія | CLIENT | MANAGER | ADMIN |
|---|---:|---:|---:|
| Зареєструвати новий CLIENT через public form | Так, public action | Так, public action | Так, public action |
| Відкрити CRM | Ні | Так | Так |
| Переглядати заявки | Лише власні/company | Так, зараз усі CRM заявки | Так, усі |
| Переглядати звернення | Ні | Так | Так |
| Створити менеджера | Ні | Ні | Ні |
| Змінити role | Ні | Ні | Ні |
| Деактивувати staff | Ні | Ні | Ні |
| Reset password іншого користувача | Ні | Ні | Ні |
| Створити ADMIN через application flow | Ні | Ні | Ні |
| Видалити ADMIN через application flow | Ні | Ні | Ні |

CRM pages повторно перевіряють session server-side через `requireCrmSession`; admin-only actions/routes використовують `requireAdminSession`/`getAdminApiSession`. Middleware не є єдиним authorization layer.

Важлива фактична відмінність: `ROLE_CAPABILITIES` описує `request:read:assigned` для MANAGER, але `app/admin/requests/page.tsx` прямо повідомляє, що обмеження лише призначеними менеджеру заявками ще не ввімкнено. MANAGER бачить загальний CRM request stream.

## 13. Security findings

### High — stale JWT зберігає staff access після DB role/status change

- Evidence: `lib/auth/config.ts:12-14`, `lib/auth/config.ts:60-75`.
- Exploitability: користувач із уже виданим staff JWT може зберегти стару role після ручного offboarding або майбутньої mutation.
- Fix: `isActive` + `sessionVersion`/`tokenVersion`, DB revalidation для protected staff requests, revocation/version bump при role/status change, короткий JWT lifetime як defense-in-depth.

### Medium — staff deactivation/offboarding відсутні

- Evidence: User schema не має lifecycle state; admin action/UI відсутні.
- Exploitability: скомпрометований або звільнений staff account не можна штатно вимкнути.
- Fix: soft deactivation, login block, JWT/session invalidation, audit event.

### Medium — secure manager onboarding відсутній

- Evidence: staff створюється лише seed/manual; reset/invite відсутні.
- Exploitability: оператор змушений задавати password або змінювати DB поза контрольованим flow.
- Fix: ADMIN-only invitation із hashed random token, expiry, one-time use, pending state і self-set password.

### Medium — last-ADMIN safeguards відсутні як reusable invariant

- Поточного mutation endpoint немає, тому remote exploit path відсутній.
- Direct DB або майбутній Team flow може спричинити administrative lockout.
- Fix: transactional invariant і self-action restrictions до відкриття Stage 2 mutations.

### Medium — staff lifecycle audit trail відсутній

- `AuditLog` може посилатися на USER entity, але відповідних lifecycle actions/writes немає.
- Fix: audit invite/create/accept/resend/activate/deactivate/role-change/session-revoke з actor/target і без token/PII payload.

### Medium — MANAGER має ширший CRM read scope, ніж declarative capability

- MANAGER бачить усі заявки, clients, companies, contact messages та audit log через `requireCrmSession`.
- Це може бути поточною business policy, але суперечить `request:read:assigned` у `ROLE_CAPABILITIES`.
- Fix: до Stage 2 письмово затвердити actual staff permission policy; не покладатися на декларативний масив, який не enforce-иться.

### Low — account enumeration у registration

- `registerClient` відрізняє `error=exists` від validation/database errors.
- Це дозволяє перевіряти наявність email або phone без створення акаунта.
- Fix: generic public response, rate limit, internal structured reason.

### Low — немає видимого rate limiting для registration/login

- Server Actions не містять application-level throttling.
- Fix: edge/WAF + server-side per-IP/account throttling і monitoring без розкриття account existence.

### Informational — role mass assignment не знайдено

Public action застосовує field allowlist і hardcoded CLIENT. Server-side CRM guards присутні. IDOR/self-promotion endpoint не існує.

### Security checklist summary

| Check | Result |
|---|---|
| Mass assignment role | Safe in current registration |
| User update IDOR | User role/status endpoint відсутній |
| Missing ADMIN guard | Не знайдено для admin-only operations |
| Client-side-only role checks | Ні; server guards присутні |
| Unauthenticated staff creation | Немає |
| Email enumeration | Є, Low |
| Predictable/unhashed/reusable invite token | Flow відсутній |
| Inactive user login | Status відсутній |
| Stale active sessions | Ризик є для JWT після DB change |
| Last ADMIN lockout | Direct DB/future-flow risk |
| Self-promotion | Не знайдено |
| Modify another ADMIN by ID | Endpoint відсутній |
| CSRF | Current Server Actions/Auth.js use framework protections; future mutations потребують same-origin/auth checks |
| Staff audit logging | Відсутнє |

## 14. Is a Team section needed?

### Варіант A — `Користувачі`

Плюси: один універсальний каталог. Мінуси: змішує 6 client accounts із staff lifecycle, підвищує ризик випадкової role mutation, розширює PII scope і робить permissions складнішими.

### Варіант B — `Команда`

Плюси: окремий staff-only lifecycle, простіший ADMIN-only guard, безпечніші actions, чіткі audit events, відсутність масових операцій над CLIENT.

Рекомендація для Kairos Parts: **`/admin/team`, ADMIN only, лише MANAGER і ADMIN.** Client management має залишитися в `/admin/clients`.

## 15. Recommended Stage Admin Users 2 scope

1. Додати ADMIN-only `/admin/team` із server-side `requireAdminSession`.
2. Показувати name, masked/necessary email, role, lifecycle status, createdAt, invitation status; last login лише після появи reliable data.
3. ADMIN вводить лише name/email для нового MANAGER.
4. Створювати `PENDING` MANAGER без admin-chosen password.
5. Генерувати cryptographically random token, зберігати лише hash, expiry, one-time consumed/revoked timestamps.
6. Надсилати set-password link через transactional email; delivery failure не повинен активувати user.
7. Після valid acceptance hash password, mark active, consume token, bump session version.
8. Додати resend/revoke invitation з rate limit.
9. Додати deactivate/reactivate MANAGER; hard delete не використовувати як primary flow.
10. На login і CRM access перевіряти current active state/session version server-side.
11. Додати transactional last-active-ADMIN protection та заборону self-demotion/self-deactivation.
12. Логувати всі staff lifecycle events.
13. MANAGER не має бачити Team route або викликати його actions/API.

Не включати в Stage 2 CLIENT role management, bulk role changes або generic `/admin/users`.

## 16. Required migrations/configuration

Ймовірно потрібні:

- lifecycle status (`PENDING`, `ACTIVE`, `INACTIVE`) або мінімум `isActive`/`disabledAt`;
- `sessionVersion`/`tokenVersion`;
- invitation model: `userId`, token hash, expiresAt, consumedAt, revokedAt, invitedById, timestamps;
- optional `lastLoginAt` після визначення privacy/accuracy semantics;
- нові `AuditAction` values для staff lifecycle;
- transactional email env/configuration;
- rate-limit storage/policy.

Остаточну schema слід затвердити окремо. У Stage Admin Users 1 migrations/config не змінювалися.

## 17. P0 / P1 / P2 findings

### P0 — перед відкриттям будь-якої staff mutation

- DB-backed active/status check;
- JWT/session invalidation/versioning;
- server-side ADMIN guard на кожній Team mutation;
- last-active-ADMIN invariant;
- self-demotion/self-deactivation prohibition;
- hashed, expiring, one-time invite token;
- audit events;
- generic public auth errors/rate limit baseline.

### P1 — Stage Admin Users 2 MVP

- `/admin/team`;
- staff list;
- invite MANAGER;
- accept/set password;
- invitation resend/revoke;
- deactivate/reactivate MANAGER;
- clear pending/active/inactive badges;
- email delivery and failure handling.

### P2

- last login/activity history;
- filters/search;
- role change history;
- delivery retries/observability;
- finer-grained staff permissions after policy approval.

## 18. Questions and blockers

Before Stage 2 approval:

1. Чи current Neon є production/staging і чи допустимі в ній dev seed identities?
2. Який email provider та sender domain використовувати для invitations?
3. Який invite TTL потрібен: рекомендовано 24–72 години?
4. Чи ADMIN role створюється лише out-of-band, чи Team UI згодом має дозволяти другого ADMIN?
5. Чи MANAGER повинен бачити всі заявки/звернення/clients, чи лише assigned scope?
6. Чи потрібна негайна session revocation на всіх devices?
7. Чи дозволяти повторну активацію тим самим ADMIN-only flow?

Blocker для Stage 2: потрібне business/security погодження цих policy та email delivery configuration. Технічного blocker для підготовки окремого design plan немає.

## 19. Recommended next step

Погодити Stage Admin Users 2 як вузький ADMIN-only `Команда` MVP. Почати зі schema/security contract (status, invitation, session invalidation, last ADMIN, audit), а вже потім додавати UI. Не використовувати dev seed або direct Prisma Studio як production onboarding.

## Verification notes

- Перевірено repository-wide search для registration, user mutations, roles, seeds, reset/invite, status/deactivation і CRM routes.
- Перевірено git history для появи seed staff accounts.
- Виконано лише read-only Neon aggregates без PII/secrets.
- Audit script не створювався; lint/typecheck/build для docs-only stage не потрібні.
- Current state та Stage 2 recommendations розділені.
- Stage Admin Users 2 не розпочато.
