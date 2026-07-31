# Stage Request Approval UI 1 — Client checkbox selection

## 1. Мета

Замінити active per-item approve/reject UI у клієнтському кабінеті на
checkbox-based локальний вибір без зміни backend lifecycle, Prisma schema,
database state або чинної семантики per-item decision service.

## 2. Початковий стан

Початковий Git state:

```text
branch: develop
 M app/(public)/about/page.tsx
```

Staging був порожній. `app/(public)/about/page.tsx` належить сторонній
паралельній роботі й не редагувався в цьому Stage.

До змін `ClientApprovalBatchSection` для кожного
`activeBatch.status === 'SENT' && item.status === 'PENDING'` монтував
`ClientSelectionDecisionControls`. Approve form одразу викликав
`decideClientSelectionItemAction`; reject flow відкривав required textarea,
після чого викликав той самий backend action. Кожен checkbox-equivalent
business decision одразу мутував batch item.

Finalized items відображали read-only повідомлення, а legacy flow був
ізольований у `ClientLegacySelectionSection`.

## 3. Знайдені компоненти та actions

- Server page loader:
  `app/client/requests/[id]/page.tsx`.
- Canonical batch read model:
  `lib/request-selection/client-read-model.ts`.
- Основна batch presentation:
  `components/client/client-approval-batch-section.tsx`.
- Старі per-item controls:
  `components/client/client-selection-decision-controls.tsx`.
- Backend Server Action:
  `decideClientSelectionItemAction()` у `app/client/actions.ts`.
- Domain mutation:
  `lib/request-selection/client-decision.ts`.
- Legacy UI:
  `components/client/client-legacy-selection-section.tsx`.
- Reactive loading/error feedback:
  `components/workflow/reactive-action-form.tsx` і client feedback mappings.

Backend action, decision service, rejection fields і legacy component у цьому
Stage не змінювалися.

## 4. Реалізовані UI-зміни

Створено client component
`ClientSelectionCheckboxList`, який:

- показує semantic checkbox лише для `SENT/PENDING`;
- розташовує checkbox у правій області заголовка item card;
- використовує canonical `RequestSelectionBatchItem.id`;
- прибирає active per-item кнопки `Погодити` та `Відхилити`;
- не показує rejection textarea у pending flow;
- не містить form, Server Action, API call або auto-submit;
- показує reactive summary локального вибору.

Intro copy змінено відповідно до нового тимчасового UX: галочка означає
попередньо погоджену позицію, а відсутність галочки — непогоджену.

## 5. Local state model

State зберігається як immutable `ReadonlySet<string>` із batch item IDs.

```text
initial state: empty Set
checked: add RequestSelectionBatchItem.id
unchecked: delete RequestSelectionBatchItem.id
```

`toggleClientSelection()` завжди повертає новий `Set` і не мутує попередній.
State не пишеться в URL, localStorage, sessionStorage або DB.

Внутрішній stateful component отримує React key:

```text
<batchId>:<revision>
```

Тому інший batch або revision монтує новий local state з усіма unchecked
items.

## 6. Pending vs finalized behavior

| Batch/item state | UI |
|---|---|
| `SENT/PENDING` | інтерактивний unchecked checkbox |
| `SENT/APPROVED` | read-only approved presentation |
| `SENT/REJECTED` | read-only rejected presentation |
| finalized `APPROVED` | без checkbox, approved message |
| finalized `PARTIALLY_APPROVED` | без checkbox, mixed summary |
| finalized `REJECTED` | без checkbox, rejected message |
| historical client comment | read-only, не видаляється |
| legacy fallback | чинний `ClientLegacySelectionSection` |
| active batch відсутній | чинний legacy або empty branch |

`SUPERSEDED` не повертається як active batch current read model; historical
presentation не перетворюється на interactive UI.

## 7. Accessibility

