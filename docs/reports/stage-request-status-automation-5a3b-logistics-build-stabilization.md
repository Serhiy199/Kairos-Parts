# Stage 5A3B — Resolve parallel logistics regressions and restore clean build

## 1. Executive summary

Stage 5A3B стабілізував незакомічений parallel logistics scope, відокремив
UI empty selection від domain type, відновив repository-wide `typecheck` і
clean production build. `null` є єдиним empty state у React state; `""`
використовується лише як DOM value placeholder у native `<select>`. Tariff
calculation та address API отримують тільки валідний
`LogisticsTariffCityCode` після explicit guard. Stage 5A3 business logic,
Prisma schema, migrations, DB, Stage 6, `main` і deployment не змінювалися.

## 2. Git and worktree state

Робота виконана безпосередньо в `develop`. Початковий `HEAD`:
`f5357e9d4bd5c103e11858ed47c016515d62de2a`; `main`:
`055200959f2ed8e1be628d46e91265f23cc93e61`. Pre-check показав лише
незакомічений logistics request-form scope; approval-файлів серед нього не
було. Scope можна ізолювати в один commit. Push не виконувався.

## 3. Stage 5A3 baseline

Повністю прочитано
`docs/reports/stage-request-status-automation-5a3-approval-history-reactive-feedback.md`.
Commit `f5357e9` присутній у `develop`. Baseline report зафіксував historical
`TS2322` у combobox lines 119/201 та shared `.next` failure на
`/how-it-works`; сам Stage 5A3 domain/focused suite до parallel diff проходив.

## 4. Parallel logistics diff audit

| File | Change purpose | Type error relevance | Stage 5A3B action |
| --- | --- | ---: | --- |
| `.env.example` | safe-disabled request-form flag | ні | збережено |
| `app/(public)/logistics/page.tsx` | gated CTA | ні | перевірено |
| `app/(public)/logistics/request/page.tsx` | preview route | опосередковано | перевірено |
| `components/public/logistics/logistics-address-combobox.tsx` | address UI/API boundary | так | type-safe nullable scope, payload guards, ARIA fix |
| `components/public/logistics/logistics-request-form.tsx` | controlled form state | так | `null` normalization та explicit domain guard |
| `lib/features/logistics.ts` | feature gates | ні | збережено |
| `lib/logistics/pricing-preview.ts` | tariff preview | так | приймає лише domain code |
| `lib/logistics/request-form-state.ts` | form state helpers | так | parser повертає code або `null` |
| `lib/logistics/tariff-cities.ts` | code catalog/type guard/tariffs | так | guard без unsafe cast |
| `lib/routes.ts` | public route declaration | ні | збережено |
| `scripts/check-logistics-request-form.ts` | focused regression | так | розширено |
| `package.json` | focused command | ні | додано command |

Інших parallel source changes на pre-check не виявлено.

## 5. TypeScript error reproduction

Stage 5A3 baseline містив exact historical errors:

```text
components/public/logistics/logistics-address-combobox.tsx:119
components/public/logistics/logistics-address-combobox.tsx:201
Type '"" | LogisticsTariffCityCode' is not assignable to type
'LogisticsTariffCityCode'.
```

На старті Stage 5A3B файл уже був частково змінений паралельним записом, тому
актуальний `npm.cmd run typecheck` відтворив наступну regression:

```text
components/public/logistics/logistics-address-combobox.tsx(331,37):
error TS2339: Property 'externalAddressId' does not exist on type 'never'.
```

Причина `never`: listbox render був gated через `!value`, але
`aria-selected` повторно читав `value?.externalAddressId`. Обидва набори
failures виправлено без послаблення TypeScript.

## 6. LogisticsTariffCityCode semantics

`LogisticsTariffCityCode` є union значень
`LOGISTICS_TARIFF_CITY_CODES`: `MYRONIVKA`, `OBUKHIV`, `UZYN`, `VASYLKIV`,
`BILA_TSERKVA`, `BORYSPIL`, `KYIV_RIGHT_BANK`, `KYIV_LEFT_BANK`,
`BROVARY`, `IRPIN`, `BUCHA`, `BEREZAN`, `VYSHHOROD`.

Empty selection означає лише «місто ще не обрано» або reset. Це не domain
code і не API scope. React state використовує
`LogisticsTariffCityCode | null`; native `<select>` серіалізує `null` у
`value=""` через `tariffCityCode ?? ''`. Arbitrary strings і `""`
нормалізуються в `null`.

