# Stage Client Auth 2B — normalized phone і CLIENT login за email або телефоном

## 1. Мета

Додати deterministic CLIENT authentication за email або унікальним canonical phone без зміни staff login policy.

## 2. Scope

Schema, migration/backfill, phone synchronization, Credentials policy, client login UI, regression scripts і staging artifacts. Persistent rate limiting не входить у scope.

## 3. Попередні stages

Stage Client Auth 1 (`201d7a9`) виконав аудит. Stage Client Auth 2A (`5dcc26d`) видалив невалідний test CLIENT і додав strict Ukrainian phone normalization.

## 4. Початковий auth state

Один Auth.js Credentials provider приймав лише email. Client і staff мали окремі forms/actions; password, status і authVersion lifecycle вже існували.

## 5. Phone owner model

Login identity належить `User`. `ClientProfile.phone` залишається display/contact copy.

## 6. Чому normalizedPhone зберігається на User

Це дає прямий exact lookup без join, partial matching або неоднозначного profile ownership.

## 7. Raw phone vs normalizedPhone

`User.phone` і `ClientProfile.phone` зберігають canonical display value для нових/оновлених flows. `User.normalizedPhone` є identity key.

## 8. Canonical format

`+380XXXXXXXXX`; рівно 12 цифр після видалення `+`.

## 9. Prisma schema change

До `User` додано `normalizedPhone String? @unique`. Поле nullable для staff та не входить у session/JWT/public API.

## 10. Migration name

`20260721190000_add_user_normalized_phone`.

## 11. Migration SQL

SQL додає nullable column, backfill-ить CLIENT, виконує fail-fast invariant checks, створює unique index і canonical CLIENT-only CHECK constraint.

## 12. Preflight data gate

PASS: CLIENT total `5`, with phone `5`, without phone `0`, invalid `0`, duplicate groups `0`, duplicate rows `0`, expected backfill `5`, `hasBlocker=false`.

## 13. Backfill strategy

SQL повторює Stage 2A rules для локального, `380...`, canonical і дозволеного decorated input. Raw phone, password і authVersion не змінювалися.

## 14. Backfill result

Backfilled CLIENT rows: `5`.

## 15. Unique constraint

Створено `User_normalizedPhone_key`. PostgreSQL дозволяє кілька `NULL`, тому staff records не конфліктують.

## 16. CLIENT normalized counts

CLIENT total `5`; with normalizedPhone `5`; without normalizedPhone `0`.

## 17. Staff normalized counts

ADMIN with normalizedPhone `0`; MANAGER with normalizedPhone `0`; non-CLIENT normalizedPhone `0`.

## 18. Write paths audit

Identity phone writes знайдені в public registration, Telegram profile linking/profile creation і dev seed. Окремих admin/manager CLIENT create або profile identity-phone edit flows немає.

## 19. Registration synchronization

Nested Prisma create атомарно записує `User.phone`, `User.normalizedPhone` і `ClientProfile.phone`. P2002 перетворюється на контрольований public error.

## 20. Telegram synchronization

Existing profile linking використовує nested `User` update; profile creation використовує transaction. Raw/profile/canonical values змінюються разом.

## 21. Admin/manager client creation

Не застосовується: такого account creation flow у поточному коді немає. Vehicle owner selection не створює CLIENT users.

## 22. Profile update synchronization

Не застосовується: окремого authenticated identity-phone edit action немає. Telegram update path синхронізовано.

## 23. Duplicate handling

Registration pre-check використовує `normalizedPhone`; DB unique constraint є остаточним guard. Race-condition P2002 не стає generic 500.

## 24. Auth identifier parsing

Identifier trim-иться. Валідний email lower-case нормалізується; інакше лише CLIENT scope може strict-normalize український phone.

## 25. CLIENT email lookup

Exact `email` lookup із `role = CLIENT`.

## 26. CLIENT phone lookup

