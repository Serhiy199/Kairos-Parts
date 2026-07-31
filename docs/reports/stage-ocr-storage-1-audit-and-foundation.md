# Stage OCR Storage 1 — Audit & Foundation

## 1. Executive summary

Stage виконано як read-only code-backed audit. Application code, Prisma schema, migrations, БД, Cloudinary assets, VPS, deployment та environment variables не змінювалися.

Однозначні висновки:

- **OCR canonical source model = `RequestFile`.**
- OCR result persistence model = `OCRResult`.
- Нові `RequestFile` створюють лише `POST /api/requests` і Telegram flow `attachTelegramFiles()`.
- Bytes `RequestFile` зараз зберігаються локально через `lib/files/local-storage.ts`.
- На Vercel upload пише в `os.tmpdir()/kairos-parts-uploads`, а OCR окремо шукає в `process.cwd()/uploads`. Це не лише недовговічність serverless filesystem, а й пряме розходження двох root paths.
- Exact failure guard розташований у `lib/ocr/service.ts`: `pathExists(localPath)` повертає `false`, після чого створюється `OCRResult` з повідомленням про недоступний local storage і `confidence: 0`.
- Engine = `tesseract.js` `5.1.1`, languages = `eng+ukr`. System Tesseract binary не використовується.
- Поточний UI дозволяє OCR лише для `RequestFile.mimeType`, що починається з `image/`.
- PDF OCR зараз не підтримується: UI не показує кнопку для PDF, service повертає контрольований `OTHER`, а `tesseract.js` не розпізнає PDF без попереднього render у images.
- Existing Cloudinary authenticated raw document infrastructure можна частково reuse: credential client, encoded storage locator, upload compensation, authenticated delete, short-lived server-side fetch та secure download proxy.
- Для request images потрібне розширення helper на `resource_type: "image"` із `type: "authenticated"`; для PDF/інших документів — `resource_type: "raw"`, але PDF OCR не входить у Stage 2.
- **MIGRATION REQUIRED** для явного provider/status/source contract, Cloudinary identifiers і надійної класифікації `CLOUDINARY / LEGACY_LOCAL / MISSING`.
- PostgreSQL на VPS не зберігає file bytes. Cloudinary залишається source of truth для нових request file bytes.
- `/tmp` дозволений лише як bounded ephemeral processing space. Source of truth у `/tmp` заборонений.

## 2. Current OCR user flow

1. CLIENT створює заявку через public request form, але API вимагає authenticated CLIENT session, або linked CLIENT надсилає файл через Telegram.
2. `RequestFile` metadata записується в PostgreSQL, bytes пишуться у local filesystem.
3. ADMIN/MANAGER відкриває `/admin/requests/[id]`.
4. Page відбирає `request.files.filter(file => file.mimeType.startsWith("image/"))`.
5. Form викликає `runAdminRequestOcr`.
6. Server Action викликає `runOcrForRequestFile({ requestId, fileId })`.
7. Service завантажує `RequestFile`, будує local path і перевіряє його існування.
8. Якщо path існує, `tesseract.js` виконує `recognize(localPath, "eng+ukr")`.
9. `OCRResult` створюється навіть для unsupported file, missing local file або engine exception.
10. Page refresh показує raw text, provider, confidence і форму correction.

Паралельно існує `POST /api/ocr`, який виконує той самий service після `requireCrmSession()`. Поточна CRM-кнопка використовує Server Action, а не API route.

## 3. OCR call graph

| Step | File/function | Input | Output | Failure mode |
| --- | --- | --- | --- | --- |
| UI | `app/admin/requests/[id]/page.tsx`, form `runAdminRequestOcr` | `requestId`, `fileId` | Server Action submission | Button існує лише для `image/*` |
| Server Action | `app/admin/actions.ts#runAdminRequestOcr` | `FormData` | redirect `ocr-created` або `ocr-error` | Missing DB/id; service throw; exception details discarded |
| API alternative | `app/api/ocr/route.ts#POST` | JSON `{requestId,fileId}` | JSON `OCRResult` projection | 400 validation, 401/403 auth redirect semantics, 500 service throw |
| Domain service | `lib/ocr/service.ts#runOcrForRequestFile` | `{requestId,fileId}` | persisted `OCRResult` | File pair absent throws |
| File lookup | `prisma.requestFile.findFirst` | matching id + requestId | `RequestFile` | No actor-aware request filter |
| MIME guard | `isImageMime` | DB `mimeType` | proceed or persisted `OTHER` result | Non-image stored as `rawText`, no typed status |
| Local resolver | `storageKeyToLocalPath` | `storageKey` | `process.cwd()/uploads/...` | Ignores `getUploadRoot()` and Vercel temp root |
| Existence guard | `pathExists` | local path | boolean | Missing produces persisted `TESSERACT`, confidence `0` |
| OCR engine | dynamic import `tesseract.js`, `recognize()` | local path, `eng+ukr` | text + confidence | No explicit timeout, concurrency gate or retry |
| Token extraction | `extractPartLikeToken` | raw text | one possible token | Same token assigned to part and serial |
| Persistence | `prisma.oCRResult.create` | result values | `OCRResult` | No status/errorCode/createdBy/attempt fields |
| UI refresh | `revalidatePath` + redirect | request page | latest results | Every retry creates another row |
| Correction | `updateAdminOcrCorrection` → `updateOcrCorrection` | `ocrResultId`, text | updated row | No requestId match in update query; no audit event |

## 4. OCR persistence model

`OCRResult`:

- primary key: `id String @id @default(cuid())`;
- request relation: required `requestId`, `onDelete: Cascade`;
- file relation: nullable `fileId` to `RequestFile`, `onDelete: SetNull`;
- engine: `provider OCRProvider`;
- recognized text: `rawText`;
- corrected text: nullable `correctedText`;
- extraction hints: nullable `possibleSerialNumber`, `possiblePartNumber`, `possibleModelNumber`;
- confidence: nullable `Float`;
- timestamps: `createdAt`, `updatedAt`;
- indexes: `requestId`, `fileId`.

Відсутні:

- explicit outcome/status;
- error code/error message;
- started/completed timestamps;
- duration;
- actor/createdBy;
- attempt/retry/version;
- storage provider snapshot;
- OCR language snapshot.

Current errors записуються у `rawText`, а `confidence: 0` не відрізняє storage failure, engine failure і реальний zero-confidence result.

## 5. Canonical source file model

**OCR canonical source model = `RequestFile`.**

`OCRResult.fileId` посилається лише на `RequestFile`. `RequestDocument`, `Document`, `VehicleImage` та `UsedEquipmentImage` не є OCR sources.

### File model map

| Model | Used by OCR | Physical storage | Storage metadata | Upload paths | Download paths | Uploader/provenance | Visibility |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `RequestFile` | Так | Local filesystem; Telegram fallback може мати лише metadata | `storageKey`, nullable `fileUrl`, MIME, size | `POST /api/requests`; Telegram `attachTelegramFiles` | ADMIN `/api/admin/files/[fileId]`; CLIENT бачить лише metadata | No field; infer from `Request.source` | CRM download; CLIENT metadata |
| `RequestDocument` | Ні | Local filesystem або external `fileUrl` | nullable `storageKey/fileUrl/mimeType/size` | Admin Server Action; admin documents API | Admin/client request-document file proxies або redirect | nullable `uploadedById` | explicit `visibleToClient` |
| `Document` | Ні | Cloudinary authenticated raw | encoded Cloudinary locator у `storageKey` | Vehicle/client/company/admin document flows | Authenticated server-side proxy routes | `source`, nullable `uploadedById` | explicit `visibleToClient` + owner scope |
| `VehicleImage` | Ні | Cloudinary image | explicit `publicId`, `secureUrl`, format/dimensions/bytes | Vehicle image flows | Direct Cloudinary URL via image presentation | no uploader field; audit actor | vehicle owner/staff UI |
| `UsedEquipmentImage` | Ні | Cloudinary image | `cloudinaryPublicId`, public URL and image metadata | Used-equipment admin actions | Public image URL | staff action/audit context | public when item published |
| Telegram draft metadata | Ні, до request creation | Telegram server until downloaded | Telegram `fileId`, name, MIME, size in JSON | Telegram webhook/session | Internal bot download only | Telegram linked CLIENT | internal draft |

Не можна переводити `RequestDocument` або загальний `Document` у canonical OCR source без окремої domain migration. Stage 2 має змінювати тільки `RequestFile` paths.

## 6. Current upload routes

### Upload route map

| Route/action | Actor | Model | Storage | Validation | Cleanup |
| --- | --- | --- | --- | --- | --- |
| `POST /api/requests` | Authenticated CLIENT; personal/company context | `Request`, потім `RequestFile` per file | `saveRequestFileLocal()` | extension + MIME, per-file default 20 MB | Немає file compensation; request/files не в одній transaction |
| Telegram `createTelegramRequest` → `attachTelegramFiles` | Linked registered CLIENT through bot | `RequestFile` | Telegram download → `saveRequestFileBufferLocal()` | extension allowlist, 20 MB | При failure створює metadata-only `telegram/<fileId>` record; no remote cleanup |
| `createAdminRequestDocument` | MANAGER/ADMIN | `RequestDocument` | `saveRequestDocumentLocal()` | type/title; extension/MIME; 20 MB | Немає local file cleanup on DB failure |
| `POST /api/admin/requests/[id]/documents` | MANAGER/ADMIN | `RequestDocument` | `saveRequestDocumentLocal()` | same request-document validation | Немає local file cleanup on DB failure |
| Vehicle document actions | CLIENT owner/company member; MANAGER/ADMIN | `Document` | Cloudinary `raw/authenticated` | signature, MIME, extension, count and quotas | Best-effort Cloudinary compensation |
| Company/client document admin action | MANAGER/ADMIN | `Document` | Cloudinary `raw/authenticated` | reused vehicle-document validation | Cloudinary compensation |
| Vehicle image actions | scoped CLIENT; MANAGER/ADMIN | `VehicleImage` | Cloudinary `image` | JPEG/PNG/WebP, 8 MB, count 10 | Cloudinary compensation |
| Used-equipment image actions | ADMIN/MANAGER according to page guard | `UsedEquipmentImage` | Cloudinary `image` | used-equipment image validation | Cloudinary compensation |
| Seed helper | Development/seed | `RequestFile` | Metadata only, non-production fixture path | none | none |

Не знайдено:

- CLIENT request-detail upload, який додає новий `RequestFile` після створення;
- CRM upload, який створює `RequestFile`;
- contact-message attachment model;
- change-request attachment model;
- legacy public anonymous request-file upload у current code.

## 7. Current local storage implementation

`lib/files/local-storage.ts`:

- custom root: `path.resolve(KAIROS_UPLOAD_DIR)`;
- Vercel root: `path.join(os.tmpdir(), "kairos-parts-uploads")`;
- other runtime root: `path.join(process.cwd(), "uploads")`;
- namespaces: `request-files/<requestId>/...` і `request-documents/<requestId>/...`;
- filename: `Date.now()` + ASCII sanitization;
- `storageKey`: relative slash-normalized path;
- writes full `Buffer` with `writeFile`;
- no checksum;
- no delete helper;
- no orphan cleanup;
- no backup contract.

