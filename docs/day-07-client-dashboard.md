# Kairos Parts — Day 7 Client Dashboard

## Що реалізовано

Day 7 додав базовий особистий кабінет клієнта без Day 8 функціональності:

- реєстрацію CLIENT через `/register`;
- реєстрацію CLIENT за типом акаунта: `ФОП / Юр особа` або `Фіз особа`;
- логін CLIENT через `/login`;
- password hashing через Node.js `crypto.scrypt`;
- role-based protection для `/client/*`;
- dashboard клієнта `/client`;
- read-only профіль `/client/profile`;
- список заявок клієнта `/client/requests`;
- деталі заявки `/client/requests/[id]`;
- створення заявки з кабінету через `/request?source=client`;
- автопідстановку контактних даних у `/request` для авторизованого CLIENT.

## Реєстрація клієнта

`/register` створює:

- `User` з `role = CLIENT`;
- `ClientProfile`;
- `passwordHash`, а не plain text password.

На сторінці є перемикач типу акаунта у вигляді двох tab-кнопок:

- `ФОП / Юр особа`;
- `Фіз особа`.

### ФОП / Юр особа

Обов'язкові поля:

- назва компанії / ФОП;
- ЄДРПОУ / ІПН;
- контактна особа;
- телефон;
- email;
- пароль;
- підтвердження пароля.

У `ClientProfile` зберігається:

- `clientType = BUSINESS`;
- `companyName`;
- `taxId`;
- `contactName`;
- `phone`;
- `email`.

### Фіз особа

Обов'язкові поля:

- ім'я;
- телефон;
- email;
- пароль;
- підтвердження пароля.

Необов'язкове поле:

- прізвище.

У `ClientProfile` зберігається:

- `clientType = INDIVIDUAL`;
- `firstName`;
- `lastName`, якщо вказане;
- `contactName`, сформований з імені та прізвища;
- `phone`;
- `email`.

Email verification, SMS verification, OAuth і forgot/reset password не реалізовувались.

## Логін клієнта

`/login` використовує Auth.js Credentials provider.

Логіка:

- шукає користувача за email;
- дозволяє вхід тільки для `role = CLIENT`;
- перевіряє пароль через `verifyPassword`;
- додає `id` і `role` у JWT/session;
- після успішного входу перенаправляє на `/client`.

Manager/Admin login UI не реалізовано на Day 7.

UI входу має перемикач `ФОП / Юр особа` / `Фіз особа`, але на Day 7 він змінює тільки label/placeholder поля логіну. Фактичний backend login працює через email + password. Вхід через телефон, ЄДРПОУ або ІПН винесено як майбутнє покращення.

## Password hashing

Хешування зроблено без додаткових npm-залежностей у `lib/auth/password.ts`:

- `crypto.randomBytes` для salt;
- `crypto.scrypt` для derivation;
- `timingSafeEqual` для перевірки.

Формат збереження:

```txt
scrypt:<salt>:<derived-key-hex>
```

## Route protection

`middleware.ts` уже має role-based перевірку для `/client/:path*`.

На Day 7 додано server-side guard у `app/client/layout.tsx`:

- неавторизований користувач → `/login`;
- не-CLIENT користувач → `/login`;
- CLIENT бачить тільки власний dashboard.

Дані заявок додатково фільтруються через `clientId`.

## Client dashboard

`/client` показує:

- привітання клієнта;
- назву компанії, якщо вона є;
- кількість усіх заявок;
- кількість активних заявок;
- кількість завершених заявок;
- останні 5 заявок;
- CTA `Створити нову заявку`.

Mock data не використовується. Якщо `DATABASE_URL` не налаштований, показується blocker замість фейкових даних.

## Список заявок

`/client/requests` показує тільки заявки поточного `ClientProfile`:

- номер заявки;
- дату створення;
- категорію або тип техніки;
- короткий опис;
- статус;
- дату оновлення;
- посилання на деталі.

Запити інших клієнтів і guest-заявки не показуються.

## Деталі заявки

`/client/requests/[id]` шукає заявку тільки за:

```ts
{ id, clientId: profile.id }
```

Клієнт бачить:

- request number;
- статус;
- дату створення;
- опис потреби;
- категорію;
- виробника;
- модель;
- VIN / серійний номер;
- прикріплені файли;
- public status URL;
- дату останнього оновлення.

Внутрішні коментарі менеджера і CRM-службові поля не показуються.

## Створення заявки з кабінету

CTA з `/client` і `/client/requests` веде на:

```txt
/request?source=client
```

Якщо авторизований користувач має `role = CLIENT`:

- форма підставляє contactName, companyName, phone, email з `ClientProfile`;
- користувач може змінити ці дані для конкретної заявки;
- профіль автоматично не оновлюється;
- `POST /api/requests` прив'язує заявку до `ClientProfile`;
- якщо `source=client`, заявка створюється з `source = CLIENT_DASHBOARD`;
- якщо CLIENT відкрив публічну `/request` без `source=client`, заявка прив'язується до клієнта, але `source = WEBSITE`.

## Guest vs Client

Guest:

- створює разову заявку без реєстрації;
- отримує номер заявки;
- отримує public status URL;
- не має історії заявок;
- не має кабінету.

Client:

- має кабінет;
- бачить тільки свої заявки;
- створює заявки з автопідстановкою контактів;
- бачить статуси в кабінеті;
- не бачить CRM-внутрішні дані.

## Навмисно не реалізовувалось

- Парк техніки.
- Документи клієнта.
- Повторна заявка.
- CRM manager UI.
- Telegram flow.
- OCR.
- Email notifications.
- Manager/Admin full auth UI.
- Forgot/reset password.
- Email verification.
- Shop/cart/payment/Viber/Нова пошта/BAS/ERP.
- Destructive migrations.

## Блокери для Day 8

Кодових блокерів для Day 8 немає.

Перед повним runtime тестом потрібно:

- налаштувати `DATABASE_URL`;
- застосувати Prisma schema/migration до локальної PostgreSQL;
- створити або зареєструвати CLIENT-користувача;
- перевірити file storage permissions для заявок із кабінету.

Git safe.directory issue залишається для звичайного `git status`; використовувати:

```bash
git -c safe.directory='D:/Copy_WSL_Project/Kairos Parts' status --short
```
