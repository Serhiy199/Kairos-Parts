# Stage OCR Storage 2 — Cloudinary-backed RequestFile storage and image OCR

## 1. Мета

Перевести нові `RequestFile` з локального filesystem на durable Cloudinary storage і зробити image OCR provider-aware без direct private URL exposure.

Stage реалізований у режимі `IMPLEMENTATION` на гілці `develop`. Migration створена, але не застосована. Live Cloudinary operations, backfill, browser QA, deployment і push не виконувалися.

## 2. Початковий стан

- HEAD на початку: `aac9867fe5f88fc0deb030fc6997cfdc0062cc52`.
- Початковий `git status --short`: clean.
- Сторонніх dirty files не було.
- `npx.cmd prisma migrate status` до змін: schema up to date, 46 migrations.
- Canonical source OCR: `RequestFile`.
- Producers: `POST /api/requests` і Telegram `attachTelegramFiles()`.
- Download: лише CRM route `/api/admin/files/[fileId]`.
- OCR: local path через `process.cwd()/uploads`.

## 3. Prisma storage model

Додано:

```text
RequestFileStorageProvider
RequestFileStorageStatus
RequestFileSource
```

Нові поля `RequestFile`:

```text
storageProvider
storageStatus
storagePublicId
storageResourceType
storageDeliveryType
storageVersion
storageFormat
storageChecksumSha256
source
migratedAt
```

Existing `storageKey`, `fileUrl`, filename, MIME, size, `Request` relation та `OCRResult` relation збережені.

## 4. Migration

Migration:

```text
prisma/migrations/20260730170000_add_request_file_cloudinary_storage/migration.sql
```

Вона:

1. створює storage enums;
2. розширює audit enums;
3. додає nullable metadata;
4. deterministic backfill існуючих rows;
5. робить provider/status/source required;
6. додає consistency constraints;
7. додає indexes.

Migration additive: немає `DROP`, видалення rows або зміни relation semantics.

## 5. Legacy backfill policy

Existing rows отримують:

```text
storageProvider = LEGACY_LOCAL
storageStatus = MIGRATION_PENDING
```

`source = TELEGRAM` визначається лише для persisted `Request.source = TELEGRAM`; решта existing rows отримують `LEGACY`.

SQL не перевіряє filesystem. Фізична класифікація виконується окремим inventory/backfill tooling.

## 6. Cloudinary RequestFile adapter

Файл:

```text
lib/files/cloudinary-request-files.ts
```

Functions:

```text
uploadRequestFileToCloudinary()
downloadRequestFileBytesFromCloudinary()
deleteRequestFileFromCloudinary()
```

Persisted source of truth — typed metadata, а не URL. `storageKey` містить opaque encoded locator лише для compatibility.

## 7. Resource type policy

- `image/jpeg`, `image/png`, `image/webp` → `resource_type=image`.
- PDF, XLS/XLSX, CSV, DOC/DOCX → `resource_type=raw`.
- Усі assets → `type=authenticated`.
- PDF зберігається і завантажується, але не передається в image OCR.

## 8. Upload validation

Додано `lib/files/request-file-validation.ts`.

Політика:

- 20 MB на один file;
- максимум 10 `RequestFile` на Request;
- максимум 100 MB сумарно;
- empty files blocked;
- extension + MIME + magic-byte validation;
- dangerous double extensions blocked;
- executables/archives не входять до allowlist;
- WebP додано до request upload allowlist;
- OCR limit: 10 MB.

## 9. CLIENT request upload

`POST /api/requests`:

```text
authorize CLIENT
→ validate payload
→ create Request
→ prepare Buffer inputs
→ uploadRequestFilesForActor()
→ Cloudinary uploads
→ transaction: RequestFile + audit
→ notify staff
```

При upload failure newly created Request видаляється best-effort. Якщо request cleanup не вдався, це логуються без storage credentials.

## 10. Telegram upload

`attachTelegramFiles()`:

```text
Telegram download to Buffer
→ uploadRequestFilesForActor()
→ Cloudinary authenticated storage
→ RequestFile + audit
```

Local filesystem більше не primary storage. Старий metadata-only `telegram/<fileId>` fallback видалений, щоб не створювати false available files.

