# Stage UI 11.4 - Cabinet responsive architecture audit

## 1. Executive summary

Аудит підтвердив, що основна проблема кабінетів не є набором випадкових дефектів окремих сторінок. Вона походить від спільного `DashboardShell` і невідповідності його breakpoint-архітектури щільності CRM-контенту.

Поточний shell має лише два режими:

- до `lg` (`1024px`) sidebar перетворюється на один горизонтальний ряд із `overflow-x-auto`;
- від `lg` sidebar одразу стає fixed-панеллю шириною `256px`, а main отримує `margin-left: 256px`.

Через це на `768-1023px` усі пункти навігації намагаються поміститися в одну горизонтальну стрічку без видимого affordance прокручування. На `1024px` доступна ширина main різко зменшується приблизно до `768px`, а після внутрішніх `64px` padding залишається близько `704px`. У цей простір потрапляють desktop grids і таблиці з мінімальною шириною `920-1360px`.

Рекомендований напрям Stage UI 11.5: зберегти єдину shell-основу для ADMIN, MANAGER і CLIENT, прибрати горизонтальне меню, використовувати drawer до `1280px`, persistent sidebar від `1280px`, запровадити cabinet tokens і адаптивні table/detail patterns. Бізнес-логіка, Prisma schema та API для цього не потребують змін.

## 2. Scope

Статично перевірено:

- 27 ADMIN/MANAGER page routes, включно з print route, що навмисно обходить shell;
- 11 CLIENT page routes, включно з print route, що навмисно обходить shell;
- `app/admin/layout.tsx`, `app/client/layout.tsx`, `components/layout/dashboard-shell.tsx`;
- dashboard, lists, details, forms, tables, galleries, documents, loading/error/not-found states;
- Tailwind breakpoints, global CSS і фактичні width/overflow/grid utilities;
- 14 наданих screenshot references для mobile, tablet, laptop і desktop.

Це read-only code audit. Production UI і бізнес-логіка не змінювалися. Реальний browser re-test усіх маршрутів у цьому етапі не виконувався.

## 3. Git state

- Branch: `main`.
- Baseline HEAD: `e06b5de Fix client navigation and rich text heading behavior`.
- На початку аудиту `git status --short` був чистим.
- Зазначеної в prompt зміни `app/(public)/advantages/page.tsx` у поточному worktree не було.
- У commit цього етапу дозволено включити тільки цей report.

## 4. Current ADMIN shell

ADMIN і MANAGER використовують `DashboardShell` через `app/admin/layout.tsx`. Роль впливає на набір nav items, але не на layout.

Фактична структура:

- root: `min-h-screen bg-background`;
- sidebar: normal flow до `1024px`, fixed `w-64` від `1024px`;
- desktop sidebar width: `16rem` / `256px`;
- mobile/tablet nav: horizontal flex row з `overflow-x-auto`;
- main: `w-full min-w-0 max-w-full`, від `1024px` - `ml-64`;
- header: `px-4 sm:px-6 lg:px-8`, `py-5`;
- content: `px-4 sm:px-6 lg:px-8`, `py-6`;
- cabinet content max-width відсутній.

Позитивні основи: shell спільний, main має `min-w-0`, active links мають `aria-current`, print routes коректно обходять dashboard shell.

## 5. Current CLIENT shell

CLIENT використовує той самий `DashboardShell`. Відмінності обмежені title/subtitle, nav items, badge і logout action.

Це правильна основа для повторного використання. Окремий client shell не потрібен: role-specific navigation має залишитися в layouts, а responsive frame, drawer, header, content width і spacing повинні бути спільними.

Поточні недоліки CLIENT ті самі:

- немає burger/drawer;
- mobile/tablet navigation є горизонтальною стрічкою;
- badge може збільшувати ширину nav item;
- main не має єдиного content max-width;
- CLIENT tables успадковують desktop-first мінімальні ширини.

## 6. Navigation breakpoint audit

Tailwind використовує стандартні breakpoints: `sm=640`, `md=768`, `lg=1024`, `xl=1280`, `2xl=1536`.

| Width | Current behavior | Finding |
|---|---|---|
| 375/390/430 | horizontal nav above content | links виходять за viewport; доступ через невидиме горизонтальне прокручування |
| 640 | та сама horizontal nav | збільшуються page padding, але navigation architecture не змінюється |
| 768/820 | та сама horizontal nav | ADMIN links не можуть фізично поміститися в один ряд |
| 1024 | fixed 256px sidebar вмикається одразу | main втрачає 25% viewport width у найщільнішому laptop режимі |
| 1280 | fixed 256px sidebar | main вже практичніший, але Type C tables все одно потребують іншої презентації |
| 1440/1536/1920 | fixed 256px sidebar | usable width достатня, однак немає max-width/rhythm для широких detail/form pages |

