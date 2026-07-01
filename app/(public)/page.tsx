import Image from 'next/image';
import Link from 'next/link';

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

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <Image
          src="/images/kairos-hero-industrial.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,31,0.98)_0%,rgba(7,17,31,0.88)_44%,rgba(7,17,31,0.55)_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl content-center gap-10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Kairos Parts для B2B техніки</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Підберемо та доставимо необхідні запчастини за одним запитом
            </h1>
            <p className="mt-5 text-lg font-semibold text-white">Для аграрної, вантажної, комерційної та спеціальної техніки</p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sidebar-text">
              Kairos Parts допомагає клієнтам не витрачати час на десятки постачальників, а залишити один
              запит і отримати підібране рішення через єдину точку контакту.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:flex">
              <Link href="/request" className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-[#DFA600]">
                Створити заявку
              </Link>
              <Link href="/request" className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10">
                Надіслати список
              </Link>
              <Link href="/request" className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10">
                Завантажити фото
              </Link>
              <Link href="#telegram" className="rounded-md border border-accent/60 px-5 py-3 text-center text-sm font-semibold text-accent transition hover:bg-accent/10">
                Створити заявку в Telegram
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['10 000+ позицій під замовлення', '200+ постачальників', 'Один менеджер на заявку'].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/95 p-4 text-foreground shadow-panel">
                <p className="text-sm font-bold">{item}</p>
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
