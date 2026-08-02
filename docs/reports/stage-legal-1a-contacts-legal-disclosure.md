# Stage Legal 1A — Contacts Legal Disclosure and Personal Data Notice

## 1. Executive summary

Сторінку `/contacts` доповнено юридичною інформацією ТОВ «КАЙРОС ПАРТС» без повного redesign і без зміни бізнес-логіки контактної форми. Розділено звичайний номер менеджера та телефон юридичної особи, уточнено фактичну адресу і графік, оновлено текст згоди на обробку персональних даних та додано нейтральне застереження щодо статусу заявки.

## 2. Git baseline

- Початкова гілка: `main`, clean working tree.
- За вимогою етапу виконано перехід на `develop` і `git pull --ff-only origin develop`.
- Базовий SHA `develop`: `c8dda4464e5e248ad1cf71f2b45fb692a3c4bb70`.
- Reset, rebase, merge і force push не використовувалися.

## 3. Scope and constraints

Зміни обмежено сторінкою контактів, її формою, спільними контактними/юридичними константами, contact metadata, regression script і цим звітом. Не змінювалися production, БД, Prisma schema/migrations, Nginx, DNS, Search Console, sitemap, Telegram та інші бізнес-процеси. `/privacy-policy` і `/terms-of-use` не створювалися.

## 4. Existing contacts page audit

- Source page: `app/(public)/contacts/page.tsx`; це Server Component із static metadata.
- Client form: `app/(public)/contacts/contact-form.tsx`.
- Server Action: `app/(public)/contacts/actions.ts`.
- Спільна validation і status constants: `lib/contact-messages.ts`.
- Контактні константи: `lib/site-contacts.ts`.
- SEO config: `lib/seo.ts`; canonical формується через `createPublicMetadata`.
- Footer: `components/layout/public-layout.tsx`, використовує той самий `siteContacts`.
- Sitemap: `app/sitemap.ts`; `/contacts` уже присутній.
- Honeypot: приховане поле `website`, перевіряється client-side і server-side.
- Persistence: `prisma.contactMessage.create()`; schema default status — `NEW`.
- Status flow: `NEW`, `IN_PROGRESS`, `RESOLVED`, `SPAM`; цей етап його не змінює.
- Structured data на `/contacts` не було і в межах цього етапу не додавалося.
- Контакти централізовані для `/contacts`, footer і частини Logistics; окремі public pages мають власні Telegram constants, але вони поза scope.
- `docs/audit-contact-form-delivery.md` описує старий стан до появи CRM/Server Action і є застарілим історичним артефактом.

## 5. Confirmed legal data

- Скорочена назва: ТОВ «КАЙРОС ПАРТС».
- Повна назва: ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «КАЙРОС ПАРТС».
- Код ЄДРПОУ: `46387973`.
- Юридична адреса й адреса для листування: 09201, Україна, Київська область, Обухівський район, м. Кагарлик, вул. Сергієнка, буд. 20.
- Телефон юридичної особи: `+38 (067) 668-08-08`.
- Email: `kairos_parts@ukr.net`.
- Володілець персональних даних: ТОВ «КАЙРОС ПАРТС».

Дані винесено в `lib/company-details.ts` як спільне джерело для майбутніх legal pages. Банківські реквізити та ім’я директора не додавалися.

## 6. Contact number separation

| Purpose | Value | Display location |
| --- | --- | --- |
| Оперативний зв’язок із менеджером | `(068) 008 77 08` | Основний контактний блок і footer |
| Контактний телефон юридичної особи | `+38 (067) 668-08-08` | Лише секція «Юридична інформація» |
| Загальні та офіційні звернення | `kairos_parts@ukr.net` | Контактний і юридичний блоки, footer |
| Створення заявки у Telegram | `@kairos_parts_bot` | Контактний блок і footer |

Обидва телефони мають окремі підписи та окремі `tel:` URI.

## 7. Actual address clarification

| Address | Legal status | User-facing label |
| --- | --- | --- |
| м. Кагарлик, вул. Миронівська, 33д | Фактична адреса, не юридична | Офіс, склад, база, пункт обслуговування та видачі |
| 09201, Україна, Київська область, Обухівський район, м. Кагарлик, вул. Сергієнка, буд. 20 | Юридична адреса й адреса для листування | Юридична адреса та адреса для листування |

Для фактичної адреси збережено наявне підтверджене Google Maps посилання й додано повідомлення про відвідування без попереднього погодження у робочі години. Юридична адреса не має map link.

## 8. Working hours update

Централізоване значення `8:30–17:30` замінено на `Пн–Сб: 08:30–17:30`. Твердження про неділю не додавалося.

## 9. Legal disclosure block

Додано окрему секцію «Юридична інформація» після наявного contact/form блоку. Секція використовує чинні navy, blue, gold і light theme tokens, responsive grid, один `H2`, підзаголовок `H3`, семантичний `dl` та break/min-width guards для довгих значень.

## 10. Written claims procedure

На сторінці зазначено, що письмові претензії приймаються поштою за юридичною адресою ТОВ «КАЙРОС ПАРТС». Telegram, форма та email не названі заміною поштового порядку; гарантований строк відповіді не заявляється.

