import Image from 'next/image';
import Link from 'next/link';
import { FaClipboardList, FaTractor } from 'react-icons/fa';
import { FaHandshakeAngle } from 'react-icons/fa6';
import { GoGear } from 'react-icons/go';
import { LuBoxes, LuSearchCheck } from 'react-icons/lu';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const heroFleetHighlights = [
  {
    title: 'Повторне замовлення за секунди',
    text: 'Платформа памʼятає, що вже купували для кожної машини.',
    icon: 'clock'
  },
  {
    title: 'Уся історія в одному місці',
    text: 'Заявки, запчастини, каталожні номери й документи зберігаються разом.',
    icon: 'database'
  },
  {
    title: 'Контроль витрат та аналітика',
    text: 'Легше бачити, що і для якої техніки замовлялось.',
    icon: 'chart'
  },
  {
    title: 'Надійні постачальники і гарантія',
    text: 'Менеджер працює з перевіреними партнерами та фіксує рішення.',
    icon: 'shield'
  }
];

const processSteps = [
  {
    title: 'Створіть заявку',
    text: 'Оберіть техніку зі свого парку або оформіть разову заявку. Додайте артикул, список, фото чи опис потреби.',
    icon: 'file'
  },
  {
    title: 'Менеджер опрацьовує запит',
    text: 'Уточнюємо деталі, перевіряємо сумісність і аналізуємо доступні варіанти.',
    icon: 'search'
  },
  {
    title: 'Підбираємо рішення',
    text: 'Знаходимо оригінальні запчастини та аналоги серед перевірених постачальників.',
    icon: 'check'
  },
  {
    title: 'Узгодження та оплата',
    text: 'Погоджуємо склад замовлення, терміни, доставку та формуємо рахунок.',
    icon: 'invoice'
  },
  {
    title: 'Історія оновлюється автоматично',
    text: 'Якщо заявка привʼязана до техніки з вашого парку, система зберігає запчастини, каталожні номери, рахунки та документи в історії цієї машини.',
    icon: 'database'
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
    title: 'Цифровий парк техніки для зареєстрованих користувачів',
    text: 'Кожне замовлення, оформлене через Kairos, автоматично привʼязується до конкретної машини. Платформа сама накопичує історію запчастин, рахунків та каталожних номерів без додаткового введення даних.',
    icon: 'fleet'
  }
];

const serviceCards = [
  {
    title: 'Повторне замовлення за секунди',
    text: 'Платформа памʼятає, що ви вже купували для кожної машини, тому повторне замовлення займає лише кілька кліків.',
    icon: 'clock'
  },
  {
    title: 'Уся історія по техніці',
    text: 'Заявки, підібрані позиції, документи й рахунки зберігаються в цифровій історії кожної одиниці техніки.',
    icon: 'database'
  },
  {
    title: 'Перевірені постачальники',
    text: 'Працюємо з надійними партнерами, щоб зменшити ризик помилок і зривів постачання.',
    icon: 'shield'
  },
  {
    title: 'Персональний супровід',
    text: 'Менеджер веде заявку від першого опису потреби до узгодження й передачі замовлення.',
    icon: 'clipboard'
  },
  {
    title: 'Рішення для техніки',
    text: 'Агро, вантажна та спеціальна техніка в одному сервісному процесі без товарного каталогу.',
    icon: 'gear'
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

function ProcessIcon({ icon }: { icon: string }) {
  if (icon === 'database') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        <path d="m14 15 1.5 1.5L19 13" />
      </svg>
    );
  }

  if (icon === 'invoice') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" />
        <path d="M10 8h4" />
        <path d="M10 12h5" />
        <path d="M10 16h3" />
      </svg>
    );
  }

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

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5" />
      <path d="M10 16h7" />
    </svg>
  );
}

