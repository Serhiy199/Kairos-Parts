# Kairos Parts — Public Pages Content Audit

Дата аудиту: 19 липня 2026 року
Формат: docs-only, без змін у компонентах, маршрутах, стилях, даних або бізнес-логіці.

## 1. Executive summary

Публічна частина Kairos Parts уже має зрозумілий візуальний каркас і правильні базові сторінки для B2B-сервісу: головна конвертує, `/how-it-works` пояснює процес, `/advantages` деталізує цінність, `/contacts` розділяє загальні звернення і структуровану заявку, `/categories` пояснює напрями підбору, а `/used-equipment` має окремий сценарій звернення щодо техніки.

Основна контентна проблема — не відсутність сторінок, а розмиті межі між Homepage, `/about` і `/advantages`. Ті самі теми — перевірений підбір, постачальники, персональний менеджер, цифрова історія та парк техніки — повторюються як переваги, сервіс, принципи, підхід і пояснення моделі роботи. Через це `/about` слабше відповідає на питання «Хто така Kairos Parts і чому їй можна довіряти?» та частково перетворюється на ще одну продуктову сторінку.

Критичніші за дублювання проблеми стосуються точності обіцянок і конверсійного маршруту:

- телефон `+38 (000) 000 00 00` та email `hello@kairos-parts.example` є очевидними placeholder-даними, але показуються як реальні контакти на `/contacts` і у footer;
- footer містить технічний текст `MVP public website foundation`, неприйнятний для production-публікації;
- основні CTA обіцяють «Створити заявку», але `/request` для гостя показує auth gate, а не форму; це не пояснено у Homepage, `/advantages`, `/about`, `/how-it-works`, `/contacts` і category pages;
- на формі заявки збираються персональні дані, але немає окремого consent/privacy блоку, тоді як contact form має обов’язкову згоду;
- твердження про гарантію, відтермінування оплати, роботу по всій Україні, графік, видачу в Кагарлику та «перевірену» техніку/партнерів потребують підтвердження й правил використання;
- `/categories` фактично існує, але не входить до header/footer navigation і не має інших вхідних посилань поза власними дочірніми сторінками.

Підсумок інвентаризації:

- 11 public page-route шаблонів;
- 7 конкретних статично згенерованих category detail URL;
- 35 декларацій `<section>` у public page components, включно з conditional auth/error/empty states;
- 36 змістових секцій/станів оцінено в Додатку A: окремо від literal `<section>` пораховано основний detail article `/used-equipment/[slug]`;
- 5 пар/груп із високим ризиком дублювання;
- 9 пар/груп із середнім ризиком дублювання;
- 3 допустимі або низькоризикові повторення.

Перший наступний етап має бути не редизайном, а `Stage CA-1 — Content facts and conversion contract`: погодити реальні контакти, комерційні обіцянки, географію, критерії «перевіреності», роль used-equipment майданчика і точний auth/anonymous flow заявки. Без цього переписування сторінок ризикує лише краще оформити непідтверджені твердження.

### Методика та межі доказовості

- Current-state висновки базуються на фактичних `page.tsx`, пов’язаних data arrays, формах, navigation і Prisma enum.
- Динамічний контент БД для `/used-equipment/[slug]` і `/request/status/[token]` оцінено за шаблоном компонента, а не за конкретними production-записами.
- Функціональність форм підтверджена на рівні коду; у межах docs-only аудиту зовнішні повідомлення, БД-записи й Telegram не створювалися.
- Рекомендації нижче чітко відокремлені від фактичного стану. Непідтверджені бізнес-факти не подаються як правда.

### Шкала оцінювання

`У` — унікальність; `Д` — доречність; `З` — зрозумілість; `Ц` — цінність користувачу; `РД` — ризик дублювання; `ВС` — відповідність сторінці. Усі оцінки від 1 до 5. Для `РД`: 1 — майже немає дублювання, 5 — сильне дублювання.

## 2. Повний список public routes

| № | Route | Page file | Тип | Доступність / джерело |
|---:|---|---|---|---|
| 1 | `/` | `app/(public)/page.tsx` | static | Головна, логотип у header |
| 2 | `/about` | `app/(public)/about/page.tsx` | static | Header/footer navigation |
| 3 | `/how-it-works` | `app/(public)/how-it-works/page.tsx` | static | Header/footer navigation |
| 4 | `/advantages` | `app/(public)/advantages/page.tsx` | static | Header/footer navigation |
| 5 | `/contacts` | `app/(public)/contacts/page.tsx` | static + server action form | Header/footer navigation |
| 6 | `/categories` | `app/(public)/categories/page.tsx` | static | Немає посилання у global navigation |
| 7 | `/categories/[slug]` | `app/(public)/categories/[slug]/page.tsx` | SSG | Контекстні посилання з `/categories` |
| 8 | `/used-equipment` | `app/(public)/used-equipment/page.tsx` | dynamic | Header/footer navigation |
| 9 | `/used-equipment/[slug]` | `app/(public)/used-equipment/[slug]/page.tsx` | dynamic | Картка опублікованої техніки |
| 10 | `/request` | `app/(public)/request/page.tsx` | session-dependent | Глобальний CTA; форма лише для CLIENT |
| 11 | `/request/status/[token]` | `app/(public)/request/status/[token]/page.tsx` | dynamic token route | Посилання після створення заявки |

`/categories/[slug]` має 7 підтверджених статичних значень:

