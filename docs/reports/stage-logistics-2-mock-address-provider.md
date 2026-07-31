# Kairos Parts — Stage Logistics 2

## 1. Мета етапу

Stage Logistics 2 створює ізольований provider-neutral фундамент адресного autocomplete для Kairos Logistics: normalized contracts, централізовані tariff city definitions, deterministic `MockAddressProvider`, synthetic fixtures, backend autocomplete/resolve endpoints і перевірки scope. Публічна форма, pricing, persistence та зовнішні providers не входять до етапу.

## 2. Початковий Git-стан

- Активна гілка: `develop`.
- Stage Logistics 1 commit `85fb63a4045ee51af211a204d75568266be8cf78` присутній.
- `/logistics` уже існував, `/logistics/request` був відсутній.
- Staging перед початком був порожній.
- Worktree містив погоджені сторонні unstaged/untracked зміни паралельної роботи.
- `package.json` мав сторонній diff, тому не редагувався і не додавався до staging.
- Наявні цільові файли `.env.example` і `lib/routes.ts` були перевірені через `git diff -- <path>` та не мали сторонніх змін.

## 3. Provider-neutral architecture

Core contract не залежить від Google, БД, UI або pricing. Route handlers приймають лише normalized request, server-side resolver обирає provider, service layer повторно валідовує input і повертає bounded DTO.

```text
POST route
  → bounded JSON reader
  → input/scope validation
  → server-only provider resolver
  → MockAddressProvider
  → normalized response
```

`provider-factory.ts` захищений `server-only`. Frontend не обирає provider і не отримує fixture registry або raw provider payload.

## 4. Tariff city definitions

`lib/logistics/tariff-cities.ts` централізує 13 stable codes, display names і normalized locality:

- `MYRONIVKA`;
- `OBUKHIV`;
- `UZYN`;
- `VASYLKIV`;
- `BILA_TSERKVA`;
- `BORYSPIL`;
- `KYIV_RIGHT_BANK`;
- `KYIV_LEFT_BANK`;
- `BROVARY`;
- `IRPIN`;
- `BUCHA`;
- `BEREZAN`;
- `VYSHHOROD`.

Ціни не додавалися. Fixtures і provider використовують exported constants, а не дублюють city codes.

## 5. Address contracts

Фактичний normalized contract:

```ts
type LogisticsAddressProviderKind = 'MOCK' | 'GOOGLE';

type LogisticsAddressScope =
  | { type: 'TARIFF_CITY'; tariffCityCode: LogisticsTariffCityCode }
  | { type: 'KAHARLYK_COMMUNITY' };

type LogisticsAddressSuggestion = {
  externalAddressId: string;
  formattedAddress: string;
  normalizedLocality: string;
  normalizedAdministrativeArea?: string;
  addressProvider: LogisticsAddressProviderKind;
};

type LogisticsResolvedAddress = LogisticsAddressSuggestion;
```

Provider interface має лише `autocomplete()` і `resolve()`. Контракт не містить coordinates, map URL, route data, raw payload або Google-specific fields.

## 6. MockAddressProvider

`MockAddressProvider`:

- не використовує network, БД або environment secrets;
- виконує case-insensitive Unicode-normalized substring search;
- фільтрує fixtures за scope до пошуку;
- стабільно сортує результати;
- обмежує результат максимум вісьмома suggestions;
- resolve-ить лише відомий opaque ID;
- повторно перевіряє scope під час `resolve()`;
- повертає лише normalized DTO.

## 7. Synthetic fixtures

Створено по два synthetic fixtures для кожного tariff city locality, спільні київські fixtures для обох bank contexts і два test-only community fixtures для Кагарлика.

Fixtures:

- не заявляються як реальні адреси;
- не містять клієнтських даних;
- не містять приватних контактів;
- не називають реальних постачальників або компанії;
- не містять тарифів;
- використовують stable opaque IDs виду `mock:*`.

## 8. City validation

`TARIFF_CITY` приймає лише один із централізованих codes. Autocomplete не повертає fixtures іншого city context. `resolve()` розрізняє:

- невідомий opaque ID — `ADDRESS_NOT_FOUND`, HTTP `404`;
- відомий ID іншого scope — `ADDRESS_SCOPE_MISMATCH`, HTTP `422`.

Unknown tariff city відхиляється до виклику provider з `UNKNOWN_TARIFF_CITY`.

## 9. Kyiv MVP behavior

