# Stage Admin Audit Log 1 — Manager Activity Coverage Audit

## 1. Executive summary

Аудит виконано у режимі docs/read-only на гілці `main`, baseline `a0cb83d`. Runtime code, Prisma schema, migrations, UI, cron і Neon data не змінювалися. Одноразовий локальний SELECT-скрипт після перевірки видалено.

У застосунку є централізований `AuditLog`, але він не є повним журналом CRM. Він покриває change requests, manager invitation/lifecycle, vehicle та directory/document події. Зміни статусів заявок зберігаються окремо у `RequestStatusHistory`; частина provenance є у бізнес-моделях. Критичні операції із заявками, позиціями, компаніями, commercial offers та invoices переважно не мають actor + entity + before/after в одному незмінному записі.

Історію конкретного активного або `DISABLED` manager частково можна отримати за `AuditLog.actorId` та окремими actor-полями. Повної хронології немає через неповне покриття. Immutable actor snapshot відсутній: після hard delete `User` зв’язок `AuditLog.actorId` стане `NULL`, а ім’я/email/role буде втрачено. Поточна team logic використовує soft disable, не hard delete.

Поточна модель не підтримує затверджену multi-class retention policy без migration. Рекомендована мінімальна additive модель: `category`, `retentionClass`, `expiresAt`, actor snapshot, request context та індекс для chunked cleanup. До Stage Admin Audit Log 2 потрібні продуктові рішення щодо доступу MANAGER до журналу, складу actor snapshot, класифікації неоднозначних подій і допустимого PII у payload.

## 2. Поточна архітектура audit/history

| Джерело | Призначення | Actor | Before/after | Обмеження |
| --- | --- | --- | --- | --- |
| `AuditLog` | Централізовані business audit events | nullable relation до `User` | `oldValue` / `newValue` JSON | Неповне coverage, немає category/retention/snapshot/IP/UA |
| `RequestStatusHistory` | Послідовність статусів заявки | nullable `changedByUserId` | лише `oldStatus` / `newStatus` | Видаляється разом із request; не central audit |
| `ChangeRequest` | Workflow погодження змін | `requestedById`, nullable `reviewedById` | `oldValue` / `newValue` JSON | Workflow record, не загальний журнал; requester має cascade |
| `RequestComment` | Бізнес-коментар | nullable `authorId` | ні | Контент, а не mutation audit |
| `RequestDocument.uploadedById` | Provenance upload | nullable | ні | Немає історії update/delete/download |
| `CommercialOffer.createdById` | Provenance create | nullable | snapshots/status, але не event diff | Немає actor для наступних transitions |
| `Invoice.createdById` | Provenance create | nullable | invoice snapshots, але не event diff | Немає actor для send/cancel/paid |
| `Session` | Auth.js adapter model | `userId` | ні | Поточна auth strategy — JWT; це не activity log |
| `TelegramDraftRequest` | Тимчасовий Telegram workflow state | client context | ні | Не є довготривалою business history |

`createAuditLog` у `lib/audit-log/service.ts` є тонким append helper навколо `prisma.auditLog.create`. Єдиного orchestration layer, який автоматично охоплює всі mutations, немає: кожен action/service має явно створити запис.

## 3. Prisma models і migrations

### `AuditLog`

- Migration: `prisma/migrations/20260708210000_add_audit_logs/migration.sql`.
- Поля: `id`, nullable `actorId`, nullable `companyId`, nullable `changeRequestId`, `entityType`, `entityId`, `action`, nullable JSON `oldValue`, `newValue`, `metadata`, `createdAt`.
- Relations: actor/company/change request використовують `onDelete: SetNull`; record може пережити hard delete цих records, але втрачає relation identity.
- Indexes: `actorId`, `companyId`, `changeRequestId`, `(entityType, entityId)`, `action`, `createdAt`.
- Unique constraint відсутній. Це нормально для подієвого журналу, але немає idempotency key проти повторного запису при retry.
- Actor nullable. Snapshot `actorName`, `actorEmail`, `actorRole` відсутній.
- `category`, `retentionClass`, `expiresAt`, `ip`, `userAgent`, request/correlation ID відсутні.
- `AuditEntityType` не містить REQUEST_DOCUMENT, COMMERCIAL_OFFER та INVOICE як фактично використовувані central entities; enum містить `REQUEST_DOCUMENT` і `COMMERCIAL_OFFER`, але відповідне logging coverage не реалізоване, а `INVOICE` відсутній.
- `AuditAction` має обмежений набір подій; значна частина конкретики кодується у `metadata.event` разом із generic `ENTITY_UPDATED`.

