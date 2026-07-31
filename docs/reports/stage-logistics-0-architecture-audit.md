# Kairos Parts — Stage Logistics 0A

## Alignment архітектурного звіту з погодженою бізнес-логікою Kairos Logistics

Дата alignment: 2026-07-29

Гілка: `develop`

HEAD на початку Stage 0A: `2909776ac5fe5b7094b4910d8c72446c571ab28a`
Режим: docs-only

## 1. Статус і джерела істини

Цей документ замінює непогоджені product-рекомендації первинного Stage Logistics 0 і фіксує затверджений контракт для Stage Logistics 1–12.

У документі розділено:

1. фактичні результати аудиту поточного репозиторію;
2. погоджений product/domain contract;
3. план майбутньої інтеграції.

Архітектурні альтернативи не змінюють затверджену бізнес-логіку. Рішення, які були запропоновані первинним аудитом, але не входять до MVP, зібрані лише в розділі «Відхилені рішення».

Stage Logistics 0A не реалізує функціонал. Application code, Prisma schema, migrations, БД, routes, navigation, Telegram, Google, dependencies і середовища в межах цього етапу не змінюються.

## 2. Executive summary

Kairos Logistics реалізується як окремий bounded context. Parts-модель `Request` логістичними полями не розширюється.

Погоджений flow:

```text
/logistics
    ↓
CTA «Створити заявку на перевезення»
    ↓
/logistics/request
    ↓
тарифне місто
    ↓
одна або декілька точок відвантаження
    ↓
backend autocomplete і підтвердження адрес
    ↓
доставка на базу або в господарство
    ↓
live preview
    ↓
авторитетний server-side розрахунок
    ↓
LogisticsRequest
    ↓
окремий CRM-модуль
    ↓
read-only CLIENT cabinet
    ↓
окреме службове Telegram-повідомлення
```

Форма доступна гостю й авторизованому `CLIENT`. Гість може створити заявку без account і після submit бачить лише success state. Guest-заявка не отримує public detail URL, claim flow і не прив’язується до майбутнього account за номером телефону.

`ADMIN` і `MANAGER` працюють через окремий CRM:

- `/admin/logistics`;
- `/admin/logistics/[id]`;
- `/admin/logistics/tariffs`.

`CLIENT` отримує read-only routes:

- `/client/logistics`;
- `/client/logistics/[id]`.

Адресна архітектура provider-neutral і backend-only. Stage 2–9 працюють через `MockAddressProvider`. Google інтегрується лише на Stage 10 через `Places API (New)` і server-only key. Карти, географічні координати, побудова маршруту та обчислення відстані не входять до MVP.

Ціна остаточна, вже включає ПДВ і зберігається в одній authoritative сумі:

```text
міський тариф
+ max(0, кількість точок - 1) × 500 грн
+ 500 грн для FARM
```

Server читає тариф із PostgreSQL, повторно виконує розрахунок і не довіряє сумі з browser payload.

## 3. Фактичні результати аудиту репозиторію

### 3.1 Public shell

`app/(public)/layout.tsx` використовує `components/layout/public-layout.tsx`.

Shared public layout уже містить:

- header;
- footer;
- desktop navigation;
- mobile navigation;
- login CTA;
- primary request CTA;
- shared contacts;
- public design tokens.

Stage Logistics 1 може додати `/logistics` без створення дубльованого layout.

`lib/auth/permissions.ts` і `lib/routes.ts` містять route registries. Під час майбутньої реалізації нові public, CLIENT, CRM та API routes потрібно додавати узгоджено.

### 3.2 Role guards

Поточний код має:

- `requireCrmSession()` для `ADMIN` і `MANAGER`;
- `getCrmApiSession()` для CRM API;
- `requireAdminSession()` і `getAdminApiSession()` для admin-only operations;
- `requireClientSession()` для CLIENT pages;
- `getClientApiSession()` для CLIENT API.

Guards перевіряють актуальний стан user через `validateSessionAgainstCurrentUser()`, а не лише роль у JWT. Logistics повинен повторно використати цей security pattern.

Public guest submit потребує окремого public create handler. Він не повинен викликати `getClientApiSession()` як обов’язковий guard. Якщо валідна CLIENT session існує, handler може отримати server-derived ownership; інакше створює guest record.

### 3.3 CLIENT і company ownership

`lib/client/access.ts` визначає:

- `clientProfileId`;
- optional `companyId`;
- `PERSONAL` або `COMPANY` mode.

Для Logistics потрібен окремий `logisticsRequestAccessWhere(context)` із тим самим чинним policy:

