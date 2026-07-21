# Stage Admin Users 2D.1 — Security audit checks and release report correction

Дата повторної перевірки: 21 липня 2026 року.

## 1. Executive summary

Stage 2D.1 виправив security regression checks і read-only Neon audit без зміни production auth, invitation, Team або lifecycle business logic. Checks 2A–2D проходять, read-only audit не знайшов blocker у підключеній Neon DB. Повний browser/staging flow не виконувався, тому фінальний статус: **READY WITH MANUAL STAGING CHECKS**.

## 2. Scope

Змінено лише `scripts/check-admin-users-2a.ts`, `scripts/check-admin-users-2d.ts` і два Stage 2D документи. Prisma schema, migrations, Auth.js callbacks, DB-backed guards, `/admin/team`, invitation services та lifecycle mutations не змінювалися.

## 3. Stages 1/2A/2B/2C recap

- Stage 1 зафіксував credentials-only auth і відсутність безпечного manager onboarding.
- Stage 2A додав `UserStatus`, `authVersion`, DB-backed JWT validation, session revocation foundation і last-active-ADMIN helper.
- Stage 2B додав hashed one-time manager invitations, 48-hour TTL, password setup, atomic activation та AuditLog.
- Stage 2C додав ADMIN-only `/admin/team`, create/regenerate invitation, disable/enable MANAGER і responsive Team UI.

## 4. Current architecture

Єдиний auth provider — Auth.js Credentials. Public registration створює тільки `CLIENT / ACTIVE`. Manager onboarding використовує `MANAGER / INVITED` без пароля, потім одноразову activation transaction. JWT містить role/status/authVersion, а server-side validation звіряє їх із поточним User у БД.

## 5. Git state

Коригування виконано поверх опублікованого commit `03b1522`; history не переписувалась. Перед Stage 2D.1 `main` і `origin/main` вказували на `03b1522`, working tree був clean. Stage 2D.1 оформлюється окремим additive commit.

## 6. Prisma schema audit

`User` має nullable `passwordHash`, `role`, `status` і `authVersion @default(1)`. `ManagerInvitation` має required User relation, unique `tokenHash`, expiry/used/revoked timestamps та creator relation. Prisma schema у Stage 2D.1 не змінена.

## 7. Migration status

`npx.cmd prisma migrate status` знайшов 26 migrations і підтвердив `Database schema is up to date!`. Relevant migrations: `20260720140000_add_staff_lifecycle_and_auth_version` та `20260720180000_add_manager_invitations`. Нова migration не потрібна.

## 8. Neon User counts

Read-only snapshot без PII:

| Metric | Count |
|---|---:|
| Users total / ACTIVE / INVITED / DISABLED | 8 / 8 / 0 / 0 |
| Staff total / ACTIVE / INVITED / DISABLED | 2 / 2 / 0 / 0 |
| Password hash null / present | 0 / 8 |
| Active users without password | 0 |
| authVersion null / less than 1 | 0 / 0 |
| Invalid invited roles | 0 |
| Case-insensitive duplicate email groups | 0 |

Invariants `user status`, `staff status` і `passwordHash` дорівнюють `true`.

## 9. Invitation data audit

Manager invitations: total `0`, active `0`, expired unused `0`, used `0`, revoked unused `0`. Orphan invitations, non-MANAGER owners, active invitations for ACTIVE/DISABLED/invalid-role users і multiple-active groups: `0`. Взаємовиключний state invariant дорівнює `true`.

## 10. AuditLog data audit

Поточний Neon snapshot не містить lifecycle events `MANAGER_INVITATION_CREATED`, `MANAGER_INVITATION_REGENERATED`, `MANAGER_ACTIVATED`, `MANAGER_DISABLED`, `MANAGER_ENABLED`, оскільки контрольований manager flow ще не проходився. Sensitive metadata records: `0`. Відсутність rows не є browser/runtime підтвердженням event creation.

## 11. QA matrix

| Actor | Team page | Team actions | CRM login | Invitation activation |
|---|---|---|---|---|
| ACTIVE ADMIN | ALLOW | ALLOW | ALLOW | Not applicable |
| ACTIVE MANAGER | DENY | DENY | ALLOW | Already active token denied |
| INVITED MANAGER | DENY | DENY | DENY | ALLOW only with active token |
| DISABLED MANAGER | DENY | DENY | DENY | DENY |
| CLIENT | DENY | DENY | Client login only | DENY |
| Guest | Login/deny | DENY | DENY | Public token route with token validation |

Invalid, expired, used, revoked, role-mismatched і status-mismatched tokens мають safe inactive result.

