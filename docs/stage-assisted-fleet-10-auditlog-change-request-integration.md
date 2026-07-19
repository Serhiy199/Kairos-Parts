# Stage Assisted Fleet 10 - AuditLog and ChangeRequest integration

## 1. Scope

Stage 10 closes audit coverage for fleet vehicles, photos, and owner documents, and routes client changes to vehicle characteristics through the existing ChangeRequest approval flow. Notifications, ownership redesign, storage redesign, and Stage 11 are excluded.

## 2. Existing AuditLog architecture

The project already had one `AuditLog` model and `createAuditLog`/`createChangeRequestAuditLog` helpers. The model stores actor, company context, entity/action, old/new JSON, metadata, optional ChangeRequest relation, and indexed timestamps. Stage 10 reuses this architecture; no parallel log was introduced.

## 3. Existing ChangeRequest architecture

The existing workflow supports PENDING, APPROVED, REJECTED, and CANCELLED records, client create/cancel, administrative review, transactional apply, and workflow audit events. Automatic apply already had entity-specific handlers and was extended for stricter Vehicle semantics.

## 4. Write-flow coverage matrix

| Flow | Actor | Entity/action representation | Atomicity |
| --- | --- | --- | --- |
| Staff creates personal/company Vehicle | ADMIN/MANAGER | VEHICLE + `metadata.event=VEHICLE_CREATED` | Vehicle + audit transaction |
| Client creates owned Vehicle | CLIENT | VEHICLE + `VEHICLE_CREATED` | Vehicle + audit transaction |
| Staff edits Vehicle | ADMIN/MANAGER | VEHICLE + `VEHICLE_UPDATED` | Vehicle + audit transaction |
| Approved Vehicle ChangeRequest | reviewer | CHANGE_REQUEST_APPROVED and VEHICLE/CHANGE_APPLIED | One transaction |
| Image upload | ADMIN/MANAGER | VEHICLE + `VEHICLE_IMAGE_UPLOADED` | Storage, then DB + audit; upload compensation |
| Image primary/reorder | ADMIN/MANAGER | VEHICLE + dedicated metadata event | DB + audit transaction |
| Image delete | ADMIN/MANAGER | VEHICLE + `VEHICLE_IMAGE_DELETED` | Storage delete, then DB + audit |
| Vehicle document upload/visibility/delete | ADMIN/MANAGER | VEHICLE + dedicated document event | DB + audit transaction after storage operation |
| Company/client document upload/visibility/delete | ADMIN/MANAGER | COMPANY or USER + dedicated event | DB + audit transaction after storage operation |
| ChangeRequest create/cancel/approve/reject | CLIENT/reviewer | Existing workflow AuditAction | DB + audit transaction |

No separate “move vehicle between owners” write flow exists in the audited UI/actions.

## 5. Event naming

The existing `AuditAction` enum was intentionally not expanded. Generic business writes use `ENTITY_UPDATED`; the precise event is stored in `metadata.event`: `VEHICLE_CREATED`, `VEHICLE_UPDATED`, image events, and vehicle/company/client document events. Existing ChangeRequest actions remain first-class enum values.

## 6. Actor and owner context

Every new event records the authenticated `actorId`; `actorRole` is recorded in metadata. Vehicle events store `ownerType` and `ownerId`, with `companyId` populated where the schema supports it. Personal owner identity is represented in metadata because `AuditLog` has no `clientId` column.

## 7. Vehicle create and update audit

Staff and client create flows record a canonical editable-field snapshot. Staff updates record only changed fields. A save with no effective changes does not create an audit event. VIN duplicate rejection happens before the write and therefore creates no false success audit.

## 8. Photo audit

Upload uses one batch event with image IDs, count, and primary image ID. Primary and reorder actions detect no-op operations. Delete records image ID, previous primary state, and sort order. URLs, public IDs, credentials, and signed asset data are excluded.

## 9. Document audit

Vehicle, company, and personal-client document flows record safe metadata: document ID, original name, MIME type, size, owner type, and client visibility. Storage keys, signed URLs, and file contents are excluded.

## 10. ChangeRequest create

The client can create a Vehicle UPDATE request only after server-side access lookup. The service reloads the current accessible Vehicle and creates canonical old/new values itself; caller-provided old values are not trusted.

## 11. Allowed fields

The shared Vehicle allowlist is: `type`, `manufacturer`, `model`, `year`, `vinOrSerial`, `comment`. The same helper is used by manager audit snapshots, client ChangeRequest creation, and approval apply.

## 12. Ownership immutability

Owner controls are absent from the client form. Validation rejects fields outside the allowlist, including `clientId`, `companyId`, `ownerType`, and `ownerId`. Apply only builds an update from the allowed field and derives ownership from the current Vehicle row.

