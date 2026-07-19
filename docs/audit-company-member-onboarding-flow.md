# Audit: company member onboarding flow

Дата аудиту: 19.07.2026
Режим: audit-only, без змін production code, UI, Prisma schema або migrations.

## 1. Executive summary

Поточний self-service flow для додавання клієнтом іншого користувача до своєї компанії **відсутній**.

Фактичний підтримуваний сценарій є assisted onboarding через CRM:

1. Користувач Б самостійно реєструється як `CLIENT`.
2. `ADMIN` або `MANAGER` відкриває `/admin/companies/[id]`.
3. CRM-користувач вибирає вже зареєстрованого, ще не прив'язаного до компанії `CLIENT` зі списку.
4. Server action створює `CompanyMember`.
5. Після наступного server render користувач Б отримує company scope.

Invitation token, email/Telegram invitation, accept-invite flow і клієнтський UI керування учасниками відсутні. `CompanyMember` не має внутрішньої ролі: всі учасники компанії мають однаковий company-level access. Ознака `isPrimaryContact` є контактною перевагою, а не permission role.

## 2. Prisma structure

### User

`User` має глобальну роль `CLIENT`, `MANAGER` або `ADMIN`, один optional `ClientProfile` і relation `companyMemberships`.

Джерело: `prisma/schema.prisma:143-174`.

### ClientProfile

`ClientProfile` належить одному `User` через `userId @unique`. Поля `companyName` і `taxId` є текстовими даними профілю та не створюють relation до `Company`. Поля `companyId` у `ClientProfile` немає.

Джерело: `prisma/schema.prisma:213-233`.

### Company

`Company` має relations до `members`, `requests`, `vehicles`, `documents`, `changeRequests`, `auditLogs`, `invoices` і billing details. Окремого `primaryContactId` немає.

Джерело: `prisma/schema.prisma:235-255`.

### CompanyMember

`CompanyMember` містить:

- `companyId`;
- `userId`;
- `isPrimaryContact`;
- `createdAt`;
- `updatedAt`.

Модель не містить `role`, `permissions`, `ownerId`, `invitedById` або invitation state.

Джерело: `prisma/schema.prisma:365-378`.

## 3. CompanyMember relations

- Одна `Company` може мати багато `CompanyMember`.
- Комбінація `companyId + userId` унікальна через `@@unique([companyId, userId])`.
- `userId` окремо унікальний через `@@unique([userId])`.
- Отже, один `User` фактично може бути учасником лише однієї `Company`.
- Повторне додавання того самого user до тієї самої або іншої компанії блокується schema і додатковою action-перевіркою.
- Видалення `User` або `Company` каскадно видаляє membership.

Зауваження: назва relation `companyMemberships` у `User` виглядає як множина, але unique constraint на `userId` реалізує модель "не більше однієї компанії на user".

## 4. Internal company roles

Внутрішніх ролей компанії немає. Усі members є глобальними `CLIENT` users і рівноправні в company scope.

`isPrimaryContact`:

- не перевіряється в `getClientAccessContext`;
- не впливає на `requestAccessWhere`, `vehicleAccessWhere` або `documentAccessWhere`;
- використовується як preferred contact, зокрема для вибору Telegram-одержувача повідомлення про позиції заявки;
- використовується як fallback контактної особи у billing UI.

Тому primary contact **не є owner/admin компанії** і не має додаткових authorization permissions.

## 5. Current admin UI

Фактичний UI entry point:

`/admin/companies/[id]`

Сторінка:

- показує список учасників;
- дозволяє встановити primary contact;
- дозволяє прибрати учасника;
- дозволяє додати існуючого `CLIENT` через select за `userId`;
- не має поля запрошення за email або телефоном;
- не створює нового user.

Список кандидатів містить тільки users із `role = CLIENT`, які не мають membership, відсортованих від нових до старих, максимум 100 записів.

Джерела: `app/admin/companies/[id]/page.tsx:50-99`, `app/admin/companies/[id]/page.tsx:201-251`.

Практичне обмеження: старий unlinked client, який не потрапив у перші 100 записів, не може бути знайдений через цей UI, бо пошуку за email/телефоном немає.

## 6. Current client UI

У client cabinet немає:

- company settings;
- списку учасників;
- кнопки "Додати учасника";
- кнопки "Запросити учасника";
- керування primary contact;
- видалення member.

Навігація містить dashboard, заявки, парк техніки, документи, запити на зміну та профіль. Сторінка профілю лише показує контактні дані.

