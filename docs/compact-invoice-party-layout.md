# Compact invoice party layout

## Scope

This update changes only the presentation of seller and buyer details in invoice print/PDF views.

It does not change:

- Prisma schema;
- invoice totals or VAT formulas;
- invoice items;
- invoice statuses;
- seller or buyer data sources;
- Telegram delivery logic.

## Seller and buyer details

Seller and buyer requisites are now formatted as compact text paragraphs instead of vertical label/value lists.

The shared helper is:

```ts
buildInvoicePartyDetails(snapshot, options)
```

It:

- accepts an invoice snapshot;
- skips empty optional fields;
- avoids `null`, `undefined`, empty commas, and placeholder dashes;
- returns one wrapped text line/paragraph for print and PDF layouts.

## Print layout

The browser print view keeps separate visual blocks:

- `Дані продавця`;
- `Дані покупця`.

Inside each block all available requisites are shown as one compact paragraph with normal wrapping and `overflow-wrap: anywhere` for long IBAN/email/address values.

The document remains A4 landscape.

## PDF layout

The PDF generator uses the same shared formatter. Seller and buyer blocks calculate their height dynamically from the paragraph text, so long requisites wrap without clipping and the items table starts higher than with the old vertical rows.

The document remains A4 landscape and continues to use bundled Inter font assets.