## 12. Registration regression

`registerClient` читає allowlisted fields і явно встановлює `role: CLIENT`, `status: ACTIVE`; payload `role/status/authVersion` не читається. Check 2A підтверджує відсутність mass-assignment role escalation.

## 13. Login regression

Credentials authorize вимагає password hash і дозволяє лише `ACTIVE`. `INVITED` та `DISABLED` повертають спеціальні safe auth errors; відсутній пароль або невірні credentials не авторизують user. OAuth/passwordless provider відсутній.

## 14. JWT/session regression

JWT отримує `userId`, `role`, `status`, `authVersion` при вході. На наступних callbacks claims звіряються з БД; mismatch role/status/authVersion, missing user та legacy token без lifecycle claims invalidates session.

## 15. DB-backed guards

Protected server routes використовують current-user access helpers, які перечитують User і перевіряють ACTIVE status та authVersion. Middleware є лише раннім route filter; остаточне рішення залишається за server-side guard/action.

## 16. Middleware limitation

Middleware не підключає Prisma й не може підтвердити поточний DB status. Воно перевіряє claims і route role, але disable/session revocation гарантується DB-backed callback/guards, а не лише middleware.

## 17. Team route/navigation access

`/admin/team` входить до ADMIN-only route prefixes, page викликає `requireAdminSession`, а navigation показує `Команда` лише ADMIN. MANAGER/CLIENT/guest direct access має бути перевірений у staging; static guards покриті check 2C.

## 18. Create manager flow

ADMIN вводить лише name/email. Service повторно перевіряє `ACTIVE ADMIN`, створює `MANAGER / INVITED`, `passwordHash = null`, `authVersion = 1`, profile, invitation та audit row у Serializable transaction.

## 19. Existing email policy

Email нормалізується до lowercase. Existing CLIENT не підвищується, existing staff не дублюється, INVITED manager спрямовується до regenerate, DISABLED manager — до enable. Read-only audit виявив `0` duplicate email groups.

## 20. Invitation URL exposure

Plain invitation URL повертається лише один раз create/regenerate action і показується в modal. Він не зберігається у User/ManagerInvitation/AuditLog/list query. Browser one-time display ще має бути перевірений у staging.

## 21. Token security

Token генерується `randomBytes(32)`, у БД зберігається SHA-256 hash із unique constraint. TTL — 48 годин. Token/hash/URL/password не повинні потрапляти в AuditLog чи audit console output.

## 22. Invalid/expired/used/revoked token

Rule checks 2B підтверджують усі state classifications. Реальний browser smoke для invalid token частково відомий із Stage 2B; expired, revoked-after-regenerate і reused active token залишаються у Stage 2D checklist як `NOT RUN` для контрольованого staging account.

## 23. Password setup

Password має 8–128 символів, підтвердження має збігатися. Password не trim-иться, хешується чинним scrypt helper і ніколи не друкується. Successful form submit у staging ще не виконаний.

## 24. Activation transaction

Activation повторно перевіряє invitation/user, conditional claim встановлює `usedAt`, User переходить `INVITED -> ACTIVE`, отримує password hash і increment authVersion; інші unused invitations revoke-яться. AuditLog створюється в тій самій Serializable transaction.

## 25. Concurrent activation

Conditional `updateMany` дозволяє claim одному caller; concurrent/replay caller отримує inactive error. Це підтверджено code/rule audit, але не live concurrent staging mutation.

## 26. Regenerate flow

Regenerate доступний лише ACTIVE ADMIN для passwordless INVITED MANAGER, revoke-ить усі попередні unused/unrevoked invitations і створює новий token. Старе посилання має бути перевірене у staging як revoked.

## 27. Disable flow

Disable дозволений тільки для ACTIVE MANAGER. Status update, authVersion increment і AuditLog виконуються атомарно в Serializable transaction. Production staff data під час Stage 2D.1 не змінювались.

## 28. Immediate session revocation

Після disable JWT має втратити доступ через status/authVersion mismatch при наступній DB-backed перевірці. Automated checks підтверджують mismatch logic; browser test існуючої сесії залишається `NOT RUN`.

## 29. Enable flow

Enable дозволений DISABLED MANAGER лише з наявним password hash. Пароль не змінюється, status стає ACTIVE, authVersion збільшується. Старий JWT залишається stale; потрібен новий login.

## 30. Last ADMIN protection

Stage 2D.1 виправив stale regression assertion: один ACTIVE ADMIN + target `DISABLED` кидає `LastActiveAdminError`; при двох ACTIVE ADMIN деактивація одного дозволена. Production helper не змінювався.

