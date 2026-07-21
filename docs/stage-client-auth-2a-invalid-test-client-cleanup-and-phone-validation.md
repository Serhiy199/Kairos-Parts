# Stage Client Auth 2A — cleanup невалідного тестового CLIENT і валідація телефону

## 1. Мета

Безпечно видалити один підтверджений тестовий CLIENT із невалідним неповним телефоном і закрити server-side першопричину такого запису.

## 2. Scope

У scope увійшли контрольований Neon cleanup, shared phone normalization, CLIENT phone write paths, regression check і технічна перевірка. Phone login, `User.normalizedPhone` і rate limiting відкладені.

## 3. Data gate Stage Client Auth 2

Stage Client Auth 2 був зупинений через один невалідний CLIENT phone. Цей corrective stage усуває лише data blocker і слабку валідацію.

## 4. Target selection

Target визначався одночасно за роллю, email, phone і name. Значення передавалися лише через protected environment variables і не зберігаються в репозиторії.

## 5. Підтвердження тестового акаунта

Dry-run знайшов рівно один target (`targetUserCount = 1`). Користувач окремо підтвердив, що це тестовий акаунт і його можна видалити.

## 6. Pre-delete dependency counts

Для всіх перевірених категорій залежностей отримано `0`, включно із заявками, технікою, документами, компаніями, сесіями, Telegram drafts та audit/notification records.

## 7. Shared dependency audit

Shared Company, CompanyMember або інші спільні production entities не знайдені. Видалення інших користувачів чи shared records не виконувалося.

## 8. Cleanup transaction

Cleanup виконано в PostgreSQL transaction із повторною exact-target перевіркою, FK-safe порядком, rollback при помилці та закриттям connection у `finally`.

## 9. Видалені record categories

Видалено один підтверджений тестовий `User`; залежних рядків інших категорій у target не було.

## 10. External asset cleanup

Request files, request documents, vehicle images, document assets і Cloudinary-linked rows: `0`. Зовнішні assets не видалялися.

## 11. Post-delete target count

Повторний protected dry-run підтвердив `targetUserCount = 0`.

## 12. Orphan checks

Aggregate Neon audit: `ClientProfile` без `User` — `0`; усі pre-delete dependency categories target також були `0`.

## 13. Invalid phone count після cleanup

Невалідні normalized CLIENT profile phones: `0`.

## 14. Duplicate normalized phone groups

Duplicate normalized profile phone groups: `0`; normalized phone groups, пов’язані з кількома Users: `0`.

## 15. Root cause слабкої phone validation

`registerClient` перевіряв лише непорожність raw `phone`. Формат, країна й повна довжина server-side не перевірялися.

## 16. Точний registration/write path

Першопричина була в `app/(auth)/actions.ts`: raw FormData phone після `required`-подібної перевірки напряму передавався в nested Prisma create для `User` і `ClientProfile`.

## 17. Shared normalization helper

У `lib/phone/normalize.ts` додано `normalizeUkrainianPhone`. Helper повертає canonical phone або `null` і не видаляє довільні символи так, щоб невалідний input випадково став валідним.

## 18. Canonical phone format

Формат збереження: `+380XXXXXXXXX`, тобто `+` і рівно 12 цифр.

## 19. Supported input formats

Підтримуються повний локальний формат, формат із кодом країни та ті самі значення з пробілами, дужками або дефісами.

## 20. Rejected input formats

Відхиляються неповні, закороткі, задовгі, іноземні, alphabetic, порожні та неоднозначні значення.

## 21. Оновлені write paths

Shared helper підключено до public registration, Telegram contact/profile linking і dev seed. Інших create/update paths для `User.phone` або `ClientProfile.phone` аудит не виявив.

## 22. Registration validation

Registration валідовує phone до Prisma query, перевіряє duplicate за canonical value і зберігає canonical phone в обох моделях.

## 23. Telegram validation

Telegram contact спочатку проходить strict normalization. Невалідний payload очищає draft, повертає контрольоване українське повідомлення і не доходить до profile create/update.

## 24. CRM client validation

Окремого ADMIN/MANAGER flow створення CLIENT account у поточному коді немає. CRM billing/company contact phones не змінюють identity phone користувача і не входять у цей auth scope.

## 25. Profile update validation

Окремого client profile action для зміни identity phone у поточному коді немає. Telegram profile linking, який реально оновлює `ClientProfile.phone`, захищено.

## 26. User-facing errors

Registration і Telegram повертають: `Введіть коректний номер телефону у форматі +380XXXXXXXXX.` Prisma/SQL details користувачу не показуються.

## 27. Automated regression

`npx.cmd tsx scripts/check-client-phone-validation.ts`: PASS, 7 valid normalization cases і 10 invalid rejection cases.

## 28. Neon aggregate audit

CLIENT users: `5`; з phone: `5`; без phone: `0`; profiles: `5`; raw duplicates: `0`; invalid phones: `0`; profile/User phone mismatches: `0`.

## 29. Prisma validate

PASS. Schema valid.

## 30. Prisma generate

PASS. Prisma Client generated.

## 31. Prisma migration status

PASS. Neon schema up to date; 30 migrations found. Prisma schema не змінювалася, нова migration не потрібна.

## 32. Typecheck

PASS: `npm.cmd run typecheck`.

## 33. Lint

PASS: `npm.cmd run lint`.

## 34. Build

PASS: `npm.cmd run build`.

## 35. git diff --check

PASS. Whitespace errors не знайдені; Git показує лише інформаційні LF/CRLF warnings для Windows working tree.

## 36. Browser smoke status

NOT RUN. Browser registration не виконувався, щоб не створювати постійний тестовий акаунт у Neon без окремого cleanup сценарію.

## 37. Remaining risks

До Stage Client Auth 2 залишаються заплановані `User.normalizedPhone`, backfill/unique constraint, phone login і persistent rate limiting. Поточні legacy phone formats ще не backfill-ені, хоча всі вони валідно нормалізуються.

## 38. Чи знято data blocker Stage Client Auth 2

Так. Target видалено, invalid phone count і normalized duplicate groups дорівнюють нулю.

## 39. Чи можна продовжувати normalizedPhone migration

Так, data gate для backfill знято. Migration має залишатися окремим наступним stage.

## 40. Final verdict

`READY WITH MANUAL STAGING CHECKS`. Corrective stage завершено; Stage Client Auth 2 ще не вважається повністю реалізованим до окремого normalizedPhone/login/rate-limit етапу.
