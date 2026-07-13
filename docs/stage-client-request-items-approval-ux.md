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
