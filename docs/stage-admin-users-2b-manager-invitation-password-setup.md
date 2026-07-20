# Stage Admin Users 2B — Manager invitation and password setup

## 1. Scope

Реалізовано security/auth foundation для ручного запрошення майбутнього `MANAGER`: створення неактивного staff account, одноразове посилання, встановлення пароля та транзакційна активація. `/admin/team`, email delivery, password reset і lifecycle UI не входять у цей етап.

## 2. Stage 2A foundation

Використано наявні `UserStatus`, `User.authVersion`, DB-backed guards і session revocation із Stage 2A. `INVITED` та `DISABLED` як і раніше не можуть авторизуватися; після активації manager отримує `ACTIVE` і нове значення `authVersion`.

## 3. Password/auth audit

`User.passwordHash` уже був nullable, тому fake password і додаткова зміна цього поля не потрібні. Для нового пароля використовується чинний `lib/auth/password.ts` і його scrypt-based `hashPassword`. Email залишається логіном.

## 4. Prisma model

Додано `ManagerInvitation` із relations до invited user і ADMIN creator, `tokenHash @unique`, `expiresAt`, `usedAt`, `revokedAt`, timestamps та індексами для user/expiry/active-state queries. Видалення invited user каскадно видаляє invitations; creator захищений `Restrict` relation.

## 5. Token generation

Plain token створюється через `crypto.randomBytes(32)` і кодується як `base64url`. `Math.random`, IDs, timestamps і JWT як invitation secret не використовуються.

## 6. Token storage

У БД зберігається лише deterministic SHA-256 hash token. Plain token не потрапляє до Prisma model, AuditLog, diagnostics або report і повертається лише один раз у сформованому invitation URL.

## 7. TTL

TTL дорівнює 48 годинам. Точний `expiresAt` зберігається в БД і перевіряється server-side як під час відкриття сторінки, так і під час activation transaction.

## 8. Invitation states

Підтримано стани `active`, `invalid`, `expired`, `used`, `revoked`, `account_active`, `account_disabled`. Active invitation вимагає `usedAt = null`, `revokedAt = null`, `expiresAt > now`, `role = MANAGER`, `status = INVITED` і відсутній password hash.

## 9. Invited manager policy

`createInvitedManager` повторно перевіряє в БД, що actor є `ACTIVE ADMIN`, нормалізує name/email та в `Serializable` transaction створює `User(role=MANAGER, status=INVITED, passwordHash=null, authVersion=1)`, `ManagerProfile`, invitation і AuditLog.

## 10. Existing email policy

Email порівнюється case-insensitive після `trim` і lowercase. Existing user не змінюється і не підвищується до `MANAGER`. Existing invited manager обробляється окремим regenerate service; concurrent unique conflict перетворюється на safe domain error.

## 11. Invitation URL

Фактичний route: `/invitation/manager/[token]`. Absolute URL будується через наявний trusted `buildAbsoluteUrl`, а не через request `Host` і не через hardcoded production domain.

## 12. Public invitation page

Сторінка показує read-only ім'я/email та password form тільки для active invitation. Для неактивних станів показуються безпечні українські повідомлення без token hash, internal IDs, role selector або editable email. Page має `noindex`, `nofollow`, `no-referrer`, dynamic rendering і вимкнене cache reuse.

## 13. Password validation

Пароль і підтвердження обов'язкові, мають збігатися, мінімум 8 і максимум 128 символів. Password не trim-иться та не логуються. Після validation застосовується чинний secure password hash helper.

## 14. Activation transaction

Activation повторно читає invitation/user, atomically claim-ить invitation через conditional `updateMany`, активує лише passwordless `INVITED MANAGER`, встановлює password hash, збільшує `authVersion`, відкликає інші unused invitations і створює `MANAGER_ACTIVATED` AuditLog у `Serializable` transaction.

## 15. Concurrency and replay protection