- company-owned заявки доступні відповідному CLIENT company membership;
- personal заявки доступні відповідному `ClientProfile`;
- ownership визначає лише server;
- frontend не передає trusted `clientId`, `companyId` або `userId`;
- guest records з `clientId = null` і `companyId = null` не підбираються до CLIENT cabinet за телефоном;
- detail query поєднує `id` та ownership predicate в одному DB query;
- чужий або відсутній record повертає 404 без витоку факту існування.

### 3.4 CRM shell

`app/admin/layout.tsx` уже підтримує:

- role-aware navigation;
- badges;
- wide-content routes;
- спільний `DashboardShell`;
- фільтрацію admin-only navigation.

Майбутній Logistics CRM інтегрується в цей shell як окремий модуль, а не як фільтр parts requests.

### 3.5 CLIENT shell

`app/client/layout.tsx` уже підтримує:

- shared navigation;
- responsive drawer/sidebar;
- badges;
- wide-content prefixes.

Майбутні Logistics pages мають використовувати explicit read models, щоб внутрішні коментарі, audit і notification diagnostics фізично не потрапляли до CLIENT response.

### 3.6 Parts request domain

`prisma/schema.prisma` model `Request` уже агрегує:

- equipment/vehicle fields;
- `RequestItem`;
- selection batches;
- commercial offers;
- invoices;
- files/documents;
- comments;
- parts-specific status history;
- notifications.

Змішування Logistics із `Request` створило б nullable-field explosion і перетин несумісних lifecycle. Погоджене рішення — окремі Logistics models зі shared infrastructure лише там, де немає domain coupling.

### 3.7 Validation і rate limiting

`lib/requests/validation.ts` використовує manual server parser. `zod` у dependencies відсутній.

Поточний database-backed rate limit спеціалізований на credentials login через `AuthRateLimitBucket`. Public business-form rate limiter не знайдено.

Logistics потребує власного anti-spam policy:

- guest: honeypot, IP bucket, normalized phone bucket;
- CLIENT: user ID bucket та IP bucket;
- autocomplete: окремий bucket;
- quote/create: окремі budgets;
- `429` і `Retry-After`;
- HMAC keys без raw IP/phone у bucket key;
- atomic DB-backed counters для multi-instance runtime;
- server-side payload limits;
- safe errors.

Login-specific semantics не слід переносити без окремого обґрунтування.

### 3.8 Money representation

Репозиторій зберігає фінансові поля як Prisma `Decimal` із PostgreSQL `Decimal(12,2)` і використовує `Prisma.Decimal` у server services.

Logistics має повторити цей pattern:

- `LogisticsTariffCity.price Decimal @db.Decimal(12,2)`;
- `LogisticsRequest.baseTariffSnapshot Decimal @db.Decimal(12,2)`;
- snapshot доплат;
- одна `totalPrice Decimal @db.Decimal(12,2)`;
- arithmetic через `Prisma.Decimal`, не JavaScript floating point.

Invoice VAT calculator не перевикористовується: Logistics tariffs і доплати вже включають ПДВ.

### 3.9 Feature flags

У репозиторії є централізований pattern у `lib/features/equipment-taxonomy.ts`: окремі server constants керують public, admin, Telegram та form surfaces. Також існує локальний page constant `ADVANTAGES_PAGE_ENABLED`, але для Logistics він недостатньо централізований.

Для Logistics рекомендований окремий server-owned модуль, наприклад `lib/features/logistics.ts`, із різними gates:

- landing visibility;
- public request-form availability;
- CRM/client surfaces за етапами;
- provider mode.

До Google integration production public form має бути закрита окремим feature flag або production CTA не повинен вести на активний submit flow. Landing `/logistics` можна розгорнути раніше.

### 3.10 AuditLog

Existing audit foundation має:

- typed `AuditEntityType` і `AuditAction`;
- actor snapshot;
- request context normalization;
- allowlist-only payload sanitizer;
- denied secret/token/hash keys;
- category-based retention;
- transaction-compatible writer.

Logistics має додати власні entity/actions без змішування з parts `REQUEST`.

Мінімальний набір:

`AuditEntityType`:

- `LOGISTICS_REQUEST`;
- `LOGISTICS_TARIFF_CITY`;
- за потреби `LOGISTICS_INTERNAL_COMMENT`.

`AuditAction`:

- `LOGISTICS_REQUEST_CREATED`;
- `LOGISTICS_STATUS_CHANGED`;
- `LOGISTICS_INTERNAL_COMMENT_CREATED`;
- `LOGISTICS_TARIFF_UPDATED`.

Tariff mutation є `FINANCIAL_CRITICAL`; create/status/comment можуть бути `STANDARD`.

