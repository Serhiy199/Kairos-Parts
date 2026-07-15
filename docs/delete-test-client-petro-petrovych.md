# Safe delete test client: Петро Петрович

Дата перевірки: 2026-07-15

## Статус

`NOT FOUND — deletion was not executed`

## Dry-run

Виконано read-only пошук у підключеній Neon DB:

1. Точний пошук `ClientProfile.contactName = "Петро Петрович"` — 0 збігів.
2. Розширений case-insensitive пошук за `Петро` у `ClientProfile.contactName`, `firstName`, `lastName` та `User.name` — 0 кандидатів.

Через відсутність однозначного збігу пов’язані `id`, email, phone, company, requests, invoices, documents, vehicles, notifications, Telegram identifiers, change requests та audit logs визначити неможливо.

## Видалення

- ClientProfile: не видалявся.
- User: не видалявся.
- Company / CompanyMember: не видалялися.
- Requests та дочірні записи: не видалялися.
- Vehicles, documents, invoices, notifications: не видалялися.
- Telegram data: не змінювалися.
- Інші клієнти та глобальні налаштування: не змінювалися.

## Schema

Schema та migrations не змінювалися. Migration не потрібна.

## Наступна безпечна дія

Потрібен один додатковий ідентифікатор клієнта з поточної БД: email, phone, ClientProfile id або User id. Після цього слід повторити dry-run і показати всі зв’язки перед окремим підтвердженням видалення.
