# Kairos Parts — Stage Logistics 5

## 1. Мета етапу

Stage Logistics 5 переводить public форму перевезення з preview-only стану в
реальний server-controlled flow: authoritative pricing, guest/CLIENT submit,
повторна перевірка адрес, idempotency, атомарне створення заявки та безпечний
success state.

CRM, CLIENT Logistics cabinet, Google Places, Telegram і production rollout до
цього етапу не входять.

## 2. Початковий Git-стан

- Активна гілка: `develop`.
- Staging був порожній.
- Stage Logistics 4A commit `5b29c990a834713b538e9da5c606f075719d1ee9`
  присутній в історії.
- На початку Stage 5 Logistics business tables не містили заявок.
- Сторонні worktree-файли не редагувалися і не включаються до Stage 5 commit.

## 3. Staging DB readiness

Перед DB integration була перевірена підтверджена Vercel/`develop` Neon DB
`neondb` через `DATABASE_URL_UNPOOLED`: 42 migrations, schema up to date,
pending/failed migrations відсутні. Початкові `LogisticsRequest`,
`LogisticsPickupPoint` та `LogisticsInternalComment` мали count `0`;
`LogisticsTariffCity` містила 13 записів.

Повторний `prisma migrate status` після перерваного локального QA-процесу
завершився локальною Windows TLS/Schema Engine помилкою до будь-якого write.
Це не змінило раніше підтверджений migration state. Перед наступним staging
runtime smoke status треба повторно перевірити з робочого staging runner.

## 4. Feature gates

- `LOGISTICS_LANDING_ENABLED = true`.
- `LOGISTICS_REQUEST_FORM_ENABLED` має safe default `false`.
- `LOGISTICS_REQUEST_SUBMIT_ENABLED` має окремий safe default `false`.
- Увімкнення form або provider `mock` не активує submit автоматично.
- Create API повторно перевіряє обидва server-only gates.
- При disabled submit UI лишає кнопку disabled, API повертає safe `503`, DB
  writes не виконуються.
- Actual Vercel/VPS environment variables не змінювалися.

## 5. Authoritative pricing service

`lib/logistics/pricing.ts` реалізує pure calculation через `Prisma.Decimal`:

```text
totalPrice =
  active city tariff
  + max(0, pickupPointCount - 1) × 500.00
  + (destinationType === FARM ? 500.00 : 0)
```

Перша точка входить у тариф, VAT повторно не нараховується, browser total не
приймається. Shared constants знаходяться в `lib/logistics/constants.ts`.

## 6. Tariff lookup

`lib/logistics/tariff-service.ts` приймає тільки централізований city code,
повторно читає `LogisticsTariffCity`, вимагає `isActive = true` і повертає
мінімальний набір `id`, `code`, `name`, `price`. Client name/price не trusted.

Safe codes: `UNKNOWN_TARIFF_CITY`, `TARIFF_CITY_INACTIVE`,
`TARIFF_UNAVAILABLE`.

## 7. Quote API

`POST /api/logistics/quote`:

- доступний guest і CLIENT лише при enabled form gate;
- приймає city code, pickup count і destination;
- використовує current DB tariff та authoritative pricing;
- повертає money як decimal strings з двома знаками;
- встановлює `Cache-Control: no-store`;
- не приймає PII, addresses, ownership, provider або browser price;
- не виконує DB writes.

## 8. Quote integration у форму

Local preview лишається instant UX. Після debounce форма запитує server quote
через `AbortController`; будь-яка зміна city/count/destination робить старий
quote stale. Submit readiness потребує актуального успішного quote.

Displayed final total береться із server quote, але create endpoint все одно
повторно читає тариф і рахує суму.

## 9. Optional session і identity resolution

`lib/logistics/access.ts` використовує чинні auth/current-user/client access
patterns:

- no session → `GUEST`, `clientId = null`, `companyId = null`;
- valid CLIENT → current user/profile та personal/company context визначаються
  server-side;
- stale/invalid authenticated context не перетворюється непомітно на guest;
- ADMIN/MANAGER отримують `403 STAFF_SUBMIT_FORBIDDEN`.

Frontend не передає trusted role, user/client/company IDs.

## 10. Guest submit

Guest request зберігає canonical contact phone, але ownership лишається null.
Збіг телефону з чинним CLIENT не привласнює guest request клієнту.

