import Image from 'next/image';
import Link from 'next/link';

import { catalogCategories } from '@/lib/catalog/catalog-data';

const processSteps = [
  {
    title: 'Залишив запит',
    text: 'Клієнт описує потребу, додає фото, список або дані техніки.'
  },
  {
    title: 'Менеджер підібрав',
    text: 'Команда аналізує запит, перевіряє сумісність і підбирає запчастини або аналоги.'
  },
  {
    title: 'Отримав усе однією посилкою',
    text: 'Kairos Parts консолідує постачання й супроводжує заявку до отримання.'
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
  { title: 'Telegram', text: 'Швидкий старт заявки у месенджері.', href: '#telegram' },
  { title: 'Завантаження фото', text: 'Фото шильдика, вузла або пошкодженої деталі.', href: '/request' },
  { title: 'Excel / PDF / DOC', text: 'Списки позицій для планових закупівель.', href: '/request' },
  { title: 'Через менеджера', text: 'Для складних або термінових заявок.', href: '/contacts' }
];

const heroProcessSteps = ['Заявка', 'Підбір', 'Узгодження', 'Доставка'];

const heroStats = [
  { value: '10 000+', label: 'позицій під замовлення' },
  { value: '200+', label: 'перевірених постачальників' },
  { value: '1 менеджер', label: 'супроводжує заявку' }
];

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
        <div className="absolute bottom-24 left-8 hidden h-44 w-44 rounded-full bg-accent/20 blur-3xl lg:block" />
        <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl content-center gap-12 px-4 pb-24 pt-16 sm:px-6 lg:min-h-[760px] lg:px-8 lg:pb-28 lg:pt-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent sm:text-sm">Kairos Parts для B2B техніки</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl xl:text-7xl">
              Підберемо запчастини для вашої техніки за одним запитом
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/85">
              Для аграрної, вантажної, комерційної та спеціальної техніки.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Надішліть заявку, список або фото — команда Kairos Parts підбере рішення через єдину точку контакту.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/request" className="rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover">
                Створити заявку
              </Link>
              <Link href="/request?mode=file" className="rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:border-accent/70 hover:bg-white/10">
                Надіслати список або фото
              </Link>
            </div>
            <Link href="#telegram" className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-primary/35 px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent/70 hover:bg-accent/10">
              Створити заявку через Telegram
              <span aria-hidden="true">→</span>
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              {heroProcessSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{step}</span>
                  {index < heroProcessSteps.length - 1 ? <span className="text-accent/80">→</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
            {heroStats.map((stat) => (
              <div key={stat.value} className="rounded-xl border border-white/10 bg-secondary/75 p-5 shadow-panel backdrop-blur-md">
                <div className="mb-4 h-0.5 w-12 rounded-full bg-accent" />
                <p className="text-2xl font-bold leading-none text-accent sm:text-3xl">{stat.value}</p>
                <p className="mt-3 text-sm leading-5 text-technical-white/80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-accent">Як це працює</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Три кроки замість десятків дзвінків постачальникам</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {processSteps.map((step, index) => (
              <div key={step.title} className="relative rounded-lg border border-border bg-card p-6 shadow-card">
                <div className="flex size-11 items-center justify-center rounded-md bg-primary text-sm font-bold text-accent">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-bold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.text}</p>
                <div className="mt-6 h-1 rounded-full bg-border">
                  <div className="h-1 rounded-full bg-accent" style={{ width: `${(index + 1) * 33}%` }} />
                </div>
              </div>
            ))}
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
                На Day 4 це презентаційний блок. Реальна форма, Telegram bot flow та завантаження файлів будуть
                реалізовані наступними етапами.
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
