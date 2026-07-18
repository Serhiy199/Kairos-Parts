# Stage Used Equipment 7 — Public catalog with pagination

## Scope

Stage 7 adds the public used-equipment catalog page:

```text
/used-equipment
```

The page is read-only and shows published marketplace items without adding detail pages, inquiry forms, gallery pages, CRM inquiry flows, filters, sorting, notifications, invoice changes, or new Prisma models.

## Public Statuses

The catalog includes only equipment with public statuses:

```text
PUBLISHED
RESERVED
SOLD
```

Excluded statuses:

```text
DRAFT
ARCHIVED
```

Public labels are intentionally different from CRM labels:

```text
PUBLISHED → Доступно
RESERVED → Зарезервовано
SOLD → Продано
```

## Query And Data Fields

Public data fetching lives in:

```text
lib/used-equipment/queries.ts
```

The public query selects only fields needed for the catalog:

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
images: url, alt, width, height
```

It does not load CRM-only fields such as `internalComment`, creator/updater relations, Cloudinary public IDs, inquiries, manager data, or author data.

Items are ordered by:

```text
publishedAt desc
createdAt desc
id desc
```

## Images

Each card loads one image:

1. primary image (`isPrimary = true`);
2. fallback to the first image by `sortOrder`;
3. neutral placeholder if a public item has no image.

The placeholder is defensive only. Stage 5 expects public items to have photos, but the public catalog should not crash if older or inconsistent data exists.

Image alt text uses `image.alt`; fallback:

```text
{title} — БВ техніка
```

## Cards

The public card component lives in:

```text
components/used-equipment/public-used-equipment-card.tsx
```

Each card shows:

- image or placeholder;
- public status badge;
- equipment type;
- title;
- manufacturer;
- year;
- safe plain-text description excerpt.

Cards do not link to a detail page because `/used-equipment/[slug]` is intentionally deferred.

## Description Excerpt

Rich-text descriptions are converted to safe plain text via:

```text
getUsedEquipmentDescriptionExcerpt()
```

The catalog does not render HTML and does not use `dangerouslySetInnerHTML`.

## Equipment Type Labels

The catalog uses the shared equipment type source from:

```text
lib/vehicles/equipment-types.ts
```

Unknown values fall back to the stored value instead of breaking the UI.

## Pagination

Page size:

```text
12
```

Pagination uses:

```text
/used-equipment?page=1
```

Invalid values such as `0`, negative values, or non-numeric values normalize to page 1.

If a requested page is greater than the available page count, the page redirects to the last valid page without creating a redirect loop.

The pagination UI shows:

```text
Назад
Сторінка X із Y
Далі
```

It is hidden when there is only one page.

## Empty And Error States

Empty catalog:

```text
Доступної БВ техніки поки немає
```

Missing database configuration shows a Ukrainian error state instead of rendering a broken page.

## Navigation

The public header, mobile menu, and footer use the shared `navItems` array in:

```text
components/layout/public-layout.tsx
```

The new public navigation label is:

```text
БВ техніка
```

The active state already works for `/used-equipment` and future nested routes through namespace path matching.

## Metadata, Canonical, Sitemap

The `/used-equipment` page has route metadata:

```text
title: БВ техніка — Kairos Parts
description: Публічний каталог перевіреної вживаної аграрної, вантажної та спеціальної техніки Kairos Parts.
```

No sitemap file exists in the current app, so sitemap updates were not added in this stage.

Canonical metadata was not added because the project does not currently define `metadataBase` or a shared canonical pattern.

## Responsive And Accessibility Notes

The catalog uses the existing `kp-container` system and responsive grid:

```text
mobile: 1 column
tablet: 2 columns
desktop: 3 columns
```

Cards use stable aspect-ratio image areas to avoid layout shift. Pagination links have focus-visible styles and avoid horizontal overflow on mobile.

Recommended browser QA breakpoints:

```text
1440
1280
1024
768
430
390
375
```

## Prisma And Migration

No Prisma schema changes were made.

No migration is required.

## Deferred

Deferred to future stages:

- `/used-equipment/[slug]` detail page;
- gallery;
- inquiry form;
- CRM inquiry processing;
- search/filter/sort;
- public SEO sitemap expansion;
- notifications.

## Checks

Passed during implementation:

```text
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

`git diff --check` reported only expected CRLF conversion warnings for touched files.

## Blockers

No code blocker is known for Stage 8/9. Visual QA should still be done against real published/reserved/sold sample records in the target environment.
