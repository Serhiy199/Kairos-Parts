# Stage 1: RequestItem + vehicle history

## Що додано

Stage 1 додає структуровані позиції запчастин у заявку без запуску модулів комерційних пропозицій, рахунків або PDF.

Менеджер у CRM може додати до заявки одну або кілька позицій із назвою, брендом, каталожним номером, аналогом, кількістю, одиницею, наявністю, терміном постачання, цінами, валютою, коментарем і прапорцем видимості для клієнта.

## Модель даних

Додано Prisma model `RequestItem`.

Звʼязки:

- `Request.items -> RequestItem[]`
- `Vehicle.requestItems -> RequestItem[]`
- `RequestItem.requestId -> Request`
- `RequestItem.vehicleId -> Vehicle?`

Якщо заявка має `vehicleId`, нова позиція автоматично отримує той самий `vehicleId`. Завдяки цьому історія підібраних запчастин по техніці формується автоматично через ланцюжок `Vehicle -> Request -> RequestItem`.

## Backend

Додано API routes:

- `GET /api/admin/requests/[id]/items`
- `POST /api/admin/requests/[id]/items`
- `PATCH /api/admin/request-items/[itemId]`
- `DELETE /api/admin/request-items/[itemId]`

Також додано CRM server actions для форм на сторінці заявки:

- `createAdminRequestItem`
- `updateAdminRequestItem`
- `deleteAdminRequestItem`

Validation:

- `name` обовʼязкове;
- `quantity` має бути цілим числом від 1;
- `purchasePrice` і `salePrice` optional, але якщо задані, мають бути decimal >= 0;
- `unit` за замовчуванням `шт`;
- `currency` за замовчуванням `UAH`;
- текстові поля trim-яться.

## CRM

На сторінці CRM-заявки додано блок `Підібрані позиції`.

У блоці є:

- список доданих позицій;
- форма додавання позиції;
- редагування позиції;
- видалення позиції;
- checkbox `Видимо клієнту`;
- empty state для заявки без позицій.

У CRM-картці клієнта для кожної одиниці техніки додано блок `Історія підібраних запчастин`, де видно позиції, повʼязані з цією технікою через заявки.

## Client dashboard

У клієнтській сторінці заявки додано блок `Підібрані позиції`.

Клієнт бачить тільки позиції, де `visibleToClient = true`.

Клієнту не показуються:

- `purchasePrice`;
- внутрішній supplier field як окрема службова інформація;
- приховані позиції.

У картці техніки клієнта додано блок `Історія підібраних запчастин`, який показує тільки client-visible позиції.

## Permissions

MANAGER і ADMIN можуть створювати, редагувати та видаляти `RequestItem`.

CLIENT не має доступу до admin item API і не може змінювати позиції.

CLIENT бачить тільки власні заявки і тільки позиції, позначені як `visibleToClient`.

GUEST не має доступу до CRM/API для `RequestItem`.

## Що не входить у Stage 1

Не реалізовано:

- CommercialOffer;
- Invoice;
- PDF generation;
- погодження пропозиції клієнтом;
- оплата;
- складський облік;
- BAS / 1C / supplier integrations;
- автоматичний каталог товарів.

## Migration

Підготовлено migration-файл:

`prisma/migrations/20260708090000_add_request_items/migration.sql`

Migration додає таблицю `RequestItem`, індекси та foreign keys до `Request` і `Vehicle`.

## Обмеження

Migration-файл підготовлений у репозиторії. Застосування до production або Neon production database потрібно виконувати окремо після підтвердження середовища.

Stage 1 не створює повний модуль комерційної пропозиції. Позиції заявки є базовою номенклатурою для наступного етапу.

## Blocker для Stage 2

Технічного blocker для переходу до Stage 2 немає. Перед Stage 2 потрібно тільки застосувати migration у потрібному середовищі та перевірити тестові дані.
