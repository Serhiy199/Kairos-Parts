# Stage Client Vehicle Documents 1 — Audit & Foundation

## 1. Executive summary

Поточна архітектура вже має більшу частину технічного фундаменту для документів техніки:

- окремої Prisma-моделі `VehicleDocument` **немає**;
- документи техніки зберігаються в generic-моделі `Document` з `vehicleId`;
- DB constraint `Document_exactly_one_owner_check` вимагає рівно один owner context: `vehicleId`, `companyId`, `clientId` або legacy `requestId`;
- vehicle documents зберігаються у Cloudinary як `raw` + `authenticated`;
- client download проходить через server-side authorization і не відкриває Cloudinary URL;
- поточний validator уже підтримує PDF, JPEG, PNG, WebP, magic-byte validation, 15 МБ на файл і 25 документів на owner;
- create flow уже використовує реалістичну схему `Vehicle first → optional uploads → recovery page` для фотографій.

Однак повний цільовий client flow не можна безпечно випускати лише UI-зміною:

1. `Document.uploadedById` показує конкретного uploader, але не зберігає незмінний source/role snapshot. Для legacy/null rows та зміни ролі uploader provenance не є надійним.
2. Немає client upload/delete action.
3. Немає client delete policy та lifecycle contract.
4. `GET /api/client/vehicles/[id]` використовує `documents: true` без `visibleToClient` filter і повертає hidden document metadata, включно зі `storageKey`, авторизованому власнику техніки. Сам файл цим route не відкривається, але це high-severity information-disclosure gap.
5. Vehicle document validator не звіряє extension із MIME/signature, а Cloudinary `format` спочатку бере extension із filename.
6. Count перевіряється поза DB transaction; немає DB count constraint, total-size limit або duplicate guard.
7. Upload/delete складаються з storage і DB кроків без атомарної межі; best-effort cleanup може залишити orphan asset або broken DB row.

Однозначний висновок: **MIGRATION REQUIRED** для durable `Document.source`. Поточна `Document` model може фізично зберігати client files, але не забезпечує довготривале й однозначне розділення `CLIENT` / `MANAGER` / `ADMIN` / `SYSTEM` / `LEGACY`.

Рекомендований rollout:

- Stage 2 — schema provenance, authorization/mutation service, API disclosure fix, validation hardening і focused backend tests;
- Stage 3 — create/detail document UI, retry/recovery UX, read-only staff documents, own-document deletion і browser/runtime QA.

## 2. Current client vehicle flow

Клієнтський парк має routes:

- `/client/vehicles` — список особистої та company-owned техніки;
- `/client/vehicles/new` — create form;
- `/client/vehicles/[id]` — detail, documents, change requests, пов’язані заявки;
- `/client/vehicles/[id]/photos` — окреме керування фотографіями.

Create form приймає характеристики й optional images. Документи в payload не входять.

На detail page:

- vehicle завантажується через `getClientVehicleDetail`;
- ownership фільтрується `vehicleAccessWhere`;
- показуються лише `Document` rows з `visibleToClient=true` та чистим vehicle owner context;
- `Усі документи` веде на `/client/documents`;
- download веде на `/api/client/vehicle-documents/[documentId]/download`.

Пряме редагування характеристик у UI вимкнене через `SHOW_DIRECT_CLIENT_VEHICLE_EDITING=false`. PATCH API повертає `409 change_request_required`. Фотографії залишаються окремою дозволеною direct mutation.

## 3. Current document domain models

| Model | Vehicle relation | Request relation | Uploader | Visibility | Storage metadata | Delete behavior |
|---|---|---|---|---|---|---|
| `Vehicle` | `documents Document[]`, `images VehicleImage[]` | `requests`, `requestItems` | n/a | n/a | немає | owner FK — `Restrict`; documents/images мають `Cascade` від Vehicle |
| `VehicleImage` | required `vehicleId` | немає | actor лише в AuditLog | завжди клієнтська gallery | `publicId`, `secureUrl`, dimensions, bytes, format | DB `onDelete: Cascade`; mutation видаляє Cloudinary image перед DB row |
| `Document` | optional `vehicleId` | optional legacy `requestId` | nullable `uploadedById → User`, `SetNull` | `visibleToClient @default(false)` | `fileName`, `storageKey`, nullable `fileUrl`, `mimeType`, `size` | vehicle FK `Cascade`; client/company/request FK `Restrict`; action hard-deletes |
| `RequestDocument` | немає | required `requestId`, `Cascade` | nullable `uploadedById`, `SetNull` | `visibleToClient` | nullable `storageKey`, `fileUrl`, MIME, size | DB hard-delete; local asset cleanup відсутній |
| `RequestFile` | через `Request.vehicleId`, прямого FK немає | required `requestId`, `Cascade` | немає | є частиною доступної заявки | local `storageKey`, `fileUrl`, MIME, size | DB cascade; physical cleanup не реалізований |

`VehicleDocument` як Prisma model не існує. Назва використовується лише в UI/types/helpers (`VehicleDocumentManager`, `VehicleDocumentActionState`, `CloudinaryVehicleDocumentUpload`).

`Document` не має:

- `source`;
- uploader role snapshot;
- separate `originalName`;
- checksum;
- `deletedAt`;
- deletion state;
- public Cloudinary ID column.