Audit payload не містить:

- provider secrets;
- raw provider responses;
- Telegram credentials;
- full request body;
- unbounded comments;
- raw IP або phone keys.

### 3.11 Comment infrastructure

Existing `RequestComment` має обов’язковий FK до parts `Request` і relation names, пов’язані з цим доменом. Безпечне пряме повторне використання спричинило б змішування bounded contexts.

Рекомендація:

- створити окремий `LogisticsInternalComment`;
- повторно використати UI/validation/audit patterns;
- не додавати nullable `logisticsRequestId` до `RequestComment`;
- не передавати internal comments у CLIENT або Telegram projections.

### 3.12 Telegram

У репозиторії вже є client Telegram bot та client notification services. Вони є protected scope.

Поточний bot можна використовувати лише як read-only приклад repository patterns. Заборонено:

- змінювати його code/service/triggers/templates;
- змінювати token або routing;
- додавати staff chat;
- використовувати його для Logistics staff notifications;
- рефакторити його для уніфікації;
- змінювати existing client notification flows.

Для staff notifications створюється окремий integration path із:

- окремим bot token;
- окремим staff chat ID;
- окремими env variables;
- окремим service;
- окремим error handling.

## 4. Погоджений access contract

### 4.1 Guest

Гість може:

- відкрити `/logistics`;
- відкрити `/logistics/request`;
- повністю заповнити форму;
- створити заявку.

Після успіху гість бачить:

- номер заявки;
- остаточну суму;
- повідомлення про подальший контакт за телефоном.

Гість не отримує:

- CLIENT cabinet;
- public tracking/detail URL;
- claim flow;
- автоматичне приєднання до майбутнього account.

### 4.2 CLIENT

Авторизований `CLIENT` може:

- створити заявку;
- отримати prefill імені й телефону з profile;
- переглядати own/company-scoped list;
- переглядати read-only detail.

### 4.3 Staff

`ADMIN` і `MANAGER` не використовують public form як CRM tool.

| Дія | Guest | CLIENT | MANAGER | ADMIN |
|---|---:|---:|---:|---:|
| Відкрити `/logistics` | так | так | так | так |
| Відкрити `/logistics/request` | так | так | так | так |
| Створити заявку | так | так | ні | ні |
| Переглядати власні заявки в CLIENT cabinet | ні | так | ні | ні |
| Переглядати Logistics CRM | ні | ні | так | так |
| Додавати internal comment | ні | ні | так | так |
| Змінювати статус | ні | ні | ні | так |
| Редагувати міський тариф | ні | ні | ні | так |
| Редагувати конкретну заявку | ні | ні | ні | ні |
| Редагувати її суму | ні | ні | ні | ні |
| Видаляти заявку | ні | ні | ні | ні |

## 5. Погоджені тарифні міста й тарифи

Одна заявка має рівно одне тарифне місто. Усі pickup points повинні бути підтверджені як адреси того самого міста.

| Code | Display name | Початковий тариф, грн із ПДВ |
|---|---|---:|
| `MYRONIVKA` | Миронівка | 1 600 |
| `OBUKHIV` | Обухів | 1 700 |
| `UZYN` | Узин | 1 800 |
| `VASYLKIV` | Васильків | 2 000 |
| `BILA_TSERKVA` | Біла Церква | 2 200 |
| `BORYSPIL` | Бориспіль | 2 400 |
| `KYIV_RIGHT_BANK` | Київ — правий берег | 2 500 |
| `KYIV_LEFT_BANK` | Київ — лівий берег | 2 600 |
| `BROVARY` | Бровари | 2 700 |
| `IRPIN` | Ірпінь | 2 900 |
| `BUCHA` | Буча | 2 900 |
| `BEREZAN` | Березань | 3 000 |
| `VYSHHOROD` | Вишгород | 3 200 |

Codes є рекомендованими stable identifiers і мають бути затверджені в schema stage. Ірпінь і Буча залишаються окремими select options.

Для Києва CLIENT/guest сам обирає берег. Provider перевіряє лише належність адреси Києву й не визначає берег автоматично.

Тарифи:

- зберігаються у PostgreSQL;
- є кінцевими;
- уже включають ПДВ;
- не отримують додаткових 20%;
- редагуються лише `ADMIN`;
- змінюється лише current final city price.

`ADMIN` не керує через CRM:

- VAT rate;
- additional point charge;
- farm charge.

## 6. Погоджена формула ціни

Central server constants:

```text
ADDITIONAL_PICKUP_CHARGE = 500 грн, ПДВ включено
FARM_DELIVERY_CHARGE = 500 грн, ПДВ включено
```