`overflow-x-auto` існує, але користувач не отримує видимого сигналу, що меню можна прокручувати. Keyboard/focus поведінка не замінює відсутній drawer. Горизонтальна nav для 8-10 ADMIN links не є стабільною архітектурою.

## 7. Sidebar width audit

Поточна ширина `256px` однакова для всіх desktop widths. Logo має intrinsic width `206px`; item padding - `12px` з кожного боку, icon - `18px`, gap - `10px`, badge - щонайменше `24px` плюс padding. Довгі labels на кшталт `Реквізити продавця` і `Типи й виробники` потребують переносу або достатньої ширини.

Рекомендація:

- `<1280px`: persistent sidebar не використовувати, застосувати drawer;
- `1280-1535px`: sidebar `224px`;
- `1536px+`: sidebar `240px`;
- drawer width: `min(320px, calc(100vw - 48px))`.

Це трохи відрізняється від орієнтира prompt для `1024-1279px`, бо фактичні screenshots і таблиці доводять: persistent sidebar у цьому діапазоні забирає критичну ширину main.

## 8. Main content width audit

Shell main технічно має `min-w-0`, тому він сам не є джерелом intrinsic overflow. Проблеми створюють descendants:

- таблиці `min-w-[760px]` ... `min-w-[1360px]`;
- grid із 7 колонками для RequestItem;
- fixed detail sidebars `360px` і `420px`;
- form grids, що переходять у 2 колонки вже на `md` або `lg`;
- popover `w-[560px] max-w-[80vw]`;
- `whitespace-nowrap` у navigation і badge controls.

На `1024px`: `1024 - 256 sidebar - 64 content padding = ~704px`. Тому навіть найменша list table `760px` не вміщується, не кажучи про `1180-1360px`. Праве обрізання є наслідком локальних scroll containers або зміщеного scroll position; приховувати body overflow не можна, бо це лише замаскує недоступний контент.

## 9. Container/padding audit

Cabinet pages майже не мають локальних `max-w-*`; вони покладаються на shell `px-4/sm:px-6/lg:px-8`. Public `.kp-container` має іншу систему (`1280/1320px`, padding `16/20/24px`) і не використовується як cabinet abstraction.

Поточна inconsistency походить не стільки від різних route max-width, скільки від відсутності route-aware cabinet container. Однакова необмежена ширина не підходить одночасно для форм, detail pages і щільних tables.

Цільова система:

- mobile: `16px`;
- tablet: `20px`;
- laptop: `24px`;
- desktop: `24px`;
- large desktop: `32px`;
- shell content max-width: `1600px`, centered;
- forms/details: optional readable variant до `1440px`;
- data tables: full available width усередині shell, без додаткового вузького max-width.

## 10. Page header audit

`Admin / CRM` + `CRM менеджера` або client equivalent рендериться глобально на кожній cabinet page. Header використовує `py-5`, а page нижче ще `py-6`; потім більшість routes починаються з окремої `p-6` intro card. Це створює три послідовні вертикальні зони до основної дії.

Рекомендований compact scale:

- mobile/tablet: header `16px 16/20px`;
- desktop: `22-24px 24/32px`;
- route heading і primary action слід уніфікувати через `CabinetPageHeader`, а не дублювати вступну card там, де вона не несе окремої функції.

## 11. Card/section spacing audit

Домінантний pattern: `grid gap-6` + card `p-6`. Він простий, але застосований однаково до dashboard, таблиць, форм і коротких info blocks.

Надмірна вертикальна вага помітна у:

- `/admin` - вісім stat cards у single-column mobile stack;
- `/admin/companies`, `/admin/change-requests`, `/admin/audit-log` - intro card перед основною card;
- `/admin/requests/[id]` - велика кількість послідовних `p-6` sections;
- client change requests - intro + form + table, усі `p-6`;
- empty states із `p-8`, коли екран уже вузький.

Цільова шкала: mobile `p-4`, tablet `p-5`, desktop `p-5/p-6`; section gap `16/20/24px`. Не слід додавати `min-height` коротким карткам для заповнення порожнього екрану.

## 12. Dashboard audit

### ADMIN

Stat grid: `sm:grid-cols-2 xl:grid-cols-4`. Це означає 1 колонку до `640px`, 2 колонки до `1280px`, 4 від `1280px`. Логіка коректна, але 8 cards із `p-5` на 375px створюють довгий екран. На tablet 2 колонки доречні. На laptop/desktop доцільно 3-4 колонки залежно від available main width, не лише viewport.

Recent requests: table `min-w-[760px]` у `overflow-x-auto`. На mobile потрібні cards; на tablet compact table або cards; на desktop table.

ADMIN loading skeleton показує лише 4 stat cards, тоді як final dashboard має 8, тому vertical layout shift можливий.

### CLIENT

Stat grid повторює responsive pattern ADMIN. Recent requests представлені cards, тому client dashboard стійкіший. Welcome/header card може компактніше переносити CTA на mobile.

