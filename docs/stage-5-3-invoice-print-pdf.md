# Stage 5.3: Invoice print view / browser PDF

## Summary

Stage 5.3 adds a print-friendly invoice view for CRM and client cabinets. The implementation uses an HTML print page and the browser print dialog for PDF export instead of adding server-side PDF generation dependencies.

## What changed

- Added a reusable invoice print layout.
- Added a client-side print button that calls `window.print()`.
- Added protected CRM route: `/admin/invoices/[invoiceId]/print`.
- Added protected client route: `/client/invoices/[invoiceId]/print`.
- Added CRM invoice actions:
  - `Переглянути рахунок`;
  - `Друк / PDF`.
- Added a client invoice `Друк / PDF` link in request details.

## Access rules

CRM print route:

- Requires `MANAGER` or `ADMIN`.
- Uses `getInvoiceForAdmin`.
- Can open invoice drafts because CRM needs to review DRAFT before sending.

Client print route:

- Requires `CLIENT`.
- Uses current personal/company access scope.
- Uses `getInvoiceForClient`, so DRAFT invoices are not visible to clients.
- Follows the existing client-visible invoice status rules.

## Print layout

The print view includes:

- invoice number;
- request number;
- invoice date and status;
- seller snapshot;
- buyer snapshot;
- invoice item table;
- total amount and currency;
- manager/client comments when present.

The page is designed for A4 printing with:

- no sidebar;
- no dashboard chrome;
- `@media print` styles;
- `@page` A4 margins;
- hidden screen-only controls during printing.

## What was not changed

- No Prisma schema changes.
- No migration.
- No RequestDocument generation.
- No physical PDF file storage.
- No email or Telegram delivery.
- No invoice business-status changes.

## Stage 5.4 note

Stage 5.4 can add optional PDF file generation and attach the generated file as a `RequestDocument` if the business process requires stored invoice files.

## Verification

To verify:

1. Open CRM request details with an invoice.
2. Click `Переглянути рахунок` or `Друк / PDF`.
3. Confirm `/admin/invoices/[invoiceId]/print` opens without CRM sidebar.
4. Use the print button and choose browser `Save as PDF`.
5. Send an invoice to client.
6. Open the client request details.
7. Confirm visible invoices have `Друк / PDF`.
8. Confirm DRAFT invoices are not available through the client print route.

Automated checks for this stage:

- `npx.cmd prisma generate`
- `npx.cmd prisma validate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
