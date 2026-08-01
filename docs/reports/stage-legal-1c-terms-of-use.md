# Stage Legal 1C — Terms of Use

## 1. Executive summary

На гілці `develop` підготовлено публічну сторінку `/terms-of-use`, пов’язано її з чинними публічними потоками та додано до sitemap. Текст складається з 24 розділів, відповідає фактичній поведінці застосунку й прямо зазначає, що сайт, заявка, статус, погодження позицій, рахунок або комерційна пропозиція самі по собі не утворюють автоматичного договору чи публічної оферти. Документ є технічно узгодженою чернеткою для обов’язкового юридичного погодження.

## 2. Git baseline

- Робоча гілка: `develop`.
- Початковий HEAD: `ce55ba2dde0cfb53ea922dccc934dff473f18684`.
- Legal 1A: `80e5546e5f39797c39a98aaaced11c7e7dc9576b` — ancestor поточного `develop`.
- Legal 1B: `ce55ba2dde0cfb53ea922dccc934dff473f18684` — ancestor поточного `develop`.
- Початкове дерево було чистим; `develop` випереджав `origin/develop` на 2 commits.
- Pull, rebase, merge, push і production deploy не виконувалися.

## 3. Scope and constraints

У scope: Terms page, metadata, footer, пасивне повідомлення реєстрації, дисклеймери Parts і Logistics, sitemap, цільові regression checks, локальний HTTP/browser QA та цей звіт. Поза scope: cookie policy/banner, analytics, оплата, доставка, повернення, гарантія, DB/schema/migrations, webhook, production credentials, production DB, deploy, Nginx, DNS і Search Console mutations.

## 4. Source reports and legal data

Використано звіти Legal 1A і Legal 1B, централізовані реквізити `companyLegalDetails` та фактичний код auth/request/logistics/file flows. Оператор: ТОВ «КАЙРОС ПАРТС», ЄДРПОУ 46387973; адреса й email беруться з єдиного джерела коду. Нормативні формулювання потребують фінальної перевірки юристом проти актуального законодавства України.

## 5. Terms-related flow audit

| Flow | Current behavior | Terms rule | UI integration |
| --- | --- | --- | --- |
| Public browsing | Публічні сторінки доступні без акаунта | Перегляд не є автоматичним укладенням договору | Footer link і публічна Terms page |
| Registration | CLIENT реєструється за чинним phone/password flow | Правдиві дані, безпека акаунта, ознайомлення з Terms/Privacy | Пасивне повідомлення без checkbox |
| Parts request | Форма доступна після входу; заявку опрацьовує менеджер | Заявка не гарантує наявність і не є договором/остаточним замовленням | Дисклеймер перед submit у формі |
| Parts approval | Клієнт погоджує вибрані позиції; рішення фіксується в системі | Це операційне рішення, не КЕП і не автоматичний акцепт оферти | Правило на Terms page |
| Logistics request | Публічна форма; ціну/можливість/дату підтверджує менеджер | Заявка не є автоматичним договором перевезення або гарантією дати | Дисклеймер перед submit |
| Files and vehicles | Авторизовані upload/delete/archive операції залежать від типу матеріалу | Лише дозволені матеріали; немає обіцянки універсального auto-delete | Правило на Terms page |

## 6. Account and authentication rules

Зафіксовано обов’язок надавати точні дані, не передавати дані для входу, діяти лише з належними повноваженнями та повідомляти про компрометацію. Ролі й належність до компанії визначають доступ. Статус `DISABLED` фактично блокує credentials sign-in; Terms не вигадують неіснуючий self-service recovery або масове адміністрування клієнтів.

## 7. Request workflow rules

Заявка описана як звернення, що запускає уточнення менеджером. Статуси — операційні етапи системи, а не самостійні юридичні факти. Наявність, ціна, строки та інші істотні умови підтверджуються окремо.

## 8. Parts approval and document rules

Погодження checkbox-позицій відповідає поточному selection flow: вибрані позиції погоджені, невибрані — ні. Комерційні пропозиції та рахунки можуть формуватися далі, однак Terms не прирівнюють UI-рішення до КЕП, публічної оферти або завершеного договору.

## 9. Logistics request rules

Terms відображають актуальну форму: точні адреси, один тарифний населений пункт, можливість кількох точок, опис вантажу, контакт і бажана дата. Автоматичний чи індивідуальний розрахунок, можливість виконання та дата підтверджуються менеджером.

## 10. User-uploaded materials

