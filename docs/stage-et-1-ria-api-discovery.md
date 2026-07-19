# Stage ET-1 — RIA equipment taxonomy API discovery

Дата перевірки: 19 липня 2026 року

Статус: **BLOCKED — офіційні endpoints підтверджені документацією, але authenticated live proof не виконано через відсутній `RIA_API_KEY`.**

## 1. Scope

Цей етап обмежений discovery та API proof. Prisma schema, migration, форми, API routes, UI, Telegram flow і поточні довідники не змінювалися. ET-2 не розпочато.

## 2. Підтверджені official endpoints

| Дані | Метод | Endpoint | Авторизація |
|---|---|---|---|
| Типи агротехніки | `GET` | `https://developers.ria.com/agro_ria/transport_tags/?api_key=API_KEY` | API key у query string |
| Виробники за типом | `GET` | `https://developers.ria.com/agro_ria/marks/?api_key=API_KEY&tag_id=TAG_ID` | API key у query string |

Офіційна документація:

- [Типи транспорту (AGRO.RIA)](https://docs-developers.ria.com/en/agro_ria/transport_tags)
- [Марки (AGRO.RIA)](https://docs-developers.ria.com/en/agro_ria/marks)
- [Використання API ключа](https://docs-developers.ria.com/en/main_rules/api_key_usage)
- [Загальні помилки API](https://docs-developers.ria.com/en/main_rules/general_errors)

Обидва endpoints позначені як freemium. Документація вимагає персональний API key. Для `marks` параметр `tag_id` задокументований як тип транспорту.

Огляд AGRO.RIA API також вимагає під час використання сервісу розмістити відкритий для індексації hyperlink на AGRO.RIA. Перед production integration цю вимогу потрібно врахувати окремо.

## 3. Response shape за офіційною документацією

### `transport_tags`

Мінімально потрібні поля:

```text
tag_id: number
name: string
eng: string
```

Також документація показує `ablative`, `accusative`, `gender`, `genitive`, `lang_id`, `plural`, `plural_ablative`, `plural_genitive`.

### `marks`

Мінімально потрібні поля:

```text
marka_id: number
name: string
marka: string
marka_eng: string
eng: string
slang: string
main_category: number
category_id: string | number
```

Документаційна сторінка `marks` має помилковий заголовок/опис про міста, але її endpoint, параметри та sample response стосуються саме марок AGRO.RIA. Це варто враховувати як документаційну неточність, а не як доказ несправності endpoint.

## 4. Live API proof

У checkout не знайдено непорожнього `RIA_API_KEY` ані в process environment, ані в `.env.local`. Значення ключа не запитувалося, не виводилося й не записувалося.

Через це на поточному запуску не можна доказово вказати:

- фактичну кількість transport types;
- фактичні response keys;
- counts виробників для п’яти test types;
- приклади п’яти виробників;
- чи відповіді `marks` реально відрізняються для різних `tag_id`.

| Test type | tag id | API name | Manufacturers | 5 examples | Результат |
|---|---:|---|---:|---|---|
| Трактор | — | — | — | — | Не виконано: немає API key |
| Комбайн | — | — | — | — | Не виконано: немає API key |
| Вантажівка | — | — | — | — | Не виконано: немає API key |
| Екскаватор | — | — | — | — | Не виконано: немає API key |
| Сівалка | — | — | — | — | Не виконано: немає API key |

## 5. Probe

Створено `scripts/probe-ria-equipment-api.ts`. Він:

- завантажує `.env.local`, потім `.env`, не перезаписуючи process environment;
- вимагає `RIA_API_KEY` і завершується з non-zero exit code, якщо ключ відсутній;
- не виводить API key та не включає URL із ключем у помилки;
- використовує HTTPS, timeout 15 секунд, два retry з exponential backoff і user-agent `KairosParts-RiaTaxonomyProbe/1.0`;
- перевіряє, що обидві відповіді є масивами;
- перевіряє мінімальні `tag_id/name` та `marka_id/name`;
- шукає п’ять test types за назвами з урахуванням можливих відмінностей у формах слів;
- виводить JSON із загальною кількістю типів, response keys, counts і п’ятьма прикладами manufacturers;
- порівнює sample IDs між test types як базовий сигнал, що `tag_id` впливає на результат.

Безпечний локальний запуск після додавання ключа до незакоміченого `.env.local`:

```bash
npx.cmd tsx scripts/probe-ria-equipment-api.ts
```

Очікуваний env name: `RIA_API_KEY`. Реальне значення не повинно потрапляти в git, output або цей report.

## 6. Поточна taxonomy architecture Kairos Parts

- Equipment types hardcoded у `lib/vehicles/equipment-types.ts`.
- Type → manufacturer mapping hardcoded у `lib/vehicles/equipment-manufacturers.ts`.
- Public/authenticated request form використовує existing searchable combobox і вже фільтрує локальні manufacturer suggestions за type.
- Telegram має окремий flow на тих самих hardcoded constants; його migration не входить у поточний scope.
- Vehicle зберігає `type` і `manufacturer` як plain text.
- Request зберігає `equipmentType` як plain text, а manufacturer через existing `Manufacturer` relation.
- Existing `Manufacturer` model пов’язана також із catalog category/subcategory та used equipment; її не слід автоматично вважати готовою normalized equipment taxonomy без окремого schema analysis.
- Used-equipment та admin vehicle flows також залежать від current local mapping.

## 7. API errors і limits

Офіційна загальна документація описує:

- `403`: missing, invalid, disabled, unauthorized або unverified API key;
- `400`: HTTPS required;
- `404`: endpoint not found;
- `429`: rate limit exceeded.

Точний числовий rate limit саме для AGRO.RIA taxonomy endpoints на їхніх сторінках не вказаний; він залежить від пакета API. Тому importer має бути консервативним і обробляти `429`, але не повинен закладати непідтверджену квоту.

## 8. Чи достатньо official API

Попередньо — **так**. Документовані `transport_tags` і `marks?tag_id=...` покривають потрібну залежність без HTML scraping або AJAX fallback.

Остаточний висновок можливий після authenticated probe, який підтвердить:

1. фактичні response schemas;
2. наявність потрібних test types;
3. counts і приклади manufacturers;
4. реальну зміну списку manufacturers між різними `tag_id`.

До цього моменту HTML parser та AJAX fallback не потрібні й не повинні розроблятися.

## 9. Рекомендована ET-2 architecture

Після успішного proof:

1. Окремий RIA client без runtime-залежності UI.
2. Fetch transport tags один раз.
3. Controlled queue із concurrency 2–4 для `marks`.
4. Timeout, retry/backoff і обробка `429`.
5. Нормалізація та deterministic sort.
6. Snapshot із metadata без API key.
7. Duplicate report без fuzzy auto-merge.
8. ET-2 завершується snapshot/report і не застосовує зміни до БД.

## 10. Blocker для ET-2

**Так.** Потрібен валідний `RIA_API_KEY`, доступний локально як environment variable або в незакоміченому `.env.local`. Після його додавання потрібно запустити probe, перенести фактичні counts і п’ять test results у цей report та лише тоді закрити ET-1.