## 13. Forms audit

Основні findings:

- Company create/update і billing forms переходять у 2 колонки на `md=768`, що прийнятно лише без persistent sidebar; у поточному 768 horizontal-nav режимі це вміщується, але navigation псує viewport.
- Vehicle forms переходять у 2 колонки на `md`; поля стандартні й можуть стати 1-column нижче `768`.
- Used Equipment form переходить у 2 колонки на `lg`; при поточному `lg` sidebar effective main близько 704px, тому два поля надто вузькі. Перехід слід прив'язати до available content / `xl`, не до viewport `lg`.
- Rich text toolbar використовує багато controls і потребує `flex-wrap`, стабільних 44px targets та горизонтально не обрізаного row.
- Directory forms мають template `minmax(0,1fr) 5rem auto auto`; він повинен ставати однією колонкою/stack до `lg` available width.
- Manufacturer type checkbox cloud коректно wraps, але довгі labels формують нерівні rows; це не global overflow.
- ChangeRequest decision controls усередині table (`min-w-[260px]`) є головною причиною надширокої колонки.
- Document/photo actions уже використовують `flex-wrap` і є кращим reusable pattern.

## 14. Tables inventory

| Route/block | Columns | Min width | Current wrapper |
|---|---:|---:|---|
| Admin recent requests | 5 | 760px | `overflow-x-auto` |
| `/admin/requests` | 10 | 1180px | `overflow-x-auto` |
| `/admin/companies` | 7 | 920px | `overflow-x-auto` |
| `/admin/clients` | 8 | 980px | `overflow-x-auto` |
| Client history on admin client | medium | 760px | `overflow-x-auto` |
| `/admin/change-requests` | 8 | 1320px | `overflow-x-auto` |
| `/admin/audit-log` | 9 | 1360px | `overflow-x-auto` |
| `/admin/contact-messages` | medium | 920px | table from `md`, cards below `md` |
| Used equipment items | 9 | 1120px | table from `lg`, cards below `lg` |
| Used equipment inquiries | 8 | 1120px | table from `lg`, cards below `lg` |
| Admin request items | 7-grid/cards | intrinsic | no dedicated viewport strategy |
| Admin request invoice/items | dense | 940/1040px | local `overflow-x-auto` |
| `/client/requests` | 7 | 760px | `overflow-x-auto` |
| `/client/change-requests` | 8 | 1120px | `overflow-x-auto` |
| Client request invoice | dense | 860px | local `overflow-x-auto` |

## 15. Table classification

### Type A - compact

- short dashboard summaries;
- simple document metadata lists;
- compact request history with at most 4-5 essential fields.

Can remain a table through tablet with controlled overflow only when labels remain readable.

### Type B - medium

- companies;
- clients;
- contact messages;
- client requests;
- used-equipment inquiries when secondary fields are hidden.

Use compact table on laptop/desktop; use record cards below `1024px`.

### Type C - dense/workflow

- admin requests;
- ChangeRequests;
- AuditLog;
- used equipment items;
- client ChangeRequests;
- request detail item/invoice workflow tables.

Use full table from `1280px`, compact columns at `1024-1279px` only where meaningful, and cards/stacked records below `1024px`. AuditLog and ChangeRequests should not be compressed into tiny text.

## 16. Requests list audit

`/admin/requests` has six-column filter grid at `xl` and a ten-column `1180px` table. At `1024px` shell main cannot fit it. Horizontal scroll is technically local, but screenshots show users encounter cropped request numbers/last columns depending on scroll position.

Stage 11.5:

- filter grid: 1 column mobile, 2 tablet, 3 laptop, 6 desktop;
- `<1024`: request cards with number, client, equipment, status, manager, date;
- `1024-1279`: compact table hiding phone/category/updated where suitable;
- `>=1280`: full table;
- scroll indicator only for deliberately scrollable secondary tables.

## 17. Request detail audit

`/admin/requests/[id]` is the highest-risk detail route:

- top status area becomes `xl:flex-row` and reserves `420px`;
- main/actions layout becomes `xl:grid-cols-[minmax(0,1fr)_360px]`;
- multiple internal 2-column grids activate at `md/lg`;
- request items use a seven-column desktop grid;
- invoices/documents use `940px` and `1040px` tables;
- a popover uses `560px max-w-[80vw]`.

At `<1280` main/actions are already one column, which is correct, but route density and inner grids still produce oversized cards. At `>=1280` the 360px panel is reasonable only when shell main is wide enough.

Target: actions/status immediately after detail header in single-column modes; main + `320-360px` action rail only from `1280px`; all nested grids use `minmax(0,1fr)`; request items become stacked records below `1280px`.

Client request detail is less dense but still uses a seven-column item grid and `860px` invoice table. It needs the same item/table adaptation.

## 18. Company pages audit

