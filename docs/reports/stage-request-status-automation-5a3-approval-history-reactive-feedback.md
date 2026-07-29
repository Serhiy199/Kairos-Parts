# Stage Request Status Automation 5A3 — Approval history presentation and reactive CRM feedback

## 1. Executive summary

Stage 5A3 додав client-safe cumulative history погоджених immutable snapshots,
централізовану admin presentation matrix і реактивний feedback flow для
RequestItem, selection, Invoice та client decision actions. UI отримує
structured result, показує scoped pending state і toast, після чого виконує
`router.refresh()` без повного document reload. Schema, migration, Stage 6,
VPS та Vercel не змінювалися.

## 2. Git and branch state

Робота виконана безпосередньо в `develop`. Базовий Stage 5A2 commit
`2909776ac5fe5b7094b4910d8c72446c571ab28a` міститься в `develop`.
Під час перерваної сесії `develop` незалежно просунувся logistics-комітами до
`4291984`; їх не змінено і не включено до Stage 5A3 scope. `main` не
checkout-илася, push не виконувався. Під час фінальних перевірок у worktree
також з'явився новий паралельний незакомічений logistics diff; він збережений
без змін і не входить до Stage 5A3 commit.

## 3. Confirmed UX requirements

Підтверджено: expandable approved history, рівно два несуперечливі badges у
live admin card, exact Invoice provenance, transient toast плюс persistent
inline state, pending labels, server-confirmed refresh і відсутність F5.

## 4. Current feedback architecture audit

| Mechanism | Exists до 5A3 | Current usage | Recommendation |
| --- | ---: | --- | --- |
| Typed feedback mapping | Так | `lib/admin/request-feedback.ts` | повторно використати для structured results |
| Query-param feedback | Так | admin/client inline alerts після redirect | лишити для legacy/non-reactive actions |
| Persistent inline alerts | Так | lifecycle та Invoice eligibility | не замінювати transient toast |
| Shared toast provider | Ні | відсутній | додати один lightweight root provider |
| Sonner | Ні | dependency відсутня | не встановлювати |
| Radix Toast | Ні | dependency відсутня | не встановлювати |
| React Toastify | Ні | dependency відсутня | не встановлювати |
| `useActionState` / `useTransition` | Так | інші isolated forms/managers | застосувати малий shared wrapper |
| `router.refresh()` | Частково | окремі client components | стандартизувати для Stage 5A3 actions |

## 5. Toast library decision

Обрано Variant B: lightweight internal provider. Нову dependency не додано,
бо проєкт уже мав typed feedback vocabulary і React/Next primitives.
`react-toastify` не встановлювався, `package-lock.json` не змінено.

## 6. Approved history read model

Розширено `getClientRequestApprovalReadModel()` типом
`ClientPreviouslyApprovedItemReadModel`. DTO містить `batchItemId`, revision,
approved time, item/catalog/analog, quantity/unit, approved price/currency,
безпечний vehicle snapshot та `invoiceState`.

## 7. Approved snapshot source

Один Prisma query читає тільки
`RequestSelectionBatchItem.status=APPROVED` через batch зі status
`APPROVED|PARTIALLY_APPROVED`. Live `RequestItem` не є presentation source.
Записи deterministic ordered; deduplication key — `sourceRequestItemId`, а для
detached snapshot — власний snapshot ID. Новіший approved snapshot замінює
старіший того самого source item.

## 8. Invoice membership provenance

Client read model читає лише `invoiceItem.id`. Admin mapper отримує set exact
`InvoiceItem.selectionBatchItemId`. `IN_INVOICE` / `Внесено в рахунок`
встановлюється тільки для точного batch item ID. Інша revision того самого
source item не дає false positive. Поточна policy: наявність `InvoiceItem`
достатня навіть для `DRAFT`; статус Invoice не розширює badge vocabulary.

## 9. Client approved-history accordion

У follow-up `BATCH/SENT` показано collapsed native `<details>`:
«Раніше погоджені позиції», count і пояснення. Compact cards містять name,
catalog, analog, quantity, price, vehicle, revision та invoice badge.
Active follow-up items не дублюються, бо history query читає finalized batches.

## 10. Admin item presentation model

`lib/request-items/admin-presentation.ts` централізує approval/invoice labels,
classes, lock і helper. Page JSX більше не виводить badges з legacy
`visibleToClient`, `approvedByClient` або `includeInInvoice`.

