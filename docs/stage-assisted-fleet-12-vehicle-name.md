# Stage Assisted Fleet 12 — Vehicle name

## 1. Мета

Додати обов’язкову користувацьку назву `Vehicle.name` і використовувати її як основний заголовок техніки без зміни ownership, VIN, фото, документів або заявок.

## 2. Початкова проблема

Окремої назви не було; UI автоматично формував заголовок із `manufacturer + model`.

## 3. Чому картка показувала manufacturer/model

Клієнтські й CRM-компоненти локально складали ці поля без спільного display helper.

## 4. Обрана назва поля

Використано `name`: це узгоджується з моделями проєкту й чітко відрізняється від технічних `manufacturer` та `model`.

## 5. Prisma schema

`Vehicle.name String` є required і не має unique-обмеження. Ownership relations та індекси не змінені.

## 6. Migration

`20260722141000_add_vehicle_name` додає nullable колонку, виконує backfill, перевіряє значення, робить поле `NOT NULL` і додає length check 2–120.

## 7. Backfill

На Neon оброблено 8 із 8 Vehicle. Після міграції invalid names: 0; ownership violations: 0.

## 8. Backfill fallback policy

Порядок: `manufacturer + model` → `model` → `manufacturer` → `type` → `Техніка`. VIN не використовується; значення обмежується 120 символами.

## 9. Validation

Shared helper trim-ить і стискає whitespace, вимагає 2–120 символів та повертає контрольовані українські помилки.

## 10. Client create form

Повноширинне required-поле `Назва техніки *` розміщено першим; створення й API передають нормалізовану назву.

## 11. Admin create forms

Спільна форма створення для personal client і company отримала те саме required-поле; owner не читається з форми.

## 12. Vehicle edit

Client direct edit і trusted CRM edit оновлюють `name`; diff та audit містять лише змінені editable fields.

## 13. ChangeRequest

`name` додано до allowlist, snapshot, нормалізації, no-op/stale перевірок і approval update. Ownership не є editable field.

## 14. AuditLog

Create/update snapshots включають `name`; approval повертає before/after для `name`; presentation label — `Назва техніки`.

## 15. Card display

Primary title — `vehicle.name`; тип зберігається окремо.

## 16. Secondary manufacturer/model display

Shared `getVehicleDisplay` формує `manufacturer · model` і приховує secondary, якщо нормалізоване `manufacturer + model` дорівнює `name`.

## 17. Detail pages

Client detail, CRM edit і photo manager використовують `name`; manufacturer/model залишені окремими характеристиками.

## 18. Selectors

CRM request/fleet і change-request labels показують name як primary. Document context використовує name; VIN до selector label не додавався.

## 19. Telegram

Fleet selector вибирає `name` і формує label `name — manufacturer model · year`; auth/session/request creation не змінені.

## 20. Search

Окремого Vehicle search у фактичному коді не знайдено, тому search logic не змінювався.

## 21. API/types

Client Vehicle POST валідовує `name`; legacy caller без нього отримує `400 validation_error` з `field: name`. Relevant Prisma selects і serialized document contexts оновлені.

## 22. Automated checks

`scripts/check-assisted-fleet-12-vehicle-name.ts` перевіряє validation/display, migration contracts, create/edit/change/audit/Telegram/card contracts і read-only Neon postconditions. Persistent test records: 0.

## 23. Regression checks

Успішно: Assisted Fleet Stage 10, Stage 11, Stage 11.1 і Telegram request flow. Ownership, VIN duplicates, photos, documents та ChangeRequest invariants без порушень.

## 24. Prisma validate/generate/status

`prisma validate`, `prisma generate`, `prisma migrate deploy` і `prisma migrate status` успішні; Neon schema is up to date.

## 25. Typecheck

`npm.cmd run typecheck` — passed.

## 26. Lint

`npm.cmd run lint` — passed.

## 27. Build

`npm.cmd run build` — passed. Перший запуск конфліктував із dev runtime через відсутній `.next/build-manifest.json`; чистий повторний запуск без dev runtime успішний.

## 28. git diff --check

Passed; лише локальні line-ending warnings, whitespace errors відсутні.

## 29. Browser smoke

Local server і login form відкрились. CLIENT fixture login завершився redirect `error=auth-unavailable`, тому authenticated form/card/detail, mobile/desktop overflow та console smoke не підтверджені. Browser не створював тестових Vehicle.

## 30. Remaining risks

Потрібен ручний authenticated staging smoke для CLIENT/ADMIN/MANAGER і responsive layouts. Runtime auth blocker не пов’язаний зі schema/build перевірками цього stage.

## 31. Release status

Neon migration applied; code ready for commit. Push, Vercel redeploy і manual staging не виконуються без окремого рішення.

## 32. Final verdict

GO для commit і переходу до manual staging після відновлення authenticated browser session. NO-GO для заяви про повний browser E2E до проходження цього smoke.