Formula:

```text
totalPrice =
  currentCityTariff
  + max(0, pickupPointCount - 1) × ADDITIONAL_PICKUP_CHARGE
  + (destinationType === FARM ? FARM_DELIVERY_CHARGE : 0)
```

Invariants:

- перша точка входить у міський тариф;
- кожна наступна точка додає 500 грн;
- `FARM` додає 500 грн;
- окремий VAT calculation відсутній;
- ціна остаточна;
- manager confirmation відсутнє;
- конкретна заявка не має механізму ручної зміни суми;
- browser total є лише preview;
- create service повторно читає current city tariff із БД;
- create service повторно рахує total;
- заявка зберігає snapshot кожної складової;
- зміна city tariff не змінює історичні заявки.

Live preview може отримувати city price з backend response або server-rendered safe tariff projection. Authoritative create calculation завжди виконується server-side.

## 7. Pickup points і destination

### 7.1 Pickup points

Одна заявка має:

- мінімум одну pickup point;
- кількість без product maximum;
- одне tariff city для всіх addresses.

Кожна point містить:

- підтверджена `formattedAddress`;
- nullable `externalAddressId`;
- `addressProvider`;
- `normalizedLocality`;
- bounded normalized administrative fields лише за потреби validation;
- `cargoDescription`.

Кількість обмежується лише технічним payload safety limit, який не є business maximum. Значення цього technical limit визначається в implementation/security stage і має захищати request size, DB transaction та UI.

Порядок масиву зберігається настільки, наскільки потрібно для стабільного відображення. Він не означає оптимізацію логістичного маршруту.

### 7.2 `KAIROS_BASE`

Canonical address:

```text
м. Кагарлик, вул. Миронівська, 33д
```

Вона:

- не редагується користувачем;
- не проходить autocomplete;
- не є pickup/delivery point;
- може зберігатися snapshot у `LogisticsRequest`;
- має доплату 0 грн.

### 7.3 `FARM`

`FARM`:

- показує окреме required address field;
- дозволений лише в межах Кагарлицької громади;
- проходить backend autocomplete/resolve;
- зберігається безпосередньо в `LogisticsRequest`;
- має доплату 500 грн;
- не потребує receiver contact.

## 8. Provider-neutral address architecture

### 8.1 Contract

Frontend працює з normalized DTO, а не provider-specific response:

```ts
type AddressSuggestion = {
  externalAddressId: string;
  formattedAddress: string;
  normalizedLocality: string;
  addressProvider: 'MOCK' | 'GOOGLE';
};

type ResolvedAddress = AddressSuggestion & {
  normalizedAdministrativeArea?: string;
};
```

Точний TypeScript contract визначається Stage 2, але він не містить provider payload і геопросторових даних.

Backend operations:

- `autocomplete(query, context)`;
- `resolve(externalAddressId, context)`;
- validate selected tariff city;
- validate Кагарлицьку громаду для `FARM`;
- normalize errors;
- enforce timeout/rate limit.

Frontend не може submit-ити довільний address text як підтверджений selection. Server повторно resolve-ить або перевіряє provider selection.

### 8.2 `MockAddressProvider`

Stage 2–9 використовують `MockAddressProvider` у:

- local development;
- test;
- staging до Google integration.

Provider має:

- fixtures для всіх tariff cities;
- separate fixtures для Ірпеня і Бучі;
- Kyiv fixtures, валідні для обох user-selected bank options;
- fixtures Кагарлицької громади;
- autocomplete-like suggestions;
- mock external ID;
- city/community validation;
- той самий normalized contract, що й майбутній Google provider;
- відхилення довільного непідтвердженого тексту.

Provider selection відбувається server-side через environment configuration. Frontend не знає, який provider активний.

### 8.3 Production gating

Google Cloud не блокує Stage 1–9.

Landing `/logistics` можна розгорнути раніше. До Stage 10:

- production form закрита feature flag; або
- production CTA не веде на active submit flow.

Mock provider не використовується для відкритої production form.

### 8.4 Stage 10 Google contract

Google integration:

- `Places API (New)`;
- Next.js backend calls;
- server-only API key;
- autocomplete;
- resolve;
- tariff city validation;
- Кагарлицька community validation;
- timeout;
- rate limit;
- quota/error normalization.

Не використовується Maps JavaScript API. Key не передається frontend.

Для Києва backend перевіряє лише, що address належить Києву. User-selected right/left bank лишається authoritative tariff choice.

## 9. Спрощена MVP domain model

Назви й поля нижче є design contract, а не migration.

### 9.1 Enums