`KYIV_RIGHT_BANK` і `KYIV_LEFT_BANK` залишаються окремими tariff city values, але обидва мають `normalizedLocality = "Київ"` і використовують один набір synthetic Kyiv fixtures. Backend не визначає берег, не змінює вибір користувача й не використовує геопросторові дані. Fixture Броварів не приймається як Київ.

## 10. Кагарлицька громада mock coverage

Scope `KAHARLYK_COMMUNITY` підтримує лише synthetic fixtures із locality `Кагарлик`. Це test-only mock coverage, а не повний офіційний allowlist громади. Canonical address бази Kairos Parts не використано як farm fixture.

Production allowlist населених пунктів Кагарлицької громади має бути окремо погоджений до Stage 10.

## 11. Backend autocomplete endpoint

Реалізовано:

```text
POST /api/logistics/addresses/autocomplete
```

Endpoint приймає `query` і `scope`, контролює JSON media type та payload size, trim-ить query, застосовує межі `3..160` символів і server-owned limit `8`. Browser-provided limit або provider kind не є authoritative.

Успішна відповідь:

```json
{
  "suggestions": []
}
```

## 12. Backend resolve endpoint

Реалізовано:

```text
POST /api/logistics/addresses/resolve
```

Endpoint приймає лише bounded `externalAddressId` і `scope`. `formattedAddress` із browser не використовується як trusted input. Успішна відповідь:

```json
{
  "address": {
    "externalAddressId": "mock:...",
    "formattedAddress": "...",
    "normalizedLocality": "...",
    "normalizedAdministrativeArea": "...",
    "addressProvider": "MOCK"
  }
}
```

## 13. Validation і error contracts

Фактичні error codes:

- `INVALID_REQUEST`;
- `QUERY_TOO_SHORT`;
- `QUERY_TOO_LONG`;
- `INVALID_ADDRESS_SCOPE`;
- `UNKNOWN_TARIFF_CITY`;
- `ADDRESS_NOT_FOUND`;
- `ADDRESS_SCOPE_MISMATCH`;
- `ADDRESS_PROVIDER_DISABLED`;
- `ADDRESS_PROVIDER_UNAVAILABLE`.

JSON body обмежено `8 KiB`. Некоректний media type, malformed JSON, array/non-object payload і завеликий body повертають safe `400`. Error envelope містить лише `code` і bounded message, без stack trace, path, environment value або fixture internals.

## 14. Provider configuration

Server-only variable:

```text
LOGISTICS_ADDRESS_PROVIDER=mock
```

додано до `.env.example` без actual value. Значення не має prefix `NEXT_PUBLIC_`.

- Відсутнє або порожнє значення → `ADDRESS_PROVIDER_DISABLED`, HTTP `503`.
- Explicit `mock` → `MockAddressProvider`.
- `google` або інше unsupported значення → `ADDRESS_PROVIDER_UNAVAILABLE`, HTTP `503`.

`GooglePlacesAddressProvider` не створювався.

## 15. Feature/environment gating

Mock API виконує operation лише за explicit server configuration `LOGISTICS_ADDRESS_PROVIDER=mock`. Без opt-in endpoint залишається disabled. Це дозволяє local/test/staging smoke і не вмикає mock автоматично в production.

`LOGISTICS_LANDING_ENABLED` лишився `true`, `LOGISTICS_REQUEST_FORM_ENABLED` лишився `false`. Provider configuration не змінює CTA і не створює form route.

На Stage 10 server resolver має отримати реальний Google provider implementation і production configuration, не змінюючи public normalized API contract.

## 16. Rate-limit status

Generic production-grade limiter у репозиторії не знайдено. Наявний DB-backed limiter є credentials-specific і не перевикористовувався. Prisma schema та login rate-limit semantics не змінювалися.

Stage 2 endpoints захищені explicit mock configuration, `8 KiB` payload limit, query length bounds і result limit. Це не заявляється як production rate-limit guarantee.

Persistent multi-instance autocomplete rate limiting із `429`/`Retry-After` залишається обов’язковою залежністю до публічного запуску форми на Stage 3/5 security integration.

## 17. Security і privacy

- Повні query, address, external ID і request body не логуються.
- Provider визначається лише server-side.
- Provider raw payload та fixture registry не потрапляють у response.
- Responses мають `Cache-Control: no-store`.
- Routes підтримують лише `POST`; інші methods отримують стандартний `405`.
- Network requests відсутні.
- Synthetic fixtures не містять PII.

