# Fix Used Equipment - Public Visual Style

## Scope

The public used-equipment catalog and detail page were aligned with the existing Kairos Parts premium industrial design system. The change is presentation-only and covers `/used-equipment` and `/used-equipment/[slug]`.

## Catalog header

The service badge with the item count and page size was removed. The catalog introduction is now left-aligned without an empty reserved right column. Server-side pagination remains unchanged and is rendered only when more than one page exists.

## Catalog cards

- White card surfaces were replaced with the existing dark public surfaces.
- Borders, hover states, focus rings and primary actions use the existing gold accent tokens.
- Status and equipment type badges use dark, high-contrast treatments.
- Image containers use a stable aspect ratio, a dark fallback surface and a subtle transition into the card content.
- The detail action is a gold outline action; the inquiry action remains the solid gold primary action.
- A single card keeps the planned grid width instead of stretching across the catalog.

## Detail gallery and information panel

The gallery, thumbnails, information panel and metadata tiles now use dark public surfaces with restrained gold borders and shadows. Image selection, order, Cloudinary URLs and gallery state were not changed.

## CTA copy

The technical "next action" callout was replaced with public-facing copy:

- `Зацікавила ця техніка?`
- `Залиште ім'я та номер телефону - менеджер Kairos Parts зв'яжеться з вами, щоб уточнити деталі перегляду.`

The inquiry dialog and its validation/action flow remain unchanged.

## Description

The description block now uses a dark surface. Rich-text headings, links, list markers and blockquotes receive local high-contrast styles. Sanitization and HTML normalization were not changed.

## Responsive and accessibility behavior

- The existing three/two/one-column catalog grid remains in place.
- Card actions stay stacked on narrow cards and retain full-width touch targets.
- The detail page remains two columns on desktop and one column on mobile.
- Gallery thumbnails preserve horizontal local scrolling without creating global overflow.
- Text contrast, semantic headings, button labels and gold focus-visible outlines are preserved.

## Not changed

No Prisma schema, migration, public query, page size, pagination logic, Cloudinary logic, inquiry creation, duplicate guard, honeypot, CRM badge, CRM workflow or admin page was changed.

## Verification

Technical checks passed:

- `npx.cmd prisma validate`
- `npx.cmd prisma generate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

Local browser QA used the actual published staging record and covered:

- `/used-equipment` at 1440 px and 390 px;
- `/used-equipment/testova-nakhva` at 1440 px and 390 px;
- removal of the count/page-size service badge;
- dark catalog card, gallery, information panel and description surfaces;
- visible, non-overlapping actions and readable text;
- one-record catalog behavior without stretching the card;
- mobile document and body widths (`scrollWidth = innerWidth = 390`), confirming no global horizontal overflow.

No additional staging records were created solely to simulate three-card, missing-year or unusually long-content fixtures. Those states remain covered by the existing responsive grid, line clamping and conditional/fallback rendering in code.