### Інші history/provenance models

- `RequestStatusHistory`: `id`, `requestId`, nullable `changedByUserId`, old/new status, `createdAt`; `Request` — cascade, actor — `SetNull`; indexes за request і actor.
- `ChangeRequest`: requester required з `onDelete: Cascade`, reviewer nullable з `SetNull`, entity/action/status, old/new JSON, reason/comments/timestamps. Hard delete requester може каскадно видалити workflow history, що неприйнятно для незалежного audit trail.
- `RequestComment`: nullable author `SetNull`; коментар не фіксує mutation diff.
- `RequestDocument`, `CommercialOffer`, `Invoice`: actor provenance окремих create/upload подій, але не повна історія.
- Окремих `ActivityLog`, `InvoiceHistory`, `DocumentHistory`, login history або Telegram event history models не знайдено.

## 4. Поточний UI «Журнал дій»

- Route: `/admin/audit-log`.
- Page: `app/admin/audit-log/page.tsx`.
- Navigation: `app/admin/layout.tsx`.
- Query/presentation: `lib/audit-log/service.ts`, `lib/audit-log/presentation.ts`.
- Access guard: `requireCrmSession()`, тому сторінка доступна і `ADMIN`, і `MANAGER`.
- Сторінка показує останні 200 records, desktop table та mobile cards.
- Показуються actor із поточного `User`, дата, action/entity, `oldValue`, `newValue`, metadata.
- Немає pagination, search, actor/date/category/action/entity filters, actor activity route, detail route, export.
- IP/User Agent не показуються, бо не зберігаються.
- Delete, bulk delete і direct delete API не знайдено.
- Shared повноцінних filter/table primitives для майбутнього журналу немає; існуючий responsive rendering можна перевикористати частково.

## 5. Actor identity та деактивовані менеджери

Поточна team operation «Вимкнути доступ» змінює status на `DISABLED` і збільшує `authVersion`; `User` фізично не видаляється. Тому старі `AuditLog.actorId` продовжують показувати актуальні ім’я/email/role деактивованого manager. Neon містить 2 audit records, actor яких зараз є `DISABLED` manager.

Сценарій hard delete слабший: `AuditLog.actorId` має `SetNull`, actor snapshot відсутній, тому ім’я/email/role зникнуть. Дата, action, entity і before/after залишаться. Для довготривалої кадрової атрибуції потрібен immutable snapshot, заповнений у момент event: щонайменше `actorUserId`, `actorName`, `actorEmail`, `actorRole`; email бажано нормалізувати, але не маскувати настільки, щоб втратити audit value.

`ChangeRequest.requestedById` має `Cascade`, отже hard delete requester може видалити сам change request. Це ще одна причина не вважати `ChangeRequest` immutable audit storage.

## 6. Session invalidation audit

- Auth.js використовує `session.strategy = 'jwt'`; Prisma `Session` table існує через adapter schema, але активна staff session не покладається на DB session row.
- Credentials login перевіряє current `User.status`; `DISABLED` manager не може увійти.
- JWT містить `status` та `authVersion`.
- Disable/enable lifecycle збільшує `authVersion`.
- Auth callback та protected server guards викликають DB-backed validation через `validateSessionAgainstCurrentUser`.
- Middleware робить ранній JWT gate без Prisma; остаточні page/action/API guards повторно перевіряють поточний DB state.
- Після disable вже виданий JWT стає непридатним на наступній server-side validation; чекати закінчення cookie не потрібно. Cookie може фізично залишатися, але protected access відхиляється.
- Окрема реалізація «delete all active Session rows» для JWT strategy не потрібна. Security revoke реалізований version counter.
- Сам факт session revocation та denied access у `AuditLog` не фіксується.

## 7. Coverage matrix

Позначення: `LOGGED` — central audit record має достатній контекст; `PARTIALLY_LOGGED` — є history/provenance або неповний payload; `NOT_LOGGED` — action існує без audit; `UNKNOWN` — action/flow не знайдено або його runtime behavior не можна підтвердити code audit.

### Auth

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | Login success | NOT_LOGGED | Ні | Ні | Ні | JWT only | Немає login trail | TECHNICAL/LOGIN event без password/identifier payload |
| Auth | Login failure / disabled attempt | NOT_LOGGED | User може бути невідомий | Ні | Ні | Rate-limit bucket не audit | Security blind spot | HMAC account key, reason category, IP prefix/hash |
| Auth | Logout | NOT_LOGGED | Session user | Ні | Ні | Auth action | Немає session exit trail | LOGIN event |
| Auth | Password reset | UNKNOWN | — | — | — | Flow не знайдено | Не можна оцінити | Audit при майбутній реалізації |
| Auth | Session revoke | PARTIALLY_LOGGED | Admin у disable event | User | status old/new | `AuditLog` lifecycle event | Немає окремого revoke event | Окремий LOGIN/SECURITY event за потреби |

