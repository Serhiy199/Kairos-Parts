# Stage Client Auth 1 — аудит входу за телефоном та ЄДРПОУ / ІПН

## 1. Мета

Перевірити фактичну реалізацію клієнтської авторизації, готовність даних до альтернативного входу та безпечні варіанти розвитку без зміни production auth logic у межах цього етапу.

## 2. Scope

Перевірено Auth.js Credentials provider, клієнтський і службовий login, реєстрацію, password verification, JWT/session lifecycle, middleware і server-side guards, Prisma-моделі, Company membership, Telegram phone linking, manager invitation/password setup та агреговані дані Neon.

Цей етап audit-only. Auth/UI/Prisma schema/дані не змінювались. Neon-запити були лише `SELECT/WITH` і повертали тільки counts без PII.

## 3. Поточна auth architecture

- Auth.js v5 beta з `@auth/prisma-adapter` і JWT session strategy.
- Є один Credentials provider `Email and password` у `lib/auth/config.ts`.
- Клієнтський action: `loginClient` у `app/(auth)/actions.ts`.
- Службовий action: `loginStaff`; окрема сторінка `/admin/login`.
- Password hash зберігається у `User.passwordHash`; використовується scrypt із випадковою salt та `timingSafeEqual`.
- JWT містить `userId`, `role`, `status`, `authVersion`; callback звіряє claims із поточним User.
- Middleware робить route-level routing, а client/CRM server pages/actions додатково використовують server-side guards.

## 4. Поточний login identifier

Фактичний identifier — лише email.

`loginClient` читає поле `email`, виконує `trim()` і `toLowerCase()`, потім робить `User.findUnique({ where: { email } })`. Credentials provider повторно нормалізує email і виконує такий самий lookup. Fallback за phone, `ClientProfile.taxId`, `Company.edrpou`, billing `edrpou/ipn` відсутній.

## 5. Login form behavior

- Поле має HTML name `email`, `type="text"`, `required`.
- Для BUSINESS label: `Email / ЄДРПОУ / телефон`; для INDIVIDUAL: `Email / телефон`.
- Placeholder прямо повідомляє, що фактичний вхід працює через email.
- `autocomplete` для identifier і password явно не задано.
- Server validation вимагає непорожні `email` і `password`; повідомлення каже `Вкажіть email і пароль`.
- UI обіцяє більше identifiers, ніж підтримує backend. Це поточний UX-дефект і джерело хибних очікувань.

Майбутній baseline label має бути `Email або номер телефону`. ЄДРПОУ / ІПН не варто додавати в універсальне поле без окремої двофакторної ідентифікації облікового запису компанії.

## 6. Credentials provider behavior

Provider приймає тільки `email` і `password`. Після email lookup він:

1. Вимагає `passwordHash`.
2. Допускає ролі CLIENT, MANAGER, ADMIN.
3. Перевіряє пароль.
4. Після успішного пароля окремо відхиляє INVITED і DISABLED.
5. Видає JWT лише для ACTIVE.

Provider спільний для client/staff, а розділення додатково забезпечують `loginClient`, `loginStaff`, redirects і guards.

## 7. User lookup logic

- Client login: email-only `User.findUnique`.
- Staff login: email-only `User.findUnique`.
- Credentials authorize: email-only `User.findUnique`.
- Реєстрація шукає exact raw email або exact raw phone, але не normalized phone.
- Telegram flow має окремий lookup за хвостом номера і подальше порівняння через phone normalization.

Telegram lookup не є частиною Auth.js login і не може вважатися підтримкою входу за телефоном.

## 8. Password verification

Пароль належить конкретному `User`, а не `ClientProfile` або `Company`. `hashPassword`/`verifyPassword` використовують scrypt. Manager invitation створює MANAGER зі status INVITED і `passwordHash = null`; пароль встановлюється при прийнятті одноразового invitation token, status стає ACTIVE, `authVersion` збільшується.

## 9. Role/status/authVersion checks

