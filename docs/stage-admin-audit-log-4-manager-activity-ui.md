# Stage Admin Audit Log 4 — Manager Activity Page and Audit Log UI

## 1. Executive summary

Stage 4 перевів журнал дій із широкої технічної таблиці у компактний ADMIN-only read-side інтерфейс. Додано server-side filters, pagination по 25 записів, окрему сторінку події, структуроване відображення змін і історію конкретного працівника.

Prisma schema, append-only writer, retention policy та CRM business actions не змінювалися. Нова migration не потрібна.

## 2. Routes

- оновлено `/admin/audit-log`;
- створено `/admin/audit-log/[id]`;
- створено `/admin/team/[userId]/activity`;
- у `/admin/team` додано дію `Переглянути історію`.

Detail links ведуть на канонічний `/admin/audit-log/[id]`. Після hard delete працівника його route за `userId` більше не існуватиме, але записи залишаться у загальному журналі через actor snapshots.

## 3. Access control

Кожна з трьох read pages викликає `requireAdminSession()` до query. `/admin/audit-log` також додано до `ADMIN_ONLY_ROUTE_PREFIXES`; navigation уже приховувала `Журнал дій` і `Команда` від `MANAGER`.

`MANAGER` не отримує UI, query або direct URL access. Окремий JSON endpoint не створювався.

## 4. General audit log UI

Desktop-таблиця залишає шість колонок:

- дата;
- виконавець;
- дія;
- категорія;
- об’єкт;
- деталі.

`ChangeRequest`, raw old/new, metadata, повний entity ID, IP та User Agent перенесені у detail page. Таблиця не має примусового `min-width`; до `lg` використовується card presentation, тому стара причина horizontal overflow усунена.

Actor показує snapshot name, fallback на current user name, snapshot email або `Системна дія`. Current status додається з relation у тому самому query, без N+1.

## 5. Filters

GET form підтримує:

- пошук за `actorName`, `actorEmail`, `entityLabel`, `entityId` та точним machine action;
- виконавця;
- категорію;
- тип об’єкта;
- дію;
- inclusive `Дата від` / `Дата до`;
- shareable quick filter `Лише критичні дії`;
- reset.

Search trim-иться та обмежується 120 символами. Enum values перевіряються проти чинних contracts. Invalid dates і page values нормалізуються. `Лише критичні дії` об’єднує `FINANCIAL_CRITICAL` і `CRITICAL_READ`.

JSON-поля не беруть участі у search.

## 6. Pagination

Page size зафіксовано на 25. Query виконує `count`, нормалізує page, а потім використовує database `skip/take`.

Sorting стабільний:

```text
createdAt DESC
id DESC
```

Previous/next links зберігають усі filters. Page понад останню сторінку показує останню валідну сторінку; invalid або від’ємний page — першу.

## 7. Event detail

`/admin/audit-log/[id]` показує:

- дату і час;
- actor name/email/role/current status;
- user-facing category/action і machine action;
- entity type/label/ID;
- company;
- IP;
- User Agent;
- retention expiry або завершений строк;
- audit event ID;
- old/new diff;
- metadata.

Безпечні links реалізовано для `REQUEST`, `COMPANY`, `CLIENT`, `VEHICLE`, а також для `INVOICE`, `COMMERCIAL_OFFER` і `REQUEST_ITEM`, коли sanitized metadata містить `requestId`. Для типів без фактичного route link не створюється.

## 8. Before/after presentation

Reusable presentation layer:

- зіставляє однакові keys у колонках `Було` / `Стало`;
- виділяє змінені rows;
- мапить фактичні keys Stage 2–3 на українські labels;
- форматує booleans, null, arrays, dates, known financial fields, statuses і roles;
- обрізає надто довгі strings;
- humanize-ить невідомі camelCase/snake_case keys.

Financial formatting застосовується лише до allowlist фінансових keys, а не до довільних numeric strings.

## 9. Manager activity page

`/admin/team/[userId]/activity` доступний для чинних `ADMIN` і `MANAGER` team members, але відкрити його може лише `ADMIN`.

Верх сторінки показує ім’я, email, роль, статус і дату створення. Поля `disabledAt` у поточній schema немає, тому дата вимкнення не вигадується.

Summary cards:

- усього дій;
- стандартні;
- фінансові критичні;
- критичні перегляди;
- остання активність.

Список повторно використовує filters/list/pagination. Actor filter прихований і server query примусово отримує `fixedActorId = userId`; URL-параметр іншого actor не може послабити isolation.

## 10. Team integration

`Переглянути історію` додано для:

- активного менеджера;
- запрошеного менеджера;
- вимкненого менеджера;
- адміністратора, включно з власним account.

Lifecycle actions не змінювалися. Desktop actions використовують wrap; mobile actions stack-яться.

## 11. Responsive behavior

На `lg+` використовується compact table із fixed layout та wrapping. На tablet/mobile використовується semantic card list без wide scroll container.

Filters переходять з 4 колонок на 2 і 1; action buttons та pagination stack-яться. Long email/entity/value fields мають `break-all` або `break-words`, old/new grid переходить у stacked labels.

Авторизований visual QA на 1440/1280/1024/768/390 px заблокований відсутністю локальної ADMIN browser session.

## 12. Performance

General list:

1. `count(where)`;
2. один paginated `findMany` з actor/company/changeRequest includes.

Actor options завантажуються одним query. Manager summary використовує паралельні `count`, `groupBy(category)` та latest event. Category counts не виконуються у loop.

Query paths відповідають наявним indexes:

- `actorId + createdAt`;
- `category + createdAt`;
- `entityType + entityId + createdAt`;
- `createdAt`;
- окремий `action` index.

Search по snapshot/entity text може використовувати PostgreSQL text filtering, але не виконує JSON scan. N+1 немає.

## 13. Backward compatibility

UI має fallback для:

- null actor snapshots;
- видаленого current actor;
- null `entityLabel`;
- unknown action/category/entity labels;
- sparse або null metadata;
- null old/new;
- null company;
- legacy fields і values.

Destructive backfill не виконувався.

## 14. QA

Успішно:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run lint`;
- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `npx.cmd tsx scripts/check-admin-audit-log-4.ts`;
- live unauthenticated direct-route checks: general/detail/activity повертають `307` до staff login.

Targeted script перевіряє access contracts, valid/invalid filters, trim/length/date/page normalization, AND composition, critical category set, stable sorting, pagination source, actor isolation, empty states, presentation fallbacks, formatting і static guards.

Production records script не створює.

## 15. Known limitations

- actor dropdown містить current `ADMIN`/`MANAGER`; snapshot-only actors доступні через search;
- search по action підтримує точний machine identifier, а не full-text search по українському presentation label;
- `disabledAt` відсутній у schema;
- після hard delete працівника individual route зникає, але snapshots залишаються у general log;
- entity link не створюється, якщо немає перевіреного route або sanitized `requestId`.

## 16. Blockers

In-app browser і Chrome не мають локальної ADMIN session та обидва redirect-ять на `/admin/login`. Тому не підтверджені browser interactions filters/pagination/detail, MANAGER session behavior і visual responsive QA під авторизованим користувачем.

Migration blocker відсутній: `npx.cmd prisma migrate status` перед реалізацією показав `Database schema is up to date`.

## 17. Next recommended stage

Перед Stage Admin Audit Log 5 потрібно:

1. виконати авторизований ADMIN/MANAGER browser matrix;
2. підтвердити 1440/1280/1024/768/390 px;
3. перевірити active/disabled/admin/no-events actor cases на staging data.

Stage Admin Audit Log 5 у межах цієї роботи не починався.
