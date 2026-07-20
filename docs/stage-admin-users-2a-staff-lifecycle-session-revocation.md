# Stage Admin Users 2A — Staff lifecycle and session revocation foundation

Дата: 20 липня 2026 року
Статус: реалізовано й застосовано до підключеної Neon DB; Stage Admin Users 2B не розпочато.

## 1. Scope

Етап додає спільний lifecycle користувача, server-side анулювання JWT через `authVersion`, DB-backed перевірку поточного стану користувача та foundation helpers для майбутнього staff management. Не додавалися `/admin/team`, invitation token/model, set-password, email provider, manager UI, status/role mutation endpoints, password reset або нові AuditLog events.

## 2. Stage 1 findings

Stage 1 підтвердив: public `/register` створює лише `CLIENT`; CRM team UI та invitation/deactivation flows відсутні; JWT зберігав роль лише з моменту login; guards покладалися на `session.user.role`; у Neon було 6 `CLIENT`, 1 `MANAGER`, 1 `ADMIN`. Stage 2A закриває security foundation до появи lifecycle mutations.

## 3. Current auth flow

Поточний flow після змін:

```text
login form
→ Credentials authorize
→ User lookup + password verification
→ status ACTIVE check
→ JWT callback records userId/role/status/authVersion
→ later JWT callbacks re-read minimal User state from DB
→ session callback exposes id/role/status
→ protected server guard independently validates current DB state
```

Logout залишається стандартним Auth.js sign-out. Session strategy — JWT, не database sessions.

## 4. JWT/session strategy

JWT містить `userId`, `role`, `status`, `authVersion` і internal `sessionInvalid`. `passwordHash` та profile data в token не потрапляють. Browser session містить лише `id`, `role`, `status`; `authVersion` client-side не віддається.

## 5. User lifecycle model

Додано загальний `UserStatus` для всіх `User`:

- `INVITED`
- `ACTIVE`
- `DISABLED`

Поля `User.status` і `User.authVersion` є спільними для staff та clients. Це дозволяє однаково блокувати disabled client cabinet і CRM accounts без дублювання `StaffStatus`.

## 6. Status semantics

- `INVITED`: account існує, password може бути `null`, credentials login заборонений; activation буде у Stage 2B.
- `ACTIVE`: credentials login дозволений за наявності валідного password; permissions визначає актуальна DB role.
- `DISABLED`: login і всі protected requests заборонені.

Допустимі transitions foundation helper: `INVITED → ACTIVE`, `ACTIVE → DISABLED`, `DISABLED → ACTIVE`. Довільні переходи відхиляються.

## 7. authVersion strategy

`User.authVersion Int @default(1)` є revocation counter. JWT отримує актуальне значення під час login. На кожному server-side session refresh Auth.js порівнює token claims із DB. Зміна role/status або `authVersion` робить старий JWT невалідним. Для майбутніх disable, role change, password reset і security revoke додано typed `incrementUserAuthVersion(userId, tx?)`.

## 8. Prisma changes

У `prisma/schema.prisma` додано `UserStatus`, `User.status @default(ACTIVE)` та `User.authVersion @default(1)`. `passwordHash` уже був nullable і не змінювався. Інші User fields, relations та role enum не змінювалися.

## 9. Migration SQL review

Migration: `20260720140000_add_staff_lifecycle_and_auth_version`.

SQL створює enum і дві non-null columns із defaults. Немає `DROP`, table recreation, delete, role update або password update. `prisma db push`, `migrate reset` і mass data mutation не використовувалися.

## 10. Backfill

PostgreSQL defaults одночасно безпечно заповнили існуючі rows:

```text
status = ACTIVE
authVersion = 1
```

Roles, password hashes та accounts збережені. `INVITED` records на Stage 2A не створювалися.

## 11. Login changes

Credentials authorize спочатку перевіряє email/password, потім lifecycle status. `INVITED` і `DISABLED` отримують окремі safe login messages без raw enum/version details. `ACTIVE` із валідним password продовжує login. Passwordless account не може увійти.

## 12. JWT callback changes

