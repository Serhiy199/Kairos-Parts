# Stage Assisted Fleet 8 — Company and personal client documents

## 1. Scope

Stage 8 extends the existing generic `Document` model with managed company-level and personal client-level documents. ADMIN and MANAGER can upload, download, expose, hide, and delete these documents from the existing company and client CRM profiles. CLIENT receives read-only access only to explicitly visible documents inside the existing personal/company scope.

Client upload, categories, expiry, OCR, versions, approvals, owner transfer, bulk ZIP, and Stage 9 are not included.

## 2. Stage 7 architecture reused

The implementation reuses the Stage 7 private document stack:

- Cloudinary `raw` authenticated assets;
- server-generated public IDs;
- encoded private provider metadata in `storageKey`;
- no public URL persisted in `fileUrl`;
- signed server-side fetch proxied through protected application routes;
- filename sanitization, MIME allowlist, magic-byte validation, and attachment headers;
- storage-first delete and best-effort cleanup after failed database writes.

The vehicle folder convention remains unchanged.

## 3. Existing Document schema audit

Before implementation, `Document` already contained four nullable owner relations:

- `vehicleId`;
- `companyId`;
- `clientId` targeting `ClientProfile`;
- `requestId` as a legal legacy generic-document context.

It also already contained Stage 7 fields `visibleToClient`, `uploadedById`, `createdAt`, `updatedAt`, private `storageKey`, optional `fileUrl`, MIME type, and byte size.

`RequestDocument` remains the dedicated structured request-offer/invoice document model and was not replaced or migrated.

## 4. Target owner matrix

Every generic `Document` must have exactly one owner context:

| Context | vehicleId | companyId | clientId | requestId |
| --- | --- | --- | --- | --- |
| Vehicle | set | null | null | null |
| Company | null | set | null | null |
| Personal client | null | null | set | null |
| Legacy generic request | null | null | null | set |

Stage 8 write actions create only company-only or client-only rows. They never duplicate a file into a vehicle or request context.

## 5. Existing data counts

The pre-migration read-only Neon audit returned:

- total generic documents: `0`;
- vehicle-only: `0`;
- company-only: `0`;
- client-only: `0`;
- request-only: `0`;
- all owner fields null: `0`;
- multiple owner fields set: `0`.

No remediation or destructive data change was required.

## 6. Prisma changes

The existing owner fields were retained. Changes are limited to:

- safe `Restrict` deletion policy for company, client, and legacy request owners;
- shared uploader relation name `DocumentUploadedBy`;
- compound visibility indexes for client and company owner queries.

Vehicle ownership remains `onDelete: Cascade` to preserve Stage 7 behavior. Vehicle hard delete is not currently exposed in the application.

## 7. CHECK constraint

Migration `20260719170000_add_company_and_client_documents` adds:

`Document_exactly_one_owner_check`

The constraint counts all four legal owner fields and requires exactly one non-null value. It rejects both all-null and mixed-owner records while preserving the legal legacy `requestId` context.

Application writes also use `hasExactlyOneDocumentOwner` before persistence. The database remains the final invariant boundary.

## 8. Migration SQL review

The migration:

1. changes company, client, and request foreign keys to `ON DELETE RESTRICT`;
2. adds the exactly-one-owner CHECK;
3. adds `Document_clientId_visibleToClient_idx`;
4. adds `Document_companyId_visibleToClient_idx`.

It does not drop tables, reset the database, delete rows, or backfill owners.

## 9. Cloudinary authenticated storage reuse

Generic upload uses owner-specific namespaces:

- vehicle: `kairos-parts/vehicle-documents/{vehicleId}`;
- company: `kairos-parts/company-documents/{companyId}`;
- personal client: `kairos-parts/client-documents/{clientProfileId}`.

The original filename is never used as the Cloudinary public ID. The private browser-facing API never returns a storage key, Cloudinary public ID, authenticated URL, or provider metadata.

## 10. Company upload flow

`/admin/companies/[id]` binds the trusted route company ID into the server action. The action:

1. requires an ADMIN or MANAGER session;
2. resolves the Company again in the database;
3. counts only company-level documents;
4. validates the complete batch;
5. uploads authenticated assets;
6. persists company-only `Document` rows;
7. cleans uploaded assets if persistence fails;
8. revalidates the CRM profile and `/client/documents`.

## 11. Personal client upload flow

`/admin/clients/[id]` uses the `ClientProfile.id` route convention. The action requires ADMIN/MANAGER and resolves a profile whose related user role is `CLIENT`. Staff accounts cannot be used as personal document owners.

The owner-level query explicitly excludes company, vehicle, and request documents, including when the client is a CompanyMember.

## 12. File policy and visibility

- allowed MIME types: PDF, JPEG, PNG, WebP;
- signature validation: reused from Stage 7;
- maximum size: 15 MB per file;
- maximum count: 25 separately per Vehicle, Company, or personal Client;
- new CRM owner documents default to `visibleToClient = false` unless the manager explicitly checks the visibility option.

Visibility updates are scoped by both document ID and exact owner context.

## 13. Secure admin download