Повторне або конкурентне використання одного token не проходить: лише один conditional claim може встановити `usedAt`. Invalid, expired, revoked, already-used або account-state mismatch повертають safe inactive result. Expensive password hashing виконується лише після read-only preflight validation.

## 16. Regeneration

`regenerateManagerInvitation` доступний тільки `ACTIVE ADMIN` і лише для passwordless `INVITED MANAGER`. Усі попередні unused/unrevoked invitations відкликаються перед створенням нового token; existing user не дублюється.

## 17. AuditLog

Додано actions `MANAGER_INVITATION_CREATED`, `MANAGER_INVITATION_REGENERATED`, `MANAGER_ACTIVATED` та українські presentation labels. Metadata містить лише IDs, event, expiry/activation timestamps і revoke count; plain token, token hash і password дані відсутні.

## 18. Role, status and authVersion

Invitation не може змінити роль existing user. Новий manager до activation має `INVITED`; activation встановлює `ACTIVE` і increment `authVersion`. Disabled або вже active account invitation flow не активує.

## 19. Login behavior

Invitation flow не створює browser session автоматично. Після activation користувач бачить success page і переходить на `/admin/login`, де чинний credentials provider виконує звичайну перевірку email/password/current DB state.

## 20. Security and operational notes

Invitation token неминуче присутній у route URL, але сторінка не кешується, має strict referrer policy і не передає token до analytics. Окремий distributed rate limiter у проєкті відсутній; form має bounded validation і одноразовий token, але rate limiting залишається future hardening, а не blocker MVP.

## 21. SQL migration review

Migration `20260720180000_add_manager_invitations` є additive: додає AuditAction enum values, таблицю, constraints та індекси. Вона не містить `DROP`, destructive update, reset або зміну існуючих password hashes/users.

## 22. Neon pre/post evidence

Read-only aggregate before deploy: users `8`, staff `2`, invited `0`, passwordless `0`, `authVersion=1` users `8`.

Read-only aggregate after deploy: users `8`, staff `2`, invited `0`, passwordless `0`, `authVersion=1` users `8`, manager invitations `0`.

Migration успішно застосована до підключеної Neon DB через `prisma migrate deploy`; повторний `prisma migrate status` показує database schema up to date. Secrets, emails, hashes, tokens і connection string не виводилися.

## 23. Targeted checks

`scripts/check-admin-users-2b.ts` перевіряє TTL, normalization/validation, усі invitation states, 32-byte CSPRNG, SHA-256 storage, unique hash, відсутність secret fields в AuditLog metadata, `authVersion` increment, used/revoked timestamps і `Serializable` boundary. Скрипт не створює і не змінює users/invitations.

## 24. Manual staging checklist

- [x] Migration застосована; schema up to date.
- [x] Invalid token перевірено у браузері: safe server-rendered state з українським заголовком `Посилання недійсне` без технічних деталей.
- [x] Plain token не зберігається у schema/AuditLog.
- [x] Existing users/roles/password readiness не змінилися за aggregate counts.
- [ ] ADMIN create invitation через UI — відкладено, бо `/admin/team` належить Stage 2C.
- [ ] Active-link password submit і real manager login — не виконано: етап навмисно не створював тестового manager/invitation у підключеній Neon DB без окремого дозволу на такі дані.
- [ ] Regenerate/replay browser smoke — потребує контрольованого invited manager, який буде безпечно створений через Stage 2C UI або окремий authorized test.

## 25. Deferred to Stage 2C

Відкладено staff list, `/admin/team`, create/copy/regenerate controls, activation/deactivation/role-change UI, manual delivery UX і browser E2E через цей UI. Email provider, reset-password і automatic invitation delivery також не реалізовані.

## 26. Readiness

Schema та service foundation не мають blocker для Stage Admin Users 2C. Залишковий QA gate — створити контрольованого invited manager через майбутній ADMIN UI, один раз пройти active-link activation, перевірити replay/expiry/regeneration і звичайний `/admin/login`. Prisma schema змінена лише additive migration; додаткова migration не потрібна.