## 11. Approval and Invoice badge matrix

| State | Approval | Invoice |
| --- | --- | --- |
| Draft | Чернетка | Не надіслано клієнту |
| Active pending | Очікує рішення клієнта | Не включено у рахунок |
| Approved, no InvoiceItem | Погоджено | Очікує на створення рахунку |
| Approved, exact InvoiceItem | Погоджено | Внесено в рахунок |
| Rejected unchanged | Відхилено — можна доопрацювати | Не включено у рахунок |
| Rejected changed | Змінено після відхилення | Потребує повторного погодження |
| New follow-up | Нова позиція | Потребує погодження |

## 12. Compact decision summary

Заголовок змінено на «Результат погодження версії №N». Summary показує counts,
batch status і лише rejection item name/comment. Повні live fields не
дублюються, immutable context не видалено.

## 13. Structured Server Action result

`WorkflowActionResult` повертає `ok`, typed `feedback` з `code`, `tone`,
`message`, та optional `refresh`. Raw Prisma errors клієнту не повертаються.
Auth checks і business services виконуються на сервері.

## 14. Pending state architecture

`ReactiveActionForm` використовує окремий `useTransition` на кожну form.
`ReactiveSubmitButton` читає локальний context, блокує duplicate submit і
показує `Додаємо…`, `Зберігаємо…`, `Видаляємо…`, `Відправляємо…`,
`Створюємо рахунок…`, `Надсилаємо…`, `Погоджуємо…` або `Відхиляємо…`.
Непов'язані cards/sections не блокуються.

## 15. Refresh strategy

Після server-confirmed result wrapper показує toast і викликає
`router.refresh()`. Next повторно читає Server Components на тій самій route.
`window.location.reload()`, `location.reload()` і `location.href` у цьому flow
не використовуються. Existing `revalidatePath()` лишився server-side.

## 16. Toast provider and accessibility

`ToastProvider` змонтовано один раз у root `app/layout.tsx`, тому він покриває
admin і client. Toast container має `aria-live`; error має `role=alert`,
success/warning — `role=status`; кожен toast має текстову семантику та
keyboard-focusable close. Durations: success 4 s, warning 6 s, error 9 s.
Responsive width обмежена viewport.

## 17. Feedback code mapping

Admin codes централізовані в `lib/admin/request-feedback.ts`; client decision
codes — у `lib/client/request-feedback.ts`. URL не може передати довільний
toast text. Telegram delivery failure повертається як warning, stale conflict
— як warning із refresh.

## 18. Inline alert compatibility

Persistent lifecycle, selection explanation, Invoice eligibility та blocking
reasons лишилися inline. Toast використовується лише для transient результату
натиснутої reactive action. Reactive actions не додають query-param feedback,
тому одна подія не дублюється після `router.refresh()`.

## 19. Add/edit/delete reactive UX

`createAdminRequestItem`, `updateAdminRequestItem`,
`deleteAdminRequestItem` повертають structured result. Forms мають локальний
pending, toast та refresh. Create form reset-иться лише після success. Approved
edit/delete guards і Audit Log лишилися server-side.

## 20. Send selection reactive UX

`sendAdminRequestItemsForApproval` зберігає version/mode guards, notification
warning і всі revalidation paths, але замість redirect повертає controlled
result. Summary, button eligibility і Request status перечитуються refresh-ом.

## 21. Client decision reactive UX

Approve/reject forms використовують той самий wrapper. Service як і раніше
перевіряє actor, access, revision, batch/item state, comment і transition.
Після success/stale result оновлюються card controls, counts, Request status і
admin read model без F5.

## 22. Invoice create reactive UX

`createAdminInvoice` повертає controlled eligibility result. Після success
refresh додає Invoice block, вимикає create action і змінює тільки exact
approved snapshot badges на «Внесено в рахунок».

## 23. Invoice send reactive UX

`sendAdminInvoice` отримав pending/toast/refresh. Existing Invoice send service
не змінювався. Stage 6 Request transition не додано.

## 24. Concurrency and stale-state handling

Domain version checks, conditional writes, transaction boundaries та locks не
перенесені в browser. `item-stale` і selection stale повертають warning з
`refresh=true`; failed state не застосовується optimistically.

## 25. Mobile UX

