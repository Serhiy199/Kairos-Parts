# Stage Used Equipment 9 — Public inquiry form

## Summary

Stage 9 adds a public inquiry flow for published used equipment listings. Visitors can send a short request from the public catalog card or the public equipment detail page without exposing CRM functionality.

## Public CTA

- Catalog card CTA: `Запит на перегляд техніки`.
- Detail page CTA: `Запит на перегляд техніки`.
- Both CTAs open a modal dialog instead of navigating away from the listing.

## Inquiry Fields

The public form intentionally contains only:

- `Ім’я *`
- `Телефон *`

A hidden honeypot field `website` is included for basic spam protection.

## Server Validation

The server action validates:

- equipment id exists;
- source is allowlisted;
- name is present and has an acceptable length;
- phone is present and normalizes to a valid length;
- equipment status is still `PUBLISHED`.

If the equipment was archived or unpublished after the page loaded, the server returns the Ukrainian error:

`Ця техніка більше не доступна для перегляду.`

## Phone Normalization

Phone input is normalized with the shared helper from `lib/phone/normalize.ts`.

The normalized value is stored in:

- `phone`;
- `normalizedPhone`.

This keeps duplicate detection and later CRM matching consistent.

## Created Record

The form creates `UsedEquipmentInquiry` with:

- `status = NEW`;
- `equipmentTitle` snapshot from the current DB equipment title;
- `source = CATALOG_CARD` or `DETAIL_PAGE`;
- `assignedManagerId = null`;
- `internalComment = null`;
- `processedAt = null`.

The client cannot submit `equipmentTitle` in the payload.

## Duplicate Guard

If the same normalized phone submits an inquiry for the same equipment within 10 minutes, a new record is not created. The user receives a neutral success message:

`Ваш запит уже отримано. Менеджер зв’яжеться з вами.`

## Honeypot

If the hidden `website` field is filled, no inquiry is created and the user receives a neutral success message. Business logic, schema, and CRM workflows are not changed.

## UX and Accessibility

- Success and validation messages are shown inside the modal.
- The modal supports Escape close, backdrop close, focus return, and a simple focus trap.
- On mobile the dialog uses a constrained viewport height and internal scrolling.
- Required field errors are shown in Ukrainian.

## What Was Not Changed

This stage does not add:

- CRM inquiry list or detail page;
- CRM badge or filters;
- manager assignment;
- notifications;
- CAPTCHA;
- Prisma schema changes;
- migrations.

## Checks

Implementation checks:

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

## Blocker for Stage 10

No code blocker is expected for Stage 10. Stage 10 should implement CRM visibility and processing for `UsedEquipmentInquiry` records.
