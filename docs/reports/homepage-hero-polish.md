# Homepage Hero Polish Report

## Scope

Updated the Kairos Parts homepage hero section to feel more premium industrial while preserving the clean B2B SaaS direction. This was a visual and UX refinement only.

## Files changed

- `app/(public)/page.tsx`

## Problems addressed

- Reduced competing CTAs from four equal buttons to one primary action, one secondary action, and one tertiary Telegram link.
- Improved the hero background overlay with a stronger left-side readability gradient, lighter right-side image visibility, subtle gold glow, and bottom fade into the light page background.
- Reworked the stats area from basic white cards into dark glass-style premium stat cards with gold numeric accents.
- Added a compact process signal: `Заявка → Підбір → Узгодження → Доставка`.
- Improved headline copy and hierarchy to explain the request-based B2B service faster.
- Kept the primary action focused on creating a request.

## What was not changed

- Routes and request form logic.
- Auth, middleware, role permissions, Prisma schema, seed, API endpoints, Telegram bot logic, OCR, and CRM business logic.
- Existing destination for the primary CTA: `/request`.
- Existing Telegram anchor: `#telegram`.

## CTA behavior

- `Створити заявку` points to `/request`.
- `Надіслати список або фото` points to `/request?mode=file`.
- `Створити заявку через Telegram` points to `#telegram`.

## Responsive notes

- Desktop keeps content left-aligned with more visual room for the background image on the right.
- CTA buttons wrap/stack cleanly on smaller widths.
- Stats use a 3-column grid on larger screens and stack naturally on mobile.
- The background overlay remains stronger on the text side for readability.

## Validation

Run after implementation:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Day 10 readiness

No blocker for moving to Day 10 Telegram bot work. This change is limited to homepage presentation and does not affect Telegram integration logic.