Accordion/cards мають `min-w-0`, wrapping badges, `break-words` та
`overflow-wrap:anywhere` для catalog values. Toast width використовує
`calc(100vw - 2rem)`. Native `<details>/<summary>` підтримує keyboard toggle.
Static responsive/a11y checks PASS; authenticated visual 320–390 px smoke
pending через browser runtime blocker.

## 26. Tests

Додано `npm.cmd run test:request-status-stage5a3`. Він перевіряє cumulative
dedupe, safe DTO, exact provenance, same-source/different-revision negative
case, повну badge matrix, helper wording, accordion, root provider,
structured actions, `useTransition`, `router.refresh()` і заборону full reload.
Старі static regressions адаптовано до centralized presentation/read model.

## 27. Authenticated browser smoke

Authenticated action smoke не виконано. Desktop browser runtime завершився до
відкриття вкладки з `failed to write kernel assets: path not found`. Credentials
або test fixture не підмінялися. Тому add/edit/delete, send selection, client
approve/reject, Invoice create/send і visual mobile scenarios позначені
`PENDING`, а не `PASS`.

## 28. Runtime logs

Локальний Next dev server на `127.0.0.1:3127` відповів `200` для `/`.
Неавторизовані `/admin/requests` і `/client/requests` коректно повернули `307`
на відповідні login routes. Під час цих HTTP requests application error не
спостерігався. Authenticated mutation logs відсутні, бо browser session
недоступна.

## 29. Regression results

PASS: Prisma validate/generate; Stage 2 status transition; Stage 3; Stage 4B;
Stage 4C, 4C1, 4C2, 4C3, 4D; Stage 5, 5A, 5A1, 5A2, 5A3; Audit Log 2–5;
lint; `git diff --check`. Legacy regressions, які шукали inline badge strings
або old redirect, оновлено до нової canonical boundary.

Поточний global `typecheck` — `FAIL` через паралельний logistics файл
`components/public/logistics/logistics-address-combobox.tsx:119,201`:
`"" | LogisticsTariffCityCode` не сумісний із `LogisticsTariffCityCode`.
Перед появою цього стороннього diff Stage 5A3 typecheck і build проходили.
Фінальний global build також `FAIL`: активний сторонній Next dev процес
використовує спільний `.next`, а prerender `/how-it-works` завершився
`Cannot read properties of undefined (reading 'call')`. Ці FAIL не маскуються
як PASS і сторонній logistics/dev-server scope не виправлявся та не зупинявся.

## 30. Prisma and DB safety

`prisma/schema.prisma` не змінено, migration не створено. `prisma validate` і
`prisma generate` не змінюють data. `migrate`, `db push`, reset, Neon/VPS writes
не виконувалися.

## 31. Changed files

- admin/client actions і request detail presentation;
- root layout, toast provider і reactive form wrapper;
- client approval history read model/UI;
- admin presentation mapper і resend provenance DTO;
- typed admin/client feedback/result modules;
- Stage 4C1/4D/5/5A2 compatibility checks;
- Stage 5A3 focused test і `package.json`;
- цей report.

## 32. Known limitations

Authenticated browser action proof і visual mobile screenshot pending через
desktop browser runtime. Reject cancel focus-return не доведено browser smoke.
Full revision-history page, additional Invoice та reopening approved item
відсутні за scope.

## 33. What was intentionally excluded

Не реалізовано Stage 6, `AWAITING_INVOICE → INVOICE_SENT`, Invoice
cancellation/reissue redesign, additional Invoice, full revision UI,
WebSocket/optimistic DB writes, schema/migration, VPS/Vercel deploy, merge або
push.

## 34. Stage 6 readiness

Stage 5A3 domain implementation локально готова, але repository-wide Stage 6
development gate наразі `BLOCKED`: потрібно завершити паралельний logistics
diff, виправити його typecheck і повторити clean build без активного процесу,
який використовує `.next`. Vercel runtime testing readiness: ні — додатково
потрібні окремі push/deploy authorization і authenticated Stage 5A3 smoke.

## 35. Final conclusion

Stage 5A3 локально реалізує approved history, exact invoice provenance,
несуперечливу badge matrix і reactive server-confirmed feedback без F5.
Domain safety збережена, schema/Stage 6/VPS не змінені. Stage/domain/lint/HTTP
checks пройдені; поточні global typecheck/build заблоковані паралельною
logistics роботою та shared `.next`, а authenticated browser scenarios чесно
лишаються pending.