`storageKey` інкапсулює Cloudinary `publicId` і format у base64url payload із prefix `cloudinary-raw-authenticated:`.

## 4. Prisma relations and constraints

`Vehicle`:

- має рівно одного owner завдяки `Vehicle_exactly_one_owner_check`;
- `clientId → ClientProfile` — `onDelete: Restrict`;
- `companyId → Company` — `onDelete: Restrict`;
- `archivedById → User` — `onDelete: SetNull`;
- indexes: `clientId`, `companyId`, `archivedAt`, `archivedById`.

`Document`:

- `vehicleId → Vehicle` — `onDelete: Cascade`;
- `clientId → ClientProfile` — `onDelete: Restrict`;
- `companyId → Company` — `onDelete: Restrict`;
- `requestId → Request` — `onDelete: Restrict`;
- `uploadedById → User` — `onDelete: SetNull`;
- `Document_exactly_one_owner_check` вимагає рівно один non-null owner FK;
- indexes: owner IDs, `uploadedById`, а також `(vehicleId, visibleToClient)`, `(clientId, visibleToClient)`, `(companyId, visibleToClient)`;
- unique constraint для filename/content відсутній;
- soft delete відсутній;
- count/total-byte DB constraint відсутній.

`VehicleImage.vehicleId → Vehicle` має `onDelete: Cascade`.

Ці constraints підтверджені schema та migration SQL. Live DB introspection у documentation-only Stage не виконувалася, тому applied state конкретного environment не заявляється як runtime-підтверджений.

## 5. Relevant migrations

| Migration | Зміна | Backfill / legacy detail |
|---|---|---|
| `20260702094758_init_kairos_parts_schema` | створено `Vehicle` і generic `Document`; початкові owner FKs мали `SetNull`/`Cascade` | `Vehicle.clientId` спочатку required; `Document` без visibility/uploader |
| `20260708150000_add_companies` | додано `companyId` до Vehicle/Document та company FKs/indexes | без document provenance backfill |
| `20260708190000_add_vehicle_archive_fields` | `archivedAt`, `archivedById` | vehicle history зберігається |
| `20260719090000_normalize_vehicle_ownership` | nullable `Vehicle.clientId`, XOR owner check, owner FKs `Restrict` | company-owned rows отримали `clientId=NULL`; preflight membership вимагався коментарем migration |
| `20260719120000_add_vehicle_images` | створено `VehicleImage` та indexes | без backfill |
| `20260719150000_add_vehicle_document_management` | `visibleToClient`, `uploadedById`, `updatedAt`; vehicle FK змінено на `Cascade`; indexes | existing rows отримали `visibleToClient=false`, uploader залишився nullable |
| `20260719170000_add_company_and_client_documents` | owner FKs `Restrict`, `Document_exactly_one_owner_check`, visibility indexes | `requestId` залишено як legacy fourth owner context |
| `20260722141000_add_vehicle_name` | required `Vehicle.name`, length check 2–120 | backfill із manufacturer/model/type |

Migration, яка створює immutable document source, відсутня.

## 6. Vehicle create flow

Файли:

- `app/client/vehicles/new/page.tsx`;
- `app/client/vehicles/vehicle-form.tsx`;
- `app/client/vehicles/actions.ts`;
- `lib/vehicles/admin-validation.ts`;
- `lib/vehicles/images.ts`;
- `lib/vehicles/image-mutations.ts`.

Поточна sequence:

1. `VehicleForm` надсилає multipart `FormData` у Server Action `createVehicle`.
2. Server Action отримує canonical CLIENT access context.
3. Валідуються поля, taxonomy, year, VIN і optional images.
4. Перевіряється Cloudinary config, якщо images вибрані.
5. Serializable transaction:
   - визначає owner через `vehicleOwnershipForClient`;
   - перевіряє VIN duplicate;
   - створює `Vehicle`;
   - пише `VEHICLE_CREATED` audit.
6. Після commit виконується `uploadVehicleImagesForActor`.
7. Images завантажуються послідовно у Cloudinary, а rows + audit створюються другою DB transaction.
8. При image failure створений Vehicle зберігається; redirect веде на `/client/vehicles/[id]/photos?created=1&upload=failed`.

Наслідки:

- images можна технічно додати до одного create form, бо Vehicle створюється першим;
- documents можна додати до того самого `FormData`, але це потребує окремої server validation/mutation orchestration;
- Vehicle та attachments не атомарні;
- partial upload recovery уже має прийнятний product precedent;
- storage uploads компенсуються best-effort cleanup;
- idempotency token відсутній;
- VIN duplicate guard зменшує repeat-create risk лише для Vehicle з VIN;
- no-VIN retry theoretically може створити duplicate Vehicle;
- request body limit — `160mb`;
- image limits — 10 × 8 МБ.

## 7. Vehicle edit flow

Фактичного direct edit UI для CLIENT зараз немає:

- `updateClientVehicle` існує, але form прихований feature constant;
- `/api/client/vehicles/[id]` PATCH завжди відповідає `change_request_required`;
- зміна характеристик та archive виконуються через `ContextualChangeRequestForm`;
- окремий `/photos` route дозволяє upload/delete/reorder/set-primary images напряму після ownership check.