## 31. AuditLog transaction/payload safety

Critical invitation/activation/lifecycle events записуються в тих самих transactions, що й mutations. Read-only scanner рекурсивно перевіряє metadata object/array/JSON string і не друкує payload або record IDs.

## 32. Security/IDOR review

Team page та всі Team Server Actions повторно вимагають ACTIVE ADMIN. Target lifecycle service дозволяє лише MANAGER і scoped transitions. Arbitrary role change, CLIENT promotion, ADMIN disable через Team UI та staff hard delete відсутні.

## 33. Secret leakage audit

Scanner case-insensitive перевіряє `token`, `tokenHash`, `plainToken`, `invitationUrl`, `password`, `passwordHash`, `secret`, `apiKey`, `authorization`, `cookie`, `sessionToken`, `accessToken`, `refreshToken`. Output містить лише count/category; Neon finding count `0`.

## 34. Responsive QA

Team UI має desktop table від `xl` і cards нижче `xl`; check 2C підтверджує обидві branches. Реальний viewport smoke для 390/768/1280 не виконаний і внесений у checklist.

## 35. Accessibility QA

Код містить alert dialog, `aria-modal`, live result/copy states, focus trap, Escape і focus restore. Keyboard/screen-reader browser verification залишається ручною staging перевіркою.

## 36. Query efficiency

Team query використовує bounded nested latest invitation select; password readiness визначається окремим batched ID query без N+1. Stage 2D audit використовує один `pg.Client` і лише послідовні SELECT, тому deprecated parallel-query warning усунуто.

## 37. Automated checks

- `check-admin-users-2a.ts`: PASS.
- `check-admin-users-2b.ts`: PASS.
- `check-admin-users-2c.ts`: PASS.
- `check-admin-users-2d.ts`: PASS, `hasBlocker: false`.
- Prisma validate/generate/migrate status: PASS.
- Typecheck/lint/build/git diff check: PASS.

## 38. Controlled browser/staging smoke status

**Browser/staging smoke: NOT RUN.** Не створювався test manager, invitation URL не активувався, реальна session revocation не перевірялася. Automated/static/DB checks не прирівнюються до browser smoke.

## 39. Test staff cleanup decision

Stage 2D.1 не створював і не змінював User/ManagerInvitation/AuditLog records. Cleanup не потрібний. Після майбутнього staging smoke test manager потрібно залишити `DISABLED`; invitation/audit history не видаляти.

## 40. Bugs found and fixes

- HIGH, resolved: Stage 2A перевіряв неправильний last-admin transition; assertion виправлено на `ACTIVE -> DISABLED` і додано позитивний two-admin case.
- HIGH, resolved: passwordHash statistics друкувалися до реального query; тепер query/invariants виконуються до output.
- HIGH, resolved: audit міг друкувати email/user IDs; output тепер count-only.
- HIGH, resolved: invitation integrity audit був неповним; додано orphan/role/status/multiple-active/state checks.
- MEDIUM, resolved: паралельні queries одного `pg.Client`; усі SELECT виконуються послідовно.
- MEDIUM, resolved: report/checklist не відповідали погодженій структурі.

## 41. Remaining gaps

Не підтверджені браузером: create/copy/activate/replay/regenerate, MANAGER Team denial, immediate session revocation, stale old JWT after enable, AuditLog visual payload і responsive/accessibility behavior. Neon snapshot не має lifecycle history rows, тому event counts дорівнюють нулю.

Під час local build виникають Prisma/Neon TLS diagnostics для taxonomy count queries; build завершується code `0`. Після redeploy потрібно перевірити Vercel logs. Це не частина Admin Users business logic.

## 42. Severity classification

Усі знайдені HIGH/MEDIUM дефекти самого Stage 2D audit tooling/reporting виправлені. У production Admin Users code нових BLOCKER/HIGH не підтверджено. Remaining items — manual verification gaps, а не підтверджені defects.

## 43. Final release readiness status

**READY WITH MANUAL STAGING CHECKS**: automated checks PASS, Neon `hasBlocker: false`, migrations current, build PASS, але full controlled browser flow не пройдений. Статус `READY` до завершення checklist заборонений.

## 44. Recommended next safe step

Після push/redeploy виконати `docs/stage-admin-users-2d-staging-verification-checklist.md` на контрольованому staging-only email. Завершити manager у `DISABLED`, не видаляти AuditLog/invitation history, перевірити Vercel TLS diagnostics і лише після всіх PASS змінити release status на `READY`.
