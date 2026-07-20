# Stage Assisted Fleet 11.1 - Photo onboarding, taxonomy and categories cleanup

## 1. Scope

Етап додає керовані довідники типів техніки та виробників, залежний вибір у формах, клієнтський photo onboarding і спільну безпечну логіку фотографій. Бізнес-модулі заявок, БВ техніки, Telegram та історичні string-поля збережені.

## 2. Git state

Роботу розпочато з одним unrelated diff у `app/(public)/advantages/page.tsx`. Він не змінювався в межах етапу та має залишитися поза commit.

## 3. Vehicle create flow audit

До змін CRM create повертав менеджера до профілю власника, а client create - до списку техніки. Обидва сценарії не підводили користувача до додавання фото.

## 4. Existing photo manager audit

Модель `VehicleImage`, Cloudinary storage helper та CRM photo manager уже існували. Мутації були прив'язані до admin actions, тому їх винесено у спільний server-only mutation layer.

## 5. Client photo permissions

CLIENT може завантажувати, видаляти, призначати головне фото та змінювати порядок лише для техніки у своєму personal/company scope. Кожна мутація повторно перевіряє доступ на сервері та створює `AuditLog` з CLIENT actor.

## 6. Client onboarding

Після створення техніки клієнт переходить на `/client/vehicles/[id]/photos`. Фото залишаються optional; доступне явне завершення без завантаження.

## 7. CRM redirect

Після CRM create використовується `/admin/vehicles/[id]/edit?created=1#photos`. Edit page показує success state, photo section і дію завершення до профілю власника.

## 8. Client redirect

Client create веде безпосередньо у scoped photo onboarding. Сторінка деталей також має посилання на керування фото.

## 9. Outdated storage text

Видалено застарілий текст Day 8 про майбутнє storage-підключення. UI описує фактичний flow.

## 10. Category module audit

`Category` використовується заявками, підкатегоріями, виробниками та публічними category routes. Це окрема бізнес-таксономія запчастин, а не тип техніки.

## 11. Category data audit

У підключеній Neon DB перед migration було 3 category records. Таблицю та Prisma model не видалено.

## 12. Category dependency decision

Виконано UI cleanup без destructive schema change: старі `/admin/categories` та `/admin/manufacturers` перенаправляють у новий модуль довідників.

## 13. Equipment type sources

Джерелами стали документований локальний список типів і distinct історичні значення `Vehicle.type`/`Request.equipmentType`. Вигадані типи не додавались.

## 14. Manufacturer sources

Джерелами стали документована матриця type-to-manufacturer та distinct історичні значення Vehicle/Request. Зв'язки створювалися лише з документованої матриці.

## 15. Taxonomy architecture

Додано canonical `EquipmentType` та many-to-many `ManufacturerEquipmentType`. Forms отримують active taxonomy server-side; UI фільтрує manufacturers за обраним type.

## 16. EquipmentType schema

`EquipmentType` має unique `name`, `normalizedName`, `slug`, поля `isActive`, `sortOrder`, timestamps та relations.

## 17. Manufacturer changes

До `Manufacturer` додано `isActive`, `sortOrder`, індекс і relation до equipment types. Існуючі category/subcategory relations не ламалися.

## 18. Join model

`ManufacturerEquipmentType` використовує composite primary key і foreign keys із cascade delete для записів довідника.

## 19. String compatibility

`Vehicle.type`, `Vehicle.manufacturer`, `Request.equipmentType`, `Request.manufacturer` і Used Equipment поля залишаються strings. Нові записи зберігають canonical names, тому старі сторінки та історія сумісні.

## 20. Controlled backfill

`scripts/backfill-equipment-taxonomy.ts` працює транзакційно через direct Postgres connection, використовує параметризовані запити та є idempotent. Повторний запуск не створив дублікатів.

## 21. Directories UI

Створено `/admin/directories`, `/admin/directories/equipment-types` і `/admin/directories/manufacturers` із secondary navigation та usage counts.

## 22. Directory roles

ADMIN може створювати й редагувати records та зв'язки. MANAGER має read-only доступ. Server actions незалежно перевіряють session і роль.

## 23. Dependent combobox

У vehicle, request та Used Equipment формах manufacturer options залежать від type. Історичне поточне значення може бути показане під час edit без перезапису даних.

## 24. Server validation

Створення та редагування перевіряють active type, active manufacturer і дозволену пару. До DB записуються canonical names; довільні значення та невалідні пари відхиляються.

## 25. Updated forms

Оновлено public request, client vehicle, CRM vehicle та Used Equipment create/edit. Admin owner entry points також передають taxonomy.

## 26. Telegram and Used Equipment

Telegram session тепер отримує active types/manufacturers із DB і перевіряє pair перед створенням заявки. Used Equipment використовує той самий canonical validation. Інші Telegram flows не змінювались.

## 27. Categories cleanup

Admin navigation замість окремих placeholder-пунктів показує `Довідники`. Жива category domain model і публічні category routes залишені.

## 28. AuditLog

До `AuditEntityType` додано `EQUIPMENT_TYPE` та `MANUFACTURER`. Directory mutations і client photo mutations записують аудит без секретів і storage credentials.

## 29. Migration

Створено й застосовано `20260720100000_add_equipment_taxonomy_management` (`add_equipment_taxonomy_management`). Reset, drop і `db push` не виконувались.

## 30. Database audits

До migration: categories 3, manufacturers 7, vehicles 6, requests 28, distinct vehicle types 4, request types 13. Після migration/backfill: equipment types 48, active types 48, manufacturers 91, active manufacturers 91, relations 357, duplicate slugs 0, duplicate normalized names 0, orphan relations 0.

## 31. Security

Photo actions не приймають ownership із клієнта, directory mutations не довіряють UI role state, upload обмежений JPEG/PNG/WebP, 8 MB і максимум 10 фото. Секрети не логуються й не комітяться.

## 32. Responsive and accessibility

Форми використовують наявні dashboard/public responsive patterns, видимі labels і текстові actions. Photo manager зберігає існуючі accessible controls; directory lists не додають global horizontal scroll.

## 33. Targeted checks

Успішно виконано `prisma format`, `prisma validate`, `prisma generate`, `typecheck`, `lint`, `build`, controlled backfill двічі та post-migration integrity audit. `git diff --check` виконується перед commit.

## 34. Browser smoke

Guest `/request` перевірено локально: auth gate і links `/login?next=/request`, `/register?next=/request` рендеряться коректно. Authenticated CRM smoke не завершено: локальний dev process досяг execution timeout під час server action входу; це не позначено як UI pass.

## 35. Remaining gaps

Після redeploy потрібен ручний authenticated smoke: ADMIN directory CRUD, MANAGER read-only, admin/client vehicle create redirects, real Cloudinary upload/delete/primary/reorder і залежні combobox на mobile/desktop.

## 36. Blockers and diagnostics

`prisma migrate deploy` успішно застосував migration, а read-only Postgres audit підтвердив таблиці та зв'язки. Наступний `prisma migrate status` на цьому Windows host повертає generic Schema Engine TLS error (`security package credentials are unavailable`). Build теж логував цю TLS diagnostic для трьох optional directory counts, але завершився з exit code 0. Це локальний Prisma/Windows transport blocker для повторної status-перевірки, не ознака rollback migration.

## 37. Next safe step

Задеплоїти commit у Vercel, перевірити production runtime з його Linux TLS stack, а потім пройти authenticated checklist із реальним Cloudinary та ADMIN/MANAGER/CLIENT ролями. Нову migration для наступного кроку не створювати без окремого scope.