Для документів окремий client edit/upload route або Server Action відсутній.

Recommended interpretation для наступних Stage: document management є attachment operation, а не direct edit характеристик Vehicle. Його можна дозволити на окремому `/client/vehicles/[id]/documents` route без увімкнення `SHOW_DIRECT_CLIENT_VEHICLE_EDITING`.

Optimistic concurrency для Vehicle field edit відсутня; serializable transaction використовується для update/duplicate check. Document mutations наразі client-side відсутні.

## 8. Vehicle detail flow

`getClientVehicleDetail(vehicleId, access)`:

- використовує `findFirst({ id, AND: [vehicleAccessWhere(access)] })`;
- personal CLIENT бачить лише власний personal Vehicle;
- company member бачить company Vehicle та власний personal Vehicle;
- images order: primary, sortOrder, createdAt;
- documents filter:
  - `visibleToClient=true`;
  - `clientId=null`;
  - `companyId=null`;
  - `requestId=null`;
  - relation до Vehicle забезпечується nested query.

UI показує filename, type label, size, created date та download CTA. Empty state: `Документи для цієї техніки ще не додані`. `Усі документи` веде на `/client/documents`.

Причина тексту `Документи, які менеджер відкрив...`: current client UI не має upload path, а всі production vehicle-document mutations виконуються staff actions з optional `visibleToClient`.

Важлива невідповідність:

- page query безпечно фільтрує visibility;
- `GET /api/client/vehicles/[id]` робить `include: { documents: true }` без visibility filter і повертає повні document fields. Stage 2 має закрити цей API gap до client upload rollout.

## 9. Admin/manager document flow

| Route/action | Actor | Operation | Authorization | Storage helper | DB transaction |
|---|---|---|---|---|---|
| `/admin/vehicles/[vehicleId]/edit` | MANAGER/ADMIN | list/edit Vehicle, images, documents | `requireCrmSession`, global CRM scope | n/a | read only |
| `uploadAdminVehicleDocuments` | MANAGER/ADMIN | upload directly to Vehicle | valid CRM session + existing vehicle | `uploadVehicleDocument` | rows + audit transaction після storage upload |
| `setVehicleDocumentVisibility` | MANAGER/ADMIN | toggle visibility | CRM session + `document.vehicleId` match | none | update + audit transaction |
| `deleteAdminVehicleDocument` | MANAGER/ADMIN | delete vehicle document | CRM session + `document.vehicleId` match | `deleteVehicleDocumentAsset` | storage first, потім row + audit transaction |
| `/api/admin/vehicle-documents/[id]/download` | MANAGER/ADMIN | download | `getCrmApiSession`, global CRM scope | `fetchVehicleDocument` | audit only для hidden document |
| `createAdminRequestDocument` / `/api/admin/requests/[id]/documents` | MANAGER/ADMIN | request document upload | CRM role + existing Request | `saveRequestDocumentLocal` | row + audit після local write |
| Request document update/delete | MANAGER/ADMIN | metadata/delete | CRM role + request/document lookup | physical delete helper відсутній | DB transaction |

Manager vehicle document не проходить через Request. Він безпосередньо створює `Document.vehicleId`.

Generic `Document` також використовується для company/client owner contexts через `AdminOwnerDocumentsSection`. `RequestDocument` є окремим domain і не має підміняти vehicle document.

MANAGER та ADMIN мають однаковий global vehicle-document scope; assignment/company restriction для CRM staff немає.

## 10. Storage architecture

Vehicle/company/client owner documents:

- provider: Cloudinary;
- resource type: `raw`;
- delivery type: `authenticated`;
- folder:
  - `kairos-parts/vehicle-documents/[vehicleId]`;
  - `kairos-parts/company-documents/[companyId]`;
  - `kairos-parts/client-documents/[clientId]`;
- generated ID: UUID + derived format;
- `storageKey` зберігає encoded `publicId` + format;
- `fileUrl` для нових vehicle documents встановлюється `null`;
- browser не отримує authenticated Cloudinary URL;
- server створює private download URL з TTL 60 секунд, сам fetch-ить asset і повертає buffer.

Vehicle images:

- Cloudinary `image`, public secure URL;
- folder `kairos-parts/vehicles/[vehicleId]`;
- transformation max 2400×2400, auto orientation/quality.

`RequestFile` і `RequestDocument`:

- local filesystem через `KAIROS_UPLOAD_DIR`, project `uploads`, або Vercel temp directory;
- це інший storage contract;
- Vercel temp storage не є persistent.

Canonical helper для нового client vehicle document flow: `uploadDocument({ type: 'vehicle', vehicleId }, file)`, `fetchVehicleDocument`, `deleteVehicleDocumentAsset`. Local request storage повторно використовувати не потрібно.

## 11. Upload validation

| Domain | Types | Per-file size | Count | Magic bytes | Filename / extension |
|---|---|---:|---:|---:|---|
| Vehicle images | JPEG, PNG, WebP | 8 МБ | 10 | ні | browser accept + MIME only |
| Vehicle/owner documents | PDF, JPEG, PNG, WebP | 15 МБ | 25 | так | safe filename max 180; extension-to-MIME pair не перевіряється |
| Request documents | PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG | 20 МБ | explicit limit відсутній | ні | MIME або extension |
| Public request upload policy | JPG/JPEG/PNG/PDF/XLS/XLSX/CSV/DOC/DOCX | env default 20 МБ | flow-specific | ні | MIME + extension |

