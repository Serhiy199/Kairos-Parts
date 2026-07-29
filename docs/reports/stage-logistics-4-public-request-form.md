# Kairos Parts — Stage Logistics 4

## 1. Мета етапу

Stage Logistics 4 додає preview-only публічну форму `/logistics/request`: тарифне місто, динамічні точки відвантаження, підтвердження адрес через Stage 2 API, напрямок доставки, контактні дані та live VAT-inclusive розрахунок. Етап не створює логістичну заявку і не змінює БД.

## 2. Початковий Git-стан

- Активна гілка: `develop`.
- Stage Logistics 3 commit `42919844a01a573365f76b778ae04539fbbbaef8` присутній в історії.
- Staging на повторному старті був порожній.
- Stage 3 migration залишалася unapplied; DB-connected команди не виконувалися.
- Worktree містив відновлений незавершений Stage 4 diff. Паралельні `package.json` і `docs/reports/stage-request-status-automation-5a3b-logistics-build-stabilization.md` не редагувалися та не включаються до Stage 4.

## 3. Public route і feature gates

Створено App Router route `/logistics/request` у чинній public route group без окремого layout. `LOGISTICS_REQUEST_FORM_ENABLED` читається лише на сервері, має safe default `false` і вимагає точного значення `true`. При вимкненому gate route викликає `notFound()`. `LOGISTICS_REQUEST_SUBMIT_ENABLED` зафіксований як `false` і не керується environment.

Metadata: title і description за контрактом, canonical через чинний `buildAbsoluteUrl`, `robots: noindex, nofollow`.

## 4. Guest/CLIENT-aware initial values

Форма доступна гостю та будь-якій ролі лише для перегляду. Початкові ім’я і телефон порожні. CLIENT prefill не підключено: optional `auth()` у локальному QA спричиняв небажану перевірку session через БД, тому для строгого Stage 4 no-DB boundary його прибрано. Безпечний CLIENT prefill лишається Stage 5 integration dependency. Staff identity не підставляється.

## 5. Form architecture

Server page відповідає за metadata, feature gate і safe initial props. `LogisticsRequestForm` керує лише локальним React state. Форма складається з тарифного міста, pickup points, destination, контактів, коментаря і price summary.

## 6. Tariff city select

Select використовує централізований `LOGISTICS_TARIFF_CITIES`, без дублювання списку в Client Component. Доступні рівно 13 Stage 2 codes. Початкове значення відсутнє, address inputs вимкнені до вибору міста.

## 7. Dynamic pickup points

Одна точка існує завжди. Кнопка «Додати ще одну точку» створює нову порожню картку. Перша точка не має remove control; видалення доступне лише для другої та наступних. Після додавання focus переходить в address input нової точки, після видалення — на кнопку додавання. Presentation numbering перераховується, доменний route order не створюється.

## 8. Address combobox

Reusable `LogisticsAddressCombobox` використовується для pickup і FARM. Реалізовано:

- native text input з combobox/listbox ARIA;
- мінімум 3 символи;
- debounce 400 ms;
- `AbortController` для autocomplete і resolve;
- Arrow Up/Down, Enter, Escape;
- mouse selection;
- resolve як обов’язковий етап підтвердження;
- invalidation resolved value після редагування тексту;
- safe локалізовані повідомлення та `aria-live`.

Google SDK, карта й coordinates відсутні.

## 9. MockAddressProvider integration

UI викликає наявні Stage 2 endpoints:

- `POST /api/logistics/addresses/autocomplete`;
- `POST /api/logistics/addresses/resolve`.

Pickup використовує `TARIFF_CITY`, FARM — `KAHARLYK_COMMUNITY`. Provider config не передається в Client Component. Stage 2 API та provider contracts не змінювалися.

## 10. Destination selector

Destination реалізовано native radio inputs для `KAIROS_BASE` і `FARM`. Зміна destination одразу перераховує preview.

## 11. KAIROS_BASE behavior