`lib/files/secure-local-file.ts` correctly rejects absolute/traversal keys and resolves against `getUploadRoot()`.

OCR does **not** reuse this resolver. `lib/ocr/service.ts#storageKeyToLocalPath` always uses:

```text
process.cwd()/uploads/<storageKey>
```

On Vercel upload and OCR roots are therefore different:

```text
upload → os.tmpdir()/kairos-parts-uploads/<storageKey>
OCR    → process.cwd()/uploads/<storageKey>
```

Навіть якщо paths збіглися б у межах одного invocation, Vercel filesystem не є durable shared source of truth між invocations та instances.

## 8. Current preview and download flow

### `RequestFile`

- ADMIN/MANAGER: `/api/admin/files/[fileId]`.
- Guard: active CRM session; DB lookup by file id.
- File path: `readLocalUpload(storageKey)`.
- Response: inline `Content-Disposition`, DB MIME, private cache 60 seconds.
- Audit: `DOCUMENT_DOWNLOADED`.
- Missing: `X-Content-Type-Options: nosniff`, explicit `Content-Length`, no-store, provider dispatch.
- CLIENT: request detail shows only filename and size; download route відсутній.

### `RequestDocument`

- ADMIN route: `/api/admin/request-documents/[documentId]/file`.
- CLIENT route: `/api/client/request-documents/[documentId]/file`.
- CLIENT guard: `visibleToClient` plus `requestAccessWhere(access)`.
- If `fileUrl` exists, route redirects directly.
- Otherwise reads local storage.
- Financial/private downloads are audited selectively.
- Current response is inline and uses private max-age 60.

### `Document`

- Cloudinary bytes are fetched server-side through a short-lived private download URL.
- CLIENT access uses owner/company/request/vehicle scope.
- Response includes `nosniff`, `Content-Length`, `private, no-store`, safe UTF-8 attachment filename.
- Private Cloudinary URL is not exposed to the browser.

Future `RequestFile` download must follow the secure `Document` proxy pattern, not redirect to Cloudinary and not expose signed/private URLs.

## 9. Current OCR file loading

Exact current flow:

```text
RequestFile DB record
→ verify fileId + requestId
→ reject non-image as persisted OTHER result
→ process.cwd()/uploads/<storageKey>
→ fs.access()
→ dynamic import tesseract.js
→ recognize(localPath, "eng+ukr")
→ persist OCRResult
```

Exact proposed flow:

```text
validated CRM actor
→ RequestFile scoped by requestId and actor access
→ provider/status dispatch
→ authenticated Cloudinary server-side byte fetch
→ byte count + MIME/signature revalidation
→ unique temp directory/file when adapter needs path
→ bounded tesseract.js execution
→ persist typed result and audit
→ finally remove temp directory
```

## 10. OCR engine and runtime

Current engine:

- package: `tesseract.js` `^5.1.1`, lockfile resolves `5.1.1`;
- implementation: WebAssembly/Node worker runtime, not system `tesseract` binary;
- languages: `eng+ukr`;
- API: convenience `recognize()` per request;
- input: local file path;
- no explicit worker reuse;
- no timeout or abort;
- no concurrency control;
- no local `langPath`, worker/core path or deterministic traineddata provisioning;
- no preprocessing;
- no image dimension guard.

Installed TypeScript contract `ImageLike` does not include Node `Buffer`, while current working code passes a string path. Stage 2 should keep a path-based adapter over a safe temporary file unless the exact installed runtime Buffer behavior is proven by a focused test.

Conclusion:

```text
VPS RUNTIME CHANGES REQUIRED
```

Це не означає mandatory system Tesseract packages. Для current image-only `tesseract.js`:

- `tesseract-ocr`, `tesseract-ocr-eng`, `tesseract-ocr-ukr` **не потрібні**;
- потрібен supported Node.js runtime, достатні CPU/RAM, outbound HTTPS або bundled/local traineddata;
- потрібні deterministic language data/cache policy, timeout і concurrency limit;
- Dockerfile у repository відсутній, тому production image provisioning ще не зафіксований кодом.

Для майбутнього PDF render можуть знадобитися `poppler-utils`/`pdftoppm`, але це не Stage 2 image-only dependency і не має встановлюватися без окремого PDF Stage.

## 11. PDF handling

- Request upload приймає PDF.
- Telegram приймає PDF.
- OCR UI відбирає лише `image/*`; PDF button не показується.
- Direct service call для PDF створює `OCRResult` provider `OTHER` з текстом «файл не є зображенням».
- PDF → image converter у repository відсутній.
- `tesseract.js` не підтримує PDF input напряму; official project documentation вимагає third-party render у images.

Stage 2 recommendation:

- OCR enabled only for validated JPEG/PNG;
- PDF залишається downloadable, але OCR button disabled/absent;
- PDF OCR винести в окремий Stage після вибору converter, page/dimension limits і VPS/Vercel runtime.

## 12. Existing Cloudinary infrastructure

`lib/cloudinary/server.ts`:

- validates `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`;
- lazily configures server client;
- uploads image assets;
- supports image destroy and best-effort cleanup.

`lib/files/cloudinary-vehicle-documents.ts`:

- `server-only`;
- uploads `resource_type: "raw"`, `type: "authenticated"`;
- generates random public id;
- encodes `{publicId, format}` into opaque `storageKey`;
- deletes authenticated raw asset;
- batch cleanup with failure count;
- creates 60-second private download URL server-side;
- fetches bytes with `cache: "no-store"`;
- never returns private URL to caller/browser.