1. `/categories/agricultural-parts`
2. `/categories/truck-parts`
3. `/categories/tires-tubes`
4. `/categories/trailers-semitrailers`
5. `/categories/commercial-transport`
6. `/categories/universal-parts`
7. `/categories/consumables`

Динамічні used-equipment slugs і public status tokens залежать від БД, тому їхню кількість не можна чесно визначити з репозиторію.

### Global navigation

Header і footer містять `/about`, `/how-it-works`, `/used-equipment`, `/advantages`, `/contacts`; логотип веде на `/`; окремий CTA веде на `/request`. `/categories` у global navigation відсутня. Public status page навмисно не потребує global navigation, бо є utility-route за токеном.

## 3. Карта сторінок і секцій

### Homepage `/`

Мета: коротко позиціонувати сервіс і привести до заявки.
Головна дія: `/request` або Telegram.

1. **Hero** — eyebrow `Kairos Parts — сервіс для B2B-клієнтів аграрної та транспортної галузі.`; H1 `Підберемо запчастини для вашої техніки за одним запитом`; CTA на заявку/Telegram; нижня trust/fleet panel.
2. **Як це працює** — H2 `Заявка, підбір, узгодження та доставка в одному процесі`; 5 коротких кроків.
3. **Переваги** — H2 `Що ви отримуєте, працюючи з KAIROS PARTS`; 6 карток бізнес-переваг.
4. **Сервіс** — H2 `Все для ефективного обслуговування вашої техніки — в одній платформі`; 5 функцій/сервісних обіцянок.
5. **Для кого** — H2 `Для компаній, де техніка має працювати, а не чекати`; 6 аудиторій.
6. **Способи створення заявки** — H2 `Оберіть зручний спосіб та залиште заявку за 5 хвилин`; фото, Telegram, web form, файли, менеджер.

Висновок: Homepage має всі потрібні базові блоки, але перевантажена трьома сусідніми доказово схожими шарами — `Переваги`, `Сервіс`, `Для кого`. Останній блок добре виконує роль supporting CTA, однак wording про web form не пояснює auth requirement.

### `/about`

Мета: пояснити, хто така Kairos Parts, її модель, місію та підстави довіри.
Головна дія: перейти до заявки.

1. **Hero** — eyebrow `Про Kairos Parts`; H1 `Будуємо новий стандарт підбору запчастин для бізнесу`.
2. **Про компанію** — H2 `Сервіс, створений навколо потреб бізнесу`; всередині `Наша місія — Спростити обслуговування техніки` і `Що ми робимо — Не магазин, а центр підбору`.
3. **Коли звертатися** — H2 `Ситуації, у яких важливо швидко знайти правильне рішення`; 8 сценаріїв.
4. **Чому це працює / Наш підхід** — дві картки: `Кожне замовлення створює цінність на майбутнє` та `Сервіс навколо потреб клієнта`.
5. **Для кого створено Kairos Parts** — H2 `Для компаній із технікою, яка має працювати щодня`; 6 аудиторій.
6. **Наші принципи** — H2 `Працюємо як довгостроковий сервісний партнер`; 5 принципів і стандартний final CTA `Готові передати нам запит?`.

Висновок: місія і модель роботи доречні, але сторінка майже не містить company evidence: історії, команди, реальних фактів, географії, кейсів або підтверджених доказів. Натомість три секції повторюють продуктову цінність Homepage/Advantages. `Коли звертатися` корисна й відносно унікальна, але слабше відповідає ролі About, ніж блок про експертизу або доказовий operating model.

### `/how-it-works`

Мета: повністю пояснити процес від акаунта до цифрової історії.
Головна дія: створити заявку або перейти в Telegram.

1. **Hero + trust panel** — H1 `Від заявки до доставки — зрозумілий процес у 7 кроків`; 4 пункти `Швидко`, `Надійно`, `Прозоро`, `Оперативна доставка`.
2. **Детальний процес** — H2 `7 кроків від заявки до доставки`; 7 кроків і final CTA `Готові передати нам запит?`.

Висновок: межа між 5-step Homepage overview і 7-step detail правильна. `/how-it-works` пояснює реєстрацію, разову заявку, підбір, погодження, оплату, доставку та історію. Слабке місце — відсутність окремого пояснення «що підготувати», відмінності між registered/one-off request, очікувань після submit і FAQ. Trust panel переважно повторює принципи/переваги.

### `/advantages`

Мета: деталізувати бізнес-результати від роботи з Kairos Parts.
Головна дія: створити заявку або перейти в Telegram.

1. **Hero** — eyebrow `Переваги Kairos Parts`; H1 `Менше простоїв. Більше контролю над технікою`.
2. **Ключові переваги** — H2 `Що отримує ваша компанія`; 6 розгорнутих benefit blocks.
3. **Різниця в процесі** — H2 `Від хаотичної закупівлі до керованого процесу`; `Було / З Kairos Parts` і final CTA.

Висновок: сторінка справді розгортає короткі homepage benefits і має comparison block. Найслабші місця — майже буквальне повторення назв 5 із 6 карток Homepage, відсутність proof/cases та змішування benefit `Майданчик перевіреної техніки` з окремим продуктом `/used-equipment`.

### `/contacts`

Мета: дати канали зв’язку для загальних питань, партнерства й уточнень.
Головна дія: надіслати contact message; для підбору перейти на `/request` або Telegram.

1. **Hero** — eyebrow `КОНТАКТИ`; H1 `Зв’яжіться з командою Kairos Parts`; CTA на request/Telegram.
2. **Зв’яжіться з нами** — H2 `Оберіть зручний спосіб зв’язку`; контактна інформація та форма `Напишіть нам`.