## 13. No-op handling

Canonical proposed values equal to the current value return `change-request-no-changes`; no ChangeRequest is created. Staff Vehicle/photo/document no-op operations also avoid audit records where applicable.

## 14. Pending request policy

At most one PENDING Vehicle UPDATE request is allowed for the same vehicle, field, and personal/company context. A duplicate returns `change-request-already-pending`.

## 15. Approval transaction

Approval reloads the PENDING request and current Vehicle, validates field/value/access, checks stale state and VIN uniqueness, updates Vehicle, marks the request APPROVED, and writes workflow plus entity AuditLog records in one Prisma transaction. Any failure rolls back all DB changes.

## 16. Stale conflict handling

Stored canonical old value is compared with the current field. A mismatch returns `change-request-stale-conflict`; Vehicle and ChangeRequest remain unchanged and PENDING for manual review.

## 17. Duplicate VIN at approve

VIN/serial values use the existing owner-scoped normalization and duplicate service. The current Vehicle is excluded. A conflict leaves Vehicle unchanged, keeps the request PENDING, and creates no approval audit.

## 18. Approve, reject, and cancel audit

Create/cancel/reject keep their existing workflow events. Successful approval emits `CHANGE_REQUEST_APPROVED` and a separate entity change event linked by `changeRequestId`. Reject/cancel do not mutate Vehicle. Review remains ADMIN-only in the current product permission model; this preserves the previously approved restriction that managers do not access “Запити змін”.

## 19. Audit payload sanitization

New audit records do not contain storage keys, Cloudinary URLs/public IDs, signed URLs, binaries, tokens, connection strings, or raw request bodies. Vehicle old/new payloads contain only changed allowlisted fields.

## 20. Transaction and compensation strategy

DB-only writes and AuditLog inserts are atomic. Upload flows upload first, then create DB rows and audit in one transaction; on DB failure uploaded assets are cleaned up. Delete flows delete storage first and only then perform DB delete plus audit. A DB failure after successful external deletion is returned explicitly; external storage cannot participate in the Prisma transaction.

## 21. UI labels and history changes

The admin AuditLog page maps Stage 10 metadata events to Ukrainian descriptions and renders object values as readable key/value text. Vehicle fields on the ChangeRequest page use Ukrainian labels, null is shown as “Не вказано”, and stale/pending/no-op outcomes have safe Ukrainian messages. The client no longer has a direct Vehicle edit form; it uses the contextual clarification form.

## 22. Existing data audit

Read-only Neon audit result: Vehicle AuditLog records `0`; Vehicle ChangeRequest distribution empty; approved Vehicle requests containing forbidden ownership keys `0`; approved Vehicle requests without linked Vehicle audit `0`. No legacy destructive cleanup was required. No personal data was printed.

## 23. Security QA

Code-level checks confirm: no client direct Vehicle update action; strict owner/field access on create and apply; foreign Vehicle lookup returns not found/forbidden; owner fields and unknown field names are rejected; reviewer identity comes from the authenticated server action; non-PENDING review/cancel is rejected; storage-sensitive metadata is omitted. Browser-level adversarial requests were not sent to production.

## 24. Manual QA

Route-equivalent and code-path review covered personal/company ownership, no-op, duplicate pending, stale conflict, duplicate VIN, workflow audits, and revalidation. A live browser create/update/upload/delete smoke was not performed because it would write test records/assets to the connected Neon/Cloudinary environment. It remains the deployment smoke checklist.

## 25. Targeted checks

`scripts/check-assisted-fleet-stage10.ts` verifies the editable allowlist, owner-field rejection, VIN normalization, year validation, no-op and changed-field diffs, plus the read-only existing-data aggregates. Result: passed; no invalid legacy records found. The repository has no `npm test` script, so no separate test suite was invoked.

## 26. Prisma and migration status

`prisma validate` and `prisma generate` pass. `prisma migrate status` reports 23 migrations and “Database schema is up to date”. Prisma schema was not changed and no migration is required.

## 27. Notifications explicitly excluded

No Telegram, email, in-app notification, manager alert, or client alert was added or changed.

## 28. Remaining gaps

Live browser QA is still required for representative photo/document external-storage operations and role sessions. External storage deletion cannot be rolled back if the following DB transaction fails. The existing ADMIN-only ChangeRequest review policy differs from the generic ADMIN/MANAGER recommendation but intentionally follows the current approved permissions.

## 29. Blocker for Stage 11

There is no code or database blocker for Stage 11 after deployment smoke. Recommended prerequisite: run one controlled ADMIN/MANAGER/CLIENT browser scenario in staging and verify AuditLog rows, stale conflict messaging, asset operations, and client-visible ChangeRequest status.
