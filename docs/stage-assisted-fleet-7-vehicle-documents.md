# Stage Assisted Fleet 7 — Vehicle documents

## Scope

Stage 7 adds documents that belong directly to a `Vehicle`. ADMIN and MANAGER can upload, download, expose to the client, hide, and delete them from the CRM vehicle edit page. CLIENT receives read-only access only to documents explicitly marked `visibleToClient` and only inside the existing personal/company vehicle scope.

The generic `Document` model was extended instead of creating another overlapping document model. `RequestDocument` and request document flows were not changed.

## Data model

Migration: `20260719150000_add_vehicle_document_management`.

Added to `Document`:

- `visibleToClient Boolean @default(false)`;
- nullable `uploadedById` and `VehicleDocumentUploadedBy` relation;
- `updatedAt`;
- indexes for vehicle visibility and uploader.

The `Document.vehicle` relation now uses `onDelete: Cascade`, because vehicle documents are owned by the vehicle record. The project currently has no vehicle hard-delete action. If one is added later, it must delete Cloudinary assets before deleting the vehicle because a database cascade cannot clean external storage.

The migration was applied to the configured Neon database. Prisma migration status is current after deploy.

## Storage decision

The previous generic document flow uses local filesystem storage, which is ephemeral on Vercel and is not suitable for new production vehicle documents. The project already has configured Cloudinary credentials and the Cloudinary SDK.

Vehicle documents therefore use Cloudinary as:

- `resource_type: raw`;
- `type: authenticated`;
- server-generated public IDs;
- no public URL stored in `Document.fileUrl`;
- provider metadata encoded only in the private `storageKey` field;
- short-lived signed download URL generated server-side and proxied through an authorized application route.

The browser never receives a Cloudinary private URL, storage key, public ID, or provider metadata.

## Upload flow

`uploadAdminVehicleDocuments`:

1. requires ADMIN or MANAGER;
2. resolves the target vehicle;
3. validates the complete batch before the first upload;
4. enforces a maximum of 25 documents per vehicle;
5. enforces 15 MB per file;
6. accepts PDF, JPEG, PNG, and WebP;
7. verifies magic bytes in addition to browser MIME;
8. sanitizes the display filename;
9. uploads each file to authenticated Cloudinary raw storage;
10. creates `Document` records with only `vehicleId` ownership;
11. defaults visibility to internal unless the CRM checkbox is explicitly selected;
12. removes already uploaded assets if a later upload or database write fails.

Office files were intentionally not enabled. The current stack does not have a trusted content-signature validator for Office containers, and Stage 7 prioritizes a strict allowlist over accepting MIME-only uploads.

## CRM UI

`/admin/vehicles/[vehicleId]/edit` now includes a `Документи техніки` manager below the gallery.

It shows:

- filename;
- format and size;
- upload date;
- uploader when available;
- visibility state;
- protected download action;
- visibility toggle;
- confirmed deletion action.

Deletion removes the authenticated Cloudinary asset first. If storage deletion fails, the database record remains so the action can be retried. The database record is deleted only after storage confirms success or reports that the asset is already absent.

## Client UI

`/client/vehicles/[id]` includes a read-only `Документи` section. Its vehicle query is scoped by the existing personal/company access helper and fetches only `visibleToClient = true` documents.

`/client/documents` also includes visible vehicle documents without creating duplicate records. Existing non-vehicle generic documents keep their previous visibility behavior. The client documents API applies the same vehicle visibility filter.

CLIENT cannot upload, rename, delete, or toggle visibility.

## Protected downloads

CRM route:

`/api/admin/vehicle-documents/[documentId]/download`

- requires ADMIN or MANAGER;
- accepts only a `Document` linked to a vehicle;
- proxies the private asset with attachment headers.

Client route:

`/api/client/vehicle-documents/[documentId]/download`

- requires CLIENT;
- requires `visibleToClient = true`;
- requires personal/company access to the related vehicle;
- uses a single scoped database query so foreign or hidden documents return the same not-found result.

Both routes return `Content-Type`, `Content-Length`, RFC-compatible `Content-Disposition`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`.

## Security review

- Path traversal: storage keys are generated server-side and parsed as a strict provider key, never as a filesystem path.
- MIME spoofing: allowlist plus magic-byte validation.
- Executables, HTML, SVG: rejected.
- Direct public URL: not stored or exposed; Cloudinary assets are authenticated.
- Foreign vehicle/document IDs: server-side scoped queries.
- Hidden client documents: filtered in vehicle detail, `/client/documents`, its API, and the download route.
- Company access: existing `vehicleAccessWhere` helper is reused.
- Storage key leakage: not selected into client or CRM UI payloads.
- Filename XSS/header injection: React escaping plus filename sanitization and RFC-compatible attachment encoding.

## Revalidation

Upload, visibility changes, and deletion revalidate:

- the CRM vehicle edit page;
- the related client or company owner page;
- client vehicle list and detail;
- `/client/documents`.

## Verification

Passed:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `git diff --check`;
- Cloudinary authenticated raw upload/download/delete round-trip with a temporary PDF;
- `npx.cmd prisma migrate deploy`;
- final `npx.cmd prisma migrate status`.

The temporary Cloudinary smoke asset was deleted. No production/client records were created for the storage test.

Authenticated browser QA was not claimed in this local pass because the new code has not yet been deployed to Vercel. After deployment, the remaining UI smoke is: manager upload/toggle/download/delete, client visible download, hidden document absence, and foreign personal/company access denial.

## Deferred intentionally

- document rename, category, expiry, versions, OCR, annotations, approval, and client upload;
- Office document formats until trustworthy content validation is available;
- vehicle hard-delete UI and its required external-storage cleanup orchestration;
- Stage 8.

No blocker remains in code or schema for Stage 7. A Vercel redeploy is required before production browser testing.
