# Stage UI 11.3 — client icons, hidden slugs and rich-text headings

## 1. Scope

Етап охоплює три локальні UI/stabilization правки: іконки клієнтської навігації, приховування `EquipmentType.slug` із CRM-форми та коректну block-level поведінку H2/H3 у Tiptap. Бізнес-логіка Assisted Fleet, Used Equipment і taxonomy relations не змінювалася.

## 2. Client navigation audit

Desktop і mobile використовують один `DashboardShell` та один масив `clientNavItems` у `app/client/layout.tsx`. Active state, badge заявок і role gate вже були централізовані, тому дубльованої mobile-конфігурації немає.

## 3. Icon mapping

- Панель керування — `TbLayoutDashboard`;
- Мої заявки — `TbClipboardList`;
- Мій парк техніки — `TbTractor`;
- Документи — `TbFileDescription`;
- Запити на зміну — `TbArrowsExchange`;
- Профіль — `TbUser`.

Усі іконки рендеряться через наявний `NAV_ICONS`, мають `18px`, `shrink-0`, `currentColor` і не змінюють badge layout.

## 4. Slug usage audit

`EquipmentType.slug` залишається частиною Prisma model, taxonomy DTO та історичного backfill script. Публічні маршрути БВ техніки використовують окремий `UsedEquipment.slug`; `EquipmentType.slug` не є route identifier і не використовується як browser-editable business key. Поточні форми вибирають тип за `name`, а server validation знаходить його за `normalizedName`.

Поле можна приховати без regression. Видаляти його зі schema в цьому етапі не можна: воно все ще повертається taxonomy helper і використовується data tooling. Окремий schema cleanup можливий лише після повного contract/data audit.

## 5. Slug policy

ADMIN більше не бачить і не редагує slug. Browser payload не містить `slug`; server action ігнорує можливе tampered поле. При створенні slug генерується з нормалізованої назви. Для існуючого запису slug не змінюється при перейменуванні, щоб зберегти стабільність внутрішнього identifier та історичних даних.

## 6. Automatic slug generation

Використано наявну українську транслітерацію `taxonomySlug`. Додано `uniqueTaxonomySlug`, який повертає базове значення або послідовний suffix `-2`, `-3`, `-4`. Це замінює timestamp suffix і дає передбачуваний результат.

## 7. Slug uniqueness and edit behavior

`normalizedName` лишається unique, тому повний duplicate name блокується. Для різних назв з однаковим результатом транслітерації create action перевіряє зайняті slug і застосовує числовий suffix. Edit перевіряє duplicate `normalizedName`, але залишає `current.slug` без змін.

## 8. Slug UI removal

Із карток типів техніки прибрано label/input `Slug`. Edit grid тепер складається з назви, порядку, active checkbox і save button. Create row вже не мав slug. Hidden slug також не використовується.

## 9. Rich-text root cause

H2/H3 є block nodes у ProseMirror. Попередня plain-text normalization групувала сусідні рядки в один `<p>` через `<br>`, тому cursor у візуально окремому рядку фактично залишався в одному paragraph, і `toggleHeading` коректно перетворював увесь блок. Toolbar також покладався лише на `click`, що могло втрачати browser selection під час `mousedown`.

## 10. Plain-text normalization

Кожен рядок plain text тепер стає окремим `<p>`. Порожній рядок стає `<p></p>`. HTML escaping збережено, а вхід, який уже є HTML, не обгортається повторно. Існуючий валідний HTML у БД не переписується автоматично.

## 11. Heading block semantics

Cursor без selection використовує стандартний Tiptap `toggleHeading` і змінює лише поточний paragraph. Selection між кількома blocks також лишається на стандартній ProseMirror поведінці.

## 12. Partial-selection behavior

Якщо selection займає частину одного text block, helper `applyHeading` створює ProseMirror transaction: текст до selection стає paragraph, selection — окремим H2/H3, текст після — paragraph. Inline marks у fragments зберігаються; ручних DOM-операцій немає. Після transaction selection переводиться на створений heading.

## 13. Toolbar focus behavior

Toolbar buttons викликають `preventDefault()` на `mousedown`, тому mouse selection не губиться до виконання команди. `click`, keyboard activation, `aria-label`, `title`, `aria-pressed` та focus-visible стилі залишені.

## 14. Existing HTML compatibility

Tiptap extensions, sanitizer allowlist і public `SafeRichText` зберігають `p`, `h2`, `h3`, formatting marks, lists, links, images і tables. Images, як і раніше, дозволяють лише HTTP(S).

## 15. Sanitizer and public rendering regression

Server-side sanitizer не розширено небезпечними protocols або attributes. Public headings лишаються block elements із поточними typography styles; responsive image/table rules не змінювалися.

## 16. Targeted checks

- plain text: рядки перетворюються на окремі paragraphs;
- empty line: зберігається empty paragraph;
- HTML input: не обгортається повторно;
- unsafe text: escaping працює;
- current paragraph: стає H3 без зміни сусідніх blocks;
- partial selection: стає окремим H2, текст до/після збережено;
- heading active state: збережено;
- slug transliteration: перевірено на українських назвах;
- duplicate slug: deterministic suffix;
- admin UI/action: slug відсутній у form payload;
- client navigation: усі шість icon keys присутні.

## 17. Responsive and accessibility QA

Статично перевірено shared responsive layout: client navigation використовує ту саму desktop/mobile розмітку; toolbar зберігає `flex-wrap`; type row має flexible name column. Browser pixel QA на всіх viewport у поточному sandbox не автоматизована. Accessibility contracts (`aria-current`, icon `aria-hidden`, toolbar labels, pressed state і keyboard click) збережені.

## 18. Manual QA

Автоматично перевірено структурну поведінку ProseMirror та source contracts. Login-based save/reload/public-page smoke потребує запущеного browser session після deploy або локального dev server. Масові зміни існуючих slug не виконувалися.

## 19. Prisma and migration status

Prisma schema не змінювалася. Migration не потрібна. Фінальні перевірки пройшли:

- `npx.cmd prisma migrate status` — database schema is up to date, знайдено 24 migrations;
- `npx.cmd prisma validate` — успішно;
- `npx.cmd prisma generate` — успішно;
- `npm.cmd run typecheck` — успішно;
- `npm.cmd run lint` — успішно;
- `npm.cmd run build` — успішно, згенеровано 45 static pages;
- `git diff --check` — успішно.

Під час prerender build Prisma тричі вивела нефатальне TLS-повідомлення при спробі прочитати довідники. Next.js завершив build з exit code 0; schema validation, generation і окремий migration status також пройшли.

## 20. Remaining gaps

- Повний browser smoke H2/H3, save/reload і public rendering залишається ручною перевіркою.
- Видалення `EquipmentType.slug` зі schema не входить у scope й потребує окремого contract/data audit.
- Existing slug не backfill-яться і не нормалізуються масово.
