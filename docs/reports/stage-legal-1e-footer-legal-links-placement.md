# Stage Legal 1E — Move Legal Links Under Footer Logo

## 1. Executive summary

У shared public footer видалено маркетинговий опис під логотипом і на його місце переміщено links на `/privacy-policy` та `/terms-of-use`. Нижній дублюючий legal navigation прибрано. «Контакти» збережено в чинній колонці «Навігація». Legal pages, sitemap, robots, metadata, форми, БД і production не змінювалися.

## 2. Git baseline

- Branch: `develop`.
- Початковий HEAD: `8cb7d2a8903d1b647fcc7c7238a594395028dfa9`.
- Commit Stage Legal 1D підтверджено як ancestor `develop`.
- Початковий working tree: clean.
- Reset, rebase, merge, push і deploy не виконувалися.

## 3. Previous footer structure

Фактичний footer знаходиться в `components/layout/public-layout.tsx` і використовується всіма public pages. Окремих desktop/mobile footer components немає. Перша grid-колонка містила logo та маркетинговий опис. Privacy, Terms і додатковий literal Contacts link були в нижньому `Правова інформація` navigation, тоді як Contacts уже рендерився через `navItems` у колонці «Навігація».

## 4. Footer changes

Під footer logo додано семантичний `<nav aria-label="Правова інформація">` з вертикальними links:

- `Політика конфіденційності` → `/privacy-policy`;
- `Умови користування` → `/terms-of-use`.

Видалено текст: «Єдина точка контакту для підбору та постачання запчастин для аграрної, вантажної та спеціальної техніки». Нижній рядок тепер містить лише copyright.

## 5. Duplicate link cleanup

Нижній legal navigation видалено повністю. Runtime DOM на кожному з чотирьох перевірених маршрутів містить рівно один `/privacy-policy`, один `/terms-of-use` і один `/contacts` у footer. Contacts залишається елементом `navItems` у колонці «Навігація».

## 6. Accessibility

Legal links залишаються нативними Next.js links усередині семантичного navigation з accessible name `Правова інформація`. Обидва мають hover state і явні `focus-visible:outline`, `outline-2`, `outline-offset-2`. Browser click navigation підтвердила валідність обох маршрутів; header logo link `/` не змінювався.

## 7. Responsive QA

На `/`, `/contacts`, `/privacy-policy`, `/terms-of-use` перевірено 1280×720 і 390×844. На всіх сторінках legal navigation знаходиться нижче logo, старий опис відсутній, link counts дорівнюють 1/1/1, horizontal overflow і full-screen overlay відсутні. Footer не перекошений, console warnings/errors відсутні.

## 8. Regression tests

Додано `test:legal-footer-1e`, який перевіряє shared footer, порядок logo/links, відсутність старого тексту, унікальність Privacy/Terms, Contacts navigation contract, focus classes, header logo link і незмінний sitemap із 15 URL. Legal 1C/1D assertions для Contacts оновлено з literal footer href на фактичний `navItems` contract без послаблення інших перевірок.

## 9. Validation results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run test:legal-footer-1e` | PASS | Privacy 1, Terms 1, Contacts 1, sitemap 15 |
| `npm run test:legal-layout-1d` | PASS | Privacy 19, Terms 24, sitemap 15 |
| `npm run test:legal-privacy-1b` | PASS | 19 sections, canonical preserved |
| `npm run test:legal-terms-1c` | PASS | 24 sections, canonical preserved |
| `npm run test:seo-crawl-foundation` | PASS | 15 URLs, no exact `/categories` |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run build` | PASS | Next.js 15.5.19; 58 pages generated |
| Desktop browser QA | PASS | 4 routes at 1280×720 |
| Mobile browser QA | PASS | 4 routes at 390×844 |
| Link navigation | PASS | Privacy and Terms mouse-click navigation reached correct routes |
| Browser console | PASS | No warnings/errors |
| `git diff --check` | PASS | Repeat after commit |

## 10. Files changed

- `components/layout/public-layout.tsx`
- `scripts/check-stage-legal-1e-footer-legal-links-placement.ts`
- `scripts/check-stage-legal-1d-legal-pages-layout-simplification.ts`
- `scripts/check-stage-legal-1c-terms-of-use.ts`
- `package.json`
- `docs/reports/stage-legal-1e-footer-legal-links-placement.md`

## 11. Final conclusion

Stage Legal 1E виконано в узгодженому footer-only scope. Legal links переміщені під logo без дублікатів, Contacts збережено у навігаційній колонці, responsive/accessibility contracts перевірено. Legal pages, sitemap, metadata, DB, migrations і production залишилися без змін.