Висновок: різниця між contact form і request form пояснена прямо. Форма має topic, phone/email rule і consent. Критичний blocker — placeholder phone/email; графік також потребує підтвердження. Hero частково повторює наступну секцію, але це допустима ієрархія, якщо скоротити формулювання.

### `/categories`

Мета: зорієнтувати користувача у напрямах підбору без імітації ecommerce-каталогу.
Головна дія: відкрити напрям або створити заявку.

1. **Hero** — eyebrow `Напрями підбору`; H1 `Категорії, підкатегорії та виробники для швидкого старту заявки`.
2. **Category grid** — 7 напрямів із description, прикладами підкатегорій, виробниками та CTA.

Висновок: текст чітко говорить, що це не магазин і не каталог товарів із цінами. Сторінка корисна, але фактично orphaned від global navigation. Переліки виробників слід вважати заявою про capability й підтвердити у клієнта.

### `/categories/[slug]`

Мета: дати конкретний напрям і підготувати category-specific request.
Головна дія: створити заявку або надіслати фото/список.

1. **Dynamic hero** — H1 `{category.name}`; description і два CTA.
2. **Підкатегорії / Виробники** — H2 `Що можна вказати у заявці` і `Стартовий перелік`.
3. **Як створити заявку по цій категорії** — 3 короткі кроки й CTA.

Висновок: логіка сторінки завершена й не схожа на товарний PDP. Process block частково дублює `/how-it-works` і request prep, але category-specific hint робить повторення корисним.

### `/used-equipment`

Мета: показати лише опубліковані оголошення вживаної техніки.
Головна дія: відкрити оголошення.

Primary state:

1. **Hero** — eyebrow `Майданчик БВ техніки`; H1 `Перевірена техніка для роботи`.
2. **Каталог** — H2 `БВ техніка`; grid і pagination.

Conditional states:

3. **Empty state** — H2 `Доступної БВ техніки поки немає`.
4. **Error state** — H2 `Каталог тимчасово недоступний`.

Висновок: schema має лише `DRAFT`, `PUBLISHED`, `ARCHIVED`; `SOLD` і `RESERVED` відсутні. Public queries повертають лише `PUBLISHED`. Сторінка не пояснює, чи Kairos є продавцем/власником, що саме означає «перевірена», хто відповідає за стан техніки й що відбувається після inquiry. Це потребує trust/disclaimer block і підтверджених business rules.

### `/used-equipment/[slug]`

Мета: показати конкретну опубліковану техніку та зібрати inquiry на перегляд.
Головна дія: `Запит на перегляд техніки`.

1. **Detail article** — breadcrumbs, gallery, title, manufacturer/type/year, inquiry CTA.
2. **Опис техніки** — H2 `Опис техніки`, rich text від менеджера.
3. **Error state** — H1 `Сторінка тимчасово недоступна` при відсутній БД.

Висновок: CTA відповідає inquiry-моделі, але бракує disclosure про роль Kairos, verification criteria, власника, доступність і limitations. Відсутність SOLD/RESERVED означає, що wording не повинен обіцяти актуальну комерційну доступність без окремого підтвердження.

### `/request`

Мета: створити структурований запит на підбір.
Головна дія: submit request після CLIENT authentication.

Authenticated CLIENT state:

1. **Hero** — eyebrow `Створити заявку`; H1 `Заявка на підбір запчастин`.
2. **Form + Що підготувати** — контактні дані, техніка, VIN/serial, опис, файли, supporting checklist.

Alternative state:

3. **Auth gate** — H1 `Створення заявки доступне після входу` або `Профіль клієнта потребує налаштування`; login/register CTA.

Висновок: authenticated form має добрий supporting checklist, upload guidance і success/status flow. Проблеми: усі public CTA приховують обов’язковість входу; auth gate не пропонує Telegram як альтернативу; request form не має consent/privacy acknowledgement; немає короткого next-steps блоку про те, що відбувається після submit. Це функціонально відрізняється від `/contacts`, тож прямого дублювання форм немає.

### `/request/status/[token]`

Мета: показати поточний статус і timeline заявки без входу.
Головна дія: інформаційна; очікувати наступного контакту менеджера.

1. **Status dashboard** — eyebrow `Статус заявки`; номер, status description, request facts, short description, timeline.
2. **DB-missing state** — H1 `База даних не налаштована`.

Висновок: utility page унікальна й логічна. Можна додати contextual contact/back CTA, але не перетворювати її на маркетингову сторінку. Питання access/security token не входить до цього content-only аудиту.

## 4. Аналіз homepage

Homepage має чіткий Hero, пояснення сервісу, short process, переваги, аудиторії, способи створення заявки та trust layer. Окремий generic final CTA не потрібен, бо остання секція вже виконує conversion function.

Що працює:

- H1 одразу пояснює service, equipment context і one-request model;
- 5 steps коротші за detail page і не порушують вимогу «рівно 5»;
- `/advantages` має достатньо глибший контент, щоб внутрішня сторінка була виправдана;
- request channels дають кілька форматів input.

Що перевантажує:

- Hero fleet panel, `Переваги` та `Сервіс` тричі повторюють digital history, suppliers, repeat order і management value;
- `Переваги` містить окремий used-equipment product, який слабко пов’язаний з основним parts request flow;
- `Для кого` майже повністю повторюється на `/about`;
- твердження `Надійні постачальники і гарантія`, `Відтермінування оплати`, `Кагарлик` потребують підтвердження.