`lib/vehicles/document-service.ts` and `app/admin/documents/actions.ts` demonstrate:

- validation before upload;
- upload outside DB transaction;
- DB transaction for rows + audit;
- compensating Cloudinary delete if DB phase fails;
- structured log for compensation failure in vehicle service.

## 13. Reusable storage helpers

### Storage capability map

| Capability | Local storage | Existing Cloudinary | Required future state |
| --- | ---: | ---: | ---: |
| Durable bytes across deploy/instances | Ні | Так | Cloudinary |
| Authenticated asset delivery | Ні | Так, raw documents | Так, image + raw |
| Server-side byte fetch | Так, filesystem read | Так, authenticated raw helper | Provider-neutral bounded fetch |
| Explicit provider/status in `RequestFile` | Ні | Ні | Так |
| Upload compensation | Ні | Так | Так |
| Safe download proxy | Частково | Так | Так |
| Integrity checksum | Ні | Ні | Так для migration/backfill |
| Missing legacy classification | Runtime 404 only | Ні | Persisted `MISSING` |
| OCR source of truth | Local path | Не використовується | Cloudinary authenticated bytes |

### Reuse directly

- `getCloudinaryServerClient()`;
- `hasCloudinaryConfig()`;
- safe filename logic from vehicle documents;
- private server-side fetch pattern;
- compensation pattern;
- `nosniff`, no-store and Content-Disposition response pattern;
- actor/owner authorization patterns.

### Refactor before reuse

Current `cloudinary-vehicle-documents.ts` is vehicle/document-named and raw-only. Stage 2 should extract a provider-neutral authenticated asset helper, for example:

```text
lib/files/cloudinary-authenticated-assets.ts
```

Required capabilities:

- upload authenticated `image` or `raw`;
- return public id, resource type, delivery type, version, format and bytes;
- fetch bytes with timeout and max-byte enforcement;
- delete by explicit typed locator;
- never log signed URL or credentials;
- encode/decode transitional storage key only in one place.

Request images should use:

```text
resource_type = image
type = authenticated
folder = kairos-parts/request-files/<requestId>
```

Non-image request files may use `raw/authenticated`, but Stage 2 OCR processing remains image-only.

## 14. Authorization and ownership

### Current access matrix

| Operation | CLIENT owner | Company member | Other CLIENT | MANAGER | ADMIN |
| --- | ---: | ---: | ---: | ---: | ---: |
| Upload request file | Так, only during own request creation | Так, request created in company context | Ні | Ні for `RequestFile` | Ні for `RequestFile` |
| Preview/download `RequestFile` | Немає route | Немає route | Ні | Так, global CRM | Так |
| Run OCR | Ні | Ні | Ні | Так, global CRM | Так |
| View OCR result | Ні | Ні | Ні | Так, on CRM request page | Так |
| Correct OCR text | Ні | Ні | Ні | Так | Так |
| Delete `RequestFile` | Немає operation | Немає | Немає | Немає | Немає |

Telegram upload доступний лише після linkage до registered CLIENT profile.

Current MANAGER/ADMIN policy is global CRM access; assigned-manager restriction не реалізований. Тому відсутність assigned-manager predicate не є окремою regression у цьому Stage.

Direct bypass findings:

- `runOcrForRequestFile` verifies fileId/requestId pair, але не приймає actor;
- `POST /api/ocr` і Server Action захищені active CRM session;
- `updateOcrCorrection` updates only by `ocrResultId` and does not verify supplied `requestId` or actor access in service;
- no OCR-specific audit.

Future service must accept actor and resolve the record with request access in the same query. Correction must scope by both `ocrResultId` and `requestId`; if manager assignment policy appears later, it must be applied centrally.

## 15. Current validation and limits

### Current `RequestFile`

- per-file upload max: `FILE_UPLOAD_MAX_SIZE_MB`, default 20 MB;
- allowed form extensions: JPG/JPEG, PNG, PDF, XLS/XLSX, CSV, DOC/DOCX;
- validation uses extension + declared MIME; no magic-byte validation;
- empty file filtering exists;
- no max files per Request;
- no total Request quota;
- no image dimension/page count checks;
- Telegram max 20 MB and extension allowlist;
- Telegram document MIME is not signature-verified.

### Recommended Stage 2 policy

- upload: retain 20 MB per file for general request attachments;
- maximum 10 `RequestFile` records per Request;
- maximum 100 MB total bytes per Request;
- OCR: JPEG/PNG only;
- OCR max bytes: 10 MB;
- OCR max decoded dimensions: 25 megapixels;
- Cloudinary fetch timeout: 15 seconds;
- OCR execution timeout: 60 seconds;
- one OCR file per action;
- concurrency: one active OCR job per server process until a queue/worker is introduced;
- reject declared MIME/signature mismatch before Cloudinary upload;
- recheck received bytes and size before OCR;
- download: enforce DB size/upload policy and no unbounded buffering.

These values are implementation recommendations and require product/runtime confirmation in Stage 2 tests; they are not current behavior.

## 16. Current cleanup behavior

- `RequestFile` local upload: no delete helper, no compensation, no retention job.
- Request creation: request DB row is created before file writes; partial files/request can remain after failure.
- Telegram: on download/storage failure, a metadata-only `RequestFile` is intentionally created.
- `RequestDocument`: DB delete does not delete local bytes.
- Cloudinary `Document`: upload compensation exists.
- Vehicle document delete may leave an orphan asset or deleted DB row depending on phase; failure is surfaced/logged.
- OCR: no temp file because it directly uses local source path.

