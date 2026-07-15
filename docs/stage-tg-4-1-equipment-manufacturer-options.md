# Stage TG-4.1: Shared equipment and manufacturer options

## What changed

Telegram request flow now uses the same equipment type source as the website request form.

The website request form already used:

```text
lib/vehicles/equipment-types.ts
lib/vehicles/equipment-manufacturers.ts
```

Telegram previously had a short hardcoded equipment keyboard in:

```text
lib/telegram/messages.ts
```

That short list was replaced with a keyboard generated from `EQUIPMENT_TYPE_OPTIONS`.

## Shared equipment options

Shared source:

```text
lib/vehicles/equipment-types.ts
```

Used by:

```text
app/(public)/request/request-form.tsx
lib/telegram/messages.ts
```

This keeps web-form and Telegram equipment type values aligned. Existing saved request values are not renamed or migrated.

## Shared manufacturer mapping

Shared source:

```text
lib/vehicles/equipment-manufacturers.ts
```

The existing shared mapping is now used by Telegram so the bot can show relevant manufacturer suggestions after the client selects the equipment type.

The web-form still uses `getManufacturersForEquipmentType()` for datalist suggestions.

Telegram uses `getSpecificManufacturersForEquipmentType()` to decide whether to show a manufacturer keyboard or ask for manual input.

## Telegram behavior

Equipment type step:

```text
Оберіть тип техніки:
```

The keyboard is generated from the same `EQUIPMENT_TYPE_OPTIONS` used by the website.

Manufacturer step:

```text
Оберіть виробника / марку техніки:
```

If the selected equipment type has manufacturer options, Telegram shows those options as buttons.

Every manufacturer keyboard includes:

```text
Інший виробник
```

If the client presses this button, the bot asks:

```text
Введіть виробника або марку техніки.

Наприклад: John Deere, MAN, Claas
```

The client can also type a manufacturer manually instead of selecting a button.

## Request creation

Request creation logic was not changed.

Telegram still stores:

```text
equipmentType: selected equipment type text
manufacturer: selected or manually entered manufacturer text
```

The existing manufacturer lookup/create behavior remains unchanged.

## Not included

This stage does not add:

- Prisma schema changes;
- migrations;
- admin UI for managing equipment/manufacturer lists;
- Telegram approve/reject actions;
- invoice approval in Telegram;
- payment logic;
- OCR manufacturer detection.

## Checks

Executed:

```text
npx.cmd prisma validate: passed
npx.cmd prisma generate: failed with Windows EPERM while renaming Prisma query_engine DLL
npx.cmd prisma generate --no-engine: passed
npm.cmd run typecheck: passed
npm.cmd run lint: passed
npm.cmd run build: first run failed with transient Next /_document cache error, second run passed
git diff --check: passed with Windows LF -> CRLF warnings only
```

Prisma schema was not changed. No migration was created.

## Manual smoke notes

Recommended manual checks:

1. Open `/request` and confirm the equipment type list is unchanged.
2. Select a type and confirm manufacturer suggestions remain available.
3. In Telegram, start a registered client flow.
4. Confirm the equipment type keyboard uses the full shared list.
5. Select a type with known mapping, for example `Комбайн`.
6. Confirm the bot shows relevant manufacturers and `Інший виробник`.
7. Select a manufacturer and confirm it appears in the summary.
8. Test `Інший виробник` and confirm manual text appears in the summary and CRM.
