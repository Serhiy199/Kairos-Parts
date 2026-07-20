# Stage UI 11.5.1 — Admin request detail responsive fix

Дата: 20 липня 2026 року
Статус: targeted audit та implementation завершені; authenticated browser QA заблокований локальним browser runtime.

## 1. Scope

Змінено лише presentation детальної CRM-сторінки `/admin/requests/[id]`, додано lightweight static check і документацію. Business logic, actions, queries, authorization, API, Prisma schema та migrations не змінювалися.

## 2. Request detail component tree

Фактична реалізація зосереджена в `app/admin/requests/[id]/page.tsx`:

```text
AdminRequestDetailPage
├─ request header
│  ├─ back link / request number / dates
│  └─ status + assigned manager summary
├─ main/sidebar responsive grid
│  ├─ main
│  │  ├─ contact data
│  │  ├─ request need
│  │  ├─ linked vehicle
│  │  ├─ RequestItemsSection
│  │  │  ├─ selected positions header + approval CTA
│  │  │  ├─ position cards
│  │  │  └─ RequestItemForm
│  │  ├─ InvoicesSection
│  │  │  ├─ BillingSnapshotCard
│  │  │  └─ local line-item table
│  │  ├─ RequestDocumentsSection
│  │  │  ├─ local document table
│  │  │  └─ metadata/upload forms
│  │  ├─ client files / OCR / client base
│  │  └─ internal comments
│  └─ action sidebar
│     ├─ status + manager actions
│     ├─ public status
│     ├─ status history
│     └─ notifications
└─ local helpers: Info, FileList, TextField
```

Окремих route-level `loading.tsx`, `error.tsx` або `not-found.tsx` у цьому segment немає.

## 3. Root cause analysis

Підтверджені root causes:

1. Root page не мав явних `w-full min-w-0 max-w-full`.
2. Main/sidebar grid вмикався на `xl`, і в той самий момент selected position ставав семиколонковим. Після віднімання sidebar 360 px семи полям залишалася недостатня ширина.
3. Selected-position action block мав `sm:min-w-[280px]`; разом із nested section/card padding це надмірно звужувало text column.
4. Cards використовували кілька вкладених рівнів `p-6 → p-4 → p-4`, що на 375 px залишало надто вузький usable content.
5. Inputs/selects/textareas не мали послідовних `w-full min-w-0` і зберігали intrinsic control width.
6. Request number, email, VIN, filenames, comments, manager data та invoice values не мали гарантованого wrapping.
7. Document editor використовував `w-[560px] max-w-[80vw]`.
8. Public URL використовував `break-all`, а notifications — `line-clamp-4`, через що важливий текст був штучно обрізаний.
9. Invoice/document tables мають справжній tabular use case. Їхні `min-w-[940px]` та `min-w-[1040px]` допустимі лише всередині локального scroll wrapper.

## 4. Main/sidebar layout issue

Попередній layout: `xl:grid-cols-[minmax(0,1fr)_360px]`. Він формально був single-column нижче 1280 px, але не мав повного shrink chain у root і занадто рано поєднував вузький main із desktop position grid.

Новий layout:

```text
<1280:
single column, width 100%, sidebar in normal flow

>=1280:
minmax(0,1fr) minmax(300px,360px)
gap 24 px
main min-width 0
sidebar min-width 0
```

## 5. Selected positions issue

Семиколонкова grid activated на `xl`, хоча main column на 1280–1536 px не може безпечно вмістити всі fields. Також nested borders/padding і 280 px action minimum звужували card.

Тепер кожна позиція залишається vertical labelled card до 1800 px. Від 1800 px, коли wide shell реально дає main приблизно 1100+ px, активується structured seven-column row.

## 6. CTA issue

`Відправити на погодження` була всередині block із `sm:min-w-[280px]`. Minimum прибрано для narrow screens. Form і button мають `w-full`, button — `min-h-11`, `whitespace-normal`, centered text і visible focus ring. Desktop block обмежений `280–320 px`.

## 7. History/notifications issue

History actor/email/date могли утворювати довгий рядок. Додано `min-w-0`, `break-words` і readable line-height.

Notifications більше не використовують `line-clamp-4`; повний message відображається у normal flow і переноситься всередині card. Data query, ordering і limit 8 не змінені.

## 8. Public status issue

URL/token не змінювався. Link тепер використовує `break-words [overflow-wrap:anywhere]` замість `break-all`, має `min-w-0` та keyboard focus ring.

## 9. Mobile layout

На 375–430 px:

- outer/card padding 16 px;
- section gaps 16 px;
- header/status/manager stack;
- request number 24 px і wraps;
- info sections одна колонка;
- selected position — vertical card;
- action/edit/delete controls full width where needed;
- form controls `w-full min-w-0`;
- sidebar sections ідуть після main у normal flow.

## 10. Tablet layout

На 640–1024 px main і sidebar залишаються single-column. Contact/equipment info може переходити у дві колонки з 768 px, бо кожна child має `min-w-0`. Selected positions залишаються vertical cards, CTA — full width.