Vehicle document validator:

- відхиляє empty selection;
- фільтрує zero-byte files;
- перевіряє MIME allowlist;
- перевіряє per-file size;
- перевіряє PDF/JPEG/PNG/WebP signature;
- sanitizes path/control/reserved chars;
- truncates display filename до 180 chars.

Gaps:

- не звіряє filename extension із MIME/signature;
- `extensionFor()` довіряє filename extension раніше за MIME mapping;
- total bytes не рахуються;
- duplicate filename/content не перевіряються;
- count read відбувається до storage upload і поза serializable row-creation transaction;
- concurrent uploads можуть обійти application count;
- Cloudinary bytes можуть відрізнятися від browser `File.size`, але DB правильно зберігає upload result bytes.

DOC/DOCX/XLS/XLSX/TXT не рекомендуються для vehicle documents: поточний secure validator не має magic/container validation для них, а product requirement їх не вимагає.

## 12. Authorization and ownership

Canonical CLIENT access:

- session звіряється з current active User;
- role має бути `CLIENT`;
- `ClientAccessContext` містить `clientProfileId` і optional `companyId`;
- `vehicleAccessWhere` дозволяє company Vehicle поточної membership та personal Vehicle самого ClientProfile;
- Other CLIENT отримує 404/not found;
- vehicle download route повторює vehicle ownership filter і вимагає `visibleToClient=true`.

Current API authorization concern:

- `GET /api/client/vehicles/[id]` перевіряє Vehicle ownership;
- nested `documents: true` не перевіряє visibility;
- route повертає `storageKey` hidden documents;
- authenticated Cloudinary file все одно не можна відкрити напряму без server signature, але metadata disclosure порушує current visibility policy.

Staff:

- `requireCrmSession` і `getCrmApiSession` дозволяють MANAGER/ADMIN;
- staff document access глобальний;
- failed client/staff access attempts окремо не audit-яться.

## 13. Uploader/source provenance

Current `Document.uploadedById`:

- nullable;
- relation `User?`;
- `onDelete: SetNull`;
- дозволяє перевірити exact current uploader, доки User існує;
- не фіксує роль на момент upload;
- не відрізняє import/system/legacy;
- current User role може змінитися;
- legacy rows можуть мати `uploadedById=null`.

Audit metadata staff upload містить `actorRole` та document IDs, але AuditLog не є зручним canonical join для кожного read/delete authorization decision.

Висновки:

- новий client file фізично можна записати в current `Document` із `vehicleId`, `uploadedById` і `visibleToClient=true`;
- exact “цей файл завантажив поточний User” можна перевірити через `uploadedById`;
- durable classification “CLIENT vs MANAGER vs ADMIN vs SYSTEM/import” ненадійна без schema field;
- групи `Мої документи` / `Документи Kairos` не слід випускати до provenance migration;
- client delete має вимагати одночасно `source=CLIENT` і `uploadedById=currentUserId`.

## 14. Download behavior

Client vehicle download:

1. `getClientApiSession`;
2. `Document.id`, `vehicleId not null`, `visibleToClient=true`;
3. nested `vehicle: vehicleAccessWhere(access)`;
4. parse authenticated Cloudinary storage key;
5. create 60-second private Cloudinary URL;
6. server fetch з `no-store`;
7. response як attachment з safe `Content-Disposition`;
8. headers: `nosniff`, `private, no-store`.

Отже storage URL не обходить application authorization.

Client vehicle downloads зараз не audit-яться. Admin download hidden document audit-иться як `DOCUMENT_DOWNLOADED / CRITICAL_READ`; visible staff download не audit-иться.

`/api/client/documents/[id]/download` має аналогічний authorization через `documentAccessWhere`. Detail page використовує vehicle-specific route, `/client/documents` використовує generic route.

## 15. Delete and cleanup behavior

Current vehicle-document delete:

1. CRM role + `vehicleId/documentId` match;
2. require Cloudinary config;
3. delete authenticated raw asset;
4. DB transaction hard-deletes `Document` і пише `DOCUMENT_DELETED`;
5. revalidate staff/client paths.

Partial failures:

- storage delete fails → DB row зберігається, retry можливий;
- storage succeeds, DB transaction fails → DB row залишається, але asset відсутній;
- upload/DB failure → `cleanupVehicleDocumentAssets(Promise.allSettled)`;
- cleanup failure не ескалюється, тому orphan authenticated asset можливий;
- soft delete/reconciliation queue відсутні.

`Document` не має FK до Request/Invoice/Audit як споживача. Vehicle може мати Requests, але Request не посилається на конкретний vehicle Document. Технічного lifecycle lock для active Request зараз немає і він не потрібен для referential integrity.

Proposed minimal client policy:

- delete лише `source=CLIENT AND uploadedById=currentUserId`;
- company member не видаляє файл іншого member;
- staff/legacy/system documents для CLIENT read-only;
- archived Vehicle: дозволити download, але новий upload заборонити; delete own — product decision;
- зберегти storage-first order для retryable authorization state;
- explicit partial-failure status + staff reconciliation path.

