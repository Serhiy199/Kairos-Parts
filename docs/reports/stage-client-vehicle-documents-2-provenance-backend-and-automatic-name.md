# Stage Client Vehicle Documents 2 — Provenance backend and automatic name

## 1. Мета

Stage створює additive backend foundation для provenance документів техніки, actor-aware authorization, безпечних upload/delete operations і server-side формування `Vehicle.name`. Повна UI-консолідація характеристик, фотографій і документів залишається у Stage 3.

## 2. Початковий стан

- Робоча гілка: `develop`.
- Stage 1 commit `faf3fe62884071d4199b395561231afc17d96289` присутній в історії.
- На початку Stage HEAD: `d989549 refactor: simplify request invoice availability notices`.
- `Document` мав `uploadedById`, але не мав durable source snapshot.
- Production `Document.create` існував у staff vehicle documents і staff owner documents.
- CLIENT Vehicle API повертав `documents: true`, включно з hidden metadata та `storageKey`.
- `Vehicle.name` у частині write paths ще залежав від payload.
- Сторонній `app/(public)/about/page.tsx` був dirty до Stage. Пізніше паралельна робота тимчасово додала dirty `app/client/layout.tsx` і `app/client/requests/page.tsx`, а потім самостійно закомітила їх у `2877c47`. Ці файли не редагувалися Stage 2 та не входять до Stage 2 commit.

## 3. DocumentSource schema

Додано required enum:

```prisma
enum DocumentSource {
  CLIENT
  MANAGER
  ADMIN
  SYSTEM
  LEGACY
}
```

У `Document` додано:

```prisma
source DocumentSource
@@index([vehicleId, source])
```

Global default відсутній. Кожен новий production write зобов'язаний передати `source` явно.

## 4. Migration and backfill

Migration:

```text
prisma/migrations/20260730123000_add_document_source_provenance/migration.sql
```

Порядок:

1. створюється `DocumentSource`;
2. додається nullable `Document.source`;
3. усі rows спочатку отримують `LEGACY`;
4. rows із наявним uploader backfill-яться за persisted `User.role`:
   - `CLIENT` → `CLIENT`;
   - `MANAGER` → `MANAGER`;
   - `ADMIN` → `ADMIN`;
   - `GUEST`, null, deleted або невідомий uploader → `LEGACY`;
5. `DO` gate перериває migration, якщо залишився `NULL`;
6. column стає `NOT NULL`;
7. додається `(vehicleId, source)` index.

Backfill не використовує `visibleToClient`, filename, document owner, Vehicle owner або route assumptions. `SYSTEM` не призначається історичним rows.

Migration не застосовувалася. Read-only `prisma migrate status` підтвердив рівно одну pending migration: `20260730123000_add_document_source_provenance`.

## 5. Updated Document create paths

Production writes:

- `app/admin/documents/actions.ts` — staff owner documents отримують source через `resolveDocumentSourceForActor(session.user.role)`;
- `lib/vehicles/document-service.ts` — CLIENT/MANAGER/ADMIN vehicle documents отримують source лише з authenticated actor role.

`source` не читається з `FormData` або JSON.

## 6. Automatic Vehicle name contract

Canonical helper:

```text
buildVehicleDisplayName({ manufacturer, model })
```

Правила:

- обидві частини required;
- leading/trailing whitespace видаляється;
- повторні whitespace characters стискаються до одного пробілу;
- manufacturer і model зберігаються normalized;
- `name` будується як `manufacturer + " " + model`;
- maximum `Vehicle.name` — 120 characters;
- controlled errors: `VEHICLE_MANUFACTURER_REQUIRED`, `VEHICLE_MODEL_REQUIRED`, `VEHICLE_NAME_BUILD_FAILED`.

Приклад: `  John   Deere ` + ` 6155M ` → `John Deere 6155M`.

## 7. Client Vehicle create compatibility

Оновлено:

- `createVehicle` Server Action;
- `POST /api/client/vehicles`.

Current form/API payload може тимчасово містити `name`, але server його не використовує як source of truth. Owner і надалі формується через `vehicleOwnershipForClient`.

## 8. Client Vehicle edit compatibility

`updateClientVehicle` перераховує name із validated manufacturer/model. Direct client action існує як backend-ready path, але current client detail flow використовує change requests, а не повну direct edit form.

Approval change request:

- незалежне поле `name` не застосовується;
- зміна `manufacturer` або `model` одночасно перераховує `name`;
- owner fields не входять до update payload.

## 9. CRM Vehicle create compatibility

Оновлено:

- `createAdminVehicleForClient`;
- `createAdminVehicleForCompany`.

ADMIN/MANAGER role не впливає на Vehicle owner. Owner визначається server-side з route-bound `clientId` або `companyId`; payload не може його підмінити.

## 10. CRM Vehicle edit compatibility

`updateAdminVehicle` використовує canonical name, зберігає current `clientId`/`companyId`, serializable VIN duplicate check і current audit flow.

Окремий company ownership reassignment path не змінює manufacturer/model, тому не виконує непотрібне перейменування.

## 11. Actor vs owner vs source

- `actor` — authenticated user, який виконує mutation;
- `Vehicle owner` — personal `ClientProfile` або `Company`;
- `Document source` — immutable role/source snapshot uploader.

Staff upload до CLIENT-owned Vehicle не змінює owner та отримує `source=MANAGER` або `source=ADMIN`.

## 12. Unified workflow foundation

Додано contracts у `lib/vehicles/workflow.ts`:

- `CreateVehicleCoreInput`;
- `VehicleImageUploadInput`;
- `VehicleDocumentUploadInput`;
- `CreateVehicleWithAssetsInput`;
- `VehicleWorkflowActor`;
- `VehicleWorkflowOwner`;
- `CreateVehicleWithAssetsResult`.

Stage 3 може побудувати один UI submit поверх Vehicle-first flow та незалежних image/document services без дублювання owner/source policy.

## 13. Client metadata disclosure fix

`GET /api/client/vehicles/[id]` перейшов із `include.documents=true` на explicit safe `select`.

CLIENT response не містить:

- `storageKey`;
- `fileUrl`;
- uploader relation/email;
- hidden filename;
- private Cloudinary metadata.

Documents включаються лише коли:

```text
source = CLIENT
OR visibleToClient = true
```

і сам Vehicle доступний через `vehicleAccessWhere`.

## 14. Access policy

Canonical policy: `lib/vehicles/document-access.ts`.

Helpers:

- `clientReadableVehicleDocumentWhere`;
- `clientDeletableVehicleDocumentWhere`;
- `canDeleteVehicleDocument`;
- `canChangeVehicleDocumentVisibility`.

CLIENT read/download:

```text
accessible Vehicle
AND (source=CLIENT OR visibleToClient=true)
```

CLIENT delete:

```text
accessible Vehicle
AND source=CLIENT
AND uploadedById=current actor
```

MANAGER/ADMIN зберігають current global CRM vehicle-document policy.

## 15. Upload service

Canonical service:

```text
createVehicleDocument()
```

Service:

1. перевіряє actor-aware Vehicle access;
2. валідовує batch;
3. виконує Cloudinary upload;
4. у serializable DB transaction повторно рахує count і total bytes;
5. створює `Document` з explicit `source`, `uploadedById` і actor-dependent visibility;
6. створює audit row у тій самій DB transaction;
7. при DB/audit/quota failure запускає compensation cleanup.

CLIENT visibility завжди forced `true`; staff visibility береться лише як boolean CRM input. Payload не контролює source.

Backend-ready CLIENT Server Actions:

- `uploadClientVehicleDocuments`;
- `deleteClientVehicleDocument`.

UI Stage 2 їх ще не монтує.

## 16. Validation hardening

Allowed:

- PDF (`.pdf`);
- JPEG (`.jpg`, `.jpeg`);
- PNG (`.png`);
- WebP (`.webp`).

Перевіряються:

- non-empty file;
- MIME allowlist;
- extension allowlist;
- MIME ↔ extension;
- magic signature;
- filename presence/length;
- sanitized leaf filename;
- blocked executable/archive/SVG secondary extensions;
- double extension на кшталт `manual.exe.pdf`;
- per-file, per-batch і count limits.

Cloudinary format тепер походить із validated MIME, а не з arbitrary filename extension.

## 17. Quotas

- max file: 15 МБ;
- max batch: 5 files;
- max batch bytes: 60 МБ;
- max documents per Vehicle: 25;
- max cumulative bytes per Vehicle: 250 МБ;
- max incoming filename: 255 characters;
- persisted safe filename: 180 characters.

Initial preflight покращує feedback, а authoritative count і `_sum(size)` повторюються всередині serializable transaction після storage upload.

## 18. Compensation cleanup

Upload:

- storage success + DB success → rows/audit committed;
- storage success + DB/audit/quota failure → DB rollback і cleanup attempt;
- cleanup success → controlled original failure;
- cleanup failure → `DOCUMENT_ASSET_CLEANUP_FAILED` і structured server log без storage keys.

Cloudinary та PostgreSQL не оголошуються fully atomic.

## 19. Delete foundation

Canonical service:

```text
deleteVehicleDocument()
```

Authorization повторно перевіряється в lookup і conditional `deleteMany`. DB delete та audit виконуються transactionally. Після commit виконується storage cleanup.

Якщо storage cleanup не вдався, DB не містить broken downloadable row, але можливий orphan asset; повертається controlled partial failure і пишеться structured log. Durable cleanup worker/outbox у цьому Stage не створювався.

## 20. Download policy

Vehicle-specific і generic CLIENT download routes підтримують:

- `vehicleAccessWhere`;
- `source=CLIENT OR visibleToClient=true`;
- authenticated Cloudinary proxy;
- `Content-Disposition: attachment`;
- sanitized filename;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`;
- відсутність direct private URL у response.

## 21. Audit

Використані existing `AuditAction`:

- `DOCUMENT_UPLOADED`;
- `DOCUMENT_DELETED`;
- `DOCUMENT_VISIBILITY_CHANGED`.

Event metadata:

- `VEHICLE_DOCUMENT_UPLOADED`;
- `VEHICLE_DOCUMENT_DELETED`;
- `VEHICLE_DOCUMENT_VISIBILITY_CHANGED`.

Metadata містить safe filename, MIME, size, visibility, source, actor role і IDs. Storage keys, signed URLs, credentials та file contents не audit-яться.

Vehicle create/update audit отримує normalized name через existing editable snapshot.

## 22. Backward compatibility

- `Vehicle.name` не видалено зі schema.
- Existing Vehicle rows не перейменовуються migration-ом.
- Historical name зміниться лише при майбутньому canonical edit.
- Existing Document owner relations, XOR constraint і `visibleToClient` не змінюються.
- Legacy documents не можна видаляти CLIENT actor.
- Staff documents залишаються client-readable лише за visibility policy.
- Existing two-step Vehicle/photo/document flow не переписано.

## 23. Tests

Focused script:

```text
scripts/check-client-vehicle-documents-stage2-backend-foundation.ts
```

Package command:

```text
npm.cmd run test:client-vehicle-documents-stage2
```

Перевірено:

- enum/schema/migration/backfill contracts;
- source resolution і unsupported role;
- automatic name normalization/errors;
- PDF/JPEG/PNG/WebP signatures;
- SVG, executable extension, double extension, empty file, signature mismatch;
- count/total-size constants;
- safe API serialization;
- actor access/delete predicates;
- transactional quota/compensation/audit source contracts;
- all production `Document.create` source paths;
- client/CRM create/update/change-request name paths;
- unified workflow contracts.

Оновлено релевантні static assertions у `check-assisted-fleet-12-vehicle-name.ts` відповідно до canonical helper і current audit/card contracts.

## 24. Validation

Успішно:

- `npx.cmd prisma format`;
- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- focused Stage 2 suite;
- Assisted Fleet Stage 10, 11, 11-1, 12;
- Admin Audit Log 3, 4, 5;
- Request Approval UI 1, 2;
- Request Approval 3, 4, 5, 6;
- partial invoice eligibility;
- invoice sent transaction/idempotency;
- sequential invoice numbering.

Assisted Fleet DB checks були read-only; persistent test records: `0`.

`prisma migrate status` очікувано повернув exit code `1`, бо migration pending. Він підтвердив 46 migration files і лише одну unapplied migration Stage 2. Жоден deploy/dev command не запускався.

## 25. Changed files

- `prisma/schema.prisma`;
- `prisma/migrations/20260730123000_add_document_source_provenance/migration.sql`;
- `lib/documents/source.ts`;
- `lib/vehicles/name.ts`;
- `lib/vehicles/admin-validation.ts`;
- `lib/vehicles/document-access.ts`;
- `lib/vehicles/documents.ts`;
- `lib/vehicles/document-service.ts`;
- `lib/vehicles/workflow.ts`;
- `lib/vehicles/client-queries.ts`;
- `lib/files/cloudinary-vehicle-documents.ts`;
- `lib/change-requests/apply.ts`;
- `app/admin/documents/actions.ts`;
- `app/admin/vehicles/actions.ts`;
- `app/admin/vehicles/document-actions.ts`;
- `app/client/vehicles/actions.ts`;
- `app/client/vehicles/document-actions.ts`;
- `app/client/documents/page.tsx`;
- `app/api/client/vehicles/route.ts`;
- `app/api/client/vehicles/[id]/route.ts`;
- `app/api/client/vehicle-documents/[documentId]/download/route.ts`;
- `app/api/client/documents/[documentId]/download/route.ts`;
- `scripts/check-client-vehicle-documents-stage2-backend-foundation.ts`;
- `scripts/check-assisted-fleet-12-vehicle-name.ts`;
- `package.json`;
- цей report.

## 26. Not changed

- Request Approval production code;
- Invoice production code;
- Telegram;
- Vehicle image logic;
- RequestDocument schema/storage;
- environment/deployment config;
- production DB;
- live Cloudinary assets;
- feature flags;
- unrelated dirty files.

## 27. Known limitations

- Current UI ще містить поле `Назва техніки`; server його ігнорує як canonical source.
- Current CRM/client create/edit flow може залишатися двокроковим.
- Full characteristics + photos + documents one-submit UI буде у Stage 3.
- CLIENT document actions підготовлені, але document picker/list/delete UI ще не підключений.
- Cloudinary і PostgreSQL не мають спільної transaction.
- Upload/delete compensation best-effort.
- Cleanup worker/outbox не реалізований.
- Migration не застосована до жодної DB.
- Historical Vehicle names не backfill-илися.
- Live browser/Cloudinary QA не виконувалася.

## 28. Stage 3 readiness

Backend готовий для Stage 3:

- durable provenance;
- canonical actor/owner/source separation;
- server-generated Vehicle name;
- CLIENT and staff mutation services;
- safe client reads/downloads;
- validation, quotas, compensation і audit;
- reusable workflow contracts.

Stage 3 має зосередитися на UI integration, granular retry/recovery UX та authenticated runtime QA.

## 29. Git state

Перед commit потрібно stage-ити лише перелічені Stage 2 files і цей report. Єдиний сторонній dirty file має залишитися unstaged:

```text
app/(public)/about/page.tsx
```

Parallel commit `2877c47` уже включив `app/client/layout.tsx` і `app/client/requests/page.tsx` окремо від Stage 2.

Push у межах Stage заборонений.
