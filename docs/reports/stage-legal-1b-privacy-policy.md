# Stage Legal 1B — Privacy Policy

## 1. Executive summary

У `develop` створено публічну українськомовну сторінку `/privacy-policy`, прив’язану до фактичних data flows Kairos Parts. Додано self-canonical metadata, `index, follow`, footer link, посилання в required checkbox контактної форми та 14-й canonical URL у sitemap. Текст є робочою редакцією для юридичного погодження, а не остаточним юридичним висновком.

## 2. Git baseline

- Branch: `develop`.
- Baseline HEAD: `80e5546e5f39797c39a98aaaced11c7e7dc9576b` (`feat: add legal disclosure to contacts page`).
- `develop` був на один локальний commit попереду `origin/develop`; commit Stage Legal 1A збережено як ancestor.
- Working tree до початку: clean. Pull, reset і rebase не виконувалися.

## 3. Scope and constraints

Змінено лише application code, статичні перевірки та документацію Stage Legal 1B. Не змінювалися БД, Prisma schema/migrations, production, Nginx, DNS, Search Console, webhook або env. `/terms-of-use`, `/cookie-policy`, cookie banner, analytics та marketing consent не створювалися. Push, merge і deploy заборонені до окремого погодження.

## 4. Source reports and legal data

Повністю опрацьовано reports Stage Legal 1A, SEO 0, SEO 1 і SEO 1B. Юридичні реквізити беруться з `lib/company-details.ts`: ТОВ «КАЙРОС ПАРТС», ЄДРПОУ 46387973, юридична адреса вул. Сергієнка, буд. 20, email `kairos_parts@ukr.net`. Правову рамку звірено з офіційними сторінками законів України про захист персональних даних та електронну комерцію; точну кваліфікацію підстав обробки залишено на юридичне погодження.

## 5. Privacy data-flow audit

Перевірено реєстрацію, credentials login, JWT session, rate limiting, manager invitation, заглушку forgot-password, client/company profile, contact form, Parts і Logistics requests, vehicles, images/documents, comments, approvals, invoices, OCR, Telegram, Cloudinary, PostgreSQL, audit logs, server request context, deployment/backup documentation та залежності. Активних Google Analytics, GTM, Ads, Meta Pixel, Clarity, PostHog, SMTP/email delivery, Google Drive або rclone у поточному коді не знайдено.

## 6. Data category inventory

| Data category | Source | Purpose | Storage | Recipient | Retention |
| --- | --- | --- | --- | --- | --- |
| Ім’я, прізвище, телефон, email | реєстрація, contact, заявки, Telegram | акаунт, зв’язок, виконання запиту | PostgreSQL | уповноважені працівники, infrastructure providers | доки потрібні для акаунта/запиту або правового обов’язку |
| Компанія, ЄДРПОУ/податковий ID, membership | реєстрація, профіль, CRM | B2B identity, ownership, документи | PostgreSQL | уповноважені працівники | за життєвим циклом відносин і правовими вимогами |
| Дані акаунта й auth | login/register/invitation | авторизація та безпека | PostgreSQL, auth session | Auth.js/application runtime | сесія — до expiry; інше — за життєвим циклом акаунта |
| Parts request | форми, менеджер, Telegram | підбір, комунікація, погодження | PostgreSQL | працівники, Telegram для відповідного каналу | до завершення мети та пов’язаних обов’язків |
| Техніка | vehicle/request forms | точний підбір та історія техніки | PostgreSQL | працівники | за життєвим циклом акаунта/техніки/заявки |
| Logistics | форма перевезення | розрахунок і виконання логістики | PostgreSQL | працівники, address provider contract | до завершення заявки та обов’язків |
| Фото, скани, документи | uploads, Telegram | ідентифікація деталей, документообіг | Cloudinary і metadata у PostgreSQL | Cloudinary, працівники | до завершення мети; cleanup залежить від конкретного workflow |
| Пропозиції, approvals, invoices, comments | CRM/client cabinet | погодження та оформлення | PostgreSQL | клієнт і уповноважені працівники | за lifecycle заявки та legal/accounting needs |
| Telegram IDs і draft | офіційний бот | зв’язок, підтвердження клієнта, створення заявки | PostgreSQL/Telegram | Telegram, application runtime | draft видаляється workflow; пов’язана заявка — за її lifecycle |
| IP, user agent, timestamps, audit events | request headers/runtime | security, abuse prevention, accountability | PostgreSQL/server logs | administrators/infrastructure | configured expiry markers існують; automatic deletion не доведено |
| Contact message | contact form | відповідь на звернення | PostgreSQL | уповноважені працівники | до завершення звернення та обґрунтованих legal needs |
| Backup copies | infrastructure operations | resilience/restore | infrastructure storage | authorized operators/providers | до завершення backup cycle; точний production schedule не перевірено |