Описано право завантажувати лише матеріали, які користувач має право використовувати, та заборону незаконних/шкідливих файлів і зайвих секретів. Права залишаються у користувача або правовласника; оператор отримує вузький технічний дозвіл для роботи сервісу.

## 11. Prohibited activities

Заборонені несанкціонований доступ, чужі акаунти, обхід ролей, атаки, шкідливий код, перевантаження, підміна даних, втручання у статуси/документи, недозволене використання бота/API, шкідливий scraping і незаконне використання.

## 12. Account restriction policy

Обмеження доступу прив’язане до безпеки, порушення Terms, зловживань, вимоги закону, недостовірних даних або технічної перевірки. Формулювання не обіцяє механізмів, яких у продукті немає, та допускає невідкладне обмеження без попереднього notice лише коли це обґрунтовано ситуацією.

## 13. Intellectual property

Захищено дизайн, код, бренд і власний контент. Використання сервісу не передає права на систему; права на завантажені користувачем матеріали не відчужуються.

## 14. Service availability

Не надається абсолютна гарантія безперервності. Вказані технічні роботи, оновлення, інциденти та стороння інфраструктура, а також можлива затримка оновлення даних.

## 15. Liability wording

Відповідальність сформульована вузько: враховано наслідки свідомо неправдивих даних і незалежних сторонніх сервісів поза розумним контролем, але прямо збережено відповідальність оператора у випадках, передбачених законом. Не додано штрафів, арбітражу, гарантій результату чи blanket waiver.

## 16. Claims and contacts

Для звернень і претензій наведено централізовані email та юридичну адресу. Рекомендовано вказувати контакт, опис і номер заявки. Telegram не оголошено офіційною заміною цього каналу; не вигадано фіксований строк відповіді.

## 17. Page structure and implementation

`/terms-of-use` реалізовано як Next.js Server Component без зайвого client boundary. Сторінка має hero, картку оператора, доступний зміст із 24 anchor-посиланнями, 24 семантичні секції та responsive B2B layout із централізованими legal details.

## 18. Metadata, canonical and indexing

- Title: `Умови користування | Kairos Parts`.
- Description: `Правила користування сайтом Kairos Parts, особистим кабінетом, заявками, документами та іншими функціями сервісу.`
- Canonical: `https://kairos-parts.com.ua/terms-of-use`.
- Robots: `index, follow`.
- Open Graph генерується централізованим `createPublicMetadata` з canonical URL.

## 19. Footer integration

Footer отримав навігацію `Правова інформація` з посиланнями на Privacy Policy, Terms of Use і Contacts. Основний контент, контакти та навігаційні блоки не змінено.

## 20. Registration integration

Після submit button додано пасивне повідомлення про ознайомлення з Terms і Privacy. Checkbox, нова валідація, база даних, schema та server action не додавалися; browser QA підтвердив 0 checkbox у registration form.

## 21. Parts request integration

Перед submit у фактичній authenticated Parts form додано точний дисклеймер і legal links. Для неавторизованого відвідувача збережено існуючий auth gate; це підтверджено browser QA. Submit handler, payload і статуси не змінено.

## 22. Logistics request integration

Перед submit додано адаптований дисклеймер про відсутність автоматичного договору/гарантії дати та підтвердження менеджером, а також Terms/Privacy links. Розрахунок, address flow, validation і request creation не змінено.

## 23. Other forms audit

| Form | Terms notice | Privacy notice | Change in 1C | Deferred |
| --- | --- | --- | --- | --- |
| Registration | Так | Так | Пасивне повідомлення, без checkbox | Ні |
| Parts request | Так, у authenticated form | Так | Дисклеймер і links | Ні |
| Logistics request | Так | Так | Дисклеймер і links | Ні |
| Contacts | Ні | Так, required consent | Без змін | Terms notice не потрібен для простого звернення на цьому етапі |
| Used-equipment inquiry | Ні | Ні | Без змін | Окремий legal/lead-form етап після юридичного рішення |
| Login | Footer link | Footer link | Без змін | Ні |
| Forgot password | Footer link | Footer link | Без змін | Flow є skeleton; окреме product scope |

Масові consent checkboxes не додавалися. Для used-equipment inquiry потрібне окреме рішення про текст і правову підставу; це не маскується як завершена робота 1C.

## 24. Sitemap changes

До sitemap додано canonical `/terms-of-use`. Результат: рівно 15 унікальних canonical URL, включно з Privacy, Terms, Logistics, Used Equipment та 7 category children. Точний `/categories` і приватні маршрути відсутні.

