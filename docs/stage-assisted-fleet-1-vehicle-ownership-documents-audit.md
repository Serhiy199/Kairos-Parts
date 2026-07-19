# Kairos Parts - Assisted Fleet Onboarding Stage 1 Audit

## 1. Executive summary

This is an audit-only report for the planned assisted fleet onboarding flow. No application code, Prisma schema, migration, UI, API, server action, or database data was changed during this stage.

The current `Vehicle` model can represent a personal vehicle and a company-visible vehicle, but it does not model exclusive ownership correctly:

- `clientId` is required;
- `companyId` is optional;
- therefore a company vehicle always also points to one `ClientProfile`;
- a vehicle owned only by a company cannot exist;
- the database has no XOR ownership constraint and no check that the selected client belongs to the selected company.

This is sufficient for the current client-created fleet UI, but it is not a safe foundation for manager-assisted onboarding. A schema migration is required before Stage 2 UI implementation. The recommended target is exclusive ownership: exactly one of `clientId` or `companyId` must be set.

The project does not currently have a vehicle photo model. Request photos are `RequestFile` records and marketplace images are `UsedEquipmentImage` records; neither should be reused as the vehicle ownership model. A dedicated `VehicleImage` model should reuse the proven Cloudinary transport patterns without sharing marketplace records.

The generic `Document` model already has relations to client, company, request, and vehicle, but its ownership rules, visibility, uploader attribution, protected download, and durable production storage are incomplete. It should be extended for personal/company/vehicle records, while `RequestDocument` remains the request-workflow document model.

Primary Stage 2 blocker: ownership semantics and the migration/backfill policy must be approved before manager create/edit/upload UI is built.

## 2. Vehicle Prisma structure

Current model: `prisma/schema.prisma`, model `Vehicle`.

Current fields relevant to this audit:

| Area | Current fields | Audit finding |
| --- | --- | --- |
| Identity | `id` | Internal identifier only. |
| Personal relation | `clientId`, `client` | Required and `onDelete: Cascade`. |
| Company relation | `companyId`, `company` | Optional and `onDelete: SetNull`. |
| Equipment | `type`, `manufacturer`, `model`, `year` | Sufficient for basic fleet records. |
| Serial identity | `vinOrSerial` | Optional raw value; no normalized companion and no unique constraint. |
| Notes | `comment` | General plain-text note. |
| Archive | `archivedAt`, `archivedById`, `archivedBy` | Soft archive foundation exists. |
| Relations | `requests`, `requestItems`, `documents` | Vehicle history can aggregate requests, selected items, and generic documents. |
| Audit metadata | `createdAt`, `updatedAt` | No `createdById`, `updatedById`, or source field. |

Missing foundation for assisted onboarding:

- exclusive owner constraint;
- company-only ownership;
- creator/updater attribution;
- source of record (`CLIENT`, `CRM`, legacy/import);
- normalized VIN/serial for duplicate detection;
- dedicated vehicle photos;
- explicit ownership transfer rules.

## 3. Personal ownership

The current personal state is:

```text
clientId = ClientProfile.id
companyId = null
```

Client access is derived server-side in `lib/client/access.ts`. In personal mode, `vehicleAccessWhere()` limits access to the current `clientProfileId`.

The client create flows in `app/client/vehicles/actions.ts` and `app/api/client/vehicles/route.ts` do not accept owner IDs from the browser. They derive both IDs from the authenticated client access context. This is a strong existing security property and should be preserved.

Risk: `Vehicle.client` uses `onDelete: Cascade`. Deleting a `ClientProfile` deletes its vehicle records. That may be acceptable for strictly personal draft data, but it is unsafe once the same row is also company-visible or linked to durable request/document history.

## 4. Company ownership

The current company state is:

```text
clientId = creator ClientProfile.id
companyId = Company.id
```

It is not true company-only ownership because `clientId` cannot be null. Company members receive access through `vehicleAccessWhere()` when `companyId` matches their membership. The row still retains one client as an implicit second owner.

Consequences:

- deleting that client profile can cascade-delete a shared company vehicle;
- deleting the company sets `companyId` to null, silently converting the row into a personal vehicle of the original client;
- there is no database guarantee that the referenced client belongs to the referenced company;
- the meaning of `clientId` is ambiguous: owner, creator, contact, or legacy anchor;
- company ownership transfer cannot be expressed cleanly.

