# Stage UI 11.5 - Cabinet responsive layout implementation

## 1. Scope

Stage UI 11.5 реалізує спільну responsive-архітектуру кабінетів ADMIN, MANAGER і CLIENT на основі рекомендацій Stage UI 11.4. Зміни обмежені layout, presentation та accessibility. Prisma schema, migrations, auth, permissions, API і бізнес-логіка не змінювалися.

## 2. Shared cabinet shell

`DashboardShell` залишився єдиним shell для всіх ролей. Role-specific navigation і server-side badge queries, як і раніше, формуються в `app/admin/layout.tsx` та `app/client/layout.tsx`.

Shell тепер має два режими:

- до `1280px`: compact top bar і modal drawer;
- від `1280px`: fixed sidebar шириною `224px`;
- від `1536px`: fixed sidebar шириною `240px`.

Горизонтальну стрічку навігації прибрано.

## 3. Drawer and accessibility

Drawer підтримує:

- `aria-expanded` і `aria-controls` на menu button;
- `role="dialog"` і `aria-modal="true"`;
- focus trap;
- закриття через Escape;
- закриття через overlay;
- закриття після navigation;
- body scroll lock;
- повернення focus на menu button;
- touch target меню `44x44px`;
- skip link до основного вмісту.

Navigation badges обмежені значенням `99+`, не змінюють ширину рядка та мають текстовий accessible label.

## 4. Content width and spacing

Додано два cabinet content variants:

- `default`: `max-width: 1440px`;
- `wide`: `max-width: 1600px` для щільних списків і workflow routes.

Обидва варіанти центровані та мають `min-width: 0`.

Horizontal padding:

- mobile: `16px`;
- large mobile/tablet: `20px`;
- laptop: `24px`;
- desktop/large desktop: `32px`.

Cabinet-scoped primitives у `app/globals.css`:

- `.cabinet-stack`;
- `.cabinet-card`;
- `.cabinet-form-grid`;
- `.cabinet-record-grid`.

Вони задають responsive section gaps і card padding без впливу на public та print layouts.

## 5. Admin and manager routes

Оновлено presentation для:

- dashboard і recent requests;
- requests list і request detail;
- clients list і client request history;
- companies list і company forms/detail grids;
- contact messages;
- used-equipment items та inquiries;
- ChangeRequests;
- AuditLog;
- vehicle forms;
- rich-text toolbar.

ADMIN і MANAGER продовжують використовувати ті самі server-side permissions та role-filtered nav items.

## 6. Client routes

Оновлено:

- client shell;
- requests list;
- request detail item grids;
- ChangeRequests list/form;
- vehicle form.

Client fleet cards, vehicle gallery, documents і print routes збережені. Існуючі badge queries та actions не змінювалися.

## 7. Responsive data presentation

Щільні Type B/C реєстри показуються картками до `1280px`, а повною таблицею від `1280px`:

- admin requests;
- companies;
- clients;
- contact messages;
- used-equipment items;
- used-equipment inquiries;
- admin ChangeRequests;
- AuditLog;
- client requests;
- client ChangeRequests;
- client request history у CRM.

Mobile cards зберігають статус, основні identity fields і доступні actions. Бізнес-форми не дублювалися окремими client-side flows.

## 8. Intentional local overflow

Локальний horizontal scroll залишено тільки там, де всі колонки є частиною одного line-item документа:

- invoice item tables;
- request/commercial line-item tables;
- rich-text tables;
- gallery thumbnail rails.

Глобальний body horizontal scroll не використовується як layout-механізм.

## 9. Forms and details

- Detail action rails залишаються single-column до `xl`.
- RequestItem grids переходять у багатоколонковий режим від `xl`.
- Company та vehicle forms використовують стабільні `minmax(0, 1fr)` grids.
- Rich-text toolbar має wrapping та minimum `44px` controls.
- Long IDs, VIN, emails і filenames залишаються у `min-width: 0` containers.

## 10. Loading and error states

Admin loading state синхронізовано з вісьмома dashboard KPI cards. Error/not-found routes успадковують новий shell і responsive content padding. Окремої client loading сторінки у поточній архітектурі немає.

## 11. Browser and viewport QA

Локальний Next.js server успішно стартував і відповів `200` на `/admin/login`. Повний authenticated browser automation у поточному Codex runtime не був доступний, тому не заявляється як виконаний.

Підготовлено окремий staging checklist для ширин:

- 375px;
- 390px;
- 430px;
- 768px;
- 820px;
- 1024px;
- 1280px;
- 1440px;
- 1536px;
- 1920px.

## 12. Technical checks

- `npx.cmd prisma migrate status` - passed, database schema is up to date;
- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- `git diff --check` - passed.

Під час `next build` статична генерація записала нефатальні TLS diagnostics для трьох directory count queries. Build продовжився, згенерував усі 45 static pages і завершився з exit code `0`. Це environment-level warning доступу до Neon під час SSG, а не помилка responsive implementation.

Окремого `test` script у `package.json` немає, тому додатковий test command не запускався.

## 13. Prisma and migrations

Prisma schema не змінювалася. Нова migration не потрібна.

## 14. Known limitations

- Повний authenticated visual smoke потрібно пройти після deployment/staging refresh.
- Invoice/line-item tables навмисно залишаються локально scrollable на вузьких екранах.
- Stage не вводить container queries або новий generic table framework.

## 15. Readiness conclusion

Shared responsive architecture реалізована без зміни business behavior. Основний cross-route дефект Stage UI 11.4 - горизонтальна navigation та ранній persistent sidebar на `1024px` - усунуто. Після проходження staging checklist кабінети готові до production responsive smoke.