## 11. Personal data notice

У legal block вказано володільця персональних даних — ТОВ «КАЙРОС ПАРТС» — і email `kairos_parts@ukr.net` для запитів щодо персональних даних. Посилання на ще неіснуючу privacy policy не додавалося.

## 12. Contact form consent update

Новий текст checkbox:

> Я погоджуюся на обробку наданих персональних даних ТОВ «КАЙРОС ПАРТС» для розгляду мого звернення та надання відповіді.

Checkbox залишається required, unchecked by default, пов’язаний із label, доступний із клавіатури та валідований тією самою server-side функцією. Маркетингова згода відсутня.

Поруч із формою додано secondary notice: надсилання заявки не означає автоматичного укладення договору, підтвердження наявності чи остаточного замовлення; умови погоджуються з менеджером.

## 13. Metadata and indexing

- Canonical: `https://kairos-parts.com.ua/contacts`.
- Robots: `index, follow`.
- Title не містить ЄДРПОУ або фінансових даних.
- Description уточнено: він охоплює контактні канали, адресу та юридичну інформацію без keyword stuffing.
- `app/sitemap.ts` не змінювався; legal URL не додавалися.

## 14. Accessibility

- Єдиний наявний `H1` збережено; legal section використовує `H2`/`H3`.
- Секція має `aria-labelledby`.
- Телефони й email мають `tel:`/`mailto:` links і focus-visible state.
- Значення не передаються лише кольором.
- `min-w-0`, `break-words`, `overflow-hidden` та responsive `sm:grid-cols-2` обмежують ризик horizontal overflow.
- Production-build HTML підтвердив доступні form label/required semantics.
- Screenshot-based desktop/mobile перевірка не виконана: `agent-browser` у середовищі відсутній. Responsive layout перевірено статично та через production HTML smoke.

## 15. Regression tests

Додано `scripts/check-stage-legal-1a-contacts.ts` і npm command `test:legal-contacts-1a`. Перевірка охоплює contact/legal constants, розділення номерів і адрес, consent semantics, відсутність broken legal link/банківських даних, honeypot, client/server validation contract, незмінний Prisma create/status contract, canonical, robots і sitemap inventory.

`test:seo-crawl-foundation` пройшов. Існуючий `check-public-ui-cleanup.ts` має дві baseline exact-source помилки, не створені цим етапом: застарілу punctuation перевірку homepage і вимогу literal Telegram URL у `/contacts`, хоча URL централізовано через `siteContacts`.

## 16. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run test:legal-contacts-1a` | PASS | Legal/contact/form/SEO contract |
| `npm run test:seo-crawl-foundation` | PASS | 13 canonical sitemap URLs, correct production origin |
| `npx tsx scripts/check-public-ui-cleanup.ts` | BASELINE FAIL | 2 stale exact-source assertions поза scope |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run build` | PASS | Next.js compile, type validation, 56/56 pages, explicit exit 0 |
| Local production HTTP `/contacts` | PASS | 200; canonical; index/follow; legal/contact content; required unchecked consent |
| Form persistence mutation | NOT RUN | DB mutations заборонені; Server Action/persistence code не змінювався |
| Desktop/mobile screenshot | NOT RUN | Browser automation CLI недоступний; source/HTML responsive checks виконані |
| `git diff --check` | PASS | Whitespace errors і conflict markers відсутні |

Перший build також згенерував 56/56 сторінок, але повернув unexplained exit 1 після route table; isolated rerun з явним захопленням коду завершився `BUILD_EXIT_CODE=0` і є фінальним build evidence.

## 17. Files changed

- `app/(public)/contacts/page.tsx`
- `app/(public)/contacts/contact-form.tsx`
- `lib/company-details.ts`
- `lib/site-contacts.ts`
- `lib/seo.ts`
- `scripts/check-stage-legal-1a-contacts.ts`
- `package.json`
- `docs/reports/stage-legal-1a-contacts-legal-disclosure.md`

Не змінювалися `app/(public)/contacts/actions.ts`, `lib/contact-messages.ts`, `prisma/schema.prisma`, Prisma migrations, `app/sitemap.ts` і footer.

## 18. Deferred legal work

### Stage Legal 1B — `/privacy-policy`

Після створення сторінки потрібно додати посилання до checkbox і footer та включити сторінку в sitemap.

### Stage Legal 1C — `/terms-of-use`

Після створення сторінки потрібно додати посилання до footer, legal notice до реєстрації/заявок та включити сторінку в sitemap.

## 19. Production approval checklist

Перед будь-яким production release потрібні окреме затвердження користувача, перевірка Preview, desktop/mobile browser QA, безпечний develop-to-main audit/merge, production build/deploy gate та post-deploy smoke. Поточний етап не надає дозволу на push, merge або deploy.

## 20. Final conclusion

Stage Legal 1A реалізовано локально в `develop` у межах application UI/config/tests/docs. Контактна форма зберегла наявні validation, honeypot, Server Action, persistence і status contracts. БД, migrations, sitemap, main та production не змінено. Після фінальних git gates створюється один локальний commit `feat: add legal disclosure to contacts page`; push не виконується.
