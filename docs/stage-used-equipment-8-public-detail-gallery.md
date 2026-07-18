# Stage Used Equipment 8 - Public equipment detail page and gallery

## Scope

Stage 8 adds a public detail page and gallery for used-equipment records.

Implemented:

- public route `/used-equipment/[slug]`;
- clickable public catalog cards;
- detail gallery with active image and thumbnails;
- public status guard;
- full rich-text description rendering through `SafeRichText`;
- route metadata with Open Graph image and canonical URL;
- report and technical checks.

Not implemented:

- inquiry form;
- `UsedEquipmentInquiry` creation;
- CRM inquiry flow;
- Telegram/email notifications;
- search, filters, sorting, comparison, cart, booking, or ecommerce logic.

## Detail Route

Route:

```text
app/(public)/used-equipment/[slug]/page.tsx
```

The page uses the existing public layout with header and footer.

## Public Status Guard

Only these statuses are visible:

```text
PUBLISHED
RESERVED
SOLD
```

These statuses return `notFound()`:

```text
DRAFT
ARCHIVED
```

Missing, empty, or unknown slugs also return `notFound()`.

## Prisma Query

The public slug query lives in:

```text
lib/used-equipment/queries.ts
```

Function:

```text
getPublicUsedEquipmentBySlug(slug)
```

It loads only public fields:

```text
id
slug
title
equipmentType
manufacturerName
year
description
status
publishedAt
soldAt
createdAt
images: id, url, alt, width, height, isPrimary, sortOrder
```

It does not load:

- internal comments;
- createdBy/updatedBy;
- Cloudinary public IDs;
- inquiries;
- manager data;
- CRM metadata.

## Gallery Architecture

Gallery component:

```text
components/used-equipment/public-used-equipment-gallery.tsx
```

It is a client component because image switching requires local state.

The page passes a narrow public image shape instead of a full Prisma model.

## Primary And Fallback Image

Images are loaded in `sortOrder asc`.

The active image defaults to:

1. `isPrimary = true`;
2. otherwise the first image by `sortOrder`;
3. otherwise a neutral placeholder.

The main image uses `next/image`, stable `4 / 3` aspect ratio, `object-contain`, rounded corners, and `priority`.

## Thumbnail Behavior

Thumbnails are buttons, not clickable divs.

They support:

- click switching;
- keyboard focus;
- `aria-pressed`;
- active visual highlight;
- local horizontal scroll when many thumbnails exist.

No lightbox or heavy gallery dependency was added.

## Card Link Changes

Catalog card file:

```text
components/used-equipment/public-used-equipment-card.tsx
```

The image, title, and `Детальніше` CTA now link to:

```text
/used-equipment/{slug}
```

No nested links or placeholder `href="#"` are used.

## Equipment Type Label

Equipment type uses the shared helper:

```text
getEquipmentTypeLabel()
```

Unknown legacy values fall back to the stored value and do not break rendering.

## Rich-Text Rendering

The detail page renders the full description via:

```text
SafeRichText
```

The page does not call `dangerouslySetInnerHTML` directly.

The catalog still uses a safe plain-text excerpt only.

## Breadcrumbs

Breadcrumbs:

```text
Головна -> БВ техніка -> {Назва техніки}
```

The last item is not a link.

## Metadata

`generateMetadata()` returns:

```text
{Назва} | БВ техніка | Kairos Parts
```

Description is a plain-text excerpt from the rich-text description.

## Open Graph

Open Graph includes:

- title;
- description;
- URL;
- type `article`;
- primary image or first image.

If no image exists, no broken OG image is emitted.

## Canonical

Canonical:

```text
/used-equipment/{slug}
```

The absolute URL uses the shared helper:

```text
APP_BASE_URL -> NEXTAUTH_URL -> https://kairos-parts.vercel.app
```

## Sitemap Changes

No sitemap file exists in the current app, so sitemap detail URLs were not added in this stage.

This can be added later as a dedicated SEO step if the project introduces `app/sitemap.ts`.

## Responsive Behavior

Desktop:

- gallery and info render as two columns;
- title and metadata wrap safely;
- rich text sits below as a full-width readable section.

Tablet/mobile:

- one-column layout;
- main image stays inside viewport;
- thumbnails use local horizontal scroll;
- rich text uses word breaking for long links.

Recommended visual QA widths:

```text
1440
1280
1024
768
430
390
375
```

## Accessibility

Implemented:

- one `h1`;
- `h2` for description;
- `nav aria-label` breadcrumbs;
- thumbnail buttons;
- `aria-pressed` for active thumbnail;
- alt text fallback;
- status text visible, not color-only;
- focus-visible states.

## notFound Behavior

`notFound()` is used for:

- missing slug;
- empty slug;
- non-existing record;
- non-public record;
- `DRAFT`;
- `ARCHIVED`.

No redirect to catalog is used for hidden content.

## Manual QA

Recommended scenarios:

- `PUBLISHED`: detail opens, gallery works, rich text renders.
- `RESERVED`: detail opens and badge says `Зарезервовано`.
- `SOLD`: detail opens and badge says `Продано`.
- `DRAFT`/`ARCHIVED`: direct URL returns 404.
- Gallery: one image, multiple images, primary image not first by sort order, no images.
- Rich text: headings, lists, links, blockquote, long URLs.

## Technical Checks

Passed during implementation:

```text
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

## Prisma And Migration

Prisma schema was not changed.

No migration is required.

## Deferred To Stage 9

- inquiry form;
- `Запит на перегляд техніки`;
- `UsedEquipmentInquiry` creation;
- CRM inbox for inquiries;
- notifications.

## Blocker For Stage 9

No known code blocker. Stage 9 should build on this detail page by adding a real inquiry CTA/form instead of a disabled button.