`/admin/companies` combines intro card, 2-column create form from `768px`, and a 7-column `920px` table. Screenshot compression is caused by retaining the table rather than adapting records.

`/admin/companies/[id]` uses two-column forms from `md`, a split content layout only from `xl`, plus members/fleet/documents. The `xl` split is appropriate; forms should stay single-column when available main width is narrow.

Recommendation: company list cards below `1024px`; create form 2 columns from `768px` only in drawer mode; company detail split from `1280px`; reusable owner fleet/document sections remain.

## 19. Client pages audit

Admin client list is an 8-column `980px` table and needs cards below `1024px`. Client detail uses summary grid (`md:2`, `xl:4`) and a request table `760px`; summary is acceptable, history needs adaptive records.

CLIENT cabinet strengths:

- fleet list already uses responsive cards (`md:2`, `xl:3`);
- vehicle detail switches to a two-column layout only at `xl`;
- gallery thumbnails use intentional local horizontal scrolling;
- photo/document managers wrap actions.

CLIENT weaknesses:

- requests and change requests remain desktop tables on mobile;
- vehicle create form starts 2 columns at `md` rather than available-width-aware breakpoint;
- profile rows are responsive but parent card uses fixed `p-6` on mobile;
- all CLIENT navigation inherits broken horizontal shell mode.

## 20. ChangeRequests audit

Admin ChangeRequests is a Type C table: `1320px`, 8 columns, long old/new/reason values and an action form with `min-w-[260px]`. It cannot be made usable by reducing font size.

Client ChangeRequests is similarly `1120px`, 8 columns, long values and actions. Both should use cards below `1024px`. Admin card order: subject/status, requested change, reason, client/company, decision form. Client card order: status/object, requested value, reason, manager response, cancel action.

No `[id]` route exists for either group, so cards must preserve all essential actions or a later explicitly scoped detail route would be required.

## 21. AuditLog audit

AuditLog is the widest table (`1360px`, 9 columns) and the strongest screenshot example of information becoming unreadably small. `Old value`, `New value` and `Деталі` are content blocks, not normal table cells.

Recommendation:

- `>=1280`: table with compact identity columns and expandable details;
- `<1280`: audit event cards with actor/time/action/object summary and a definition-list details section;
- raw metadata should remain human-readable labels, not be compressed into a narrow code-like column;
- body/table text should remain at least `14px`.

## 22. Used Equipment audit

Routes are `/admin/used-equipment/items`, `/items/new`, `/items/[id]/edit`, `/inquiries`, `/inquiries/[id]` (not the shorter prompt aliases).

Lists already implement a good precedent: tables are hidden below `lg`, mobile cards are shown. Remaining issue: at exactly `lg=1024`, the `1120px` table appears while a 256px sidebar also appears, guaranteeing local overflow. Both switches should move to the persistent desktop boundary (`xl=1280`).

Forms use two columns at `lg`, which has the same breakpoint collision. Rich-text toolbar needs wrapping and stable control dimensions. Image manager uses 1/2/3 columns and is broadly sound. Inquiry detail uses `420px` side rail only at `xl`, which is correct, while its internal image/text grid starts at `lg` and should be reviewed against available width.

## 23. Vehicle pages audit

Admin owner vehicle create/edit forms are responsive but use `md:grid-cols-2`. Owner fleet rows become a complex eight-column grid only at `xl`, which is a sound breakpoint. Photo grids are 1/2/3 columns; document rows stack until `lg`.

Client vehicle list/gallery/detail are among the strongest responsive implementations. The gallery's thumbnail `overflow-x-auto` is intentional and discoverable through visible thumbnails. Client vehicle detail uses side-by-side layout only at `xl` and retains `min-w-0`.

Risks:

- upload controls and 4-button image action grid need 375px checks;
- long VIN/filenames need `break-all`/`overflow-wrap:anywhere` at value boundaries;
- vehicle form should not switch to two columns when a future persistent sidebar leaves insufficient available width.

## 24. Documents audit

Admin owner and vehicle document sections use article rows rather than wide tables, with actions wrapping and stack-to-`lg` behavior. This is a suitable model for CLIENT documents.

Client documents are grouped in cards and are broadly responsive. Main risks are long filenames/storage labels and action wrapping. The loading skeleton uses `grid-cols-4` at all widths, which does not match the final mobile card/list presentation and can create compressed placeholders.

## 25. Navigation badge audit

Badges use `min-w-6`, horizontal padding and `justify-between`, so alignment is stable in a vertical sidebar. In the current horizontal nav they increase the minimum width of each item and worsen overflow. Large counts remain single-line and can widen labels.

Drawer/desktop target:

- fixed icon column;
- label `min-w-0` with natural wrapping only in desktop sidebar;
- badge `shrink-0`, cap visible value at `99+` if business accepts;
- active background spans full nav row;
- same count data and role filtering as today.

## 26. Overflow/min-width root causes

Intentional local overflow:

- public/client gallery thumbnail rails;
- desktop tables when all columns are genuinely required;
- invoice line-item tables in print-like contexts.

Overflow masking layout defects:

- shell horizontal navigation;
- Type C tables on tablet;
- used-equipment tables appearing at `1024px` while sidebar also appears;
- request list/detail tables at effective main width below their min width.

The global body should not receive `overflow-x-hidden`. Each wide data region needs an explicit adaptive strategy. `min-w-0` must exist on all grid/flex ancestors; long IDs, email, VIN and filenames need wrapping at content cells.

## 27. Empty-space analysis

Large blank areas in screenshots of Companies, ChangeRequests and AuditLog are mostly normal page background after short datasets, not a min-height defect. Stretching cards to viewport height would make scanning worse.

Actual waste comes from:

- global header + route intro card duplication;
- repeated `p-6` and `gap-6` at every nesting level;
- single-column stack of many stat cards on narrow mobile;
- dense table content shrunk into the top of a wide blank page.

Fix density and presentation; do not artificially fill the viewport.

## 28. Typography audit

Current title (`text-2xl`), section (`text-xl`/`text-lg`) and body/table (`text-sm`) scales are generally appropriate. The screenshots look tiny because the entire over-wide layout is being visually compressed or viewed at an effective fit scale, not because the base font is inherently too small.

Do not solve responsive issues with `text-xs`. Keep:

- body/table: practical minimum `14px`;
- helper/meta: `13-14px`;
- page title: `22-24px` mobile, `24-28px` desktop;
- stat numbers: `28-32px`, with compact card padding rather than smaller numbers.

## 29. Unified breakpoint proposal

| Range | Mode | Shell/navigation | Forms/tables/details |
|---|---|---|---|
| 0-639 | mobile | compact top bar + drawer | 1-column forms; cards; single-column details |
| 640-767 | large mobile | compact top bar + drawer | selected 2-column micro-grids only |
| 768-1023 | tablet | compact top bar + drawer | 2-column forms where safe; Type B/C cards |
| 1024-1279 | laptop | compact top bar + drawer | 2-3 column forms; compact Type B tables; single-column actions |
| 1280-1535 | desktop | persistent 224px sidebar | full/compact tables; detail rails |
| 1536+ | large desktop | persistent 240px sidebar | full tables; 1600px centered content |

Drawer breakpoint: `<1280px`. Persistent sidebar breakpoint: `>=1280px`. This avoids the current discontinuity at `1024px`.

## 30. Navigation architecture proposal

One decisive target:

- shared `CabinetShell` remains the frame for all roles;
- below `1280px`: top bar with logo, page context, badge-aware menu button; modal drawer with overlay;
- drawer requirements: `aria-expanded`, `aria-controls`, focus trap, Escape, close on overlay, close on route change, body scroll lock, focus return;
- from `1280px`: fixed/sticky vertical sidebar;
- role-specific nav item creation and badge queries remain in admin/client layouts;
- remove horizontal nav mode entirely.

## 31. Content/container proposal

Recommended component contract:

```text
CabinetShell
  CabinetHeader
  CabinetContent size="default|wide"
```

- `default`: `width:100%`, `max-width:1440px`;
- `wide`: `width:100%`, `max-width:1600px` for lists/AuditLog/requests;
- both centered and `min-width:0`;
- padding `16/20/24/32px` by ranges above;
- no route may set width on the full page background;
- tables may use all available `wide` content width.

## 32. Card/spacing token proposal

Proposed tokens/classes for Stage UI 11.5:

```css
--cabinet-sidebar-width: 224px;
--cabinet-sidebar-width-wide: 240px;
--cabinet-page-padding: 16px;
--cabinet-section-gap: 16px;
--cabinet-card-padding: 16px;
--cabinet-content-max: 1440px;
--cabinet-content-wide-max: 1600px;
```

Utilities/components: `cabinet-page`, `cabinet-page--wide`, `cabinet-page-header`, `cabinet-section`, `cabinet-card`, `cabinet-form-grid`, `cabinet-table-shell`. Values change at breakpoints; routes should consume abstractions rather than repeat `p-6 gap-6`.

## 33. Responsive table strategy

Unified strategy:

- `>=1280`: full Type B/C table where practical;
- `1024-1279`: compact Type B table, hide secondary columns; Type C uses cards/expandable rows;
- `<1024`: record cards for Type B/C;
- Type A may remain a table down to `768px` if its practical width fits;
- local horizontal scroll is allowed only for invoice/line-item or explicitly export-like tables, with focusable wrapper and visible affordance.

Route field sets:

| Route | Desktop | Laptop | Tablet/mobile card essentials |
|---|---|---|---|
| Admin requests | all 10 | number, client, equipment, status, manager, date | same six fields + open action |
| Companies | all 7 | company, contacts, members, requests, vehicles | company, contact, counts, created |
| Clients | all 8 | client, company, phone, counts | identity, contacts, type, counts |
| Contact messages | full table | compact | date, topic, contact, status, open |
| Used equipment | all 9 | existing cards preferred | image, title, type, status, inquiries, edit |
| Used inquiries | all 8 | existing cards preferred | equipment, client, phone, status, assignee, open |
| ChangeRequests | full/expandable | cards | status, object, values, reason, decision |
| AuditLog | compact table + expand | cards | date, actor, action, object, changed values/details |
| Client requests | full 7 | compact | number, equipment, status, updated, open |
| Client ChangeRequests | full/expandable | cards | status, object, change, reason, response/action |

## 34. Responsive detail strategy

- `>=1280`: main content plus side actions (`320-360px`; inquiry detail may use up to `400px` if main stays >=720px);
- `1024-1279`: single column by default; compact action summary near top, full action form below header;
- `<1024`: single column, actions first after identity/status; optional collapsible secondary metadata;
- internal info grids: 1 column mobile, 2 tablet, 3-4 only when available width supports it;
- sticky side rail only on desktop and only with bounded viewport behavior.

Applies to admin request detail, used inquiry detail, company/client detail, vehicle edit and used-equipment edit.

## 35. Reusable component proposal

| Candidate | Current state | Consolidation |
|---|---|---|
| `CabinetShell` | `DashboardShell` exists | evolve, do not duplicate |
| `CabinetSidebar` | inline in shell | extract desktop navigation |
| `CabinetMobileHeader` | absent | add shared compact bar |
| `CabinetDrawer` | absent | add accessible shared drawer |
| `CabinetPageHeader` | global header + repeated intro cards | unify title/copy/actions |
| `CabinetSection/Card` | repeated class strings | shared spacing variants |
| `StatCard` | duplicated dashboard markup | shared compact component |
| `FormGrid` | repeated `md/lg:grid-cols-2` | available-width-aware variants |
| `ResponsiveDataView` | ad hoc tables/cards | shared wrapper + route-specific row/card renderers |
| `MobileRecordCard` | used-equipment/contact precedent | general structural primitive |
| `DetailLayout` | repeated split grids | shared main/action rail contract |
| `DocumentRow` | owner/vehicle variants | consolidate wrapping/file-name behavior |

## 36. Accessibility findings

Present positives: semantic `nav`, `main`, table markup, `aria-current`, labels in forms, accessible inquiry dialog with focus handling.

Gaps:

- no skip link;
- no drawer, therefore no mobile menu semantics/focus lifecycle;
- horizontal navigation has no scroll instruction or controls;
- intentionally scrollable table wrappers are not consistently keyboard-focusable or labelled;
- mobile card alternatives must retain clear field labels and action names;
- loading skeleton coverage is incomplete and sometimes mismatches final layout;
- focus-visible must remain consistent on menu, pagination and card actions.

## 37. Performance considerations

Stage UI 11.5 should be CSS-first:

- no JS resize listeners for layout selection;
- do not duplicate database queries for table and card modes;
- avoid rendering two very large DOM datasets simultaneously; pagination is already bounded, but one adaptive record component is preferred for dense routes;
- preserve Server Components and current server-side badge counts;
- lazy client behavior only for drawer/dialog controls;
- do not convert whole cabinet pages to Client Components.

## 38. Route-by-route QA matrix

`Shell` means the shared `DashboardShell`; print routes intentionally bypass it.