- Credentials authorize вимагає password hash та ACTIVE після password verification.
- `loginClient` відправляє MANAGER/ADMIN на службовий вхід.
- `loginStaff` допускає тільки MANAGER/ADMIN.
- JWT callback на кожному циклі перевіряє role/status/authVersion проти БД.
- Middleware відхиляє token без ACTIVE/current lifecycle claims.
- Server-side guards повторно перевіряють існування User, ACTIVE status і role.

Нюанс: `validateSessionAgainstCurrentUser` не отримує `authVersion` із Session object, однак JWT callback перед формуванням session перевіряє `authVersion` і маркує token invalid. Для майбутнього alternative lookup слід зберегти цю boundary без послаблення.

## 10. Де зберігається телефон

Телефон дублюється в кількох місцях:

- `User.phone` — nullable, DB unique;
- `ClientProfile.phone` — nullable, не unique;
- `Company.phone` — nullable, не unique;
- `CompanyBillingDetails.phone` і `ClientBillingDetails.phone` — реквізити, не login identity;
- Telegram draft зберігає normalized contact phone для поточного flow.

Password зберігається на User, тому canonical login phone також має однозначно належати User.

## 11. Phone normalization

Shared helper `lib/phone/normalize.ts`:

- видаляє нецифрові символи;
- `0XXXXXXXXX` перетворює на `380XXXXXXXXX`;
- 9 цифр доповнює префіксом `380`;
- інші digit strings повертає без country validation;
- для matching також допускає збіг останніх 9 цифр.

Telegram застосовує helper при linking. Реєстрація лише обрізає пробіли й записує raw phone у User і ClientProfile. Тобто єдиного canonical write-path зараз немає.

## 12. Phone uniqueness

`User.phone` має `@unique`, але uniqueness застосовується до raw string. Семантично однакові `+380...`, `380...` і `0...` для БД різні. `ClientProfile.phone` не unique.

Поточний Neon snapshot: raw і normalized duplicate groups серед CLIENT profile phones дорівнюють 0. Це позитивна readiness-ознака, але не заміна constraint/backfill.

## 13. Phone duplicate risks

- Реєстрація може пропустити normalized duplicate у іншому форматі.
- Telegram lookup використовує `contains(phoneTail)` із обмеженим candidate set, а потім tail matching; це не deterministic unique DB lookup.
- User і ClientProfile можуть розійтися після часткового update.
- Nullable User.phone не гарантує phone для кожного CLIENT на рівні schema.
- Staff теж теоретично може мати phone; future client lookup мусить містити role filter.

## 14. Telegram phone integration

При contact share Telegram:

1. Нормалізує/порівнює phone через shared helper.
2. Шукає CLIENT profile за ClientProfile.phone або User.phone.
3. За User без profile може створити ClientProfile.
4. Записує `telegramUserId`, `telegramChatId` та normalized phone у ClientProfile.

Водночас User.phone Telegram flow не canonicalize. Це підтверджує потребу одного canonical User login phone перед увімкненням phone login.

## 15. Чи підтримується login за телефоном

**NOT SUPPORTED.**

Телефон присутній у даних і є normalization helper для Telegram, але login form надсилає його під name `email`, `loginClient` виконує email lookup, а Credentials provider повторює email lookup. Номер не може пройти авторизацію, якщо він випадково не є значенням User.email.

## 16. Де зберігається ЄДРПОУ

- `Company.edrpou` — основний company field, nullable, index, але не globally unique.
- `ClientProfile.taxId` — спільне registration field `ЄДРПОУ / ІПН` для BUSINESS profile.
- `CompanyBillingDetails.edrpou` — billing details.
- `ClientBillingDetails.edrpou` — client billing fallback.

Значення не належить безпосередньо User.

## 17. Де зберігається ІПН

- `ClientProfile.taxId` може містити ІПН або ЄДРПОУ без type discriminator.
- `CompanyBillingDetails.ipn` і `ClientBillingDetails.ipn` мають окремі billing fields.
- У `User` немає tax identifier.

Тому одна й та сама бізнес-сутність може мати значення в різних полях із різною семантикою.

## 18. Tax identifier normalization

Registration і company/billing validation роблять тільки `trim()`. Немає shared normalization, digit-only canonical form, перевірки checksum або узгодженого rule 8 digits для ЄДРПОУ / 10 digits для ІПН. `ClientProfile.taxId` не розрізняє тип.

