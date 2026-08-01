# Kairos Parts — Used Equipment Free-Text Fields and Auto Title

## 1. Контекст

У CRM Used Equipment форма успадкувала taxonomy-dependent UI: тип і виробник обиралися зі списків, виробник залежав від типу, а title вводився вручну. Новий contract вимагає незалежні довільні поля `type`, `manufacturer`, `model`, окремий `year` і server-generated title.

## 2. Початковий Git стан

- Branch: `develop`.
- Початковий SHA: `d42f6a44a91ed69a9af9860be0ae61fead718af9`.
- `develop` дорівнював `origin/develop`; working tree був чистий.
- Merge/rebase/cherry-pick не виконувалися.

## 3. Root cause

Commit `05fa587` під’єднав Used Equipment create/edit до загальної equipment taxonomy. Форма почала отримувати `getActiveEquipmentTaxonomy`, використовувати `SearchableCombobox`, фільтрувати manufacturers за type та надсилати `manufacturerId`; server actions повторно перевіряли allowlist через `validateEquipmentTaxonomySelection`. Manual title залишився з первісного CRUD contract.

## 4. Старий type selector

`components/used-equipment/used-equipment-form.tsx` будував `equipmentTypeOptions` із taxonomy і рендерив `SearchableCombobox`. Це виключало довільні значення та змішувало Used Equipment з directory module.

## 5. Стара manufacturer dependency

Manufacturer options залежали від обраного type. При зміні type невідповідний `manufacturerId` очищався; поле було disabled, доки type не обрано. Server action вимагав active taxonomy relation.

## 6. Prisma model

`UsedEquipment` уже має всі потрібні поля: persisted `title: String`, `equipmentType: String`, `manufacturerName: String`, `model: String?`, `year: Int?`. `manufacturerId` nullable, title не unique; slug unique і генерується з title тільки під час create.

## 7. Новий field contract

- `type`, `manufacturer`, `model` — required trimmed free text, максимум 120 символів кожне.
- `year` — окреме optional поле у форматі чотирьох цифр, діапазон 1950–2100.
- `title` — відсутній у FormData/UI та формується server-side.
- Status contract не змінено: `DRAFT`, `PUBLISHED`, `ARCHIVED`.

## 8. Type free-text fix

Type тепер звичайний `<input type="text" name="type">`, без select, combobox, datalist, autocomplete list або allowlist. Значення зберігається в `UsedEquipment.equipmentType`.

## 9. Manufacturer free-text fix

Manufacturer тепер незалежний `<input type="text" name="manufacturer">`, завжди активний. Значення зберігається в `manufacturerName`, а `manufacturerId` встановлюється в `null`, щоб Used Equipment не залежав від taxonomy relation.

## 10. Model field

Додано required `<input type="text" name="model">`. Prisma поле вже існувало як nullable для сумісності зі старими rows, тому schema change не потрібна. Нові create/edit submissions вимагають непорожню model.

## 11. Year field

Year залишився окремим полем. Наявна validation 1950–2100 збережена однаково для create/edit; порожній year дозволений відповідно до nullable Prisma contract.

## 12. Removal of manual title

Поле `name="title"` видалено з form, form state, FormData parsing і field errors. Client payload більше не може підмінити canonical title.

## 13. Automatic title helper

`buildUsedEquipmentTitle` у `lib/used-equipment/title.ts` trim-ить усі сегменти, пропускає відсутній optional year та формує одинарними пробілами:

```text
Тип Виробник Модель Рік
```

Приклад: `Трактор John Deere 6155M 2020`.

## 14. Create flow

`type + manufacturer + model + year → validateUsedEquipmentForm → canonical title → slug → UsedEquipment.create(DRAFT)`. Taxonomy lookup видалено; `manufacturerId=null`; image/Cloudinary behavior не змінено.

## 15. Edit flow

Edit page завантажує persisted `equipmentType`, `manufacturerName`, `model`, `year` у text inputs. Shared validation перебудовує title перед `UsedEquipment.update`; статус і status dates працюють як раніше. Slug навмисно не змінюється, щоб не ламати чинні URL.

## 16. Public rendering

Public query, card, detail heading, breadcrumbs, metadata/Open Graph, gallery alt і inquiry dialog використовують persisted `item.title`. Отже після create/edit всюди відображається canonical automatic title.

## 17. CRM rendering

CRM list і edit heading використовують persisted `item.title`. Used Equipment inquiry зберігає snapshot `equipmentTitle`; існуючий UI окремо показує current title, якщо картка була перейменована після inquiry.

## 18. Removed dead code

Із Used Equipment видалено taxonomy prop/fetch, `SearchableCombobox`, option mappings, dependent hooks/state, manufacturer disabled/clear logic та server-side `validateEquipmentTaxonomySelection`. Глобальні directories не видалялися, бо вони використовуються Vehicle/Request flows.

## 19. Validation

Arbitrary Ukrainian/Latin/mixed values проходять validation; whitespace-only `type`, `manufacturer`, `model` відхиляються. Server-generated title обмежений 180 символами. Description sanitization, internal comment limit, image та status validation збережені.

## 20. Migration impact

Prisma schema не змінено, migration не створено. Existing rows не backfill-илися і production data не змінювалися. Старі rows з `model=null` залишаються читабельними; при наступному edit model треба заповнити за новим contract.

## 21. Regression check

Додано `npm run test:used-equipment-free-text-fields`. Він перевіряє free-text UI, відсутність taxonomy/manual title, arbitrary values, whitespace rejection, title examples, однакову create/edit validation, persisted field mapping, public/CRM title rendering і незмінні statuses.

## 22. Lint/typecheck/build

PASS: Prisma validate/generate, lint, typecheck, production build (56/56 pages), targeted test, актуальний rich-text sanitizer check, client vehicle unified-form check та auth redirect-origin check.

Два старі standalone checks мають pre-existing failures поза цим fix:

- `verify-used-equipment-description-sanitizer.ts` очікує видалення `<img>`, хоча актуальний rich-text contract дозволяє sanitized images; `check-rich-text-editor.ts` PASS.
- `check-public-ui-cleanup.ts` має дві застарілі exact-copy assertions.
- `check-admin-ui-stage-11-2.ts` має застаріле припущення про filtering audit metadata.

## 23. Changed files

Scoped зміни: Used Equipment form, create/edit pages, server actions, validation, новий title helper, package script, regression check і цей report. Prisma schema, migrations, public components, Vehicle/Request taxonomy та dependencies не змінювалися.

## 24. Commit and push

Запланований один commit: `fix: simplify used equipment identity fields`; push target — `origin/develop`. Exact SHA і push result фіксуються у фінальному handoff, оскільки report входить у commit.

## 25. What was not changed

Не змінювалися `main`, production, DB/data, Cloudinary behavior/config, Telegram, dependencies, webhook, статуси або public route contract. `RESERVED`/`SOLD` не поверталися.

## 26. Blockers

Implementation blocker відсутній. Live browser/production QA не виконувалося; це окремий pre-release gate. Старі standalone check failures задокументовані як baseline debt і не виправлялися поза scope.