Hard block за фактом будь-якої active Request не рекомендується без зв’язку `Request ↔ Document`, бо він буде надмірно широким. Якщо бізнес вимагає “document used by request”, потрібна окрема relation/snapshot у майбутньому Stage.

## 16. Audit Log behavior

Current vehicle-document events:

- `DOCUMENT_UPLOADED`, metadata event `VEHICLE_DOCUMENT_UPLOADED`;
- `DOCUMENT_VISIBILITY_CHANGED`, metadata event `VEHICLE_DOCUMENT_VISIBILITY_CHANGED`;
- `DOCUMENT_DELETED`, metadata event `VEHICLE_DOCUMENT_DELETED`;
- `DOCUMENT_DOWNLOADED` для hidden staff download.

Category:

- mutations — `STANDARD`;
- hidden download — `CRITICAL_READ`.

Audit payload містить actor snapshot через `auditUserActor`, role metadata, document IDs, safe filename, visibility, MIME, size. Storage key, public ID, signed/full URL і file bytes не allowlisted.

Gaps:

- client vehicle downloads не audit-яться;
- denied access не audit-иться;
- cleanup failure не має canonical audit/technical event;
- admin download route бере `companyId` прямо з vehicle-owned `Document`, де exact-one-owner constraint робить `companyId=null`; company context для audit треба отримувати через `vehicle.companyId`;
- provenance не є `Document` field.

Minimum Stage 2 audit contract:

- `CLIENT_VEHICLE_DOCUMENT_UPLOADED`;
- `CLIENT_VEHICLE_DOCUMENT_DELETED`;
- `CLIENT_VEHICLE_DOCUMENT_DOWNLOAD` лише якщо policy вимагає read audit;
- `CLIENT_VEHICLE_DOCUMENT_ACCESS_DENIED` як rate-limited technical/security event, без filename якщо row недоступний;
- metadata: `vehicleId`, `documentId`, `source`, `mimeType`, `size`, safe filename, owner type/id;
- не включати `storageKey`, Cloudinary public ID, signed URL або content.

Можна використати existing top-level actions `DOCUMENT_UPLOADED`, `DOCUMENT_DELETED`, `DOCUMENT_DOWNLOADED`, додавши event metadata; нові AuditAction enum values не обов’язкові.

## 17. Existing reusable UI components

| Component/helper | Current use | Reusable | Required changes |
|---|---|---:|---|
| `VehicleDocumentManager` | staff vehicle upload/list/visibility/delete | частково | не передавати admin actions у client UI; presentation можна винести |
| `AdminOwnerDocumentsSection` | company/client generic docs | частково | занадто staff-specific |
| `VehicleImageManager` | client/admin image management | pattern only | document semantics інші |
| `VehicleForm` | create + hidden direct edit | так | додати dedicated document picker після images |
| `ClientVehicleGallery` | detail images | ні | document scope відсутній |
| `ReactiveActionForm` | async mutation feedback | так | підходить для client delete/upload |
| `formatVehicleDocumentSize` | staff/client lists | так | без змін |
| `vehicleDocumentTypeLabel` | staff/client lists | так | без змін |
| `validateVehicleDocumentFiles` | staff owner documents | так | extension/total/batch hardening |
| `uploadDocument` / `fetchVehicleDocument` / delete helper | Cloudinary document storage | так | actor-neutral orchestration і cleanup result |
| `used-equipment-image-manager` selected-file logic | previews/remove/DataTransfer | pattern only | не generalize весь component; винести маленький generic selected-file utility за потреби |

Рекомендація: створити `ClientVehicleDocumentManager` замість умовного розгалуження admin component. Спільними лишити pure validators, formatters, storage helpers і невеликий presentational `VehicleDocumentList`.

## 18. Current risks and gaps

| Gap | Severity | Stage 2 | Stage 3 | Migration required |
|---|---|---:|---:|---:|
| Client Vehicle API повертає hidden document metadata | High | так | regression only | ні |
| Немає immutable source/provenance | High | так | використовує | так |
| Немає client upload/delete authorization service | High | так | UI integration | ні |
| Extension не звіряється з MIME/signature | Medium | так | form copy | ні |
| Count race поза DB transaction | Medium | так | ні | ні |
| Немає total/batch size limit | Medium | так | так | ні |
| Storage/DB не атомарні | Medium | compensation contract | recovery UX | optional future |
| Немає client document UI | Product blocker | backend | так | залежить від provenance |
| Client download/denied access audit gap | Low/Medium | policy + tests | ні | ні |
| No-VIN create retry може дублювати Vehicle | Medium | document flow не погіршувати | recovery UX | optional idempotency infra |
| Немає content checksum/duplicate guard | Low | batch duplicate guard | UX | ні |
| Existing direct edit action прихований | Informational | не вмикати | окремий documents route | ні |

## 19. Create-flow atomicity analysis

### Варіант A — Vehicle first

Переваги:

- відповідає current image architecture;
- Vehicle ID одразу визначає Cloudinary folder;
- recovery page вже існує;
- DB ownership і audit фіксуються до attachment mutation;
- не потребує staging schema.

Ризики:

