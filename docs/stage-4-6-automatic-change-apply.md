# Kairos Parts — Stage 4.6: Automatic Change Apply

## Summary

Stage 4.6 adds automatic application of approved client ChangeRequests.

Before this stage, MANAGER / ADMIN approval changed only `ChangeRequest.status` and reviewer metadata. After this stage, approval is transactional:

1. Load only a `PENDING` ChangeRequest.
2. Validate supported `entityType` + `action`.
3. Validate `fieldName` against a field-level allowlist.
4. Extract and validate `newValue`.
5. Check target entity ownership/company scope.
6. Apply the allowed mutation.
7. Mark the ChangeRequest as `APPROVED`.

If applying the change fails, the ChangeRequest remains `PENDING`.

## Prisma Migration

Migration added:

```text
prisma/migrations/20260708190000_add_vehicle_archive_fields/migration.sql
```

Schema changes:

- `Vehicle.archivedAt DateTime?`;
- `Vehicle.archivedById String?`;
- `Vehicle.archivedBy User? @relation("VehicleArchivedBy")`;
- `User.archivedVehicles Vehicle[] @relation("VehicleArchivedBy")`.

The migration was prepared but not applied to Neon / production-like DB in this stage. Applying it requires a separate Stage 4.6.1 confirmation.

## Supported Entity / Action Rules

### REQUEST / UPDATE

Supported fields:

- `description`;
- `equipmentType`;
- `vehicleType` alias to `equipmentType`;
- `model`;
- `vinOrSerial`;
- `vin` alias to `vinOrSerial`;
- `serialNumber` alias to `vinOrSerial`.

Unsupported / blocked fields include:

- `status`;
- `requestNumber`;
- `source`;
- `clientId`;
- `companyId`;
- `assignedManagerId`;
- `createdAt`;
- `updatedAt`;
- `publicStatusToken`;
- relation IDs such as `categoryId`, `manufacturerId`, `vehicleId`.

### REQUEST_ITEM / UPDATE

Supported fields:

- `name`;
- `brand`;
- `catalogNumber`;
- `analogNumber`;
- `quantity`;
- `unit`;
- `comment`.

`quantity` must be an integer greater than or equal to `1`.

Unsupported / blocked fields include:

- `purchasePrice`;
- `salePrice`;
- `supplierName`;
- `availability`;
- `deliveryTime`;
- `currency`;
- `visibleToClient`;
- `approvedByClient`;
- `requestId`;
- `vehicleId`.

### VEHICLE / UPDATE

Supported fields:

- `type`;
- `manufacturer`;
- `brand` alias to `manufacturer`;
- `model`;
- `year`;
- `vinOrSerial`;
- `vin` alias to `vinOrSerial`;
- `serialNumber` alias to `vinOrSerial`;
- `comment`.

`year` must be an integer in the `1950–2100` range.

Unsupported / blocked fields include:

- `clientId`;
- `companyId`;
- `createdAt`;
- `updatedAt`;
- archive metadata fields.

### VEHICLE / ARCHIVE

Supported.

Approval sets:

- `Vehicle.archivedAt = now()`;
- `Vehicle.archivedBy = reviewer`.

The vehicle is not deleted. Related requests, documents, request items, and parts history remain intact.

## Approve Flow

Implemented in:

```text
lib/change-requests/service.ts
lib/change-requests/apply.ts
```

`approveChangeRequest` now runs inside a Prisma transaction:

- non-`PENDING` ChangeRequests are rejected;
- unsupported `entityType/action` combinations are rejected with a controlled status;
- disallowed `fieldName` values are rejected;
- invalid `newValue` payloads are rejected;
- target entity scope is checked before mutation;
- apply and status update either both succeed or both fail.

Controlled statuses:

- `change-request-unsupported-apply`;
- `change-request-field-not-allowed`;
- `change-request-new-value-required`;
- `change-request-invalid-value`;
- `change-request-target-not-found-or-forbidden`;
- `change-request-not-found-or-not-pending`.

## Reject Flow

Reject remains unchanged:

- only `ChangeRequest.status = REJECTED`;
- `reviewedById`, `reviewedAt`, and `adminComment` are stored;
- target entity is not mutated.

## UI Updates

Admin:

- `/admin/change-requests` now explains that approval applies allowlisted changes;
- approve button label changed to `Погодити і застосувати`;
- controlled apply errors are shown as user-facing messages;
- archive behavior is described as soft archive.

Client:

- `/client/change-requests` text now states that allowlisted approved changes apply automatically;
- contextual request/vehicle copy updated;
- vehicle detail and vehicle list show an `Архів` badge when `archivedAt` is set.

## Smoke Tests

Code-level checks completed:

- `npx.cmd prisma generate`;
- `npx.cmd prisma validate`;
- `npm.cmd run typecheck`.

