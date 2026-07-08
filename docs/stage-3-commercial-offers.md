# Stage 3: CommercialOffer module

Дата реалізації: 2026-07-08.

## Що додано

Stage 3 додає базовий модуль комерційних пропозицій у CRM та кабінеті клієнта.

Менеджер або адміністратор може сформувати комерційну пропозицію з підібраних `RequestItem`, відредагувати чернетку, надіслати її клієнту, скасувати або видалити чернетку.

Клієнт бачить тільки пропозиції зі статусами `SENT`, `APPROVED`, `REJECTED`, `EXPIRED` по власних заявках і може погодити або відхилити `SENT` пропозицію.

## Prisma

Додано enum:

- `CommercialOfferStatus`: `DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.

Додано моделі:

- `CommercialOffer`;
- `CommercialOfferItem`.

Додано relations:

- `Request.commercialOffers`;
- `RequestItem.commercialOfferItems`;
- `User.createdCommercialOffers`.

Migration підготовлена:

- `prisma/migrations/20260708130000_add_commercial_offers/migration.sql`.

Migration не застосовувалась до Neon DB у межах Stage 3, бо завдання не дає окремого підтвердження на production-like DB deploy. Для Stage 3.1 потрібно виконати `npx.cmd prisma migrate deploy` у правильному середовищі.

## Offer number

Номер пропозиції формується у форматі:

```text
<requestNumber>-CP-<sequence>
```

Приклад:

```text
KP-20260708-000123-CP-01
```

Sequence рахується за вже створеними пропозиціями конкретної заявки.

## Backend logic

Додано спільну business-логіку:

- `lib/commercial-offers/service.ts`;
- `lib/commercial-offers/validation.ts`.

Логіка покриває:

- створення offer з `RequestItem`;
- копіювання позицій у `CommercialOfferItem`;
- використання `salePrice` як `price`, або `0`, якщо ціни немає;
- `total = quantity * price`;
- recalculation `subtotal` / `totalAmount`;
- редагування metadata та items тільки для `DRAFT`;
- `DRAFT -> SENT`;
- `DRAFT/SENT -> CANCELLED`;
- delete тільки для `DRAFT`;
- client `SENT -> APPROVED`;
- client `SENT -> REJECTED` з `clientComment`.

## Server actions

Оновлено `app/admin/actions.ts`:

- `createAdminCommercialOffer`;
- `updateAdminCommercialOfferMetadata`;
- `updateAdminCommercialOfferItem`;
- `sendAdminCommercialOffer`;
- `cancelAdminCommercialOffer`;
- `deleteAdminCommercialOffer`.

Додано `app/client/actions.ts`:

- `approveClientCommercialOfferAction`;
- `rejectClientCommercialOfferAction`.

## API routes

Admin routes:

- `GET /api/admin/requests/[id]/commercial-offers`;
- `POST /api/admin/requests/[id]/commercial-offers`;
- `GET /api/admin/commercial-offers/[offerId]`;
- `PATCH /api/admin/commercial-offers/[offerId]`;
- `DELETE /api/admin/commercial-offers/[offerId]`;
- `PATCH /api/admin/commercial-offers/[offerId]/items/[itemId]`;
- `POST /api/admin/commercial-offers/[offerId]/send`.

Client routes:

- `GET /api/client/commercial-offers/[offerId]`;
- `POST /api/client/commercial-offers/[offerId]/approve`;
- `POST /api/client/commercial-offers/[offerId]/reject`.

Unauthorized або forbidden requests повертають 401/403 через існуючі access helpers. Invalid JSON / payload / status transition повертає 400, а не 500.

## CRM UI

Оновлено:

- `app/admin/requests/[id]/page.tsx`.

У CRM-картці заявки додано блок `Комерційні пропозиції` після `Підібрані позиції`.

Менеджер бачить:

- список пропозицій по заявці;
- номер пропозиції;
- статус;
- дату створення;
- автора;
- суму;
- строк дії;
- дати надсилання / погодження / відхилення;
- позиції пропозиції;
- коментар менеджера;
- коментар клієнта.

Для `DRAFT` доступно:

- редагування валюти;
- редагування `validUntil`;
- редагування `managerComment`;
- редагування quantity / price / availability / deliveryTime / comment для item;
- надсилання клієнту;
- скасування;
- видалення чернетки.

Після `SENT` ключове редагування заблоковане.

## Client UI

Оновлено:

- `app/client/requests/[id]/page.tsx`.

Клієнт бачить:

- тільки пропозиції своїх заявок;
- тільки статуси `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`;
- номер пропозиції;
- статус;
- позиції, кількість, ціну, суму;
- загальну суму;
- строк дії;
- коментар менеджера;
- свій коментар після відхилення.

Для `SENT` доступно:

- `Погодити`;
- `Відхилити`;
- поле `Причина відхилення / коментар`.

`DRAFT` пропозиції клієнту не показуються.

## Permissions

Реалізовано:

- MANAGER / ADMIN можуть створювати, редагувати, надсилати, скасовувати та видаляти draft offers;
- CLIENT не може створювати offers;
- CLIENT не може редагувати offer items;
- CLIENT бачить тільки offers власних заявок;
- CLIENT не бачить `DRAFT`;
- GUEST не має доступу до admin/client offer API.

## Що не входить у Stage 3

Не реалізовано в цьому етапі:

- PDF generation;
- invoice generation;
- document templates;
- VAT logic;
- payments;
- company multi-user accounts;
- Change Approval Workflow;
- BAS / 1C integration;
- email provider setup;
- Telegram/email notifications for offer events;
- persistent object storage migration.

## Перевірки

Виконано:

- `npx.cmd prisma generate` — passed;
- `npx.cmd prisma validate` — passed;
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed;
- `npm.cmd run build` — passed.

Runtime smoke test через UI/API не виконувався, бо migration Stage 3 ще не застосована до Neon DB. Повний smoke test потрібно виконати у Stage 3.1 після `migrate deploy`.

## Stage 4 readiness

Блокера для Stage 4 — Company Multi-User Accounts + Full Change Approval Workflow — на рівні коду Stage 3 немає.

Перед Stage 4 потрібно закрити Stage 3.1:

- застосувати migration до staging/production-like Neon DB;
- перевірити CRM create/edit/send;
- перевірити client approve/reject;
- перевірити security сценарії.
