# Kairos Parts — Day 6 Request Forms and File Upload

## Що реалізовано

Day 6 підготував механізм збору заявок із публічного сайту:

- сторінку `/request`;
- швидку форму заявки;
- детальну форму заявки;
- читання query params `category` і `mode=file`;
- client-side submit через `POST /api/requests`;
- server-side validation;
- file upload validation;
- local storage abstraction для файлів;
- генерацію номера заявки;
- генерацію public status token;
- базовий public status endpoint.

Через відсутній `DATABASE_URL` у поточному середовищі реальний insert у PostgreSQL не виконувався. API має реалізований Prisma шлях, але повертає `503 database_not_configured`, доки не буде налаштована локальна база і застосована Prisma schema.

## Форми

### Швидка заявка

Обов'язкові поля:

- ім'я або назва компанії;
- телефон;
- опис потреби.

Необов'язкові поля:

- email;
- файл або фото.

### Детальна заявка

Обов'язкові поля:

- ім'я або назва компанії;
- телефон;
- опис потреби.

Необов'язкові поля:

- email;
- тип техніки;
- категорія;
- виробник;
- модель;
- VIN / серійний номер;
- коментар;
- файл або фото.

Категорії та виробники беруться з `lib/catalog/catalog-data.ts`.

## Query params

Форма читає:

```txt
/request?category=<slug>
/request?category=<slug>&mode=file
```

Правила:

- якщо `category` знайдено у static catalog data, категорія підставляється у форму;
- якщо `category` невідомий, форма працює без помилки і без автопідстановки;
- якщо `mode=file`, відкривається детальна форма й показується акцент на завантаженні файлу;
- query params не створюють заявку автоматично.

## API

`POST /api/requests` приймає `multipart/form-data`:

- `contactName`;
- `phone`;
- `email`;
- `description`;
- `equipmentType`;
- `category`;
- `manufacturer`;
- `model`;
- `vinOrSerial`;
- `comment`;
- `files`.

API:

- валідовує required fields;
- валідовує email;
- валідовує category slug;
- валідовує file type і file size;
- створює `Request` зі статусом `NEW`, `source = WEBSITE` або `CLIENT_DASHBOARD`;
- генерує `requestNumber`;
- генерує `publicStatusToken`;
- створює `RequestFile` metadata після local file save;
- повертає `requestNumber` і `publicStatusUrl`.

Якщо `DATABASE_URL` не налаштований, API повертає:

```json
{
  "status": "database_not_configured"
}
```

## Номер заявки

Номер генерується у `lib/requests/identifiers.ts` у форматі:

```txt
KP-YYYYMMDD-XXXXXX
```

де suffix — випадкові hex bytes.

## Public status token

Public status token генерується через `crypto.randomBytes(24).toString('base64url')`.

Token не дорівнює `Request.id` і використовується для:

```txt
/request/status/[token]
/api/requests/status/[token]
```

## File upload

Дозволені формати:

- JPG;
- PNG;
- PDF;
- XLS;
- XLSX;
- CSV;
- DOC;
- DOCX.

Максимальний розмір береться з:

```env
FILE_UPLOAD_MAX_SIZE_MB=20
```

Local storage abstraction:

- `lib/files/upload-policy.ts`
- `lib/files/local-storage.ts`

Файли зберігаються в:

```txt
uploads/request-files/<requestId>/
```

`uploads/` додано в `.gitignore`.

Для Vercel або production local storage потрібно замінити на S3/R2/object storage. OCR і parsing файлів не реалізовані на Day 6.

## Public status endpoint

`GET /api/requests/status/[token]` підготовлений для повернення:

- `requestNumber`;
- `status`;
- `createdAt`;
- `updatedAt`;
- `description`.

Якщо база не налаштована, endpoint повертає `503 database_not_configured`.

## Що працює після Day 6

- `/request` має швидку й детальну форму.
- Форма читає `category` і `mode=file`.
- Форма підтримує multiple file input.
- API валідовує поля та файли.
- Prisma insert path реалізований для налаштованої PostgreSQL database.
- Public status endpoint має базовий read path.

## Що навмисно не реалізовувалось

- Особистий кабінет клієнта.
- Парк техніки.
- Документи клієнта.
- CRM UI.
- Telegram bot flow.
- OCR.
- Email notifications.
- Зміна статусів менеджером.
- Магазин, кошик, оплата.
- Viber, Нова пошта, BAS/ERP.
- Destructive migrations.

## Блокери для Day 7

Функціональних блокерів у коді немає.

Перед повним runtime тестом створення заявки потрібно:

- налаштувати локальний PostgreSQL `DATABASE_URL`;
- застосувати Prisma schema через погоджену migration;
- перевірити local file permissions для `uploads/`;
- вирішити, чи client dashboard має читати існуючі guest-заявки після реєстрації.

Git safe.directory issue залишається для звичайного `git status`.