## 7. Root cause lines 119 and 201

| Line | Actual type | Expected type | Root cause | Fix |
| --- | --- | --- | --- | --- |
| historical 119 | `"" \| LogisticsTariffCityCode` | `LogisticsTariffCityCode` у autocomplete scope | UI placeholder потрапив у domain request construction | nullable UI selection, nullable combobox scope, explicit `requestScope` guard |
| historical 201 | `"" \| LogisticsTariffCityCode` | `LogisticsTariffCityCode` у resolve scope | resolve path окремо повторював unsafe construction | той самий explicit guard перед resolve API |
| reproduced 331 | `value` narrowed to `never` | boolean ARIA selection | listbox існує тільки при `!value`, але читав resolved value | `aria-selected={activeIndex === index}` |

Autocomplete і resolve мають однакову boundary policy, але це окремі async
paths, тому guard перевірено в обох місцях.

## 8. Type-safe fix

`parseLogisticsTariffCitySelection(string)` повертає
`LogisticsTariffCityCode | null`. `LogisticsAddressCombobox` приймає
`LogisticsAddressScope | null`; при `null` input disabled, autocomplete не
запускається, а resolve fail-closed. `calculateLogisticsPricePreview()` тепер
типізований тільки `LogisticsTariffCityCode`. API JSON читається як `unknown`
і проходить structural type guards. Не додано `any`, `@ts-ignore`,
`@ts-expect-error`, `as LogisticsTariffCityCode` або strict-config changes.

## 9. Runtime logistics behavior

Browser smoke з `LOGISTICS_ADDRESS_PROVIDER=mock` і preview flag:

1. empty city — address disabled, tariff preview відсутній;
2. `MYRONIVKA` — address enabled, base tariff `1 600 грн`;
3. keyboard `Enter` resolved mock suggestion;
4. зміна на `OBUKHIV` очистила resolved address і показала notice;
5. tariff змінився на `1 700 грн`;
6. clear city повернув DOM `""`, React `null`, disabled address і no preview;
7. re-select на mobile знову ввімкнув address;
8. invalid input відсікає parser/type guard;
9. submit залишається disabled, create API відсутній;
10. 390 px і 320 px не мають horizontal overflow.

## 10. Active Next process audit

Виявлено два Next dev server цього самого repository:

| Port | Next parent/server PID | Evidence |
| ---: | --- | --- |
| 3100 | `22464 → 38364` | command line містила exact repo path і `next dev -p 3100`; title `Kairos Parts` |
| 3016 | `11352 → 37208` | command line містила exact repo path і `next dev -p 3016`; title `Kairos Parts` |

Інші Node processes не завершувалися. Після першого child shutdown launcher
chain для 3016 перезапустив server; додатковий audit встановив повний ланцюг
`28732 npm → 1760 cmd → 30872 next → 35896 start-server`.

## 11. Safe process shutdown

Group `Stop-Process` спочатку повернув PowerShell
`Object reference not set to an instance of an object`, тому результат не
вважався успішним. Після цього кожен підтверджений PID завершено окремо.
Перед фінальним cleanup повністю завершено respawned chain 3016. Порти
`3016`, `3100`, `3129` перевірені як not listening. Codex/browser Node
processes не зупинялися.

## 12. .next cleanup

`git check-ignore -v .next` підтвердив `.gitignore:2:.next`. Absolute path
`D:\Copy_WSL_Project\Kairos Parts\.next` перевірено як descendant repository.
Після зупинки project processes видалено тільки цей generated artifact через
explicit `Remove-Item -LiteralPath ... -Recurse -Force`. Після browser smoke
artifact очищено повторно перед фінальним clean build. Source, env, uploads,
reports, migrations і user data не видалялися.

## 13. /how-it-works prerender investigation

Historical failure:

```text
Cannot read properties of undefined (reading 'call')
```

Після verified process shutdown і clean `.next` він не відтворився.
`/how-it-works` успішно згенерований як static route. Source-level fix цієї
сторінки не потрібний; фактична причина — concurrent/stale generated modules
у shared `.next`, а не актуальний import/server-client defect.

## 14. Build stabilization

Clean `npm.cmd run build` завершився `PASS`: compile, type validation, page
data і `Generating static pages (50/50)`. Build table містить 61 page route
definition: 12 static/SSG route definitions (18 concrete prerendered paths з
category params) і 49 dynamic page routes. Лишилися два existing Edge warnings
про `CompressionStream`/`DecompressionStream` у `jose`; build errors відсутні.

