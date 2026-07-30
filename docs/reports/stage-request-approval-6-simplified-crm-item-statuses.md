# Stage Request Approval 6 — Simplified CRM item approval statuses

## 1. Мета

Спростити відображення результату клієнтського погодження в CRM: один canonical badge у колонці `КЛІЄНТ`, без дубльованого finalized summary та без invoice-related badge, який не є статусом клієнтського рішення.

Stage виконано як UI-only зміна на гілці `develop`. Початковий `git status --short`:

```text
 M app/(public)/about/page.tsx
```

Сторонню зміну `app/(public)/about/page.tsx` не редагували й не включали до Stage.

## 2. Початковий UI

`RequestItemsSection` у `app/admin/requests/[id]/page.tsx` одночасно показував:

- верхній aggregate finalized summary;
- два badges у кожній картці позиції;
- повторюваний read-only footer у кожній finalized card.

Це дублювало один і той самий результат погодження та могло показувати `Чернетка` для вже фіналізованої позиції.

## 3. Дубльовані елементи

Аудит встановив:

- верхній finalized summary формував `buildFinalizedSelectionSummary` безпосередньо в `RequestItemsSection`;
- client status та invoice badge формував `getAdminRequestItemPresentation`;
- `Не включено у рахунок` був лише presentation label і не походив з invoice resolver;
- client Request detail використовує власний finalized summary і в цьому Stage не змінювався;
- finalized batch decisions зіставляються з актуальними `RequestItem` через `sourceRequestItemId`.

## 4. New client-status mapping

| Lifecycle state | UI badge | Color | Additional badge |
|---|---|---|---|
| Draft | Чернетка | neutral | none |
| SENT/PENDING | Очікує рішення клієнта | warning | none |
| APPROVED | Погоджено | success | none |
| REJECTED | Не погоджено | danger | none |

Canonical UI mapping зосереджений у `lib/request-items/admin-presentation.ts`. Finalized decision має пріоритет над resend state, тому погоджена або відхилена позиція не повертається в UI до `Чернетка`.

## 5. Removed summary block

Finalized summary прибрано лише з основної CRM-секції `Підібрані позиції`. У цій секції більше не показуються aggregate counts, `Версія підбору` і `Дата погодження`.

Дані revision, timestamps, batch status, audit і history не видалялися. Не-finalized summary active batch збережено для pre-final роботи менеджера.

## 6. Removed badges

З active CRM rendering прибрано:

- `Не надіслано клієнту`;
- `Не включено у рахунок`.

Presentation mapper більше не формує окремий invoice badge. Actual invoice selection та invoice CTA не змінювалися.

## 7. Finalized item presentation

Кожна finalized позиція показує один badge: `Погоджено` або `Не погоджено`. Rejection comment відображається read-only у відповідній картці.

Повторюваний footer `Клієнт завершив погодження. Позиція доступна лише для перегляду.` видалено. Один загальний текст `Клієнт завершив погодження. Підбір доступний лише для перегляду.` залишається над списком через наявний `requestSelectionMessage`.

## 8. Pre-final behavior

Для `WAITING_APPROVAL` з active `SENT` збережено:

- `Редагувати позицію`;
- `Видалити`;
- `Оновити підбір для клієнта`, коли eligibility фіксує unpublished changes.

Зміни до send/resend service або manager mutation policy не вносилися.

## 9. Legacy compatibility

Historical approved/rejected decisions відображаються через finalized batch snapshot. `PENDING` historical state має read-only warning label. `clientComment`, revisions і `SUPERSEDED` semantics не видалялися.

Client-side finalized summary, checkbox flow та legacy read-only components не змінювалися.

## 10. Responsive behavior

Desktop minimum width колонки `КЛІЄНТ` збільшено зі `140px` до `180px`. Badge має `max-w-full`, центрований текст і не примушує mobile/tablet card до desktop grid. На малих ширинах допускається контрольований перенос, а з `sm` badge залишається в один рядок.

Browser QA у цьому Stage не виконувався; responsive висновок підтверджено статичним аналізом Tailwind layout.

## 11. Accessibility

Кожен badge:

- містить текстове значення стану;
- має `aria-label` виду `Статус клієнта: ...`;
- не покладається лише на колір;
- використовує чинні success/warning/neutral/danger styles.

## 12. Tests

Додано `scripts/check-request-approval-stage6-simplified-crm-statuses.ts` і npm script `test:request-approval-stage6`.

Focused test: **PASS, 24/24 сценарії**.

Пов’язані regression suites:

- Approval UI 1, UI 2, Stage 3, Stage 4, Stage 5: **PASS**;
- Stage 5/5A/5A1/5A2/5A3: **PASS**;
- request item persistence: **PASS**;
- selection batch, send і resend: **PASS**;
- invoice creation/selection та invoice send: **PASS**;
- request lifecycle: **PASS**;
- Admin Audit Log 3/4/5: **PASS**.

`check-admin-audit-log-2.ts` має pre-existing unrelated failure: global source scan знаходить committed test double `auditLog.create(...)` у `scripts/check-request-approval-stage4-simplified-invoice-selection.ts`. Stage 6 не створював цей виклик і не змінював audit runtime.

## 13. Validation

- `npx.cmd prisma validate`: **PASS**;
- `npm.cmd run lint`: **PASS**;
- `npm.cmd run typecheck`: **PASS**;
- `git diff --check`: **PASS**.

Build не запускався, оскільки в worktree присутня стороння dirty-зміна `app/(public)/about/page.tsx`, а prompt дозволяє build лише без safety risk для цього файла.

## 14. Changed files

- `app/admin/requests/[id]/page.tsx`;
- `lib/request-items/admin-presentation.ts`;
- `package.json`;
- `scripts/check-request-approval-stage6-simplified-crm-statuses.ts`;
- `scripts/check-request-approval-stage5-final-state-lockdown.ts`;
- `scripts/check-request-status-stage4c1-resend-after-edit.ts`;
- `scripts/check-request-status-stage5a3-reactive-feedback.ts`;
- `docs/reports/stage-request-approval-6-simplified-crm-item-statuses.md`.

## 15. Not changed

Не змінювалися:

- Prisma schema, migrations і БД;
- aggregate client submit та checkbox semantics;
- RequestSelectionBatch decisions і Request statuses;
- manager edit/resend backend;
- invoice resolver, creation і send;
- audit/history runtime;
- Telegram, env і deployment;
- client Request detail;
- `app/(public)/about/page.tsx`.

## 16. Known limitations

- Browser QA для desktop/tablet/mobile не запускався.
- `check-admin-audit-log-2.ts` залишається заблокованим описаним pre-existing конфліктом власного global source scan; інші audit regressions проходять.

## 17. Git state

Робоча гілка: `develop`.

Базовий Stage 5 commit: `b69313eb91f7987f033b457bcd5333ef042607e4`.

До Stage commit мають увійти лише файли з розділу 14. `app/(public)/about/page.tsx` має залишитися unstaged. Push у межах Stage не виконується.
