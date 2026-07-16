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

## sendDocument response parsing failure

After the font fix, production logs confirmed that PDF generation works:

```text
pdfGenerated: true
pdfBufferSize: 19200
sendDocumentAttempted: true
```

The next failure was:

```text
Unexpected end of JSON input
```

That means the invoice PDF buffer was created and `sendDocument` was attempted, but the Telegram response parser still used direct JSON parsing. If Telegram or an intermediate runtime returned an empty or non-JSON response body, `response.json()` threw before diagnostics could capture the real HTTP status or response text.

### Fix

`lib/telegram/bot.ts` now parses `sendDocument` responses defensively:

- reads the response body with `response.text()`;
- keeps a 300-character safe preview;
- runs `JSON.parse` only when the response body is not empty;
- converts empty/non-JSON responses into a controlled `TelegramApiError`;
- preserves Telegram `error_code`, `description`, and HTTP status when Telegram returns `{ ok: false }`;
- treats success only as an HTTP response with Telegram payload `{ ok: true, result: ... }`.

`lib/telegram/notifications.ts` now records `telegramResponsePreview` in the PDF failure diagnostics. This should prevent future diagnostics like:

```text
telegramHttpStatus: null
telegramErrorDescription: null
error: "Unexpected end of JSON input"
```

Expected diagnostics after redeploy:

- success: `sendDocumentOk=true`;
- failure: `telegramHttpStatus`, `telegramErrorDescription`, and `telegramResponsePreview` show the actual Telegram/API response.

### What to check after redeploy

1. Send a new or DRAFT invoice to a Telegram-linked client.
2. Confirm the text notification still arrives.
3. Confirm the PDF document arrives.
4. If the PDF still fails, inspect `INVOICE_PDF_FAILED` diagnostics for:
   - `telegramHttpStatus`;
   - `telegramErrorCode`;
   - `telegramErrorDescription`;
   - `telegramResponsePreview`.

## Multipart upload 400 with empty Telegram response

After safe response parsing was deployed, production diagnostics showed that `sendDocument` was no longer failing because of JSON parsing. The request reached Telegram, but Telegram returned:

```text
telegramHttpStatus: 400
telegramErrorDescription: "Telegram sendDocument returned empty response body."
telegramResponsePreview: ""
```

At that point the confirmed state was:

- text notification arrives;
- invoice PDF generation works;
- PDF buffer is created, around 19 KB;
- `sendDocument` is attempted;
- Telegram rejects the upload with HTTP 400 and no response body.

### Root suspicion

The remaining high-risk area was the manually assembled multipart body in `lib/telegram/bot.ts`:

- custom boundary;
- custom CRLF chunks;
- manual `Content-Type`;
- manual `Content-Length`;
- raw binary concatenation.

Telegram expects `document` as a standard multipart file field. A fragile manual multipart body can cause Telegram to reject the request before returning a useful JSON error.

### Fix

`sendDocument` now uses the Node `form-data` package instead of manual multipart construction.

The upload now appends:

- `chat_id`;
- optional `caption`;
- optional `reply_markup`;
- `document` with:
  - sanitized filename;
  - `Content-Type: application/pdf`;
  - `knownLength` matching the PDF buffer length.

Headers are taken from:

```ts
form.getHeaders()
```

The code intentionally does not manually set multipart `Content-Type`, boundary, or `Content-Length` for the first stabilized version.

### What did not change

- PDF generation;
- font loading;
- invoice status logic;
- Telegram text notification;
- Telegram inline buttons;
- Prisma schema;
- migrations.

### What to test after redeploy

1. Send a new or DRAFT invoice to a Telegram-linked client.
2. Confirm the text notification still arrives.
3. Confirm the PDF document arrives.
4. Expected logs:

```text
pdfGenerated: true
sendDocumentAttempted: true
sendDocumentOk: true
```

If Telegram still returns HTTP 400, keep the current diagnostics and consider the next fallback: write the PDF to `/tmp` and append `fs.createReadStream(tmpFilePath)` to the same `form-data` upload.