Stage 2 must use upload → DB transaction → best-effort asset cleanup on DB failure. Cleanup failure must be logged with file/request ids and provider, without public id or signed URL in user-facing response.

## 17. Legacy local records

Future inventory classifications:

```text
CLOUDINARY
LEGACY_LOCAL
MISSING
```

With proposed fields:

- provider `CLOUDINARY` + status `AVAILABLE` → `CLOUDINARY`;
- provider `LEGACY_LOCAL` + verified path → `LEGACY_LOCAL`;
- status `MISSING` regardless of provider history → `MISSING`;
- old records start `UNVERIFIED`, not falsely `AVAILABLE`.

### Available local file on VPS

```text
resolve through KAIROS_UPLOAD_DIR/getUploadRoot
→ verify safe relative key
→ stat/read bounded bytes
→ validate MIME/signature
→ SHA-256
→ upload authenticated Cloudinary asset
→ compare returned bytes
→ conditional DB update
→ audit migration
→ retain local file for approved retention window
```

### Missing local file

```text
mark storageStatus = MISSING
→ preserve filename/MIME/size/storageKey/history
→ block OCR with stable FILE_MISSING code
→ keep record visible as unavailable
```

### Vercel old records

Files written to a previous Vercel temp filesystem are probably irrecoverable. Backfill must report `MISSING`; it must not claim migration success without bytes.

## 18. Migration decision

```text
MIGRATION REQUIRED
```

Reason: `storageKey` alone can encode a Cloudinary locator, as existing `Document` code proves, but it cannot safely persist explicit provider, verification/missing state, source provenance, checksum and migration outcome required for reliable legacy classification and operations.

### Migration decision table

| Current field | Problem | Proposed field | Backfill | Required |
| --- | --- | --- | --- | ---: |
| `storageKey` | Ambiguous local path/provider locator | Keep for compatibility | Preserve old value; set opaque Cloudinary locator for new/migrated | Так, retained |
| none | Provider unknown | `storageProvider RequestFileStorageProvider` | default `LEGACY_LOCAL` | Так |
| none | Availability unverified | `storageStatus RequestFileStorageStatus` | default `UNVERIFIED`, inventory sets value | Так |
| none | No explicit Cloudinary id | `storagePublicId String?` | set after verified upload | Так |
| none | image/raw dispatch unknown | `storageResourceType String?` | `image` or `raw` | Так |
| none | authenticated delivery unknown | `storageDeliveryType String?` | `authenticated` | Так |
| none | asset version absent | `storageVersion Int?` | Cloudinary response when available | Так |
| none | asset format absent | `storageFormat String?` | Cloudinary response | Так |
| none | integrity absent | `storageChecksumSha256 String?` | calculated from source bytes | Так |
| none | source provenance absent | `source RequestFileSource` | infer from `Request.source`, otherwise `LEGACY` | Так |
| none | migration timestamp absent | `migratedAt DateTime?` | set only after successful conditional update | Так |

## 19. Proposed Cloudinary schema

Implementation proposal:

```prisma
enum RequestFileStorageProvider {
  LEGACY_LOCAL
  CLOUDINARY
}

enum RequestFileStorageStatus {
  UNVERIFIED
  AVAILABLE
  MISSING
}

enum RequestFileSource {
  CLIENT_FORM
  TELEGRAM
  LEGACY
}

model RequestFile {
  // existing fields remain
  storageProvider       RequestFileStorageProvider @default(LEGACY_LOCAL)
  storageStatus         RequestFileStorageStatus   @default(UNVERIFIED)
  storagePublicId       String?
  storageResourceType   String?
  storageDeliveryType   String?
  storageVersion        Int?
  storageFormat         String?
  storageChecksumSha256 String?
  source                RequestFileSource          @default(LEGACY)
  migratedAt            DateTime?

  @@index([storageProvider, storageStatus])
  @@index([storagePublicId])
}
```

Migration SQL should add consistency constraints:

- `CLOUDINARY + AVAILABLE` requires non-null public id, resource type and delivery type;
- Cloudinary delivery type must be `authenticated`;
- resource type restricted to `image` or `raw`;
- checksum, when present, must be a 64-character lowercase SHA-256 hex string;
- `LEGACY_LOCAL` must not require Cloudinary fields.

No new file model is needed. `OCRResult` schema changes are not required to fix storage retrieval, але typed OCR status/error/actor should be a separately approved observability extension rather than silently expanding Stage 2.

## 20. Proposed new upload architecture

Proposed service:

```text
uploadRequestFilesForActor()
```

Flow:

```text
validate active actor and Request ownership/context
→ validate count/total quota
→ validate extension + declared MIME + magic bytes + size
→ choose image/raw resource type
→ upload to Cloudinary authenticated namespace
→ transaction: recheck quota, create RequestFile metadata, write audit
→ return safe metadata
```

DB failure after upload:

```text
best-effort Cloudinary destroy
→ structured compensation log
→ no false success
→ generic user error without storage identifiers
```

Required producers:

- `POST /api/requests`;
- Telegram `attachTelegramFiles`.

Stage 2 must not switch `RequestDocument`/`Document` producers into this service.

## 21. Proposed download architecture

Proposed route/service split:

```text
authorizeRequestFileRead(actor, fileId)
→ loadRequestFileMetadata()
→ loadRequestFileBytes()
→ audit
→ secure proxy response
```

Response:

