# Stage Legal 1F — Contacts Content Consolidation

## 1. Executive summary

Сторінку `/contacts` спрощено без втрати підтверджених контактних або юридичних даних. Практичний контактний блок і contact form залишено без функціональних змін, а юридичну секцію зведено до шести чітких груп без дубльованих headings, email-карток, картки володільця даних і повтору повної адреси в тексті претензій.

## 2. Git baseline

- Branch: `develop`.
- Baseline HEAD: `ff8e72cee8841d3da2cbfa9a23cf1a9ab15424a1` (`style: move legal links under footer logo`).
- Working tree до початку: clean.
- Попередні Legal commits 1A–1E присутні в останніх п'яти commits.
- Reset, rebase і clean не використовувалися.

## 3. Previous contacts structure

Сторінка складалася з hero, практичного контактного блоку, contact form та legal section. Legal section мала eyebrow `ОПЕРАТОР СЕРВІСУ`, heading, пояснювальний абзац, окремий великий блок короткої назви, сім detail items і додатковий wrapper для письмових претензій.

## 4. Duplicate content audit

| Information | Previous occurrences | New representation |
| --- | --- | --- |
| Email | Практичний контакт; офіційні звернення; privacy-запити | Практичний контакт збережено; у legal block одна спільна група |
| Назва ТОВ | Коротка назва; повна назва; окрема картка володільця | Одна група `Юридична особа` з short name і secondary full name |
| Юридична адреса | Реквізит; повний повтор у claims text | Одна address group; claims посилаються на адресу вище |
| Статус оператора/володільця | Eyebrow; heading; пояснювальний абзац; окрема картка | Один H2 і один точний підзаголовок |
| Письмові претензії | Окремий wrapper з повтором ТОВ та адреси | Одна legal detail group з коротким текстом |

Зайвими рівнями були окремий primary-name wrapper, сім однотипних detail cards і ще один claims wrapper усередині зовнішньої card shell.

## 5. Contact block preservation

Збережено номер менеджера `(068) 008 77 08`, email `kairos_parts@ukr.net`, фактичну адресу `м. Кагарлик, вул. Миронівська, 33д`, Telegram `@kairos_parts_bot`, графік `Пн–Сб: 08:30–17:30` та їхні призначення. Фактична адреса не названа юридичною, а юридичний номер не перенесено у практичний блок.

## 6. Legal heading simplification

Eyebrow `ОПЕРАТОР СЕРВІСУ` видалено. Залишено H2 `Юридична інформація` та один підзаголовок: `Реквізити ТОВ «КАЙРОС ПАРТС» як оператора сервісу та володільця персональних даних.`

## 7. Legal entity consolidation

Коротку назву `ТОВ «КАЙРОС ПАРТС»` і повну назву згруповано в одному semantic `dt`/`dd` item `Юридична особа`. Повну назву збережено як secondary text. Окремої картки `Володілець персональних даних` більше немає; правовий статус явно збережено в підзаголовку.

## 8. Email consolidation

Дві legal email-картки замінено однією групою `Email для офіційних звернень і питань щодо персональних даних`. У legal section email і `mailto:` відображаються рівно один раз. Email у верхньому практичному блоці не видалено.

## 9. Claims wording simplification

Текст скорочено до `Приймаються поштою за зазначеною вище юридичною адресою.` Повна юридична адреса виводиться лише у власній address group.

## 10. Layout changes

Legal content оформлено одним адаптивним definition-list grid: дві колонки від `sm`, одна колонка на mobile. Юридична особа і claims займають повну ширину; довгі значення мають `min-w-0` та `break-words`. Додатковий вкладений claims wrapper прибрано.

## 11. Accessibility

- Rendered DOM: один H1; усі section headings — H2, без heading-level skip.
- Legal section має `aria-labelledby="legal-information-title"` і semantic `dl`/`dt`/`dd`.
- Обидва телефони мають різні `tel:` URI; email має `mailto:`.
- Link focus-visible styles збережені.
- Browser DOM не містить дубльованих legal detail names.

## 12. Metadata and SEO preservation

`metadata`, `PUBLIC_PAGE_SEO.contacts`, canonical, Open Graph, robots, sitemap і footer не змінювалися. Regression підтвердив canonical `https://kairos-parts.com.ua/contacts`, `index, follow` і 15 унікальних sitemap URL.

## 13. Regression tests

Додано `scripts/check-stage-legal-1f-contacts-content-consolidation.ts` і npm script `test:legal-contacts-consolidation-1f`. Stage 1A assertions оновлено з попереднього дубльованого presentation contract на новий consolidated contract, зберігши перевірки реквізитів, форми, parser, action, schema, canonical і robots.

## 14. Responsive browser QA

- URL: локальний production build, `GET /contacts` → `200`.
- Desktop `1280×720`: PASS; stylesheets loaded: 2; legal section має 6 груп; email/address по одному разу; overflow відсутній; footer і sticky header не перекривають content.
- Mobile `390×844`: PASS; rendered content width 375 px і scroll width 375 px; усі legal cards мають ширину 341 px; форма має ширину 293 px; overflow і overlay відсутні.
- `tel:+380680087708`, `tel:+380676680808`, `mailto:kairos_parts@ukr.net` присутні у rendered DOM.
- Console warnings/errors: 0.
- Через паралельні локальні Next-процеси на 3000/3001 QA виконано в ізольованому temporary dist directory; після QA server зупинено, directory видалено, тимчасові config/tsconfig зміни повністю прибрано.

## 15. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| `test:legal-contacts-consolidation-1f` | PASS | `legalGroups=6`, sitemap 15, contacts canonical |
| `test:legal-contacts-1a` | PASS | canonical, required consent, `ContactMessageStatus.NEW` |
| `test:legal-privacy-1b` | PASS | 19 sections, sitemap 15, canonical |
| `test:legal-terms-1c` | PASS | 24 sections, sitemap 15, canonical |
| `test:legal-layout-1d` | PASS | Privacy/Terms layouts and sitemap |
| `test:legal-footer-1e` | PASS | Single legal links, contacts nav, sitemap 15 |
| `test:seo-crawl-foundation` | PASS | 15 URLs, 10 robots exclusions, production origin |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run build` | PASS | 58 static pages generated; `/contacts` in route inventory |
| Desktop browser QA | PASS | 1280×720, rendered CSS, no overflow/overlay |
| Mobile browser QA | PASS | 390×844, rendered CSS, no overflow/overlay |
| Browser console | PASS | 0 warnings/errors |
| `git diff --check` | PASS | No whitespace errors |

## 16. Files changed

- `app/(public)/contacts/page.tsx`
- `scripts/check-stage-legal-1a-contacts.ts`
- `scripts/check-stage-legal-1f-contacts-content-consolidation.ts`
- `package.json`
- `docs/reports/stage-legal-1f-contacts-content-consolidation.md`

`contact-form.tsx`, `actions.ts`, Privacy Policy, Terms of Use, SEO files, sitemap, Prisma schema and migrations were not changed.

## 17. Final conclusion

Stage Legal 1F meets the requested content, semantic, responsive, accessibility and regression gates. Database, migrations, production, push, merge and deploy were not touched.