## 11. CLIENT submit і ownership

Для CLIENT `clientId`/`companyId` походять тільки з server-resolved context.
Payload ownership ігнорується. Rollback integration перевірила synthetic CLIENT
і company context без використання реального клієнта або реальної PII.

## 12. Staff submit denial

ADMIN/MANAGER session відхиляється як staff, а не обробляється як guest.
Route повертає safe `403 STAFF_SUBMIT_FORBIDDEN` до створення business record.
Live authenticated staff browser smoke відкладений.

## 13. Request validation

Create route перевіряє:

- `application/json` і bounded body;
- object payload, UUID idempotency key та honeypot;
- один із 13 city codes;
- 1–20 pickup points як technical safety bound;
- bounded non-empty cargo/contact/comment strings;
- canonical Ukrainian phone;
- valid destination та required FARM external address;
- тільки external address IDs, без free-text trusted snapshots.

Невідомі browser total, provider та ownership не використовуються.

## 14. Server-side address verification

`lib/logistics/request-service.ts` повторно resolve-ить кожну pickup address через
активний provider у `TARIFF_CITY` scope та перевіряє вибране місто. FARM address
повторно resolve-иться в `KAHARLYK_COMMUNITY` scope. У DB потрапляють тільки
server-resolved snapshots.

## 15. Canonical base address

Для `KAIROS_BASE` server snapshot задається централізовано:
`м. Кагарлик, вул. Миронівська, 33д`. Для `FARM` base snapshot відсутній, а
farm snapshot походить із server resolve.

## 16. Phone normalization

Create route використовує чинний `normalizeUkrainianPhone`; canonical формат —
`+380XXXXXXXXX`. Client-side mask є лише UX і не є джерелом істини.

## 17. Idempotency

`idempotencyKey` має DB unique constraint. До create виконується lookup і повне
порівняння identity та business intent. Однаковий retry повертає той самий
`requestNumber`, `totalPrice`, `status`; конфліктний payload або інша identity
отримує `409 IDEMPOTENCY_CONFLICT`. `P2002` race обробляється повторним lookup.

## 18. Rate-limit status

Quote/create мають staging defense-in-depth limiter з HMAC IP та
phone/user-derived keys, без raw PII у bucket keys. Реалізація process-local і
не є persistent/distributed production limiter.

Тому safe submit default лишається `false`. Persistent shared limiter є
обов'язковим release gate перед public production rollout, але не блокує
розробку Stage Logistics 6.

## 19. Create transaction

Одна Prisma transaction атомарно:

1. перевіряє idempotency;
2. створює `LogisticsRequest` зі status `NEW`;
3. створює всі `LogisticsPickupPoint`;
4. записує create event в `AuditLog`.

Помилка до commit не залишає partial request/points/audit.

## 20. AuditLog integration

Додано Logistics audit contracts. Create event:

- entity/action: `LOGISTICS_REQUEST` / `LOGISTICS_REQUEST_CREATED`;
- category: `STANDARD`;
- actor: authenticated CLIENT або anonymous;
- payload містить лише safe request number, source, tariff city code, counts,
  destination, total і VAT marker.

Raw phone, full addresses, cargo, comment, idempotency key та provider response
не потрапляють в audit payload.

## 21. Success response і UI

Create API повертає `201` та safe result:
`requestNumber`, authoritative decimal `totalPrice`, `status`.

Success panel показує номер, фактичну суму та status, переводить focus на
heading і не надає guest detail URL. Double-click/pending state блокує повторне
надсилання; retry додатково захищений server idempotency.

## 22. API error contracts

Реалізовані safe envelopes для gate, payload, city/tariff, destination,
pickup/contact, address/provider, staff, idempotency, rate-limit, quote і create
failures. HTTP semantics: `400`, `403`, `409`, `422`, `429`, `503`, safe `500`.
Prisma/SQL/stack/env/raw payload не повертаються.

## 23. Security і privacy

Create flow має server gates, strict JSON/bounds, same-origin Origin check,
honeypot, optional session validation, staff denial, HMAC rate keys,
idempotency, server ownership/address/tariff/price та no-store responses.

Форма не використовує localStorage/cookies/PII analytics. Server code не логує
contact, phone, addresses, cargo, comment, idempotency key або raw body.

## 24. No-Telegram boundary