Рішення: залишити Hero, 5-step process, короткі Benefits, одну audience summary і request methods; секцію `Сервіс` переписати як конкретні platform capabilities або скоротити/об’єднати з Hero fleet panel. Не переносити на Homepage довгі пояснення з `/advantages`.

## 5. Аналіз /about

Сторінка частково відповідає на питання «Хто така Kairos Parts і чому їй можна довіряти?» через mission і model, але не доводить це фактами. Немає підтвердженої історії, команди, юридичних/операційних фактів, кейсів, партнерських дозволів або конкретної експертизи.

Конкретні рішення:

- Hero і `Про компанію / Наша місія / Що ми робимо` — **залишити, але скоротити повтори product benefits**.
- `Коли звертатися` — **перенести на `/how-it-works` або змінити тему на expertise/decision model**; current content унікальний, але fit для About лише середній.
- `Чому це працює / Наш підхід` — **об’єднати з company model**, бо дві картки повторюють digital history і service benefits.
- `Для кого створено Kairos Parts` — **змінити тему**; це прямий дублікат Homepage.
- `Наші принципи` — **переписати як реальні правила роботи**, а не назви переваг. Напрям: як перевіряється підбір, як фіксуються домовленості, як команда повідомляє обмеження, як зберігається контекст. Потребує validation клієнта.
- Додати evidence layer можна лише після отримання підтверджених facts/team/cases.

## 6. Аналіз /how-it-works

Homepage 5 steps і `/how-it-works` 7 steps мають правильну ієрархію:

- Homepage дає short overview без реєстраційних деталей;
- detail page додає cabinet, окрему комплектацію/доставку й детальнішу цифрову історію;
- кроки 2–5 повторюють назви Homepage майже буквально, але це допустиме навігаційне повторення, а не зайва секція.

Доречні supporting blocks:

1. `Що підготувати для заявки` — можна додати зараз на основі actual request fields.
2. `Зареєстрована чи разова заявка` — спершу потрібно чітко узгодити, чи «разова» все одно вимагає CLIENT account.
3. `Що відбувається після submit` — можна описати на основі status flow без SLA.
4. FAQ про сумісність, комерційну пропозицію, документи, доставку й історію — частково можна додати зараз; строки/SLA/гарантії потребують даних клієнта.

Trust panel не потребує видалення, але його загальні `Швидко/Надійно` слід або зробити process-specific, або підтвердити фактичними правилами.

## 7. Аналіз /advantages

Homepage дає коротку версію, а `/advantages` справді розкриває тему двома абзацами та зображенням на benefit. Обидві секції мають сенс, але назви й порядок надто буквальні.

Рекомендація:

- Homepage формулює 4–5 коротких outcomes;
- `/advantages` пояснює механізм, business impact, limitation і доказ;
- `Майданчик перевіреної техніки` винести з core benefits у supporting cross-product block або замінити на parts-service benefit;
- `Було / З Kairos Parts` залишити: це корисний comparison block, хоча він стисло повторює попередні benefits;
- social proof/cases додавати лише з реальними матеріалами клієнта.

## 8. Аналіз /contacts

Сторінка правильно пояснює:

- `/request` — для структурованого підбору;
- contact form — для загальних питань, партнерства і статусу;
- Telegram — окремий швидкий канал.

Форма має необхідну topic segmentation і consent. FAQ не є пріоритетом: route достатньо коротка. Потрібно:

1. замінити placeholder phone/email;
2. підтвердити графік;
3. узгодити, чи Telegram bot є каналом загальних звернень чи тільки request creation;
4. після цього скоротити дублювання Hero і contact-section intro.

## 9. Аналіз /categories

Сторінка однозначно позиціонує категорії як напрями підбору, а не ecommerce. Це сильна сторона. На detail page уже є `Як створити заявку по цій категорії`, тому дублювати повну інструкцію на listing не потрібно.

Рекомендації:

- додати discoverable link у navigation/footer або релевантний Homepage block;
- підтвердити manufacturer lists і право використовувати бренди як capability examples;
- на listing достатньо compact `Як користуватися напрямами` з 2–3 речень, не нова велика секція;
- category CTA бажано передавати category query у `/request`, якщо це відповідає product flow; це окреме майбутнє функціональне завдання.

## 10. Аналіз /used-equipment

Підтверджено:

- enum: тільки `DRAFT`, `PUBLISHED`, `ARCHIVED`;
- public status: тільки `PUBLISHED` з label `Доступно`;
- `SOLD` і `RESERVED` у schema/content відсутні;
- detail CTA — inquiry `Запит на перегляд техніки`, а не checkout.

Непідтверджено:

- хто юридично продає техніку;
- що саме перевіряє Kairos;
- чи гарантується технічний стан;
- чи ціна/наявність узгоджується після inquiry;
- чи Kairos є агентом, майданчиком або продавцем.

Рішення: додати trust/disclaimer block лише після погодження business role. До цього уникати абсолютного wording `перевірена техніка` без пояснення критеріїв. Status model не розширювати в межах content task; якщо потрібні SOLD/RESERVED — це окреме product/schema рішення.

## 11. Аналіз /request

`/request` не дублює `/contacts`: поля, мета, backend flow і результат різні. Authenticated form добре пояснює required data та підтримує files.

Проблеми:

- public marketing створює очікування доступної web form, але guest бачить login/register gate;
- wording `разова заявка` не означає anonymous request і може бути неправильно зрозумілий;
- auth gate не дає Telegram alternative;
- request form не показує consent/privacy acknowledgement;
- немає компактного next-steps блоку, хоча status URL після submit існує.

Потрібне product decision: або дозволити anonymous web request, або всюди явно писати `Увійти та створити заявку`, залишивши Telegram/contact як guest alternatives. Це не слід вирішувати лише copy-editing припущенням.

## 12. Інші public pages

### Public status page

Залишити utility-focused. Доречно додати:

- `Повернутися на головну` або `Зв’язатися щодо заявки`;
- пояснення, що timeline показує зафіксовані status changes;
- жодних marketing sections або unrelated CTA.

### Category detail pages

Усі 7 URL використовують один шаблон. Current-state analysis не вважає кожен slug окремою контентною архітектурою; відмінними є verified data fields із `catalog-data.ts`.

### Shared header/footer

- Header CTA логічний, але wording має відповідати auth contract.
- `/categories` потребує discoverability.
- Footer contacts і MVP-copy є P0 placeholder content.

## 13. Матриця дублювання

| № | Секція A / сторінка A | Секція B / сторінка B | Рівень | Тип | Що дублюється | Рекомендація |
|---:|---|---|---|---|---|---|
| 1 | `Переваги` `/` | `Ключові переваги` `/advantages` | Високий | Пряме + функція | 5 із 6 назв і ті самі business outcomes | Залишити summary/detail, але переписати Homepage коротшими outcome labels |
| 2 | `Для кого` `/` | `Для кого створено Kairos Parts` `/about` | Високий | Пряме | 4 аудиторії збігаються буквально, функція і формат однакові | Змінити тему About section |
| 3 | `Сервіс` `/` | `Наші принципи` `/about` | Високий | Тематичне + функція | suppliers, professional selection, digitization, partnership/manager | Переписати principles як operating rules |
| 4 | `Сервіс` `/` | `Ключові переваги` `/advantages` | Високий | Функція | digital history, suppliers, manager, repeat ordering | Зробити Homepage service лише platform capabilities або об’єднати |
| 5 | `Чому це працює / Наш підхід` `/about` | `Сервіс` `/` + benefits `/advantages` | Високий | Тематичне | digital history, one service, supplier coordination | Об’єднати з company model, видалити повторні картки |
| 6 | `Як це працює` `/` | `7 кроків` `/how-it-works` | Середній | Допустиме process repeat | 4 кроки майже однаково названі | Залишити 5 vs 7; Homepage не розширювати |
| 7 | Hero fleet panel `/` | `Сервіс` `/` | Середній | Формат + тема | repeat order, history, analytics/suppliers | Скоротити один із двох supporting layers |
| 8 | Hero/company model `/about` | Hero `/advantages` | Середній | Позиціонування | one B2B process, suppliers, history | About зосередити на company identity, Advantages — на outcomes |
| 9 | `Коли звертатися` `/about` | selection benefits `/advantages` + steps `/how-it-works` | Середній | Тематичне | compatibility, lists, suppliers, repeat orders | Перенести в How it works або замінити на expertise block |
| 10 | `Ключові переваги` `/advantages` | `Було / З Kairos Parts` `/advantages` | Середній | Внутрішнє | ті самі six outcomes у різному форматі | Comparison залишити, benefit copy зробити доказовішим |
| 11 | `Як створити заявку` `/categories/[slug]` | process `/how-it-works` | Середній | Корисне повторення | submit → details → manager selection | Залишити category-specific коротку версію |
| 12 | Hero `/contacts` | `Оберіть зручний спосіб зв’язку` `/contacts` | Середній | Внутрішнє | channels і типи звернення | Скоротити Hero copy після заміни placeholder contacts |
| 13 | `Що підготувати` `/request` | category request guide + request methods `/` | Середній | Інструкція | photo/list/VIN/equipment data | Залишити; на інших сторінках тільки summary/link |
| 14 | Trust panel `/how-it-works` | Principles `/about` | Середній | Функція | швидкість, надійність, delivery | Зробити panel process-specific і підтвердити claims |
| 15 | Final CTA `/about`, `/how-it-works`, `/advantages` | Homepage CTA | Низький | Допустиме CTA | request + Telegram | Залишити reusable conversion pattern |
| 16 | Used-equipment benefit `/` | `/used-equipment` | Низький | Корисний cross-link | verified used equipment direction | Перетворити benefit на чіткий supporting product link/disclosure |
| 17 | Digital history messaging | `/request/status/[token]` | Низький | Різна функція | status/history vocabulary | Залишити; status page є utility, не benefit claim |

Матриця містить 5 високих, 9 середніх і 3 низьких/допустимих пари або групи.

## 14. Відсутні або рекомендовані секції