Під час login callback записує `userId`, `role`, `status`, `authVersion`. На наступних callback invocation мінімальний DB select (`id`, `role`, `status`, `authVersion`) перевіряє:

- чи user існує;
- чи status `ACTIVE`;
- чи role збігається;
- чи status claim збігається;
- чи `authVersion` збігається.

DB validation error обробляється fail-closed через `sessionInvalid = true`; secrets і user details не логуються.

## 13. Session callback changes

Для valid JWT session отримує `id`, `role`, `status`. Для legacy/stale/invalid JWT `id` очищається, role/status не видаються. `authVersion` навмисно не додається до browser session.

## 14. DB-backed guard architecture

`lib/auth/current-user-access.ts` є спільним server helper. `requireCrmSession`, `requireAdminSession`, `getCrmApiSession`, `getAdminApiSession`, `requireClientSession` та `getClientApiSession` використовують DB-backed validation і current DB role/status. Page guards redirect на login, stale API session повертає 401, а valid current user без потрібної role — 403.

Auth.js JWT validation порівнює `authVersion`; central guards отримують уже validated session і додатково перечитують current DB role/status. Token role не є остаточним джерелом authorization.

## 15. Middleware limitation

Middleware не імпортує Prisma і не робить DB lookup. Він виконує лише ранній JWT gate: вимагає `userId`, `ACTIVE`, integer `authVersion`, відсутність `sessionInvalid` і перевіряє role claim для routing. Остаточна authorization завжди повторюється у server layout/action/route guard. Це уникає Edge/TLS/latency ризику DB access у middleware.

## 16. Server Actions/API coverage

Існуючі CRM pages/actions/routes вже використовували central `requireCrmSession`, `requireAdminSession`, `getCrmApiSession` або `getAdminApiSession`; після посилення цих helpers вони автоматично отримали DB-backed verification. Це охоплює vehicle, document, photo, change-request, taxonomy, company, `assignVehicleToCompany`, admin-only та CRM mutations.

П'ять client handlers, які обходили central helper, переведено на `getClientApiSession`:

- `app/api/requests/route.ts`
- `app/api/client/vehicles/route.ts`
- `app/api/client/vehicles/[id]/route.ts`
- `app/api/client/documents/route.ts`
- `app/api/client/request-documents/[documentId]/file/route.ts`

Інші client change-request, offer, vehicle/document download routes уже використовували цей helper. Залишковий direct `auth()` у public `/request` не є protected authorization boundary; session у ньому проходить новий JWT callback.

## 17. Role downgrade behavior

Якщо DB role змінюється, token role mismatch анулює session. Тому старий `MANAGER` JWT після `MANAGER → CLIENT` не отримує CRM access, а tampered `ADMIN` claim не проходить DB comparison. Future role mutation також має increment `authVersion`.

## 18. Disabled user behavior

`DISABLED` user не може виконати новий credentials login. Existing JWT стає invalid при першій server-side validation через inactive DB status, навіть до increment counter. Це однаково працює для `MANAGER`, `ADMIN` і `CLIENT`.

## 19. Legacy JWT policy

JWT без `status` або `authVersion` вважається invalid. Після deploy існуючі users мають один раз увійти повторно. Cookie не видаляється фізично в guard, але protected access одразу відхиляється і page redirect веде на login із safe `session-expired` message.

## 20. Registration/seed compatibility

`registerClient` явно задає `role: CLIENT`, `status: ACTIVE` і не читає `role`, `status` або `authVersion` із FormData. `authVersion` отримує schema default. Seeded `CLIENT`, `MANAGER`, `ADMIN` явно отримують `ACTIVE` і `authVersion: 1`; fixture emails/passwords/roles не змінені. Інших production `User.create/upsert` paths не знайдено.

## 21. Last ADMIN protection helper

Додано transaction-compatible `assertCanDisableOrDemoteAdmin(targetUserId, tx?)`. Він рахує `ACTIVE ADMIN` і блокує дію над останнім active admin. Pure rule дозволяє дію, якщо є інший active admin. Endpoint/UI не додавалися. Future caller має виконувати check і mutation в Serializable transaction, щоб не створити race condition.

## 22. Performance/caching

