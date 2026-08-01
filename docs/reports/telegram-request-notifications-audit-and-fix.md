# Kairos Parts — Telegram Request Notifications Audit and Fix

## 1. Контекст

Аудит і виправлення виконані 2026-08-01 виключно в `develop`. Мета — відновити одне manager-повідомлення після створення Parts-заявки та клієнтські повідомлення для реальних lifecycle-подій. Production, `main`, база даних, webhook і реальні Telegram-чати не змінювалися.

## 2. Початковий Git стан

- `develop` перед роботою: `0e2d913`, дорівнював `origin/develop` після `fetch --prune` і `pull --ff-only`.
- Working tree був чистий; merge/rebase/cherry-pick не виконувалися.
- Наявний сторонній stash збережено без змін.

## 3. Актуальний notification contract

Manager отримує одне повідомлення після успішного створення Parts-заявки. Telegram-клієнт отримує повідомлення лише за наявності зв’язку через `ClientProfile.telegramChatId` і лише для бізнес-подій: початок роботи, SENT approval batch, агреговане фінальне рішення, рахунок, очікування відвантаження, завершення або скасування.

## 4. Карта Telegram integration

```text
Parts creation (web/Telegram)
→ persisted Request + files/draft cleanup
→ notifyNewPartsRequest
→ staff config + template + canonical URL
→ Telegram sendMessage + safe structured log

Lifecycle domain action
→ guarded DB transaction
→ changed/committed result
→ client notification dispatcher
→ ClientProfile/company recipient lookup
→ business-event template + /client/requests/<id>
→ Telegram sendMessage + Notification delivery state
```

Logistics має окремий `NEW_LOGISTICS_REQUEST`; Used Equipment не використовує Parts notifier.

## 5. Manager request-created notification

Web flow `app/api/requests/route.ts` і Telegram flow `lib/telegram/session.ts` мали по одному post-persistence trigger. Вони не викликаються під час rerender/revalidation, а upload failure відбувається до trigger. Notifier є fail-open і журналює категорію результату без token/chat ID.

## 6. Client Telegram identity lookup

Канонічний lookup використовує `Request.client → ClientProfile.telegramChatId`; для company request спочатку обирається primary `CompanyMember`, потім direct client, потім перший linked company member. Відсутня Telegram-прив’язка повертає `skipped-no-recipient` і не створює помилковий delivery record.

## 7. Status lifecycle analysis

Legacy `notifyRequestStatusChange` запускався лише зі старої admin server action, шукав `chatId:` у внутрішніх коментарях тільки для `source=TELEGRAM`, формував generic raw-status текст і не викликався новим API/lifecycle. Його замінено explicit event mapping; status-history insert сам по собі повідомлення не створює.

## 8. Approval batch analysis

`sendRequestSelectionForApproval` уже виконував notifier після успішної transaction. Trigger існує лише після створення й активації SENT batch, тому DRAFT/SUPERSEDED не повідомляють; нова revision отримує окреме повідомлення. Noop/конфлікт до commit не надсилає повідомлення.

## 9. Invoice/shipment/completion events

- Client aggregate submission після commit надсилає одне повідомлення: approved/partial також пояснює перехід до підготовки рахунку; zero-approved повідомляє про cancellation.
- Invoice send зберігає наявний post-commit fail-open workflow та PDF delivery.
- Manual `AWAITING_SHIPMENT`, `COMPLETED`, `CANCELLED` повідомляють лише коли transition має `outcome=changed`, і в server action, і в CRM API route.

## 10. URL generation

Усі CRM/client кнопки використовують `buildAbsoluteUrl`. У production `lib/site-url.ts` безумовно використовує `https://kairos-parts.com.ua`; Vercel Preview/localhost не можуть стати production origin. Фактичні routes підтверджені кодом: `/admin/requests/<requestId>` та `/client/requests/<requestId>`.

## 11. Production environment evidence

Не перевірено: локальний SSH alias `kairos-vps` не налаштований (`ssh -G` не розв’язав реальний host/user). Значення secrets не читалися. Код тепер підтримує production contract `TELEGRAM_BOT_TOKEN` + `TELEGRAM_MANAGER_CHAT_ID`, зберігаючи сумісність з opt-in `STAFF_TELEGRAM_*`.

## 12. Production logs

Не перевірено через відсутній робочий SSH alias. Production logs не читалися; реальні Telegram test messages не надсилалися.

## 13. Git history

- `8df80ce` додав staff notifier і triggers, але одразу ввів окремі `STAFF_TELEGRAM_*` env names.
- `74674af` містив legacy raw-status notifier.
- `f4fdbb1` додав повідомлення approval positions.
- `73b3491`, `d60c3ad`, `8d7ba42` перенесли approval на immutable batch/aggregate flow; legacy status notifier не був перенесений на ці domain actions.
- Cleanup Used Equipment не видаляв Parts notifier глобально.

## 14. Root cause