## 5. Ownership state matrix

| `clientId` | `companyId` | Possible now | Current meaning | Target policy |
| --- | --- | --- | --- | --- |
| Set | null | Yes | Personal vehicle | Valid personal ownership. |
| null | Set | No | Not representable | Valid company ownership after migration. |
| Set | Set | Yes | Company-visible vehicle anchored to a client | Legacy state to backfill; invalid for new rows. |
| null | null | No | Not representable | Always invalid. |

Recommended invariant:

```text
exactly one of clientId and companyId is non-null
```

This should be enforced in PostgreSQL with a check constraint, not only in forms or TypeScript.

## 6. Client create flow

Current UI flow:

```text
/client/vehicles/new
  -> VehicleForm
  -> createVehicle(FormData)
  -> prisma.vehicle.create()
```

The REST flow in `POST /api/client/vehicles` duplicates the same create behavior.

Positive findings:

- the caller must be authenticated as `CLIENT`;
- `clientId` and `companyId` are derived from session/membership context;
- required fields are checked server-side;
- the browser cannot choose another owner directly.

Limitations:

- company members automatically create a row with both owner IDs;
- there is no duplicate check for VIN/serial;
- no audit entry is created;
- no creator/source metadata is persisted;
- no photos or documents can be uploaded in the vehicle form.

## 7. Client edit flow

Current direct edit flow:

```text
/client/vehicles/[id]
  -> updateVehicle(FormData) or PATCH /api/client/vehicles/[id]
  -> vehicleAccessWhere(access)
  -> direct prisma.vehicle.update()
```

For company members, the access predicate allows any vehicle with their `companyId`, plus their own legacy personal rows. As a result, every company member can directly edit a shared company vehicle.

The same detail area also supports `ChangeRequest` for vehicle updates and archive requests. This creates two competing policies:

- direct client edit applies immediately and is not audited;
- ChangeRequest waits for ADMIN approval and is audited when applied.

Recommended policy for the assisted model:

- MANAGER/ADMIN: direct operational create/update with `AuditLog`;
- CLIENT: request corrections through `ChangeRequest` for controlled fields;
- ownership transfer: ADMIN-only operation;
- archive: current request/approval policy may remain, or staff can archive directly with audit.

## 8. Request-created vehicle flow

The web request creation flow does not create a `Vehicle` row. It:

- accepts an optional existing `vehicleId`;
- validates access to that existing vehicle;
- stores request-level snapshots such as equipment type, model, year, and VIN/serial;
- creates only `Request` and request file records.

The Telegram webhook also creates a `Request` with equipment metadata and client/company context, but it does not create a vehicle.

Therefore the current system does not automatically pollute the fleet with a new vehicle per request. Stage 2 must preserve this behavior. Assisted onboarding should provide an explicit manager action to:

1. link the request to an existing vehicle; or
2. create a new vehicle after duplicate review and owner confirmation.

It must not silently create a vehicle from every web or Telegram request.

## 9. Duplicate risk

Current duplicate protections for `Vehicle`: none.

There is no:

- normalized VIN/serial field;
- unique index;
- same-owner duplicate query;
- warning for matching manufacturer/model/year;
- merge/transfer workflow.

Recommended strategy:

1. Preserve the raw `vinOrSerial` for display.
2. Add `normalizedVinOrSerial` for matching.
3. Normalize with trim, Unicode normalization, uppercase, and whitespace removal. Preserve punctuation initially because machinery serial formats can treat separators as meaningful.
4. Add partial unique indexes for non-null identifiers within each owner scope:

```text
UNIQUE (clientId, normalizedVinOrSerial)
WHERE clientId IS NOT NULL AND normalizedVinOrSerial IS NOT NULL

UNIQUE (companyId, normalizedVinOrSerial)
WHERE companyId IS NOT NULL AND normalizedVinOrSerial IS NOT NULL
```

5. For records without VIN/serial, show a non-blocking warning for same owner + normalized manufacturer + model + year.
6. Cross-owner VIN matches should produce a strong warning and an explicit transfer/link decision, not silent global blocking.
7. Manager override of a fuzzy duplicate warning should require a reason and create an audit entry.

