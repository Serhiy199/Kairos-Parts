# Fix: Telegram invoice PDF delivery

## Context

After TG-6 and TG-6.1, Telegram invoice text notifications arrived and the buttons opened the correct invoice/request pages, but the invoice PDF document did not arrive in Telegram.

Example checked by the client:

- request: `KP-20260715-520169`;
- invoice: `KP-20260715-520169-INV-03`;
- amount: `500,00 UAH`.

## Investigation

The text notification path works, so the recipient lookup, Telegram chat binding, and invoice send trigger are active.

The remaining failure area is the PDF branch after the text notification:

1. PDF generation;
2. PDF buffer creation;
3. Telegram `sendDocument`;
4. Telegram API response handling.

Historical Vercel logs for the exact `INV-03` event were not available from the local CLI in this environment. The installed Vercel CLI accepts only a live deployment log stream and does not support the historical `--query` / `--since` filters used by newer CLI versions.

## Root Cause Addressed

The highest-risk implementation detail was `sendDocument` using Web `FormData` / `Blob` for a Node/Vercel serverless upload.

That can be brittle because Telegram expects a multipart file upload with a filename, and Vercel/Node runtimes can differ in how Web `FormData` serializes `Blob` file parts.

## Fix

`lib/telegram/bot.ts` now sends Telegram documents with an explicit Node multipart body:

- stable boundary;
- explicit `Content-Disposition`;
- explicit PDF filename;
- `Content-Type: application/pdf`;
- `Content-Length`;
- raw `Buffer` body.

This removes the dependency on Web `FormData` / `Blob` serialization for invoice PDFs.

## Diagnostics

Telegram API failures now throw a structured `TelegramApiError` with safe fields:

- method;
- HTTP status;
- Telegram `error_code`;
- Telegram `description`.

Invoice PDF delivery logs and Notification records now include:

- `event=INVOICE_PDF_SENT` or `event=INVOICE_PDF_FAILED`;
- `invoiceId`;
- `invoiceNumber`;
- `requestId`;
- `chatIdExists`;
- `pdfGenerated`;
- `pdfBufferSize`;
- `pdfFilename`;
- `sendDocumentAttempted`;
- `sendDocumentOk`;
- Telegram error code / HTTP status / description when available.

Secrets are not logged:

- no Telegram token;
- no full chat id;
- no database URL;
- no private credentials.

## Behavior

The fail-open behavior is preserved:

- invoice remains `SENT`;
- text notification still sends first;
- if PDF delivery fails, the invoice send flow does not roll back;
- the PDF failure reason is recorded in logs and Notification diagnostics.

## Files Changed

- `lib/telegram/bot.ts`;
- `lib/telegram/notifications.ts`;
- `docs/fix-telegram-invoice-pdf-delivery.md`.

## Prisma

No Prisma schema changes.

No migration needed.

## Checks

Completed:

- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- `git diff --check` - passed.

## Manual Smoke Test After Redeploy

1. Create or reuse a DRAFT invoice for a client with a linked Telegram chat.
2. Click `Надіслати клієнту`.
3. Confirm Telegram receives the text invoice notification.
4. Confirm Telegram receives the PDF document.
5. Open the PDF and verify:
   - Ukrainian text renders correctly;
   - seller and buyer details are present;
   - invoice items are present;
   - total amount matches the text notification;
   - no internal/private data is exposed.
6. If the PDF still does not arrive, check the latest `Notification` record and Vercel logs for `INVOICE_PDF_FAILED`.

## Vercel PDFKit Helvetica.afm failure

Production logs later confirmed the exact root cause:

```text
pdfGenerated: false
sendDocumentAttempted: false
ENOENT: no such file or directory, open '/var/task/.next/server/chunks/data/Helvetica.afm'
```

That means the PDF never reached Telegram. `sendDocument` was not called because PDFKit failed while trying to initialize its default standard font metrics file, `Helvetica.afm`, inside the Vercel serverless bundle.

### Fix

The invoice PDF generator no longer lets PDFKit initialize Helvetica as the default font.

`lib/invoices/pdf.ts` now creates the document with an explicit default font:

```ts
new PDFDocument({
  size: 'A4',
  margin: 38,
  bufferPages: true,
  font: REGULAR_FONT_PATH
})
```

The PDF uses bundled Inter font assets that work with PDFKit locally and support Ukrainian text:

- `node_modules/prisma/build/public/assets/inter-all-400-normal.4c1f8a0d.woff`;
- `node_modules/prisma/build/public/assets/inter-all-600-normal.d0a7c8a9.woff`.

The previous `inter-cyrillic-*.woff2` files were not used for the final fix because a local PDFKit smoke test with WOFF2 failed in `fontkit`. The `inter-all-*.woff` files generated a valid PDF buffer.

### Vercel tracing

`next.config.ts` now includes the exact Inter WOFF assets used by PDFKit in `outputFileTracingIncludes`.

The fix intentionally does not trace `Helvetica.afm`; the PDF generator should not depend on PDFKit standard fonts for this invoice flow.

### Local smoke test

A local PDFKit smoke test generated a valid PDF buffer with:

- custom Inter default font passed to `new PDFDocument`;
- Inter bold registered explicitly;
- Ukrainian text;
- `%PDF` header;
- non-empty buffer.

Expected production diagnostics after redeploy:

```text
pdfGenerated: true
pdfBufferSize: > 0
pdfFilename: "...pdf"
sendDocumentAttempted: true
```

Expected absent errors:

```text
Helvetica.afm
ENOENT
```