function TrustIcon({ icon }: { icon: string }) {
  const baseProps = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    className: 'size-10 sm:size-12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (icon === 'clock') {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
        <path d="M4 12H2" />
        <path d="M22 12h-2" />
      </svg>
    );
  }

  if (icon === 'database') {
    return (
      <svg {...baseProps}>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    );
  }

  if (icon === 'chart') {
    return (
      <svg {...baseProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-4" />
        <path d="M12 16V8" />
        <path d="M16 16v-6" />
        <path d="m16 8 3-3" />
      </svg>
    );
  }

  if (icon === 'shield') {
    return (
      <svg {...baseProps}>
        <path d="M12 3 19 6v5c0 4.8-3 8.4-7 10-4-1.6-7-5.2-7-10V6z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  if (icon === 'clipboard') {
    return (
      <svg {...baseProps}>
        <path d="M8 4h8l1 2h3v15H4V6h3z" />
        <path d="M9 4h6" />
        <path d="m8 12 2 2 4-4" />
        <path d="M8 17h8" />
      </svg>
    );
  }

  return <GoGear aria-hidden="true" className="size-10 sm:size-12" />;
}

function BenefitIcon({ icon }: { icon: string }) {
  if (icon === 'package') {
    return <LuBoxes aria-hidden="true" className="size-12 sm:size-16" />;
  }

  if (icon === 'search') {
    return <LuSearchCheck aria-hidden="true" className="size-12 sm:size-16" />;
  }

  if (icon === 'handshake') {
    return <FaHandshakeAngle aria-hidden="true" className="size-12 sm:size-16" />;
  }

  if (icon === 'clipboard') {
    return <FaClipboardList aria-hidden="true" className="size-12 sm:size-16" />;
  }

  if (icon === 'tractor') {
    return <FaTractor aria-hidden="true" className="size-12 sm:size-16" />;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-12 sm:size-16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17h16" />
      <path d="M6 17V9h5v8" />
      <path d="M13 17V6h5v11" />
      <circle cx="8.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
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
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.9)_0%,rgba(5,5,5,0.7)_42%,rgba(5,5,5,0.2)_100%)]" />
        <div className="kp-container relative flex min-h-[calc(100vh-64px)] flex-col justify-center pb-12 pt-16 lg:min-h-[720px] lg:pb-14 lg:pt-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent sm:text-sm">Kairos Parts — сервіс для B2B-клієнтів аграрної та транспортної галузі.</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl xl:text-7xl">
              Підберемо запчастини для вашої техніки <span className="text-accent">за одним запитом</span>
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
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border border-white/15 bg-primary/70 shadow-panel backdrop-blur-md">
            <div className="grid divide-y divide-white/10 md:grid-cols-[1.35fr_repeat(4,1fr)] md:divide-x md:divide-y-0">
              <div className="flex gap-4 p-5 text-white sm:p-6">
                <div className="hidden size-16 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-technical-white sm:flex">
                  <TrustIcon icon="database" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-snug sm:text-xl">
                    Кожне замовлення автоматично поповнює цифрову історію вашої техніки.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    Більше не потрібно шукати, які запчастини вже купували, для якої машини та коли.
                  </p>
                </div>
              </div>
              {heroFleetHighlights.map((item) => (
                <div key={item.title} className="p-5 text-center sm:p-6">
                  <div className="mx-auto flex size-12 items-center justify-center text-accent">
                    <TrustIcon icon={item.icon} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-6 text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/55">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-public-section py-16">
        <div className="kp-container">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Як це працює</p>
            <h2 className="public-section-heading mt-2 text-3xl font-bold">Заявка, підбір, узгодження та доставка в одному процесі</h2>
            <p className="public-section-copy mt-4 text-sm leading-6 sm:text-base sm:leading-7">
              Менеджер веде заявку поетапно: від первинного опису потреби до погодження рішення та супроводу постачання.
            </p>
          </div>
          <div className="relative mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="pointer-events-none absolute left-8 right-8 top-6 hidden h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent xl:block" />
            {processSteps.map((step, index) => (
              <div key={step.title} className="public-card relative flex min-h-[300px] flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-12 items-center justify-center rounded-md border border-public-border-accent bg-public-page text-accent">
                    <ProcessIcon icon={step.icon} />
                  </div>
                  <span className="font-display text-sm font-bold tracking-[0.16em] text-accent/80">Крок {index + 1}</span>
                </div>
                <div className="flex flex-1 flex-col">
                  <h3 className="mt-5 text-xl font-bold text-public-primary">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-public-muted">{step.text}</p>
                </div>
                <div className="mt-6 grid grid-cols-5 gap-1.5" aria-hidden="true">
                  {processSteps.map((segment, segmentIndex) => (
                    <span
                      key={`${step.title}-${segment.title}`}
                      className={`h-1.5 rounded-full ${segmentIndex <= index ? 'bg-accent' : 'bg-public-elevated'}`}
                    />
                  ))}
                </div>
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
        <div className="kp-container relative z-10">
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
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-page py-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(152,157,166,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(152,157,166,0.45)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="kp-container relative">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Сервіс</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-public-primary sm:text-4xl">
              Все для ефективного обслуговування вашої техніки — в одній платформі
            </h2>
            <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-public-secondary sm:text-lg sm:leading-8">
              Kairos не лише знаходить запчастини серед перевірених постачальників, а й автоматично формує цифрову історію кожної одиниці вашої техніки.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-public-border bg-public-card">
            <div className="grid divide-y divide-public-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
              {serviceCards.map((stat) => (
                <div key={stat.title} className="min-h-72 px-8 py-10 transition-colors duration-200 hover:bg-public-elevated sm:px-10 lg:px-8 xl:px-10">
                  <div className="text-accent">
                    <TrustIcon icon={stat.icon} />
                  </div>
                  <h3 className="mt-9 max-w-52 text-xl font-bold leading-tight text-public-primary">{stat.title}</h3>
                  <p className="mt-5 max-w-56 text-base font-medium leading-7 text-public-muted">{stat.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#080808] py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(200,150,66,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(232,232,232,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.8)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="kp-container relative">
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

      <section id="telegram" className="bg-primary py-16 text-white">
        <div className="kp-container">
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
                  className="public-card public-interactive-card p-5 text-public-primary"
                >
                  <p className="text-sm font-bold">{channel.title}</p>
                  <p className="mt-2 text-sm leading-6 text-public-muted">{channel.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
