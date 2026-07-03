import Image from 'next/image';
import Link from 'next/link';

import { catalogCategories } from '@/lib/catalog/catalog-data';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const processSteps = [
  {
    title: 'Залишив заявку',
    text: 'Опишіть потребу, додайте фото, список, артикул або дані техніки.',
    icon: 'file'
  },
  {
    title: 'Менеджер підібрав',
    text: 'Перевіряємо сумісність, наявність, аналоги та можливі варіанти постачання.',
    icon: 'search'
  },
  {
    title: 'Узгодили рішення',
    text: 'Погоджуємо позиції, строки, ціну та формат поставки перед замовленням.',
    icon: 'check'
  },
  {
    title: 'Отримали запчастини',
    text: 'Kairos Parts супроводжує заявку до доставки або передачі клієнту.',
    icon: 'truck'
  }
];

const advantages = [
  'Одне місце відвантаження',
  'Запчастини з різних постачальників в одному процесі',
  'Один договір і один контрагент',
  'Спрощення бухгалтерії, обліку та аналітики',
  'Відтермінування оплати до 7 днів для постійних клієнтів',
  'Можливість термінової доставки в господарство',
  'Контроль ТО техніки',
  'Професійний підбір і перевірка сумісності',
  'Менший ризик неправильного замовлення',
  'Гарантія та повернення відповідно до чинного законодавства'
];

const audiences = [
  'Фермерські господарства',
  'Агрохолдинги',
  'Транспортні компанії',
  'Перевізники',
  'Сервісні центри',
  'Підприємства з власним парком техніки'
];

const channels = [
  { title: 'Форма на сайті', text: 'Структурований запит для менеджера.', href: '/request' },
  { title: 'Telegram', text: 'Швидкий старт заявки у месенджері.', href: telegramBotUrl },
  { title: 'Завантаження фото', text: 'Фото шильдика, вузла або пошкодженої деталі.', href: '/request' },
  { title: 'Excel / PDF / DOC', text: 'Списки позицій для планових закупівель.', href: '/request' },
  { title: 'Через менеджера', text: 'Для складних або термінових заявок.', href: '/contacts' }
];

const heroProcessSteps = ['Заявка', 'Підбір', 'Узгодження', 'Доставка'];

const trustStats = [
  {
    value: '10 000+',
    label: 'позицій під замовлення'
  },
  {
    value: '200+',
    label: 'перевірених постачальників'
  },
  {
    value: '1 менеджер',
    label: 'супроводжує заявку'
  },
  {
    value: '4 етапи',
    label: 'від заявки до доставки'
  }
];