## 7. Processing purposes

Опубліковано лише підтверджені цілі: акаунт і безпека, заявка та підбір запчастин, клієнтська комунікація, документи/фото, пропозиції/погодження/рахунки, Logistics, контактні й privacy-звернення, anti-abuse, audit, backup, правові обов’язки та захист прав сторін. Marketing newsletters, profiling і legally significant automated decisions не заявляються.

## 8. Confirmed external providers

| Provider/category | Status | Data involved | Published in policy |
| --- | --- | --- | --- |
| Cloudinary | `CONFIRMED_ACTIVE` у коді/config | фото, документи, file metadata | так |
| Telegram | `CONFIRMED_ACTIVE` для client bot | user/chat ID, phone, messages, request files | так |
| PostgreSQL | `CONFIRMED_ACTIVE` | application records | так, як storage technology |
| VPS/Hostinger production topology | `CONFIGURED_BUT_NOT_VERIFIED` у цьому stage | application/database traffic | узагальнено як VPS infrastructure |
| Vercel + Neon для `develop` | `CONFIRMED_ACTIVE` за deployment documentation; exact Neon resource label мав історичну неоднозначність | preview application/database data | так, як preview infrastructure |
| Internal staff Telegram notifications | `CONFIGURED_BUT_NOT_VERIFIED` live у цьому stage | request lifecycle notifications | окремо не деталізовано |
| Automated email/SMTP provider | `NOT_USED` / не знайдено | — | ні |
| Google Drive/rclone | `NOT_USED` / не знайдено | — | ні |
| GA/GTM/Ads/Meta Pixel/Clarity/PostHog | `NOT_USED` / не знайдено | — | ні |
| AI Vision | `PLANNED` / не активний | — | ні |

## 9. Cookies audit

Auth.js використовує технічно необхідний session/auth mechanism; явної рекламної або поведінкової cookie-конфігурації й активної optional analytics не знайдено. Політика описує необхідні cookies/ідентифікатори авторизації та безпеки. Cookie banner і окрема Cookie Policy не потрібні для підтвердженого поточного scope.

## 10. Retention audit

Schema та audit service встановлюють `expiresAt` для audit events, а rate-limit store має cleanup stale buckets. Водночас загального автоматичного `AuditLog` cleanup job не знайдено, тому точні 30/45 днів або 4 місяці не публікуються як гарантія фактичного видалення. Для заявок, профілів, документів, invoice records і backup copies відсутній єдиний перевірений production deletion schedule. Публічне формулювання використовує purpose/legal-need criteria та backup cycle без вигаданої точності.

## 11. Privacy Policy structure

Сторінка має 19 основних пронумерованих розділів: загальні положення; controller; categories; sources; purposes; legal bases; account/cookies; requests/files; Telegram; providers/transfers; retention; security; rights; request procedure; minors; external links; changes; contacts; effective date. Є зміст із anchor links.

## 12. Legal identity disclosure

Legal identity card та policy text використовують централізований `companyLegalDetails`. Банківські реквізити, IBAN і МФО не публікуються.

## 13. User rights and request procedure