| Потенційна секція | Чи потрібна | Де | Проблема, яку вирішує | Дані достатні зараз | Статус |
|---|---|---|---|---|---|
| Company evidence / verified facts | Так | `/about` | About не доводить company claims | Ні | Потребує даних клієнта |
| Team / expertise | Можливо | `/about` | Немає людей або експертного контексту | Ні | Потребує даних і дозволів клієнта |
| Company history | Можливо | `/about` | Немає origin/story | Ні | Потребує даних клієнта |
| FAQ по процесу | Так | `/how-it-works` | Не закриті заперечення про account, one-off, documents, delivery | Частково | Можна підготувати лише підтверджені відповіді; SLA — після клієнта |
| Що підготувати | Так | `/how-it-works` | Користувач не бачить input requirements до CTA | Так | Можна додати з actual request fields |
| Що після submit | Так | `/how-it-works` або `/request` | Немає очікуваного next step | Частково | Можна без строків; SLA потребує клієнта |
| Privacy/consent | Так | `/request` | Форма збирає personal data без явного acknowledgement | Ні для фінального legal copy | Потребує погодженого тексту/політики |
| Case studies / testimonials | Бажано | `/advantages` | Benefits не мають доказів | Ні | Потребує реальних кейсів/відгуків і дозволів |
| Partner logos | Лише за наявності дозволів | `/about` або `/advantages` | Може підсилити trust | Ні | Потребує підтверджених партнерів і brand permission |
| Comparison | Уже є | `/advantages` | Пояснює before/after | Так | Не дублювати новим блоком |
| Role-based benefits | Низький пріоритет | `/advantages` | Може персоналізувати outcomes | Частково | Не додавати, поки дублюється audience content |
| Service area / geography | Так, якщо підтверджено | `/contacts` або `/how-it-works` | Claim `по всій Україні` не має source | Ні | Потребує даних клієнта |
| Response expectations / SLA | Бажано | `/contacts`, `/request` | Немає очікуваного часу відповіді | Ні | Потребує погодженого SLA |
| Used-equipment role/disclaimer | Так | list + detail | Невідомо, хто продавець і що означає verified | Ні | Потребує business rules клієнта |
| Used-equipment next steps | Так | `/used-equipment/[slug]` | Inquiry flow після submit не пояснений | Частково | Можна після підтвердження process owner |
| Category usage intro | Можливо, compact | `/categories` | Route неочевидний новому користувачу | Так | 2–3 речення, не нова велика секція |
| Status contact/back CTA | Так, compact | public status | Utility page має глухий кінець | Так | Можна додати після real contacts |
| Compliance / guarantees | Не додавати автоматично | — | Немає підтверджених гарантій/сертифікатів | Ні | Потребує юридично погоджених даних |

Не рекомендовано зараз додавати довільні counters, logos, testimonials, geography, guarantees або SLA лише для заповнення «стандартних» місць.

## 15. Рекомендована нова контентна архітектура

| Сторінка | Єдина роль | Що залишити | Що прибрати/перенести |
|---|---|---|---|
| Homepage | Коротке позиціонування + conversion | Hero, 5 steps, compact outcomes, audience summary, request methods | Об’єднати повтори Hero fleet/Service; не деталізувати benefits |
| About | Company identity, mission, operating model, evidence | Hero, mission, `Не магазин, а центр підбору` | Audience duplicate; product-benefit cards; scenarios перенести або замінити expertise |
| How it works | Повний процес + preparation + objections | 7 steps, process CTA | Додати prep/next steps/FAQ; scenarios можуть жити тут |
| Advantages | Business outcomes + mechanisms + proof | 6 detailed outcomes, before/after | Used-equipment як окремий product benefit; додати proof лише з даними |
| Contacts | General communication routing | Real contacts, topic form, Telegram | Placeholder data; мінімізувати повтор intro |
| Request | Structured authenticated request | Form, prep checklist, files, status success | Пояснити auth contract, consent, next steps, guest alternative |
| Categories | Service directions, not ecommerce | Category overview, examples, contextual CTA | Додати global discoverability; не будувати product catalog |
| Category detail | Category-specific request preparation | subcategories, manufacturers, request hint | Не дублювати full process/FAQ |
| Used equipment | Published listings + inquiry, with role disclosure | list, detail, inquiry | Не називати verified без criteria; пояснити ownership/limitations |
| Public status | Transactional status utility | current status, facts, timeline | Не додавати marketing; лише compact help/back CTA |

Принцип розподілу:

- Homepage відповідає `Що це і що робити далі?`
- About відповідає `Хто ви, як працюєте як компанія і чому довіряти?`
- How it works відповідає `Що станеться крок за кроком?`
- Advantages відповідає `Який бізнес-результат і завдяки чому?`
- Categories відповідає `З якими напрямами можна звертатися?`
- Request відповідає `Які дані передати зараз?`
- Contacts відповідає `Куди звернутися не зі структурованою заявкою?`
- Used equipment відповідає `Які оголошення доступні і яка роль Kairos у зверненні?`

## 16. P0 / P1 / P2 roadmap

### P0 — критичне

1. **Замінити placeholder contacts і footer copy.** Отримати реальні phone/email/work hours; прибрати `MVP public website foundation`.
2. **Погодити conversion contract `/request`.** Вирішити: anonymous web request чи mandatory CLIENT account. Після рішення синхронізувати всі CTA, `разова заявка`, auth gate і Telegram alternative.
3. **Погодити privacy flow.** Додати до request form затверджений consent/privacy текст і доступну policy/link, якщо цього вимагає погоджений процес.
4. **Верифікувати публічні обіцянки.** `гарантія`, `відтермінування`, `по всій Україні`, `Кагарлик`, графік, verified suppliers/used equipment. Непідтверджене — прибрати або пом’якшити.
5. **Уточнити роль used-equipment майданчика.** Хто продавець/власник, що перевіряється, хто відповідає за стан, що означає `Доступно`, що відбувається після inquiry.

### P1 — важливе