Exact `normalizedPhone` lookup із `role = CLIENT`. `contains`, prefix/suffix, raw fallback і profile join не використовуються.

## 27. ADMIN isolation

ADMIN phone login denied; ADMIN email доступний лише через `STAFF` scope та `/admin/login`.

## 28. MANAGER isolation

MANAGER phone login denied; MANAGER email доступний лише через `STAFF` scope та `/admin/login`.

## 29. Password verification

Усі дозволені login paths використовують той самий `passwordHash` і `verifyPassword`.

## 30. Status checks

Тільки `ACTIVE` account допускається. Client action приховує INVITED/DISABLED причину за generic credentials error; staff lifecycle UX збережено.

## 31. authVersion checks

JWT callback і current-user validation не змінені. Stale sessions і далі invalidated при authVersion mismatch.

## 32. Session/JWT behavior

`normalizedPhone` не додається до JWT або session. Existing role/status/authVersion claims залишилися без змін.

## 33. Generic auth errors

Client UI використовує одне повідомлення: `Невірний email, номер телефону або пароль.` Воно покриває unknown/malformed identifier, password, lifecycle і staff-on-client-route cases.

## 34. Account enumeration protection

Client action не виконує попередній role/existence lookup і не показує account-specific outcome. Registration duplicate copy також не підтверджує конкретний identifier.

## 35. Timing considerations

Unknown/malformed identifiers проходять scrypt verification із non-secret dummy hash. Persistent distributed rate limiting залишається окремим Stage 2C blocker.

## 36. Login UI

Client field: `Email або номер телефону`, `type=text`, `autocomplete=username`, без autocapitalize/spellcheck та без email-only browser validation. Staff form не змінювався.

## 37. Automated regression

`check-client-phone-validation.ts`: PASS. `check-client-auth-2b.ts`: PASS; parser, roles, statuses, password decisions, dummy hash, sync guards і UI/config policies перевірені.

## 38. Neon aggregate audit

PASS: total users `9`; CLIENT `5`; ADMIN `1`; MANAGER `3`; duplicates/invalid/mismatch/non-client normalized values — `0`; `hasBlocker=false`.

## 39. Admin Users 2A–2D regression

2A PASS, 2B PASS, 2C PASS, 2D PASS. Manager onboarding audit: `hasBlocker=false`.

## 40. Prisma validate

PASS.

## 41. Prisma generate

PASS.

## 42. Migration status

PASS: 31 migrations, Neon database schema is up to date.

## 43. Typecheck

PASS.

## 44. Lint

PASS.

## 45. Build

PASS. Next.js production build completed successfully; no server/client boundary, Prisma, duplicate-phone, or auth compilation errors were reported.

## 46. git diff --check

PASS; лише informational Windows LF/CRLF warnings.

## 47. Browser smoke

PARTIAL PASS у локальному Next.js runtime проти Neon. Фактично перевірено: client login за email; logout; client login за canonical phone; staff email denied у client form з generic error; ADMIN email login через `/admin/login`; desktop label і placeholder. Повний 30-сценарний staging checklist, formatted/local phone variants, MANAGER boundary та mobile visual QA залишаються для ручного staging після deploy.

## 48. Persistent rate-limit blocker

Production-safe persistent credentials rate limiting відсутній. In-memory imitation свідомо не додавалася.

## 49. Remaining risks

До Stage 2C auth endpoint не має distributed persistent throttling. Непройдені manual staging scenarios ще потрібно виконати після deploy.

## 50. Rollback considerations

Application rollback після migration безпечний, бо нове поле nullable й старий email flow сумісний. DB rollback вимагає спочатку прибрати application writes/lookups, потім index/check/column.

## 51. Release status

`READY FOR MANUAL STAGING WITH RATE-LIMIT BLOCKER`, якщо final build і Git checks проходять.

## 52. Final verdict

Functional phone login implementation і Neon data layer готові; повна security readiness потребує Stage Client Auth 2C.
