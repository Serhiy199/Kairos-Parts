# Kairos Parts MVP Design System

## Загальний стиль

Kairos Parts має виглядати як сучасна B2B-платформа для заявок на запчастини, а не як класичний інтернет-магазин. Візуальна основа: темний navy header/sidebar, жовто-золотий CTA-акцент, світлий робочий фон, білі картки, чисті таблиці, стримані статуси та технічна індустріальна естетика.

Інтерфейс повинен бути зрозумілим для аграрного, вантажного та спеціального B2B-сегменту: менше декоративності, більше ясної структури, швидкого сканування, видимих статусів і практичних дій.

## Палітра

### Основні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `primary` | `#07111F` | Header, sidebar, темні панелі, hero overlay |
| `secondary` | `#12304A` | Активні елементи sidebar, другорядні темні блоки |
| `accent` | `#F5B800` | CTA, іконки, важливі маркери, активні кроки |
| `background` | `#F4F6F8` | Основний фон сторінок і кабінетів |
| `foreground` | `#111827` | Основний текст |
| `muted` | `#6B7280` | Другорядний текст, підписи, допоміжні дані |
| `border` | `#E2E8F0` | Межі карток, таблиць, inputs |
| `card` | `#FFFFFF` | Картки, форми, таблиці |

### Семантичні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `success` | `#2E7D4F` | Завершені дії, успішні статуси |
| `warning` | `#B7791F` | Очікування, погодження, попередження |
| `danger` | `#B42318` | Помилки, скасування, критичні дії |
| `info` | `#2563A6` | Інформаційні статуси, поточна обробка |

### UI-специфічні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `dark-sidebar` | `#07111F` | Sidebar CRM/client dashboard |
| `button-primary` | `#F5B800` | Основні CTA-кнопки |
| `button-secondary` | `#101827` | Темні другорядні кнопки |
| `input-background` | `#FFFFFF` | Inputs, selects, textareas |
| `surface-muted` | `#F8FAFC` | М'які панелі всередині карток |
| `sidebar-active` | `#132238` | Активний пункт меню |
| `sidebar-text` | `#D7DEE8` | Текст у sidebar |
| `sidebar-muted` | `#8EA0B5` | Другорядний текст у sidebar |

## CSS Variables

```css
:root {
  --color-primary: #07111f;
  --color-secondary: #12304a;
  --color-accent: #f5b800;
  --color-background: #f4f6f8;
  --color-foreground: #111827;
  --color-muted: #6b7280;
  --color-border: #e2e8f0;
  --color-card: #ffffff;

  --color-success: #2e7d4f;
  --color-warning: #b7791f;
  --color-danger: #b42318;
  --color-info: #2563a6;

  --color-dark-sidebar: #07111f;
  --color-button-primary: #f5b800;
  --color-button-secondary: #101827;

  --color-input-background: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-sidebar-active: #132238;
  --color-sidebar-text: #d7dee8;
  --color-sidebar-muted: #8ea0b5;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06);
  --shadow-panel: 0 12px 32px rgba(7, 17, 31, 0.12);
}
```

## Tailwind Theme Tokens

```js
theme: {
  extend: {
    colors: {
      primary: '#07111F',
      secondary: '#12304A',
      accent: '#F5B800',
      background: '#F4F6F8',
      foreground: '#111827',
      muted: '#6B7280',
      border: '#E2E8F0',
      card: '#FFFFFF',
      success: '#2E7D4F',
      warning: '#B7791F',
      danger: '#B42318',
      info: '#2563A6',
      'dark-sidebar': '#07111F',
      'button-primary': '#F5B800',
      'button-secondary': '#101827',
      'surface-muted': '#F8FAFC',
      'sidebar-active': '#132238',
      'sidebar-text': '#D7DEE8',
      'sidebar-muted': '#8EA0B5'
    },
    borderRadius: {
      sm: '6px',
      md: '8px',
      lg: '10px'
    },
    boxShadow: {
      card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
      panel: '0 12px 32px rgba(7, 17, 31, 0.12)'
    }
  }
}
```

## Typography