- native `<input type="checkbox">`;
- унікальний `id`, що містить batch ID, revision та batch item ID;
- окремий `<label htmlFor>` із клікабельним текстом;
- keyboard behavior надається native checkbox;
- `focus-visible` ring збережений;
- checked state нативно доступний screen reader;
- status має текстовий label і не передається лише кольором;
- summary має `aria-live="polite"`;
- finalized items не маскуються під disabled interactive controls.

## 8. Responsive behavior

Item header використовує mobile-first column layout і переходить у row лише з
`sm`. Checkbox group має `min-w-0`, wrapping і на desktop обмеження
`sm:max-w-[48%]`. На вузькому екрані control переноситься під item heading,
не перекриває ціну і не створює horizontal scroll.

Main commercial details залишилися в існуючій responsive grid:
1 column → 2 columns → 4 columns.

## 9. Tests

Додано focused script
`scripts/check-request-approval-ui-1-checkbox-selection.ts` і package command
`test:request-approval-ui-1`.

Покрито:

1. pending checkbox і native label;
2. відсутність approve/reject buttons;
3. відсутність rejection textarea;
4. unchecked initial state;
5. check/uncheck immutable transitions;
6. independent multiple selections;
7. reactive summary calculations;
8. canonical batch item IDs;
9. відсутність backend action/import/fetch/storage;
10. read-only approved/rejected rendering;
11. збереження historical rejection comment;
12. different revision/batch state key;
13. відсутність working aggregate form/button.

Stage 5 regression script оновлено лише в UI assertions: backend per-item
decision contract і старий compatibility control продовжують перевірятися.

## 10. Validation

Фінальні gates:

```text
npx.cmd prisma validate — PASS
npm.cmd run test:request-approval-ui-1 — PASS
npm.cmd run test:request-status-stage5 — PASS
npm.cmd run test:request-status-stage5a3 — PASS
npm.cmd run lint — PASS
npm.cmd run typecheck — PASS
git diff --check — PASS
```

Production build не планується через сторонній dirty
`app/(public)/about/page.tsx`, відповідно до Stage build safety gate.

## 11. Changed files

- `components/client/client-approval-batch-section.tsx`;
- `components/client/client-selection-checkbox-list.tsx`;
- `scripts/check-request-approval-ui-1-checkbox-selection.ts`;
- `scripts/check-request-status-stage5-client-approval.ts`;
- `package.json`;
- цей report.

## 12. Не змінювалося

- Prisma schema і migrations;
- БД і persisted selection decisions;
- `Request.status`;
- `RequestSelectionBatch.status`;
- `lib/request-selection/client-decision.ts`;
- `app/client/actions.ts`;
- invoice selection;
- resend/follow-up logic;
- Telegram;
- env/deployment;
- manager/admin UI;
- rejection comment database fields;
- `app/(public)/about/page.tsx`.

## 13. Known limitations

- aggregate submit ще не реалізований;
- checkbox selection поки не записується в БД;
- backend per-item decision logic і старий UI control залишені для
  compatibility, але active batch UI їх більше не монтує;
- вибір втрачається після reload або переходу на іншу revision;
- фінальна кнопка буде підключена в наступному Stage;
- authenticated browser/mobile visual QA не виконувалось у цьому локальному
  code-backed Stage.

## 14. Наступний Stage

Наступний Stage має окремо визначити й реалізувати aggregate backend command:

1. прийняти exact `batchId`, `revision` і selected batch item IDs;
2. повторно перевірити CLIENT ownership та active revision;
3. атомарно перевести selected items у `APPROVED`, решту — у `REJECTED`;
4. фіналізувати batch і Request lifecycle;
5. зробити submit idempotent/concurrency-safe;
6. після success заблокувати local controls і показати server-confirmed state.

Поточний Stage такого command не створює.

## 15. Git state

Перед commit дозволений scope обмежено п’ятьма implementation/test files і
цим report. Сторонній `app/(public)/about/page.tsx` повинен залишитися лише
unstaged modification. Push не виконується.
