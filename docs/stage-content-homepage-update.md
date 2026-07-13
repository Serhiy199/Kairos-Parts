# Kairos Parts — Stage Content Homepage Update

## Scope

This stage updates only public-facing content, homepage composition, navigation, and the public informational pages. It does not change request form logic, client dashboard logic, CRM business logic, Prisma schema, migrations, Telegram flow, RequestItem, ChangeRequest, invoices, or PDF generation.

## Homepage

- Updated the hero positioning around Kairos Parts as a B2B service for agricultural and transport-sector clients.
- Added a dark glass-style hero panel about the digital vehicle history:
  - repeat ordering;
  - full history in one place;
  - cost control and analytics;
  - reliable suppliers and warranty.
- Updated the homepage "Як це працює" section to a short 5-step flow:
  1. Створіть заявку;
  2. Менеджер опрацьовує запит;
  3. Підбираємо рішення;
  4. Узгодження та оплата;
  5. Історія оновлюється автоматично.
- Added the fifth process card with visual progress segments in the same style as the existing cards.
- Replaced the old non-liquid spare parts benefit with "Цифровий парк техніки для зареєстрованих користувачів".
- Updated the service section title and subtitle to focus on efficient equipment maintenance in one platform.
- Added the service point "Повторне замовлення за секунди".
- Removed the homepage "Напрями підбору" section.

## How It Works Page

The separate `/how-it-works` page now uses the full 7-step explanation:

1. Створіть особистий кабінет;
2. Створіть заявку;
3. Менеджер опрацьовує заявку;
4. Підбираємо рішення;
5. Узгодження та оплата;
6. Комплектація та доставка;
7. Історія оновлюється автоматично.

The homepage remains intentionally shorter with 5 steps.

## Navigation

- Replaced the public navigation item "Категорії" with "Майданчик БВ техніки".
- The navigation item points to `/used-equipment`.

## Used Equipment Placeholder

Added `/used-equipment` as an informational placeholder for the future used-equipment marketplace.

This page explains that Kairos Parts plans a used-equipment marketplace as part of the broader digital ecosystem, but this stage does not implement marketplace listings, photos, prices, filters, or admin tooling.

## About Page

Updated `/about` with structured customer-facing content:

- Про Kairos Parts;
- Наша місія;
- Що ми робимо;
- Чому це працює;
- Наш підхід;
- Для кого створено Kairos Parts;
- Наші принципи.

The content is split into readable sections and cards instead of a single large text block.

## Not Included In This Stage

- request form redesign or logic changes;
- client cabinet changes;
- CRM/admin changes;
- RequestItem changes;
- ChangeRequest changes;
- commercial offer, invoice, or PDF logic;
- Telegram bot flow changes;
- Prisma schema or migration changes;
- real used-equipment marketplace implementation.

## Blockers / Next Stage

No code blocker was introduced by this content stage. The next functional/content stage can focus on updating the request form and related user flow if required by the client.
