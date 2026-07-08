# Kairos Parts — Stage 4.7: AuditLog

## Summary

Stage 4.7 adds a system AuditLog foundation for critical business actions, especially approved ChangeRequests and automatically applied changes.

The goal is to keep a separate read-only trail of:

- who performed an action;
- which object was affected;
- which action happened;
- what value existed before the change;
- what value was applied;
- which ChangeRequest triggered the action;
- whether the action happened in personal or company scope.

## Prisma Changes

Added enums:

```text
AuditEntityType
AuditAction
```

`AuditEntityType` values:

- `REQUEST`;
- `REQUEST_ITEM`;
- `VEHICLE`;
- `REQUEST_DOCUMENT`;
- `COMMERCIAL_OFFER`;
- `COMPANY`;
- `CHANGE_REQUEST`;
- `USER`.

`AuditAction` values:

- `CHANGE_REQUEST_CREATED`;
- `CHANGE_REQUEST_CANCELLED`;
- `CHANGE_REQUEST_APPROVED`;
- `CHANGE_REQUEST_REJECTED`;
- `CHANGE_APPLIED`;
- `VEHICLE_ARCHIVED`;
- `ENTITY_UPDATED`.

Added model:

```text
AuditLog
```

Core fields:

- `actorId`;
- `companyId`;
- `changeRequestId`;
- `entityType`;
- `entityId`;
- `action`;
- `oldValue`;
- `newValue`;
- `metadata`;
- `createdAt`.

Relations added:

- `User.auditLogs`;
- `Company.auditLogs`;
- `ChangeRequest.auditLogs`.

Migration prepared:

```text
prisma/migrations/20260708210000_add_audit_logs/migration.sql
```

The migration was not applied to Neon / production-like DB in Stage 4.7. It should be deployed and smoke-tested in Stage 4.7.1.

## Audit Service

Added:

```text
lib/audit-log/service.ts
```

Functions:

- `createAuditLog`;
- `createChangeRequestAuditLog`;
- `listAuditLogsForAdmin`;
- `listAuditLogsForCompanyOrClient`.

`createAuditLog` supports transaction clients, so audit writes can be part of the same transaction as business mutations.

## Logged Actions

### ChangeRequest Created

When CLIENT creates a ChangeRequest, the system creates:

- `AuditAction = CHANGE_REQUEST_CREATED`;
- `entityType = CHANGE_REQUEST`;
- `entityId = changeRequest.id`;
- `actorId = requestedById`;
- `companyId = changeRequest.companyId`;
- `changeRequestId = changeRequest.id`;
- `oldValue = changeRequest.oldValue`;
- `newValue = changeRequest.newValue`;
- metadata with original entity type, original entity id, action, fieldName, and reason.

### ChangeRequest Cancelled

When CLIENT cancels an own pending ChangeRequest, the system creates:

- `AuditAction = CHANGE_REQUEST_CANCELLED`;
- `entityType = CHANGE_REQUEST`;
- `entityId = changeRequest.id`;
- `actorId = userId`;
- `companyId = changeRequest.companyId`;
- `changeRequestId = changeRequest.id`.

### ChangeRequest Rejected

When MANAGER / ADMIN rejects a ChangeRequest, the system creates:

- `AuditAction = CHANGE_REQUEST_REJECTED`;
- `entityType = CHANGE_REQUEST`;
- `entityId = changeRequest.id`;
- `actorId = reviewedById`;
- `companyId = changeRequest.companyId`;
- `changeRequestId = changeRequest.id`;
- metadata with admin comment and ChangeRequest context.

Reject still does not mutate the target entity.

### ChangeRequest Approved

When MANAGER / ADMIN approves a ChangeRequest, the system creates:

- `AuditAction = CHANGE_REQUEST_APPROVED`;
- `entityType = CHANGE_REQUEST`;
- `entityId = changeRequest.id`;
- `actorId = reviewedById`;
- `companyId = changeRequest.companyId`;
- `changeRequestId = changeRequest.id`;
- metadata with admin comment and ChangeRequest context.