## 19. Tax identifier uniqueness

- `Company.edrpou`: лише `@@unique([name, edrpou])`, тому той самий edrpou дозволений для різних names.
- `ClientProfile.taxId`: не unique.
- Company/client billing `edrpou/ipn`: не unique.

Жодне tax field не може бути deterministic login key у поточній schema.

## 20. CompanyMember ambiguity

`CompanyMember` має `@@unique([userId])`: один User може належати максимум одній Company. Одна Company може мати довільну кількість members. Отже один Company.edrpou може законно відповідати кільком CLIENT User. Навіть ідеально unique company code не визначає конкретний password owner.

Поточний Neon snapshot має одну company з одним member, але schema/business model підтримує multi-member companies, тому відсутність поточної колізії не усуває архітектурний ризик.

## 21. Primary contact relevance

`CompanyMember.isPrimaryContact` існує. Action при додаванні primary contact спочатку скидає попередній flag у transaction. DB constraint, що гарантує максимум один primary contact на company, відсутній.

Primary contact не є достатнім login mapping: він може бути відсутній, змінюватися, не бути єдиним користувачем компанії і не повинен блокувати інших members. У Neon primary contacts зараз 0.

## 22. Чи підтримується login за ЄДРПОУ / ІПН

**NOT SUPPORTED** технічно і **NOT SAFE AS A SOLE IDENTIFIER** архітектурно.

Auth.js не шукає tax fields. Податковий identifier не належить User, не є canonical/unique і для Company може вести до кількох members. Без personal identifier неможливо визначити, пароль якого User перевіряти.

## 23. Neon aggregate audit

Audit виконано read-only script `scripts/audit-client-login-identifiers.ts`; усі запити статично обмежені `SELECT/WITH`, виконуються послідовно, connection закривається у `finally`, output містить лише counts.

### Phone snapshot

| Метрика | Count |
|---|---:|
| CLIENT users | 6 |
| CLIENT users з phone / без phone | 6 / 0 |
| CLIENT profiles | 6 |
| Profiles з phone | 6 |
| Profiles без phone | 0 |
| Phone null / empty | 0 / 0 |
| Distinct raw profile phones | 6 |
| Duplicate raw groups | 0 |
| Duplicate normalized groups | 0 |
| Invalid normalized format | 1 |
| Profiles без matching User | 0 |
| Profile phones, що не збігаються з User.phone після normalization | 0 |
| Normalized phones, пов’язані з кількома Users | 0 |
| `+` prefix / `380` digits / local digits / decorated | 2 / 2 / 2 / 0 |

Усі 6 ACTIVE CLIENT мають password hash. Snapshot показує три raw phone formats, навіть без поточних дублікатів.

### Tax identifier snapshot

| Метрика | Count |
|---|---:|
| Companies total / with identifier / without | 1 / 1 / 0 |
| Distinct raw company identifiers | 1 |
| Duplicate raw / normalized company groups | 0 / 0 |
| Invalid company identifier format | 1 |
| Company identifiers з 0 / 1 / >1 members | 0 / 1 / 0 |
| Company identifiers з кількома eligible login users | 0 |
| ClientProfile.taxId present | 0 |
| ClientBillingDetails edrpou / ipn present | 1 / 1 |
| Invalid client billing edrpou / ipn | 1 / 1 |
| Ambiguous tax groups / users in ambiguous mapping | 0 / 0 |
| Primary contacts / companies with multiple primary | 0 / 0 |

Малий snapshot не доводить production-safe mapping. Невалідні за базовими length/format rules значення є blocker для прямого tax login без cleanup.

## 24. Security risks

- Raw phone uniqueness не дорівнює normalized uniqueness.
- Tail matching може створити false positive поза очікуваним country format.
- Tax identifier може відкрити company membership context, але не конкретний User.
- Lookup без `role = CLIENT`, `status = ACTIVE`, `passwordHash != null` може випадково охопити staff/inactive accounts.
- Паралельні User/ClientProfile/billing fields створюють ризик stale identity.
- Додавання `OR` по багатьох неunique fields без conflict detection дасть nondeterministic account selection.