`/api/admin/documents/[documentId]/download` requires ADMIN or MANAGER and proxies the private authenticated asset. CRM access does not depend on `visibleToClient`.

Responses use attachment disposition, `nosniff`, and `private, no-store`.

## 14. Secure client download

`/api/client/documents/[documentId]/download` requires CLIENT, `visibleToClient = true`, and the shared exact-owner access predicate:

- personal document: current `ClientProfile`;
- company document: current Company membership;
- vehicle document: existing personal/company vehicle access;
- legacy request document: existing personal/company request access.

Hidden and foreign documents return the same not-found response. Their existence is not disclosed.

## 15. CRM sections

The reusable `AdminOwnerDocumentsSection` is rendered on:

- `/admin/companies/[id]` as `Документи компанії`;
- `/admin/clients/[id]` as `Документи клієнта`.

It includes upload, owner-scoped count, format/size/date/uploader metadata, textual visibility status, protected download, visibility toggle, confirmed delete, pending states, aria-live feedback, and owner-specific empty copy.

## 16. `/client/documents` aggregation

The page now groups visible data into:

- `Документи компанії`;
- `Особисті документи`;
- `Документи техніки`;
- `Документи заявок`.

Empty groups are omitted. A generic document belongs to exactly one group because of the database invariant. Company members still see their own personal documents in addition to company and accessible vehicle documents.

Existing `RequestFile` and `RequestDocument` rows stay in the request group and are not copied into generic `Document`.

The JSON client documents API now uses a safe `select`; it no longer serializes private `storageKey` or `fileUrl` values.

## 17. Delete and cleanup

Delete is owner-scoped and storage-first:

1. require CRM role;
2. resolve trusted owner;
3. find the exact owner document;
4. delete the authenticated Cloudinary asset;
5. delete the database row;
6. revalidate owner/client routes.

If Cloudinary deletion fails, the database record remains. If the later database delete fails, the UI reports that the external file was removed but the row still needs cleanup.

## 18. Owner deletion cleanup status

No company or client hard-delete action was found in the current application. `Restrict` therefore protects documents from silent database deletion while external assets still exist.

If owner hard delete is added later, it needs an explicit pre-delete Cloudinary cleanup workflow before deleting Company or ClientProfile records. This is documented future work, not a Stage 8 blocker.

## 19. Security QA

Verified by code review, generated Prisma types, build, and database constraint smoke:

- ADMIN/MANAGER role checks exist in every mutation and admin download;
- trusted owners are resolved server-side;
- foreign document IDs are scoped by owner;
- company membership and personal ownership use shared server-side predicates;
- hidden documents are filtered in query and download layers;
- all-null and mixed-owner rows are rejected by Neon;
- original filenames cannot control storage paths/public IDs;
- MIME spoofing uses Stage 7 magic-byte checks;
- response headers sanitize filenames;
- client JSON/UI payloads do not include storage keys or private provider URLs;
- exact ownership prevents duplicate grouping.

The constraint smoke used a transaction ending in `ROLLBACK`; no test document rows or Cloudinary assets were retained.

## 20. Responsive and accessibility QA

Implementation-level checks cover:

- card-based layouts without global table width requirements;
- `min-w-0` and wrapped long filenames;
- stacked mobile actions and wrapping CRM controls;
- labelled multiple file input;
- keyboard focus-visible states;
- pending/disabled states;
- textual visibility status rather than color alone;
- aria-live action feedback;
- explicit destructive confirmation.

Authenticated visual browser QA at 1440/1280/1024/768/430/390/375 remains a post-redeploy smoke item because the committed code is not yet available in Vercel and local browser state has no authenticated CRM/client session.

## 21. Manual QA status

Completed route-equivalent checks:

- owner helper accepts exactly one vehicle/company/client/request owner;
- all-null insert rejected by Neon CHECK;
- mixed company/client insert rejected by Neon CHECK;
- valid personal owner insert accepted inside rollback transaction;
- migration leaves zero invalid owner records;
- safe queries and download routes compile for company/personal/vehicle/request contexts.

Remaining authenticated UI smoke after deploy:

- company upload hidden -> visible -> client download -> delete;
- personal upload hidden -> visible -> client download -> delete;
- foreign company/personal direct URL denial;
- CompanyMember combined personal/company/vehicle view;
- Stage 7 vehicle upload/toggle/download/delete regression.

## 22. Technical checks

Passed:

- `npx.cmd prisma format`;
- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npx.cmd prisma migrate deploy`;
- `npx.cmd prisma migrate status` -> `Database schema is up to date!`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `git diff --check`;
- transactional Neon CHECK smoke through `prisma db execute`.

## 23. Deferred to later stages

- client upload;
- document categories, expiry, reminders, versions, approval, OCR, and owner transfer;
- company member roles and invitation flow;
- Office file support;
- owner hard-delete UI and external-storage cleanup orchestration;
- bulk ZIP;
- Stage 9.

## 24. Stage 9 readiness

No code or schema blocker remains for Stage 9. A Vercel redeploy and the authenticated UI smoke listed above are required before treating the production browser flow as verified.
