# Stage Used Equipment 4 — CRM create and edit form

## Summary

Stage Used Equipment 4 adds the CRM foundation for creating and editing records in the "Майданчик БВ техніки" module.

Implemented routes:

- `/admin/used-equipment/items/new`
- `/admin/used-equipment/items/[id]/edit`

The work does not add public catalog pages, image upload, inquiries, Cloudinary integration, or new Prisma schema fields.

## Create Flow

CRM users with `MANAGER` or `ADMIN` role can create a used-equipment record from `/admin/used-equipment/items/new`.

The create form includes:

- title;
- equipment type;
- manufacturer;
- year;
- description;
- internal comment.

New records are always created with:

- `status = DRAFT`;
- `createdById = current CRM user`;
- `updatedById = current CRM user`.

Publishing is intentionally blocked until image support is implemented.

## Edit Flow

CRM users with `MANAGER` or `ADMIN` role can edit a record from `/admin/used-equipment/items/[id]/edit`.

Editable fields:

- title;
- equipment type;
- manufacturer;
- year;
- description;
- internal comment;
- status.

The list page now includes an edit action for each item.

## Equipment Type And Manufacturer

The form reuses the existing local equipment type list from `EQUIPMENT_TYPE_OPTIONS`.

Manufacturer selection uses the existing searchable combobox component and filters manufacturers by the selected equipment type using the existing manufacturer helper.

The server action validates `manufacturerId` against the database and stores:

- `manufacturerId`;
- `manufacturerName` from the database record.

The client does not submit or control `manufacturerName`.

## Slug Logic

Slug generation is used only during create.

The slug is based on the title and supports Ukrainian transliteration. If a slug already exists, the action appends a numeric suffix.

Editing a record does not change the slug.

## Status Rules

Until image upload exists, records without images can only use:

- `DRAFT`;
- `ARCHIVED`.

The edit form disables public statuses for records without images, and the server action enforces the same rule.

For records with images, all existing statuses are available:

- `DRAFT`;
- `PUBLISHED`;
- `RESERVED`;
- `SOLD`;
- `ARCHIVED`.

Status timestamps are updated by status:

- `publishedAt` for `PUBLISHED`;
- `reservedAt` for `RESERVED`;
- `soldAt` for `SOLD`;
- `archivedAt` for `ARCHIVED`.

## What Was Not Changed

This stage did not change:

- Prisma schema;
- migrations;
- public used-equipment pages;
- public detail pages;
- inquiries;
- image upload;
- Cloudinary integration;
- rich text editor;
- request, invoice, Telegram, or auth business logic.

## Verification

Required checks for this stage:

- `npx.cmd prisma validate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`;
- `git diff --check`.

## Next Blockers

The next functional blocker for publishing used equipment is image upload and storage integration. Until that exists, CRM can prepare draft records but cannot safely publish them.