## 25. Account enumeration risks

`loginClient` окремо повертає `staff-login`, якщо введено email MANAGER/ADMIN. Це дозволяє відрізнити staff email від звичайного invalid credential. Registration `exists` також підтверджує існування exact email/raw phone. Lifecycle-specific errors у Credentials provider з’являються лише після правильного password, що зменшує enumeration risk для INVITED/DISABLED.

Майбутній universal client login повинен повертати однакове generic credentials повідомлення для unknown, duplicate, inactive та staff identifier, а detailed reason логувати лише server-side без identifier.

## 26. Brute-force/rate-limit considerations

У login actions/provider не знайдено rate limit, attempt counter, progressive delay або lockout. Alternative phone login збільшить identifier surface. Перед rollout потрібен server-side rate limit за IP + normalized identifier hash, загальна відповідь, захист distributed/Vercel середовища та monitoring без PII. Account lockout як єдиний механізм небажаний через DoS-ризик.

## 27. ADMIN/MANAGER isolation

Staff login зараз окремий і email-only. Це слід зберегти. Phone/tax lookup має бути доступний тільки у client action/provider branch і одразу фільтрувати `role = CLIENT`. MANAGER/ADMIN не повинні входити за phone або company code без окремого погодженого етапу.

## 28. CLIENT-only alternative login policy

Мінімальна policy:

```text
role = CLIENT
status = ACTIVE
passwordHash != null
canonical identifier maps to exactly one User
```

Duplicate/invalid identifiers мають блокувати alternative path і залишати email login доступним. JWT/session/role/authVersion checks не змінюються.

## 29. Варіант A — Email + phone

CLIENT входить за normalized email або canonical normalized User.phone + password. Staff лишається email-only.

Переваги: проста mental model, телефон персонально належить User, сумісно з поточним password owner. Ризики: потрібні backfill, cleanup одного invalid phone, unique normalized constraint і atomic sync із ClientProfile/Telegram. Складність помірна.

## 30. Варіант B — Email + phone + tax identifier

Прямий tax login можливий лише якщо tax identifier належить конкретному User, globally unique, normalized і має рівно один ACTIVE CLIENT із password. Поточна модель цим умовам не відповідає. Додавання такого mapping дублюватиме юридичні реквізити та ускладнить company membership lifecycle.

Вердикт: не рекомендується як універсальний sole identifier.

## 31. Варіант C — Company code + personal identifier

Комбінація `ЄДРПОУ/ІПН + email/phone + password` усуває ambiguity між members і може бути корисною для company-scoped login screen. Однак email/phone вже самі можуть визначити User, тому company code переважно є додатковим context/check, а не auth identity. UX і support складніші без значного security gain для поточного MVP.

## 32. Варіант D — Separate customer code

Окремий random unique customer login code відв’язаний від юридичних реквізитів і може бути rotated. Але він створює ще один credential-like identifier, recovery/support burden і schema lifecycle. Доцільний лише за підтвердженої B2B-вимоги, якої поточний flow не демонструє.

## 33. Recommended architecture

Рекомендовано **Варіант A**:

```text
CLIENT: email або унікальний canonical phone + password
ADMIN/MANAGER: тільки email + password через /admin/login
ЄДРПОУ/ІПН: реквізит Company/клієнта, не sole login identifier
```

Identifier parser спочатку визначає email vs phone. Phone lookup виконується лише за canonical User field і вимагає exactly one eligible CLIENT. Не слід шукати login identity в ClientProfile/Company/billing tables у runtime.

## 34. Required schema changes

Для implementation stage потрібне погоджене canonical поле на User. Варіанти:

- canonicalize існуючий `User.phone` та забезпечити його normalized unique semantics;
- або додати `phoneNormalized String? @unique`, залишивши display phone окремо.

Другий варіант краще зберігає формат відображення. `ClientProfile.phone` варто трактувати як mirror/display field, не auth key. Tax fields не робити login unique.

## 35. Required migration/backfill

