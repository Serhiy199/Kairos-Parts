import Image from 'next/image';
import Link from 'next/link';

import { ActionIcon } from '@/components/ui/action-icons';
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
  {
    title: 'Консолідована видача замовлень',
    text: 'Запчастини від різних постачальників прибувають до офісу Kairos Parts у Кагарлику, де ви отримуєте все в одному місці.',
    icon: 'package'
  },
  {
    title: 'Професійний підбір запчастин',
    text: 'Працюємо, щоб максимально знизити ризик помилок при підборі.',
    icon: 'search'
  },
  {
    title: 'Один договір — один партнер',
    text: 'Менше документів, простіший облік і комфортніша взаємодія.',
    icon: 'handshake'
  },
  {
    title: 'Зручні умови для бізнесу',
    bullets: ['Працюємо з ПДВ.', 'Відтермінування оплати для постійних клієнтів.', 'Різні форми розрахунку.'],
    icon: 'clipboard'
  },
  {
    title: 'Майданчик перевіреної б/в техніки',
    text: 'Допомагаємо купувати та продавати техніку через мережу перевірених партнерів.',
    icon: 'tractor'
  },
  {
    title: 'Реалізація неліквідних запчастин',
    text: 'Допомагаємо реалізувати складські залишки та повернути кошти в обіг.',
    icon: 'refresh'
  }
];

const audiences = [
  { title: 'Фермерські господарства', icon: 'farm' },
  { title: 'Агрохолдинги', icon: 'field' },
  { title: 'Транспортні компанії', icon: 'truck' },
  { title: 'Перевізники', icon: 'driver' },
  { title: 'Сервісні центри', icon: 'service' },
  { title: 'Підприємства з власним парком техніки', icon: 'fleet' }
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

function BenefitIcon({ icon }: { icon: string }) {
  if (icon === 'package') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17h18" />
        <path d="M5 17V9h6v8" />
        <path d="M13 17V7h6v10" />
        <path d="M5 9 8 6l3 3" />
        <path d="M13 7 16 4l3 3" />
        <path d="M8 6v11" />
        <path d="M16 4v13" />
        <path d="M4 20h16" />
      </svg>
    );
  }

  if (icon === 'search') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9.5" cy="10" r="5.2" />
        <path d="m13.4 13.8 5.1 5.1" />
        <path d="M7.2 10h4.6" />
        <path d="M9.5 7.7v4.6" />
        <circle cx="17" cy="6.8" r="2.6" />
        <path d="M17 4.2v1" />
        <path d="M17 8.4v1" />
        <path d="M14.4 6.8h1" />
        <path d="M18.6 6.8h1" />
      </svg>
    );
  }

  if (icon === 'handshake') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 10 4-4 4 4" />
        <path d="m21 10-4-4-4 4" />
        <path d="M7 10h2.5l2-2a2.7 2.7 0 0 1 3.8 0L17 9.7" />
        <path d="m8 13 4.2 4.2a3 3 0 0 0 4.2 0l1.5-1.5a2.5 2.5 0 0 0 0-3.5L16 10.4" />
        <path d="M10 15.2 12.2 13" />
        <path d="M12.7 17.1 15 14.8" />
        <path d="M5 8.5 8.5 12" />
        <path d="M19 8.5 15.5 12" />
      </svg>
    );
  }

  if (icon === 'file') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 14h7" />
        <path d="m9 10 1.5 1.5L14 8" />
      </svg>
    );
  }

  if (icon === 'clipboard') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 4h8l1 2h3v15H4V6h3z" />
        <path d="M9 4h6" />
        <path d="m8 12 2 2 5-5" />
        <path d="M8 17h8" />
        <path d="M8 20h5" />
      </svg>
    );
  }

  if (icon === 'calendar') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4h14v17H5z" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M5 9h14" />
        <path d="m8 15 2 2 5-5" />
      </svg>
    );
  }

  if (icon === 'tractor') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 13V7h6l3 6" />
        <path d="M4 13h12.5" />
        <path d="M12 7h4.5l2 3" />
        <path d="M16 13h3" />
        <circle cx="7" cy="17" r="4" />
        <circle cx="18.5" cy="18" r="2.5" />
        <path d="M7 15.2v3.6" />
        <path d="M5.2 17h3.6" />
      </svg>
    );
  }

  if (icon === 'refresh') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M18.5 12a6.6 6.6 0 0 0-11-4.9L4 10.4" />
        <path d="M5.5 12a6.6 6.6 0 0 0 11 4.9L20 13.6" />
        <path d="m9 10 3-1.6 3 1.6-3 1.6z" />
        <path d="M9 10v3.7l3 1.7 3-1.7V10" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="8" r="4" />
      <path d="M21 21v-2a3 3 0 0 0-3-3" />
      <path d="M3 21v-2a3 3 0 0 1 3-3" />
    </svg>
  );
}

