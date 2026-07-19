# Stage Assisted Fleet 6 - Vehicle photos

## 1. Scope

Implemented photo management for client fleet Vehicles. ADMIN and MANAGER can upload and manage photos in CRM, while CLIENT users receive read-only thumbnails and galleries through the existing personal/company access scope. Documents, client-side upload, and Stage 7 functionality were not added.

## 2. Reused architecture

The implementation reuses the existing server-only Cloudinary configuration and delivery model from the used-equipment module. Shared upload plumbing was extracted without changing the existing used-equipment upload behavior. Vehicle-specific validation and actions remain under the Vehicle module.

## 3. Prisma model

Added `VehicleImage` with:

- relation to `Vehicle` with cascade delete;
- Cloudinary `publicId` and `secureUrl`;
- optional width, height, bytes, and format metadata;
- `sortOrder` and `isPrimary`;
- created/updated timestamps;
- indexes for vehicle lookup, ordering, and primary-image lookup.

`Vehicle.images` exposes the relation. No ownership fields were duplicated on the image because access is derived through the parent Vehicle.

## 4. Migration

Migration `20260719120000_add_vehicle_images` creates only the `VehicleImage` table, indexes, and foreign key. It was applied to the Neon database referenced by the current local environment. A post-deploy `prisma migrate status` reported that the database schema is up to date.

## 5. Upload rules

- accepted formats: JPEG, PNG, WebP;
- maximum file size: 8 MB per image;
- maximum gallery size: 10 images per Vehicle;
- multiple upload is supported;
- files are stored under `kairos-parts/vehicles/{vehicleId}`;
- Cloudinary applies orientation normalization and a 2400 x 2400 limit;
- the first image becomes primary automatically when the gallery was empty.

The action validates the full batch before upload. Uploads are sequential and uploaded Cloudinary assets are removed if a later upload or database write fails.

## 6. CRM management

The Vehicle edit page now contains a dedicated photo manager with:

- multiple-file selection;
- upload progress/pending state;
- primary-photo badge and action;
- left/right ordering controls;
- explicit delete confirmation;
- Ukrainian success and safe error messages.

Every action rechecks the authenticated ADMIN/MANAGER role, reloads the parent Vehicle, and never trusts owner IDs from the browser.

## 7. Primary image and ordering

Setting a primary image runs in a short transaction and clears the previous primary flag. Reordering validates that the submitted IDs exactly match the current Vehicle gallery before updating `sortOrder`. Foreign, missing, or duplicated IDs are rejected.

Deleting an image removes the Cloudinary asset first, then deletes the database row, normalizes ordering, and promotes the first remaining image if the deleted image was primary. A retry can reconcile an interrupted database step after Cloudinary deletion.

## 8. CRM fleet presentation

CRM owner fleet queries select only one image per Vehicle, ordered by primary flag, sort order, and creation time. Fleet rows show that thumbnail through `next/image` or a neutral placeholder. The query does not load full galleries and does not introduce N+1 requests.

## 9. Client presentation

`/client/vehicles` shows the primary/fallback thumbnail for each accessible Vehicle. `/client/vehicles/[id]` shows a read-only gallery with a stable main preview and thumbnail controls. An empty gallery has a clear placeholder state.

The existing personal/company Vehicle access helper remains the source of authorization. Images are queried only after the scoped Vehicle lookup succeeds. Clients cannot upload, reorder, mark primary, or delete images.

## 10. Delivery and privacy

Cloudinary image URLs use public delivery, matching the existing image architecture. The application prevents discovery through scoped Vehicle queries, but these URLs must not be used for confidential documents. No Cloudinary public ID is rendered in client UI.

## 11. Cleanup behavior

The database relation cascades when a Vehicle is deleted. The current codebase has no production Vehicle delete action, so there is no existing deletion flow in which to add Cloudinary cleanup. A future Vehicle delete implementation must destroy all related Cloudinary assets before deleting the Vehicle row.

## 12. Validation checks

Targeted checks covered:

- empty upload rejection;
- valid JPEG acceptance;
- SVG rejection;
- file larger than 8 MB rejection;
- gallery count above 10 rejection;
- valid reorder acceptance;
- duplicate reorder IDs rejection;
- foreign reorder ID rejection.

All eight checks passed. The repository does not define a general `npm test` script, so no new test framework was introduced.

## 13. Environment and smoke status

Cloudinary cloud name, API key, and API secret are present in the current environment; their values were not printed or recorded. No real production-like image was uploaded during automated verification to avoid leaving test assets.

The unauthenticated local login page loaded, but authenticated browser verification was blocked by a local Windows Prisma TLS credential error during login (server digest `3884600352`). Prisma migration-engine access to Neon worked and the migration was deployed successfully. Therefore CRM/client visual interaction should be smoke-tested after redeploy in the Vercel environment.

## 14. Technical checks

- `npx.cmd prisma migrate deploy` - passed;
- `npx.cmd prisma migrate status` - database schema up to date;
- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- `git diff --check` - passed.

## 15. Intentionally deferred

- client photo upload;
- vehicle documents;
- captions and annotations;
- drag-and-drop sorting;
- private signed image delivery;
- automatic Cloudinary cleanup for a future Vehicle delete action;
- Stage 7 functionality.

## 16. Next-stage readiness

There is no code or migration blocker for Stage 7. Before production sign-off, run an authenticated Vercel smoke test covering upload, primary selection, reorder, delete, CRM thumbnail, personal client gallery, company client gallery, foreign-client denial, file type/size limits, and the 10-image limit.