DB-backed revocation вимагає minimal User lookup на protected request. Select обмежений чотирма auth fields, а React `cache()` дає request-scoped deduplication. Cross-request `unstable_cache` або довготривалий cache не використовується, тому disable/revoke не затримується кешем.

## 23. Security QA

Targeted pure checks підтверджують ACTIVE/INVITED/DISABLED login policy, role/status/version mismatch, missing user, legacy JWT, tampered ADMIN role, client status policy, transitions і last-admin rule. Production/Neon users не змінювалися вручну для destructive session test.

Local production HTTP smoke з реальним Auth.js CSRF + credentials flow пройшов без DB mutations:

```text
CLIENT  → /client → 200
MANAGER → /admin  → 200
ADMIN   → /admin  → 200
```

In-app browser visual smoke не виконано: browser runtime не ініціалізував локальні kernel assets (`failed to write kernel assets: path not found`). Це environment limitation, не application failure. HTTP runtime smoke та build виконані окремо.

## 24. Targeted checks

`npx.cmd tsx scripts/check-admin-users-2a.ts` — PASS: `Stage Admin Users 2A targeted checks passed.`

Технічні checks:

- `npx.cmd prisma format` — PASS
- `npx.cmd prisma validate` — PASS
- `npx.cmd prisma generate` — PASS
- `npm.cmd run typecheck` — PASS
- `npm.cmd run lint` — PASS
- `npm.cmd run build` — PASS
- `git diff --check` — PASS

Build успішно скомпілював application і згенерував усі 45 routes/pages. Під час static generation були non-fatal known Prisma TLS warnings для equipment taxonomy count (`os error -2146893042`); build завершився з exit code 0.

## 25. Neon pre/post migration counts

Read-only pre-migration:

| Metric | Count |
|---|---:|
| CLIENT | 6 |
| MANAGER | 1 |
| ADMIN | 1 |
| Staff total | 2 |
| Password ready | 8 |
| Passwordless | 0 |
| Duplicate email groups | 0 |

Read-only post-migration:

| Metric | Count |
|---|---:|
| Users total | 8 |
| ACTIVE | 8 |
| Staff ACTIVE | 2 |
| CLIENT ACTIVE | 6 |
| authVersion null | 0 |
| authVersion != 1 | 0 |
| Password ready | 8 |
| Passwordless | 0 |

Email, phone, hash, token і connection string не виводилися.

## 26. Prisma/Neon migration status

`npx.cmd prisma migrate deploy` успішно застосував `20260720140000_add_staff_lifecycle_and_auth_version` до підключеної Neon DB. `npx.cmd prisma migrate status` після deploy: database schema is up to date; 25 migrations found. Schema migration не змінювала users вручну поза column defaults.

## 27. Manual staging checklist

- [x] Existing seeded CLIENT credentials login і `/client` HTTP 200.
- [x] Existing seeded MANAGER credentials login і `/admin` HTTP 200.
- [x] Existing seeded ADMIN credentials login і `/admin` HTTP 200.
- [x] Legacy token policy covered targeted check.
- [x] CLIENT cannot satisfy CRM DB role guard by token claim.
- [x] Client cabinet requires current `ACTIVE CLIENT`.
- [ ] Browser visual confirmation — blocked by local browser runtime assets.
- [ ] Controlled staging user `authVersion + 1` live-session test — not performed because it mutates connected users and no explicit test-user mutation approval was given.

## 28. Explicitly deferred Stage 2B work

Не реалізовано: `/admin/team`, staff list/create UI, invitation record/token/hash/TTL, set-password, copy/resend invite, manager creation, enable/disable actions, role mutations, email/Resend, password reset, lifecycle AuditLog events/UI та notifications.

## 29. Blocker for Stage 2B

Технічного blocker у Stage 2A foundation немає. Перед Stage 2B потрібні product/security decisions: invitation token model і TTL, one-time consumption/revocation policy, email delivery/configuration, duplicate/reinvite semantics, actor permissions, audit event payloads та transaction boundary для last-admin/self-disable operations. Browser tool environment також слід відновити для повного UI QA, але це не блокує backend design Stage 2B.
