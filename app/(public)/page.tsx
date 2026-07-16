import Image from 'next/image';
import Link from 'next/link';
import { FaClipboardList, FaTractor } from 'react-icons/fa';
import { FaHandshakeAngle } from 'react-icons/fa6';
import { GoGear } from 'react-icons/go';
import { LuBoxes, LuSearchCheck } from 'react-icons/lu';
import {
  TbBrandTelegram,
  TbCamera,
  TbClipboardText,
  TbDeviceDesktopAnalytics,
  TbFileSpreadsheet,
  TbTools,
  TbTractor,
  TbTruck,
  TbTruckDelivery,
  TbUser,
  TbWheat
} from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const heroFleetHighlights = [
  {
    title: 'Повторне замовлення за секунди',
    icon: 'clock'
  },
  {
    title: 'Уся історія в одному місці',
    icon: 'database'
  },
  {
    title: 'Контроль витрат та аналітика',
    icon: 'chart'
  },
  {
    title: 'Надійні постачальники і гарантія',
    icon: 'shield'
  }
];

const processSteps = [
  {
    title: 'Створіть заявку',
    text: 'Оберіть техніку або створіть разову заявку. Додайте артикул, список, фото чи опис.',
    icon: 'file'
  },
  {
    title: 'Менеджер опрацьовує запит',
    text: 'Уточнюємо деталі, перевіряємо сумісність і доступні варіанти.',
    icon: 'search'
  },
  {
    title: 'Підбираємо рішення',
    text: 'Знаходимо оригінальні запчастини та перевірені аналоги.',
    icon: 'check'
  },
  {
    title: 'Узгодження та оплата',
    text: 'Погоджуємо склад, терміни й доставку та формуємо рахунок.',
    icon: 'invoice'
  },
  {
    title: 'Історія оновлюється автоматично',
    text: 'Запчастини, рахунки й документи зберігаються в історії вашої техніки.',
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
    text: 'Замовлення, запчастини, рахунки й каталожні номери автоматично зберігаються в історії конкретної машини.',
    icon: 'fleet'
  }
];

const serviceCards = [
  {
    title: 'Повторне замовлення за секунди',
    text: 'Платформа пам’ятає попередні покупки для кожної машини, тому повторне замовлення займає кілька кліків.',
    icon: 'clock'
  },
  {
    title: 'Уся історія техніки',
    text: 'Заявки, запчастини, документи й рахунки зберігаються в історії кожної машини.',
    icon: 'database'
  },
  {
    title: 'Перевірені постачальники',
    text: 'Працюємо з надійними партнерами, щоб зменшити ризик помилок і зривів постачання.',
    icon: 'shield'
  },
  {
    title: 'Персональний супровід',
    text: 'Менеджер супроводжує заявку від уточнення потреби до погодження та передачі замовлення.',
    icon: 'clipboard'
  },
  {
    title: 'Рішення для техніки',
    text: 'Підбираємо запчастини для аграрної, вантажної та спеціальної техніки без товарного каталогу.',
    icon: 'gear'
  }
];

const audiences = [
  {
    title: 'Фермерські господарства',
    text: 'Допомагаємо фермерам утримувати техніку в роботі та швидко знаходити потрібні запчастини.',
    icon: 'tractor'
  },
  {
    title: 'Агрохолдинги',
    text: 'Комплексно забезпечуємо запчастинами великі підприємства, підрозділи та філії.',
    icon: 'harvester'
  },
  {
    title: 'Транспортні компанії',
    text: 'Підбираємо запчастини для вантажного транспорту, причепів і спеціальної техніки.',
    icon: 'truck'
  },
  {
    title: 'Сервісні центри',
    text: 'Допомагаємо СТО та майстерням швидко отримувати сумісні деталі для ремонту техніки.',
    icon: 'tools'
  },
  {
    title: 'Перевізники',
    text: 'Забезпечуємо оперативне постачання, щоб транспорт не простоював через відсутність деталей.',
    icon: 'delivery'
  },
  {
    title: 'Підприємства з власним парком техніки',
    text: 'Зберігаємо техніку, заявки та історію замовлень в одному цифровому просторі.',
    icon: 'fleet'
  }
];

