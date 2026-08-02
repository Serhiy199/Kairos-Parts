# Stage Legal 1F — Contacts Content Consolidation

## 1. Executive summary

Сторінку `/contacts` спрощено без втрати підтверджених контактних або юридичних даних. Legal heading та юридичну особу перенесено нагору, а контактні й юридичні реквізити скомпоновано навколо незміненої contact form. Окрему нижню legal section прибрано; email відображається в main content один раз.

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
| Email | Практичний контакт; офіційні звернення; privacy-запити | Одна email-група біля форми для всіх типів звернень |
| Телефони | Номер менеджера у contacts; юридичний номер в окремій legal card | Один телефонний пункт із двома номерами та різними призначеннями |
| Назва ТОВ | Коротка назва; повна назва; окрема картка володільця | Одна верхня група `Юридична особа` з short name і secondary full name |
| Адреси | Фактична адреса у contacts; юридична адреса в окремій legal section | Один address-пункт із двома явно розділеними адресами |
| Статус оператора/володільця | Eyebrow; heading; пояснювальний абзац; окрема картка | Один H2 і один точний підзаголовок |
| Письмові претензії | Окремий wrapper з повтором ТОВ та адреси | Одна legal detail group з коротким текстом |

Зайвим рівнем була окрема нижня legal section. Після follow-up усі дані знаходяться в одній основній секції після hero.

## 5. Contact block preservation

Збережено номер менеджера `(068) 008 77 08`, юридичний номер `+38 (067) 668-08-08`, email `kairos_parts@ukr.net`, фактичну адресу `м. Кагарлик, вул. Миронівська, 33д`, юридичну адресу на `вул. Сергієнка, буд. 20`, Telegram і графік. Обидва номери тепер розміщені в одному телефонному пункті, а обидві адреси — в одному address-пункті з окремими labels і призначеннями.

## 6. Legal heading simplification

H2 `Юридична інформація` та підзаголовок `Реквізити ТОВ «КАЙРОС ПАРТС» як оператора сервісу та володільця персональних даних.` перенесено на початок основної секції замість `Оберіть зручний спосіб зв’язку` і його пояснення.

## 7. Legal entity consolidation

Коротку назву `ТОВ «КАЙРОС ПАРТС»` і повну назву згруповано в одному верхньому summary block відразу після legal heading. Окремої картки `Володілець персональних даних` немає; правовий статус явно збережено в підзаголовку.

## 8. Email consolidation

У main content залишено одну email-групу `EMAIL` з одним `mailto:`. Її description охоплює списки позицій, документи, B2B, загальні, офіційні та privacy-звернення. Окрему legal email-групу видалено.

## 9. Claims wording simplification

Claims block перенесено під contact form. Текст: `Приймаються поштою за зазначеною в блоці контактів юридичною адресою.` Повна юридична адреса виводиться один раз у спільному address-пункті.

## 10. Layout changes

Після верхнього legal summary розміщено двоколонковий desktop card: контакти ліворуч, `ЄДРПОУ → форма → письмові претензії` праворуч. На mobile колонки складаються послідовно. Довгі значення використовують `min-w-0` і `break-words`; окремої нижньої legal section немає.

## 11. Accessibility

- Rendered DOM: один H1; усі section headings — H2, без heading-level skip.
- Основна секція має `aria-labelledby="legal-information-title"`; form/requisites column має окреме accessible label.
- Обидва телефони мають різні `tel:` URI; email має `mailto:`.
- Link focus-visible styles збережені.
- Browser DOM містить один main-content email link; телефони й адреси мають різні accessible meanings.

## 12. Metadata and SEO preservation

`metadata`, `PUBLIC_PAGE_SEO.contacts`, canonical, Open Graph, robots, sitemap і footer не змінювалися. Regression підтвердив canonical `https://kairos-parts.com.ua/contacts`, `index, follow` і 15 унікальних sitemap URL.

## 13. Regression tests

Stage 1F regression перевіряє single-section layout, одну email-групу, об'єднані телефонний/address-пункти, порядок `legal heading → entity → contacts`, порядок `ЄДРПОУ → форма → claims`, незмінні form fields, canonical і sitemap. Stage 1A assertions синхронізовано з новим presentation contract без послаблення data/form/action перевірок.

## 14. Responsive browser QA

- URL: локальний production build, `GET /contacts` → `200`.
- Desktop `1280×720`: PASS; stylesheets loaded: 2; legal heading/entity нагорі; email один раз; обидва телефони поруч; `ЄДРПОУ` перед формою; claims після submit; overflow відсутній.
- Mobile `390×844`: PASS; rendered width і scroll width 375 px; single-column order коректний; обидві адреси читабельні й розділені; overflow/overlay відсутні.
- `tel:+380680087708`, `tel:+380676680808`, `mailto:kairos_parts@ukr.net` присутні у rendered DOM.
- Console warnings/errors: 0.
- Через паралельні локальні Next-процеси на 3000/3001 QA виконано в ізольованому temporary dist directory; після QA server зупинено, directory видалено, тимчасові config/tsconfig зміни повністю прибрано.

## 15. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| `test:legal-contacts-consolidation-1f` | PASS | single section, one email group, sitemap 15, contacts canonical |
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