function AudienceIcon({ icon }: { icon: string }) {
  const baseProps = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (icon === 'farm') {
    return (
      <svg {...baseProps}>
        <path d="M4 19h16" />
        <path d="M6 19V9l6-4 6 4v10" />
        <path d="M9 19v-6h6v6" />
        <path d="M7 11h10" />
      </svg>
    );
  }

  if (icon === 'field') {
    return (
      <svg {...baseProps}>
        <path d="M3 18c4-4 14-4 18 0" />
        <path d="M5 14c3-3 11-3 14 0" />
        <path d="M8 10c2-2 6-2 8 0" />
        <path d="M12 4v4" />
        <path d="M9.5 6h5" />
      </svg>
    );
  }

  if (icon === 'truck') {
    return (
      <svg {...baseProps}>
        <path d="M3 7h10v9H3z" />
        <path d="M13 10h4l4 4v2h-8z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    );
  }

  if (icon === 'driver') {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21a7 7 0 0 1 14 0" />
        <path d="M8 14h8" />
        <path d="M12 10v4" />
      </svg>
    );
  }

  if (icon === 'service') {
    return (
      <svg {...baseProps}>
        <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5" />
        <path d="m15 5 4 4" />
        <path d="m16 4 4 4" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <path d="M4 17h16" />
      <path d="M6 17V9h5v8" />
      <path d="M13 17V6h5v11" />
      <circle cx="8.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
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
              <Link href="/request" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover">
                <ActionIcon name="plus" />
                Створити заявку
              </Link>
              <Link href={telegramBotUrl} className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-primary/35 px-6 py-3.5 text-center text-sm font-semibold text-accent transition hover:border-accent/80 hover:bg-accent/10">
                <ActionIcon name="telegram" />
                Надіслати заявку в Telegram
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
        </div>
      </section>

      <section id="benefits" className="relative w-full overflow-hidden bg-[#050505] py-9 text-white sm:py-10">
        <div className="benefits-section-bg pointer-events-none absolute inset-0 opacity-70 saturate-[0.82]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.34)_0%,rgba(5,5,5,0.76)_58%,rgba(5,5,5,0.92)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.34)_0%,rgba(5,5,5,0)_32%,rgba(5,5,5,0.18)_78%,rgba(5,5,5,0.42)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_36%,rgba(200,150,66,0.1),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(232,232,232,0.75)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.75)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-[980px]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Переваги</p>
            <h2 className="mt-2 text-[28px] font-bold leading-[1.08] text-white sm:text-[34px] lg:text-[38px] xl:whitespace-nowrap">
              Що ви отримуєте, працюючи з <span className="text-accent">KAIROS PARTS</span>
            </h2>
            <p className="mt-2 text-sm font-semibold text-technical-white sm:text-base">B2B-процес, який зменшує хаос у закупівлях</p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {advantages.map((advantage, index) => (
              <article key={advantage.title} className="benefit-card">
                <div className="benefit-card__diagonal" />
                <div className="benefit-card__icon-wrap">
                  <BenefitIcon icon={advantage.icon} />
                </div>
                <div className="benefit-card__content">
                  <div className="benefit-card__header">
                    <span className="benefit-card__number">{index + 1}</span>
                    <h3 className="benefit-card__title">{advantage.title}</h3>
                  </div>
                  {advantage.bullets ? (
                    <ul className="benefit-card__list">
                      {advantage.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="benefit-card__description">{advantage.text}</p>
                  )}
                  <div className="benefit-card__divider" />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/18 bg-black/15 px-0 pt-4 backdrop-blur-[2px] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-bold text-white">Готові передати заявку на підбір?</p>
              <p className="mt-1 text-sm leading-6 text-technical-white/70">Опишіть потребу на сайті або почніть швидкий діалог у Telegram.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover"
              >
                <ActionIcon name="plus" />
                Створити заявку
              </Link>
              <Link
                href={telegramBotUrl}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-accent/45 bg-black/25 px-5 py-3 text-center text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
              >
                <ActionIcon name="telegram" />
                Надіслати заявку в Telegram
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#080808] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(200,150,66,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(232,232,232,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.8)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-[640px]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Для кого</p>
            <h2 className="mt-2 text-[24px] font-bold leading-[1.14] text-white sm:text-[30px] lg:text-[34px]">Для компаній, де техніка має працювати, а не чекати</h2>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map((audience) => (
              <div key={audience.title} className="audience-card">
                <span className="audience-card__label">{audience.title}</span>
                <span className="audience-card__icon">
                  <AudienceIcon icon={audience.icon} />
                </span>
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
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover"
              >
                <ActionIcon name="search" />
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

