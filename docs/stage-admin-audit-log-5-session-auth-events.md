# Stage Admin Audit Log 5 — Session and Authentication Events

## 1. Executive summary

Stage 5 додає audit coverage до фактично наявних auth/session потоків Kairos Parts: credentials login, authenticated logout, прийняття manager invitation та анулювання сесій при вимкненні manager account. Нові auth events використовують наявний append-only `AuditLog`, retention policy, actor snapshots, IP/User Agent normalization та Stage 4 UI/filters.

Prisma migration `20260723120000_add_auth_audit_events` є additive і навмисно не застосована до Neon. Runtime mutation під час цієї роботи не виконувалася.

## 2. Auth architecture audit

- Auth.js налаштований у `auth.ts` і `lib/auth/config.ts`.
- Є один Credentials provider і JWT session strategy.
- CLIENT входить за email або канонічним українським номером; ADMIN/MANAGER — лише за email.
- Перевірка credentials, status, role та persistent rate limit виконується в `authorize()`.
- JWT callback звіряє `userId`, role, status та `authVersion` з поточним User.
- Session callback не створює нову сесію і лише прибирає claims, якщо JWT invalid.
- `middleware.ts` виконує route gating, але не є канонічною точкою auth event.
- Server guards `requireCrmSession()` / `requireAdminSession()` можуть викликатися багаторазово під час одного переходу.
- Password reset service/action/token model відсутні; `/forgot-password` є інформаційним placeholder.

## 3. Login flow

Канонічна точка login event — завершення `authorize()`:

- `AUTH_LOGIN_SUCCEEDED`, category `LOGIN`;
- actor і target — authenticated User;
- entity — `USER`;
- metadata — `authMethod`, `role`, `source`, `loginScope`, `loginIdentifierMasked`, `reason`;
- IP і User Agent беруться з request headers.

Auth.js beta не дає в цьому проєкті надійного post-session hook із request context. Тому event створюється після успішної перевірки credentials і rate-limit reset, без дублювання у JWT callback, session callback, redirect або middleware. Ризик: event передує остаточному завершенню внутрішнього Auth.js response, але відповідає фактичному прийняттю credentials.

Login audit є best-effort: збій audit storage не змінює результат автентифікації.

## 4. Failed login flow

- невідомий identifier або неправильний password → `AUTH_LOGIN_FAILED`;
- internal reason — `USER_NOT_FOUND` або `INVALID_PASSWORD`;
- actor — anonymous;
- відомий target використовує `USER`, невідомий — `AUTH_ATTEMPT`;
- через обов’язковий `AuditLog.entityId` для anonymous attempt використано стабільний non-PII key `credentials:staff` або `credentials:client`, а не fake User ID;
- identifier зберігається лише у `loginIdentifierMasked`.

Rate-limit block використовує `AUTH_LOGIN_FAILED` з reason `RATE_LIMITED`; raw bucket keys не логуються.

## 5. Disabled and pending account flow

- `DISABLED` → `AUTH_LOGIN_BLOCKED_DISABLED`;
- `INVITED` → `AUTH_LOGIN_BLOCKED_PENDING`;
- category — `LOGIN`;
- actor — anonymous, target — відомий `USER`;
- наявна login UX/error mapping не змінена.

## 6. Logout flow

`logoutClient()` і `logoutStaff()` читають поточну validated session перед `signOut()`:

- за наявності відповідного authenticated User створюється один `AUTH_LOGOUT`;
- без valid session event не створюється;
- category — `LOGIN`;
- entity — `AUTH_SESSION`;
- metadata містить лише `role`, `source`, `reason`;
- audit є best-effort, щоб збій audit storage не блокував logout.

## 7. Password reset

Password reset flow у поточному коді відсутній. Stage 5 не створює нову auth subsystem, token model, delivery mechanism або UX, тому `AUTH_PASSWORD_RESET_REQUESTED` і `AUTH_PASSWORD_RESET_COMPLETED` не додані як мертві contracts.

## 8. Invitation acceptance

`activateManagerInvitation()` тепер створює:

1. наявний business event `MANAGER_ACTIVATED` (`STANDARD`);
2. новий auth event `AUTH_INVITATION_ACCEPTED` (`LOGIN`).

Обидва events створюються в тій самій Serializable transaction, що й claim invitation, password hash update, status transition та `authVersion` increment. Token, token hash, password і password hash не потрапляють до audit payload.

Ці events не є дублями: перший описує team lifecycle, другий — auth security boundary.

## 9. Session invalidation

При переході MANAGER `ACTIVE → DISABLED`:

- User status змінюється;
- `authVersion` збільшується;
- зберігається наявний `MANAGER_DISABLED`;
- у тій самій transaction створюється `AUTH_SESSION_INVALIDATED` category `TECHNICAL`;
- old/new values містять лише попередню і нову версії `authVersion`.