```prisma
enum LogisticsRequestStatus {
  NEW
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum LogisticsDestinationType {
  KAIROS_BASE
  FARM
}

enum AddressProvider {
  MOCK
  GOOGLE
}
```

### 9.2 `LogisticsTariffCity`

Орієнтовні поля:

- `id`;
- stable `code`;
- display `name`;
- current `price Decimal(12,2)`;
- `isActive`;
- `createdAt`;
- `updatedAt`.

Не потрібна окрема tariff revision table. Історичність забезпечують snapshots у заявці.

### 9.3 `LogisticsRequest`

Орієнтовні поля:

- `id`;
- unique `requestNumber` з Logistics namespace;
- `status`;
- nullable `clientId`;
- nullable `companyId`;
- contact name snapshot;
- normalized contact phone snapshot;
- display contact phone snapshot за потреби;
- `tariffCityId`;
- tariff city code snapshot;
- tariff city name snapshot;
- base tariff snapshot;
- `destinationType`;
- base address snapshot для `KAIROS_BASE`;
- nullable farm `formattedAddress`;
- nullable farm `externalAddressId`;
- nullable farm `addressProvider`;
- nullable farm `normalizedLocality`;
- `pickupPointCount`;
- additional points charge snapshot;
- farm charge snapshot;
- `totalPrice`;
- optional `vatIncluded` marker, лише якщо він узгоджується з repository conventions;
- optional client comment;
- idempotency/submission key;
- `createdAt`;
- `updatedAt`.

Ownership invariants:

- guest: `clientId = null`, `companyId = null`;
- personal CLIENT: `clientId` задано, `companyId = null`;
- company CLIENT: server-derived `clientId` і `companyId` згідно з чинним access policy;
- phone match ніколи не змінює ownership.

Не додається assigned manager без нового product requirement.

### 9.4 `LogisticsPickupPoint`

Орієнтовні поля:

- `id`;
- `logisticsRequestId`;
- `formattedAddress`;
- nullable `externalAddressId`;
- `addressProvider`;
- `normalizedLocality`;
- bounded normalized administrative fields за потреби;
- `cargoDescription`;
- technical display position, якщо ORM/UI потребує стабільного порядку;
- `createdAt`;
- `updatedAt`.

Technical display position не є бізнес-інваріантом маршруту.

### 9.5 `LogisticsInternalComment`

Орієнтовні поля:

- `id`;
- `logisticsRequestId`;
- `authorUserId`;
- bounded `body`;
- `createdAt`.

Comments append-only у MVP, якщо окремо не погоджено edit/delete policy. Вони доступні лише `ADMIN`/`MANAGER`.

### 9.6 Status history

Для MVP authoritative history забезпечує `AuditLog`:

- create event;
- status change з old/new status;
- comment create;
- tariff update.

Окрема `LogisticsStatusHistory` не додається автоматично. Вона потрібна лише якщо майбутній CRM timeline не може безпечно будуватися з existing `AuditLog` retention/presentation policy. Оскільки `STANDARD` audit має retention, довгострокова видима status history вимагатиме окремого product рішення.

## 10. Мінімальна status transition matrix

Тільки `ADMIN` змінює status.

| From | Allowed next |
|---|---|
| `NEW` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | немає |
| `CANCELLED` | немає |

MVP не підтримує reopen. Якщо помилкове завершення/скасування потрібно виправляти, це окреме product requirement із audit policy.

`CLIENT` бачить localized label read-only. Guest після submit не отримує status history.

## 11. Application/service boundaries

Рекомендована структура майбутнього bounded context:

```text
lib/logistics/
  access.ts
  validation.ts
  pricing.ts
  statuses.ts
  status-transition.ts
  service.ts
  crm-queries.ts
  client-queries.ts
  address-provider/
    contracts.ts
    mock.ts
    google.ts
    index.ts
  staff-notifications.ts
  audit.ts
  types.ts
```

Responsibilities:

- `validation.ts` — untrusted payload, length/count/phone validation;
- `address-provider/*` — backend provider abstraction;
- `pricing.ts` — pure Decimal formula з centralized 500 грн constants;
- `access.ts` — optional session resolution та CLIENT ownership predicates;
- `service.ts` — transaction: request, pickup points, audit, idempotency;
- `status-transition.ts` — чотири statuses і ADMIN-only transitions;
- query modules — explicit CRM/CLIENT projections;
- `staff-notifications.ts` — isolated bot integration після commit.

## 12. Routes і API contracts

### 12.1 Public pages

- `GET /logistics`;
- `GET /logistics/request`.

Form behavior:

- guest mode;
- CLIENT prefill;
- staff бачить form surface, але submit server відхиляє;
- live preview;
- success state без public guest detail URL.