1. Manager delivery був code-config mismatch: production contract використовував shared bot token і `TELEGRAM_MANAGER_CHAT_ID`, тоді як notifier був вимкнений без `STAFF_TELEGRAM_NOTIFICATIONS_ENABLED=true` та окремих `STAFF_TELEGRAM_*` credentials.
2. Client status delivery був lifecycle integration gap: legacy lookup і trigger не відповідали `ClientProfile`/company identity та новим canonical actions.
3. Approval та invoice notifiers існували, але шаблони не повністю відповідали новому contract; final aggregate decision і manual terminal stages не мали trigger.

## 15. Реалізоване виправлення

Додано explicit client business-event dispatcher, post-commit triggers у draft item creation, aggregate client submission та обидва manual-status entrypoints. Manager config підтримує чинні shared env names. Шаблони, production links, timeout і safe failure persistence узгоджено з contract.

## 16. Manager message template

Повідомлення містить: заголовок «Нова заявка на підбір запчастин», номер, клієнта/компанію, телефон, техніку за наявності, короткий опис, джерело та CRM-кнопку. Web source — «Кабінет клієнта», bot source — «Telegram-бот».

## 17. Client message mappings

| Подія | Одержувач | Trigger | Поточний стан до fix | Реалізація після fix | Посилання | Test |
|---|---|---|---|---|---|---|
| Parts request created | Manager chat | web/bot post-create | config mismatch, неповний template | shared env contract, повний template, один trigger/flow | `/admin/requests/<id>` | `test:telegram-manager-request-created` |
| `NEW → IN_PROGRESS` | linked client | first draft item commit | відсутній trigger | `WORK_STARTED` після changed transition | `/client/requests/<id>` | lifecycle + Stage 3 |
| Active SENT batch | linked client | send-for-approval commit | notifier існував | contract template, revision-aware existing trigger | `/client/requests/<id>` | lifecycle + Stage 4C |
| Approved/partial decision | linked client | aggregate submission commit | trigger відсутній | одне aggregated message + invoice preparation | `/client/requests/<id>` | lifecycle + Stage 5/5A |
| Zero approved | linked client | aggregate submission commit | trigger відсутній | cancellation business message | `/client/requests/<id>` | lifecycle + Stage 5 |
| Invoice sent | linked client | invoice send commit | notifier існував | contract stage text, existing PDF preserved | request + invoice routes | lifecycle + Stage 6 |
| Awaiting shipment | linked client | manual changed transition | legacy lookup only / API gap | explicit event in action and API | `/client/requests/<id>` | lifecycle |
| Completed | linked client | manual changed transition | legacy lookup only / API gap | explicit event in action and API | `/client/requests/<id>` | lifecycle |
| Manager cancelled | linked client | manual changed transition | generic/legacy only | explicit manager-cancel event | `/client/requests/<id>` | lifecycle |

## 18. Deduplication

Окрема schema не потрібна: creation має один post-create call на flow; status/manual notification запускається лише для `outcome=changed`; client submission — лише для `outcome=changed`; invoice workflow і transition є idempotent; approval notification відповідає одному committed SENT batch/revision. Noop, DRAFT і SUPERSEDED не надсилають повідомлень.

## 19. Error handling

Telegram залишається side effect. Всі нові client paths і manager path повертають business result навіть за network/API/persistence failure. Логи містять event, request ID, recipient type, HTTP status/error category без token і повного chat ID. `sendMessage` має 7-second abort timeout; Telegram HTTP/body validation збережено.

## 20. Prisma/schema impact

Prisma schema не змінювалася. Migration не створювалася. Використано наявну `Notification` модель та `ClientProfile.telegramChatId`.

## 21. Regression checks

PASS: обидва нові Telegram checks; request status, Stage 3, selection batch, Stage 4C/4C1/4C2/4C3/4D, Stage 5/5A/5A1/5A2/5A3/6, approval UI 1/2, approval Stage 3/4/6, invoice presentation, Telegram request flow. Stage 4C2 source check зроблено LF/CRLF-neutral для Windows.

## 22. Lint/typecheck/build

PASS: `prisma validate`, `prisma generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run auth:redirect-origin:check`.

## 23. Changed files

Змінено scoped notification/config/templates та їх triggers у request creation, request item, client submission, manual status API/action, Telegram transport, `.env.example`, `package.json`; додано два regression scripts і цей report. Dependencies, Prisma schema та migrations не змінено.

## 24. Commit і push

Запланований єдиний commit: `fix: restore request telegram notifications`; push target: `origin/develop`. Точний SHA і push result фіксуються у фінальному handoff після створення commit, оскільки цей report входить у сам commit.

## 25. Що не тестувалося

Не виконувалися реальні Telegram delivery, production SSH/log inspection, browser E2E з реальним linked account, production deploy або production DB checks.

## 26. Production rollout checklist

1. Перевірити без виведення значень: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MANAGER_CHAT_ID`, `APP_BASE_URL`.
2. Deploy окремим дозволеним production release.
3. Перевірити PM2 logs на structured Telegram events без secrets.
4. Створити одну контрольовану Parts-заявку й пройти lifecycle linked test client.
5. Підтвердити одну delivery на event, canonical links та fail-open UI response.

## 27. Blockers

Code/local verification blockers відсутні. Live production evidence залишається `NOT VERIFIED`, бо робочий SSH alias/credentials у цьому середовищі не доступні. Це не блокувало scoped repair у `develop`, але є обов’язковим rollout gate.
