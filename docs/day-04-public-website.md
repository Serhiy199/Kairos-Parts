# Kairos Parts — Day 4 Public Website

## Що реалізовано

Day 4 реалізував базову публічну частину сайту Kairos Parts без бізнес-логіки заявок, CRM, Telegram flow або OCR.

Створено повноцінні презентаційні сторінки:

- головна `/`;
- сторінка `/about`;
- сторінка `/how-it-works`;
- сторінка `/contacts`.

Оновлено public layout:

- sticky dark navy header;
- desktop navigation;
- mobile menu;
- CTA `Створити заявку`;
- Telegram CTA placeholder;
- footer з описом, навігацією та placeholder контактами.
- generated hero image asset `public/images/kairos-hero-industrial.png`.

## Оновлені сторінки

- `app/(public)/page.tsx`
- `app/(public)/about/page.tsx`
- `app/(public)/how-it-works/page.tsx`
- `app/(public)/contacts/page.tsx`

## Блоки головної сторінки

Головна містить:

1. Hero з основним повідомленням:
   `Підберемо та доставимо необхідні запчастини за одним запитом`.
2. Підзаголовок для аграрної, вантажної, комерційної та спеціальної техніки.
3. CTA-кнопки для створення заявки, списку, фото та Telegram placeholder.
4. Блок `Як це працює` з трьома кроками.
5. Блок переваг B2B-процесу.
6. Блок цільових аудиторій.
7. Блок способів створення заявки.

## CTA

- `Створити заявку` → `/request`
- `Надіслати список` → `/request`
- `Завантажити фото` → `/request`
- `Створити заявку в Telegram` → `/#telegram`
- contact page CTA → `/request`

На Day 4 ці CTA ведуть на існуючі маршрути або placeholder anchor. Реальна форма заявки та Telegram bot flow не реалізовані.

## Дизайн-система

Використано палітру з `docs/design-system.md`:

- deep navy `#07111F`;
- secondary navy `#12304A`;
- accent yellow/gold `#F5B800`;
- light background `#F4F6F8`;
- white cards;
- muted borders and shadows.

Стиль витримано як B2B SaaS / industrial service: світлі content sections, темні navy hero/header blocks, жовто-золоті CTA, чисті card grids і спокійна типографіка.

Hero використовує локальний generated bitmap asset з dark navy overlay, щоб перший екран одразу передавав аграрно-вантажний industrial контекст.

## Що працює після Day 4

- Public header і footer.
- Mobile menu.
- `/`, `/about`, `/how-it-works`, `/contacts`.
- CTA navigation до `/request` та `/#telegram`.
- Responsive card grids для desktop/tablet/mobile.
- Existing public routes залишаються доступними.

## Що навмисно не реалізовувалось

- Форма заявки.
- Реальне створення заявки.
- Повний модуль категорій, підкатегорій і виробників.
- Кабінет клієнта.
- CRM business logic.
- Telegram bot flow.
- OCR.
- Auth UI.
- Реальні контакти.
- Viber.
- Магазин, кошик, оплата, Нова пошта, BAS/ERP.

## Блокери для Day 5

Функціональних блокерів для Day 5 немає.

Перед реалізацією категорій варто узгодити:

- початковий список категорій;
- чи потрібні SEO slug-и українською або латиницею;
- як виробники пов'язуються з категоріями та підкатегоріями;
- чи категорії мають бути статичними на старті або керованими через CRM.

Технічна нотатка: git metadata досі не готовий до комітів, бо `.git` є порожньою директорією.