- Vehicle може залишитися без частини attachments;
- images можуть пройти, documents — ні, або навпаки;
- no-VIN network retry не має server idempotency;
- compensation cleanup не є гарантованим.

### Варіант B — Storage first

Переваги: можна створити Vehicle і rows однією DB transaction після uploads.

Недоліки:

- немає Vehicle ID/final folder context;
- DB failure створює orphan assets;
- потрібен temporary owner token або move/rename;
- більше відхиляється від current architecture.

### Варіант C — Draft token/staging

Переваги: найкращий atomic-like UX і retry.

Недоліки:

- потребує schema/infrastructure cleanup job;
- значно більший scope;
- не виправданий для першої версії.

### Рішення

Рекомендується **Варіант A — Vehicle first**:

1. validate all fields, images і documents до create;
2. create Vehicle + audit у serializable transaction;
3. upload images і documents окремими actor-aware services;
4. кожен service має власну DB transaction та compensation cleanup;
5. зберегти Vehicle при partial failure;
6. redirect на `/client/vehicles/[id]/documents?created=1&upload=failed` або detail з granular status;
7. не повторювати Vehicle create під час retry.

Це найбільш реалістична архітектура Stage 2/3. Full atomicity не заявляється.

## 20. Proposed document limits

| Limit | Recommendation | Basis |
|---|---:|---|
| Formats | PDF, JPG/JPEG, PNG, WebP | current magic-byte validator і product use cases |
| Max per file | 15 МБ | current vehicle document contract |
| Max documents per Vehicle | 25 | current owner limit; не змінювати без product reason |
| Max documents in one create/upload batch | 5 | bounded latency/Cloudinary sequential uploads |
| Max document bytes in one batch | 60 МБ | лишає headroom у 160 МБ Server Action разом з images/multipart |
| Max cumulative document bytes per Vehicle | 250 МБ | explicit application quota; потребує aggregate query, не schema field |
| Filename after sanitization | 180 chars | current helper |
| Zero-byte files | reject | current behavior |
| Duplicate in same batch | reject exact normalized `(name,size,MIME)` duplicate | no checksum required |
| Duplicate vs existing row | warn/reject exact `(safe name,size,MIME)` per Vehicle | deterministic current metadata |

Worst-case one create payload:

- images: 10 × 8 МБ = 80 МБ;
- documents batch: max 60 МБ;
- total file payload ≈ 140 МБ + multipart overhead, нижче `160mb`.

Stage 2 має також:

- звіряти allowed extension із MIME/signature;
- derivе Cloudinary format із validated MIME, не з arbitrary filename extension;
- recheck count і cumulative bytes у serializable row-creation transaction;
- cleanup uploaded assets, якщо transactional quota check програно.

Office/TXT formats не додавати.

## 21. Proposed access matrix

Позначення: `current → proposed`.

| Operation | CLIENT owner | CLIENT company member | Other CLIENT | MANAGER | ADMIN |
|---|---:|---:|---:|---:|---:|
| View vehicle documents | visible only → visible + own | visible only → visible + company docs | ні | усі | усі |
| Upload document | ні → так | ні → так | ні | так | так |
| Download client document | model supports visible row → own/authorized | model supports visible row → authorized company Vehicle | ні | так | так |
| Download manager document | visible only | visible only | ні | так | так |
| Delete own document | ні → exact uploader only | ні → exact uploader only | ні | так | так |
| Delete manager document | ні | ні | ні | так | так |
| Change client visibility | ні | ні | ні | так; CLIENT source має лишатися visible | так; CLIENT source має лишатися visible |

Company membership не надає право видаляти client-source document іншого member. Other member бачить його як read-only document company Vehicle.

## 22. Proposed UI foundation

### `/client/vehicles/new`

Після photographs:

- heading `Документи техніки`;
- helper text із prompt;
- dedicated multi-file picker;
- copy: PDF, JPG/JPEG, PNG, WebP; 15 МБ/file; до 5 за одне створення;
- selected-file list: safe filename, type, size;
- remove-before-submit;
- per-file error та aggregate batch error;
- summary `N/5`, `X/60 МБ`;
- no upload progress claim для Server Action; показувати pending submit state.

### `/client/vehicles/[id]/documents`

Новий management route за pattern `/photos`:

- canonical Vehicle ownership query;
- existing documents;
- upload new files;
- delete exact own files;
- staff/legacy documents read-only;
- company-member document іншого uploader read-only;
- granular storage/DB failure feedback;
- CTA назад до Vehicle.

### Detail page

Рекомендується один список із source labels та permission-aware actions:

- `Додано вами`;
- `Додано учасником компанії`;
- `Документ Kairos`;
- `Архівний документ` для `LEGACY`.

Одна list semantics простіша за дві/три дубльовані секції. CTA `Керувати документами` веде на management route. Download, date, type, size зберігаються.

`Мої документи` дозволено показувати лише для `source=CLIENT AND uploadedById=currentUserId`.

`/client/documents` має оновити copy, який зараз говорить лише про manager-published documents.

## 23. Migration decision

**MIGRATION REQUIRED**

Recommended schema:

```prisma
enum DocumentSource {
  CLIENT
  MANAGER
  ADMIN
  SYSTEM
  LEGACY
}

model Document {
  // existing fields
  source DocumentSource @default(LEGACY)

  @@index([vehicleId, source])
}
```