### Team

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Team | Invitation create | LOGGED | Admin | User | New + metadata | `AuditLog` | Token не повинен потрапляти у payload | Зберегти STANDARD, без token |
| Team | Invitation regenerate | LOGGED | Admin | User | New + metadata | `AuditLog` | Generic entity context | Зберегти STANDARD |
| Team | Invite acceptance / activation | LOGGED | Activated user | User | New + metadata | `AuditLog` | Actor трактовано як self, не admin | Явний `actorKind=SELF` |
| Team | Disable manager | LOGGED | Admin | User | status before/after | `AuditLog` `ENTITY_UPDATED` | Подія схована у metadata | Виділити typed action |
| Team | Re-enable manager | LOGGED | Admin | User | status before/after | `AuditLog` `ENTITY_UPDATED` | Те саме | Виділити typed action |
| Team | Change role/name/email/phone | UNKNOWN | — | — | — | Mutation flow не знайдено | Майбутня дія може бути без audit | Покрити при появі mutation |
| Team | Hard delete manager | UNKNOWN | — | — | — | UI/action не знайдено | Cascade/SetNull втрати | Заборонити application hard delete |

### Clients

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clients | Client self-registration | NOT_LOGGED | Self/anonymous | User | Ні | `User`/`ClientProfile` create | Немає creation trail | STANDARD creation event |
| Clients | Profile edit through approved change request | LOGGED | Client + reviewer | ChangeRequest/target | JSON old/new | `ChangeRequest` + `AuditLog` | Coverage лише через цей workflow | Зберегти й додати actor snapshots |
| Clients | Direct admin profile/email/phone edit | UNKNOWN | — | — | — | Flow не знайдено | Future gap | Audit усі direct mutations |
| Clients | Disable/delete client | UNKNOWN | — | — | — | Flow не знайдено | Identity/history risk | Soft disable; deletion policy |
| Clients | Client document upload/visibility/delete | LOGGED | CRM actor | User | Частково metadata/diff | `AuditLog` | Не весь file snapshot | STANDARD, file ID/name/classification |

### Companies

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Companies | Create company | NOT_LOGGED | Admin/manager | Company | Ні | Company create | Немає creator trail | STANDARD create snapshot |
| Companies | Edit company | NOT_LOGGED | Admin/manager | Company | Ні | Company update | Немає diff | STANDARD changed-fields diff |
| Companies | Add/remove member | NOT_LOGGED | Admin | Company/User | Ні | Membership mutation | Ownership scope changes invisible | STANDARD event per member |
| Companies | Change primary contact | NOT_LOGGED | Admin | Company | Ні | Membership/company update | Access/business risk | STANDARD before/after |
| Companies | Change billing details | NOT_LOGGED | Admin/manager | Company | Ні | Billing details upsert | Financial identity risk | FINANCIAL_CRITICAL snapshot/diff |
| Companies | Documents upload/visibility/delete | LOGGED | CRM actor | Company | Частково | `AuditLog` | Metadata-only cases | STANDARD with safe file context |

### Requests

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requests | Create request | NOT_LOGGED | Client/Telegram | Request | Ні | Request timestamps only | Origin/creator incomplete | STANDARD creation event |
| Requests | Assign/reassign manager | NOT_LOGGED | Admin | Request | Ні | Direct update | Core accountability gap | STANDARD old/new manager |
| Requests | Change status | PARTIALLY_LOGGED | Nullable user | Request | old/new status | `RequestStatusHistory` | 10/47 rows без actor; cascade delete | Dual-write central STANDARD event |
| Requests | Add comment | PARTIALLY_LOGGED | Author | Request | Comment only | `RequestComment` | Не mutation diff | Не дублювати body; metadata event за потреби |
| Requests | Change client/company/vehicle/description/equipment | NOT_LOGGED | CRM actor | Request | Ні | Direct updates/actions | Business context lost | STANDARD changed-fields diff |
| Requests | Archive/cancel/delete/reopen/visibility | UNKNOWN | — | — | — | Повний flow не знайдено | Невідоме coverage | Audit при реалізації |
| Requests | Send/open for client | PARTIALLY_LOGGED | Transition actor часто відсутній | Request/items/offers | Status/timestamps | Business models | Немає unified actor event | STANDARD central event |

