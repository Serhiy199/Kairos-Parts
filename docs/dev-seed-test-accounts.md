# Kairos Parts — Dev Seed Test Accounts

## Призначення

Цей seed потрібен тільки для локальної dev/test перевірки перед Day 10.

Він створює мінімальний набір даних для перевірки:

- client login;
- manager login;
- admin login;
- client dashboard;
- CRM dashboard;
- список і картку заявки;
- зміну статусів;
- призначення менеджера;
- внутрішні коментарі;
- парк техніки;
- документи / файли metadata;
- role-based доступ.

## Захист

Seed запускається тільки якщо встановлено:

```txt
ALLOW_DEV_SEED=true
```

Якщо змінна не встановлена, seed завершується без створення тестових даних.

Не запускати цей seed у production.

## Тестові акаунти

Усі тестові акаунти мають пароль:

```txt
Test123456!
```

Пароль зберігається в БД тільки як hash.

| Role | Email | Profile |
| --- | --- | --- |
| CLIENT | `client@test.com` | `ClientProfile`, `BUSINESS`, `ФГ Тест Агро` |
| MANAGER | `manager@test.com` | `ManagerProfile`, `Тестовий менеджер` |
| ADMIN | `admin@test.com` | `ManagerProfile`, `Тестовий адміністратор` |

## Тестова техніка

Для `client@test.com` створюється:

1. John Deere 8430

- type: `Сільгосптехніка`;
- manufacturer: `John Deere`;
- model: `8430`;
- year: `2011`;
- vinOrSerial: `JD8430TEST001`;
- comment: `Тестова одиниця техніки для перевірки заявок`.

2. MAN TGX 18.440

- type: `Вантажний транспорт`;
- manufacturer: `MAN`;
- model: `TGX 18.440`;
- year: `2016`;
- vinOrSerial: `MANTGXTEST002`;
- comment: `Тестова вантажна техніка`.

## Тестові заявки

Seed створює 3 заявки:

1. `KP-DEV-0001`

- source: `CLIENT_DASHBOARD`;
- client: `client@test.com`;
- vehicle: John Deere 8430;
- status: `NEW`;
- assignedManager: `manager@test.com`;
- description: `Потрібно підібрати фільтри та ремені для John Deere 8430`.

2. `KP-DEV-0002`

- source: `WEBSITE`;
- client: `client@test.com`;
- vehicle: MAN TGX 18.440;
- status: `IN_PROGRESS`;
- assignedManager: `manager@test.com`;
- description: `Потрібні гальмівні комплектуючі для MAN TGX`.

3. `KP-DEV-0003`

- source: `WEBSITE`;
- guestName: `Гостьовий клієнт`;
- guestPhone: `+380502222222`;
- guestEmail: `guest@test.com`;
- status: `WAITING_APPROVAL`;
- assignedManager: `manager@test.com`;
- description: `Потрібно підібрати шини для причепа`.

Для кожної заявки створюється базовий `RequestStatusHistory`.

## Файли / документи metadata

Для заявки `KP-DEV-0001` створюється metadata запис `RequestFile`:

- fileName: `test-defect-list.xlsx`;
- mimeType: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
- size: `24832`;
- fileUrl: `null`.

Реальний файл не створюється. Private storage paths не відкриваються.

## Внутрішній коментар

Для заявки `KP-DEV-0001` створюється внутрішній CRM-коментар від `manager@test.com`:

```txt
Перевірити сумісність по серійному номеру перед формуванням пропозиції.
```

Клієнтський кабінет не показує внутрішні коментарі.

## Як запустити

Потрібна локальна dev DB і актуальна Prisma schema.

PowerShell:

```powershell
$env:ALLOW_DEV_SEED='true'
npm.cmd run db:seed
```

Або напряму:

```powershell
$env:ALLOW_DEV_SEED='true'
npx.cmd prisma db seed
```

Не запускати destructive migrations без окремого погодження.

## Перевірка безпечного блокування

Команда:

```powershell
npx.cmd prisma db seed
```

без `ALLOW_DEV_SEED=true` завершується без створення тестових даних і показує повідомлення:

```txt
Dev seed skipped. Set ALLOW_DEV_SEED=true only for a local development database.
```

## Як перевірити доступи

1. Увійти як `client@test.com`.
2. Перевірити `/client`, `/client/requests`, `/client/vehicles`, `/client/documents`.
3. Увійти як `manager@test.com`.
4. Перевірити `/admin`, `/admin/requests`, `/admin/clients`.
5. Переконатися, що `MANAGER` не бачить admin-only nav items.
6. Увійти як `admin@test.com`.
7. Перевірити `/admin/settings`, `/admin/categories`, `/admin/manufacturers`.
8. У CRM змінити статус заявки, додати внутрішній коментар і призначити менеджера.

## Idempotency

Seed можна запускати повторно. Він використовує стабільні dev identifiers для тестових заявок і техніки, тому не має плодити дублікати основних fixtures.
