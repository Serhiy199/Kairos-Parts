# Stage Used Equipment 5 — Cloudinary image management

## Scope

Stage 5 adds image upload and image management for the CRM used-equipment module.

Implemented:

- Cloudinary server-side upload for used equipment photos.
- Multiple image upload during create and edit.
- Metadata persistence in `UsedEquipmentImage`.
- Existing image preview in edit form.
- New image local preview before submit.
- Primary image selection.
- Image order management.
- Individual image deletion.
- Best-effort Cloudinary cleanup for deleted or failed uploads.
- Status guard: `PUBLISHED`, `RESERVED`, and `SOLD` require at least one photo.

Not implemented in this stage:

- Public used-equipment detail/gallery.
- Gallery lightbox.
- Used-equipment inquiries.
- Rich text editor.
- Notifications.
- Stage 6 public catalog work.

## Architecture

Cloudinary access is isolated in:

```text
lib/cloudinary/server.ts
```

The helper is server-only and reads:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

The API secret is never exposed to the client. Uploads are handled server-side from admin Server Actions.

Images are uploaded to:

```text
kairos-parts/used-equipment/{usedEquipmentId}
```

`next.config.ts` allows optimized images from:

```text
https://res.cloudinary.com
```

## Limits And Formats

Allowed formats:

- JPG
- PNG
- WEBP

Rejected formats:

- GIF
- SVG
- PDF
- HEIC
- AVIF
- videos
- documents

Limits:

- maximum 15 photos per used-equipment item;
- maximum 10 MB per file.

The Server Action body limit was raised to `160mb` to support the worst allowed upload batch.

## Create Flow

Create form now requires at least one valid photo.

Flow:

1. Validate used-equipment fields.
2. Validate image count, type, and size.
3. Create the `UsedEquipment` record as `DRAFT`.
4. Upload images to Cloudinary.
5. Save `UsedEquipmentImage` records with URL, public id, width, height, format, bytes, `sortOrder`, and `isPrimary`.
6. If upload or DB image persistence fails, cleanup uploaded Cloudinary assets and remove the newly created draft record best-effort.

## Edit Flow

Edit form supports:

- adding new photos;
- deleting existing photos;
- changing primary image;
- changing image order.

Existing images are preserved unless explicitly marked for deletion. New images are uploaded before the short DB transaction. If the DB update fails after new uploads, those new Cloudinary assets are cleaned up best-effort.

After a successful DB update, removed images are deleted from Cloudinary best-effort.

## Primary And Ordering

The image manager submits hidden values:

- `imageOrder`;
- `primaryImageKey`;
- `deletedImageIds`;
- `primarySelectedIndex`.

The server validates that submitted image keys belong to the current equipment record or to uploaded files. Invalid keys are ignored. If no primary image is valid, the first final image becomes primary.

## Status Guards

Statuses that can be used without photos:

- `DRAFT`;
- `ARCHIVED`.

Statuses that require at least one photo:

- `PUBLISHED`;
- `RESERVED`;
- `SOLD`.

This allows legacy drafts/archived records without images, but prevents publishing, reserving, or selling equipment without a photo.

## Security

Image management is only reachable through CRM create/edit pages and actions protected by `requireCrmSession`.

Guests and clients cannot use these actions through the UI. Cloudinary API secret remains server-only.

## Migration Status

No Prisma migration was needed.

The existing schema already had the required `UsedEquipmentImage` fields:

- `url`;
- `cloudinaryPublicId`;
- `sortOrder`;
- `isPrimary`;
- `alt`;
- `width`;
- `height`;
- `format`;
- `bytes`.

## Checks

Passed:

```text
npx.cmd prisma validate
npx.cmd prisma generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

`git diff --check` should be run before commit.

## Manual QA

Recommended smoke test after deploy/env setup:

1. Open `/admin/used-equipment/items/new`.
2. Try to create equipment without a photo and confirm the Ukrainian validation error.
3. Add several JPG/PNG/WEBP photos.
4. Set one photo as primary.
5. Create the record and confirm it is saved as `DRAFT`.
6. Open edit page.
7. Confirm existing Cloudinary images render.
8. Add a new photo.
9. Change primary image.
10. Reorder photos.
11. Delete a photo.
12. Save and confirm metadata persists.
13. Try to set `PUBLISHED` without photos and confirm it is blocked.
14. Confirm Cloudinary folder contains the expected assets.

## Stage 6 Readiness

No code blocker for Stage 6 public used-equipment catalog/detail work was found.

Before Stage 6 production testing, ensure Vercel has:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```