- Базовий шрифт: `Inter`, `Manrope` або системний sans-serif.
- Основний текст: `14px` або `15px`, line-height `1.45-1.6`.
- Dashboard/table text: `13px-14px` для щільного, але читабельного CRM-інтерфейсу.
- Page title: `24px-32px`, weight `700`.
- Section title/card title: `16px-20px`, weight `600-700`.
- Labels: `12px-13px`, weight `500-600`, колір `foreground` або `muted`.
- Не використовувати надмірно великі marketing-style заголовки у кабінетах і CRM.

## Layout Principles

### Public Layout

- Темний top header з логотипом, навігацією та CTA `Створити заявку`.
- Hero може використовувати індустріальне фото техніки з темним overlay.
- CTA-кнопки жовто-золоті, другорядні кнопки темні або outline.
- Публічні секції мають бути світлими, з білими картками для процесу, переваг, каналів зв'язку та прикладів заявок.

### Client Dashboard Layout

- Лівий темний sidebar шириною `240-280px` на desktop.
- Світла content area `background`.
- Верхня панель з назвою сторінки, пошуком або швидкою дією.
- Dashboard будується на stat cards, списках останніх заявок, статусній timeline і картках техніки.
- На mobile sidebar переходить у drawer або bottom navigation для ключових розділів.

### CRM/Admin Layout

- Темний sidebar з компактною навігацією.
- Основна зона оптимізована під таблиці, фільтри, пошук і bulk actions.
- Таблиці повинні бути чистими, з невеликими badge статусів і зрозумілими row actions.
- Фільтри розміщувати над таблицею в один ряд на desktop, стеком на mobile.

## UI Components

### Button

- Radius: `8px`.
- Height: `40px` стандарт, `36px` compact, `48px` prominent CTA.
- Padding: `10px 16px`, для icon-only `40px x 40px`.
- Primary: background `accent`, text `#111827`, hover `#DFA600`, active `#C99200`.
- Secondary: background `button-secondary`, text white, hover `#1A2638`.
- Outline: white/transparent background, border `border`, hover `surface-muted`.
- Disabled: opacity `0.55`, cursor `not-allowed`, без shadow.
- Focus: `2px` ring `rgba(245, 184, 0, 0.35)`.
- Mobile: full-width у формах і wizard-кроках, але icon actions залишаються компактними.

### Input

- Height: `40px-44px`.
- Radius: `8px`.
- Border: `1px solid border`.
- Background: `input-background`.
- Focus: border `accent`, ring `rgba(245, 184, 0, 0.25)`.
- Placeholder: `#9CA3AF`.
- Error: border `danger`, helper text `danger`.
- Disabled: background `#F1F5F9`, text `muted`.

### Select

- Стилістично як Input.
- Chevron справа, не текстова кнопка.
- Active/focus state такий самий як Input.
- У CRM таблицях використовувати compact height `36px`.

### Textarea

- Min-height: `112px`.
- Radius: `8px`.
- Resize vertical.
- Focus/error/disabled як Input.
- Для коментарів до заявки дозволити `min-height: 88px`.

### FileUpload

- White або `surface-muted` background.
- Dashed border `#CBD5E1`.
- Radius: `10px`.
- Hover: border `accent`, subtle background `#FFFBEB`.
- Active drag state: border `accent`, ring.
- Показувати список файлів у compact rows з іконкою типу файлу, розміром і кнопкою видалення.
- Mobile: зона завантаження full-width, кнопка `Обрати файл` full-width.

### Card

- Background `card`.
- Border `1px solid border`.
- Radius `10px`.
- Shadow `shadow-card`, без важких тіней.
- Padding: `16px` mobile, `20px-24px` desktop.
- Hover для clickable cards: border `#CBD5E1`, shadow трохи сильніший.
- Не вкладати картку в картку без потреби.

### Badge / StatusBadge

- Radius `999px`.
- Font size `12px`, weight `600`.
- Padding `4px 8px`.
- Використовувати приглушений фон і темніший текст.
- Не робити статуси неоновими або занадто яскравими.

### Table

- Header background `#F8FAFC`.
- Header text `#475569`, uppercase тільки для дуже компактних CRM-таблиць.
- Row border `border`.
- Row hover `#F8FAFC`.
- Cell padding `12px 14px`.
- Sticky table header дозволений для CRM.
- Mobile: або horizontal scroll, або card rows для клієнтського кабінету.

