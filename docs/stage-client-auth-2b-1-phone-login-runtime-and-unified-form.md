# Stage Client Auth 2B.1 — phone login runtime, unified form і phone mask

## 1. Мета

Встановити причину `CredentialsSignin`, уніфікувати `/login`, додати безпечну UX-маску українського номера та зберегти server-side canonical normalization.

## 2. Production symptom

Після введення CLIENT phone identifier Auth.js повертав `CredentialsSignin`, а UI переходив на `/login?error=credentials`.

## 3. Інтерпретація CredentialsSignin

Це контрольований результат credentials provider, коли `authorize` повертає `null`; сам по собі він не доводить infrastructure crash.

## 4. Exact root cause

Read-only lookup для переданого smoke/example identifier повернув `exactMatchCount=0`. Для цього identifier `authorize` не знаходить `User`, виконує dummy password verification і повертає `null`. Це точна причина зафіксованого `CredentialsSignin` для перевіреного значення. Якщо production smoke використовував інший identifier, потрібен повторний protected audit через `KAIROS_AUTH_TEST_PHONE`.

## 5. Problematic files

- `app/(auth)/login/login-form.tsx` містив непотрібний CLIENT type switch і не мав phone-mask UX.
- `app/(auth)/actions.ts` передавав raw/formatted identifier у `signIn`; provider нормалізував його коректно, але contract тепер додатково canonicalized перед Auth.js.
- Дані: для перевіреного identifier відсутній matching `User`.

## 6. Form field contract before fix

Форма вже надсилала `identifier`, `password`, optional `next`; switch був локальним UI state і не входив у submit.

## 7. Credentials provider contract before fix

Provider уже оголошував і читав `identifier`, `password`, `loginScope`. Field-name mismatch не знайдено.

## 8. Role of account type switch

Switch був лише візуальним: не змінював schema, action, credentials, lookup або redirect. Його видалено.

## 9. Legacy ЄДРПОУ login remnants

У login form більше немає `ЄДРПОУ`, `taxId`, `accountType` або окремих CLIENT modes. Реєстраційні юридичні реквізити не змінювалися.

## 10. Exact data verification

Aggregate Neon audit: CLIENT total `5`, з `normalizedPhone` `5`, missing `0`, invalid `0`, duplicate groups `0`, ACTIVE без password hash `0`, invalid `authVersion` `0`. Protected exact lookup для перевіреного identifier: match `0`.

## 11. Password verification result

`NOT_RUN`: matching account відсутній, а test password не надано. Hash або password не виводилися.

## 12. Unified login architecture

Одна форма приймає email або український phone identifier. Account context визначається після authentication, не через UI switch.

## 13. Registration remains split

`/register` і `registerClient` зберігають `BUSINESS` / `INDIVIDUAL` flow без архітектурних змін.

## 14. Login type switch removal

Кнопки `ФОП / Юр особа` і `Фіз особа` видалені тільки з `/login`.

## 15. Identifier label change

Label: `Email або номер телефону`. Placeholder: `name@example.com або +38 (0XX) XXX-XX-XX`.

## 16. Identifier contract

UI name, Server Action, `signIn`, Credentials provider і `authorize` використовують `identifier`. Phone mask відображає formatted value; Server Action повторно перетворює його на canonical перед `signIn`.

## 17. CLIENT email lookup

Email trim/lowercase виконується parser-ом; lookup має exact `role=CLIENT` + `email`.

## 18. CLIENT phone lookup

Local, canonical і formatted inputs нормалізуються до `+380XXXXXXXXX`; lookup має exact `role=CLIENT` + `normalizedPhone`. Raw/partial fallback відсутній.

## 19. ADMIN isolation

ADMIN дозволено лише у `STAFF` scope за exact email. Phone у STAFF scope parser відхиляє.

## 20. MANAGER isolation

MANAGER дозволено лише у `STAFF` scope за exact email. Phone у STAFF scope parser відхиляє.

## 21. Status, password і authVersion checks

Збережено password hash verification, `ACTIVE` guard, role/scope guard та JWT `authVersion` validation.

## 22. Generic errors

Public CLIENT UI не розкриває існування account, role, status або password result і показує одну credentials error.

## 23. Post-login routing

CLIENT redirect залишається `/client` або allowlisted `/client...` / `/request...`; external `next` відхиляється. Staff routing не змінювався.

## 24. CompanyMember behavior

Login більше не питає company/person type. `CompanyMember` relations і cabinet permissions не змінювалися.

## 25. Automated checks

`check-client-login-phone-mask`, `check-client-auth-2b` і `check-client-auth-2b-1` покривають normalization, email isolation, mask/paste, digit cap, incomplete phone, role policy та source contracts.

## 26. Admin auth regression

Stage 2B fixture checks підтверджують ADMIN/MANAGER email scope і відмову staff phone login. Повний Admin Users 2A–2D запускається у verification bundle.

## 27. Prisma validate, generate і status

`prisma validate`: PASS. `prisma generate`: PASS. `prisma migrate status`: database schema up to date, migration `20260721190000_add_user_normalized_phone` applied.

## 28. Typecheck

`npm.cmd run typecheck`: PASS.

## 29. Lint

`npm.cmd run lint`: PASS.

## 30. Build

`npm.cmd run build`: PASS, 46/46 static pages generated; `/login` compiled як dynamic route.

## 31. git diff --check

PASS після фінального diff review.

## 32. Local browser smoke

PASS для локального production build: unified UI, local/canonical/formatted phone display, digit cap, email isolation, Backspace/caret, incomplete native constraint, complete phone validity та console без errors. `Delete` у середині номера підтверджено pure-helper regression; browser driver не дозволив надійно пересунути caret клавішею для окремого DOM assertion.

## 33. Staging browser smoke

Не виконано: потрібні deploy і реальний staging test account. Production/staging PASS не заявляється.

## 34. Persistent rate-limit blocker

Stage Client Auth 2C не розпочинався. Persistent rate limiting залишається окремим release blocker.

## 35. Remaining risks

- Перевірений example identifier не має matching user.
- Password verification і реальний successful phone login не підтверджені.
- Staging DOM/auth smoke після deploy ще потрібен.

## 36. Release status

`NOT READY — TEST ACCOUNT DATA BLOCKER`. Після надання matching ACTIVE CLIENT і успішного local/staging smoke статус можна переглянути; rate-limit blocker залишається.

## 37. Final verdict

UI/identifier contract виправлено й автоматично перевірено. Production phone login не можна вважати виправленим для переданого identifier, бо відповідного account у Neon немає.
