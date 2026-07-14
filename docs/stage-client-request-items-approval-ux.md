# Kairos Parts — Client Request Items Approval UX

## Scope

This stage updates only the client UX for approving picked request items.

It does not implement invoices, invoice PDF generation, seller/buyer requisites, print, email or Telegram notifications, new company roles, used-equipment marketplace logic, or a new business module.

## Client UX Changes

The explicit contextual `Запросити зміну по заявці` block was removed from the client request detail page.

The `Підібрані позиції` block now uses simpler client-facing actions:

- checkbox `Включити у рахунок`;
- button `Погодити вибрані позиції`;
- per-item `Редагувати` disclosure;
- success/error messages in Ukrainian.

After approval, selected positions show:

- `Погоджено`;
- `Включено у рахунок`.

If the client tries to approve without selecting a position, the UI returns:

`Оберіть хоча б одну позицію для включення у рахунок.`

## Approval Logic

Approval is handled by `approveClientRequestItemsAction`.

The action:

- requires an authenticated `CLIENT`;
- checks access to the request through personal/company scope;
- accepts only items that belong to the request;
- accepts only `visibleToClient = true` items;
- sets selected items to `includeInInvoice = true` and `approvedByClient = true`;
- sets `approvedAt` for selected items;
- clears `includeInInvoice`, `approvedByClient`, and `approvedAt` for unselected visible items in the same request.

This prepares the next invoice flow without creating invoices in this stage.

## Edit Logic

The visible client action is called `Редагувати`, but technically it creates a `ChangeRequest` for manager review.

The client can request changes only for safe fields:

- `name`;
- `catalogNumber`;
- `analogNumber`;
- `quantity`;
- `comment`.

The client cannot edit:

- `purchasePrice`;
- `salePrice`;
- `supplierName`;
- `availability`;
- `deliveryTime`;
- `visibleToClient`;
- `approvedByClient`;
- `includeInInvoice`;
- `requestId`;
- `vehicleId`.

`includeInInvoice` is controlled only by the checkbox approval UX.

## CRM Changes

The CRM request detail page now shows per-position client decision state:

- `Погоджено клієнтом`;
- `Очікує погодження`;
- `Включено у рахунок`;
- `Не включено у рахунок`.

Managers can see which positions are ready for the future invoice flow.

## Prisma Migration

Migration prepared:

`prisma/migrations/20260713150000_add_request_item_invoice_selection/migration.sql`

Added to `RequestItem`:

- `includeInInvoice Boolean @default(false)`;
- `approvedAt DateTime?`;
- index on `includeInInvoice`.

The migration is prepared only. It was not applied to Neon/production-like DB in this stage.

## Security

The client action blocks:

- guests;
- non-CLIENT roles;
- foreign requests;
- hidden request items;
- request items that do not belong to the current request;
- forbidden fields in the edit flow.

The existing `ChangeRequest` backend and admin review flow remain in place.

## Checks

Required after implementation:

- `npx.cmd prisma generate`;
- `npx.cmd prisma validate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`.

## Next Step

Before testing on Vercel/Neon, apply the prepared migration to the intended database.

Blocker for invoice flow:

- no code blocker after migration;
- invoice flow should start only after this approval UX is smoke-tested with visible request items.

## Smoke Test / Stage 4.1

Date: 2026-07-14.

Migration applied: yes.

Applied migration:

`20260713150000_add_request_item_invoice_selection`

Database used:

- Neon Postgres from current `.env.local`;
- database: `neondb`;
- schema: `public`;
- host confirmed by Prisma CLI as the configured Neon host.

Prisma migration status after deploy:

`Database schema is up to date!`

Smoke test method:

- route-equivalent database smoke test through `npx.cmd prisma db execute`;
- temporary records were created with a `STAGE41` marker;
- the test verified approval fields, edit ChangeRequest creation, hidden/foreign access blocking, and company scope;
- temporary records were deleted by the smoke test script.

Verified:

- CLIENT can select a visible RequestItem for invoice;
- selected visible RequestItem receives `approvedByClient = true`;
- selected visible RequestItem receives `includeInInvoice = true`;
- selected visible RequestItem receives `approvedAt`;
- hidden RequestItem is not approved or included in invoice;
- hidden RequestItem does not match visible approval criteria;
- foreign personal CLIENT cannot access another client's item;
- CLIENT in the same Company scope can see the company request item state;
- CLIENT from another Company cannot access the company request item;
- `Редагувати` flow is represented by a `REQUEST_ITEM / UPDATE / PENDING` ChangeRequest;
- ChangeRequest stores `oldValue`, `newValue`, and reason;
- CRM/admin list can see the created pending ChangeRequest record;
- approval flow does not touch `purchasePrice`;
- test records were cleaned up.

Cleanup:

- test users: cleaned;
- test client profiles: cleaned;
- test companies and company members: cleaned;
- test requests: cleaned;
- test RequestItems: cleaned;
- test ChangeRequests: cleaned.

Final checks after Stage 4.1:

- `npx.cmd prisma generate`;
- `npx.cmd prisma validate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`.

Blocker for the next stage:

No code or migration blocker was found for the next invoice-flow planning stage. A browser UI pass on Vercel is still recommended after redeploy, because this smoke test was route-equivalent rather than manual browser testing.