## 15. Logistics tests

Додано command:

```text
npm.cmd run test:logistics-address-combobox
```

Він перевіряє 13 codes/tariffs, valid/empty/invalid normalization, formula,
clear/reset transitions, readiness validation, DOM `null → ""`
normalization, nullable scope guard, domain-only calculation signature,
disabled submission, відсутність create API, `any`, unsafe code cast і
TypeScript suppression. Result:
`logisticsRequestForm=PASS cities=13 formulaCases=5 submit=disabled`.

## 16. Stage 5A3 regression

`npm.cmd run test:request-status-stage5a3` — `PASS`. Повторно підтверджено
cumulative approved history, exact Invoice provenance, badge matrix,
structured reactive actions, toast provider, `router.refresh()` та відсутність
full reload. Logistics fix не змінює Stage 5A3 files або business services.

## 17. Full regression results

`PASS`:

- Stage 2 status transition;
- Stage 3 draft trigger;
- Stage 4B selection batch;
- Stage 4C, 4C1, 4C2, 4C3, 4D;
- Stage 5, 5A, 5A1, 5A2, 5A3;
- Admin Audit Log 2, 3, 4, 5;
- focused logistics test;
- Prisma validate/generate;
- lint, typecheck, clean build, `git diff --check`.

Failures не маскувалися.

## 18. Build environment proof

| Item | Result |
| --- | --- |
| Node | `v24.15.0` |
| npm | `11.12.1` |
| Next.js | `15.5.19` |
| clean artifact | так |
| static generation | `50/50` |
| page route definitions | 61: 12 static/SSG, 49 dynamic |
| build | PASS |
| errors | 0 |
| warnings | 2 existing `jose` Edge warnings |

Browser console додатково містив existing logo aspect-ratio warning; він не
пов'язаний із logistics type/build regression і не розширювався в design fix.

## 19. Prisma and DB safety

`prisma/schema.prisma` не змінено, migration не створено. Виконано лише
read-only `prisma validate` та generated-client `prisma generate`.
`migrate deploy`, `migrate dev`, `db push`, `migrate reset`, Neon/VPS writes
і будь-які data mutations не виконувалися.

## 20. Changed files

- `.env.example`;
- `app/(public)/logistics/page.tsx`;
- `app/(public)/logistics/request/page.tsx`;
- `components/public/logistics/logistics-address-combobox.tsx`;
- `components/public/logistics/logistics-request-form.tsx`;
- `lib/features/logistics.ts`;
- `lib/logistics/pricing-preview.ts`;
- `lib/logistics/request-form-state.ts`;
- `lib/logistics/tariff-cities.ts`;
- `lib/routes.ts`;
- `scripts/check-logistics-request-form.ts`;
- `package.json`;
- цей report.

## 21. Remaining unrelated changes

На pre-commit review unrelated approval, schema, migration, secret або Stage 6
changes не виявлено. `.next` ignored і не staged. Після commit очікується
clean worktree; якщо зовнішній parallel writer додасть нові зміни, вони не
мають включатися автоматично.

## 22. Known limitations

Submit навмисно disabled: Stage Logistics 4 preview не створює заявку.
Browser smoke використовував synthetic mock provider, не Google provider і не
production. Authenticated Stage 5A3 mutation browser smoke з попереднього етапу
лишається окремим deployment-readiness пунктом. Existing `jose` Edge і logo
aspect-ratio warnings не виправлялися, бо не є root cause цього stage.

## 23. Stage 6 readiness

Repository-wide local Stage 6 gate після code checks, regressions і clean build
— `READY`. Stage 6 у цьому task не починався. Vercel deployment gate —
`NOT READY`: push/deploy не авторизовані, production/staging runtime не
перевірявся, authenticated Stage 5A3 smoke лишається окремим gate.

## 24. Final conclusion

Parallel logistics diff стабілізовано type-safe: UI empty state явний,
domain/API boundary не приймає `""`, autocomplete/resolve мають guards,
tariff calculation працює тільки з валідним code, ARIA keyboard selection
узгоджений із open listbox. Shared `.next` contention усунуто, historical
`/how-it-works` failure не відтворюється на clean build. Stage 2–5A3, Audit
Log 2–5, Prisma, lint, typecheck, build і diff checks проходять; DB, Stage 6,
`main`, deployment і push не змінені.