### Request items

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Request items | Add item | NOT_LOGGED | CRM actor | RequestItem | Ні | Item create | Немає accountability | STANDARD snapshot |
| Request items | Edit number/manufacturer/qty/non-price fields | NOT_LOGGED | CRM actor | RequestItem | Ні | Item update | Diff lost | STANDARD changed-fields diff |
| Request items | Change price/VAT | NOT_LOGGED | CRM actor | RequestItem | Ні | Item update | Financial change invisible | FINANCIAL_CRITICAL diff |
| Request items | Delete item | NOT_LOGGED | CRM actor | RequestItem | Ні | Delete | Record and history lost | Audit old snapshot before delete |
| Request items | Visibility/send/resend for approval | NOT_LOGGED | CRM actor | RequestItem/Request | Status fields only | Item/request state | Actor missing | STANDARD event |
| Request items | Client approve/reject | PARTIALLY_LOGGED | Client implied | RequestItem | Status/timestamps | Item fields | Actor event missing | STANDARD central event |
| Request items | Edit after approval | UNKNOWN | — | — | — | Rule depends on action path | Integrity risk | Explicitly audit or forbid |

### Documents

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Documents | Request document upload | PARTIALLY_LOGGED | `uploadedById` | RequestDocument | Ні | Provenance field | Не central audit | STANDARD event |
| Documents | Owner/vehicle document upload | LOGGED | CRM actor | Company/User/Vehicle | Metadata/new | `AuditLog` | Payload неуніфікований | STANDARD safe snapshot |
| Documents | Replace/rename | NOT_LOGGED | CRM actor | Document | Ні | Update path | History lost | STANDARD diff |
| Documents | Visibility change | LOGGED for owner/vehicle; NOT_LOGGED for request | CRM actor | Owner/Vehicle/Document | Частково | `AuditLog` | Uneven coverage | Уніфікувати entity Document |
| Documents | Download/view | NOT_LOGGED | CRM/client | Document | Ні | Protected file route | Sensitive read invisible | Critical-read PAGE_VIEW, 30 days |
| Documents | Delete | LOGGED for owner/vehicle; NOT_LOGGED for request | CRM actor | Document/owner | Частково | Mixed | Deleted file context may be incomplete | Snapshot safe filename/type before delete |
| Documents | Attach to invoice/offer | UNKNOWN | — | — | — | Окремий flow не знайдено | Coverage unknown | Audit if attachment feature exists |

### Commercial offers

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Commercial offers | Create | PARTIALLY_LOGGED | `createdById` | CommercialOffer | Initial snapshot | Offer model | Не central event | FINANCIAL_CRITICAL creation event |
| Commercial offers | Edit items/sums/VAT/metadata | NOT_LOGGED | CRM actor | Offer | Ні | Direct updates | Financial diff lost | FINANCIAL_CRITICAL before/after |
| Commercial offers | Send/resend | PARTIALLY_LOGGED | Actor не збережений | Offer | Status/timestamps | Offer fields | Who sent unknown | FINANCIAL_CRITICAL event |
| Commercial offers | Client approve/reject | PARTIALLY_LOGGED | Client implied | Offer | Status/timestamps | Offer fields | Actor/event context missing | FINANCIAL_CRITICAL event |
| Commercial offers | Cancel | PARTIALLY_LOGGED | Actor not persisted | Offer | Status only | Offer fields | Accountability gap | FINANCIAL_CRITICAL event |
| Commercial offers | Delete draft | NOT_LOGGED | CRM actor | Offer | Ні | Delete | Financial record disappears | Audit snapshot before delete |
| Commercial offers | Reopen | UNKNOWN | — | — | — | Flow не знайдено | Unknown | Audit if implemented |

### Invoices

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Invoices | Create | PARTIALLY_LOGGED | `createdById`/role | Invoice | Stored invoice snapshots | Invoice | Не central event | FINANCIAL_CRITICAL create event |
| Invoices | Edit items/sums/VAT | UNKNOWN | — | — | — | Explicit edit flow не знайдено | Future critical gap | Audit before enabling |
| Invoices | Send | PARTIALLY_LOGGED | Role, не user ID | Invoice | Status/timestamp | Invoice | Конкретний manager невідомий | FINANCIAL_CRITICAL actor event |
| Invoices | Mark paid | PARTIALLY_LOGGED | Role, не user ID | Invoice | Status/timestamp | Invoice | Критична дія без user identity | FINANCIAL_CRITICAL actor + diff |
| Invoices | Cancel | PARTIALLY_LOGGED | Role, не user ID | Invoice | Status/timestamp | Invoice | Те саме | FINANCIAL_CRITICAL actor + diff |
| Invoices | View/print/PDF/download | NOT_LOGGED | CRM/client | Invoice | Ні | Protected page/file | Sensitive read invisible | Critical-read PAGE_VIEW, 30 days |
| Invoices | Delete | UNKNOWN | — | — | — | Delete flow не знайдено | Не підтверджено | Заборонити або audit snapshot |
| Invoices | Seller/buyer/payment details change | NOT_LOGGED | CRM actor | Billing details/Invoice | Ні | Billing upsert/snapshot | Financial identity change invisible | FINANCIAL_CRITICAL diff |