1. Прибрати direct audience duplicate з `/about`; замінити на company expertise/evidence direction.
2. Розвести Homepage `Переваги` і `Сервіс`; скоротити повтор digital history/suppliers/manager.
3. Об’єднати `/about` `Чому це працює / Наш підхід` із company model.
4. Переписати `/about` principles як validated operating rules.
5. Визначити місце `Коли звертатися`: `/how-it-works` supporting scenarios або новий expertise block на About.
6. Додати discoverability для `/categories`.
7. Додати `/how-it-works` prep, next steps і вузький FAQ без непідтверджених SLA.

### P2 — покращення

1. Додати case studies/testimonials на `/advantages` після отримання реальних матеріалів.
2. Додати team/history/company facts на `/about` після підтвердження.
3. Додати compact status help CTA.
4. Покращити cross-link між core parts service і used-equipment як окремим напрямом.
5. Додати service area/response expectations лише після погодження клієнта.

## 17. Питання, які потрібно уточнити у клієнта

### Контакти та операційні дані

1. Який реальний телефон, email і графік роботи можна публікувати?
2. Чи є окремі контакти для заявок, партнерства й used-equipment?
3. Чи справді офіс/точка видачі знаходиться у Кагарлику, і як формулювати адресу/самовивіз?
4. Яка підтверджена географія доставки?
5. Чи є погоджений response time або SLA?

### Conversion і заявка

6. Чи повинна web-заявка бути доступна без реєстрації?
7. Що означає `разова заявка`: без техніки, без компанії чи без акаунта?
8. Який guest fallback є пріоритетним: Telegram, contact form чи дзвінок?
9. Який privacy/consent текст і policy URL погоджені для request form?
10. Що саме користувач має очікувати після submit і хто контактує першим?

### Комерційні обіцянки

11. Чи можна публічно обіцяти гарантію, і на що саме вона поширюється?
12. Чи справді є відтермінування оплати; для кого і за яких умов?
13. Які форми розрахунку й робота з ПДВ підтверджені?
14. Які критерії `перевіреного постачальника` можна пояснити публічно?

### Company proof

15. Чи є реальна історія компанії, дата запуску й milestones?
16. Чи можна показувати команду, ролі, фото й експертизу?
17. Чи є підтверджені кейси, відгуки, цифри або результати?
18. Чи є партнери/бренди, назви й логотипи яких дозволено публікувати?
19. Які principles команда реально використовує у щоденній роботі?

### Categories і used equipment

20. Чи всі 7 category directions і manufacturer lists реально підтримуються?
21. Чи є обмеження за брендами, типами техніки або регіонами?
22. Яка точна роль Kairos у used-equipment: продавець, агент, дошка оголошень чи координатор?
23. Що означає `перевірена техніка`: документи, технічний огляд, партнер, модерація оголошення?
24. Хто відповідає за технічний стан і достовірність опису?
25. Чи потрібні бізнес-статуси SOLD/RESERVED, чи `ARCHIVED` достатньо?

## 18. Рекомендований перший наступний етап

### Stage CA-1 — Content facts and conversion contract

Мета: створити погоджений source-of-truth документ до будь-яких code/content changes.

Deliverables:

1. Таблиця всіх публічних claims зі статусами `confirmed / revise / remove / needs legal approval`.
2. Реальні contacts, schedule, geography і pickup rules.
3. Погоджений `/request` contract: anonymous vs authenticated, one-off definition, guest alternatives.
4. Approved privacy/consent direction.
5. Used-equipment role, verification criteria і limitations.
6. Список available proof assets: facts, team, cases, testimonials, partners.
7. Затверджений P1 section ownership map для Homepage, About, How it works і Advantages.

Лише після Stage CA-1 варто починати implementation stage. Рекомендований перший code stage після погодження — вузький P0 cleanup: real contacts/footer, CTA/auth wording, consent direction і unsupported claims. Контентну перебудову About/Homepage виконувати окремим наступним етапом, не одним великим редизайном.

## Додаток A. Оцінка всіх секцій

