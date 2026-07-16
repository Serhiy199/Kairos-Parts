# Fix invoice PDF layout

## Context

Telegram invoice delivery already works after switching document upload to `node-telegram-bot-api`.

The remaining issue was the generated invoice PDF layout:

- content could appear shifted to the right;
- seller and buyer details were too narrow when visually rendered;
- the invoice items table used fixed widths that were not tied to the real A4 content width;
- long values risked overflowing or being clipped.

This fix changes only the PDF layout in `lib/invoices/pdf.ts`.

## What Changed

- Added stable A4 layout constants:
  - `PAGE_MARGIN = 40`;
  - content width is calculated from the actual PDF page width;
  - all major blocks start from the same left margin.
- Reworked the invoice into a single-column layout:
  - invoice header;
  - invoice meta rows;
  - seller details;
  - buyer details;
  - invoice items table;
  - total amount.
- Replaced fixed table width with columns scaled to the available content width.
- Added wrapped text rendering for key/value rows and table cells.
- Added row-height calculation based on wrapped content.
- Added page-break handling for key/value rows and table rows.
- Added repeated table headers after page breaks.
- Restored readable Ukrainian labels in the PDF source.
- Kept bundled Inter font usage for Cyrillic support.

## Table Width

The table now starts at `PAGE_MARGIN` and uses the available A4 content width.

Base columns:

```text
№        22
Назва    125
Виробник 70
Артикул  105
К-сть    45
Од.      35
Ціна     55
Сума     58
```

The base total is `515`, matching the expected A4 portrait content width with a 40 pt margin. If the actual page width differs, columns are scaled to fit.

## Text Wrapping

Long values are written with explicit width constraints:

- legal names;
- addresses;
- IBAN;
- emails;
- item names;
- catalog and analog numbers;
- comments.

The table calculates row height from wrapped text so long values increase row height instead of being clipped.

## Page Breaks

The PDF generator checks available vertical space before writing blocks or table rows. If the next block does not fit, it adds a new page. For table rows, the header is repeated on the new page.

## Not Changed

- Telegram delivery logic;
- `node-telegram-bot-api` upload flow;
- Telegram text notification;
- Telegram inline buttons;
- invoice status transitions;
- invoice business logic;
- Prisma schema;
- migrations.

## Local Smoke Test

A temporary script was used to try generating a DB-backed invoice PDF locally. The script itself was not committed.

The local generation was blocked before PDF generation by the Prisma/Neon TLS connection in this Windows environment:

```text
Error opening a TLS connection: В пакете безопасности отсутствуют учетные данные
```

Because the failure happened during the invoice lookup, it did not indicate a PDF layout error. The production smoke test should be done after redeploy by sending an invoice to a Telegram-linked client and opening the delivered PDF.

## Checks

Run after implementation:

```bash
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