const requestChannels = [
  {
    title: 'Фото запчастини',
    text: 'Надішліть фото шильдика, вузла або пошкодженої деталі.',
    href: '/request',
    icon: TbCamera
  },
  {
    title: 'Telegram',
    text: 'Швидкий старт заявки у месенджері.',
    href: telegramBotUrl,
    icon: TbBrandTelegram
  },
  {
    title: 'Форма на сайті',
    text: 'Структурований запит для менеджера.',
    href: '/request',
    icon: TbClipboardText
  },
  {
    title: 'Excel / PDF / DOC',
    text: 'Завантажте список позицій для закупівлі.',
    href: '/request',
    icon: TbFileSpreadsheet
  },
  {
    title: 'Через менеджера',
    text: 'Зателефонуйте або напишіть — ми допоможемо.',
    href: '/contacts',
    icon: TbUser
  }
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
  if (icon === 'tractor') {
    return <TbTractor aria-hidden="true" focusable="false" />;
  }

  if (icon === 'harvester') {
    return (
      <span className="for-whom-card__agro-icon" aria-hidden="true">
        <TbTractor className="for-whom-card__agro-machine" focusable="false" />
        <TbWheat className="for-whom-card__agro-crop" focusable="false" />
      </span>
    );
  }

  if (icon === 'truck') {
    return <TbTruck aria-hidden="true" focusable="false" />;
  }

  if (icon === 'tools') {
    return <TbTools aria-hidden="true" focusable="false" />;
  }

  if (icon === 'delivery') {
    return <TbTruckDelivery aria-hidden="true" focusable="false" />;
  }

  return <TbDeviceDesktopAnalytics aria-hidden="true" focusable="false" />;
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
            <div className="grid grid-cols-2 lg:grid-cols-[minmax(340px,2.2fr)_repeat(4,minmax(130px,1fr))]">
              <div className="col-span-2 flex gap-4 border-b border-white/10 p-4 text-white sm:p-5 lg:col-span-1 lg:border-b-0">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-technical-white sm:size-14">
                  <TrustIcon icon="database" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-snug sm:text-xl">
                    Кожне замовлення автоматично поповнює цифрову історію вашої техніки.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    Більше не потрібно шукати, які запчастини вже купували, для якої машини та коли.
                  </p>
                </div>
              </div>
              {heroFleetHighlights.map((item, index) => (
                <div
                  key={item.title}
                  className={`p-4 text-center sm:p-5 lg:border-l lg:border-white/10 ${index < 2 ? 'border-b border-white/10 lg:border-b-0' : ''} ${index % 2 === 1 ? 'border-l border-white/10' : ''}`}
                >
                  <div className="mx-auto flex size-12 items-center justify-center text-accent">
                    <TrustIcon icon={item.icon} />
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-5 text-white sm:leading-6">{item.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative overflow-hidden bg-public-page py-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(152,157,166,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(152,157,166,0.45)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="kp-container relative">
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
                <div key={stat.title} className="min-w-0 px-8 py-10 transition-colors duration-200 hover:bg-public-elevated sm:px-10 lg:px-6">
                  <div className="flex items-start gap-3 lg:flex-col">
                    <div className="shrink-0 text-accent">
                      <TrustIcon icon={stat.icon} />
                    </div>
                    <h3 className="min-w-0 flex-1 break-normal whitespace-normal hyphens-none text-left text-xl font-bold leading-tight text-public-primary lg:text-base xl:text-xl">{stat.title}</h3>
                  </div>
                  <p className="mt-5 w-full max-w-56 text-base font-medium leading-7 text-public-muted">{stat.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden bg-[#050505] py-12 text-white sm:py-14 lg:py-16">
        <div className="for-whom-section-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.96)_0%,rgba(5,7,10,0.84)_35%,rgba(5,7,10,0.68)_70%,rgba(5,7,10,0.56)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.3)_0%,rgba(5,5,5,0.04)_34%,rgba(5,5,5,0.24)_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(232,232,232,0.78)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.78)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="kp-container relative z-10">
          <div className="max-w-[720px]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Для кого</p>
            <h2 className="mt-2 max-w-[660px] text-[28px] font-bold leading-[1.08] text-white sm:text-[34px] lg:text-[38px]">
              Для компаній, де техніка має працювати, а не чекати
            </h2>
            <p className="mt-4 max-w-[680px] text-left text-sm font-semibold leading-6 text-technical-white/85 sm:text-base sm:leading-7">
              Ми працюємо з різними типами бізнесу, де важливі надійність техніки та швидкість постачання запчастин.
            </p>
          </div>
          <div className="mt-5 h-px w-20 bg-accent" />

          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {audiences.map((audience, index) => (
              <article key={audience.title} className="for-whom-card">
                <div className="for-whom-card__diagonal" />
                <div className="for-whom-card__icon-wrap">
                  <AudienceIcon icon={audience.icon} />
                </div>
                <div className="for-whom-card__content">
                  <div className="for-whom-card__header">
                    <span className="for-whom-card__number">{index + 1}</span>
                    <h3 className="for-whom-card__title">{audience.title}</h3>
                  </div>
                  <p className="for-whom-card__description">{audience.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="telegram" className="border-y border-white/5 bg-public-page py-14 text-white sm:py-16">
        <div className="kp-container">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Способи створення заявки</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Оберіть зручний спосіб
                <br className="hidden sm:block" />
                та залиште заявку за 5 хвилин
              </h2>
            </div>
            <p className="max-w-xl text-base font-medium leading-7 text-sidebar-text lg:justify-self-end">
              Ви можете надіслати запит у зручний для вас спосіб, а наш менеджер швидко обробить його та підбере рішення.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-6 min-[1200px]:grid-cols-5">
            {requestChannels.map((channel, index) => {
              const Icon = channel.icon;
              const tabletPosition =
                index === 3
                  ? 'md:col-start-2 min-[1200px]:col-start-auto'
                  : index === 4
                    ? 'md:col-start-4 min-[1200px]:col-start-auto'
                    : '';

              return (
                <Link
                  key={channel.title}
                  href={channel.href}
                  className={`group flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-white/[0.035] px-5 py-7 text-center transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/45 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary md:col-span-2 min-[1200px]:col-span-1 ${tabletPosition}`}
                >
                  <span className="flex size-16 items-center justify-center text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-12 stroke-[1.5] sm:size-14" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold leading-tight text-white">{channel.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-sidebar-text">{channel.text}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