Джерела: `app/client/layout.tsx:43-50`, `app/client/profile/page.tsx:20-45`.

**Чи може клієнт самостійно додати менеджера своєї компанії? Ні.**

## 7. Registration flow

`registerClient`:

1. приймає business або individual registration data;
2. перевіряє унікальність email/phone;
3. створює `User` із глобальною роллю `CLIENT`;
4. вкладено створює `ClientProfile`;
5. перенаправляє на login і зберігає safe `next` route.

Registration не:

- створює `Company`;
- створює `CompanyMember`;
- приймає `companyId`;
- шукає попереднє запрошення;
- приєднує до існуючої компанії.

Навіть business registration з `companyName` створює лише текстове поле `ClientProfile.companyName`, а не company relation.

Джерело: `app/(auth)/actions.ts:43-112`.

## 8. Invitation flow presence/absence

Invitation flow відсутній.

У schema та application code не знайдено:

- `CompanyInvitation`;
- `InviteToken`;
- `invitedEmail`;
- `invitedById`;
- `acceptedAt`;
- invite/accept actions;
- expiration/status запрошення.

Ручне створення `CompanyMember` через CRM не є invitation flow: зв'язок активується одразу, без згоди або підтвердження користувача Б.

## 9. Current server actions/API

### Додавання

`addCompanyMember`:

- викликає `requireCrmSession`;
- приймає `companyId`, `userId`, `isPrimaryContact`;
- перевіряє існування Company;
- перевіряє, що User має глобальну роль `CLIENT`;
- перевіряє відсутність будь-якого existing membership;
- optional скидає попередній primary contact;
- створює тільки `CompanyMember`.

Action не створює `User`, `ClientProfile` або invitation.

Джерело: `app/admin/company-actions.ts:122-176`.

### Видалення та primary contact

`removeCompanyMember` видаляє relation за одночасно scoped `memberId + companyId`.
`setPrimaryCompanyMember` перевіряє membership у company, скидає primary flag для всіх і встановлює його вибраному member.

Джерело: `app/admin/company-actions.ts:178-223`.

### Ролі, які можуть викликати actions

`requireCrmSession` дозволяє `MANAGER` і `ADMIN`. Отже, обидві глобальні staff roles можуть створювати, видаляти й призначати company members.

Джерело: `lib/admin/access.ts:7-21`.

`CLIENT` не може викликати ці actions через штатний session guard, навіть якщо підмінить hidden `companyId` або `userId`.

## 10. Exact current flow for adding another user

Сценарій: клієнт А має company account, потрібно додати користувача Б.

Фактичний flow:

1. Користувач Б відкриває `/register` і реєструється як `CLIENT`.
2. Реєстрація створює `User + ClientProfile`, але ще не дає company access.
3. `ADMIN` або `MANAGER` відкриває `/admin/companies/[companyId]`.
4. У блоці "Додати CLIENT user" staff вибирає Б зі списку unlinked clients.
5. За потреби staff ставить `isPrimaryContact`.
6. `addCompanyMember` створює relation `CompanyMember(companyId, userId)`.
7. На наступному server request/render `getClientAccessContext` бачить membership і повертає `mode = COMPANY`.
8. Користувач Б входить або оновлює client cabinet і отримує company scope.

Клієнт А не має кроку в цьому flow. Якщо користувач Б ще не зареєстрований, CRM не може додати його.

## 11. Requirements for the new user before linking

Користувач Б повинен:

- уже мати `User`;
- мати глобальну роль `CLIENT`;
- мати `ClientProfile` для працездатного client cabinet;
- не бути учасником іншої Company.

Email не потрібно попередньо allowlist-ити. Invitation token не існує. CRM action додає за `userId`, а не за email/phone.

## 12. Access received after linking

`getClientAccessContext` бере membership і формує `companyId`. Права визначаються не ownership конкретного member, а shared `companyId`.

Новий member отримує:

- перегляд усіх company requests;
- перегляд усіх company vehicles;
- перегляд company documents і документів пов'язаних company requests/vehicles;
- перегляд visible request items і request documents;
- доступ до sent commercial offers у доступних company requests;
- доступ до sent/paid та раніше sent cancelled invoices у доступних company requests;
- можливість погоджувати client-visible позиції та commercial offers у company requests;
- можливість створювати нові requests із `companyId` поточної компанії;
- можливість створювати та напряму редагувати company vehicles;
- можливість створювати ChangeRequest для доступних entities згідно з поточними allowlists.

Водночас member також продовжує бачити власні personal requests/vehicles із `companyId = null`.

