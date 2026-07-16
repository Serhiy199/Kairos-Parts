# Compact invoice print pagination

## Root cause

The extra second page in browser print was caused by cumulative vertical spacing, not by invoice data.

Main contributors:

- `@page` margin was `12mm`, reducing available height in A4 landscape print.
- Header used large spacing: `gap-6`, `pb-6`, `text-3xl`, status card `p-4`.
- Seller/buyer blocks used `p-4`, `mt-6`, `gap-4`, and paragraph `leading-6`.
- The table used `py-3` in header and body cells.
- Totals used `mt-5`, `p-4`, and larger row gaps.
- Signature block used `mt-10`, `pt-8`, inner `mt-8`, and `break-inside: avoid`.
- Footer used `mt-8`, `pt-4`, and `leading-5`.

Together these pushed the final total, signatures, and footer to an almost empty second page.

## Font sizes

### Browser print

Old effective print sizes:

- invoice title: Tailwind `text-3xl` inherited into print;
- seller/buyer details: Tailwind `text-sm` with `leading-6`;
- section titles: Tailwind `text-xs`;
- table body: `11px`;
- totals: Tailwind `text-sm` / `text-base`;
- signatures: Tailwind `text-sm`;
- footer note: Tailwind `text-xs` with `leading-5`.

New print-specific sizes:

- invoice title: `19pt`;
- request/meta: `8.5pt`;
- seller/buyer section title: `8pt`;
- seller/buyer details: `8.5pt`, line-height `1.28`;
- table header/body: `8pt`;
- item comments: `7.5pt`;
- totals: `8.5pt`, final total `10pt`;
- signatures: `8.5pt`;
- footer note: `7.5pt`, line-height `1.35`.

### Server PDF

Old PDF sizes:

- invoice title: `21`;
- brand: `9.5`;
- meta: `9`;
- section title: `10`;
- seller/buyer details: `8.5`;
- table header: `7.2`;
- table body: `7.4`;
- totals: `8.5`, final total `10`;
- signatures: `9`;
- footer: `8`.

New PDF sizes:

- invoice title: `19`;
- brand: `9`;
- meta: `8.8`;
- section title: `8.8`;
- seller/buyer title: `8.2`;
- seller/buyer details: `8`;
- table header: `7.2`;
- table body: `7.2`;
- totals: `8`, final total `10`;
- signatures: `8.8`;
- footer: `8`.

## Layout changes

Browser print:

- `@page` margin changed from `12mm` to `9mm`.
- Header spacing and status-card padding reduced in print.
- Seller/buyer blocks use compact print-only padding and line-height.
- Table header/body vertical padding reduced in print.
- Totals padding and row gaps reduced.
- Signature block top margin and signature-line spacing reduced.
- `break-inside: avoid` was removed from the full signature block to avoid forcing large lower content onto a new page.
- Footer margin, padding, and line-height reduced.

PDF:

- `PAGE_MARGIN` changed from `34` to `30`.
- `SECTION_GAP` changed from `14` to `9`.
- `TABLE_HEADER_HEIGHT` changed from `22` to `18`.
- `TABLE_MIN_ROW_HEIGHT` changed from `34` to `28`.
- Seller/buyer block padding and text line-gap reduced.
- Totals required height changed from `66` to `50`.
- Signature required height changed from `58` to `42`.
- Header vertical increments reduced.
- Footer required space reduced.

## Page-break behavior

No forced page break existed before totals/signatures/footer. The practical issue was excessive reserved/visual height. The updated layout reduces those heights and avoids keeping the signature area as a large indivisible print block.

For PDF, `ensureSpace` is still used, but with smaller and more accurate required heights for totals, signatures, and footer.

## Expected behavior

For short or medium requisites:

- 1 item: should fit on one A4 landscape page.
- 2 items: should fit on one A4 landscape page.
- 5 items: should fit on one A4 landscape page.

For larger invoices:

- 10 items: may fit or flow depending on row text length.
- 20+ items: expected to flow onto additional pages, with totals/signatures/footer after the last item.

## Migration

No Prisma migration is needed.