## 10. Current photo architecture

There is no vehicle photo relation in Prisma.

Existing image/file concepts are separate:

- `RequestFile`: attachments submitted with a request, including Telegram files;
- `UsedEquipmentImage`: Cloudinary-backed public marketplace gallery;
- `RequestDocument`: managed request documents;
- `Document`: generic metadata with optional vehicle relation.

Request files must not become vehicle photos automatically. Their purpose, visibility, retention, and quality are different.

`UsedEquipmentImage` is the closest technical reference because it already supports Cloudinary URL, public ID, ordering, primary image, metadata, validation, deletion, and cleanup. The model itself must remain marketplace-specific.

## 11. Current document models

### `Document`

Generic metadata model with optional relations to:

- `ClientProfile`;
- `Company`;
- `Request`;
- `Vehicle`.

It has file name, storage key, optional file URL, MIME type, size, and creation time. It lacks:

- document category/type;
- `visibleToClient`;
- uploader/creator relation;
- `updatedAt`;
- an exactly-one-scope constraint;
- a complete protected upload/download/delete flow.

All four relation IDs are optional, so a row can have no scope or conflicting multiple scopes.

### `RequestDocument`

Purpose-built request workflow model with:

- document type;
- title;
- visibility to client;
- uploader;
- timestamps;
- protected admin/client file routes.

It should remain request-specific.

### `RequestFile`

Inbound request attachment metadata. It has no visibility flag and is not an appropriate canonical vehicle document.

## 12. Upload/storage flow

Current request file and request document helpers write to local filesystem storage:

- local development: `<project>/uploads`;
- Vercel: an `os.tmpdir()` directory.

The Vercel filesystem is ephemeral. A successful write does not provide durable production storage across function instances or deployments. This is a blocker for treating local `storageKey` as long-lived fleet documentation.

Existing protected request-document download routes correctly:

- require role/session access;
- apply request/company ownership checks;
- reject unsafe storage keys;
- resolve paths below the upload root.

However, deleting a `RequestDocument` currently deletes only the database row. The API does not remove the local/object file, so orphan cleanup is incomplete.

Stage 2 should use durable object storage for new vehicle photos/documents and define rollback cleanup when DB persistence fails, cleanup after deletion, and cleanup during vehicle deletion/retention workflows.

## 13. Personal documents

The generic `Document` model can point to `clientId`, and client document queries include personal rows. There is no complete creation UI or production-safe upload path for such records.

Current visibility is implicit: a client who passes the ownership predicate receives the metadata. Because generic `Document` has no `visibleToClient`, staff cannot safely keep an internal personal document hidden while using the same model.

Recommended target:

- `Document` with exactly one subject scope;
- personal document: `clientId` only;
- explicit category and `visibleToClient`;
- uploader attribution;
- protected download route;
- durable object storage.

## 14. Company documents

The generic `Document` model can point to `companyId`. In company mode, all company members pass the current access predicate and can see matching document metadata.

There are no differentiated company-member permissions and `isPrimaryContact` has no authorization effect. Therefore Stage 2 must assume all company members share the same client-facing fleet/document visibility unless a later role model is explicitly approved.

Internal company documents require `visibleToClient = false`; without that field, using the generic model for manager-only records is unsafe.

## 15. Vehicle documents

The generic `Document.vehicleId` relation is structurally present but has no end-to-end management flow.

Recommended canonical rule:

- vehicle-level record: `vehicleId` only;
- ownership is derived through the vehicle;
- do not copy both owner IDs into the document row unless a historical snapshot requirement is approved;
- access uses the trusted vehicle owner relation;
- `visibleToClient` controls whether client/company members can download it;
- staff access remains role-based.

Examples: registration document, service record, inspection, warranty, serial plate photo, and other fleet evidence.

## 16. Client cabinet visibility

`/client/documents` currently combines:

- generic `Document` rows accessible by owner/request/vehicle predicates;
- `RequestFile` rows for accessible requests;
- only visible `RequestDocument` rows.

Important differences:

- generic `Document`: no visibility flag;
- `RequestFile`: no visibility flag;
- `RequestDocument`: explicit visibility and protected client download.

For assisted fleet documents, the RequestDocument pattern is the safe behavioral reference: server-side ownership check plus explicit visibility check plus protected file delivery.