Migration contract:

1. Створити enum `DocumentSource`.
2. Додати non-null `Document.source` з default `LEGACY`.
3. Існуючі rows залишити `LEGACY`; не виводити історичну роль із current `User.role`.
4. Додати `(vehicleId, source)` index.
5. Залишити `uploadedById` nullable + `SetNull`.
6. New staff actions явно записують `MANAGER` або `ADMIN`.
7. New client action явно записує `CLIENT`.
8. System/import path явно записує `SYSTEM`.
9. Client-source creation в application service вимагає non-null `uploadedById` та `visibleToClient=true`.
10. Legacy/staff/system rows client-delete не дозволяється.

`uploadedByRole` не потрібний, якщо `source` є immutable role/source snapshot. `vehicleId`, filename, MIME, size, storageKey і visibility уже існують. Separate `VehicleDocument` model не створювати.

Pre-migration read-only checks:

- count `Document` by owner context;
- XOR violations = 0;
- vehicle documents with null uploader;
- current uploader role distribution;
- invalid storage-key prefix count;
- duplicate metadata distribution.

Rollout order:

1. migration;
2. Prisma generate;
3. staff write paths задають source;
4. client backend service;
5. disclosure fix і regressions;
6. client UI rollout.

## 24. Recommended Stage 2 architecture

Stage 2: backend/security foundation.

1. Add `DocumentSource` migration.
2. Fix `/api/client/vehicles/[id]` to select only safe fields and `visibleToClient=true`, або прибрати documents із API, якщо route не використовується UI.
3. Extract actor-neutral `uploadVehicleDocumentsForActor`.
4. Add `getClientVehicleDocumentContext` з `vehicleAccessWhere`.
5. Add client Server Actions:
   - upload;
   - delete own;
   - без visibility mutation.
6. Harden extension/MIME/signature pairing.
7. Add per-batch і cumulative size checks.
8. Move count/bytes recheck into serializable row transaction.
9. Add source-aware audit metadata.
10. Preserve authenticated proxy download.
11. Add focused tests for cross-tenant IDs, hidden rows, staff provenance, exact-uploader delete, company member behavior, partial failure і API field leakage.

Не вмикати direct Vehicle field editing.

## 25. Recommended Stage 3 architecture

Stage 3: UI integration + runtime QA.

1. Add document picker to create form.
2. Extend `createVehicle` orchestration after Vehicle commit.
3. Add `/client/vehicles/[id]/documents`.
4. Add `ClientVehicleDocumentManager`.
5. Update detail list/source labels/CTA.
6. Update `/client/documents` copy and source-aware presentation.
7. Add remove-before-submit and batch-size feedback.
8. Add delete confirmation only for exact own document.
9. Add recovery URLs for partial image/document failure.
10. Browser QA desktop/tablet/mobile.
11. Real staging Cloudinary upload/download/delete QA з test Vehicle.
12. DB verification: row source/uploader/owner/visibility, audit events, storage cleanup.

## 26. Regression surface

Обов’язкові regressions після реалізації:

- CLIENT personal Vehicle access;
- company Vehicle member access;
- Other CLIENT 404;
- hidden manager document не присутній у page/API;
- hidden storageKey ніколи не повертається;
- upload client document;
- upload to foreign `vehicleId` blocked;
- exact source/uploader persisted;
- manager/admin upload source;
- client cannot toggle visibility;
- client cannot delete staff/legacy/other-member document;
- client can delete exact own document;
- archived Vehicle policy;
- 5/60 МБ batch and 25/250 МБ Vehicle limits;
- extension/MIME/signature mismatch;
- duplicate metadata;
- DB failure cleanup;
- storage failure leaves DB unchanged;
- download ownership + `nosniff`/attachment/private cache;
- create Vehicle without files;
- create with images only;
- create with documents only;
- create with both;
- partial failure recovery without duplicate Vehicle;
- photo upload/delete/reorder regressions;
- RequestDocument/RequestFile flows unchanged;
- AuditLog payload allowlist and no storage IDs;
- Prisma validate, lint, typecheck, build;
- manual staging Cloudinary E2E.

Current relevant scripts include `check-assisted-fleet-stage11.ts`, `check-assisted-fleet-12-vehicle-name.ts` та Admin Audit Log suites. Dedicated client vehicle-document tests відсутні.

## 27. Files inspected

Prisma/migrations:

- `prisma/schema.prisma`;
- initial schema та migrations `20260708150000`, `20260708190000`, `20260719090000`, `20260719120000`, `20260719150000`, `20260719170000`, `20260722141000`.

Client Vehicle:

- `app/client/vehicles/page.tsx`;
- `app/client/vehicles/new/page.tsx`;
- `app/client/vehicles/vehicle-form.tsx`;
- `app/client/vehicles/actions.ts`;
- `app/client/vehicles/image-actions.ts`;
- `app/client/vehicles/[id]/page.tsx`;
- `app/client/vehicles/[id]/photos/page.tsx`;
- `app/api/client/vehicles/route.ts`;
- `app/api/client/vehicles/[id]/route.ts`.

Documents/download:

- `app/client/documents/page.tsx`;
- `app/api/client/documents/route.ts`;
- client/admin document і vehicle-document download routes;
- request-document routes/actions.

