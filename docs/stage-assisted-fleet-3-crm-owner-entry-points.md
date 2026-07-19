# Kairos Parts — Stage Assisted Fleet 3: CRM owner entry points and fleet overview

## 1. Scope

Етап додає огляд парку техніки до CRM-карток компанії та персонального клієнта, а також довірені вкладені точки входу для майбутнього створення техніки. Форми створення, server actions і записи в БД у цей етап не входять.

## 2. Preconditions: Stage 2A

Stage Assisted Fleet 2A завершено commit `ddb7d6d Normalize vehicle ownership model`. Поточна модель підтримує взаємовиключне володіння технікою: company scope або personal client scope. `prisma migrate status` підтвердив, що підключена Neon database синхронізована з усіма 20 migrations.

## 3. Actual CRM routes found

Використані наявні CRM-картки:

- `/admin/companies/[id]`;
- `/admin/clients/[id]`.

Окремого CRM detail route для `Vehicle` у поточному проєкті немає, тому список техніки залишено read-only без хибних посилань на client routes.

## 4. Company fleet section

У профілі компанії додано секцію `Парк техніки` з кількістю одиниць, компактними картками, empty state і кнопкою `Додати техніку`.

Вибірка має точний scope:

```text
companyId = current company id
clientId = null
```

Персональна техніка учасників компанії до цього списку не потрапляє.

## 5. Personal fleet section

У CRM-профілі клієнта додано аналогічну секцію з exact personal scope:

```text
clientId = current ClientProfile id
companyId = null
```

Техніка компанії не змішується з персональним парком клієнта.

## 6. Trusted owner context

Owner identity не передається через довільний select або hidden input. Вкладений URL містить тільки ID CRM-власника, після чого server page повторно завантажує компанію або `ClientProfile` з БД. Для client route додатково перевіряється роль пов'язаного користувача `CLIENT`.

## 7. New nested routes

Створені маршрути:

- `/admin/companies/[id]/vehicles/new`;
- `/admin/clients/[id]/vehicles/new`.

На цьому етапі вони показують owner context, пояснення наступного етапу та посилання назад. Форма створення й mutation відсутні навмисно.

## 8. Access guards

Обидва nested routes використовують спільний server-side `requireCrmSession()`. Доступ мають тільки `ADMIN` і `MANAGER`; неавторизовані користувачі та `CLIENT` не можуть покладатися на прихований UI для обходу перевірки. Неіснуючий owner повертає `notFound()`.

## 9. Company list query

У `lib/vehicles/admin-queries.ts` додано server-only helper `getAdminCompanyVehicles(companyId)`. Він використовує мінімальний Prisma `select`, exact ownership conditions і стабільне сортування `createdAt desc`, `id desc`.

## 10. Personal list query

Helper `getAdminClientVehicles(clientId)` використовує той самий мінімальний select, але точний personal scope. Обидві вибірки виконуються server-side і не приймають owner identity від клієнтського UI.

## 11. Empty states

Для компанії та персонального клієнта використовуються окремі зрозумілі empty-state тексти. У кожному випадку доступна одна релевантна дія `Додати техніку`, що веде у trusted nested route.

## 12. Existing Vehicle links decision

Посилання на окрему техніку не додавалися, оскільки CRM detail route для `Vehicle` відсутній. Старі посилання на `/client/vehicles/[id]` із CRM-профілю компанії прибрані, бо вони належать іншій access-моделі й могли вести до помилкового або забороненого маршруту.

## 13. Responsive behavior

Reusable server-rendered component використовує responsive grid. На вузьких екранах поля переходять у одну колонку, на tablet/desktop — у компактну багатоколонкову сітку. Таблиця з глобальним horizontal scroll не використовується.

## 14. Security QA

Перевірено кодом:

- exact company/personal ownership predicates;
- відсутність arbitrary owner select;
- повторна server-side role check на nested routes;
- DB-derived owner name and identifiers;
- `notFound()` для відсутнього owner;
- відсутність create/update action у placeholder pages;
- відсутність змін client cabinet.

## 15. Manual QA

Local Next.js server успішно запустився, `/admin/login` завантажився. Авторизований browser smoke test CRM-сторінок не вдалося завершити через локальну TLS-помилку Prisma при підключенні Windows runtime до Neon (`Error opening a TLS connection`). Це environment blocker локального входу, а не compile/build error нових сторінок. Production build підтвердив коректну компіляцію обох nested routes.

Після deploy рекомендовано вручну перевірити:

- company з порожнім і непорожнім exact company fleet;
- personal client з порожнім і непорожнім exact personal fleet;
- відсутність змішування ownership;
- доступ `ADMIN`/`MANAGER` і блокування `CLIENT`/guest;
- layout на 1440, 1024, 768, 430 і 390 px.

## 16. Technical checks

Успішно пройшли:

- `npx.cmd prisma validate`;
- `npx.cmd prisma generate`;
- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd run build`.

`git diff --check` виконується перед commit.

## 17. Prisma and migration status

Prisma schema не змінювалася. Нова migration не потрібна. `npx.cmd prisma migrate status` повернув `Database schema is up to date!`.

## 18. Deferred to Stage 4

Навмисно відкладено:

- повну форму створення техніки;
- create server action/API;
- фото та документи;
- duplicate detection;
- редагування та CRM detail route техніки;
- client cabinet changes;
- перенесення ownership;
- довільний вибір owner.

## 19. Stage 4 blocker

Schema blocker відсутній. Перед Stage 4 потрібно погодити набір полів форми, правила required/optional, duplicate policy та поведінку після успішного створення. Для browser smoke на локальному Windows runtime окремо потрібно усунути TLS-з'єднання Prisma з Neon або виконувати перевірку в deployment environment.