Показується статична адреса бази `м. Кагарлик, вул. Миронівська, 33д`. Доплата дорівнює нулю. Перехід із FARM очищує farm address і прибирає farm validation.

## 12. FARM behavior

Показується окремий community-scoped combobox. Підтверджена адреса обов’язкова для readiness. Preview додає `500 грн`, ПДВ уже включено.

## 13. Contact fields

Ім’я і телефон обов’язкові. Телефон використовує чинний client formatter, `type="tel"`, `inputMode="tel"` і canonical Ukrainian phone validation. Помилки пов’язані з inputs через `aria-describedby`. Дані не логуються і не зберігаються.

## 14. Client comment

Коментар необов’язковий, з локальним maximum `2000` символів. Він не надсилається й не персиститься.

## 15. Live price preview

Preview обчислюється чистою client-safe функцією в integer minor units. Він оновлюється після зміни міста, кількості точок або destination.

## 16. Tariff preview source і migration parity

Preview prices додані до централізованих city definitions і статично звіряються зі Stage 3 seed migration:

`1600, 1700, 1800, 2000, 2200, 2400, 2500, 2600, 2700, 2900, 2900, 3000, 3200 грн`.

Tariff DB не читається. Ірпінь і Буча мають окремі codes.

## 17. VAT-inclusive behavior

Базові тарифи і доплати вже VAT-inclusive. Формула не додає ПДВ повторно. UI явно показує «Усі ціни включають ПДВ».

## 18. Form validation/readiness

Readiness вимагає:

- відоме тарифне місто;
- щонайменше одну точку;
- resolved address і cargo description у кожній точці;
- resolved FARM address лише для FARM;
- валідні ім’я та canonical phone;
- допустиму довжину comment.

City change очищує всі pickup address selections, зберігає cargo descriptions і показує inline повідомлення. Редагування address text очищує resolved state.

## 19. Disabled submit behavior

Submit — нативна disabled button. Вона не має `fetch`, Server Action, route handler, navigation або success state. Навіть за readiness `true` заявка не надсилається. Helper: «Надсилання заявки буде доступне на наступному етапі».

## 20. Server/Client boundaries

У Client Component передаються лише порожні safe contact initial values. Session, roles, Prisma entities, provider config і secrets не передаються. Request page і components не імпортують Prisma або auth і не виконують DB query.

## 21. Responsive behavior

Desktop використовує form/summary columns зі sticky summary у межах section. Tablet і mobile переходять в одну колонку. Smoke на `320`, `390`, `768`, `1024`, `1440` підтвердив відсутність horizontal overflow, один `h1` і disabled submit. Довгі адреси переносяться, inputs і buttons не виходять за viewport.

## 22. Accessibility

Перевірено:

- один `h1`;
- `fieldset`/`legend` для секцій;
- пов’язані labels;
- точні remove accessible names;
- keyboard add/remove focus behavior;
- combobox/listbox ARIA;
- `aria-describedby`, `aria-invalid`, `aria-live`;
- native radio inputs;
- native disabled submit;
- DOM order відповідає mobile order.

## 23. Error states

Обробляються всі Stage 2 codes без розкриття provider/env internals. При provider disabled API повернув `503 ADDRESS_PROVIDER_DISABLED`, UI показує safe unavailable message, confirmed address і readiness отримати неможливо. Runtime error overlay і console errors Stage 4 відсутні.

## 24. Security і privacy

Форма не записує PII у logs, localStorage, cookies, URL або analytics. Немає submit payload, public preview URL, create/quote endpoint чи persistent rate limiter. Address provider лишається за backend boundary.

## 25. Automated tests

`scripts/check-logistics-request-form.ts` перевіряє:

- 13 cities і migration parity;
- preview formula для base/additional points/FARM;
- integer arithmetic і invalid inputs;
- point helpers та city/destination invalidation;
- readiness;
- route/gate/disabled submit integration;
- відсутність auth/Prisma/create API/Google/map/coordinates.

Результат: `logisticsRequestForm=PASS cities=13 formulaCases=5 submit=disabled`.

## 26. Browser smoke tests