### Vehicles

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vehicles | Create | LOGGED | CRM/client | Vehicle | New snapshot | `AuditLog` | Generic action name | Typed action + STANDARD |
| Vehicles | Edit | LOGGED | CRM/client | Vehicle | Changed data | `AuditLog` | Payload contract differs by path | Shared sanitized diff |
| Vehicles | Change owner/company | LOGGED | Admin | Vehicle | Owner before/after | `AuditLog` | IDs hidden in UI metadata | Show resolved context |
| Vehicles | Archive via change request | LOGGED | Requester/reviewer | Vehicle/ChangeRequest | old/new | Both models + audit | Distributed records | Preserve links/snapshot |
| Vehicles | Restore/delete | UNKNOWN | — | — | — | Flow не знайдено | Unknown | Audit if implemented |
| Vehicles | Photo upload/primary/reorder/delete | LOGGED | CRM/client | Vehicle | Частково metadata | `AuditLog` | No full image snapshot in all paths | STANDARD concise metadata |
| Vehicles | Link/unlink request | NOT_LOGGED | CRM actor | Request/Vehicle | Ні | Request update | Relationship change invisible | STANDARD old/new vehicle |

### Change requests

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Change requests | Create | LOGGED | Requester | ChangeRequest/target | JSON old/new | Both models | Good base | Add snapshots/category |
| Change requests | Cancel | LOGGED | Requester | ChangeRequest | status/context | `AuditLog` | — | STANDARD |
| Change requests | Approve/reject | LOGGED | Reviewer | ChangeRequest/target | JSON old/new | Both models | Reviewer relation may SetNull | Actor snapshot |
| Change requests | Apply change | LOGGED | Reviewer/system context | Target | old/new | `AuditLog` | Auto/manual distinction in metadata | Typed source field |
| Change requests | Change reviewer | UNKNOWN | — | — | — | Flow не знайдено | Unknown | Audit if enabled |

### Telegram

| Module | Action | Status | Actor | Entity | Before/After | Current model | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Telegram | Link Telegram user / confirm phone | PARTIALLY_LOGGED | Client identity | ClientProfile | Link fields only | ClientProfile | No event/history | STANDARD safe link event, no raw codes |
| Telegram | Create request | NOT_LOGGED | Client/Telegram | Request | Ні | Request create | Origin not centrally auditable | STANDARD origin event |
| Telegram | Select vehicle | PARTIALLY_LOGGED | Client implied | Draft/Request | Draft state | TelegramDraftRequest | Draft expires/is mutable | Audit only final business event |
| Telegram | Upload files | PARTIALLY_LOGGED | Client implied | Draft/RequestDocument | File records | Draft/document | No unified event | Audit final attach, not each message |
| Telegram | Duplicate protection | PARTIALLY_LOGGED | System | Request/draft | Idempotency fields | Workflow logic | No durable audit outcome | TECHNICAL event only on blocked duplicate |
| Telegram | Creation error/webhook error | NOT_LOGGED | System | Correlation only | Ні | Runtime logs | Not queryable as CRM history | TECHNICAL aggregate/event without secrets |

## 8. Before/after coverage

`AuditLog.oldValue` і `newValue` та `ChangeRequest.oldValue`/`newValue` мають тип Prisma `Json?`. Payload не має єдиного schema/version contract: одні callers передають цілий normalized snapshot, інші лише changed fields, а частина подій кладе контекст тільки у metadata. Vehicle flow вже має reusable snapshot/diff helpers; їхній підхід можна узагальнити, але не можна сліпо перетворити на універсальний object dump.

`lib/audit-log/presentation.ts` приховує від UI ключі, схожі на password/token/secret/session ID, але writer-side sanitization відсутня. Отже невідомий або нестандартно названий secret/PII може бути записаний. Поточні audited call sites не передають password hashes, reset tokens чи Telegram bot token, але old/new містять персональні та business identifiers. Потрібен allowlist serializer per event, payload version і size limit; UI masking не є security boundary.