Telegram services/templates/triggers/token/chat і чинний клієнтський bot не
змінювалися. Staff bot не створено. `Notification` records не створюються, а
submit не залежить від Telegram.

## 25. Automated tests

`scripts/check-logistics-request-creation.ts` перевіряє pricing cases,
preview/server parity, bounds, identity/staff policy, ownership, idempotency,
safe audit payload, transaction behavior та optional rollback integration.

Static result:

```text
logisticsRequestCreation=PASS cities=13 pricingCases=5 integration=skipped
```

## 26. Staging integration verification

На підтвердженій direct/unpooled Vercel `develop` Neon DB integration script
пройшов:

```text
logisticsRequestCreation=PASS cities=13 pricingCases=5 integration=rollback
```

У контрольованій transaction перевірено guest create, synthetic CLIENT/company
ownership, tariff/point/FARM snapshots, final price, request number, status
`NEW`, AuditLog, retry/conflict та відсутність Notification. Sentinel rollback
спрацював; post-check business counts лишилися `0`. Sequence gap допустимий.

## 27. Browser/API smoke

До зупинки локального QA підтверджено:

- `/logistics` відкривається;
- CTA має route `/logistics/request`;
- request form відкривається;
- guest contact fields порожні;
- submit disabled до readiness.

Після переривань локальний Next/Prisma runtime отримав Windows TLS error на
tariff lookup. За прямою вказівкою замовника dev-server більше не запускався,
listener `3015` зупинено, browser/API smoke за рештою сценаріїв відкладено для
ручної перевірки. Persistent records під час browser QA не створювалися.

## 28. Regression checks

```text
logisticsAddressProvider=PASS cities=13 errorCodes=9
logisticsPersistenceFoundation=PASS models=4 cities=13 constraints=7
logisticsRequestForm=PASS cities=13 formulaCases=5 submit=gated
```

Stage 2 address contract, Stage 3 schema/migration та Stage 4 UX збережені.
Parts flows/navigation/notifications не змінювалися.

## 29. Змінені файли

```text
.env.example
app/(public)/logistics/request/page.tsx
app/api/logistics/quote/route.ts
app/api/logistics/requests/route.ts
components/public/logistics/logistics-request-form.tsx
lib/audit-log/contracts.ts
lib/features/logistics.ts
lib/logistics/access.ts
lib/logistics/constants.ts
lib/logistics/create-request.ts
lib/logistics/pricing-preview.ts
lib/logistics/pricing.ts
lib/logistics/request-errors.ts
lib/logistics/request-input.ts
lib/logistics/request-responses.ts
lib/logistics/request-security.ts
lib/logistics/request-service.ts
lib/logistics/tariff-service.ts
scripts/check-logistics-request-creation.ts
scripts/check-logistics-request-form.ts
docs/reports/stage-logistics-5-server-pricing-request-creation.md
```

## 30. Перевірки

- Stage 2 regression: PASS.
- Stage 3 regression: PASS.
- Stage 4 regression: PASS.
- Stage 5 static: PASS.
- Stage 5 DB transaction: PASS with rollback.
- `prisma validate`: PASS.
- `prisma generate`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS; quote/create routes включені.
- `git diff --check`: PASS до staging.
- Повний responsive/browser/API smoke: deferred за вказівкою замовника.

## 31. Відомі обмеження

- Process-local rate limiter не замінює persistent shared limiter.
- Browser/API smoke, authenticated CLIENT prefill, live staff `403`, success
  panel і responsive widths `320/390/768/1024/1440` потребують manual QA.
- Повторний local `prisma migrate status` потребує runner без Windows TLS
  Schema Engine проблеми.
- Mock provider лишається staging-only; Google Places не підключено.
- Guest не має public detail URL.

## 32. Межі Stage Logistics 5

Не змінювалися Prisma schema/migrations, 13 tariff records, production DB/VPS,
Vercel variables, Google, maps, coordinates, Telegram, Notification logic,
parts flow, CRM/CLIENT navigation. Не створено CRM, CLIENT Logistics cabinet,
tariff admin, status/comment API або Stage Logistics 6.

## 33. Readiness for Stage Logistics 6

Domain/API/persistence foundation для наступного етапу готовий. Відкладений
manual browser smoke та persistent limiter є QA/release gates перед public
production rollout, але архітектурного blocker для початку Stage Logistics 6 не
виявлено.