У локальному process-only environment `LOGISTICS_REQUEST_FORM_ENABLED=true`, `LOGISTICS_ADDRESS_PROVIDER=mock` перевірено landing CTA, request route, `noindex`, disabled initial addresses, Миронівку, keyboard selection/resolve, edit invalidation, add/remove point pricing, city invalidation, FARM/base transitions, VAT notice, disabled submit і refresh без side effects.

API smoke підтвердив окремі scopes для `KYIV_RIGHT_BANK`, `KYIV_LEFT_BANK`, `IRPIN`, `BUCHA`; resolve повернув `MOCK`. При form gate `false`: `/logistics` — `200`, request href відсутній, `/logistics/request` — `404`. При provider disabled autocomplete — `503 ADDRESS_PROVIDER_DISABLED`.

Console не мав runtime errors. Є один pre-existing shared-layout warning Next Image для `/images/kairos-logo.png` про aspect ratio; Stage 4 ці shared files не змінює.

## 27. Regression checks

- Stage 2: `logisticsAddressProvider=PASS cities=13 errorCodes=9`.
- Stage 3: `logisticsPersistenceFoundation=PASS models=4 cities=13 constraints=7`.
- Parts CLIENT/ADMIN flow, CRM, audit runtime, notifications і Telegram не змінювалися.
- `/logistics` зберіг усі секції, а active navigation працює для `/logistics/*`.
- Address API behavior і provider contracts не змінено.

## 28. Змінені файли

- `.env.example`
- `app/(public)/logistics/page.tsx`
- `app/(public)/logistics/request/page.tsx`
- `components/public/logistics/logistics-address-combobox.tsx`
- `components/public/logistics/logistics-request-form.tsx`
- `lib/features/logistics.ts`
- `lib/logistics/pricing-preview.ts`
- `lib/logistics/request-form-state.ts`
- `lib/logistics/tariff-cities.ts`
- `lib/routes.ts`
- `scripts/check-logistics-request-form.ts`
- `docs/reports/stage-logistics-4-public-request-form.md`

## 29. Перевірки

- `npx.cmd --no-install tsx scripts/check-logistics-address-provider.ts` — PASS.
- `npx.cmd --no-install tsx scripts/check-logistics-persistence-foundation.ts` — PASS.
- `npx.cmd --no-install tsx scripts/check-logistics-request-form.ts` — PASS.
- `npm.cmd run lint` — PASS.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run build` — PASS; 50 static pages, `/logistics/request` включено в route manifest.
- `git diff --check` — PASS.
- `prisma validate` і `prisma generate` не запускалися, оскільки Prisma schema не змінювалася.

Перші build-спроби перетнулися з незавершеним дочірнім Next `jest-worker`, який одночасно працював із `.next`. Після природного завершення конкретного процесу один чистий build пройшов. Generated `.next` не входить до commit.

## 30. Відомі обмеження

- Submit навмисно disabled.
- Preview не authoritative.
- Tariffs не читаються з БД.
- CLIENT prefill відкладений до безпечної Stage 5 integration.
- Provider для local/staging — synthetic mock; Google не підключено.
- Немає map, coordinates, CRM, CLIENT cabinet або staff notifications.

## 31. Межі Stage Logistics 4

Не створено `LogisticsRequest`, quote/create API, Server Action submit, DB-backed pricing або mutation. Prisma schema і migrations не змінені; migration не застосовувалася; SQL/DB commands не виконувалися. Google variables не додані. Чинний клієнтський Telegram-бот не змінений, staff bot не створений. Паралельні файли не включаються до Stage 4 commit. Push не виконується.

## 32. Readiness for Stage Logistics 5

UI contract, provider-neutral address flow, pure preview formula, readiness helpers, feature gates і regression checks готові як foundation. Stage 5 має окремо додати authoritative server pricing, DB persistence, idempotent submit, safe optional CLIENT prefill та подальші CRM/notification integrations лише в погодженому scope.

Blocker для Stage Logistics 5 не виявлено.