## 9. Security and immutability

- MANAGER може читати `/admin/audit-log`, бо використано `requireCrmSession`, а nav item присутній для CRM roles.
- Manager не може створити довільний audit record через public route: окремого create API немає. Він створює записи лише опосередковано через дозволені business actions.
- Application update/delete service, UI та API для `AuditLog` не знайдено.
- DB-level append-only guarantee немає. DB owner, Prisma Studio або internal script можуть update/delete rows.
- Business records не каскадно видаляють `AuditLog`; nullable relations стають `NULL`. Це краще за cascade, але snapshot gap лишається.
- Для MVP: один server-only append service, заборона application update/delete, review усіх прямих Prisma writes, separate cleanup function, least-privilege DB role для app. DB trigger/permissions бажані для stronger tamper resistance, але не потрібна складна event-sourcing система.
- Retention cleanup має бути єдиним дозволеним delete path, логувати лише агрегований результат без payload/PII.
- Продуктове рішення: або журнал тільки ADMIN, або MANAGER бачить лише власні/дозволені records. Поточний повний CRM read для MANAGER слід вважати ризиком конфіденційності.

## 10. Neon data audit

Read-only SELECT audit виконано 2026-07-22 без виведення PII та без database writes.

| Metric | Result |
| --- | ---: |
| `AuditLog` total | 21 |
| Oldest / newest | 2026-07-09 07:08:13Z / 2026-07-22 07:54:37Z |
| Without actor | 0 |
| With old / with new | 7 / 17 |
| Exact duplicate groups | 0 |
| Records by currently disabled manager | 2 |
| `RequestStatusHistory` total / without actor | 47 / 10 |
| `ChangeRequest` | 1 `PENDING` |

`AuditLog` by action: `ENTITY_UPDATED` 16, `MANAGER_INVITATION_CREATED` 2, `MANAGER_ACTIVATED` 2, `CHANGE_REQUEST_CREATED` 1. By entity: `VEHICLE` 9, `USER` 6, `MANUFACTURER` 3, `EQUIPMENT_TYPE` 2, `CHANGE_REQUEST` 1. Daily volume за чотири дні з records: 1, 10, 8, 2; вибірка надто мала для capacity forecast.

Business context counts: 31 requests, 18 request items, 1 request document, 14 commercial offers, 7 invoices, 13 comments. Нуль central invoice/offer/request events на фоні цих records підтверджує coverage gap, але не доводить, що кожен record проходив manager mutation.

## 11. Retention classification proposal

| Retention class | Строк | Events |
| --- | --- | --- |
| `TECHNICAL` / `LOGIN` / `PAGE_VIEW` | 30 днів | login success/failure/logout, permission denied, session/security validation, critical page/read/download, webhook/API technical outcome, blocked duplicate |
| `STANDARD` | 45 днів | team lifecycle, client/company/request/vehicle non-financial changes, assignment/status, documents, change requests, non-price item changes |
| `FINANCIAL_CRITICAL` | 4 календарні місяці | offer/invoice create/edit/send/approve/reject/cancel/paid/delete, item price/VAT, seller/buyer/payment details, будь-яка дія, що змінює суму або оплату |

Неоднозначні events:

- Request item change є `STANDARD`, але price/VAT/discount/currency/total — `FINANCIAL_CRITICAL`.
- Commercial offer creation і final approval — `FINANCIAL_CRITICAL`, навіть якщо сума ще не оплачена.
- Document event — `STANDARD`; invoice/offer PDF read — `PAGE_VIEW`, а видалення фінансового документа — `FINANCIAL_CRITICAL`.
- Change request успадковує найсуворіший retention class цільової зміни.
- Team disable може бути `STANDARD`; denied login після disable — `LOGIN`.

## 12. Retention implementation feasibility

`createdAt` та його single-column index вже є, тому один загальний cutoff технічно можливий. Різні строки зараз надійно реалізувати не можна: category/retention class відсутні, а mapping за `action` + `metadata.event` буде крихким.

Рекомендація: зберігати і semantic `category`, і immutable `retentionClass`, а також `expiresAt`. `retentionClass` фіксує policy bucket на момент write; `expiresAt` точно представляє «4 календарні місяці» через calendar arithmetic і спрощує indexed chunk delete. Одного `category` недостатньо, якщо category та retention не мають 1:1 mapping або policy зміниться.