- server-side Cloudinary fetch;
- no direct private URL;
- exact safe MIME;
- `Content-Length`;
- safe UTF-8 `Content-Disposition`;
- `X-Content-Type-Options: nosniff`;
- `Cache-Control: private, no-store`;
- no range support in Stage 2 unless proven necessary;
- controlled `404 FILE_MISSING` for legacy/missing records.

ADMIN/MANAGER route can replace `/api/admin/files/[fileId]` internally without changing CRM URL. CLIENT download should remain out of scope unless explicitly approved; current client UI only displays metadata.

## 22. Proposed OCR retrieval architecture

Proposed helper:

```ts
type LoadedRequestFileForProcessing =
  | {
      ok: true;
      buffer: Buffer;
      mimeType: "image/jpeg" | "image/png";
      originalName: string;
      sizeBytes: number;
      storageProvider: "CLOUDINARY";
    }
  | {
      ok: false;
      code:
        | "FILE_NOT_FOUND"
        | "FILE_MISSING"
        | "LEGACY_FILE_UNAVAILABLE"
        | "UNSUPPORTED_MIME"
        | "FILE_TOO_LARGE"
        | "STORAGE_TIMEOUT"
        | "STORAGE_ERROR";
    };
```

Suggested service:

```text
loadRequestFileForProcessing({ actor, requestId, fileId })
```

Responsibilities:

1. Validate active actor and CRM role.
2. Query file and Request access together.
3. Require `storageProvider = CLOUDINARY` and `storageStatus = AVAILABLE`, or return explicit legacy result.
4. Download bytes server-side with 15-second timeout.
5. Enforce actual max size while reading.
6. Verify MIME and magic bytes.
7. Never expose signed URL/private id.
8. Return typed error, not OCR text containing an infrastructure error.
9. Produce safe structured logs.
10. Leave temp-file lifecycle to OCR adapter.

## 23. Temp file policy

Because current `tesseract.js` call and installed types use a path:

```text
Cloudinary Buffer
→ fs.mkdtemp(path.join(os.tmpdir(), "kairos-ocr-"))
→ random generated basename + validated extension
→ writeFile(..., { mode: 0o600 })
→ tesseract.js recognize(tempPath, "eng+ukr")
→ finally rm(tempDir, { recursive: true, force: true })
```

Rules:

- never use original filename as path;
- one unique directory per attempt;
- enforce bytes/dimensions before write;
- timeout must terminate/clean worker before deleting temp file;
- cleanup in `finally`;
- process crash can leave temp data until OS/container cleanup, so `/tmp` footprint and concurrency must be bounded;
- `/tmp` is never backed up and never referenced from DB;
- on VPS use `os.tmpdir()`; do not hardcode a durable upload folder.

## 24. Audit Log contract

Current audit has document upload/download/delete events, але no OCR events and no `REQUEST_FILE` entity type.

Minimum proposed actions:

- `REQUEST_FILE_UPLOADED`;
- `REQUEST_FILE_DOWNLOADED`;
- `REQUEST_FILE_MIGRATED`;
- `REQUEST_FILE_MARKED_MISSING`;
- `OCR_STARTED`;
- `OCR_COMPLETED`;
- `OCR_FAILED`;
- `OCR_CORRECTED`.

Minimum metadata:

```json
{
  "requestId": "<id>",
  "fileId": "<id>",
  "storageProvider": "CLOUDINARY",
  "ocrEngine": "TESSERACT_JS",
  "mimeType": "image/jpeg",
  "sizeBytes": 123456,
  "outcome": "SUCCESS"
}
```

Do not audit:

- credentials;
- signed URLs;
- public id unless security policy explicitly permits;
- raw bytes;
- full OCR text;
- private local path;
- language data URLs.

## 25. Vercel staging compatibility

### Storage

Cloudinary authenticated storage and server-side fetch are compatible with Vercel Node runtime and remove durable local filesystem dependency.

### OCR runtime

`tesseract.js` is Node/WASM and does not require a system binary, але current code has no:

- deterministic traineddata packaging/cache;
- explicit function duration;
- memory/concurrency control;
- timeout/abort;
- runtime proof for `eng+ukr` on current Vercel plan.

Expected support:

```text
STORAGE READY AFTER STAGE 2
OCR CONDITIONALLY SUPPORTED, RUNTIME QA REQUIRED
```

If Vercel OCR exceeds actual plan limits, preferred fallback order:

1. OCR-only external/VPS worker with same Cloudinary source;
2. staging OCR disabled with explicit feature gate and controlled message;
3. do not reintroduce local durable storage.

### Runtime matrix

| Environment | File storage | OCR engine | Temp files | Expected support |
| --- | --- | --- | --- | --- |
| Local development now | Local `uploads` | `tesseract.js` `eng+ukr` | Source file itself | Works only while local file exists |
| Vercel staging now | Ephemeral temp upload, mismatched OCR root | `tesseract.js` | Ephemeral | Storage flow broken |
| Vercel after Stage 2 | Cloudinary authenticated | `tesseract.js` with bounded runtime | `os.tmpdir()` only | Conditional; runtime QA required |
| VPS before Stage 2 | Local upload path | `tesseract.js` | Source file itself | Possible but not provider-safe |
| VPS after Stage 2 | Cloudinary authenticated | `tesseract.js` with deterministic languages | `os.tmpdir()` only | Expected after runtime provisioning |
| Future PDF OCR | Cloudinary authenticated | Tesseract + PDF renderer | bounded per-page images | Separate Stage |

## 26. VPS production compatibility

Cloudinary remains source of truth even with PostgreSQL and app on one VPS.

VPS requirements:

- Node version supported by Next.js and `tesseract.js`;
- outbound HTTPS to Cloudinary and language-data source, unless language data bundled;
- Cloudinary credentials;
- writable bounded `os.tmpdir()`;
- enough memory/CPU for one OCR worker;
- 60-second application timeout policy;
- concurrency limit/queue;
- structured logs and alerting;
- no file bytes in PostgreSQL backups;
- DB backup covers metadata only;
- Cloudinary retention/versioning/backup policy handled separately.

## 27. Docker/system dependency requirements

Repository contains no Dockerfile/docker-compose production definition.

For image-only Stage 2 using current `tesseract.js`:

```text
APT PACKAGES REQUIRED: none
```

Required application/runtime work:

- deterministic `eng+ukr` traineddata strategy;
- verify WASM/worker artifacts in Next build output;
- configure egress or local `langPath`;
- bounded cache/temp path;
- worker cleanup and timeout;
- production Node memory observation.

For a future PDF Stage only:

- evaluate `poppler-utils`/`pdftoppm` or another renderer;
- add packages to a committed Dockerfile/provisioning layer;
- add PDF page count, dimensions and timeout limits.

## 28. Backfill/migration script design

One-off script, not a request handler:

```text
scripts/migrate-request-files-to-cloudinary.ts
```

Required modes:

- mandatory `--dry-run`;
- explicit `--apply`;
- batch size default 25;
- resumable/idempotent;
- provider/status filter;
- no overwrite of already migrated rows;
- safe path resolution through current upload root;
- SHA-256 and byte-size verification;
- retry transient Cloudinary errors with capped exponential backoff;
- conditional DB update using old storage key/provider/status;
- progress counts: scanned, cloudinary, legacy available, missing, migrated, failed, skipped;
- machine-readable report without secrets/private ids;
- no local delete during initial backfill.

Rollback limit:

- DB locator can be reverted only while retained local bytes still exist;
- once local retention expires, Cloudinary deletion is not a safe rollback;
- missing Vercel temp files cannot be reconstructed.

## 29. Rollout order

### Staging

```text
Stage 2 implementation in develop
→ focused tests and build
→ additive migration commit
→ Neon staging prisma migrate status
→ Neon staging migrate deploy
→ Vercel staging deploy
→ verify Cloudinary env
→ create new CLIENT request with JPEG/PNG
→ verify secure preview/download
→ run OCR and correction
→ verify audit/events and no private URL exposure
→ classify existing staging records read-only/dry-run
```

### Production

```text
merge/deploy approved code; no manual VPS code edits
→ backup VPS PostgreSQL
→ verify migration status and apply pending migrations
→ deploy application artifact
→ verify Cloudinary credentials and egress
→ verify Node/WASM/language runtime
→ dry-run legacy inventory
→ migrate available legacy files in bounded batches
→ retain local originals for approved window
→ production smoke test
→ monitor OCR latency, memory, storage fetch and orphan cleanup
```

## 30. Regression surface

- CLIENT request creation;
- company-scoped request creation;
- Telegram request attachments and metadata-only fallback;
- CRM request file list and preview;
- existing request-document upload/download;
- vehicle/company/client Cloudinary documents;
- OCR run, failure, correction and retries;
- request deletion cascade;
- OCR file relation `onDelete: SetNull`;
- audit-log presentation;
- upload quotas and large forms;
- Vercel function bundle/runtime;
- Telegram bot response time;
- Cloudinary cleanup on DB failure;
- legacy local reads during transition;
- Prisma seed fixture.

## 31. Runtime QA checklist

1. New JPEG request file persists as `CLOUDINARY/AVAILABLE`.
2. New PNG request file persists and previews.
3. Cloudinary asset is authenticated, not anonymously reachable.
4. CRM download proxy returns `nosniff`, no-store and safe filename.
5. Browser receives no signed/private Cloudinary URL.
6. OCR extracts `eng` and `ukr` text.
7. OCR uses bytes from Cloudinary after a separate request/instance.
8. Temp file is removed after success.
9. Temp file is removed after OCR failure/timeout.
10. Oversized and signature-mismatched files are rejected.
11. PDF has no OCR button.
12. Missing legacy record returns controlled reason, not confidence `0` fake result.
13. Repeated OCR creates expected attempt/history without corrupting previous result.
14. Correction is scoped to request/result and audited.
15. Other CLIENT cannot access metadata/bytes.
16. Same-company CLIENT behavior matches approved visibility policy.
17. MANAGER and ADMIN can operate within current CRM policy.
18. DB failure after Cloudinary upload triggers asset compensation.
19. Compensation failure creates structured operational log.
20. Vercel OCR duration and peak memory are recorded.
21. VPS worker/language data runs without hidden interactive download failure.
22. Backfill dry-run is idempotent.
23. Missing Vercel records remain preserved as metadata/history.
24. No raw OCR text, credentials or signed URL enters audit.

## 32. Files inspected

Core OCR and UI:

- `app/admin/requests/[id]/page.tsx`;
- `app/admin/actions.ts`;
- `app/api/ocr/route.ts`;
- `lib/ocr/service.ts`;
- `lib/ocr/types.ts`;
- `lib/admin/request-feedback.ts`.

Request file upload/storage/download:

- `app/api/requests/route.ts`;
- `app/(public)/request/request-form.tsx`;
- `lib/requests/validation.ts`;
- `lib/files/upload-policy.ts`;
- `lib/files/local-storage.ts`;
- `lib/files/secure-local-file.ts`;
- `lib/files/types.ts`;
- `app/api/admin/files/[fileId]/route.ts`;
- `app/client/requests/[id]/page.tsx`;
- `lib/telegram/session.ts`;
- `lib/telegram/bot.ts`;
- `prisma/seed.ts`.