Окремий `AUTH_SESSION_REJECTED` у JWT callback не створюється, щоб не породжувати event на кожен refresh/request.

## 10. authVersion behavior

- disable increment invalidates усі токени з попереднім `authVersion`;
- re-enable також increment-ить version, тому старі токени не стають valid повторно;
- invitation acceptance increment-ить version під час активації;
- JWT callback звіряє version з User і позначає token invalid;
- session callback прибирає privileged claims з invalid token.

## 11. Access denied events

`AUTH_ACCESS_DENIED` не реалізовано. Поточні layout/page guards та middleware можуть виконуватися повторно через render, refresh і prefetch; без durable deduplication це створило б flood і ризик рекурсивного audit path. Наявні permissions і redirect behavior не змінені.

## 12. Action/category mapping

| Action | Category | Entity |
| --- | --- | --- |
| `AUTH_LOGIN_SUCCEEDED` | `LOGIN` | `USER` |
| `AUTH_LOGIN_FAILED` | `LOGIN` | `USER` / `AUTH_ATTEMPT` |
| `AUTH_LOGIN_BLOCKED_DISABLED` | `LOGIN` | `USER` |
| `AUTH_LOGIN_BLOCKED_PENDING` | `LOGIN` | `USER` |
| `AUTH_LOGOUT` | `LOGIN` | `AUTH_SESSION` |
| `AUTH_INVITATION_ACCEPTED` | `LOGIN` | `INVITATION` |
| `AUTH_SESSION_INVALIDATED` | `TECHNICAL` | `AUTH_SESSION` |
| `MANAGER_ACTIVATED` | `STANDARD` | `USER` |
| `MANAGER_DISABLED` / `MANAGER_ENABLED` | `STANDARD` | `USER` |

Stage 4 filters отримують нові actions/entities через централізовані contracts. Critical-only preset не змінений.

## 13. PII and secrets protection

- email маскується як `b***@example.com`;
- phone маскується зі збереженням обмеженого prefix і трьох останніх цифр;
- hard-deny видаляє password, будь-які hash/token/cookie/authorization keys;
- додатково заборонені raw/callback/reset/invitation URL, session payload та raw/request body;
- invitation token/URL, password hash, raw rate-limit key, JWT і session payload не передаються до writer;
- IP і User Agent проходять наявне bounded normalization.

Auth events використовують окремий мінімальний metadata allowlist: `event`, `reason`, `authMethod`, `loginScope`, `loginIdentifierMasked`, `role`, `source`.

## 14. Deduplication

- login — лише `authorize()`;
- logout — лише explicit server action;
- invitation acceptance — один auth event на successful transactional claim;
- session invalidation — лише в mutation, що increment-ить `authVersion` при disable;
- JWT callback, session callback, middleware, redirects і page guards не пишуть auth events.

## 15. Transaction consistency

- Login/logout: best-effort; audit outage не блокує sign-in/sign-out.
- Invitation acceptance: strict transaction coupling; audit failure rollback-ить activation.
- Manager disable/session invalidation: strict transaction coupling; audit failure rollback-ить status/version update.
- Re-enable зберігає наявний single business event `MANAGER_ENABLED`; окремий invalidation event не потрібен.

## 16. Runtime QA

Read-only Neon snapshot до implementation:

- усього `AuditLog`: 22;
- category `LOGIN`: 0;
- staff: 1 ACTIVE ADMIN, 1 ACTIVE MANAGER, 2 DISABLED MANAGER;
- active pending invitations: 0;
- staff з `authVersion > 1`: 2.

Runtime login/logout/invitation/disable mutation не виконувалась: нова enum migration за вимогою лишається pending, а тестові staff credentials/invitation не створювалися. Browser QA не заявляється, бо UI не змінювався і без застосованої migration неможливо валідно перевірити transactional auth events.

## 17. Known limitations

- Успішний login event фіксує accepted credentials у `authorize()`, а не post-cookie completion.
- Best-effort auth events почнуть фактично зберігатися лише після застосування enum migration.
- До застосування migration transactional invitation/disable operations, які використовують нові enum values, не слід деплоїти.
- Password reset та safe deduplicated access-denied event залишаються поза поточним фактичним architecture.

## 18. Pending migration

`prisma migrate status` бачить 36 migrations і рівно одну незастосовану:

`20260723120000_add_auth_audit_events`

Migration лише додає PostgreSQL enum values до `AuditAction` та `AuditEntityType`. `prisma migrate dev`, `prisma migrate deploy`, `db push` і будь-які Neon writes не запускалися.

## 19. Next recommended stage

Після окремого дозволу:

1. застосувати pending migration у контрольованому deploy;
2. виконати authenticated runtime QA на виділених test accounts;
3. перевірити по одному event для success/failure/blocked/logout/invitation/disable;
4. за потреби спроєктувати окремий password reset stage;
5. розглядати access-denied audit лише разом із durable deduplication/correlation policy.
