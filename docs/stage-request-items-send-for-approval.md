# RequestItem CRM cleanup + send for approval

## Summary

This stage cleans up the CRM workflow for picked request positions and separates internal drafting from client approval.

Managers now add and edit RequestItem records as internal draft positions first. A separate CRM action sends newly added hidden positions to the client for approval.

## CRM RequestItem changes

- `Бренд` was renamed to `Виробник` in RequestItem-facing UI.
- Manufacturer input now supports searchable browser suggestions through a shared `PART_MANUFACTURERS` list.
- `Ціна закупівлі` was removed from the main RequestItem form.
- `Постачальник` was removed from the main RequestItem form.
- `Ціна продажу` was renamed to `Ціна`.
- `Термін постачання` was renamed to `Орієнтовний термін`.
- The `Видимо клієнту` checkbox was removed from the RequestItem add/edit form.
- New RequestItem records default to `visibleToClient = false`.
- Updating a RequestItem from the main CRM form no longer changes `visibleToClient`, `purchasePrice`, or `supplierName`.

## Send for approval

CRM request detail now has an explicit action:

`Відправити на погодження`

This action updates only hidden items for the current request:

- `visibleToClient = false` -> `visibleToClient = true`
- `approvedByClient` is not changed.
- `includeInInvoice` is not changed.
- `approvedAt` is not changed.

If there are no hidden positions, CRM shows:

`Немає нових позицій для відправлення на погодження.`

On success, CRM shows:

`Позиції відправлено клієнту на погодження.`

## Client behavior

The client cabinet still shows only RequestItem records with:

`visibleToClient = true`

The existing client approval and invoice-selection flow is unchanged:

- client can select positions for invoice;
- client can approve selected positions;
- hidden CRM draft positions are not visible to the client.

## API behavior

- Admin RequestItem create API also defaults new items to `visibleToClient = false`.
- Admin RequestItem update API does not allow the main edit payload to change `visibleToClient`.
- The public/client access rules were not changed.

## Prisma

No Prisma schema changes were required.

No migration was created.

## Not included

This stage does not implement:

- invoice generation changes;
- PDF generation;
- supplier accounting UI;
- purchase price management UI;
- automatic notifications;
- new roles or permissions.

## Verification

Expected verification commands:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Next step

After deployment, smoke test the CRM flow:

1. Add a picked position in CRM.
2. Confirm the client does not see it before sending.
3. Click `Відправити на погодження`.
4. Confirm the client sees the position.
5. Confirm client approval/invoice selection still works.
