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