### 12.2 Address backend

Орієнтовно:

- `POST /api/logistics/addresses/autocomplete`;
- `POST /api/logistics/addresses/resolve`.

Contracts provider-neutral. Endpoints мають:

- rate limit;
- query bounds;
- timeout;
- normalized safe errors;
- city/community context;
- no provider secret/details у response.

### 12.3 Quote

- `POST /api/logistics/quote`.

Вхід:

- tariff city code/id;
- pickup count;
- destination type.

Вихід:

- tariff snapshot for preview;
- additional point amount;
- farm amount;
- total;
- VAT-included wording.

Quote не є trusted під час create.

### 12.4 Create

- `POST /api/logistics/requests`.

Server flow:

1. optional current session validation;
2. reject staff session;
3. parse guest/CLIENT input;
4. honeypot/rate-limit/idempotency;
5. resolve/validate pickup addresses;
6. resolve/validate `FARM` address;
7. read active city tariff from DB;
8. calculate authoritative price;
9. transactionally create request, points and audit;
10. after commit trigger isolated staff notification;
11. return safe success DTO.

Guest response:

- request number;
- final VAT-inclusive total;
- contact message.

CLIENT response:

- request number;
- total;
- `/client/logistics/[id]`.

### 12.5 CRM

Pages:

- `/admin/logistics`;
- `/admin/logistics/[id]`;
- `/admin/logistics/tariffs`.

API/action capabilities:

- `ADMIN`/`MANAGER`: list/detail;
- `ADMIN`/`MANAGER`: create internal comment;
- `ADMIN`: status mutation;
- `ADMIN`: tariff price mutation;
- no request edit/delete;
- no amount mutation.

### 12.6 CLIENT

Pages:

- `/client/logistics`;
- `/client/logistics/[id]`.

Server components або API використовують ownership-scoped read models. Guest records не повертаються через phone search.

## 13. UI integration plan

### 13.1 Public

Stage 1:

- reuse `PublicLayout`;
- додати navigation item «Логістика»;
- `/logistics` landing;
- CTA `/logistics/request`;
- production gating відповідно до readiness.

Stage 4:

- tariff city select;
- dynamic pickup cards;
- підтверджений address suggestion;
- cargo description у кожній card;
- add/remove point controls;
- destination choice;
- static base address або required farm address;
- name;
- phone;
- client comment;
- VAT-inclusive live total;
- accessible keyboard/loading/error states.

No-map text workflow є повним основним UX.

### 13.2 CRM

List показує:

- request number;
- created date;
- tariff city;
- point count;
- destination;
- total;
- status;
- guest/CLIENT identity indicator.

Detail показує:

- contact snapshots;
- addresses;
- cargo descriptions;
- pricing component snapshots;
- total;
- status;
- internal comments;
- audit link/visibility відповідно до current policy.

Status control бачить лише `ADMIN`. Tariff editor доступний лише `ADMIN`. `MANAGER` має лише read/comment capability.

### 13.3 CLIENT

List/detail показує:

- number;
- date;
- tariff city;
- point count;
- destination;
- total;
- localized status;
- pickup addresses;
- cargo descriptions;
- farm/base destination;
- client comment.

Відсутні edit/cancel/approve/reject controls, internal comments, audit і Telegram diagnostics.

## 14. Окремий staff Telegram bot

### 14.1 Isolation

Новий staff bot має:

- власний token;
- власний staff chat ID;
- власні server env variables;
- власний service;
- власний error handling;
- жодного dependency на client bot service.

Existing client bot залишається protected scope і не змінюється.

### 14.2 Дозволені події

Новий bot надсилає тільки:

1. створено нову Logistics заявку;
2. створено нову parts-заявку.

Parts integration додається тільки в existing parts create points у Stage 8. Stage 0A і Stage 1 не змінюють parts create logic.

Не надсилаються:

- status changes;
- processing/completion/cancellation;
- comments;
- batches;
- selections;
- approvals/rejections;
- tariff changes.

### 14.3 Logistics message

Містить:

- request number;
- name;
- phone;
- tariff city;
- pickup point count;
- base/farm;
- final total;
- CRM link.

Internal comment не включається.

### 14.4 Delivery behavior

Business create commit не відкочується через Telegram failure.

Після DB commit:

- notification attempt;
- success/failure status;
- bounded diagnostic;
- safe logging без token;
- no client bot routing.

Точна notification persistence model визначається Stage 8. Не потрібно розширювати existing client bot services для уніфікації.

## 15. Security, anti-spam і privacy

### Guest create

