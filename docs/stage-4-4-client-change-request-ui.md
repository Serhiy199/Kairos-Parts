# Kairos Parts — Stage 4.4: Client Change Request UI

## Status

Stage 4.4 is implemented in code.

No Prisma migration was required for this stage because the ChangeRequest model and migration were completed in Stage 4.3 / 4.3.1.

## Goal

Add contextual client UI for creating ChangeRequests directly from the places where the client naturally sees the data:

- request detail page;
- visible request item rows;
- vehicle detail page;
- client change request history page.

Approved/rejected ChangeRequests still do not apply changes automatically. This stage only creates `PENDING` ChangeRequest records for manager review.

## Files Changed

- `app/client/requests/[id]/page.tsx`
- `app/client/vehicles/[id]/page.tsx`
- `app/client/change-requests/actions.ts`
- `app/client/change-requests/contextual-change-request-form.tsx`
- `app/client/change-requests/page.tsx`
- `app/admin/change-requests/page.tsx`
- `lib/change-requests/validation.ts`

## Request Change UI

Added a contextual block on:

- `/client/requests/[id]`

It creates ChangeRequests with:

- `entityType = REQUEST`;
- `entityId = request.id`;
- `action = UPDATE`;
- `status = PENDING`.

Fields:

- what needs to be changed;
- new value;
- reason.

The form stores the new value as JSON:

```json
{ "text": "..." }
```

Current request values are stored in `oldValue` where safe:

- `description`;
- `equipmentType`;
- `model`;
- `vinOrSerial`.

## RequestItem Change UI

Added contextual forms next to visible client request items on:

- `/client/requests/[id]`

They create ChangeRequests with:

- `entityType = REQUEST_ITEM`;
- `entityId = requestItem.id`;
- `action = UPDATE`;
- `status = PENDING`.

Supported field options:

- `catalogNumber`;
- `analogNumber`;
- `name`;
- `quantity`;
- `comment`;
- `other`.

Current item values are stored in `oldValue` where safe.

## Vehicle Update / Archive UI

Added contextual blocks on:

- `/client/vehicles/[id]`

Vehicle update request:

- `entityType = VEHICLE`;
- `entityId = vehicle.id`;
- `action = UPDATE`;

Supported field options:

- `type`;
- `manufacturer`;
- `model`;
- `year`;
- `vinOrSerial`;
- `comment`;
- `other`.

Vehicle archive request:

- `entityType = VEHICLE`;
- `entityId = vehicle.id`;
- `action = ARCHIVE`;

Important:

- the UI says `Запросити архівацію техніки`;
- it does not say delete;
- the vehicle is not archived automatically at Stage 4.4.

## Client Change Request History

Updated:

- `/client/change-requests`

The page now shows clearer information:

- date;
- status;
- entity type;
- entity label where available;
- action;
- old value;
- new value;
- reason;
- manager/admin comment;
- cancel button for own `PENDING` requests.

Entity labels are resolved for:

- requests;
- request items;
- vehicles;
- request documents.

The manual technical form remains as a fallback for advanced cases where the client or support person needs to enter an entity ID manually.

## Admin Review Display

Updated:

- `/admin/change-requests`

The page now shows:

- Ukrainian labels;
- old value;
- new value;
- client reason;
- admin comment / reviewer metadata.

Approve/reject behavior is unchanged and still does not apply changes automatically.

## Validation

Updated validation:

- `entityType` is required and must be valid;
- `entityId` is required;
- `action` is required and must be valid;
- `fieldName` is optional and trimmed;
- `newValue` is stored as JSON when submitted from contextual UI;
- either `reason` or `newValue` must be present;
- CLIENT cannot set `status`;
- CLIENT cannot set `reviewedById`;
- entity access is still enforced by the existing service layer.

## Access And Scope

Stage 4.4 reuses existing company/client access context.

Rules:

- CLIENT can request changes only for own personal data or own company data;
- CLIENT can request changes only for accessible requests;
- CLIENT can request changes only for visible request items that belong to accessible requests;
- CLIENT can request changes only for accessible vehicles;
- CLIENT from another company cannot create ChangeRequests for foreign data;
- GUEST has no access because client pages/actions require CLIENT session.

## Not Included

Not implemented intentionally:

- automatic applying approved changes;
- real field mutation after approval;
- vehicle archive execution after approval;
- document deletion after approval;
- notifications;
- email / Telegram sending;
- full audit log;
- company member role system;
- invoice/PDF generation.

## Verification

Commands run:

- `npx.cmd prisma generate`
- `npx.cmd prisma validate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

Result:

- all checks passed.

## Manual Smoke Checklist

Recommended UI smoke test:

1. Login as CLIENT.
2. Open `/client/requests/[id]`.
3. Submit `Запросити зміну по заявці`.
4. Verify the request appears on `/client/change-requests`.
5. Verify MANAGER / ADMIN sees it on `/admin/change-requests`.
6. Submit `Запросити зміну позиції` for a visible request item.
7. Verify `entityType = REQUEST_ITEM`.
8. Open `/client/vehicles/[id]`.
9. Submit vehicle update request.
10. Submit vehicle archive request.
11. Verify vehicle is not archived automatically.
12. Verify CLIENT cannot create a ChangeRequest for foreign entities.
13. Verify own `PENDING` requests can be cancelled.

## Blockers

No known code blockers for Stage 4.5 — Admin review UI improvements.

Stage 4.6 — automatic applying approved changes — should remain a separate implementation stage because it will mutate business entities and needs field-level rules.
