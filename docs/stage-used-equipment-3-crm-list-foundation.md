# Stage Used Equipment 3 — CRM list foundation

## Scope

Реалізовано базову CRM-основу для модуля “Майданчик БВ техніки”:

- додано пункт CRM-навігації `БВ техніка`;
- створено маршрут `/admin/used-equipment/items`;
- додано server-side Prisma query для списку техніки;
- реалізовано пагінацію по 25 записів;
- показано thumbnail або placeholder;
- показано статус, основні дані та кількість заявок;
- додано empty state;
- додано placeholder `/admin/used-equipment/items/new` без форми.

## Access

Сторінки використовують існуючий `requireCrmSession()`, тому доступні тільки ролям `ADMIN` і `MANAGER`.

Прямий доступ для `CLIENT` або guest блокується поточною CRM auth-логікою.

## Query

Дані завантажуються server-side через Prisma:

- model: `UsedEquipment`;
- order: `createdAt desc`, `id desc`;
- pagination: `skip` / `take`;
- page size: `25`;
- image: перше фото за `isPrimary desc`, `sortOrder asc`, `createdAt asc`;
- inquiry count: `_count.inquiries`.

N+1 queries не додаються.

## UI

Desktop використовує CRM table layout.

Tablet/mobile використовує compact card layout, щоб не створювати глобальний horizontal scroll.

Status labels беруться з `lib/used-equipment/status.ts`.

## Placeholder create route

Кнопка `Додати техніку` веде на `/admin/used-equipment/items/new`.

На цьому етапі там показується тільки інформаційний placeholder. Form, upload, Cloudinary, editor, save actions і CRUD не реалізовувались.

## Not included

Не реалізовано:

- створення/редагування техніки;
- Cloudinary upload;
- rich-text editor;
- public catalog/detail;
- inquiry pages;
- filters/search/custom sorting;
- schema або migration changes;
- Stage Used Equipment 4.

## Checks

Виконано:

- `npx.cmd prisma validate` — pass;
- `npm.cmd run typecheck` — pass;
- `npm.cmd run lint` — pass;
- `npm.cmd run build` — pass;
- `git diff --check` — pass, only CRLF warnings for existing Windows checkout files.

Build підтвердив появу маршрутів:

- `/admin/used-equipment/items`;
- `/admin/used-equipment/items/new`.

## Blockers

На рівні цього етапу blockerів у коді немає.

Перед наступним етапом потрібно врахувати, що створення/редагування та upload ще не реалізовані.

## Git note

Перед стартом робоче дерево вже містило unrelated незакомічені зміни контактної форми / contact messages і `prisma/schema.prisma`.

Ці зміни не належать до Stage Used Equipment 3 і не повинні змішуватись із цим commit.
