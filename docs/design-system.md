# Kairos Parts MVP Design System

## Загальний стиль

Kairos Parts має виглядати як сучасна B2B-платформа для заявок на запчастини, а не як класичний інтернет-магазин. Візуальна основа: premium industrial brand + clean B2B SaaS interface. Брендові зони використовують Deep Black / Carbon Black, Premium Gold і технічні silver/grey акценти, але основний інтерфейс залишається світлим: off-white фон, білі картки, читабельний темний текст, чисті таблиці та стримані статуси.

Інтерфейс повинен бути зрозумілим для аграрного, вантажного та спеціального B2B-сегменту: менше декоративності, більше ясної структури, швидкого сканування, видимих статусів і практичних дій. Не переносити пропорцію логотипа на весь продукт: 70% black / 20% gold / 7% silver / 3% rich gold є бренд-moodboard для логотипа й преміальних блоків, а не схема заливки всіх сторінок.

## Палітра

### Основні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `primary` | `#050505` | Header, footer, sidebar, hero overlay, premium brand blocks |
| `secondary` | `#101010` | Carbon Black panels, secondary dark surfaces |
| `accent` | `#C89642` | CTA, іконки, важливі маркери, активні кроки |
| `accent-hover` | `#B37A2E` | Hover states, secondary gold accents, thin dividers |
| `bronze` | `#8A5B24` | Стримані warning/gold-brown accents |
| `silver` | `#7D8085` | Іконки другого рівня, технічні підписи |
| `gunmetal` | `#4C4F54` | Muted text, secondary UI copy |
| `background` | `#F5F6F7` | Основний світлий фон сторінок і кабінетів |
| `foreground` | `#101010` | Основний текст |
| `muted` | `#4C4F54` | Другорядний текст, підписи, допоміжні дані |
| `border` | `#D9DEE3` | Межі карток, таблиць, inputs |
| `card` | `#FFFFFF` | Картки, форми, таблиці |

### Семантичні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `success` | `#2E7D4F` | Завершені дії, успішні статуси |
| `warning` | `#8A5B24` | Очікування, погодження, попередження |
| `danger` | `#B42318` | Помилки, скасування, критичні дії |
| `info` | `#2563A6` | Інформаційні статуси, поточна обробка |

### UI-специфічні кольори

| Token | Hex | Використання |
| --- | --- | --- |
| `dark-sidebar` | `#050505` | Sidebar CRM/client dashboard |
| `button-primary` | `#C89642` | Основні CTA-кнопки |
| `button-secondary` | `#101010` | Темні другорядні кнопки |
| `input-background` | `#FFFFFF` | Inputs, selects, textareas |
| `surface-muted` | `#F8FAFC` | М'які панелі всередині карток |
| `sidebar-active` | `#1A1A1A` | Активний пункт меню |
| `sidebar-text` | `#E8E8E8` | Текст у sidebar |
| `sidebar-muted` | `#7D8085` | Другорядний текст у sidebar |
| `technical-white` | `#E8E8E8` | Світлий технічний текст на темному фоні |

### Brand moodboard colors

| Brand color | Hex | Product usage |
| --- | --- | --- |
| Premium Gold | `#C89642` | Основний акцент для CTA та активних станів |
| Rich Gold | `#B37A2E` | Hover, secondary accent, thin decorative lines |
| Dark Bronze | `#8A5B24` | Warning/gold-brown accents, premium details |
| Titanium Silver | `#7D8085` | Secondary icons, technical captions |
| Gunmetal Grey | `#4C4F54` | Muted text and utilitarian UI |
| Deep Black | `#050505` | Header, footer, sidebar, hero overlays |
| Carbon Black | `#101010` | Secondary dark panels |
| Technical White | `#E8E8E8` | Text/icons on dark brand surfaces |

## CSS Variables

```css
:root {
  --color-primary: #050505;
  --color-secondary: #101010;
  --color-accent: #c89642;
  --color-accent-hover: #b37a2e;
  --color-bronze: #8a5b24;
  --color-silver: #7d8085;
  --color-gunmetal: #4c4f54;
  --color-background: #f5f6f7;
  --color-foreground: #101010;
  --color-muted: #4c4f54;
  --color-border: #d9dee3;
  --color-card: #ffffff;

  --color-success: #2e7d4f;
  --color-warning: #8a5b24;
  --color-danger: #b42318;
  --color-info: #2563a6;

  --color-dark-sidebar: #050505;
  --color-button-primary: #c89642;
  --color-button-secondary: #101010;

  --color-input-background: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-sidebar-active: #1a1a1a;
  --color-sidebar-text: #e8e8e8;
  --color-sidebar-muted: #7d8085;
  --color-technical-white: #e8e8e8;

  --font-ui: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-brand: Oxanium, "Exo 2", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: "Exo 2", Inter, ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06);
  --shadow-panel: 0 12px 32px rgba(5, 5, 5, 0.14);
}
```

## Tailwind Theme Tokens