### Actual Change Applied

When an approved ChangeRequest applies an entity mutation, the system creates an additional audit row:

- `AuditAction = CHANGE_APPLIED`;
- `entityType = REQUEST / REQUEST_ITEM / VEHICLE`;
- `entityId = original entity id`;
- `actorId = reviewedById`;
- `companyId = changeRequest.companyId`;
- `changeRequestId = changeRequest.id`;
- `oldValue = actual field value before mutation`;
- `newValue = applied field value`;
- metadata with fieldName, normalizedField, action, and source.

The source is:

```text
CHANGE_REQUEST_APPROVAL
```

### Vehicle Archived

For `VEHICLE / ARCHIVE`, the applied-change audit action is:

```text
VEHICLE_ARCHIVED
```

The audit row records:

- previous `archivedAt`;
- previous `archivedById`;
- new `archivedAt`;
- new `archivedById`.

Vehicle archive remains soft archive only. No vehicle, request, document, or request item is deleted.

## Transactions

AuditLog creation is inside the same transaction for:

- ChangeRequest creation;
- ChangeRequest cancellation;
- ChangeRequest approval;
- actual entity mutation after approval;
- ChangeRequest rejection.

For approve/apply, if AuditLog creation fails inside the transaction, the business mutation rolls back too. This prevents a successful entity change without a matching audit trail.

## Admin UI

Added route:

```text
/admin/audit-log
```

Added admin sidebar link:

```text
Журнал дій
```

The page shows:

- date/time;
- actor;
- company or personal context;
- action;
- entityType;
- entityId;
- linked ChangeRequest;
- oldValue;
- newValue;
- metadata.

The page is read-only. There are no edit or delete actions for AuditLog records.

## Permissions

Implemented:

- `/admin/audit-log` is protected by `requireCrmSession`;
- GUEST cannot access it;
- CLIENT cannot access it;
- MANAGER and ADMIN can access it through CRM;
- AuditLog cannot be modified or deleted from UI.

Client-facing audit visibility was not added in Stage 4.7. Client-visible status remains available through `/client/change-requests`.

## Security Notes

Audit metadata intentionally stores only business context:

- entity type;
- original entity id;
- fieldName;
- action;
- reason;
- adminComment;
- source.

It does not store:

- env values;
- database URLs;
- tokens;
- Telegram secrets;
- private storage paths.

## Out of Scope

Not implemented in Stage 4.7:

- notifications;
- email / Telegram sending;
- undo / rollback;
- full activity feed for every click;
- invoice/PDF generation;
- company roles;
- complex diff visualization;
- CSV/PDF export;
- immutable external logging.

Notifications remain planned for Stage 4.8.

## Checks Performed

Commands run:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Result:

- Prisma schema is valid;
- Prisma Client generates successfully;
- TypeScript typecheck passes;
- ESLint passes;
- Next.js production build passes.

## Smoke Test Status

Full DB smoke test was not executed in Stage 4.7 because the AuditLog migration was intentionally not applied to Neon / production-like DB.

Required Stage 4.7.1 checks after migration deploy:

- ChangeRequest create creates `CHANGE_REQUEST_CREATED`;
- cancel creates `CHANGE_REQUEST_CANCELLED`;
- reject creates `CHANGE_REQUEST_REJECTED`;
- approve creates `CHANGE_REQUEST_APPROVED`;
- approved REQUEST / UPDATE creates `CHANGE_APPLIED`;
- approved REQUEST_ITEM / UPDATE creates `CHANGE_APPLIED`;
- approved VEHICLE / UPDATE creates `CHANGE_APPLIED`;
- approved VEHICLE / ARCHIVE creates `VEHICLE_ARCHIVED`;
- oldValue/newValue match actual persisted entity changes;
- `/admin/audit-log` renders records for MANAGER / ADMIN;
- CLIENT cannot access `/admin/audit-log`;
- no test audit data remains after smoke cleanup.

## Stage 4.8 Readiness

Blocker for Stage 4.8 — Notifications:

- Stage 4.7.1 should first apply `20260708210000_add_audit_logs` to the target DB and complete AuditLog smoke tests.

No code-level blocker remains for starting notification design after AuditLog runtime verification.

## Stage 4.7.1: Migration Deploy and Smoke Test

### Migration

Migration applied: yes.

Applied migration:

```text
20260708210000_add_audit_logs
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
stage471_1783513483222
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
- ChangeRequests for create, cancel, reject, approve, applied change, archive, forbidden field, and repeated approve scenarios;
- AuditLog records created by those flows.

### Smoke Test Results

Passed:

- ChangeRequest create creates `CHANGE_REQUEST_CREATED`;
- created audit stores `entityType = CHANGE_REQUEST`;
- created audit stores `entityId = changeRequest.id`;
- created audit stores `actorId = requestedById`;
- created audit stores `companyId` for company scope;
- created audit stores `changeRequestId = changeRequest.id`;
- created audit metadata stores original entity id and ChangeRequest context;
- cancel creates `CHANGE_REQUEST_CANCELLED`;
- cancel audit stores CLIENT actor;
- reject creates `CHANGE_REQUEST_REJECTED`;
- reject audit stores MANAGER actor;
- reject audit stores `adminComment` in metadata;
- reject does not mutate target entity;
- rejected ChangeRequest does not create applied-change audit;
- approve creates `CHANGE_REQUEST_APPROVED`;
- approved `REQUEST / UPDATE` mutates Request;
- approved `REQUEST / UPDATE` creates `CHANGE_APPLIED` for `REQUEST`;
- Request applied audit has correct oldValue/newValue;
- approved `REQUEST_ITEM / UPDATE` mutates RequestItem;
- approved RequestItem update creates `CHANGE_APPLIED` for `REQUEST_ITEM`;
- RequestItem applied audit has correct oldValue/newValue;
- approved `VEHICLE / UPDATE` mutates Vehicle;
- approved Vehicle update creates `CHANGE_APPLIED` for `VEHICLE`;
- Vehicle applied audit has correct oldValue/newValue;
- approved `VEHICLE / ARCHIVE` sets `archivedAt`;
- approved `VEHICLE / ARCHIVE` sets `archivedById`;
- vehicle archive creates `VEHICLE_ARCHIVED`;
- archive audit stores old and new archive state;
- forbidden field apply returns controlled error;
- failed apply does not create `CHANGE_REQUEST_APPROVED`;
- failed apply does not create `CHANGE_APPLIED`;
- repeated approve is blocked;
- repeated approve does not create duplicate applied audit;
- `listAuditLogsForAdmin` returns created audit records before cleanup.

### Admin UI and Permissions

Verified by build and code-path checks:

- `/admin/audit-log` is compiled in the Next.js production build;
- `/admin/audit-log` uses `requireCrmSession`;
- middleware protects `/admin/:path*` routes with `MANAGER` / `ADMIN` roles;
- GUEST is redirected to `/admin/login`;
- CLIENT is redirected away from admin routes;
- AuditLog UI is read-only;
- no edit action exists;
- no delete action exists.

### Security / Integrity

Verified:

- secrets, env values, database URLs, Telegram tokens, and webhook secrets are not written to audit metadata;
- rejected ChangeRequest does not create applied-change audit;
- failed apply does not create misleading approval/applied audit;
- repeated approve does not duplicate applied audit.

### Cleanup

Temporary records were cleaned after the smoke test.

Cleanup verification:

```json
{"users":0,"companies":0,"requests":0,"audits":0}
```

No real staging data was deleted.

### Backward Compatibility

Final build-level verification passed after migration and smoke test:

- ChangeRequest service compiles;
- automatic apply service compiles;
- AuditLog admin route compiles;
- client dashboard routes compile;
- admin CRM routes compile;
- request items, vehicles, documents, commercial offers, auth, and Telegram webhook routes compile.

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

### Stage 4.8 Readiness After 4.7.1

Blocker for Stage 4.8 — Notifications:

- none from AuditLog migration or smoke test.

Stage 4.8 can start with notification design and implementation.