Admin:

- `app/admin/vehicles/[vehicleId]/edit/page.tsx`;
- `app/admin/vehicles/document-actions.ts`;
- `app/admin/documents/actions.ts`;
- `components/vehicles/vehicle-document-manager.tsx`;
- `components/documents/admin-owner-documents-section.tsx`.

Libraries:

- `lib/client/access.ts`;
- `lib/vehicles/client-queries.ts`;
- `lib/vehicles/ownership.ts`;
- `lib/documents/ownership.ts`;
- `lib/vehicles/documents.ts`;
- `lib/vehicles/images.ts`;
- `lib/vehicles/image-mutations.ts`;
- `lib/files/cloudinary-vehicle-documents.ts`;
- `lib/cloudinary/server.ts`;
- `lib/files/local-storage.ts`;
- `lib/files/secure-local-file.ts`;
- `lib/files/upload-policy.ts`;
- `lib/request-documents/validation.ts`;
- `lib/audit-log/*`;
- `next.config.ts`.

Search terms із prompt та всі відповідні Ukrainian UI strings перевірені.

## 28. Not changed

У Stage не змінювалися:

- application code;
- client/admin UI;
- Prisma schema;
- migrations;
- database;
- Cloudinary/storage;
- authorization;
- AuditLog;
- API;
- package scripts;
- env;
- Telegram;
- deployment.

Єдина Stage-зміна — цей report.

## 29. Open questions

1. Чи дозволений upload/delete own document для archived Vehicle?
2. Чи має client download створювати AuditLog для всіх vehicle documents або лише sensitive categories?
3. Чи потрібна retention policy для deleted documents?
4. Чи 250 МБ cumulative quota погоджується з Cloudinary plan?
5. Чи client-source document company Vehicle має бути видимий усім current company members? Архітектурна рекомендація — так, але delete лише exact uploader.
6. Чи потрібен staff override для client document deletion lock?
7. Чи потрібен future explicit link `Request ↔ Vehicle Document`; без нього active-request lifecycle lock не рекомендується.
8. Чи `/api/client/vehicles` JSON API використовується зовнішнім consumer; це визначає safe deprecation/select strategy.

Жодне з цих питань не блокує Stage 2 security/provenance foundation.

## 30. Final recommendation

Однозначні відповіді:

1. Окрема `VehicleDocument` model: **ні**, використовується `Document`.
2. Current model фізично може зберігати client documents: **так**, але production rollout без provenance migration не рекомендується.
3. Reliable uploader provenance: exact uploader ID частково є; durable source/role — **ні**.
4. Migration: **required** для `Document.source`.
5. Безпечне розділення `Мої документи` / staff documents зараз: **ні**; після source migration — так.
6. CLIENT delete у current schema технічно можна перевірити по `uploadedById`, але current service/policy відсутні; без source не випускати.
7. Ownership: CLIENT session + `vehicleAccessWhere`; personal profile або current company membership.
8. Download: application authorization + visibility, server-side authenticated Cloudinary fetch, attachment/nosniff/private.
9. Asset deletion: Cloudinary `destroy(raw, authenticated)` перед DB delete.
10. Orphan risk: **так**, через non-atomic storage/DB і best-effort cleanup.
11. Limits: PDF/JPEG/PNG/WebP; 15 МБ/file; 5/60 МБ per batch; 25/250 МБ per Vehicle; filename 180.
12. Create architecture: **Vehicle first**, потім independent image/document services та recovery UI.
13. Stage 2 files: schema/migration, document validation/storage orchestration, client document actions/access, unsafe client Vehicle API, focused tests.
14. Stage 3 files: create form/action, detail/documents route, client manager/list, `/client/documents`, UI tests.
15. Runtime QA: authenticated personal/company/foreign access, staging Cloudinary upload/download/delete, partial failures, DB/audit/storage verification, responsive browser QA.

Blocker для Stage 2 не виявлено за умови, що Stage 2 починається з migration/provenance та API disclosure fix, а не з UI.

## 31. Git state

Pre-check:

```text
branch: develop
HEAD: 4328223 refactor: require change requests for client vehicles
Request Approval Stage 6 ancestor: 65104ffd45afa8b76685017a46c8e2241b5be0bc
status:
 M app/(public)/about/page.tsx
```

`app/client/vehicles/[id]/page.tsx` на початку Stage вже був committed у `4328223` і clean, попри допустиме очікування dirty file у prompt.

Control SHA-256 на початку:

```text
app/(public)/about/page.tsx:
7C552703FEF151B3DE96B59CCEAC0E0803772816BFD72F7A983C0A5B72CA23BB

app/client/vehicles/[id]/page.tsx:
92833B4B7F933EFE9AD4E851F51E9C58F3E339DE2EDCE780FEAE7E538C2920BD
```

Перед commit потрібно повторно підтвердити ці hashes. Stage має закомітити лише цей report. Push не виконується.

Під час validation у паралельному worktree з’явилася ще одна стороння unstaged-зміна:

```text
 M app/admin/requests/[id]/page.tsx
```

Вона не належить до цього Stage, не аналізувалася як Stage diff, не редагувалася і не має потрапити до staging. Обидва control hashes після validation збігаються з початковими.
