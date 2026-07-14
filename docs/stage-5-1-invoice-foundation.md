# Kairos Parts — Stage 5.1: Invoice foundation

## Summary

Stage 5.1 adds the foundation for invoices without PDF generation. The CRM can create a read-only invoice from client-approved request items, move it through basic statuses, and expose sent invoices to the client cabinet.

This stage does not replace CommercialOffer. CommercialOffer remains in the system, while Invoice works directly from approved `RequestItem` records according to the newer customer flow.

## Prisma Changes

Added:

- `InvoiceStatus` enum:
  - `DRAFT`
  - `SENT`
  - `PAID`
  - `CANCELLED`
- `Invoice` model.
- `InvoiceItem` model.
- Relations:
  - `Request.invoices`
  - `Company.invoices`
  - `User.clientInvoices`
  - `User.createdInvoices`
  - `RequestItem.invoiceItems`

Migration prepared:

```text
prisma/migrations/20260714100000_add_invoices/migration.sql
```

The migration is prepared but not applied to Neon/production-like DB in this stage.

## Invoice Number

Invoice numbers are generated from the request number:

```text
<requestNumber>-INV-01
<requestNumber>-INV-02
```

The sequence is based on existing invoices for the same request. `invoiceNumber` is unique in the database.

## Invoice Creation

CRM creates an invoice from `RequestItem` records only when all of these are true:

```text
approvedByClient = true
includeInInvoice = true
visibleToClient = true
```

If no such positions exist, the action returns a controlled message:

```text
Немає погоджених позицій для створення рахунку.
```

Copied fields:

- name
- brand
- catalogNumber
- analogNumber
- quantity
- unit
- salePrice as invoice item price
- comment

If `salePrice` is empty, invoice item price is `0`.

Totals:

- `InvoiceItem.total = quantity * price`
- `Invoice.subtotal = sum(items.total)`
- `Invoice.totalAmount = subtotal`
- `currency = UAH`

## Status Logic

Supported transitions:

- `DRAFT -> SENT`
- `DRAFT/SENT -> CANCELLED`
- `SENT -> PAID`

Blocked transitions:

- `PAID -> DRAFT`
- `CANCELLED -> SENT`
- sending an empty invoice

## CRM UI

In `app/admin/requests/[id]/page.tsx`, a new `Рахунки` block shows:

- invoice number;
- status;
- creation date;
- total amount and currency;
- item count;
- read-only invoice item table;
- actions:
  - `Створити рахунок`;
  - `Надіслати клієнту`;
  - `Скасувати`;
  - `Позначити як оплачено`.

The `Створити рахунок` button is disabled until at least one visible request item is approved by the client and included in invoice.

## Client UI

In `app/client/requests/[id]/page.tsx`, a new `Рахунки` block shows only invoices with statuses:

- `SENT`
- `PAID`
- `CANCELLED`

The client does not see `DRAFT` invoices.

Client labels:

- `SENT` — `Очікує оплати`
- `PAID` — `Оплачено`
- `CANCELLED` — `Скасовано`

The client sees invoice items read-only. PDF download is intentionally not included.

## Permissions

- MANAGER and ADMIN can create/send/cancel/mark invoice as paid.
- CLIENT cannot create invoices.
- CLIENT sees only invoices for requests available through personal/company scope.
- CLIENT does not see draft invoices.
- GUEST has no access through client/admin pages.

Authorization is enforced in server actions/service logic, not only in UI.

## Out Of Scope

Not implemented in Stage 5.1:

- PDF generation;
- print layout;
- email or Telegram sending;
- automatic `RequestDocument` creation;
- billing details forms;
- seller/buyer requisites;
- VAT calculations;
- payment flow;
- BAS/1C integration;
- invoice templates;
- editing invoice items after creation.

## Next Stage

Recommended next steps:

- billing details;
- invoice PDF generation;
- print/download flow;
- saving generated PDF as `RequestDocument` with `type = INVOICE`;
- optional notification when invoice is sent.

## Verification Notes

Expected checks:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Manual smoke testing requires applying the migration to the intended DB first.
