# Stage Assisted Fleet 5 — Exact VIN duplicate detection

## 1. Scope

Implemented exact VIN / serial-number duplicate protection for production Vehicle create and update paths. The check is limited to the immutable owner scope and does not add fuzzy matching, a global uniqueness rule, photos, documents, or Stage 6 functionality.

## 2. Agreed business rules

- An exact normalized VIN duplicate is blocked only for the same owner.
- The same VIN remains allowed for different personal clients, different companies, and across personal/company scopes.
- Update excludes the current Vehicle.
- Empty and weak placeholder values become `null` and skip duplicate lookup.
- Type, manufacturer, model, and year are not used for duplicate detection.

## 3. Actual VIN field

The existing Prisma field is nullable `Vehicle.vinOrSerial`. No separate normalized field, unique constraint, or index was added. The Prisma schema was not changed.

## 4. Normalization strategy

`lib/vehicles/vin.ts` applies `trim`, uppercase conversion, and removes whitespace and hyphens. It intentionally preserves `/`, `_`, `.`, Unicode letters, and other serial-number characters. Examples `ABC-123`, `abc123`, and `ABC 123` all become `ABC123`.

## 5. Weak-value strategy

Blank input and placeholders such as `-`, `—`, `0`, `NA`, `N/A`, `NONE`, `NULL`, `UNKNOWN`, `NO VIN`, `немає`, `не вказано`, `без VIN`, `відсутній`, and `відсутнє` normalize to `null`. Duplicate lookup returns immediately for `null`.

## 6. Storage strategy

New and updated production records store the canonical value directly in `vinOrSerial`. Weak values are stored as `null`. Original punctuation removed by normalization is not retained in a separate display field.

## 7. Owner scoping

The duplicate service reuses the XOR `VehicleOwnership` type:

- personal: `clientId = owner`, `companyId = null`;
- company: `clientId = null`, `companyId = owner`.

Owner values are derived from the authenticated client context, the CRM route argument after server-side owner lookup, or the current Vehicle row. They are never accepted from editable form payloads.

## 8. Create flow

CRM company create, CRM personal-client create, client server action, and client POST API normalize the value, search the same owner scope, and create only when no duplicate exists. The query and write run in a short serializable Prisma transaction.

## 9. Edit flow

CRM edit, client server action, client PATCH API, and approved Vehicle change requests derive the stored owner, exclude the current Vehicle ID, and block a collision with another same-owner Vehicle. Saving the same VIN or formatting-only equivalent is allowed and stores the canonical value.

## 10. Duplicate service

`lib/vehicles/duplicates.ts` is server-only. It selects only `id`, basic equipment identity, year, and VIN. Candidate legacy values are normalized in application code so pre-existing formatted values are compared consistently.

Company assignment is also guarded: transferring a personal Vehicle cannot create a VIN collision in the destination company. The transferred VIN is canonicalized.

## 11. Error UX

The CRM form preserves submitted values, marks the VIN input invalid, focuses it, shows an inline Ukrainian error, and exposes `duplicateVehicleId` only as a dedicated safe state field. The keyboard-accessible link `Відкрити існуючу техніку` opens `/admin/vehicles/{id}/edit`.

Client pages show a Ukrainian duplicate message without exposing another record ID. Direct client APIs return HTTP `409`, status `duplicate_vin`, and a safe Ukrainian message.

## 12. Existing data audit

A read-only Neon audit was run on 2026-07-19. It returned only aggregate values:

- Vehicle rows: 4;
- canonical non-empty VIN / serial values: 4;
- weak placeholder values: 0;
- duplicate same-owner normalized groups: 0;
- rows in such duplicate groups: 0.

No Vehicle row was changed during the audit.

## 13. Concurrency limitation

Duplicate lookup and write use short serializable transactions. This materially reduces concurrent-submit races, but there is no database unique constraint because normalization is application-level, the owner is split across nullable fields, and global uniqueness is explicitly not wanted. An exceptional serialization conflict can still surface as the existing generic save error and be retried.

## 14. Client/admin write coverage

Covered production writes:

- CRM company and personal-client create;
- CRM edit;
- client create/update server actions;
- client POST/PATCH Vehicle API;
- approved Vehicle change requests;
- personal-to-company Vehicle assignment.

Seed upserts were intentionally not changed. Request and Telegram flows were rechecked and do not create Vehicle rows.

## 15. Security QA

- Duplicate lookup uses trusted owner scope.
- Same-owner case/spacing/hyphen bypasses are normalized.
- Current Vehicle is excluded during edit.
- Foreign-owner records are not searched or disclosed.
- Client errors never include a duplicate Vehicle ID.
- CRM duplicate links remain behind the existing ADMIN/MANAGER route protection.

## 16. Manual QA

Code-path inspection covered same-owner create, cross-owner allowance, self-excluding edit, approved change requests, direct API calls, and company assignment. Full authenticated browser mutation testing was not performed in this task because it would create or edit Neon records. The supplied manual create/edit matrix remains the recommended post-deploy smoke test.

## 17. Tests

A standalone normalization check passed 11 assertions covering trim, uppercase, whitespace/hyphen removal, preservation of `/ _ .`, and weak-value conversion. The repository has no general `npm test` script, so no test framework was added. Prisma type generation, TypeScript, lint, and production build provide integration-level compilation coverage.

## 18. Prisma/migration status

`prisma migrate status` reports 20 migrations and `Database schema is up to date!`. `prisma validate` and `prisma generate` pass. Prisma schema is unchanged and no migration is required.

## 19. Intentionally not implemented

- fuzzy type/manufacturer/model/year matching;
- override checkbox;
- global or composite unique index;
- raw/display VIN field;
- automatic cleanup of legacy values;
- photos, documents, or Stage 6.

## 20. Stage 6 blocker

There is no code or database blocker for Stage 6. Before production sign-off, run the documented authenticated browser smoke test for company, personal, cross-scope, edit, weak-value, and duplicate-link scenarios.
