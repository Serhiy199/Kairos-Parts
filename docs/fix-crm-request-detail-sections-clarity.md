# Fix: CRM request detail sections clarity

## Summary

This fix improves copy and empty states in the CRM request detail page so managers can clearly distinguish between invoices, manager-added documents, client-provided files, and OCR hints.

## Renamed sections

### Documents and attachments

Old label:

- `Документи заявки`

New label:

- `Документи та вкладення заявки`

Role:

- Files manually added by a manager to a request.
- Examples: specifications, contracts, acts, PDF, Word, Excel, images, and other attachments.
- Client visibility still depends on the existing `visibleToClient` flag.

The description no longer positions this section as the main invoice area because system invoices are managed in the separate `Рахунки` section.

### Client-provided files

Old label:

- `Файли і документи`

New label:

- `Файли, надані клієнтом`

Role:

- Files sent by the client while creating a request, through the client cabinet, or through Telegram.
- Examples: part photos, nameplate photos, position lists, PDF/Excel documents, Telegram photos, and Telegram documents.

Updated helper copy:

- The page now explains that files are protected and opened through CRM without exposing private storage paths.

## OCR hints

The OCR block is now more compact.

If there are no image files for OCR:

- The block shows a short empty state: photos or documents for recognition have not been added yet.
- The OCR launch button is not shown.
- The extra `OCR ще не виконано` empty state is hidden.

If OCR-capable image files exist:

- The OCR description explains that it can help extract text, articles, or catalog numbers.
- The existing OCR launch action remains available.
- Existing OCR result/correction logic is unchanged.

## What was not changed

- No Prisma schema changes.
- No migrations.
- No file upload changes.
- No storage/download route changes.
- No OCR service changes.
- No invoice logic changes.
- No RequestDocument business logic changes.
- No document enum values were removed.

## Verification

Checks to run:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

Manual smoke test:

1. Open `/admin/requests/[id]`.
2. Confirm `Рахунки` remains the system invoice section.
3. Confirm `Документи та вкладення заявки` describes manager-added attachments.
4. Confirm `Файли, надані клієнтом` describes files from site/client cabinet/Telegram.
5. Confirm file links still use protected CRM routes.
6. Confirm OCR button is hidden when there are no OCR-capable files.
7. Confirm OCR button is shown when image files exist.
