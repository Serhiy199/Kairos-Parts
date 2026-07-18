# Stage Used Equipment 8.1 - Simplify equipment statuses

## Scope

Stage 8.1 simplifies the used-equipment lifecycle.

Kept statuses:

```text
DRAFT
PUBLISHED
ARCHIVED
```

Removed statuses:

```text
RESERVED
SOLD
```

The removed states are no longer present in the Prisma enum, CRM status select, public catalog labels, detail page badges, or public visibility logic.

## Prisma Changes

Updated:

```text
prisma/schema.prisma
```

Changes:

- `UsedEquipmentStatus` now contains only `DRAFT`, `PUBLISHED`, and `ARCHIVED`.
- `UsedEquipment.reservedAt` was removed because the reserved lifecycle no longer exists.
- `UsedEquipment.soldAt` was removed because the sold lifecycle no longer exists.
- `publishedAt` and `archivedAt` remain.

## Migration

Added migration:

```text
prisma/migrations/20260718160000_simplify_used_equipment_statuses/migration.sql
```

Migration behavior:

1. Drops the old default from `UsedEquipment.status`.
2. Remaps existing `RESERVED` and `SOLD` rows to `ARCHIVED`.
3. Sets `archivedAt = NOW()` for remapped rows when `archivedAt` was empty.
4. Replaces the PostgreSQL enum with `DRAFT`, `PUBLISHED`, `ARCHIVED`.
5. Restores default status `DRAFT`.
6. Drops `reservedAt` and `soldAt`.

No table drop or destructive reset is used.

## Existing Data Remap

Expected mapping:

```text
RESERVED -> ARCHIVED
SOLD -> ARCHIVED
```

Pre-migration counts for `RESERVED` and `SOLD` could not be read through the local Prisma Client in this environment because direct SQL checks hit a local TLS error before migration. The migration itself still remaps all matching rows safely in SQL before the enum is replaced.

## Public Catalog Behavior

Public list route:

```text
/used-equipment
```

Public detail route:

```text
/used-equipment/[slug]
```

Both now load only records with:

```text
status = PUBLISHED
```

`DRAFT` and `ARCHIVED` records are hidden from public pages. Direct detail URLs for hidden records return `notFound()`.

## CRM Behavior

The CRM used-equipment status select now exposes only:

- Чернетка;
- Опубліковано;
- Архівовано.

The old reserved/sold badges and tone mappings were removed from current UI code.

Publishing still requires at least one image. Without images, only `DRAFT` and `ARCHIVED` are allowed.

## Updated Files

Current code files changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260718160000_simplify_used_equipment_statuses/migration.sql`
- `lib/used-equipment/status.ts`
- `lib/used-equipment/validation.ts`
- `lib/used-equipment/status-dates.ts`
- `lib/used-equipment/queries.ts`
- `components/used-equipment/used-equipment-form.tsx`
- `components/used-equipment/public-used-equipment-card.tsx`
- `app/admin/used-equipment/items/actions.ts`
- `app/admin/used-equipment/items/page.tsx`
- `app/(public)/used-equipment/page.tsx`
- `app/(public)/used-equipment/[slug]/page.tsx`
- `docs/stage-used-equipment-8-public-detail-gallery.md`
- `docs/stage-used-equipment-8-1-simplify-statuses.md`

## Not Changed

Not implemented in this stage:

- inquiry form;
- visible/invisible toggle;
- hard delete;
- sitemap changes;
- new public filters;
- marketplace moderation flow;
- new Prisma models.

## Checks

Passed after implementation:

```text
npx.cmd prisma format
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate status
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

No test script exists in `package.json`, so there is no automated test command to run for this stage.

## Deployment Notes

Migration deploy was executed successfully against the configured Neon PostgreSQL database:

```text
npx.cmd prisma migrate deploy
```

Post-deploy migration status:

```text
Database schema is up to date!
```

Vercel needs a redeploy so production runtime uses the updated Prisma Client and current code.

## Blockers

No known code blocker for continuing to Stage 9 after the migration is applied and checks pass.