| Route | Role | Current behavior / issue | Severity | Root cause | Stage 11.5 fix / shared primitive |
|---|---|---|---|---|---|
| `/admin` | A/M | 8 stats stack; recent table scrolls | MEDIUM | fixed spacing, table 760 | StatCard + ResponsiveDataView |
| `/admin/requests` | A/M | right columns inaccessible on laptop/tablet | HIGH | 1180 table + shell breakpoint | wide page + cards/compact table |
| `/admin/requests/[id]` | A/M | dense nested grids/action rail | HIGH | fixed inner grids/tables | DetailLayout + stacked item records |
| `/admin/contact-messages` | A/M | cards below md already; lg shell still tight | MEDIUM | shell breakpoint | preserve cards, fix shell |
| `/admin/contact-messages/[id]` | A/M | generally stacks correctly | LOW | p-6 density | CabinetSection |
| `/admin/used-equipment/items` | A/M | 1120 table appears exactly with sidebar | HIGH | both switch at lg | move table/sidebar boundary to xl |
| `/admin/used-equipment/items/new` | A/M | 2-col form too early at lg | MEDIUM | viewport not available width | FormGrid |
| `/admin/used-equipment/items/[id]/edit` | A/M | toolbar/form can compress | HIGH | lg 2-col + many controls | FormGrid + wrapping toolbar |
| `/admin/used-equipment/inquiries` | A/M | same 1024 collision | HIGH | 1120 table + lg sidebar | existing cards through <xl |
| `/admin/used-equipment/inquiries/[id]` | A/M | side rail sound at xl; inner lg split tight | MEDIUM | 280px inner column at lg | DetailLayout/container query later |
| `/admin/clients` | A/M | 980 table compressed | HIGH | no card alternative | client record cards |
| `/admin/clients/[id]` | A/M | summary good; history table scrolls | MEDIUM | 760 history table | DetailLayout + history cards |
| `/admin/clients/[id]/vehicles/new` | A/M | form mostly safe | MEDIUM | global shell/padding | FormGrid |
| `/admin/companies` | A/M | form/table compressed at tablet | HIGH | md 2-col + 920 table | cards + FormGrid |
| `/admin/companies/[id]` | A/M | sections dense, split only at xl | MEDIUM | repeated p-6 | DetailLayout/Section |
| `/admin/companies/[id]/vehicles/new` | A/M | form mostly safe | MEDIUM | global shell/padding | FormGrid |
| `/admin/change-requests` | ADMIN | unreadable compressed workflow | HIGH | 1320 table + form cell | workflow cards below xl |
| `/admin/audit-log` | ADMIN | unreadable metadata/values | HIGH | 1360 dense table | audit cards/expandable detail |
| `/admin/billing-settings` | ADMIN | 2-col form at md | MEDIUM | no form width variant | readable form container |
| `/admin/directories` | A/M | 3 cards from sm can be narrow | MEDIUM | early 3-col | 1/2/3 responsive grid |
| `/admin/directories/equipment-types` | A/M | row controls crowd laptop | MEDIUM | fixed 5rem/auto columns | stacked form below xl |
| `/admin/directories/manufacturers` | A/M | controls + many chips crowd | MEDIUM | fixed row template | stacked row + wrapping chips |
| `/admin/categories` | A/M | legacy/redirect surface | LOW | no primary dense UI | preserve/verify route behavior |
| `/admin/manufacturers` | A/M | legacy/redirect surface | LOW | no primary dense UI | preserve/verify route behavior |
| `/admin/settings` | A/M | limited page surface | LOW | shell only | shared shell regression |
| `/admin/vehicles/[vehicleId]/edit` | A/M | long management page | MEDIUM | repeated sections/form md split | DetailLayout + FormGrid |
| `/admin/invoices/[invoiceId]/print` | A/M | intentionally shell-free | LOW | print specialization | exclude from cabinet refactor |
| `/client` | CLIENT | cards stack, nav clips | MEDIUM | shell horizontal nav | shared drawer + compact stats |
| `/client/requests` | CLIENT | 760 table on mobile | HIGH | no card alternative | request cards below lg |
| `/client/requests/[id]` | CLIENT | item grid/invoice table wide | HIGH | 7-col grid + 860 table | item cards + controlled invoice scroll |
| `/client/vehicles` | CLIENT | responsive cards already good | LOW | shell only | preserve, regression test |
| `/client/vehicles/new` | CLIENT | 2-col at md | MEDIUM | early form split | FormGrid |
| `/client/vehicles/[id]` | CLIENT | good xl detail split/gallery | LOW | minor long values | preserve, wrapping audit |
| `/client/vehicles/[id]/photos` | CLIENT | upload controls need narrow QA | MEDIUM | action density | wrapping action controls |
| `/client/documents` | CLIENT | final content good; skeleton mismatches | MEDIUM | 4-col loading skeleton | responsive DocumentRow skeleton |
| `/client/change-requests` | CLIENT | 1120 workflow table | HIGH | no card alternative | change-request cards |
| `/client/profile` | CLIENT | responsive rows, oversized mobile padding | LOW | fixed p-6 | CabinetCard token |
| `/client/invoices/[invoiceId]/print` | CLIENT | intentionally shell-free | LOW | print specialization | exclude from cabinet refactor |

Routes requested in the prompt but absent: `/admin/change-requests/[id]`, `/client/change-requests/[id]`, `/client/requests/new`, `/admin/audit`, `/admin/seller-details`, `/admin/used-equipment`, `/admin/used-equipment/new`, `/admin/used-equipment/[id]/edit`. Their actual equivalents are represented above.

## 39. Severity classification

No BLOCKER was found for business operation at desktop width; however, responsive usability has HIGH issues.

HIGH routes:

- `/admin/requests`;
- `/admin/requests/[id]`;
- `/admin/used-equipment/items`;
- `/admin/used-equipment/items/[id]/edit`;
- `/admin/used-equipment/inquiries`;
- `/admin/clients`;
- `/admin/companies`;
- `/admin/change-requests`;
- `/admin/audit-log`;
- `/client/requests`;
- `/client/requests/[id]`;
- `/client/change-requests`.

Cross-route HIGH issue: shared navigation architecture at every width below `1280px` and the current `1024px` shell discontinuity.

## 40. Stage UI 11.5 implementation roadmap