```js
theme: {
  extend: {
    colors: {
      primary: '#050505',
      secondary: '#101010',
      accent: '#C89642',
      'accent-hover': '#B37A2E',
      bronze: '#8A5B24',
      silver: '#7D8085',
      gunmetal: '#4C4F54',
      background: '#F5F6F7',
      foreground: '#101010',
      muted: '#4C4F54',
      border: '#D9DEE3',
      card: '#FFFFFF',
      success: '#2E7D4F',
      warning: '#8A5B24',
      danger: '#B42318',
      info: '#2563A6',
      'dark-sidebar': '#050505',
      'button-primary': '#C89642',
      'button-secondary': '#101010',
      'surface-muted': '#F8FAFC',
      'sidebar-active': '#1A1A1A',
      'sidebar-text': '#E8E8E8',
      'sidebar-muted': '#7D8085',
      'technical-white': '#E8E8E8'
    },
    borderRadius: {
      sm: '6px',
      md: '8px',
      lg: '10px'
    },
    boxShadow: {
      card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
      panel: '0 12px 32px rgba(5, 5, 5, 0.14)'
    },
    fontFamily: {
      ui: ['var(--font-ui)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      display: ['var(--font-display)', 'var(--font-ui)', 'ui-sans-serif', 'system-ui'],
      brand: ['var(--font-brand)', 'var(--font-display)', 'var(--font-ui)', 'ui-sans-serif', 'system-ui']
    }
  }
}
```

## Typography

- Логотип Kairos Parts використовується як image asset (`/public/images/kairos-logo.png`). Точна назва шрифту в логотипі невідома, font-файл від замовника не наданий, тому логотип не відтворюється текстом.
- Bank Gothic використовується тільки як візуальний референс для технічного industrial/premium настрою. Bank Gothic не підключається без підтвердженої web/commercial ліцензії.
- Для інтерфейсу використовуються open-source Google Fonts через `next/font/google`; платні або невідомі font-файли без ліцензії не додаються в репозиторій.
- Fallback-порядок для Bank Gothic-style brand font: `Science Gothic`, `Oxanium`, `Orbitron`, `Rajdhani`.
- `Science Gothic` був перевірений як основний варіант, але поточний `next/font/google` у проєкті повертає build error `Unknown font "Science Gothic"`, тому фактичний brand font для тесту: `Oxanium`.
- `Oxanium` доступний через `next/font/google`, але не має `cyrillic` subset (`latin`, `latin-ext` only). Через це українські hero/promo headings не рендеряться Oxanium напряму, щоб уникнути неконтрольованого fallback-змішування.
- UI font: `Inter` для основного тексту, форм, CRM, таблиць, кабінетів і всіх щільних робочих екранів.
- Brand font: `Oxanium` для латинських брендових елементів, коротких technical labels і елементів із безпечним glyph coverage.
- Display font: `Exo 2` для українських hero, promo і section headings, включно з тестовим заголовком `ПІДБЕРЕМО ТА ДОСТАВИМО НЕОБХІДНІ ЗАПЧАСТИНИ ЗА ОДНИМ ЗАПИТОМ`.
- Основний текст: `14px` або `15px`, line-height `1.45-1.6`.
- Dashboard/table text: `13px-14px` для щільного, але читабельного CRM-інтерфейсу.
- Public hero/page title: `32px-48px` на desktop, weight `700-800`, `font-display`, без надмірного letter-spacing.
- Dashboard/CRM page title: `24px-32px`, weight `700`, `font-ui`.
- Section title/card title: `16px-20px`, weight `600-700`.
- Labels: `12px-13px`, weight `500-600`, колір `foreground` або `muted`.
- Не використовувати надмірно великі marketing-style заголовки у кабінетах і CRM.
- Не використовувати декоративні display-шрифти у таблицях, формах, довгих описах, статусах і службових повідомленнях.
- Не застосовувати Bank Gothic-style font до форм, input/select/textarea, таблиць, CRM rows, дрібного UI-тексту, помилок і документів.

## Layout Principles

### Public Layout

- Темний top header з логотипом, навігацією та CTA `Створити заявку`.
- Hero може використовувати індустріальне фото техніки з темним overlay.
- CTA-кнопки Premium Gold, hover Rich Gold; другорядні кнопки темні або outline.
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
- Primary: background `accent`, text `#101010`, hover `accent-hover`, active `bronze`.
- Secondary: background `button-secondary`, text white, hover `#1A1A1A`.
- Outline: white/transparent background, border `border`, hover `surface-muted`.
- Disabled: opacity `0.55`, cursor `not-allowed`, без shadow.
- Focus: `2px` ring `rgba(200, 150, 66, 0.35)`.
- Mobile: full-width у формах і wizard-кроках, але icon actions залишаються компактними.

### Input

- Height: `40px-44px`.
- Radius: `8px`.
- Border: `1px solid border`.
- Background: `input-background`.
- Focus: border `accent`, ring `rgba(200, 150, 66, 0.25)`.
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
- Hover: border `accent`, subtle background `#F7F1E8`.
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
- Іконка в accent outline або м'якому premium-gold фоні `#F3E8D3`.
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
- Не домінувати gold-акцентом: Premium Gold має виділяти дії, а не фарбувати весь UI.
- Не робити темний фон у всій CRM: темними мають бути header/sidebar/premium blocks, content area залишається світлою.
- Не переносити 70% black / 20% gold пропорцію логотипа на всі екрани продукту.
- Не робити чорні форми, таблиці або кабінети за замовчуванням.
- Не використовувати металеві ефекти на кожній кнопці чи картці.
- Не приховувати статус заявки: він має бути помітним у списках, деталях, timeline і повідомленнях.
- Не змішувати різні radius/shadow стилі без системи.