function ProcessIcon({ icon }: { icon: string }) {
  if (icon === 'search') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  if (icon === 'check') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  if (icon === 'truck') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5" />
      <path d="M10 16h7" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <Image
          src="/images/kairos-hero-industrial.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.92)_0%,rgba(5,5,5,0.76)_42%,rgba(5,5,5,0.34)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.34)_0%,rgba(5,5,5,0)_32%,rgba(245,246,247,0)_78%,#F5F6F7_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl content-center px-4 pb-20 pt-16 sm:px-6 lg:min-h-[680px] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent sm:text-sm">KAIROS PARTS ДЛЯ B2B ТЕХНІКИ</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl xl:text-7xl">
              Підберемо запчастини для вашої техніки за одним запитом
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/85">
              Для аграрної, вантажної та спеціальної техніки.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Надішліть заявку, список або фото — команда Kairos Parts підбере сумісні запчастини та запропонує рішення.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/request" className="rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover">
                Створити заявку
              </Link>
              <Link href={telegramBotUrl} className="rounded-lg border border-accent/40 bg-primary/35 px-6 py-3.5 text-center text-sm font-semibold text-accent transition hover:border-accent/80 hover:bg-accent/10">
                Надіслати заявку в Telegram →
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              {heroProcessSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{step}</span>
                  {index < heroProcessSteps.length - 1 ? <span className="text-accent/80">→</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(76,79,84,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(76,79,84,0.65)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div>
              <div className="mb-4 h-0.5 w-14 rounded-full bg-accent" />
              <h2 className="max-w-2xl text-2xl font-bold text-foreground sm:text-3xl">
                Асортимент, постачальники й супровід — в одному процесі
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
              Kairos Parts допомагає швидко знаходити запчастини для аграрної, вантажної та спеціальної техніки через одну заявку.
            </p>
          </div>
          <div className="mt-7 overflow-hidden rounded-xl border border-[rgba(125,128,133,0.25)] bg-card shadow-card">
            <div className="h-1 bg-gradient-to-r from-accent via-[#B37A2E] to-transparent" />
            <div className="grid grid-cols-2 divide-x divide-y divide-border/80 lg:grid-cols-4 lg:divide-y-0">
            {trustStats.map((stat) => (
              <div key={stat.value} className="min-h-32 p-5 sm:p-6">
                <p className="text-3xl font-bold leading-none text-accent sm:text-4xl">{stat.value}</p>
                <p className="mt-3 max-w-44 text-sm font-bold leading-5 text-foreground">{stat.label}</p>
              </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#F7F7F5] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Як це працює</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Заявка, підбір, узгодження та доставка в одному процесі</h2>
            <p className="mt-4 text-sm leading-6 text-muted sm:text-base sm:leading-7">
              Менеджер веде заявку поетапно: від первинного опису потреби до погодження рішення та супроводу постачання.
            </p>
          </div>
          <div className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-8 right-8 top-6 hidden h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent lg:block" />
            {processSteps.map((step, index) => (
              <div key={step.title} className="relative rounded-lg border border-border bg-card p-6 shadow-card transition hover:border-accent/45 hover:shadow-panel">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-12 items-center justify-center rounded-md border border-accent/25 bg-primary text-accent shadow-card">
                    <ProcessIcon icon={step.icon} />
                  </div>
                  <span className="font-display text-sm font-bold tracking-[0.16em] text-accent/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.text}</p>
                <div className="mt-6 h-1 w-14 rounded-full bg-accent" />
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xl font-bold text-foreground">Готові передати заявку на підбір?</p>
            <Link
              href="/request"
              className="inline-flex justify-center rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-primary shadow-card transition hover:bg-accent-hover"
            >
              Створити заявку
            </Link>
          </div>
        </div>
      </section>

      <section id="advantages" className="bg-card px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase text-accent">Переваги</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground">B2B-процес, який зменшує хаос у закупівлях</h2>
              <p className="mt-4 text-sm leading-6 text-muted">
                Платформа створена для команд, яким важливо швидко отримати правильні деталі, мати єдиного
                відповідального менеджера та зрозумілий статус кожної заявки.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {advantages.map((advantage) => (
                <div key={advantage} className="rounded-lg border border-border bg-surface-muted p-4">
                  <p className="text-sm font-semibold text-foreground">{advantage}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-accent">Для кого</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Для компаній, де техніка має працювати, а не чекати</h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map((audience) => (
              <div key={audience} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <p className="text-sm font-bold text-foreground">{audience}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase text-accent">Напрями підбору</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground">Категорії допомагають швидше описати потребу</h2>
              <p className="mt-4 text-sm leading-6 text-muted">
                Це не товарний каталог. Оберіть напрям, а менеджер уточнить деталі й підбере рішення.
              </p>
              <Link
                href="/categories"
                className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover"
              >
                Переглянути всі категорії
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {catalogCategories.slice(0, 4).map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="rounded-lg border border-border bg-surface-muted p-5 transition hover:border-accent hover:bg-card"
                >
                  <p className="text-sm font-bold text-foreground">{category.name}</p>
                  <p className="mt-2 text-xs leading-5 text-muted">{category.subcategories.slice(0, 3).join(', ')}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="telegram" className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase text-accent">Способи створення заявки</p>
              <h2 className="mt-2 text-3xl font-bold">Оберіть зручний канал, менеджер підхопить процес</h2>
              <p className="mt-4 text-sm leading-6 text-sidebar-text">
                Telegram-бот приймає заявку, підтверджує номер телефону, збирає опис потреби та передає заявку менеджеру.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {channels.map((channel) => (
                <Link
                  key={channel.title}
                  href={channel.href}
                  className="rounded-lg border border-white/10 bg-white/95 p-5 text-foreground shadow-panel transition hover:-translate-y-0.5 hover:border-accent"
                >
                  <p className="text-sm font-bold">{channel.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{channel.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