1. Add cabinet tokens and evolve `DashboardShell` into shared `CabinetShell` without changing role/access logic.
2. Implement accessible drawer below `1280px`; remove horizontal nav mode.
3. Apply 224/240px desktop sidebar and centered `1440/1600px` content variants.
4. Add shared `CabinetPageHeader`, `CabinetSection`, `StatCard`, `FormGrid`, `DetailLayout`.
5. Stabilize forms/details first: request detail, used-equipment edit, company/client detail, vehicle edit.
6. Implement table strategy in risk order: AuditLog, ChangeRequests, requests, clients/companies, client requests, used-equipment lists.
7. Align loading/error/not-found states with final responsive structures.
8. Run route-by-route accessibility and browser QA at 375, 390, 430, 768, 820, 1024, 1280, 1440, 1536 and 1920.

## 41. Estimated change scope

Expected implementation scope for Stage UI 11.5:

- 1 shared shell refactor;
- 3-5 new shared layout/navigation primitives;
- 3-5 shared content/form/table primitives;
- approximately 12 HIGH-risk routes requiring substantive presentation changes;
- approximately 14 MEDIUM routes requiring token/breakpoint adjustments;
- loading/error/not-found alignment;
- no database or business-module work.

Implementation should be split into small commits/phases to reduce regression risk.

## 42. Risks

- changing the shell breakpoint can expose pages that implicitly relied on `lg` main width;
- rendering desktop tables and mobile cards simultaneously can duplicate large DOM trees;
- moving action panels may alter form association or server action payloads if markup is reorganized carelessly;
- global card/padding utilities can unintentionally affect print/public pages if not cabinet-scoped;
- drawer focus/body-lock implementation can regress navigation accessibility;
- hiding table columns must not hide the only route action or business-critical status;
- screenshot QA can expose real client data, so test accounts/sanitized records are required.

## 43. Blockers

No code, schema, migration or business-logic blocker exists for Stage UI 11.5.

The only execution prerequisites are:

- agree on persistent sidebar boundary (`1280px` recommended);
- agree on card field priority for each Type B/C table;
- use authenticated test roles and sanitized data for browser QA;
- keep print/public layouts outside cabinet token scope.

## 44. Recommended next safe step

Start Stage UI 11.5 Phase 1-2 only: cabinet-scoped tokens, shared shell, and accessible drawer below `1280px`. Verify all ADMIN/MANAGER/CLIENT navigation, badges, logout and print-route bypasses before touching route tables. Then proceed route groups from HIGH to LOW risk.

### Mandatory final answers

1. **Main root cause of horizontal admin navigation:** `DashboardShell` renders all nav items in one non-wrapping horizontal flex row below `lg`, using only `overflow-x-auto` as fallback.
2. **Why layout breaks at 768-1024px:** below 1024 the long nav row exceeds viewport; at 1024 a 256px sidebar suddenly removes a quarter of viewport while dense desktop children remain wide.
3. **Drawer breakpoint:** use drawer below `1280px`.
4. **Persistent sidebar breakpoint:** use persistent sidebar from `1280px`.
5. **Sidebar width:** `224px` at 1280-1535; `240px` at 1536+.
6. **Shared shell:** yes. ADMIN, MANAGER and CLIENT already share a valid foundation; keep role-specific nav data outside it.
7. **Why main content is clipped:** descendants have fixed/min widths up to 1360px and fixed side rails while the shell leaves only about 704px usable at a 1024px viewport.
8. **Pages with min-width/overflow problems:** admin requests/detail, companies, clients, ChangeRequests, AuditLog, used-equipment lists/edit, client requests/detail and client ChangeRequests.
9. **Sections with excessive spacing:** mobile dashboard stats, intro+content card pairs, request detail's nested sections, client ChangeRequests and generic empty states.
10. **Tables that need cards:** ChangeRequests, AuditLog, admin requests, clients, companies, client requests, client ChangeRequests; existing used-equipment cards should remain active through 1279px.
11. **Tables that may remain scrollable:** invoice/line-item tables and compact Type A tables where all columns are required and a labelled local scroll region is intentional.
12. **Unified content padding:** 16px mobile, 20px tablet, 24px laptop/desktop, 32px large desktop.
13. **Recommended max-width:** 1440px default cabinet content; 1600px wide data routes.
14. **Reusable components:** CabinetShell, CabinetSidebar, CabinetMobileHeader, CabinetDrawer, CabinetPageHeader, CabinetSection, StatCard, FormGrid, ResponsiveDataView/MobileRecordCard and DetailLayout.
15. **Blocker for Stage UI 11.5:** none after breakpoint/card-field decisions.
16. **Can Stage 11.5 avoid business logic changes:** yes; it is a presentation and accessibility refactor.
17. **HIGH/BLOCKER routes:** 12 HIGH routes listed in section 39; no route-level BLOCKER, while the shared sub-1280 navigation is a cross-route HIGH issue.