Джерела: `lib/client/access.ts:41-122`, `app/api/requests/route.ts:93-148`, `app/client/vehicles/actions.ts`, `app/client/actions.ts`, `lib/commercial-offers/service.ts:238-280`, `lib/invoices/service.ts:335-365`.

## 13. Shared resource visibility

| Ресурс | Видимість новому member | Умова |
|---|---|---|
| Заявки | Так | `request.companyId = access.companyId` |
| Парк техніки | Так | `vehicle.companyId = access.companyId` |
| Загальні документи | Так | Company relation або relation через company request/vehicle |
| Документи заявки | Так, тільки client-visible | `visibleToClient = true` і доступна request |
| Commercial offers | Так, коли надіслані | Offer належить доступній request; DRAFT не є client flow |
| Invoices | Так, коли надіслані/оплачені | Invoice належить доступній request; cancelled видимий лише якщо раніше був sent |
| ChangeRequests | Так, company-scoped | Client query повертає company requests плюс власні |
| Загальний AuditLog | Backend query підтримує company scope, але client UI/route відсутній | У client nav немає журналу дій |

Отже, member бачить ресурси, створені іншим member, якщо вони мають той самий `companyId`. Foreign company resources блокуються access predicates.

## 14. Primary contact behavior

Primary contact:

- є Boolean flag на membership;
- не є власником компанії;
- не може сам керувати members;
- не має ширших read/write permissions;
- пріоритетно використовується як контакт/одержувач у деяких operational flows;
- може бути змінений лише через CRM action `setPrimaryCompanyMember`.

DB не має partial unique constraint "лише один primary на company". Application transaction намагається підтримувати один primary, але прямі/concurrent writes теоретично можуть порушити інваріант.

## 15. ChangeRequest relation

ChangeRequest backend підтримує company scope:

- member може створювати request для entity своєї Company;
- `companyId` записується з trusted access context, а не з client input;
- company members бачать company ChangeRequests;
- лише автор власного pending request може його скасувати;
- approval застосовує allowlisted зміни для Request, RequestItem та Vehicle.

Але твердження "усі зміни йдуть через ChangeRequest" не відповідає фактичному коду:

- vehicle create і vehicle update виконуються напряму;
- погодження позицій та offers виконується напряму;
- створення request виконується напряму;
- company/member administration виконується напряму staff actions.

Крім того, validation дозволяє entity types `COMPANY` і `COMPANY_PROFILE`, але automatic apply не має реалізації цих entity types. Такий request можна створити, проте approve поверне unsupported apply. Це незавершена частина workflow.

Джерела: `lib/change-requests/service.ts`, `lib/change-requests/apply.ts`, `app/client/vehicles/actions.ts`, `app/client/actions.ts`.

## 16. Security checks

### Наявні захисти

- Client не може штатно створити membership: server action вимагає `MANAGER` або `ADMIN`.
- Підміна `companyId` у client resource URL не дає foreign access через trusted access context і company-scoped predicates.
- Додати можна тільки існуючий `CLIENT` user.
- User, який уже має membership, відхиляється.
- Duplicate membership блокується action і DB unique constraints.
- Видалення/primary update scope-яться одночасно `memberId + companyId`.

### Ризики та прогалини

1. `MANAGER` має ті самі company/member administration actions, що й `ADMIN`; це може бути ширше за бажану policy.
2. Немає invitation consent: staff може негайно приєднати існуючого CLIENT до компанії.
3. Немає internal member roles; кожен доданий member одразу отримує широкий company scope.
4. `removeCompanyMember` не захищає останнього member або primary contact.
5. Company може існувати без members: `createCompany` не створює membership.
6. Після видалення primary contact система не призначає нового автоматично.
7. Немає DB-level гарантії одного primary contact на company.
8. Add/remove/set-primary actions не створюють AuditLog, тому membership governance не має повної історії.
9. UI не має search і обмежує кандидатів першими 100 users.
10. Немає email/phone verification саме в контексті приєднання до company.
11. Всі members можуть діяти з shared requests/offers/items; немає least-privilege розмежування.
12. Direct vehicle update обходить ChangeRequest approval для shared company vehicle.
13. Client-facing загального company audit history немає.

## 17. Current gaps

Сценарій assisted linking технічно працює, але self-service onboarding не завершений. Відсутні:

- company owner/admin member role;
- invitation lifecycle;
- acceptance by invited user;
- permission policy для members;
- client company settings;
- member management UI;
- safeguards last owner/primary;
- audit events для membership changes;
- searchable CRM linking UI.

