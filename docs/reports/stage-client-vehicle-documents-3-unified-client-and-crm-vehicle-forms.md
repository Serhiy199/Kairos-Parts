# Stage Client Vehicle Documents 3 — Unified client and CRM vehicle forms

## 1. Мета

Об’єднати створення та редагування техніки для CLIENT і CRM в один узгоджений flow: основні характеристики, нові фотографії та нові документи надсилаються однією формою. Ручне поле `Vehicle.name` прибрано з UI та FormData-контракту; display name формується сервером із виробника й моделі.

## 2. Початковий UI

CLIENT create підтримував core-поля й фото, але не документи. CLIENT direct edit був прихований feature-константою, а фото мали окрему сторінку. CRM create містив лише core-поля; CRM edit використовував окремі upload-форми для фото й документів. Обидві edit-форми показували ручне поле «Назва техніки».

## 3. Routes and components audited

- `/client/vehicles/new`;
- `/client/vehicles/[id]`;
- `/client/vehicles/[id]/photos` як сумісний legacy route;
- `/admin/clients/[id]/vehicles/new`;
- `/admin/companies/[id]/vehicles/new`;
- `/admin/vehicles/[vehicleId]/edit`;
- CLIENT/CRM vehicle actions, image actions, document actions і download routes;
- actor-aware document service, image mutations, ownership, taxonomy та canonical name helpers.

## 4. Shared core fields

Створено `VehicleCoreFields`, який спільно використовується CLIENT і CRM формами. Компонент містить тип техніки, виробника, модель, рік, VIN/серійний номер і примітку, підтримує taxonomy/manual fallback та typed field errors.

## 5. Manual name removal

Поле `name` видалено з `AdminVehicleFormValues`, парсингу FormData та обох форм. Browser payload `name` ігнорується. `Vehicle.name` залишається persisted display field і на create/update формується `buildVehicleDisplayName({ manufacturer, model })`. Зміна виробника або моделі через чинний change-request apply також перераховує canonical name.

## 6. Client create form

CLIENT create page тепер має core-поля, image picker і document picker та одну primary submit-кнопку. Owner визначається лише з authenticated CLIENT access context. Після успіху виконується redirect на detail нової техніки.

## 7. CRM create form

CRM create для personal CLIENT і Company використовує той самий набір секцій. Owner card залишається read-only, а owner береться з route/server context. Для нових staff-документів доступний контроль початкової видимості клієнту.

## 8. Client edit form

Direct CLIENT edit увімкнено на detail page. Core-зміни, нові фото та нові документи надсилаються однією формою. Існуючі фото показані нижче з чинними reorder/primary/delete controls; їхня окрема upload-форма прихована. Запит на архівацію збережено окремим контрольованим flow.

## 9. CRM edit form

CRM edit об’єднує core-зміни та нові assets в основній формі. Існуючі фото й документи залишаються в окремих списках для destructive/management operations, але їхні дубльовані upload-форми приховані.

## 10. Image picker integration

Shared `VehicleImagePicker` підтримує JPEG/PNG/WebP, preview, remove-before-submit, duplicate handling, per-file size limit і загальний ліміт кількості з урахуванням уже збережених фото. Object URLs звільняються при видаленні та unmount.

## 11. Document picker

Shared `VehicleDocumentPicker` підтримує PDF/JPEG/PNG/WebP, список вибраних файлів, розмір, remove-before-submit, duplicate handling, file-level errors, batch limit 5 файлів/60 МБ, per-file limit 15 МБ, vehicle limit 25 файлів і 250 МБ.

## 12. Existing document lists

CLIENT бачить власні CLIENT-документи та лише видимі staff-документи. CRM бачить усі документи техніки в межах чинного staff policy. UI показує локалізовані source labels, тип, розмір, дату та download; private storage metadata не рендериться.

## 13. Client own-delete

CLIENT delete control формується сервером і показується лише коли `source=CLIENT` та `uploadedById` збігається з поточним actor. Видалення вимагає confirmation. Canonical backend guard Stage 2 залишається вирішальним і блокує forged delete.

## 14. Staff visibility controls

CRM visibility control показується для staff/system/legacy документів відповідно до чинного action policy. Для `source=CLIENT` misleading visibility toggle не показується; замість нього вказано, що документ доступний власнику.

## 15. One-submit workflows

`validateVehicleAssetSelection` виконує server preflight перед core mutation. Після успішного create/update `attachVehicleAssets` послідовно викликає canonical image mutation та document service з server-derived actor. CLIENT source/visibility й staff source визначаються backend service, а не browser payload.

