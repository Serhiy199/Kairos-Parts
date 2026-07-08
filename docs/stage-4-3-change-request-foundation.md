# Kairos Parts — Stage 4.3: ChangeRequest Foundation

## Status

Stage 4.3 is implemented in code and prepared for database migration.

The migration is prepared but was not applied to Neon / production-like DB in this task.

## Goal

Add a safe foundation for client-initiated change requests without applying business changes automatically.

This stage lets CLIENT users request a change for an existing entity, lets MANAGER / ADMIN users review the request, and stores the review result for later operational workflows.

## Prisma Changes

Added enums:

- `ChangeRequestStatus`
  - `PENDING`
  - `APPROVED`
  - `REJECTED`
  - `CANCELLED`
- `ChangeEntityType`
  - `REQUEST`
  - `REQUEST_ITEM`
  - `VEHICLE`
  - `REQUEST_DOCUMENT`
  - `COMMERCIAL_OFFER`
  - `COMPANY`
  - `COMPANY_PROFILE`
- `ChangeAction`
  - `UPDATE`
  - `DELETE`
  - `ARCHIVE`
  - `RESTORE`

Added model:

- `ChangeRequest`

Key fields:

- `companyId`
- `requestedById`
- `reviewedById`
- `entityType`
- `entityId`
- `action`
- `status`
- `fieldName`
- `oldValue`
- `newValue`
- `reason`
- `adminComment`
- `reviewedAt`

Added relations:

- `Company.changeRequests`
- `User.changeRequestsRequested`
- `User.changeRequestsReviewed`

Prepared migration:

- `prisma/migrations/20260708170000_add_change_requests/migration.sql`

## Validation And Service Layer

Added:

- `lib/change-requests/validation.ts`
- `lib/change-requests/service.ts`

Service functions:

- `createChangeRequest`
- `getChangeRequestForAdmin`
- `listChangeRequestsForAdmin`
- `listChangeRequestsForClient`
- `cancelOwnPendingChangeRequest`
- `approveChangeRequest`
- `rejectChangeRequest`

Important limitation:

- `approveChangeRequest` and `rejectChangeRequest` only update the ChangeRequest review status and reviewer metadata.
- They do not automatically apply changes to requests, request items, vehicles, documents, offers, or companies.

## Client API

Added:

- `GET /api/client/change-requests`
- `POST /api/client/change-requests`
- `POST /api/client/change-requests/[id]/cancel`

Client behavior:

- CLIENT can list own/company change requests.
- CLIENT can create a change request only for entities visible in their own/company scope.
- CLIENT can cancel only their own `PENDING` change request.
- CLIENT cannot set status directly.
- CLIENT cannot approve or reject requests.

## Admin API

Added:

- `GET /api/admin/change-requests`
- `GET /api/admin/change-requests/[id]`
- `POST /api/admin/change-requests/[id]/approve`
- `POST /api/admin/change-requests/[id]/reject`

Admin behavior:

- MANAGER / ADMIN can list all change requests.
- MANAGER / ADMIN can view one change request.
- MANAGER / ADMIN can approve or reject only `PENDING` requests.
- Invalid transitions return controlled error responses instead of server errors.

## UI

Added client page:

- `/client/change-requests`

Client page includes:

- create change request form;
- entity type and action selectors;
- entity ID and optional field/value inputs;
- reason textarea;
- change request history;
- cancel action for own pending requests.

Added admin page:

- `/admin/change-requests`

Admin page includes:

- full list of change requests;
- client and company context;
- entity/action/status display;
- approve form;
- reject form;
- review metadata for processed requests.

Updated navigation:

- Client dashboard sidebar includes `Запити на зміну`.
- CRM sidebar includes `Запити змін`.

## Access Rules

Client scope:

- personal clients see requests created by their own user account;
- company clients see requests linked to their company and their own requests;
- entity access is checked before creating a change request.

Entity access checks:

- `REQUEST`: must be accessible through client/company request scope;
- `REQUEST_ITEM`: parent request must be accessible;
- `VEHICLE`: vehicle must be accessible through client/company vehicle scope;
- `REQUEST_DOCUMENT`: visible document with accessible parent request;
- `COMMERCIAL_OFFER`: sent/approved/rejected offer with accessible parent request;
- `COMPANY` / `COMPANY_PROFILE`: allowed only for the current company.

Admin scope:

- MANAGER and ADMIN can review all change requests.
- Stage 4.3 does not add per-company manager restrictions.

## Not Included In This Stage

Not implemented intentionally:

- automatic application of approved changes;
- diff renderer;
- field-specific workflows;
- company profile edit workflow;
- notifications;
- audit log beyond ChangeRequest metadata;
- email or Telegram alerts;
- mutation of target entities after approval.

These are candidates for later stages.

## Verification

Commands run:

- `npx.cmd prisma generate`
- `npx.cmd prisma validate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

Result:

- all checks passed.

## Migration

Migration status:

- prepared: yes;
- applied to Neon / production-like DB: no.

Before UI smoke testing in Neon, run in the intended environment:

```bash
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npx.cmd prisma generate
```

Do not run reset/drop commands.

## Smoke Test Checklist

After applying migration:

1. Login as CLIENT.
2. Open `/client/change-requests`.
3. Create a change request for an accessible request.
4. Verify it appears in client history as `PENDING`.
5. Cancel the pending request.
6. Verify cancelled status is saved.
7. Create another pending request.
8. Login as MANAGER or ADMIN.
9. Open `/admin/change-requests`.
10. Approve the pending request.
11. Verify reviewer and review timestamp are saved.
12. Create one more request and reject it.
13. Verify CLIENT cannot see another user's personal request.
14. Verify CLIENT cannot approve/reject through admin routes.
15. Verify GUEST cannot access client/admin change request routes.

## Blockers For Next Stage

No code blockers are known.

Before Stage 4.4 or live smoke testing, apply the migration to the target DB and verify the UI with real seeded/client data.

## Stage 4.3.1: Migration Apply And Smoke Test

Date: 2026-07-08

### Migration

Migration applied: yes.

Applied migration:

- `20260708170000_add_change_requests`

Database used:

- Neon Postgres database from the current `.env.local`;
- database name: `neondb`;
- schema: `public`;
- host family: Neon `eu-central-1` endpoint;
- secrets and full connection URL were not logged or committed.

Commands run:

- `npx.cmd prisma migrate status`
- `npx.cmd prisma migrate deploy`
- `npx.cmd prisma generate`
- `npx.cmd prisma migrate status`

Final Prisma status:

- `Database schema is up to date!`

### Smoke Test Method

Smoke test was performed through Prisma / service-layer route-equivalent checks against the Neon DB.

The test created temporary records with prefix:

- `TEST Stage 4.3.1`

Temporary records were cleaned after verification.

### Personal Client Checks

Verified:

- CLIENT can create a `PENDING` ChangeRequest for an accessible personal request;
- `requestedById` is saved;
- `companyId` remains `null`;
- CLIENT sees own ChangeRequest;
- CLIENT does not see company ChangeRequests outside personal scope;
- CLIENT can cancel own `PENDING` ChangeRequest;
- after cancel, status becomes `CANCELLED`;
- CLIENT cannot cancel a `CANCELLED` ChangeRequest;
- CLIENT cannot cancel a foreign ChangeRequest;
- CLIENT cannot cancel an `APPROVED` ChangeRequest.

Result:

- passed.

### Company Client Checks

The current staging DB did not have existing companies, so temporary company/client/request records were created and cleaned.

Verified:

- company CLIENT can create a ChangeRequest for a request in the same company scope;
- ChangeRequest automatically receives `companyId`;
- another CLIENT in the same company can see the company ChangeRequest;
- CLIENT from another company cannot see it;
- personal CLIENT without company cannot see it;
- personal CLIENT cannot create a ChangeRequest for a company request;
- CLIENT from another company cannot create a ChangeRequest for a foreign company request.

Result:

- passed.

### Admin / Manager Checks

Verified:

- MANAGER can see all ChangeRequests through admin service list;
- MANAGER can approve a `PENDING` ChangeRequest;
- after approve, `status = APPROVED`;
- after approve, `reviewedById` is saved;
- after approve, `reviewedAt` is saved;
- MANAGER cannot approve an already approved ChangeRequest again;
- MANAGER can reject a `PENDING` ChangeRequest with `adminComment`;
- after reject, `status = REJECTED`;
- after reject, `reviewedById` is saved;
- after reject, `reviewedAt` is saved;
- after reject, `adminComment` is saved;
- MANAGER cannot reject an already rejected ChangeRequest again.

Result:

- passed.

### Validation And Invalid Transition Checks

Verified:

- invalid `entityType` payload is rejected by validation;
- invalid `action` payload is rejected by validation;
- foreign entity access returns controlled failure;
- invalid status transitions return controlled failure instead of throwing a server error;
- allowed transitions are limited to:
  - `PENDING -> APPROVED`;
  - `PENDING -> REJECTED`;
  - `PENDING -> CANCELLED`.

Result:

- passed.

### Cleanup

Temporary records created during smoke test:

- 4 ChangeRequests;
- temporary requests;
- temporary companies;
- temporary company users / memberships.

Cleanup result:

- test ChangeRequests left: 0;
- test requests left: 0;
- test companies left: 0.

No real production/staging business data was deleted.

### Backward Compatibility

Final checks confirm the app still builds and the affected routes compile:

- client dashboard routes;
- admin CRM routes;
- requests;
- vehicles;
- request documents;
- commercial offers;
- auth routes;
- Telegram webhook route.

### Final Checks

Commands run:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

Result:

- all checks passed.

Note:

- an initial parallel `typecheck` run failed because `next build` was rebuilding `.next/types` at the same time;
- after running `typecheck` sequentially after build, it passed.

### Stage 4.4 Readiness

Blocker for Stage 4.4 — Client “Запросити зміну” UI:

- none known.

Stage 4.3 is now fully closed:

- migration applied;
- Prisma schema synchronized with Neon DB;
- personal and company ChangeRequest flows verified;
- admin approve/reject verified;
- invalid transitions blocked;
- temporary test data cleaned;
- typecheck/lint/build passed.