1. Read-only inventory та export conflict IDs у захищений operational artifact, не в git/report.
2. Normalize all candidate CLIENT phones одним versioned helper.
3. Виправити invalid phone і resolve normalized duplicates вручну.
4. Backfill canonical User phone.
5. Додати unique constraint лише після zero-conflict verification.
6. Оновити registration, profile і Telegram write paths атомарно.
7. Deploy dual-read/feature flag за потреби, потім увімкнути phone login.

Поточний snapshot має 0 duplicate groups, але 1 invalid phone; cleanup все одно потрібен.

## 36. Required validation

- Єдиний parser/normalizer для Ukrainian E.164 phone.
- Reject невідомих country/length formats замість tail-only acceptance для auth.
- Canonical unique conflict check у transaction і DB constraint.
- Email lowercase/trim, phone digit canonicalization.
- Exactly-one eligible CLIENT guard.
- Generic auth error для invalid/ambiguous/inactive/staff identifiers.
- Tax fields: окремі 8-digit/10-digit validators і явний type, але не для login.

## 37. Required UI changes

Після backend/data readiness:

- label `Email або номер телефону`;
- name `identifier`, type `text`;
- `autocomplete="username"`; password `autocomplete="current-password"`;
- нейтральний placeholder з email/phone example;
- одна generic Ukrainian credentials error;
- не показувати ЄДРПОУ / ІПН як supported login;
- службову форму лишити `Email`.

## 38. Required automated checks

- Email normalization and login regression.
- Phone formats `+380`, `380`, local `0...` map to one canonical value.
- Invalid/empty/foreign/ambiguous phone rejected.
- Duplicate race handled by DB unique constraint.
- CLIENT ACTIVE + password succeeds; INVITED/DISABLED/no-password fails.
- Staff phone never works on client endpoint; staff email still works only on staff flow.
- Wrong password and unknown identifier have indistinguishable public result.
- authVersion invalidation remains effective.
- Registration/Telegram/profile update keep canonical User phone synchronized.
- Rate-limit tests and audit logs contain no raw identifier/password.

## 39. Required staging scenarios

1. Existing CLIENT enters email + password.
2. Same CLIENT enters each accepted phone display format + password.
3. Wrong password/unknown phone/invalid phone produce same error.
4. Duplicate normalized fixture blocks rollout, never chooses arbitrary User.
5. MANAGER/ADMIN phone rejected on `/login`; email works on `/admin/login`.
6. DISABLED/INVITED/stale authVersion sessions remain blocked.
7. Telegram contact link and subsequent phone login resolve the same User.
8. Company with multiple members: every member uses personal email/phone, never sole ЄДРПОУ.
9. Concurrent registration with equivalent phone formats creates at most one canonical identity.
10. Recovery/support path is documented before production activation.

## 40. Blockers

- Phone login code відсутній.
- Один invalid normalized CLIENT phone у поточному Neon snapshot.
- Registration не canonicalize phone.
- Немає DB-level normalized phone uniqueness.
- Немає auth rate limit.
- Login UI вже обіцяє unsupported identifiers.
- Tax fields не normalized/unique і не належать User.
- Company допускає multiple members, тому sole ЄДРПОУ ambiguous за дизайном.

Ці blockers не заважають окремому implementation planning, але заважають безпечному негайному ввімкненню alternative login.

## 41. Final verdict

| Питання | Вердикт |
|---|---|
| Поточний email login | SUPPORTED |
| Phone login | NOT SUPPORTED |
| ЄДРПОУ / ІПН login | NOT SUPPORTED |
| ЄДРПОУ / ІПН як sole identifier | NOT SAFE AS A SOLE IDENTIFIER |
| Data readiness для phone login | PARTIALLY SUPPORTED, потрібні cleanup/backfill/constraint |

Безпечний наступний напрямок: окремий scoped stage для CLIENT `email або canonical unique phone + password`, зі staff email-only boundary. ЄДРПОУ / ІПН слід залишити юридичним реквізитом або, за окремої вимоги, використовувати лише разом із персональним identifier, але не як єдиний логін.

Prisma schema/migrations/auth production logic у цьому audit не змінювались.