## 11. Laptop layout

На 1280–1536 px використовується main + 300–360 px sidebar. Sidebar sticky із `top-6`. Selected positions не стискаються у сім колонок, а залишаються vertical labelled cards. Це усуває конфлікт sidebar/position grid.

## 12. Desktop layout

На 1440/1536 main+sidebar зберігається, positions vertical. Від 1800 px position card переходить у structured row із колонками:

```text
minmax(180px,1.4fr)
minmax(140px,1fr)
minmax(80px,.5fr)
minmax(120px,.8fr) × 3
minmax(140px,1fr)
```

1920 px входить у цей режим і має достатню usable main width.

## 13. Main/sidebar implementation

Root: `grid w-full min-w-0 max-w-full`. Direct main/sidebar children мають `min-w-0`. Sidebar width фактично dynamic у діапазоні 300–360 px, maximum 360 px. Sticky вмикається лише від 1280 px.

## 14. Selected-position card implementation

Одна data array і один DOM representation; дублювання mobile/desktop markup немає. Усі critical fields залишилися:

- part name/brand/comment;
- catalog number;
- quantity/unit;
- availability;
- price;
- total;
- client visibility/approval/invoice badges;
- edit and delete actions.

## 15. Desktop position layout

Horizontal layout активується через `min-[1800px]`, а не через `xl`. Це presentation-only breakpoint; calculations, status badges та actions не змінені.

## 16. Overflow/min-width fixes

Додано або виправлено:

- root/main/sidebar/section/card `min-w-0`;
- long text `break-words` / `overflow-wrap:anywhere`;
- form controls `w-full min-w-0`;
- document editor: `w-full min-w-0 max-w-lg` замість 560 px;
- local tables: `overflow-x-auto overscroll-x-contain max-w-full`.

Глобальний `overflow-x-hidden` не додавався. Body overflow не маскується.

## 17. Padding/spacing fixes

Section padding: 16 px mobile, 20 px small/tablet, 24 px desktop. Root/main/sidebar gaps: 16/20/24 px. Selected-position wrapper/card padding також зменшено на mobile, щоб уникнути triple-padding squeeze.

## 18. Accessibility

- Heading hierarchy і existing section labels збережено.
- Existing button accessible text не змінено.
- Status badges залишають textual labels, не лише color.
- Primary mobile CTA має нормальний wrapping, minimum touch height і focus-visible ring.
- Public URL має focus-visible state.
- DOM/sidebar order залишається логічним: actions → public status → history → notifications.
- Business actions і keyboard-native forms/details не замінювалися custom JS.

## 19. Browser widths tested

Runtime visual QA для 375, 390, 430, 640, 768, 820, 1024, 1280, 1440, 1536 і 1920 px — **BLOCKED / NOT RUN**. In-app browser runtime не створив kernel assets: `failed to write kernel assets: path not found`.

Static breakpoint review охопив усі ці width ranges, але не позначається як browser PASS.

## 20. Browser smoke status

Authenticated browser smoke не виконано. Відповідно створено окремий staging checklist. Browser blocker не підмінено неавтентифікованою сторінкою або заявою про visual PASS.

## 21. Regression checks

Збережено ті самі handlers:

- `updateAdminRequestStatus`
- `assignAdminRequestManager`
- `sendAdminRequestItemsForApproval`
- `updateAdminRequestItem`
- `deleteAdminRequestItem`
- invoice/document/OCR/comment handlers

Prisma query, include tree, status conditions, calculations, hidden inputs і form payloads не змінені.

## 22. Technical checks

- `npx.cmd tsx scripts/check-stage-ui-11-5-1.ts` — PASS
- `npx.cmd prisma validate` — PASS
- `npx.cmd prisma generate` — PASS
- `npx.cmd prisma migrate status` — BLOCKED: знайдено unrelated pending migration `20260720180000_add_manager_invitations`; її не застосовували
- `npm.cmd run typecheck` — PASS
- `npm.cmd run lint` — PASS
- `npm.cmd run build` — PASS, 45 static pages generated; відомі non-fatal Prisma TLS warnings для taxonomy counts, exit code 0
- `git diff --check` — PASS

## 23. Prisma/migration status

У межах Stage UI 11.5.1 `prisma/schema.prisma` не редагувався, нова migration не створювалася і не потрібна. Паралельно у working tree з'явилися unrelated зміни `prisma/schema.prisma` та pending migration `20260720180000_add_manager_invitations`; вони не входять до цього UI scope і будуть виключені з commit.

## 24. Remaining gaps

Залишається authenticated visual staging QA на реальній заявці з multiple positions, long description/VIN/email/company, history, notifications, public status і assigned/unassigned manager variants.

## 25. Blockers

Є лише environment blocker для browser QA: локальний in-app browser runtime не ініціалізує kernel assets. Implementation, static regression checks і repository technical checks цим не заблоковані.