## 18. Automated tests

Створено `scripts/check-logistics-address-provider.ts`. Через сторонній diff у `package.json` script запускається напряму:

```text
npx.cmd --no-install tsx scripts/check-logistics-address-provider.ts
```

Результат:

```text
logisticsAddressProvider=PASS cities=13 errorCodes=9
```

Покрито city uniqueness/display names, Kyiv mapping, search normalization, deterministic order, city/community isolation, server-owned limit, unknown city, resolve success/not-found/mismatch, Ірпінь/Буча, обидва Kyiv contexts, community boundaries, normalized contract, відсутність coordinates, invalid JSON/content type/payload size і safe unexpected error.

## 19. Manual/API smoke tests

Local Next.js dev server запускався без зовнішньої мережі у двох режимах.

Disabled mode:

- valid autocomplete → HTTP `503`, `ADDRESS_PROVIDER_DISABLED`.

Explicit mock mode:

- Миронівка autocomplete → HTTP `200`, лише `Миронівка`;
- Біла Церква autocomplete → HTTP `200`, без Києва;
- Ірпінь і Буча → окремі результати;
- одна Kyiv address доступна для обох bank contexts;
- cross-city resolve → HTTP `422`;
- unknown ID → HTTP `404`;
- community resolve → HTTP `200`;
- tariff city fixture у community scope → HTTP `422`;
- query коротше трьох символів → HTTP `400`;
- unknown city → HTTP `400`;
- invalid JSON і content type → HTTP `400`;
- `GET` autocomplete → HTTP `405`;
- response не містить coordinates;
- `/logistics` → HTTP `200`;
- `/logistics/request` → HTTP `404`;
- обидва landing CTA залишилися disabled і не мають link на form route.

Live production та external network tests не виконувалися. Тимчасові QA servers зупинено.

## 20. Змінені файли

- `.env.example`;
- `app/api/logistics/addresses/autocomplete/route.ts`;
- `app/api/logistics/addresses/resolve/route.ts`;
- `lib/logistics/tariff-cities.ts`;
- `lib/logistics/address-provider/contracts.ts`;
- `lib/logistics/address-provider/errors.ts`;
- `lib/logistics/address-provider/fixtures.ts`;
- `lib/logistics/address-provider/mock-provider.ts`;
- `lib/logistics/address-provider/provider-factory.ts`;
- `lib/logistics/address-provider/responses.ts`;
- `lib/logistics/address-provider/service.ts`;
- `lib/logistics/address-provider/validation.ts`;
- `lib/routes.ts`;
- `scripts/check-logistics-address-provider.ts`;
- `docs/reports/stage-logistics-2-mock-address-provider.md`.

## 21. Перевірки

- `git diff --check` для Stage Logistics 2 files: пройдено.
- `npx.cmd --no-install tsx scripts/check-logistics-address-provider.ts`: пройдено.
- `npm.cmd run lint`: пройдено.
- `npm.cmd run typecheck`: пройдено.
- `npm.cmd run build`: пройдено.
- Build route table містить обидва dynamic Logistics API routes і static `/logistics`.
- Build route table не містить `/logistics/request`.
- `package.json` не редагувався цим етапом.

## 22. Відомі обмеження

- Mock fixtures є synthetic і не забезпечують production address verification.
- Production allowlist Кагарлицької громади ще не затверджений.
- Mock community coverage обмежена Кагарликом.
- Google provider і production credentials відсутні.
- Persistent production rate limit ще не реалізований.
- Address UI та form integration відсутні.

## 23. Межі Stage Logistics 2

Не створено й не змінено:

- `/logistics/request`, address input UI, combobox або public form;
- тарифні ціни, tariff engine або калькулятор;
- Prisma schema, migration або БД;
- logistics request models, CRM або CLIENT pages;
- Google API, key, SDK, map або coordinates;
- Telegram integration;
- чинний клієнтський Telegram-бот;
- staff Telegram-бот;
- parts notification logic;
- auth/login rate limiter;
- production environment.

Stage Logistics 3 не починався. Сторонні паралельні файли не входять до Stage Logistics 2.

## 24. Readiness for Stage Logistics 3

Provider-neutral types, reusable city definitions, mock validation service, backend endpoints і test harness готові для наступного окремо погодженого етапу. Persistent public rate limiting та повний production community allowlist залишаються rollout dependencies, але не блокують архітектурну роботу Stage Logistics 3.

Blocker для початку Stage Logistics 3 не виявлено.
