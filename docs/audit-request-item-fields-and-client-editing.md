# Audit: RequestItem fields and client editing cleanup

## Scope

This change audits and simplifies the picked request item UX around two fields:

- `analogNumber` / "Аналоговий номер";
- `deliveryTime` / "Орієнтовний термін".

It also removes the visible client-side "Редагувати" action for picked request items.

## Model Findings

The picked position model is `RequestItem` in `prisma/schema.prisma`.

Relevant existing fields:

- `analogNumber String?`
- `deliveryTime String?`
- `approvedByClient Boolean`
- `includeInInvoice Boolean`
- `approvedAt DateTime?`

The fields are nullable. They also exist on historical snapshot models:

- `CommercialOfferItem.analogNumber`
- `CommercialOfferItem.deliveryTime`
- `InvoiceItem.analogNumber`

## Safe Implementation Decision

No Prisma migration was added.

The safer approach is to keep existing DB columns for historical compatibility and remove these fields from the active UI and new write paths:

- CRM RequestItem add/edit forms no longer render `analogNumber` or `deliveryTime`.
- RequestItem validation no longer reads these fields from create/update payloads.
- New invoice items no longer copy `analogNumber`.
- New commercial offer items no longer copy `analogNumber` or `deliveryTime`.
- Invoice UI, print view, and generated PDF no longer show `analogNumber`.
- Existing historical DB values are preserved but hidden from the main UI.

## Client Editing Audit

Before this cleanup, the client request detail page showed a per-position "Редагувати" disclosure.

That UI submitted to `createClientRequestItemEditAction`, which creates a `ChangeRequest` with:

- `entityType = REQUEST_ITEM`
- `action = UPDATE`
- `status = PENDING`

It did not directly mutate `RequestItem`. Manager approval was still required through the existing ChangeRequest workflow.

Removing the visible "Редагувати" UI is safe for the current customer flow because the client still has:

- checkbox "Включити у рахунок";
- "Погодити вибрані позиції";
- status badges "Погоджено" and "Включено у рахунок".

The backend ChangeRequest infrastructure was intentionally left in place because it is shared with other change scenarios and may be needed again later.

## What Changed

### CRM

Removed from RequestItem add/edit UI:

- "Аналоговий номер";
- "Орієнтовний термін".

Removed from RequestItem cards/tables:

- "Аналог";
- delivery time line under availability.

### Client Cabinet

Removed:

- visible "Редагувати" button;
- inline edit form for picked positions.

Kept:

- "Включити у рахунок";
- "Погодити вибрані позиції";
- picked position statuses;
- invoice approval flow.

### Invoice / PDF

Removed analog number from:

- invoice item tables in CRM/client views;
- invoice print view;
- generated invoice PDF table.

Invoice totals and financial calculations were not changed.

## Migration

Migration is not required.

DB columns are left intact to avoid risky historical-data cleanup and to keep old records readable by backend code if needed.

## Remaining Backend

`createClientRequestItemEditAction` remains in the codebase but is no longer exposed from the client request detail UI. It still requires a valid client session and request access scope.

The broader `ChangeRequest` workflow remains untouched.

