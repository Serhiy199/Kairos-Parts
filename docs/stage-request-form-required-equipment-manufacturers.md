# Request form required fields and equipment lists

## Scope

This stage updates the public/client request creation flow without changing Prisma schema or removing legacy request fields.

## Request form

The `/request` form now requires:

- Імʼя контактної особи
- Телефон
- Email
- Компанія
- Тип техніки
- Виробник / марка
- Модель
- VIN / серійний номер
- Рік випуску
- Опис / коментар

File upload stays optional. Users can still attach photos, PDF, Excel, CSV, DOC, or DOCX files when they have them.

## Server validation

`POST /api/requests` uses matching server-side validation with Ukrainian messages. `vehicleYear` is required and must be an integer from 1950 to 2100. Invalid years return:

```text
Вкажіть коректний рік випуску техніки.
```

Guest and staff account protection for public request creation remains unchanged: only an authenticated CLIENT can create a request through this endpoint.

## Equipment types

The local equipment list was refreshed for the agricultural workflow. It now contains combine, tractor, mini-tractor, moto-tractor, motoblock, tillage, seeding, sprayer, mower, attachment, trailer, loader, and other agricultural equipment options.

`Інша техніка` is kept as the final fallback option.

## Manufacturer suggestions

Manufacturer suggestions now depend on selected equipment type:

- `Японські трактори` and `Японські міні-трактори`: Hinomoto, Iseki, Kubota, Mitsubishi, Yanmar.
- `Комбайн`: combine-specific brands such as Case IH, Claas, John Deere, New Holland, Ростсельмаш, Нива, and others.
- Other types use a general agricultural manufacturer fallback.

The manufacturer field remains a manual text input with datalist suggestions, so the user can enter a brand that is not in the predefined list. New manual manufacturer names are preserved by finding or creating a `Manufacturer` record during request creation.

## Request details cleanup

Category and subcategory are no longer shown as main request details in:

- client request detail;
- admin request detail;
- client request list category column.

The database fields and relations were not removed, so older requests remain compatible.

## Auth gate

The `/request` auth gate now includes the heading:

```text
Що дає особистий кабінет
```

The existing benefits and login/register return flow remain unchanged.

## Backward compatibility

- `/request?mode=file` still opens the unified request form with a file hint.
- `/request?category=...` remains harmless even though category is no longer part of the form.
- Telegram request creation was not changed.
- CRM/admin manual request logic was not changed.

## Verification

To close the stage, run:

```powershell
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Blockers

No schema migration is required for this stage.
