# Stage TG-6 — Send invoice PDF file to Telegram

## Summary

Stage TG-6 adds a server-side PDF attachment to the existing Telegram invoice notification flow.

When an invoice changes from `DRAFT` to `SENT`, the system keeps the existing text Telegram notification and then tries to generate and send a PDF document with the invoice data.

## PDF generation

PDF generation is implemented in `lib/invoices/pdf.ts`.

The PDF is generated server-side from invoice data loaded from the database:

- invoice number;
- request number;
- request creation date;
- invoice sent date;
- seller billing snapshot;
- buyer billing snapshot;
- invoice items;
- quantity, unit, price, line total;
- total amount.

The PDF is generated in memory and sent directly to Telegram. It is not stored in `RequestDocument` in this stage.

## Library

The implementation uses `pdfkit`.

This was chosen for the MVP because the project currently has only an HTML print view, while Telegram needs a real file buffer for `sendDocument`.

## Cyrillic support

PDFKit uses Inter Cyrillic assets already present in project dependencies:

- `inter-cyrillic-400-normal`;
- `inter-cyrillic-600-normal`.

The files are included in Next.js output tracing through `next.config.ts`, so the server runtime can embed the font and render Ukrainian text correctly.

## Telegram document send

`lib/telegram/bot.ts` now supports:

```ts
sendTelegramDocument({
  chatId,
  buffer,
  filename,
  caption
})
```

It uses Telegram Bot API `sendDocument` with multipart form data.

Filename format:

```text
{invoiceNumber}.pdf
```

Caption format:

```text
Рахунок {invoiceNumber} по заявці {requestNumber}
Сума до оплати: {totalAmount} {currency}
```

## Invoice sent flow

`sendTelegramInvoiceSentNotification` now performs:

1. Resolve Telegram recipient.
2. Send the existing text notification.
3. Generate invoice PDF.
4. Send PDF document.

If there is no `telegramChatId`, the whole Telegram notification flow is skipped before PDF generation.

## Fail-open behavior

Invoice status transition is still owned by `sendInvoiceToClient`.

If Telegram text delivery, PDF generation, or Telegram document delivery fails, the invoice remains `SENT`.

PDF delivery creates its own `Notification` record:

- `SENT` when the PDF document was sent;
- `FAILED` when PDF generation or `sendDocument` failed.

No secrets or Telegram token values are logged.

## Total amount fix

Telegram invoice notification and PDF now use a shared total resolver.

If `invoice.totalAmount` is not zero, it is used.

If `invoice.totalAmount` is `0`, the system recalculates the total from invoice items:

```text
item.total
```

or, if line total is zero:

```text
item.quantity * item.price
```

This prevents Telegram from showing `0,00 UAH` for invoices that have billable positions.

## Security notes

- PDF is generated only for the invoice being sent by the existing CRM invoice flow.
- Recipient is resolved through the same request/client/company Telegram recipient logic already used by TG-2/TG-3.
- The PDF contains invoice billing snapshots and invoice items only.
- It does not include private storage paths.
- It does not include internal manager-only request notes.
- Existing login redirect links remain unchanged.

## Not included in TG-6

This stage does not add:

- invoice approve/reject in Telegram;
- payment flow;
- PDF storage in `RequestDocument`;
- Vercel Blob/S3/R2 storage;
- email attachments;
- manual resend UI;
- invoice template editor;
- new invoice statuses;
- RequestItem approval changes.

## Prisma

No Prisma schema change was needed.

No migration was added.

## Checks

Completed after implementation:

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — blocked by Windows `EPERM` on Prisma engine DLL rename.
- `npx.cmd prisma generate --no-engine` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed with LF/CRLF warnings only.

## Manual smoke test recommendation

Use an invoice for a client with `telegramChatId`.

Expected:

1. Manager sends invoice.
2. Invoice becomes `SENT`.
3. Telegram text notification arrives.
4. Telegram PDF document arrives.
5. PDF filename contains invoice number.
6. PDF opens and Ukrainian text is readable.
7. PDF total equals Telegram text total.

For a client without `telegramChatId`, invoice sending should still succeed and Telegram/PDF should be skipped.