### Sidebar

- Background `dark-sidebar`.
- Text `sidebar-text`.
- Muted text `sidebar-muted`.
- Active item background `sidebar-active`, left border або icon color `accent`.
- Item radius `8px`, height `40px`.
- Hover background `rgba(255, 255, 255, 0.06)`.
- Mobile: drawer з overlay або compact bottom nav для основних дій.

### Header

- Public header: dark navy, height `64px-72px`, логотип з акцентною іконкою.
- Dashboard header: світлий або прозорий над content area, height `64px`.
- Sticky header доречний для CRM, якщо таблиці довгі.
- CTA завжди візуально сильніший за навігаційні кнопки.

### DashboardStatCard

- Card style.
- Велике число `24px-32px`, label `13px-14px`.
- Іконка в accent outline або м'якому жовтому фоні `#FFF4C2`.
- Для негативних/термінових значень використовувати warning/danger стримано.

### RequestStatusTimeline

- Vertical timeline на desktop side panel.
- Active step: accent circle + dark/foreground text.
- Completed step: success circle.
- Future step: border `#CBD5E1`, muted text.
- Mobile: vertical list full-width або horizontal stepper для коротких сценаріїв.

### EmptyState

- White card або unframed block.
- Іконка muted або accent outline.
- Заголовок `16px-18px`, короткий опис `muted`.
- Primary action, якщо є природна наступна дія.
- Не використовувати великі ілюстрації в CRM.

### LoadingState

- Skeleton blocks для карток, рядків таблиці та форм.
- Spinner тільки для коротких inline actions.
- Колір skeleton `#E5EAF0` на світлому фоні.

### ErrorState

- Border або background у м'якому danger тоні `#FEF3F2`.
- Text `danger`.
- Для recoverable errors додати secondary action `Спробувати ще раз`.
- Не блокувати всю сторінку, якщо помилка локальна для таблиці/картки.

## Статуси Заявки

| Статус | Badge background | Badge text | UI meaning |
| --- | --- | --- | --- |
| Нова заявка | `#EFF6FF` | `#1D4E89` | Заявка створена, ще не взята в роботу |
| В роботі | `#EAF2FA` | `#2563A6` | Менеджер або система обробляє запит |
| Формується пропозиція | `#FFF7D6` | `#8A6100` | Йде підбір позицій і цін |
| Очікує погодження | `#FEF3C7` | `#92400E` | Потрібна дія клієнта |
| Замовлено | `#EDE9FE` | `#5B3DB2` | Позиції погоджені та замовлені |
| В дорозі | `#E0F2FE` | `#0369A1` | Логістика або доставка активна |
| Завершено | `#E7F6EC` | `#2E7D4F` | Заявка виконана |
| Скасовано | `#FEE4E2` | `#B42318` | Заявка закрита без виконання |

## Responsive Rules

- Desktop CRM: sidebar + content table layout.
- Tablet: sidebar може стискатися до icon rail, фільтри переносяться у два рядки.
- Mobile public site: CTA-кнопки full-width, hero compact, cards в одну колонку.
- Mobile dashboard: sidebar drawer, таблиці через horizontal scroll або card list.
- Мінімальний tap target: `40px`.
- Не використовувати hover як єдиний спосіб доступу до дії.
- Форми заявок на mobile мають іти кроками, не довгим полотном без групування.

## Що Не Потрібно Робити

- Не копіювати референс 1-в-1: адаптувати стиль під реальну платформу заявок.
- Не робити інтерфейс схожим на retail ecommerce з товарними сітками як головною сутністю.
- Не використовувати надто яскраві, неонові або ігрові статуси.
- Не перевантажувати dashboard декоративними градієнтами, великими hero-блоками та маркетинговими картками.
- Не домінувати одним жовтим кольором: accent має виділяти дії, а не фарбувати весь UI.
- Не робити темний фон у всій CRM: темними мають бути header/sidebar, content area залишається світлою.
- Не приховувати статус заявки: він має бути помітним у списках, деталях, timeline і повідомленнях.
- Не змішувати різні radius/shadow стилі без системи.
