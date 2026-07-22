# Stage Client Auth 2D — маска телефону у формах реєстрації

## 1. Симптом

На `/register` значення `0730031900` залишалося сирим, хоча `/login` відображав той самий номер як `+38 (073) 003-19-00`.

## 2. Root cause

Registration використовував uncontrolled `<input type="tel">` без client formatter. Login уже використовував shared `lib/phone/client-format.ts`, але registration component його не імпортував.

## 3. Registration components

Route: `app/(auth)/register/page.tsx`. Обидва account types рендерить один client component `app/(auth)/register/register-form.tsx`. Tabs змінюють лише business/individual fields; phone input один і розташований після умовного блоку.

## 4. Login formatter reuse

Registration напряму перевикористовує `formatPhoneIdentifierInput`, `getLocalDigitCountBeforeCaret`, `getPhoneCaretPosition` і `removeMaskedPhoneDigit`, які вже використовує login. Login component та його поведінка не змінювалися.

## 5. Shared formatter location

Client-safe formatter залишається у `lib/phone/client-format.ts`. Server normalization окремо залишається у `lib/phone/normalize.ts`.

## 6. Physical registration changes

Для `INDIVIDUAL` phone input став controlled, отримав mask, caret restoration, Backspace/Delete handling, alphabetic rejection, fixed pattern і incomplete-submit validation.

## 7. FOP/legal registration changes

Для `BUSINESS` працює те саме спільне поле та той самий state/handlers. Business fields, tax validation і account-type logic не змінювалися.

## 8. Display format

Local, canonical і formatted paste відображаються як `+38 (0XX) XXX-XX-XX`. Поле має `type="tel"`, `inputMode="tel"`, `autoComplete="tel"` і відповідний placeholder. Максимум — 10 local digits; зайві digits обрізаються.

## 9. Canonical server value

Form submit передає formatted display value. `registerClient` обов'язково повторно виконує `normalizeUkrainianPhone(rawPhone)` і отримує `+380XXXXXXXXX`. Client mask не є security validation.

## 10. Raw phone storage policy

Audit показав, що чинний Server Action уже зберігав не випадковий raw input, а normalized variable `phone`. Тому storage policy не змінювалася: `User.phone` і `ClientProfile.phone` містять canonical `+380XXXXXXXXX`.

## 11. normalizedPhone synchronization

Під час одного `prisma.user.create` значення canonical `phone` записується у `User.phone`, `User.normalizedPhone` і nested `ClientProfile.phone`. Schema та migrations не змінювалися.

## 12. Duplicate handling

`0730031900`, `+380730031900` і `+38 (073) 003-19-00` нормалізуються в один key. Pre-check шукає `normalizedPhone: phone`; race додатково перехоплюється через Prisma `P2002`. Обидва шляхи повертають контрольований `register?error=exists`, не generic 500.

## 13. Automated checks

Додано `scripts/check-client-auth-2d.ts`: format/paste variants, truncation, incomplete value, alphabetic input, Backspace, Delete, canonical submit/storage source contracts, duplicate variants і покриття обох tabs. Скрипт не створює Neon records.

## 14. Browser smoke

Локальний production build: PASS для business local input, canonical paste, Backspace, physical-tab input, incomplete submit block, alphabetic rejection, `inputMode`/autocomplete/pattern і server-side validation redirect із mismatched passwords. Console порожня; permanent account не створювався. Delete окремо підтверджений automated helper test. Окремий mobile viewport і duplicate-account browser submit не виконувалися; mobile keyboard attributes підтверджені, duplicate path підтверджений source/normalization regression.

## 15. Prisma, typecheck, lint і build

PASS: `check-client-phone-validation`, Client Auth 2B.1/2C/2D, Prisma validate/generate/status, typecheck, lint і production build (46/46 pages). Client Auth 2C: concurrency PASS, test buckets `0`. `check-client-auth-2b.ts` має upstream blocker після commit `ec20a22`: застарілий source-regex очікує стару форму Telegram create, тоді як поточний `linkTelegramClient` canonical-синхронізує `ClientProfile.phone`, `User.phone` і `User.normalizedPhone` через nested update. Stage 2D цей test або Telegram code не змінює.

## 16. Remaining risks

Потрібен staging smoke на реальному mobile viewport. Duplicate UI слід перевірити staging test account, не створюючи локальний persistent fixture. Mask intentionally підтримує лише український формат. Окремо слід оновити stale Telegram source assertion у `check-client-auth-2b.ts` у межах Telegram/Auth regression maintenance.

## 17. Final status

`IMPLEMENTED — LOCAL VERIFIED; UPSTREAM 2B ASSERTION AND MOBILE/DUPLICATE STAGING SMOKE REMAIN`.