| ID | Route / секція | Бізнес-функція | У | Д | З | Ц | РД | ВС | Схожість / конкретне рішення |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| H1 | `/` Hero + fleet panel | позиціонування, trust, CTA | 4 | 5 | 5 | 5 | 3 | 5 | Залишити; скоротити fleet/service overlap; claims підтвердити |
| H2 | `/` Як це працює | short process | 3 | 5 | 5 | 5 | 3 | 5 | Залишити рівно 5 кроків |
| H3 | `/` Переваги | business outcomes | 3 | 5 | 5 | 5 | 5 | 5 | Скоротити labels і чіткіше відрізнити від detail page |
| H4 | `/` Сервіс | functions | 2 | 4 | 4 | 4 | 5 | 3 | Переписати як platform capabilities або об’єднати |
| H5 | `/` Для кого | audience | 4 | 5 | 5 | 4 | 5 | 5 | Залишити як primary audience source; About duplicate прибрати |
| H6 | `/` Способи створення заявки | conversion/support | 4 | 5 | 4 | 5 | 2 | 5 | Залишити; виправити auth expectation |
| A1 | `/about` Hero | company positioning | 3 | 5 | 5 | 4 | 3 | 5 | Залишити, більше company identity |
| A2 | `/about` Про компанію / місія / що робимо | mission, model | 4 | 5 | 5 | 4 | 3 | 5 | Скоротити product repetition, залишити core model |
| A3 | `/about` Коли звертатися | scenarios | 4 | 4 | 5 | 5 | 3 | 3 | Перенести в How або змінити на expertise/evidence |
| A4 | `/about` Чому це працює / Наш підхід | benefits/model | 2 | 3 | 4 | 3 | 5 | 2 | Об’єднати з A2 |
| A5 | `/about` Для кого створено | audience | 1 | 3 | 5 | 3 | 5 | 2 | Змінити тему |
| A6 | `/about` Наші принципи + CTA | values, CTA | 2 | 5 | 4 | 3 | 5 | 3 | Переписати як validated operating rules; CTA залишити |
| W1 | `/how-it-works` Hero + trust panel | process promise, trust | 4 | 5 | 5 | 5 | 4 | 5 | Hero залишити; panel зробити process-specific |
| W2 | `/how-it-works` 7 steps + CTA | full process | 5 | 5 | 5 | 5 | 3 | 5 | Залишити; додати prep/FAQ/next steps |
| V1 | `/advantages` Hero | value positioning, CTA | 4 | 5 | 5 | 5 | 3 | 5 | Залишити; claims верифікувати |
| V2 | `/advantages` Ключові переваги | detailed value | 3 | 5 | 5 | 5 | 5 | 5 | Переписати як mechanism + impact + proof |
| V3 | `/advantages` Різниця в процесі + CTA | comparison, conversion | 4 | 5 | 5 | 5 | 3 | 5 | Залишити; не дублювати ще одним comparison |
| C1 | `/contacts` Hero | contact routing, CTA | 3 | 5 | 5 | 4 | 3 | 5 | Скоротити після заміни contacts |
| C2 | `/contacts` Канали + форма | contacts, lead capture | 5 | 5 | 5 | 5 | 2 | 5 | Залишити; real contacts required |
| G1 | `/categories` Hero | category orientation | 5 | 5 | 5 | 4 | 1 | 5 | Залишити |
| G2 | `/categories` Grid | catalog directions | 5 | 5 | 5 | 5 | 1 | 5 | Залишити; підтвердити manufacturers; додати discoverability |
| GD1 | `/categories/[slug]` Hero | contextual orientation, CTA | 4 | 5 | 5 | 5 | 2 | 5 | Залишити |
| GD2 | `/categories/[slug]` Підкатегорії/виробники | requirements/catalog | 5 | 5 | 5 | 5 | 1 | 5 | Залишити; data validation needed |
| GD3 | `/categories/[slug]` Як створити заявку | instruction, CTA | 4 | 5 | 5 | 5 | 3 | 5 | Залишити як category-specific summary |
| U1 | `/used-equipment` Hero | product direction | 4 | 5 | 4 | 4 | 2 | 4 | Додати role/verification disclosure |
| U2 | `/used-equipment` Каталог | listing | 5 | 5 | 5 | 5 | 1 | 5 | Залишити |
| U3 | `/used-equipment` Empty state | service state | 5 | 5 | 5 | 4 | 1 | 5 | Залишити; можна додати non-deceptive back/contact action |
| U4 | `/used-equipment` Error state | service information | 5 | 5 | 5 | 4 | 1 | 5 | Залишити; real contact path after P0 |
| UD1 | `/used-equipment/[slug]` Detail article | listing detail, inquiry | 5 | 5 | 4 | 5 | 1 | 5 | Додати role, availability і next steps disclosure |
| UD2 | `/used-equipment/[slug]` Опис техніки | item information | 5 | 5 | 4 | 5 | 1 | 5 | Залишити; quality залежить від manager content |
| UD3 | `/used-equipment/[slug]` Error state | service information | 5 | 5 | 5 | 4 | 1 | 5 | Залишити |
| R1 | `/request` Authenticated Hero | request orientation | 4 | 5 | 5 | 5 | 2 | 5 | Залишити |
| R2 | `/request` Form + Що підготувати | transaction, instruction | 5 | 5 | 5 | 5 | 2 | 5 | Залишити; consent + next steps потрібні |
| R3 | `/request` Auth gate | access/conversion | 4 | 5 | 3 | 3 | 1 | 4 | Узгодити CTA contract; додати guest alternative |
| S1 | `/request/status/[token]` Status dashboard | service information | 5 | 5 | 5 | 5 | 1 | 5 | Залишити; compact help/back CTA |
| S2 | `/request/status/[token]` DB-missing state | service information | 5 | 5 | 5 | 3 | 1 | 5 | Залишити; не показувати в normal production state |

## Додаток B. Найпроблемніші секції

1. **`/about` — `Для кого створено Kairos Parts`**: прямий audience duplicate Homepage, низька унікальність і слабка роль для About.
2. **Homepage — `Сервіс`**: дублює Hero fleet panel, Homepage benefits, About principles і Advantages; найбільший вузол тематичного повторення.
3. **`/request` — Auth gate у зв’язці з public CTA**: не контентний дублікат, але найсерйозніший conversion mismatch — CTA обіцяє форму, а guest отримує login/register.

## Додаток C. Перевірені current-state факти

- Homepage містить рівно 5 кроків; `/how-it-works` — рівно 7.
- Contact form і request form — різні форми з різними сценаріями.
- Contact form має consent; request form окремого consent не має.
- `/request` вимагає authenticated CLIENT profile.
- Used-equipment enum: `DRAFT`, `PUBLISHED`, `ARCHIVED`; SOLD/RESERVED відсутні.
- Public used-equipment query показує тільки `PUBLISHED`.
- `/categories` не включена до current global navigation.
- Phone/email у contacts/footer — placeholder values.
- У звіті не використовуються непідтверджені counters, years, partners, cases, testimonials або SLA як готові facts.