- honeypot;
- IP rate limit;
- normalized phone rate limit;
- server validation;
- idempotency;
- duplicate-submit protection;
- payload bounds;
- technical point-count safety bound;
- safe errors;
- no public tracking token;
- no account claim by phone.

### CLIENT create

- validated current session;
- user ID rate limit;
- IP rate limit;
- server-derived ownership;
- idempotency;
- same address/pricing validation as guest.

### Autocomplete

- separate rate limit;
- minimum/maximum query length;
- request timeout;
- bounded suggestions;
- provider error normalization;
- непідтверджений довільний текст заборонено;
- no secret leakage.

### CRM

- `getCrmApiSession()` for reads/comments;
- `getAdminApiSession()` for status/tariffs;
- role-negative tests;
- audit in same transaction as status/tariff mutations;
- explicit projections.

### PII

- name, phone and addresses are snapshots;
- exact contact data is not placed into general technical logs;
- raw payload/provider response is not stored;
- CLIENT response excludes internal data;
- staff Telegram contains only approved fields;
- retention/delete policy may be added later, але не блокує Stage 1.

## 16. Migration і deployment gates

Фактична topology, зафіксована repository documentation:

- `develop` є integration branch і джерелом Vercel staging-like environment;
- Vercel target naming не дорівнює бізнес-production semantics;
- бізнес-production на VPS розгортається з `main` вручну;
- Vercel/Neon і VPS/PostgreSQL є окремими environments;
- DB identity потрібно підтверджувати перед activation.

Stage 3 створює models/migration/tariff initialization artifact, але не застосовує migration до невідомої DB.

Перед DB activation:

1. підтвердити target DB identity;
2. перевірити applied/pending migrations;
3. мати backup;
4. перевірити migration SQL;
5. застосувати у staging;
6. перевірити city records/prices/snapshots;
7. лише після staging QA планувати production.

Production form залишається gated до Google readiness.

## 17. Roadmap Stage Logistics 1–12

### Stage Logistics 1 — landing page і navigation

- `/logistics`;
- shared header/footer;
- пункт «Логістика»;
- CTA `/logistics/request`;
- без form/backend/provider.

### Stage Logistics 2 — address-provider foundation і mock autocomplete

- provider-neutral contract;
- `MockAddressProvider`;
- fixtures;
- backend autocomplete/resolve;
- environment switch;
- без Google.

### Stage Logistics 3 — Prisma models, migration і tariff initialization

- simplified models;
- four statuses;
- tariff cities;
- initial final VAT-inclusive tariffs;
- guest/CLIENT ownership;
- pricing snapshots;
- no activation in unknown DB.

### Stage Logistics 4 — public form і dynamic pickup points

- tariff city;
- dynamic points;
- cargo description per point;
- base/farm;
- farm address;
- name/phone/comment;
- mock autocomplete;
- live price preview.

### Stage Logistics 5 — server pricing і create

- authoritative Decimal pricing;
- guest submit;
- CLIENT submit;
- transaction;
- idempotency;
- guest success;
- CLIENT success.

### Stage Logistics 6 — CRM

- list/detail;
- `ADMIN` status control;
- `ADMIN` city tariff editing;
- `ADMIN`/`MANAGER` internal comments;
- negative permission tests.

### Stage Logistics 7 — CLIENT cabinet

- read-only list/detail;
- personal/company ownership;
- no internal comments;
- guest exclusion.

### Stage Logistics 8 — окремий staff Telegram bot

- isolated bot/service/env;
- new Logistics request event;
- new parts request event;
- no lifecycle notifications;
- client bot unchanged.

### Stage Logistics 9 — integration/security QA у mock mode

- guest/CLIENT/ADMIN/MANAGER;
- formula/snapshots/tariffs;
- dynamic points;
- mock provider;
- isolated staff Telegram;
- anti-spam/idempotency;
- responsive/accessibility QA.

### Stage Logistics 10 — Google Places backend integration

- `Places API (New)`;
- backend-only;
- autocomplete/resolve;
- city/community validation;
- no browser provider integration.

### Stage Logistics 11 — Google integration QA

- all tariff cities;
- Kyiv right/left selections;
- Ірпінь;
- Буча;
- Кагарлицька громада;
- quota/errors/timeouts;
- rate limits;
- no key leakage.

### Stage Logistics 12 — staging і production rollout

- DB identity;
- backup;
- migration;
- tariff initialization;
- Google env;
- staff Telegram env;
- feature flags;
- staging smoke;
- production approval/release/smoke.

Google Cloud не є blocker для Stage 1–9.

## 18. Verification matrix

### Domain/pricing