The audit service has `listAuditLogsForCompanyOrClient()`, but no client audit-log page was found in the inspected routes. Audit history is currently an admin-facing capability, not a confirmed client-facing one.

## 17. CRM entry points

Current CRM coverage:

- client detail shows existing vehicles and related history;
- company detail shows company vehicles;
- company detail can assign an existing vehicle to a company;
- there is no dedicated CRM vehicle create/edit/detail workflow.

The current `assignVehicleToCompany` action has important gaps:

- it accepts `companyId` and `vehicleId` from form data;
- it verifies CRM role but does not verify that the vehicle is currently unassigned;
- it does not verify that the vehicle's client is a member of the company;
- it can reassign a vehicle from another company if called directly;
- it does not create an `AuditLog`;
- it preserves required `clientId`, reinforcing ambiguous dual ownership.

The company page links vehicle entries to a client route rather than a dedicated CRM vehicle route. Stage 2 should introduce CRM-owned routes rather than reuse client pages.

## 18. Trusted owner strategy

Owner IDs must never be accepted as trusted browser state.

Recommended server-side strategy:

### Personal owner

The CRM action receives a selected `ClientProfile.id`, then reloads that profile server-side and confirms:

- the profile exists;
- its user has role `CLIENT`;
- the profile is eligible for the selected scope.

Persist:

```text
clientId = selected ClientProfile.id
companyId = null
```

### Company owner

The CRM action receives a selected `Company.id`, reloads the company server-side, and persists:

```text
clientId = null
companyId = selected Company.id
```

The creator is stored separately in `createdById`; it must not be encoded as ownership.

### Client self-service

The existing session-derived access context remains authoritative. The client does not choose arbitrary owner IDs.

## 19. ADMIN/MANAGER permissions

Recommended operational matrix:

| Operation | ADMIN | MANAGER | CLIENT |
| --- | --- | --- | --- |
| Create personal/company vehicle in CRM | Yes | Yes | No, except existing self-service flow |
| Edit equipment details in CRM | Yes | Yes | Via ChangeRequest after policy cleanup |
| Upload/delete vehicle photos | Yes | Yes | Not in Stage 2 |
| Upload/update vehicle documents | Yes | Yes | Not in Stage 2 |
| Toggle client visibility | Yes | Yes, audited | No |
| Transfer ownership | Yes | No | No |
| Hard delete | Prefer none; ADMIN only if ever added | No | No |
| Archive | Yes | Yes, audited | Request via ChangeRequest |

Both CRM pages and every mutation must repeat server-side role checks. Hiding controls is not authorization.

## 20. Audit fields

`Vehicle` currently has timestamps but no actor/source attribution.

Recommended additions:

- `createdById String?` -> `User` with `onDelete: SetNull`;
- `updatedById String?` -> `User` with `onDelete: SetNull`;
- `source VehicleSource` with at least `CLIENT`, `CRM`, `LEGACY`;
- optional future values only when explicit import flows exist.

For legacy rows, use `source = LEGACY` and nullable actor IDs. Do not fabricate a creator from ambiguous data.

## 21. AuditLog

The existing `AuditLog` service supports generic entity/action logging and already includes `VEHICLE` in `AuditEntityType`.

Current limitations:

- direct vehicle create/update actions do not write audit entries;
- company assignment does not write an audit entry;
- generic `DOCUMENT` is not an audit entity type;
- photo/document create, delete, visibility, and reorder actions have no agreed audit actions.

Stage 2 should write `AuditLog` in the same transaction as the vehicle mutation. Suggested events:

- vehicle created;
- vehicle updated;
- owner assigned/transferred;
- vehicle archived/restored;
- photo uploaded/deleted/reordered/primary changed;
- document uploaded/metadata changed/visibility changed/deleted.

Do not place file bytes, sensitive document contents, or private storage URLs in audit metadata.

## 22. ChangeRequest integration

The existing ChangeRequest foundation supports vehicle `UPDATE` and `ARCHIVE` and has an allowlist for type, manufacturer/brand, model, year, VIN/serial, and comment. Approval is ADMIN-only and successful application writes AuditLog.

This is compatible with a future controlled client correction flow.

It should not be used for:

- manager-assisted initial creation;
- photo upload;
- document upload;
- ownership transfer;
- hidden/visible document decisions.

Those are CRM operational actions and should be explicitly authorized and audited.

## 23. Security risks

Priority findings:

1. **High - dual ownership ambiguity.** A company vehicle is still owned by a required client relation.
2. **High - destructive cascade.** Deleting the anchor `ClientProfile` can delete a shared company vehicle.
3. **High - company deletion changes ownership semantics.** `companyId` becomes null and the vehicle becomes personal.
4. **High - unrestricted company reassignment action.** A direct CRM action can assign an arbitrary vehicle to an arbitrary company without current-owner or membership checks.
5. **High - generic document visibility.** There is no `visibleToClient`; accessible metadata is effectively client-visible.
6. **High - non-durable production uploads.** Vercel temporary storage cannot be the source of truth for long-lived documents.
7. **Medium - no duplicate protection.** Same-owner duplicate VIN/serial rows are possible.
8. **Medium - no direct mutation audit.** Client edits and CRM company assignment are not logged.
9. **Medium - no orphan file cleanup.** RequestDocument deletion removes the DB row but not the stored file.
10. **Medium - direct file URL exposure.** Generic documents may expose `fileUrl` without a protected delivery route.
11. **Medium - all company members share access.** There is no company permission tier; primary contact does not restrict access.
12. **Low/medium - parallel edit policies.** Direct client updates and ChangeRequest updates coexist.

## 24. Backward compatibility

The ownership migration is not purely additive because existing company rows have both owner fields set.

Required preparation:

1. Count all four ownership states.
2. Detect company vehicles whose `clientId` user is not a member of that company.
3. Detect duplicate normalized VIN/serial values per future owner scope.
4. Detect generic documents with zero or multiple subject relations.
5. Inventory local-only storage keys and inaccessible files.
6. Back up the target staging database before deploy.

Recommended vehicle backfill:

- existing `companyId != null`: treat company as canonical owner and set `clientId = null`;
- existing `companyId == null`: preserve `clientId` as personal owner;
- set `source = LEGACY` for all pre-migration rows;
- leave `createdById`/`updatedById` null unless an actor is unambiguous;
- resolve duplicate identifiers before applying partial unique indexes.

Behavioral compatibility:

- company members should continue to see company vehicles;
- personal clients should continue to see personal vehicles;
- request and request-item relations remain by `vehicleId`;
- old company vehicles should not disappear after canonical ownership is corrected.

## 25. Recommended company flow

Stage 2 company-assisted onboarding:

1. MANAGER/ADMIN opens company CRM detail.
2. Chooses `Add vehicle`.
3. Owner is fixed server-side to that company route context.
4. Enters equipment details and VIN/serial.
5. Server performs exact and fuzzy duplicate checks.
6. If a duplicate exists, manager links/opens it instead of creating a second row.
7. If creation proceeds, transaction creates Vehicle + AuditLog.
8. Manager uploads photos/documents through dedicated routes.
9. Visibility is explicit per document/photo if internal files are supported.
10. Company members see the new vehicle through existing company access scope.

Do not require choosing one company member as owner.

## 26. Recommended individual flow

Stage 2 personal-assisted onboarding:

1. MANAGER/ADMIN opens client CRM detail.
2. Chooses `Add vehicle`.
3. Owner is fixed server-side to that client's `ClientProfile`.
4. Enters equipment details and VIN/serial.
5. Server performs duplicate checks within personal owner scope and cross-scope warnings.
6. Transaction creates Vehicle + AuditLog.
7. Manager uploads photos/documents.
8. The client sees only records explicitly visible to the client.

If the client later joins a company, the vehicle must not move automatically. Ownership transfer is an explicit ADMIN action with audit.

## 27. Recommended photo model

Add a dedicated `VehicleImage` model, separate from `UsedEquipmentImage`:

```text
id
vehicleId
url
storagePublicId
sortOrder
isPrimary
alt?
width?
height?
format?
bytes?
visibleToClient
uploadedById?
createdAt
updatedAt
```

Recommended behavior:

- reuse/generalize existing Cloudinary upload validation and cleanup patterns;
- use a vehicle-specific folder and transformation policy;
- enforce one primary image in service logic;
- define max count and max size;
- clean uploaded objects if the DB transaction fails;
- delete the object only after authorization and safe DB coordination;
- do not attach request files automatically;
- use protected/private delivery if fleet photos are considered sensitive. If public Cloudinary URLs are accepted, document that privacy decision explicitly.

## 28. Recommended document model

Extend the existing generic `Document` model for durable personal/company/vehicle records rather than reusing `RequestDocument` or adding a second near-identical vehicle-only document model.

Recommended additions:

```text
type/category
visibleToClient Boolean @default(false)
uploadedById String?
updatedAt DateTime
storageProvider/key metadata as needed
```

Recommended scope rule for new generic records:

```text
exactly one of clientId, companyId, vehicleId is set
requestId is not used for new generic records
```

Request workflow files continue to use `RequestDocument` and `RequestFile`.

Required implementation rules:

- protected upload/download/delete routes;
- access derived through client/company/vehicle ownership;
- client download requires `visibleToClient = true`;
- persistent object storage;
- MIME/size allowlist and safe content-disposition;
- no raw storage key or private path in UI responses;
- object cleanup on failed writes and deletion;
- AuditLog for lifecycle and visibility changes.

Before enforcing the scope check, legacy `Document` rows must be inventoried and backfilled.

## 29. Recommended duplicate strategy

Use two levels:

### Blocking exact duplicate

- non-null normalized VIN/serial;
- same canonical owner scope;
- partial unique indexes at database level;
- friendly Ukrainian validation error;
- transaction-safe handling of race-condition unique violations.

### Warning-only probable duplicate

- same owner;
- same normalized manufacturer;
- same normalized model;
- same year when present;
- optionally same equipment type.

The manager can proceed only after acknowledging the warning. Record the decision and reason in AuditLog metadata.

Never merge rows automatically. Preserve request/document history and use an explicit future merge/transfer operation.

## 30. Required schema changes

Stage 2 requires a Prisma migration. Recommended scope:

### Vehicle ownership

- make `Vehicle.clientId` nullable;
- keep `Vehicle.companyId` nullable;
- change deletion semantics to prevent silent deletion/conversion, preferably `Restrict` for canonical owners;
- add PostgreSQL check: exactly one owner is set;
- add `normalizedVinOrSerial`;
- add partial owner-scoped unique indexes;
- add `createdById`, `updatedById` and relations to `User`;
- add `VehicleSource` with `CLIENT`, `CRM`, `LEGACY`;
- add indexes for ownership and normalized lookup as needed.

### Photos

- add `VehicleImage` and its indexes/relations.

### Documents

- extend `Document` with category/type, visibility, uploader, and `updatedAt`;
- add/check exclusive document subject scope after legacy backfill;
- add generic `DOCUMENT` audit entity/actions if lifecycle audit is required.

### Migration sequence

1. Add nullable/new fields without constraints.
2. Backfill owner/source/normalized values.
3. Resolve detected conflicts and duplicates.
4. Change relations/deletion rules.
5. Add check and partial unique indexes through reviewed SQL.
6. Validate staging data.
7. Only then deploy Stage 2 UI/actions.

## 31. Revised roadmap

### Stage 2A - Ownership migration foundation

- data audit script;
- exclusive owner migration/backfill;
- source/actor fields;
- normalized VIN/serial and duplicate indexes;
- ownership helpers and tests;
- no photo/document UI yet.

### Stage 2B - CRM vehicle workflow

- dedicated `/admin/vehicles` or scoped client/company vehicle routes;
- MANAGER/ADMIN create/edit;
- trusted server-side owner context;
- duplicate warnings;
- AuditLog transaction;
- personal/company route linking.

### Stage 2C - Vehicle photos

- `VehicleImage`;
- durable Cloudinary/object storage;
- upload/reorder/primary/delete;
- visibility/privacy decision;
- cleanup and security tests.

### Stage 2D - Fleet documents

- extend/backfill `Document`;
- protected upload/download/delete;
- personal/company/vehicle scopes;
- explicit client visibility;
- persistent storage and cleanup;
- audit events.

### Stage 2E - Client policy cleanup and QA

- remove conflict between direct client edit and ChangeRequest;
- company-member access regression checks;
- transfer/archive behavior;
- responsive and role QA;
- staging migration smoke test.