## 18. Safe workaround

Найближчий безпечний flow, який реально підтримується кодом:

1. Користувач Б самостійно реєструється через `/register`.
2. Staff перевіряє, що це правильний user і що його потрібно приєднати саме до цієї Company.
3. `ADMIN` або `MANAGER` відкриває `/admin/companies/[id]`.
4. Staff вибирає Б у "Додати CLIENT user" і створює membership.
5. Користувач Б відкриває client cabinet повторно; membership починає діяти на наступному server render.
6. Staff окремо перевіряє, чи потрібно позначити Б primary contact.

Обмеження workaround: якщо Б не потрапляє у dropdown із 100 users, поточний UI не надає безпечного способу знайти його за email/phone. Не слід створювати relation ручним SQL як звичайну операційну процедуру.

## 19. Recommended future flow

Рекомендовано окремо спроєктувати assisted/self-service invitation flow:

1. Додати explicit Company member roles, мінімально `OWNER`/`MEMBER` або `ADMIN`/`MEMBER` у межах Company.
2. Дозволити invite тільки authorized company owner/admin або global ADMIN згідно з погодженою policy.
3. Створювати invitation із normalized email, token hash, expiration, inviter, company, intended role і status.
4. Не створювати active membership до acceptance.
5. Existing user входить і приймає invite; new user проходить register/login і повертається до accept route.
6. Server-side перевіряти email identity, expiration, company state, duplicate membership і current membership conflict.
7. Додати AuditLog для invite/create/accept/revoke/member remove/role change/primary change.
8. Захистити останнього owner/primary та orphan-company scenario.
9. Визначити permission matrix для requests, vehicles, documents, offers, invoices та approvals.
10. Перед rollout вирішити, чи user може входити лише в одну Company або в кілька; поточний `@@unique([userId])` дозволяє лише одну.

## 20. Whether a new feature is needed

**Так, потрібен окремий feature для company member onboarding**, якщо замовник очікує, що клієнт сам додаватиме колегу/менеджера.

Поточний assisted CRM linking можна залишити як адміністративний fallback, але він не замінює invitation flow і не має достатньої permission granularity для self-service відкриття.

## Обов'язкові фінальні відповіді

1. **Чи може клієнт зараз сам додати іншого користувача до компанії?** Ні.
2. **Де саме це робиться?** Тільки у CRM на `/admin/companies/[id]`, у блоці "Додати CLIENT user".
3. **Чи має новий користувач спочатку зареєструватися?** Так, він має вже існувати як `User` із роллю `CLIENT` і мати `ClientProfile`.
4. **Хто зараз може створити CompanyMember?** `ADMIN` і `MANAGER`, тому що action використовує `requireCrmSession`.
5. **Чи є invitation token/email flow?** Ні.
6. **Які права отримує новий member?** Рівноправний company scope для спільних ресурсів та client actions; внутрішньої ролі немає.
7. **Чи бачить він спільні заявки?** Так, усі requests з тим самим `companyId`, плюс власні personal requests.
8. **Чи бачить він спільний парк техніки?** Так, усі vehicles з тим самим `companyId`, плюс власні personal vehicles.
9. **Чи бачить він спільні документи?** Так, company documents та client-visible документи доступних company requests/vehicles.
10. **Чи може він редагувати дані?** Частково так: зокрема може напряму створювати/редагувати company vehicles, погоджувати shared positions/offers та подавати ChangeRequests. Company/member administration йому недоступне.
11. **Чи зміни йдуть через ChangeRequest?** Частина змін так, але не всі; vehicle update, approvals і creation flows виконуються напряму.
12. **Чи є blocker або security gap?** Так: немає invite acceptance, internal roles, last-member safeguards, membership audit і least-privilege policy; MANAGER має широкі member-management права.
13. **Який точний current workaround?** Б сам реєструється, після чого ADMIN або MANAGER вручну додає його як existing CLIENT через `/admin/companies/[id]`.
14. **Який flow рекомендовано реалізувати надалі?** Tokenized invitation + acceptance, verified identity, company roles/permission matrix, audit log і last-owner safeguards.

## Перевірки аудиту

- Production code: не змінювався.
- Prisma schema: не змінювалася.
- Migration: не створювалася.
- Invitation symbols scan: відповідної моделі/actions не знайдено.
- `git diff --check`: виконується після створення цього report.
- Build/typecheck: не обов'язкові для Markdown-only зміни; production code не редагувався.
