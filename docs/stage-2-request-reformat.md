# Kairos Parts — Stage 2 Request Reformat

## Scope

Stage 2 changes only the request creation model and related display surfaces. It does not implement invoices, PDF generation, used-equipment marketplace logic, commercial offers, ChangeRequest, AuditLog, Company changes, Telegram flow changes, or unrelated CRM modules.

## Current Flow Analysis

- Public request UI lived in `app/(public)/request/request-form.tsx` and used two modes: `quick` and `detailed`.
- Public request page lived in `app/(public)/request/page.tsx` and accepted `category`, `mode`, `source`, `vehicleId`, and `repeatRequestId` query params.
- Category pages linked to `/request?category=...`, which preselected a category in the old form.
- Request validation lived in `lib/requests/validation.ts` and validated optional category slug when present.
- Request creation lived in `app/api/requests/route.ts` and saved `categoryId`, optional `manufacturerId`, vehicle data, files, and contact data.
- CRM request detail in `app/admin/requests/[id]/page.tsx` displayed category, subcategory, manufacturer, equipment type, model, VIN/serial, files, documents, items, offers, OCR, comments, and status history.
- Client request detail in `app/client/requests/[id]/page.tsx` displayed category, manufacturer, model, VIN/serial, visible items, visible documents, offers, and attached request files.
- Public status page in `app/(public)/request/status/[token]/page.tsx` displayed source, equipment type, company, description, and status timeline.

## Implemented Changes

- Removed quick/detailed UI switching from the public request form.
- The form now uses one detailed flow titled `Заявка на підбір запчастин`.
- `mode=file` remains safe and shows a file-upload hint, but it does not change the form model.
- Removed category select/input from request creation UI.
- New requests no longer save `categoryId` or `subcategoryId`; old requests can still display category data in CRM/client views.
- Manufacturer is now treated as `Виробник / марка` and uses a free input with datalist suggestions from all catalog manufacturers, independent from category.
- Added shared equipment type list in `lib/vehicles/equipment-types.ts`.
- Added `Рік випуску` field to request creation, prefill, CRM detail, client detail, and public status.
- Server validation now returns readable Ukrainian messages and no longer validates category.
- Request API now returns Ukrainian validation/server error messages.
- Category page CTA links now go to `/request` or `/request?mode=file` without category preselection.

## Prisma

Added optional field:

```prisma
vehicleYear Int?
```

Migration prepared:

```text
prisma/migrations/20260713120000_add_request_vehicle_year/migration.sql
```

The migration was prepared only. It was not applied to any database in this task.

## Compatibility Notes

- Existing requests with category/subcategory remain readable because the fields and relations remain in Prisma.
- New public/client requests do not require category.
- Manufacturer lookup is no longer category-scoped.
- Contact fields and client profile auto-prefill remain unchanged.
- Repeat request and vehicle prefill now carry `vehicleYear` where available.

## Verification

Run after implementation:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Next Step

Before testing this against Neon/Vercel, apply the prepared migration to the intended database with `npx.cmd prisma migrate deploy` after confirming the environment points to the correct DB.