Описано доступ, уточнення, виправлення, заперечення, відкликання згоди за релевантності, видалення та обмеження з урахуванням законних винятків. Запит подається на `kairos_parts@ukr.net`; користувачу запропоновано надати ідентифікаційний контекст і не надсилати пароль або secrets. Довільний строк відповіді не встановлено.

## 14. Security wording

Описано role-based access, credential protection, login rate limiting, audit, private file delivery і backup як пропорційні заходи. Сторінка прямо зазначає, що жоден спосіб не гарантує абсолютної безпеки.

## 15. Page implementation

Route: `app/(public)/privacy-policy/page.tsx`. Це Server Component без `use client`, який рендериться через існуючий public layout. Дата першої редакції source-controlled: `1 серпня 2026 року`. UI використовує існуючі public tokens, адаптивну двоколонкову структуру, один H1, логічні H2, native links і focus states. In-app browser перевірив desktop та viewport 390×844: meaningful content присутній, Next error overlay і console warnings/errors відсутні, horizontal overflow не виявлено.

## 16. Metadata, canonical and indexing

- Title: `Політика конфіденційності | Kairos Parts`.
- Description: `Інформація про те, які персональні дані обробляє Kairos Parts, для чого вони використовуються, як захищаються та як подати запит щодо своїх даних.`
- Canonical: `https://kairos-parts.com.ua/privacy-policy`.
- Robots: `index, follow`.
- Open Graph: website, `uk_UA`, canonical URL, site name, title, description через `createPublicMetadata`.

## 17. Footer integration

У фактичний public footer додано keyboard-accessible Link `Політика конфіденційності` → `/privacy-policy`; `/terms-of-use` не додано.

## 18. Contact form integration

Required і unchecked-by-default checkbox тепер містить точний текст: «Я ознайомився(лася) з Політикою конфіденційності та погоджуюся на обробку наданих персональних даних ТОВ «КАЙРОС ПАРТС» для розгляду мого звернення та надання відповіді.» Слова `Політикою конфіденційності` є native Next Link на `/privacy-policy`. Client і server parser validation, honeypot та database submit action не змінено.

## 19. Other forms audit

| Form | Personal data | Existing notice | Change in 1B | Deferred |
| --- | --- | --- | --- | --- |
| Registration | person/company, phone, email, password | privacy notice немає | без зміни flow | ненав’язливий notice; Terms окремо у 1C |
| Login | email/phone, password, technical events | operational UI | без змін | окремий consent не потрібен |
| Forgot password | поки лише skeleton | flow відсутній | без змін | notice разом із майбутнім flow |
| Manager invitation | token, password | operational activation | без змін | staff legal notice за потреби |
| Contact | name/company/contact/message | required consent | link + точний текст | завершено в 1B |
| Parts request | contact, equipment, VIN/serial, files | operational context | без змін | privacy notice без нового required consent |
| Logistics request | contact, addresses, cargo, date | operational context | без змін | privacy notice без нового required consent |
| Vehicle create/edit | equipment data, VIN, comments | authenticated operation | без змін | cabinet notice |
| Photo/document upload | files and metadata | authenticated operation | без змін | upload-specific concise notice |
| Profile/change request | profile/company/new values/reason | authenticated operation | без змін | cabinet-wide privacy link |
| Comments/approvals/invoices | business records | transactional context | без змін | Terms/account notices in later stage |

Масового додавання required consent не виконано: це змінило б business/auth semantics без окремого юридичного рішення.

## 20. Sitemap changes

До попередніх 13 URL додано лише `https://kairos-parts.com.ua/privacy-policy`. Повний canonical inventory:

