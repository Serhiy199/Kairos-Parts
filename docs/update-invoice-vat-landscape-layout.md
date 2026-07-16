# Invoice VAT totals and landscape invoice layout

## Audit

- `RequestItem.salePrice` is used as the manager-facing sale price for a picked position.
- `InvoiceItem.price` snapshots the selected `RequestItem.salePrice` at invoice creation.
- `InvoiceItem.total` snapshots `price * quantity`.
- `Invoice.totalAmount` and `Invoice.subtotal` were created as the sum of invoice item totals, so they represent the subtotal without VAT in the current implementation.
- The Prisma schema does not have persisted `vatRate` or `vatAmount` fields.

## Decision

No Prisma schema change or migration was needed.

For backward compatibility and consistent display, invoice totals are calculated from persisted `InvoiceItem` rows:

- `Ціна без ПДВ` = `InvoiceItem.price`.
- `Сума без ПДВ` = `InvoiceItem.total` or `price * quantity` if stored total is zero.
- `Разом` = sum of item totals without VAT.
- `Сума ПДВ` = `Разом * 20%`.
- `Усього з ПДВ` = `Разом + Сума ПДВ`.

The 20% VAT rate remains an internal formula. Visible labels do not show the percentage.

## Implementation

- Added shared invoice helpers in `lib/invoices/totals.ts`.
- Updated client picked positions to show `Ціна без ПДВ` and `Сума без ПДВ`.
- Updated CRM picked positions and the RequestItem form label to use `Ціна без ПДВ`.
- Removed the top `Загальна сума` line from CRM invoice cards.
- Added invoice totals blocks to CRM and client invoice views.
- Updated print invoice table labels and totals.
- Switched print view to A4 landscape.
- Switched server-side PDF generation to A4 landscape.
- Added `Виконавець` and `Замовник` signature lines to print/PDF.
- Updated Telegram invoice notification and PDF caption to use `Усього з ПДВ` as the amount due.

## Not changed

- Prisma schema and migrations.
- Invoice statuses.
- Request statuses.
- RequestItem approval and include-in-invoice flow.
- Telegram request creation and registered-client flow.
- Seller/buyer billing source data.
- Payment actions.

## Notes

The PDF table repeats its header on page breaks through the existing PDFKit row rendering flow. Totals and signatures are rendered only after the last table row.
