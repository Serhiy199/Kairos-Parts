# Stage Admin Users 2C — ADMIN-only Team management

## 1. Scope

Додано ADMIN-only керування командою в CRM: перегляд ADMIN/MANAGER, запрошення менеджера, повторна генерація запрошення, вимкнення та повторне увімкнення доступу менеджера.

## 2. Route and navigation

- Новий маршрут: `/admin/team`.
- У sidebar ADMIN бачить пункт `Команда`.
- MANAGER, CLIENT і неавторизований користувач не мають доступу до сторінки або server actions.

## 3. Staff query

Список формується одним server-side Prisma query лише для ролей `ADMIN` і `MANAGER`. Для останнього запрошення використано nested select з `take: 1`, без N+1. `passwordHash`, invitation token/hash та `authVersion` у client props не передаються.

Сортування стабільне: ADMIN першими, далі менеджери за станом, потім за ім'ям/email.

## 4. Create manager

Форма приймає лише ім'я та email і повторно використовує Stage 2B service `createInvitedManager`. Новий користувач створюється як `MANAGER / INVITED`, без пароля. Довільна зміна ролі або перетворення CLIENT у MANAGER не реалізовані.

Конфлікти email мають окремі повідомлення для вже запрошеного менеджера, вимкненого менеджера, активного staff та CLIENT.

## 5. Invitation delivery

Raw invitation URL повертається лише у відповіді create/regenerate action та показується в modal з кнопкою копіювання. URL не зберігається у UI після закриття modal або refresh, не логуються і не потрапляє до спискового query.

## 6. Invitation regeneration

Повторна генерація доступна лише для `MANAGER / INVITED` без пароля. Existing Stage 2B service відкликає попередні невикористані посилання, створює нове і записує audit event.

## 7. Disable manager

Вимкнення дозволене лише для `ACTIVE MANAGER`. Оновлення статусу на `DISABLED`, інкремент `authVersion` і AuditLog виконуються в одній serializable transaction. Це анулює чинні JWT-сесії після наступної server-side перевірки версії.

## 8. Enable manager

Повторне увімкнення дозволене лише для `DISABLED MANAGER`, який уже має пароль. Статус змінюється на `ACTIVE`, `authVersion` інкрементується, пароль не змінюється. Якщо password hash відсутній, UI не пропонує небезпечну активацію та показує пояснення.

## 9. ADMIN policy

ADMIN відображаються read-only. Для них немає lifecycle actions. Stage 2C не реалізує зміну ролей, вимкнення адміністратора або видалення staff.

## 10. AuditLog

Prisma enum не змінювався. Lifecycle operations використовують наявну дію `ENTITY_UPDATED`, а точна подія зберігається в metadata як `MANAGER_DISABLED` або `MANAGER_ENABLED`. AuditLog створюється у тій самій transaction, тому failure відкотить зміну статусу.

## 11. Responsive UI

- `xl` і ширше: компактна таблиця.
- Нижче `xl`: staff cards без глобального horizontal scroll.
- Confirmation dialog має focus trap, Escape, focus restore і зрозумілі destructive labels.
- Result та copy states оголошуються через `aria-live`.

## 12. Security checks

Targeted script перевіряє:

- ADMIN-only guards для route/actions;
- неможливість lifecycle action над ADMIN, CLIENT або відсутнім користувачем;
- дозволені лише `ACTIVE -> DISABLED` і `DISABLED -> ACTIVE` для MANAGER;
- заборону activation без наявного пароля;
- scoped atomic update та AuditLog у transaction;
- відсутність invitation token/hash, password hash і `authVersion` у client payload;
- відсутність Prisma schema змін.

Результат: `PASS`.

## 13. Manual QA status

Production/staging mutation smoke test навмисно не виконувався: у цьому етапі не створювались тестові staff users і не змінювався доступ реальних користувачів. Після deploy потрібно вручну перевірити create/copy/accept invitation, regenerate-old-link rejection, disable-current-session rejection та enable-login зі старим паролем на дозволеному staging account.

## 14. Technical checks

- `npx.cmd prisma validate`
- `npx.cmd prisma generate`
- `npx.cmd prisma migrate status`
- `npx.cmd tsx scripts/check-admin-users-2c.ts`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

Фактичні результати зафіксовані у фінальному звіті виконання.

## 15. Prisma and data safety

Prisma schema не змінювалася, migration не потрібна. `.env*`, токени, invitation links, паролі та database URL у commit не включаються. Тестові staff records не створювалися.

## 16. Deferred scope

Не реалізовано: email delivery, password reset, staff deletion, arbitrary role changes, CLIENT promotion, bulk actions і Stage 2D. Кодового blocker для наступного погодженого етапу немає; повний invitation E2E залишається post-deploy smoke test.