## 16. Compensation and partial failure

Невалідний asset блокує core mutation до запису. Після core commit upload/DB failure не маскується як повний успіх: detail/edit route отримує controlled partial warning. Document service очищає тимчасові Cloudinary assets best-effort; cleanup failure має окреме попередження для технічної перевірки. Уже успішно прикріплені assets не видаляються через помилку наступної групи.

## 17. Authorization

- CLIENT vehicle access використовує `vehicleAccessWhere(access)`;
- CLIENT owner визначається через authenticated client/company context;
- CRM owner визначається route context і перевіряється сервером;
- actor role нормалізується після `requireCrmSession`;
- document source та uploader задає actor-aware service;
- download/delete/visibility actions зберігають canonical Stage 2 guards.

## 18. Security

Не приймаються browser-controlled `name`, owner, `source` або `uploadedById`. CLIENT не може керувати `visibleToClient`. Document validation перевіряє MIME, extension, secondary dangerous extensions, signature, file/batch/count/total quotas. CLIENT query не повертає hidden staff metadata чи private Cloudinary identifiers.

## 19. Responsive behavior

Форми та списки використовують `min-w-0`, responsive grid/flex layouts, `break-words` для довгих назв, wrap для controls і mobile-first spacing. Image previews використовують responsive `sizes`.

## 20. Accessibility

Збережено labels, fieldsets/legends, required та error semantics, `aria-invalid`, `aria-describedby`, `role=alert/status`, disabled pending controls, зрозумілі aria-label для remove/download actions і keyboard-accessible confirmation через `details`.

## 21. Legacy compatibility

Окрема CLIENT photos route не видалена. Існуючі image/document services, downloads, audit events, ownership semantics і historical sources не переписані. Historical `Vehicle.name` не мігрувався. LEGACY/SYSTEM документи мають локалізовані read-only source labels у CLIENT UI.

## 22. Tests

Додано `test:client-vehicle-documents-stage3`. Focused suite перевіряє shared one-submit UI, відсутність manual name, canonical name, server-owned actor/source fields, CLIENT document filtering/delete UI, localized labels і document security limits.

Пройшли:

- Stage Client Vehicle Documents 2;
- assisted fleet / Vehicle name;
- Admin Audit Log 3/4/5;
- Request Approval UI 1/2 та Stages 3/4/5/6;
- request selection batch;
- partial invoice, invoice-sent і sequential invoice numbering.

## 23. Validation

- `npx.cmd prisma format` — пройдено; format-only schema diff прибрано зі scope;
- `npx.cmd prisma validate` — пройдено;
- `npx.cmd prisma generate` — пройдено;
- `npm.cmd run lint` — пройдено;
- `npm.cmd run typecheck` — пройдено;
- `npm.cmd run build` — пройдено, 55 static pages generated;
- `git diff --check` — має бути повторно підтверджено перед commit.

## 24. Changed files

Змінено CLIENT/CRM vehicle actions і pages, shared vehicle forms/managers, vehicle validation/query helpers, package script та assisted-fleet regression. Додано shared core/image/document pickers, client document manager, asset workflow, source presentation helper, focused Stage 3 script і цей report.

## 25. Not changed

Не змінювалися Prisma models/migrations, DB data, Cloudinary assets, Auth.js roles, Telegram, invoice/request business logic, deployment configuration або feature flags. Migration не застосовувалась. Push і deployment не виконувалися.

## 26. Known limitations

- Cloudinary і PostgreSQL не мають спільної transaction;
- cleanup залишається best-effort;
- durable cleanup worker/outbox не реалізований;
- Stage 2 migration `20260730123000_add_document_source_provenance` не застосовувалась цим Stage;
- live Cloudinary/browser QA не виконувалась без test migration;
- historical Vehicle names масово не переписувалися;
- `Vehicle.name` залишається persisted display field.

## 27. Runtime QA readiness

Browser QA свідомо відкладено. Після окремого explicit approval і застосування Stage 2 migration до ізольованої test/staging DB потрібно пройти CLIENT/CRM create/edit combinations, source/visibility/download/delete, mobile layout, quota/invalid-file, stale access та repeated-submit scenarios. Live Cloudinary operations у цьому Stage не виконувалися.

## 28. Git state

Робота виконана у `develop`. До Stage 3 існувала стороння unstaged-зміна `app/(public)/about/page.tsx`; вона не редагувалась цим Stage і має залишитися поза staging/commit. Stage 3 готується як один scoped commit без push.
