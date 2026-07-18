# Fix Used Equipment: card and inquiry dialog

## Scope

This fix simplifies public used-equipment cards and removes the duplicated/embedded appearance of the inquiry form without changing inquiry business logic, Prisma models, Cloudinary integration, or CRM behavior.

## Root cause

The inquiry dialog was rendered inline inside the equipment card. The card uses `overflow-hidden` and a hover transform, so the fixed-position dialog inherited a transformed containing/stacking context and could be clipped or visually anchored to the card. There was one inquiry form in React, but its placement made it appear as an additional form inside the card.

The dialog is now rendered into `document.body` with `createPortal`. Existing focus trapping, Escape handling, backdrop closing, body scroll locking, and trigger focus restoration remain in place.

## Public card changes

- Removed the description excerpt.
- Removed the public status badge.
- Removed the equipment-type badge.
- Removed the `Детальніше` link.
- Added compact metadata rows for manufacturer and equipment type.
- The year row is rendered only when a year exists.
- The image, title, and metadata share one semantic detail-page link.
- The inquiry button is a separate full-width action, avoiding nested interactive elements.

## Browser QA

Verified the catalog and detail page against the local Next.js server.

- Desktop catalog at 1440 px: compact card layout, aligned metadata, separate full-width CTA.
- Mobile catalog at 390 px: no global horizontal overflow; card and CTA remain usable.
- Exactly one main card link; image, title, and metadata are included in it.
- No nested interactive elements inside the card link.
- Clicking the card opens the correct equipment detail route.
- Clicking the inquiry CTA does not navigate away from the catalog.
- Exactly one dialog and one inquiry form are rendered when opened.
- The dialog portal root is `document.body`; no form remains inside the card article.
- Escape closes the dialog, unlocks body scrolling, and returns focus to the trigger.
- The shared dialog was also verified on the public equipment detail page.

A pre-existing `next/image` warning for the shared header logo remains outside this fix. No new React, hydration, or dialog errors were observed.

## React review

The edited components retain semantic links and buttons, stable component-local state, typed props, `next/image`, keyboard support, accessible dialog labelling, focus management, and effect cleanup. No additional abstraction or client-side data-fetching layer was introduced.

## Data and migration

Prisma schema was not changed. No migration is required.