Telegram draft видаляється лише після успішного attachment flow. При failure newly created Request видаляється best-effort, draft залишається для контрольованого retry.

## 11. Upload compensation

Cloudinary і PostgreSQL не мають спільної transaction.

Реалізовано:

- cleanup усіх assets поточного batch при partial upload failure;
- cleanup усіх uploaded assets при DB transaction failure;
- окремі typed outcomes для upload, DB save і cleanup failure;
- structured log без credentials, private URL або file content.

## 12. RequestFile processing loader

Canonical loader:

```text
loadRequestFileForProcessing()
```

Він:

- приймає actor;
- перевіряє `requestId + fileId`;
- підтримує CRM і typed CLIENT access context;
- завантажує bytes строго за provider;
- enforce 10 MB processing limit;
- повторно перевіряє MIME/signature;
- не повертає private URL.

## 13. OCR service integration

`lib/ocr/service.ts` більше не використовує:

```text
pathExists()
storageKeyToLocalPath()
process.cwd()/uploads
```

Новий flow:

```text
loadRequestFileForProcessing()
→ process-local serialized OCR queue
→ tesseract.js worker
→ Buffer input
→ eng+ukr
→ 60-second timeout
→ worker terminate
→ OCRResult + audit transaction
```

## 14. Supported image formats

OCR підтримує:

```text
image/jpeg
image/png
image/webp
```

CRM button показується лише для цих MIME.

## 15. PDF behavior

PDF OCR не реалізований.

Controlled code:

```text
PDF_OCR_NOT_SUPPORTED
```

User-facing message:

> OCR для PDF поки не підтримується. Завантажте зображення сторінки у форматі JPG, PNG або WebP.

## 16. Download and preview proxy

Оновлено CRM route:

```text
/api/admin/files/[fileId]
```

Додано CLIENT owner/company route:

```text
/api/client/files/[fileId]
```

Response:

- server-side provider-aware byte loading;
- inline лише для JPEG/PNG/WebP;
- інші documents — attachment;
- UTF-8 safe filename;
- `Content-Length`;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`;
- direct Cloudinary URL не повертається.

## 17. Delete behavior

Додано `deleteRequestFileAsset()`.

- `CLOUDINARY` → typed authenticated destroy;
- `LEGACY_LOCAL` → safe resolved path, missing source treated idempotently;
- uncontrolled path traversal blocked.

Новий delete route не створювався, бо current product не має `RequestFile` delete operation і Stage не дозволяє розширювати права.

## 18. Authorization

- CLIENT upload: active CLIENT session + canonical personal/company Request access.
- Telegram upload: linked CLIENT identity + persisted request ownership.
- CLIENT download: `requestAccessWhere()`.
- CRM download/OCR: existing ADMIN/MANAGER session guard.
- `fileId` завжди перевіряється разом із Request relation/access.

## 19. Audit behavior

Додано entity/action contracts:

```text
REQUEST_FILE
REQUEST_FILE_UPLOADED
REQUEST_FILE_DOWNLOADED
REQUEST_FILE_DELETED
REQUEST_FILE_STORAGE_MIGRATED
REQUEST_FILE_STORAGE_MISSING
OCR_STARTED
OCR_COMPLETED
OCR_FAILED
OCR_CORRECTED
```

Runtime використовує upload/download/OCR events. Backfill використовує migrated/missing events. Delete event зарезервований для майбутнього authorized DB delete workflow.

Audit metadata не містить Cloudinary public id, URL, credentials, file bytes або raw OCR text.

## 20. Inventory script

Файл:

```text
scripts/audit-request-file-storage.ts
```

Default mode — `DRY_RUN`. Класифікації:

```text
CLOUDINARY_AVAILABLE
LEGACY_LOCAL_AVAILABLE
LEGACY_LOCAL_MISSING
INVALID_METADATA
```

Script виводить counts і IDs, не виконує DB writes.

## 21. Backfill script

Файл:

```text
scripts/migrate-request-files-to-cloudinary.ts
```

Mutation потребує explicit:

```text
--execute
```

Підтримує `--batch-size=N`, validate, SHA-256, size comparison, authenticated upload, conditional update, audit і compensation cleanup.

## 22. Idempotency and retries

Candidate та update guards:

```text
storageProvider = LEGACY_LOCAL
storageStatus IN (MIGRATION_PENDING, MIGRATION_FAILED)
storagePublicId IS NULL
```

Already migrated rows skipped. Race після upload дає conditional update count `0`, після чого asset поточної спроби видаляється.

Local source після success не видаляється.

## 23. Vercel compatibility

- durable bytes у Cloudinary;
- server-side Buffer fetch;
- no durable local path;
- Node.js runtime;
- 15-second storage fetch timeout;
- 10 MB OCR input;
- one process-local OCR operation at a time.

Фактичні timeout/memory limits потребують staging runtime QA після migration activation.

## 24. VPS compatibility

Той самий Cloudinary adapter і `tesseract.js`.

System Tesseract package не потрібен. Persistent VPS local directory використовується лише як legacy fallback до backfill.

## 25. Tests

Focused test:

```text
scripts/check-ocr-storage-stage2-cloudinary-request-files.ts
```

Перевіряє schema/migration, MIME/signatures, quota, Cloudinary policy, CLIENT/Telegram producers, provider-aware loader, OCR Buffer flow, proxy headers та idempotent tooling.

Результат: passed.

## 26. Validation

- `npx.cmd prisma format`: passed.
- `npx.cmd prisma validate`: passed.
- `npx.cmd prisma generate`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- focused Stage 2: passed.
- Telegram request regression: passed.
- Audit Log 3/4/5: passed.
- Request Approval UI 1–6: passed.
- Request selection/invoice create/send regressions: passed.
- Invoice presentation/numbering: passed.
- Vehicle Documents Stage 2–3: passed.
- `git diff --check`: passed.

`npx.cmd prisma migrate status` після змін показує рівно одну pending migration:

```text
20260730170000_add_request_file_cloudinary_storage
```

Exit code `1` є очікуваним для pending state. `migrate deploy`, `migrate dev`, `db push` не виконувалися.

## 27. Changed files

Змінено лише Stage 2 scope:

- Prisma schema, seed і одна migration;
- RequestFile validation/Cloudinary/upload/storage services;
- CLIENT/Telegram producers;
- ADMIN/CLIENT download routes та CLIENT link;
- OCR service/API/action/feedback;
- audit contracts/presentation;
- tooling, focused test, package scripts;
- цей report.

## 28. Not changed

Не змінювалися:

- Request Approval domain logic;
- Invoice domain logic;
- Vehicle Documents domain logic;
- Logistics;
- production VPS;
- env values;
- Telegram transport/webhook configuration;
- Cloudinary account contents;
- production/staging DB data.

## 29. Known limitations

- PDF OCR не реалізований.
- Cloudinary і PostgreSQL не мають спільної transaction.
- Compensation cleanup best-effort.
- Durable cleanup worker/outbox не реалізований.
- Legacy local `storageKey` зберігається.
- Backfill script не запускався.
- Migration не застосовувалась.
- Live Cloudinary/browser QA не виконувалась.
- Vercel OCR timeout/memory потребують runtime QA.
- Process-local OCR serialization не є distributed queue між serverless instances.
- Request cleanup після upload failure best-effort; durable cross-system workflow/outbox не входить у Stage.

## 30. Staging activation readiness

Static readiness підтверджена.

Перед staging QA потрібно окремо:

1. перевірити target DB;
2. застосувати рівно pending migration;
3. повторити Prisma post-check;
4. виконати CLIENT/Telegram upload/download/OCR QA;
5. перевірити persistence після redeploy;
6. окремо запустити inventory dry-run, якщо це буде схвалено.

## 31. Production rollout readiness

Production rollout ще не дозволений.

Потрібні:

- staging migration activation;
- live Cloudinary verification;
- authorization negative tests;
- OCR runtime/memory evidence;
- legacy inventory;
- approved backfill plan;
- orphan cleanup/monitoring decision.

## 32. Git state

До commit:

- branch: `develop`;
- сторонніх dirty files не було;
- migration pending і unapplied;
- live operations не виконувалися.

Stage commit:

```text
feat: store request files in Cloudinary for OCR
```

Push у межах Stage заборонений.
