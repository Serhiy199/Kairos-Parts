# Stage Assisted Fleet 4 - Manager create and edit Vehicle

## 1. Scope

Stage 4 replaces the trusted-owner placeholder pages with working CRM forms for creating and editing vehicles. The implementation is limited to vehicle characteristics, trusted ownership, validation, navigation, and revalidation.

## 2. Preconditions Stage 2A/3

- Stage 2A ownership is represented as an exclusive choice: personal (`clientId` only) or company (`companyId` only).
- The database contains `Vehicle_exactly_one_owner_check`.
- Stage 3 owner profiles already expose the trusted create routes and fleet sections.
- `npx.cmd prisma migrate status` reports that the Neon schema is up to date.

## 3. Actual Vehicle fields

The form uses only fields currently present in `Vehicle`:

- `type`;
- `manufacturer`;
- `model`;
- `year`;
- `vinOrSerial`;
- `comment` as the plain-text description/note.

There is no `registrationNumber`, separate `description`, `manufacturerId` relation, `createdById`, or `updatedById` field. No schema additions were made.

## 4. Company create route

`/admin/companies/[id]/vehicles/new` loads the company server-side, returns `notFound()` for an unknown owner, displays the company as read-only context, and binds the verified company ID to the server action.

The resulting ownership is always:

```text
clientId = null
companyId = verified company ID
```

## 5. Personal create route

`/admin/clients/[id]/vehicles/new` loads a `ClientProfile` whose user role is `CLIENT`, returns `notFound()` otherwise, and displays that client as read-only context.

The resulting ownership is always:

```text
clientId = verified ClientProfile ID
companyId = null
```

## 6. Edit route

The shared edit route is `/admin/vehicles/[vehicleId]/edit`. It loads the vehicle and its actual owner from the database. Invalid XOR ownership, a missing owner relation, or a non-client personal owner results in `notFound()`.

## 7. Reusable form

`AdminVehicleForm` is shared by both create routes and the edit route. It supports create/edit labels, read-only owner context, retained values after validation errors, pending state, safe error output, and responsive one/two-column layout.

## 8. Trusted owner context

The form contains no owner selector and sends no `clientId`, `companyId`, or trusted owner hidden field. Create actions receive an ID bound by the server page, re-query that owner, and construct ownership with the shared XOR helpers.

## 9. Type/manufacturer logic

- Equipment type uses `EQUIPMENT_TYPE_OPTIONS` and the light `SearchableCombobox`.
- Manufacturer options come from the `Manufacturer` table.
- The selected manufacturer is sent as an ID.
- The action re-queries the manufacturer and verifies compatibility with the equipment type.
- Because `Vehicle` stores a string, the verified database name is written to `Vehicle.manufacturer`.

## 10. Validation

- Equipment type must be an exact supported option.
- Manufacturer is required and must be a compatible database record.
- Model is trimmed and must contain 2-120 characters.
- Year is optional and must be a four-digit integer from 1950 through 2100.
- VIN/serial is optional, whitespace-normalized, and limited to 120 characters.
- Comment is optional plain text and limited to 5,000 characters.

Errors are Ukrainian, field-specific where possible, and do not expose Prisma or database details.

## 11. Server actions

The following server actions were added:

- `createAdminVehicleForCompany`;
- `createAdminVehicleForClient`;
- `updateAdminVehicle`.

Every action requires the existing CRM session guard for `ADMIN`/`MANAGER`, validates editable fields, verifies database relations, and returns safe form state on failure.

## 12. Ownership immutability

Update loads the stored owner and validates XOR ownership before writing. Its Prisma update contains only characteristics, so personal/company ownership cannot be transferred through this form or a forged form payload.

## 13. createdBy/updatedBy status

`Vehicle` has no `createdById` or `updatedById`; no audit fields or migration were added in this stage.

## 14. Redirect/revalidation

After create or update, the user is redirected to the verified owner profile with `#fleet`. Relevant owner profile and client vehicle routes are revalidated; unrelated public pages are not revalidated.

## 15. CRM fleet links

Each vehicle row in the company/client fleet section now has a `Редагувати` action. The section has the stable `fleet` anchor used by redirects.

## 16. Responsive/accessibility

- Form controls stack on small screens and use two columns from medium screens.
- Actions stack on mobile.
- Labels, required markers, `aria-invalid`, `aria-describedby`, error messages, focus states, and pending button state are present.
- Searchable comboboxes retain keyboard interaction and use the light CRM variant.

## 17. Security QA

Code inspection and type validation confirm:

- routes and actions use the server-side CRM role guard;
- client/company IDs are not accepted from editable form data;
- create actions re-query the trusted owner;
- update cannot alter ownership;
- manufacturer names are not trusted from the client;
- invalid owner relations are rejected.

## 18. Manual QA

The complete authenticated browser and database mutation smoke test was not performed in this implementation pass. It remains to verify on the deployed/staging UI with `ADMIN` and `MANAGER` accounts:

- company create;
- personal create;
- edit and unchanged owner IDs;
- direct `CLIENT` route/action denial;
- mobile layouts at the requested breakpoints.

No test vehicle was written to Neon during this task.

## 19. Technical checks

Completed before commit:

- `npx.cmd prisma migrate status`;
- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `git diff --check`.

The project has no `test` script, so no automated test command was available.

## 20. Prisma/migration status

Prisma schema was not changed. Neon reports 20 migrations and `Database schema is up to date!`. No migration is required for Stage 4.

## 21. Deferred to Stage 5

- Duplicate detection and VIN collision handling;
- photos and Cloudinary;
- vehicle documents;
- owner transfer;
- bulk import and OCR;
- client-side assisted vehicle flow.

## 22. Stage 5 blocker

There is no code or schema blocker for starting Stage 5 after browser smoke testing of these trusted create/edit flows. Duplicate-policy business rules still need to be defined before implementing duplicate detection.