Full DB/UI smoke test was not executed in Stage 4.6 because the new migration has not been applied to Neon / production-like DB yet.

Required Stage 4.6.1 smoke test after migration deploy:

- REQUEST / UPDATE approved change mutates allowed request field;
- REQUEST_ITEM / UPDATE approved change mutates allowed item field;
- disallowed RequestItem field such as `purchasePrice` is blocked;
- VEHICLE / UPDATE approved change mutates allowed vehicle field;
- disallowed Vehicle field such as `companyId` is blocked;
- VEHICLE / ARCHIVE sets `archivedAt` and `archivedById`;
- vehicle is not deleted;
- related history remains available;
- reject does not mutate target entity;
- repeated approve is blocked;
- rejected/cancelled approve is blocked.

## Out of Scope

Not implemented in Stage 4.6:

- AuditLog table;
- notifications;
- email / Telegram notifications;
- undo approved changes;
- conflict detection when `oldValue` no longer matches current entity value;
- bulk approvals;
- apply rules for `REQUEST_DOCUMENT`;
- apply rules for `COMMERCIAL_OFFER`;
- physical deletion of any entity.

## Stage 4.7 Readiness

Blocker for Stage 4.7 — AuditLog:

- Stage 4.6.1 should first apply `20260708190000_add_vehicle_archive_fields` to the target DB and complete DB/UI smoke tests.

No code-level blocker remains for the AuditLog design itself, but runtime verification should happen after migration deploy.

## Stage 4.6.1: Migration Deploy and Smoke Test

### Migration

Migration applied: yes.

Applied migration:

```text
20260708190000_add_vehicle_archive_fields
```

Database used:

- Neon Postgres from the current `.env.local`;
- database: `neondb`;
- schema: `public`.

Commands run:

```bash
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npx.cmd prisma migrate status
```

Result:

- migration was applied successfully;
- Prisma migration status reports `Database schema is up to date!`.

### Smoke Test Method

Smoke test was performed through route-equivalent/service-layer checks against Neon DB.

The test created temporary records with run marker:

```text
stage461_1783511739554
```

Temporary data included:

- CLIENT user;
- MANAGER user;
- foreign CLIENT user;
- personal/client profiles;
- company and foreign company;
- request linked to vehicle;
- visible RequestItem;
- vehicle;
- ChangeRequests for supported, forbidden, rejected, cancelled, unsupported, and foreign-scope scenarios.

### Smoke Test Results

Passed:

- `REQUEST / UPDATE` applies allowed field `description`;
- approved request ChangeRequest stores `APPROVED`, `reviewedById`, `reviewedAt`, and `adminComment`;
- repeated approve is blocked with controlled `change-request-not-found-or-not-pending`;
- `REQUEST_ITEM / UPDATE` applies allowed field `catalogNumber`;
- forbidden RequestItem field `purchasePrice` is blocked with `change-request-field-not-allowed`;
- forbidden RequestItem field did not mutate the original `purchasePrice`;
- `VEHICLE / UPDATE` applies allowed field `model`;
- forbidden Vehicle field `companyId` is blocked with `change-request-field-not-allowed`;
- `VEHICLE / ARCHIVE` sets `archivedAt`;
- `VEHICLE / ARCHIVE` sets `archivedById`;
- vehicle is not deleted after archive;
- request history linked to the vehicle remains available;
- RequestItem history linked to the vehicle remains available;
- reject stores `REJECTED`, reviewer metadata, and admin comment;
- reject does not mutate the target vehicle;
- approving a rejected ChangeRequest is blocked;
- approving a cancelled ChangeRequest is blocked;
- unsupported `REQUEST_DOCUMENT / UPDATE` is blocked with `change-request-unsupported-apply`;
- foreign company scope mismatch is blocked with `change-request-target-not-found-or-forbidden`;
- approved status remains visible through client-scoped query.

### Cleanup

Temporary records were cleaned after the smoke test.

Cleanup verification:

```json
{"users":0,"companies":0,"requests":0}
```

No real staging data was deleted.

### Backward Compatibility

Final build-level verification passed after migration and smoke test:

- Prisma client generated successfully;
- Prisma schema validated successfully;
- TypeScript typecheck passed;
- ESLint passed;
- Next.js production build passed.

These checks cover the current Next.js app routes, API routes, auth-dependent pages at build level, ChangeRequest pages, client dashboard pages, CRM pages, request documents, commercial offers, request items, vehicle routes, and Telegram webhook route compilation.

### Final Checks

Commands run:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Result:

- all checks passed.

### Stage 4.7 Readiness After 4.6.1

Blocker for Stage 4.7 — AuditLog:

- none from migration or automatic apply smoke test.

Stage 4.7 can start with AuditLog design and implementation.
