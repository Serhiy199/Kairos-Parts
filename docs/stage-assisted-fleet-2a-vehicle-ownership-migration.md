# Kairos Parts - Stage Assisted Fleet 2A: Vehicle ownership migration

## 1. Scope

Stage 2A normalizes `Vehicle` ownership for personal clients and companies. It changes the data model, applies a safe backfill and database invariant, updates trusted write/access paths, and verifies the deployed Neon schema. It does not add assisted-onboarding UI, vehicle photos, document upload, or ownership-transfer UX.

## 2. Previous ownership

`Vehicle.clientId` was required and `Vehicle.companyId` was optional. A company-scoped vehicle therefore had both fields populated and could not be owned by a company alone.

## 3. Target XOR ownership

The supported states are now:

- personal: `clientId != null`, `companyId = null`;
- company: `clientId = null`, `companyId != null`.

Both-null and both-set states are invalid.

## 4. Pre-migration counts

The read-only audit against the configured Neon database returned:

| State | Count |
| --- | ---: |
| Total vehicles | 4 |
| Personal only | 4 |
| Company only | 0 |
| Both owners | 0 |
| Orphan | 0 |
| Invalid company membership among dual-owned rows | 0 |

No secrets or personal data were emitted.

## 5. Company backfill strategy

The migration clears `clientId` for every row with a non-null `companyId`. The pre-migration audit found no such rows in the target database, so the backfill changed zero records. Existing personal rows were left unchanged.

## 6. Orphan and invalid handling

The migration was applied only after confirming there were no orphan rows and no invalid dual-owner membership combinations. Future orphan and both-owner writes are rejected by the database constraint and by the server ownership helper.

## 7. Prisma schema changes

`Vehicle.clientId` and `Vehicle.client` are nullable. `companyId` remains nullable because the two nullable columns together express the XOR union. No unrelated `Vehicle` field or relation was changed.

## 8. CHECK constraint

PostgreSQL now contains the provider-specific constraint:

```text
Vehicle_exactly_one_owner_check
```

It requires exactly one of `clientId` and `companyId` to be non-null. Prisma cannot represent this check directly, so it is intentionally maintained in migration SQL.

## 9. Migration SQL review

The reviewed SQL contains only:

- the company-owner backfill;
- `clientId DROP NOT NULL`;
- replacement of the two ownership foreign keys;
- the XOR check constraint.

It does not drop tables, delete vehicles, recreate unrelated columns, reset the database, or use `db push`.

## 10. Foreign keys and onDelete decision

The previous relations used `Cascade` for `Vehicle.client` and `SetNull` for `Vehicle.company`. Both are incompatible with durable XOR ownership: cascade could destroy history, while set-null could create an orphan. Both ownership foreign keys now use `onDelete: Restrict`; no existing client/company hard-delete flow was found.

## 11. Indexes

The existing indexes on `clientId` and `companyId` were retained. No duplicate index was added.

## 12. Access helper updates

`lib/vehicles/ownership.ts` centralizes owner resolution, runtime validation, and access predicates. Personal mode requires the current `clientProfileId` with `companyId = null`. Company mode grants access to company-owned vehicles plus the current user's own personal vehicles. Document access through a vehicle follows the same personal/company distinction.

## 13. Client create and update changes

Both client create paths derive ownership from the authenticated server context:

- personal context writes `{ clientId, companyId: null }`;
- company context writes `{ clientId: null, companyId }`.

Ordinary update paths still update characteristics only. They do not accept or mutate owner fields.

The existing CRM company-assignment action was hardened: it validates the target company and a currently personal vehicle, then atomically replaces personal ownership with company ownership. It cannot create a both-owner row.

## 14. Request-created Vehicle changes

The public/client request and Telegram flows were inspected. They create `Request` records and can reference existing vehicles, but they do not create new `Vehicle` rows. No ownership write existed to change in those flows.

## 15. Telegram compatibility

Telegram request handling was not modified. It does not accept or write `Vehicle.clientId`/`companyId`, so the ownership migration does not change Telegram UX or request creation.

## 16. ChangeRequest compatibility

Vehicle ChangeRequest application remains limited to characteristic fields and archive metadata. `clientId` and `companyId` are not in its allowlist, so ChangeRequest cannot transfer ownership.

## 17. Backward compatibility

Vehicle IDs and history relations were preserved. Personal access, company access predicates, requests, request items, documents, archive operations, and characteristic updates remain compatible with nullable `clientId`. Company CRM rendering no longer assumes `vehicle.client` exists.

## 18. Post-migration counts

The read-only post-deploy audit returned:

| State | Count |
| --- | ---: |
| Total vehicles | 4 |
| Personal only | 4 |
| Company only | 0 |
| Both owners | 0 |
| Orphan | 0 |

The total remained 4, so no vehicle record was lost.

## 19. Migration name

```text
20260719090000_normalize_vehicle_ownership
```

## 20. Migration applied to Neon

The migration was applied with `npx.cmd prisma migrate deploy` to the Neon database configured by the local environment. The final `prisma migrate status` reports `Database schema is up to date!` with 20 migrations.

## 21. Prisma and application checks

Passed:

- `npx.cmd prisma format`;
- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npx.cmd prisma migrate status`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `git diff --check`.

The build retains the existing `jose` Edge Runtime warning for `CompressionStream`/`DecompressionStream`; it is unrelated to vehicle ownership. The project has no `npm test` script, so no test command was available.

## 22. Manual and targeted QA

Database smoke checks were executed inside a rollback-only transaction:

- personal ownership was accepted;
- company ownership was accepted;
- both-owner ownership was rejected;
- orphan ownership was rejected.

The deployed column is nullable, the named check constraint exists, and both ownership foreign keys use `RESTRICT`. Static flow review confirmed trusted owner derivation, immutable owner fields in ordinary updates, company/personal access predicates, and no Vehicle creation in Request/Telegram flows. Authenticated browser smoke was not performed in this task.

## 23. Intentionally not implemented

This stage does not add CRM assisted-onboarding entry points, a generic owner selector, owner transfer UI, `VehicleImage`, photo upload, document upload, duplicate warnings, new client-cabinet UI, or company-member enhancements.

## 24. Stage 3 blocker

There is no data-model blocker for Stage 3. The XOR ownership foundation is deployed and verified. Stage 3 should create vehicles only from trusted client/company route context and must not reintroduce arbitrary owner IDs from form payloads.