Cleanup не зачепить business records, бо видаляється child `AuditLog`; потрібні batches за `(expiresAt, id)`, короткі transactions та limit. Vercel cron config у repo не знайдено. Документація згадує майбутній VPS cron, але production VPS cron policy/config у repo не зафіксовано.

## 13. Page view logging recommendation

Рекомендація: не логувати всі page views. Це створить шум, write amplification, швидке зростання та події від prefetch/refresh без пропорційної audit value.

Логувати лише critical reads:

- request detail;
- client/company detail із персональними або billing data;
- invoice detail/print/PDF/download;
- protected document download;
- audit/team activity view за потреби compliance.

Такі events належать до `PAGE_VIEW`, 30 днів, без query secrets і без document URL. Middleware бачить route/JWT, але не повинен робити DB lookup; надійний actor/entity context краще писати у server page/service або protected download route після authorization.

## 14. UI feasibility

Майбутній ADMIN-only route `/admin/team/[userId]/activity` можливий за `actorId`; для hard-deleted actor потрібен snapshot fallback. Загальний журнал потребує server-side pagination і filters: manager, snapshot role, date range, category, action, entity type/ID або request number, critical only.

Потрібні indexes за actor/date, category/date, entity/date, retention cleanup. Current 200-row page не масштабується та не дає повної історії. Inactive managers можна показати зараз, поки `User` збережений; після hard delete — лише після snapshot migration для нових events. Existing mobile/desktop presentation може бути основою, але reusable filter/pagination component фактично треба додати.

## 15. Gaps and risks

1. Відсутнє coverage для invoice/offer financial transitions та item price/VAT.
2. Request assignment і більшість request mutations не логуються.
3. Company membership/billing changes не логуються.
4. Central log не містить immutable actor snapshot.
5. Generic `ENTITY_UPDATED` + free-form `metadata.event` ускладнює policy, filtering і analytics.
6. Writer-side secret/PII allowlist та payload version відсутні.
7. `RequestStatusHistory` має 10/47 rows без actor і cascade від Request.
8. `ChangeRequest.requestedBy` cascade робить workflow history залежною від User lifetime.
9. MANAGER читає весь audit list; продуктова політика не зафіксована.
10. DB-level tamper protection і idempotency key відсутні.
11. Retention classification та cleanup path відсутні.
12. Немає pagination/filter/export і critical-read logging.

## 16. Recommended implementation stages

| Stage | Scope | Dependencies / migration | Risk | Complexity | Commit |
| --- | --- | --- | --- | --- | --- |
| Admin Audit Log 2 — Data model and append-only service | category, retention, snapshot, context, serializer, service contract | Additive migration + backfill policy | PII/schema decisions | Medium | Separate |
| Admin Audit Log 3 — Critical CRM action coverage | invoices, offers, price/VAT, requests, items, companies, documents | Stage 2 API | Missed transaction paths/double logging | High | Separate, possibly by module |
| Admin Audit Log 4 — Team activity page and filters | ADMIN activity route, pagination, filters, resolved entities | Stage 2 indexes + Stage 3 data | Authorization/data exposure | Medium | Separate |
| Admin Audit Log 5 — Auth/security events | login/denied/logout/revoke, critical reads | Privacy/HMAC/IP policy | Credential enumeration/PII | Medium | Separate |
| Admin Audit Log 6 — Retention cron and cleanup | chunked expiry delete, metrics, dry run/runbook | `expiresAt`, scheduler decision | Over-delete/locking | Medium | Separate |
| Admin Audit Log 7 — QA and security review | coverage regression, role matrix, tamper/retention tests | Stages 2–6 | False confidence | Medium | Separate |

Session invalidation itself уже працює; Stage 5 має додати audit visibility, а не переписувати JWT revocation без окремої причини.

## 17. Suggested Prisma changes

Орієнтовний additive design, не реалізований у цьому етапі:

```prisma
enum AuditCategory {
  TECHNICAL
  LOGIN
  PAGE_VIEW
  STANDARD
  FINANCIAL_CRITICAL
}

enum AuditRetentionClass {
  DAYS_30
  DAYS_45
  CALENDAR_MONTHS_4
}

model AuditLog {
  // existing fields remain
  category        AuditCategory
  retentionClass  AuditRetentionClass
  expiresAt       DateTime
  actorName       String?
  actorEmail      String?
  actorRole       UserRole?
  actorKind       String?
  requestId       String?
  correlationId   String?
  payloadVersion  Int @default(1)
  idempotencyKey  String? @unique
}
```