1. `https://kairos-parts.com.ua/`
2. `https://kairos-parts.com.ua/about`
3. `https://kairos-parts.com.ua/how-it-works`
4. `https://kairos-parts.com.ua/contacts`
5. `https://kairos-parts.com.ua/privacy-policy`
6. `https://kairos-parts.com.ua/logistics`
7. `https://kairos-parts.com.ua/used-equipment`
8. `https://kairos-parts.com.ua/categories/agricultural-parts`
9. `https://kairos-parts.com.ua/categories/truck-parts`
10. `https://kairos-parts.com.ua/categories/tires-tubes`
11. `https://kairos-parts.com.ua/categories/trailers-semitrailers`
12. `https://kairos-parts.com.ua/categories/commercial-transport`
13. `https://kairos-parts.com.ua/categories/universal-parts`
14. `https://kairos-parts.com.ua/categories/consumables`

Exact `/categories` і `/terms-of-use` відсутні.

## 21. Regression tests

Додано `test:legal-privacy-1b`, який перевіряє route source, 19 sections, metadata/OG/robots, centralized legal data, content safeguards, footer, contact consent parser, 14 unique sitemap URLs і robots. Оновлено forward regression Stage Legal 1A та SEO canonical inventory 13 → 14.

## 22. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| Target privacy regression | PASS | `npm run test:legal-privacy-1b` |
| Contact form regression | PASS | `npm run test:legal-contacts-1a` |
| SEO/footer/sitemap regression | PASS | `npm run test:seo-crawl-foundation` + target assertions |
| ESLint | PASS | `npm run lint` |
| TypeScript | PASS | `npm run typecheck` |
| Production build | PASS | `npm run build` |
| Local HTTP `/privacy-policy` | PASS | HTTP 200, metadata, H1, legal content |
| Local HTTP `/contacts` | PASS | HTTP 200, privacy link |
| Local HTTP `/sitemap.xml` | PASS | HTTP 200, 14 URLs |
| Local HTTP `/robots.txt` | PASS | HTTP 200, policy not blocked |
| Browser desktop/mobile | PASS | 1265px і 390px: content, 1 H1, no overlay/log errors, no horizontal overflow |
| Contact browser state | PASS | required=true, checked=false, privacy link present |
| Whitespace | PASS | `git diff --check` |

## 23. Files changed

- `app/(public)/privacy-policy/page.tsx`
- `app/(public)/contacts/contact-form.tsx`
- `app/sitemap.ts`
- `components/layout/public-layout.tsx`
- `lib/seo.ts`
- `scripts/check-stage-legal-1b-privacy-policy.ts`
- `scripts/check-stage-legal-1a-contacts.ts`
- `scripts/check-seo-crawl-foundation.ts`
- `package.json`
- `docs/reports/stage-legal-1b-privacy-policy.md`

## 24. Legal review caveats

Юрист має погодити правові підстави для кожного процесу, transfer wording, критерії retention, процедуру identity verification, межі прав/винятків, minors wording і достатність consent для contact form. Код-аудит не замінює перевірку чинних договорів із processors, фактичної географії обробки та production operational practices.

## 25. Deferred work

Відкладено `/terms-of-use`, інтеграцію notices в registration/Parts/Logistics/profile/vehicle/upload flows, production retention/delete runbook, підтвердження backup schedule/restore, processor-contract inventory та Cookie Policy до фактичного підключення optional analytics/advertising.

## 26. Production approval checklist

Перед production потрібні: юридичне погодження тексту; review актуальних processor agreements і production topology; перевірка backup/retention practices; push `develop`; Vercel Preview QA desktop/mobile/keyboard; окреме develop→main approval; production build/deploy; live canonical/robots/sitemap smoke. Цей stage жодного з operational кроків не виконує.

## 27. Search Console follow-up

Після окремого production deploy перевірити live URL Inspection для `/privacy-policy`, повторно подати чинний sitemap та дочекатися crawl/index evidence. Search Console у Stage Legal 1B не змінювався.

## 28. Final conclusion

Stage Legal 1B створює кодово перевірену privacy foundation без schema, migration або production змін. Наступний юридичний етап — Stage Legal 1C `/terms-of-use`; form notices слід виконувати окремим Legal Forms Integration після юридичного рішення щодо semantics.