## 25. Regression tests

Додано `test:legal-terms-1c`, який перевіряє 24 секції, metadata/canonical/OG/indexing, legal identity, заборонені твердження, відсутність секретів, footer, registration, Parts, Logistics, Contacts, sitemap і robots. Оновлено Legal 1A, Legal 1B та SEO checks для нового 15-URL контракту.

## 26. Validation results

| Validation | Result | Evidence / note |
| --- | --- | --- |
| `npm run test:legal-terms-1c` | PASS | 24 sections, 15 sitemap URLs, exact canonical |
| `npm run test:legal-privacy-1b` | PASS | 19 privacy sections, 15 sitemap URLs |
| `npm run test:legal-contacts-1a` | PASS | canonical, required consent, NEW status |
| `npm run test:seo-crawl-foundation` | PASS | 15 URLs, 10 robots exclusions |
| `npm run test:request-item-manufacturer-free-text` | PASS | 26 checks |
| Client phone validation | PASS | 7 valid, 10 invalid fixtures |
| Client login phone mask | PASS | Static/runtime-free check |
| `npm run test:logistics-address-combobox` | PRE-EXISTING FAIL | Script references removed `lib/features/logistics.ts`; failure occurs before Terms assertions |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run build` | PASS | Next.js 15.5.19; 58 static pages generated; `/terms-of-use` included |
| Local HTTP smoke | PASS | 8/8 routes returned 200 |
| Desktop browser QA | PASS | 1280×720, no overflow, Terms/footer/notices verified |
| Mobile browser QA | PASS | 390×844, no overflow/overlay, responsive navigation and notices verified |
| Isolated browser console | PASS | Clean tabs for Terms/Register/Logistics had no warning/error logs |
| `git diff --check` | PASS | No whitespace errors before report; repeat required at final gate |

## 27. Files changed

- `app/(public)/terms-of-use/page.tsx`
- `app/(auth)/register/register-form.tsx`
- `app/(public)/request/request-form.tsx`
- `components/public/logistics/logistics-request-form.tsx`
- `components/layout/public-layout.tsx`
- `app/sitemap.ts`
- `lib/seo.ts`
- `scripts/check-stage-legal-1c-terms-of-use.ts`
- `scripts/check-stage-legal-1b-privacy-policy.ts`
- `scripts/check-stage-legal-1a-contacts.ts`
- `scripts/check-seo-crawl-foundation.ts`
- `package.json`
- `docs/reports/stage-legal-1c-terms-of-use.md`

## 28. Legal review caveats

Це не юридичний висновок і не фінальна редакція для production. Юрист має перевірити: спосіб прийняття й доказування редакції Terms; співвідношення UI approvals з окремими договорами/рахунками; обмеження відповідальності; порядок претензій; права на матеріали; account restrictions; застосовність норм про електронну комерцію та захист прав споживачів до конкретної B2B/B2C моделі.

## 29. Deferred work

Відкладено: юридичний review, versioning/acceptance evidence за окремим рішенням, used-equipment inquiry notice, завершення forgot-password flow, виправлення stale Logistics regression script, cookie/analytics policy лише якщо такі технології будуть окремо підтверджені, а також усі payment/delivery/returns/warranty документи.

## 30. Production approval checklist

- Отримати письмове юридичне погодження тексту та дати.
- Перевірити production company details і контакти без розкриття секретів.
- Повторити всі Legal/SEO/lint/typecheck/build gates на release commit.
- Перевірити production DB identity/migration status окремим read-only gate, хоча 1C не має migrations.
- Схвалити develop-to-main merge окремо.
- Схвалити production deploy окремо.
- Після deploy виконати live HTTP, metadata, footer, registration, Parts/Logistics і mobile smoke.

## 31. Search Console follow-up

У 1C Search Console не змінюється. Після окремо схваленого production deploy: перевірити live canonical/indexability, повторно надіслати sitemap за потреби, запросити індексацію `/terms-of-use` та відстежити coverage без видалення наявних property/settings.

## 32. Final conclusion

Stage Legal 1C технічно готовий до локального commit і подальшого юридичного review. Реалізація зберігає Legal 1A/1B, не створює публічної оферти чи автоматичного електронного договору, не змінює бізнес-операції, дані або production. Єдиний відомий локальний regression debt — застарілий Logistics address test, що посилається на вже відсутній файл; актуальні Terms/Logistics інтеграції підтверджені цільовим тестом, build, HTTP і browser QA.