`ip`/`userAgent` не слід автоматично додавати до всіх business events. Для LOGIN/PAGE_VIEW краще зберігати privacy-reviewed `ipHash`/prefix та bounded `userAgent`, якщо є затверджена потреба. Backfill historical snapshot неможливий після вже видаленого actor; для існуючих relation-backed rows можна одноразово snapshot-нути current values після окремого approval.

## 18. Suggested indexes

```text
@@index([actorId, createdAt, id])
@@index([actorEmail, createdAt, id])       // snapshot fallback, якщо дозволено policy
@@index([category, createdAt, id])
@@index([entityType, entityId, createdAt, id])
@@index([requestId, createdAt, id])
@@index([expiresAt, id])                   // cleanup cursor
@@index([retentionClass, expiresAt, id])   // optional operational metrics/cleanup
```

Не додавати всі можливі комбінації наперед: остаточний набір має спиратися на query plan майбутніх UI filters. `idempotencyKey` unique потрібен лише там, де event може повторитися через retry; service може дозволяти nullable key.

## 19. Suggested cron strategy

1. Один daily VPS cron або Vercel Cron endpoint із secret-authenticated ADMIN/system access; вибрати відповідно до фактичного production hosting.
2. Спочатку dry-run aggregate за `expiresAt < now()` без PII.
3. Delete chunks, наприклад 500–1000 rows, за ordered `(expiresAt, id)` у коротких transactions.
4. Обмежити кількість batches за один запуск, повторювати до нуля.
5. Метрики: scanned/deleted per retention class, duration, failures; не логувати payload.
6. Cleanup service — єдиний application delete path; окремий DB role/permission за можливості.
7. Runbook з rollback expectations: expired audit deletion є навмисно незворотною, тому перед first production run потрібні backup/restore policy та dry-run approval.

Cron не створено і records не видалялися.

## 20. Estimated implementation scope

- Stage 2 model/service: 2–4 developer days плюс migration review.
- Stage 3 critical action coverage: 5–9 days, бо mutations розподілені між server actions/services/API й потрібні transactional tests.
- Stage 4 UI: 3–5 days.
- Stage 5 auth/critical reads: 2–4 days із privacy review.
- Stage 6 retention: 2–3 days плюс operations approval.
- Stage 7 QA/security: 3–5 days.

Загалом: приблизно 17–30 developer days залежно від depth regression/E2E та рішень щодо actor/IP/PII. Найвища складність — фінансове coverage і гарантія exactly-once/transactional logging.

## 21. Blockers

Перед Stage Admin Audit Log 2 потрібно затвердити:

1. Чи є journal ADMIN-only, чи MANAGER бачить власні/обмежені records.
2. Поля actor snapshot і правила для historical inactive/deleted users.
3. Allowlist PII у before/after та заборонені secrets.
4. Category/retention mapping для неоднозначних item/document/change-request events.
5. `expiresAt` як source of truth для 4 calendar months.
6. Application-only append protection чи додаткові DB permissions/trigger.
7. Hosting scheduler: VPS cron або Vercel Cron; production runbook/backup policy.
8. Чи потрібен audit history довше за затверджені 30/45 days/4 months для legal/accounting вимог.

Технічного blocker для additive Stage 2 немає, але без цих рішень schema/API contract буде нестабільним.

## 22. Final recommendation

Переходити до Stage Admin Audit Log 2 лише після затвердження blockers вище. Не будувати нову event-sourcing platform: розширити чинний `AuditLog`, зробити один typed append-only service із allowlisted serializers, додати immutable actor snapshot і deterministic expiry, а потім покривати critical actions transactionally.

Перший пріоритет Stage 3: invoices, commercial offers, request item price/VAT, billing details, manager assignment, request/item create-update-delete. Другий — company membership, documents і auth/critical reads. UI та retention cleanup мають іти після стабілізації write contract.

### Git baseline цього аудиту

- Branch: `main`.
- Start HEAD: `a0cb83d` (`Add names to fleet vehicles`), branch була ahead `origin/main` на 1 commit.
- Working tree на старті аудиту не був чистим: сторонні/незакомічені `lib/site-contacts.ts` і generated/adjacent `next-env.d.ts`; вони не змінювалися і не включаються у цей commit.
- `git diff --check` до звіту: PASS; були лише line-ending warnings у сторонніх файлах.
- Relevant recent commits: `a0cb83d` vehicle names; `78e4db9`, `2d675b7`, `ec20a22`, `10de895`, `fd533b8`, `645912a`, `5dcc26d`, `201d7a9`, `40c73f9` — inspected as recent repository history together with feature-specific docs/migrations.
- Push у межах етапу не виконується.