## 32. Blockers

The following decisions are required before implementation:

1. Approve exclusive ownership: exactly one of personal client or company.
2. Approve migration of existing dual-owner company rows to company-only ownership.
3. Decide deletion policy: recommended `Restrict`, not cascade/set-null semantic conversion.
4. Approve whether all company members continue to see all company fleet documents/photos.
5. Approve durable storage provider and whether fleet media must be private/authenticated.
6. Approve whether direct client vehicle editing is removed in favor of ChangeRequest.
7. Approve duplicate normalization and manager override policy.
8. Run a staging data audit before adding check/unique constraints.

There is no blocker to writing Stage 2 technical migration design, but there is a blocker to safely implementing and deploying the full assisted onboarding UI until these ownership/storage decisions are resolved.

## Mandatory final answers

1. **Which field represents the personal owner?** `Vehicle.clientId`, linked to `ClientProfile`.
2. **Which field represents the company owner?** `Vehicle.companyId`, linked to `Company`, but currently only as an optional secondary scope because `clientId` remains required.
3. **Can a company-only vehicle exist now?** No.
4. **Can a row have both owners now?** Yes; this is the normal current company-visible state.
5. **Can a row have neither owner now?** No, because `clientId` is required.
6. **Is ownership integrity enforced by the database?** No XOR rule or client-company membership rule exists.
7. **Is a migration required?** Yes. It is not purely additive because existing dual-owner rows need backfill and relation semantics must change.
8. **Does request creation automatically create a vehicle?** No. Web and Telegram requests store snapshots and may link an existing vehicle only.
9. **Is duplicate Vehicle prevention implemented?** No.
10. **What should exact duplicate protection use?** Owner-scoped partial unique indexes on a normalized VIN/serial value, plus race-safe server validation.
11. **Is there a current Vehicle photo model?** No.
12. **Should `UsedEquipmentImage` be reused directly?** No. Reuse its Cloudinary service patterns, but add a separate `VehicleImage` model.
13. **Which model should store assisted fleet documents?** Extend generic `Document` for personal/company/vehicle records; keep `RequestDocument` request-specific.
14. **Is current local/Vercel storage production-durable?** No. Vercel temporary storage is ephemeral.
15. **Can generic documents currently be hidden from clients?** No explicit `visibleToClient` field exists.
16. **Who should be allowed to create assisted fleet records?** ADMIN and MANAGER through server-authorized CRM actions; ownership transfer remains ADMIN-only.
17. **What is the main security blocker?** Ambiguous dual ownership combined with cascade/set-null deletion semantics and unrestricted reassignment.
18. **Recommended Stage 2 starting point?** Stage 2A ownership/data migration foundation, followed by CRM workflow, then photos and documents.

## Audit evidence

Primary files inspected:

- `prisma/schema.prisma`
- `lib/client/access.ts`
- `app/client/vehicles/actions.ts`
- `app/api/client/vehicles/route.ts`
- `app/api/client/vehicles/[id]/route.ts`
- `app/client/vehicles/new/page.tsx`
- `app/client/vehicles/[id]/page.tsx`
- `app/api/requests/route.ts`
- `app/api/telegram/webhook/route.ts`
- `app/admin/clients/[id]/page.tsx`
- `app/admin/companies/[id]/page.tsx`
- `app/admin/company-actions.ts`
- `app/client/documents/page.tsx`
- `app/api/client/documents/route.ts`
- `app/api/documents/route.ts`
- `app/admin/actions.ts`
- `app/api/admin/request-documents/[documentId]/route.ts`
- `app/api/admin/request-documents/[documentId]/file/route.ts`
- `app/api/client/request-documents/[documentId]/file/route.ts`
- `lib/files/local-storage.ts`
- `lib/files/secure-local-file.ts`
- `lib/audit-log/service.ts`
- `app/admin/audit-log/page.tsx`
- `app/admin/change-requests/actions.ts`
- `lib/change-requests/apply.ts`
- used-equipment image management files used only as an architectural reference.

Audit boundary:

- no database write;
- no migration command;
- no production code edit;
- no secret inspection or output;
- no runtime claim beyond code inspection;
- existing unrelated worktree changes were intentionally left untouched.