Request documents:

- `lib/request-documents/validation.ts`;
- `app/api/admin/requests/[id]/documents/route.ts`;
- `app/api/admin/request-documents/[documentId]/file/route.ts`;
- `app/api/client/request-documents/[documentId]/file/route.ts`;
- `app/api/admin/request-documents/[documentId]/route.ts`.

Cloudinary/document infrastructure:

- `lib/cloudinary/server.ts`;
- `lib/files/cloudinary-vehicle-documents.ts`;
- `lib/vehicles/documents.ts`;
- `lib/vehicles/document-service.ts`;
- `lib/vehicles/image-mutations.ts`;
- `lib/vehicles/images.ts`;
- `app/admin/documents/actions.ts`;
- `app/api/admin/documents/[documentId]/download/route.ts`;
- `app/api/client/documents/[documentId]/download/route.ts`;
- `app/api/admin/vehicle-documents/[documentId]/download/route.ts`;
- `app/api/client/vehicle-documents/[documentId]/download/route.ts`;
- `lib/documents/ownership.ts`;
- `lib/documents/source.ts`.

Schema/runtime/access:

- `prisma/schema.prisma`;
- initial and request-document migrations;
- `package.json`;
- `package-lock.json`;
- installed `tesseract.js` type/docs files;
- `next.config.ts`;
- `lib/admin/access.ts`;
- `lib/client/access.ts`;
- `lib/audit-log/contracts.ts`;
- `lib/audit-log/presentation.ts`.

Official runtime references:

- Tesseract.js repository: <https://github.com/naptha/tesseract.js>;
- Tesseract.js FAQ, PDF support: <https://github.com/naptha/tesseract.js/blob/master/docs/faq.md>;
- Tesseract.js API: <https://github.com/naptha/tesseract.js/blob/master/docs/api.md>.

## 33. Not changed

- application code;
- Prisma schema;
- migrations;
- database data;
- Cloudinary assets/config;
- OCR behavior;
- Telegram behavior;
- Docker/VPS packages;
- environment variables;
- deployment configuration;
- Vercel project state;
- production VPS;
- unrelated files.

No live OCR, DB query/write, Cloudinary upload/delete, migration, backfill, deployment or push was performed.

## 34. Open questions

1. Чи Stage 2 має додати CLIENT download для власних `RequestFile`, чи залишити metadata-only UI?
2. Чи затвердити recommended 10 files/100 MB per Request і 10 MB OCR limit?
3. Чи потрібен OCR на Vercel staging як hard requirement, або допустимий external/VPS worker після runtime measurement?
4. Де фактично лежать legacy production bytes і яке значення `KAIROS_UPLOAD_DIR` на VPS? Потрібен окремо дозволений read-only inventory.
5. Який Cloudinary retention/backup policy доступний на поточному plan?
6. Чи додавати typed `OCRResult.status/errorCode/createdBy/duration` у Stage 2, чи винести в окремий observability Stage?
7. PDF OCR залишається окремим Stage.

## 35. Final recommendation

Stage 2 слід реалізувати вузько:

1. Additive `RequestFile` storage migration.
2. Provider-neutral authenticated Cloudinary asset helper.
3. Cloudinary-backed `RequestFile` upload for CLIENT request creation and Telegram.
4. Secure provider-aware ADMIN download proxy.
5. Actor-aware `loadRequestFileForProcessing`.
6. Image-only OCR through bounded temp file and `tesseract.js`.
7. Upload/OCR audit actions.
8. Dry-run legacy inventory tool, без automatic delete.
9. Neon/Vercel staging migration and browser QA before VPS rollout.

Не переводити `RequestDocument`, `Document`, vehicle images або used-equipment images у цей workflow.

### Implementation file map

| Future task | Existing files | New files | Migration | Risk |
| --- | --- | --- | ---: | --- |
| Add storage contract | `prisma/schema.prisma` | migration SQL | Так | Backfill defaults/constraints |
| Generic authenticated assets | `lib/cloudinary/server.ts`, `lib/files/cloudinary-vehicle-documents.ts` | `lib/files/cloudinary-authenticated-assets.ts` | Ні | Incorrect resource/delivery type |
| RequestFile storage service | `lib/files/local-storage.ts`, `app/api/requests/route.ts`, `lib/telegram/session.ts` | `lib/files/request-file-storage.ts` | Uses new fields | Orphan asset/partial request |
| Secure request-file loader | `app/api/admin/files/[fileId]/route.ts` | `lib/files/request-file-loader.ts` | Uses new fields | IDOR/private URL exposure |
| OCR retrieval/adapter | `lib/ocr/service.ts`, `app/admin/actions.ts`, `app/api/ocr/route.ts` | optional `lib/ocr/tesseract-adapter.ts` | Ні | Timeout, memory, temp cleanup |
| Audit events | `lib/audit-log/contracts.ts`, presentation/service | focused tests | Ні | Sensitive metadata leakage |
| Legacy inventory/backfill | `lib/files/secure-local-file.ts` | `scripts/migrate-request-files-to-cloudinary.ts` | After schema | Irrecoverable missing files |
| Runtime tests | current script conventions | OCR storage/authorization checks | Ні | False static confidence |

## 36. Git state

Pre-check:

```text
branch = develop
worktree = clean
dirty file fingerprints = not applicable
HEAD before report = 6cb51fa fix: clean invoice print layout
```

Stage scope:

```text
docs/reports/stage-ocr-storage-1-audit-and-foundation.md
```

Очікуваний commit:

```text
docs: audit OCR request file storage
```

Push у цьому Stage заборонений.
