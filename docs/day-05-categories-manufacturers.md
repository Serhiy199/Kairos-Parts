# Kairos Parts — Day 5 Categories, Subcategories and Manufacturers

## Що реалізовано

Day 5 додав інформаційну структуру напрямів підбору Kairos Parts:

- static data source для категорій, підкатегорій і виробників;
- публічну сторінку `/categories`;
- детальні сторінки `/categories/[slug]`;
- короткий блок `Напрями підбору` на головній;
- admin/CRM placeholders для `/admin/categories` і `/admin/manufacturers`.

Це не інтернет-магазин. Не додано товари, ціни, залишки, кошик, оплату або product pages.

## Додані категорії

1. Запчастини до сільгосптехніки — `agricultural-parts`
2. Запчастини до вантажних авто — `truck-parts`
3. Шини та камери — `tires-tubes`
4. Запчастини до причепів і напівпричепів — `trailers-semitrailers`
5. Комерційний транспорт — `commercial-transport`
6. Універсальні запчастини — `universal-parts`
7. Витратні матеріали — `consumables`

## Підкатегорії

### Запчастини до сільгосптехніки

двигун, трансмісія, гідравліка, фільтри, ремені, підшипники, електрика, ходова частина, навісне обладнання.

### Запчастини до вантажних авто

двигун, ходова, гальмівна система, електрика, кузовні елементи, фільтри, підвіска, трансмісія.

### Шини та камери

агрошини, вантажні шини, камери, обідні стрічки, диски.

### Запчастини до причепів і напівпричепів

осі, підвіска, гальмівні системи, електрика, кузовна фурнітура, зчіпні пристрої.

### Комерційний транспорт

двигун, підвіска, електрика, кузовні деталі, фільтри, витратні матеріали.

### Універсальні запчастини

підшипники, ремені, ущільнення, кріплення, мастильні матеріали, гідравлічні елементи.

### Витратні матеріали

фільтри, масла, мастила, технічні рідини, ремені, лампи, дрібні комплектуючі.

## Виробники

Стартові виробники додані в межах категорій:

- Сільгосптехніка: John Deere, Case IH, Claas, New Holland, Fendt, Massey Ferguson, Deutz-Fahr, Amazone, Horsch, Lemken.
- Вантажні авто: MAN, Mercedes-Benz, Volvo, Scania, DAF, Renault Trucks, Iveco.
- Шини та камери: BKT, Trelleborg, Michelin, Mitas, Continental.
- Причепи та напівпричепи: Schmitz, Krone, Kögel, Wielton, Schwarzmüller.
- Комерційний транспорт: Mercedes-Benz, Volkswagen, Ford, Renault, Iveco, Fiat.
- Універсальні запчастини: SKF, Gates, Bosch, Parker, Donaldson.
- Витратні матеріали: Fleetguard, Donaldson, Mann-Filter, Bosch, Gates.

Цей список стартовий і має розширюватися пізніше через admin/CRM.

## Category to request логіка

Кожна категорія має CTA:

```txt
/request?category=<slug>
```

На детальній сторінці є також CTA:

```txt
/request?category=<slug>&mode=file
```

Форма заявки ще не реалізована, але query parameters підготовлені для Day 6.

## Чому це не інтернет-магазин

Категорії виконують роль навігації для заявки:

```txt
категорія → підкатегорія / виробник → створити заявку
```

Не реалізовано:

- товарні позиції;
- product pages;
- ціни;
- залишки;
- порівняння товарів;
- кошик;
- оплату.

## Файли

Створено або оновлено:

- `lib/catalog/catalog-data.ts`
- `app/(public)/categories/page.tsx`
- `app/(public)/categories/[slug]/page.tsx`
- `app/(public)/page.tsx`
- `app/admin/categories/page.tsx`
- `app/admin/manufacturers/page.tsx`
- `docs/day-05-categories-manufacturers.md`

## Що працює після Day 5

- `/categories` показує всі напрями підбору.
- `/categories/[slug]` показує опис, підкатегорії, виробників і CTA.
- Unknown category slug повертає `notFound()`.
- Головна має короткий блок напрямів.
- `/admin/categories` показує CRM placeholder зі стартовими категоріями.
- `/admin/manufacturers` показує CRM placeholder зі стартовими виробниками.

## Що навмисно не реалізовувалось

- Форма заявки.
- Створення заявок у базі.
- File upload.
- Повний admin CRUD.
- CRM business actions.
- Product model.
- Товари, ціни, залишки.
- Кошик, оплата.
- Telegram, OCR, Viber, Нова пошта, BAS/ERP.

## Блокери для Day 6

Функціональних блокерів немає.

Перед Day 6 потрібно вирішити:

- які query parameters форма заявки має читати на старті;
- чи `category` має мапитись на Prisma `Category.slug`;
- як обробляти `mode=file` для майбутнього завантаження фото/Excel/PDF/DOC;
- чи потрібна валідація unknown category slug у формі заявки.

Git metadata проблема залишається: `.git` є порожньою/невалідною директорією.