- all 13 initial tariffs;
- first point included;
- second and following points add 500 each;
- `FARM` adds 500;
- `KAIROS_BASE` adds zero;
- PДВ not added again;
- browser total tampering ignored;
- inactive/missing city rejected;
- old request snapshots unchanged after tariff edit;
- Decimal arithmetic.

### Address provider

- потрібен підтверджений suggestion;
- locality matches selected tariff city;
- Kyiv address valid for user-selected bank option;
- Ірпінь and Буча remain separate;
- `FARM` limited to allowlist;
- free text rejected;
- mock and Google implementations satisfy same contract;
- provider timeout/quota error normalized;
- autocomplete independently rate-limited.

### Access

- guest create succeeds;
- guest gets no detail URL;
- guest is not claimed by phone;
- CLIENT prefill;
- CLIENT personal ownership;
- CLIENT company ownership;
- cross-client/company denial;
- staff public submit denied;
- `MANAGER` list/detail/comment allowed;
- `MANAGER` status/tariff mutation denied;
- `ADMIN` status/tariff/comment allowed;
- request amount/address mutation absent.

### Status

- `NEW -> IN_PROGRESS`;
- `NEW -> CANCELLED`;
- `IN_PROGRESS -> COMPLETED`;
- `IN_PROGRESS -> CANCELLED`;
- terminal transitions denied;
- only `ADMIN`;
- audit old/new values.

### Create/security

- honeypot;
- IP/phone/user buckets;
- idempotent retry;
- double-click duplicate;
- safe validation errors;
- payload bounds;
- technical point-count guard;
- atomic request/points/audit;
- Telegram failure does not roll back request.

### Projections

- CLIENT sees approved read-only fields;
- internal comments absent;
- audit absent;
- Telegram diagnostics absent;
- guest records absent from CLIENT queries;
- CRM sees required operational snapshots.

### Staff Telegram

- only two create events;
- Logistics message fields;
- parts create-point integration fires once;
- no status/comment/tariff notifications;
- staff bot credentials isolated;
- existing client bot unchanged;
- failure bounded and fail-open.

### Runtime gates

- mock-mode browser QA through Stage 9;
- real Google QA only Stage 11;
- staging DB підтверджено до migration activation;
- production form disabled until Stage 10/11 readiness;
- production rollout only Stage 12.

## 19. Відхилені рішення

Нижче наведені лише terms із первинного report, які **не входять до погодженого MVP**:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — відхилено; key тільки server-side.
- `latitude` і `longitude` — відхилено; у DB не зберігаються.
- `IN_REVIEW`, `CONFIRMED`, `SCHEDULED`, `IN_TRANSIT` — відхилено; використовуються лише чотири погоджені statuses.
- `pricingStatus`, `confirmedPrice`, `finalPrice` — відхилено; існує одна `totalPrice`.
- price `override` і manual-review pricing — відхилено.
- route `sequence` як domain invariant — відхилено; можливий лише technical display position.
- `Google map preview` — відхилено.
- `route distance` — відхилено.
- delivery як окремий stop — відхилено; destination зберігається в `LogisticsRequest`.
- assigned manager — не входить до MVP без нового product requirement.
- automatic guest claim by phone — відхилено.
- використання existing client Telegram bot для staff chat — категорично відхилено.

Ці terms не є implementation recommendations.

## 20. Operational dependencies

Закриті product decisions не вважаються blockers. Залишаються:

1. підтверджена DB identity перед Stage 3 activation;
2. остаточний allowlist населених пунктів Кагарлицької громади до Google validation;
3. Google Cloud project, billing і server key до Stage 10;
4. new staff bot token і staff chat ID до Stage 8 real integration/smoke;
5. production feature flag та environment configuration до rollout.

Жодна з цих залежностей не блокує Stage Logistics 1.

## 21. Final verdict

Поточний репозиторій має достатні public layout, role guard, ownership, Decimal money, audit, feature-flag і CRM/CLIENT UI patterns для початку Stage Logistics 1.

Погоджений integration path:

```text
Stage 1 landing
    ↓
Stage 2 provider-neutral mock foundation
    ↓
Stage 3 simplified schema and tariff artifacts
    ↓
Stage 4–5 public guest/CLIENT create flow
    ↓
Stage 6–7 CRM and CLIENT read-only projections
    ↓
Stage 8 isolated staff bot
    ↓
Stage 9 mock-mode full QA
    ↓
Stage 10–11 backend Google integration and QA
    ↓
Stage 12 controlled rollout
```

Stage Logistics 0A завершується docs-only alignment. Stage Logistics 1 у межах цього завдання не починається.

Blocker для Stage Logistics 1 не виявлено.
