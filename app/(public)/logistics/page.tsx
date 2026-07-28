import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  TbBuildingWarehouse,
  TbClipboardText,
  TbClock,
  TbDroplet,
  TbGauge,
  TbPackage,
  TbReportMoney,
  TbShieldCheck,
  TbTractor,
  TbTruckDelivery
} from 'react-icons/tb';

import {
  LOGISTICS_LANDING_ENABLED,
  LOGISTICS_REQUEST_FORM_ENABLED
} from '@/lib/features/logistics';
import { buildAbsoluteUrl } from '@/lib/site-url';

const canonicalUrl = buildAbsoluteUrl('/logistics');

export const metadata: Metadata = {
  title: 'Kairos Logistics — доставка товарів для агропідприємств | Kairos Parts',
  description:
    'Забір товарів у постачальників у межах Київської області та доставка до бази Kairos Parts у Кагарлику або в господарства Кагарлицької громади.',
  alternates: {
    canonical: canonicalUrl
  },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: canonicalUrl,
    siteName: 'Kairos Parts',
    title: 'Kairos Logistics — доставка товарів для агропідприємств',
    description:
      'Забираємо товари у постачальників у межах Київської області та доставляємо до бази Kairos Parts або в господарства Кагарлицької громади.'
  },
  robots: {
    index: true,
    follow: true
  }
};

const trustSignals = [
  {
    title: 'Швидко',
    text: 'Оперативне реагування',
    icon: TbClock
  },
  {
    title: 'Надійно',
    text: 'Контроль кожної заявки',
    icon: TbShieldCheck
  },
  {
    title: 'Просто',
    text: 'Прозорі тарифи без прихованих умов',
    icon: TbPackage
  }
];

const useCases = [
  {
    text: 'Зупинилася техніка і терміново потрібна запчастина.',
    icon: TbTractor
  },
  {
    text: 'Не вистачило ЗЗР, мастильних матеріалів або комплектуючих.',
    icon: TbDroplet
  },
  {
    text: 'Власний транспорт зайнятий або його недоцільно відправляти за одним замовленням.',
    icon: TbTruckDelivery
  },
  {
    text: 'Потрібно оперативно забрати товар у постачальника в Київській області.',
    icon: TbPackage
  }
];

const processSteps = [
  {
    title: 'Створення заявки',
    text: 'Ви створюєте заявку на перевезення.',
    icon: TbClipboardText
  },
  {
    title: 'Організація відвантаження',
    text: 'Ми перевіряємо дані та організовуємо відвантаження.',
    icon: TbShieldCheck
  },
  {
    title: 'Забір товарів',
    text: 'Забираємо товари у постачальника.',
    icon: TbPackage
  },
  {
    title: 'Доставка',
    text: 'Доставляємо їх на базу Kairos Parts або безпосередньо в господарство.',
    icon: TbTruckDelivery
  }
];

const benefits = [
  {
    title: 'Економія часу',
    text: 'Власний транспорт підприємства продовжує виконувати свою основну роботу.',
    icon: TbClock
  },
  {
    title: 'Без простоїв',
    text: 'Допомагаємо оперативно отримати критично важливі товари для роботи підприємства.',
    icon: TbGauge
  },
  {
    title: 'Один сервіс',
    text: 'Організовуємо забір товарів у постачальників у межах погодженої географії.',
    icon: TbBuildingWarehouse
  },
  {
    title: 'Прозорі тарифи',
    text: 'Фіксована вартість за тарифним містом і зрозумілі доплати без прихованих умов.',
    icon: TbReportMoney
  }
];

export default function LogisticsPage() {
  if (!LOGISTICS_LANDING_ENABLED) {
    notFound();
  }

  return (
    <>
      <section
        aria-labelledby="logistics-page-title"
        className="relative isolate min-h-[620px] overflow-hidden bg-primary text-white sm:min-h-[660px] lg:min-h-[700px]"
      >
        <Image
          src="/images/benefits/benefits-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[68%_center] sm:object-[64%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-primary/50" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.98)_0%,rgba(5,7,10,0.94)_44%,rgba(5,7,10,0.67)_72%,rgba(5,7,10,0.46)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,10,0.97)_0%,rgba(5,7,10,0.90)_42%,rgba(5,7,10,0.52)_70%,rgba(5,7,10,0.30)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.12)_55%,rgba(5,7,10,0.86)_100%)]" />

        <div className="kp-container relative flex min-h-[620px] items-center py-16 sm:min-h-[660px] sm:py-20 lg:min-h-[700px]">
          <div className="max-w-[760px]">
            <p className="font-brand text-sm font-bold uppercase tracking-[0.2em] text-white sm:text-base">
              KAIROS <span className="text-accent">LOGISTICS</span>
            </p>
            <h1
              id="logistics-page-title"
              className="mt-5 max-w-[720px] font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[56px]"
            >
              Оперативне забезпечення підприємств критично важливими ТМЦ.
            </h1>
            <p className="mt-6 max-w-[700px] text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              Забираємо товари у постачальників у межах Київської області та доставляємо до бази
              Kairos Parts у Кагарлику або безпосередньо в господарство в межах Кагарлицької громади.
            </p>

            <div className="mt-8 max-w-md">
              <LogisticsUnavailableCta helperId="hero-logistics-cta-status" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="logistics-trust-title" className="border-y border-white/10 bg-[#080a0d] text-white">
        <div className="kp-container py-6 sm:py-8">
          <h2 id="logistics-trust-title" className="sr-only">
            Ключові переваги Kairos Logistics
          </h2>
          <div role="list" className="grid gap-4 md:grid-cols-3 md:gap-0">
            {trustSignals.map((signal, index) => {
              const Icon = signal.icon;

              return (
                <div
                  key={signal.title}
                  role="listitem"
                  className={`flex min-w-0 items-center gap-4 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-4 md:rounded-none md:border-y-0 md:border-l-0 md:bg-transparent md:px-6 ${
                    index < trustSignals.length - 1 ? 'md:border-r' : 'md:border-r-0'
                  }`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-accent/35 bg-accent/10 text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-6 stroke-[1.6]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{signal.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{signal.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="logistics-audience-title" className="relative overflow-hidden bg-public-page py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_12%,rgba(200,150,66,0.12),transparent_30%)]" />
        <div className="kp-container relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center">
          <div>
            <SectionEyebrow>Сервіс для агробізнесу</SectionEyebrow>
            <h2 id="logistics-audience-title" className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl">
              Для кого створений сервіс
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-public-muted sm:text-lg sm:leading-8">
              Kairos Logistics працює для агропідприємств Кагарлицької громади. Ми забираємо товари у
              постачальників у межах Київської області та доставляємо їх на базу Kairos Parts або
              безпосередньо в господарство в межах громади.
            </p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-public-muted">
              Підприємству не потрібно відволікати власний транспорт за окремою закупівлею — команда
              Kairos організовує забір і доставку в межах погодженої географії.
            </p>
          </div>

          <aside className="rounded-xl border border-public-border bg-public-card p-6 shadow-card sm:p-7" aria-label="Географія сервісу">
            <span className="grid size-12 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent">
              <TbBuildingWarehouse aria-hidden="true" focusable="false" className="size-7 stroke-[1.55]" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-accent">База Kairos Parts</p>
            <p className="mt-2 text-xl font-bold text-public-primary">м. Кагарлик, вул. Миронівська, 33д</p>
            <div className="mt-5 border-t border-public-border pt-5 text-sm leading-6 text-public-muted">
              Забір товарів — у постачальників Київської області. Доставка в господарство — у межах
              Кагарлицької громади.
            </div>
          </aside>
        </div>
      </section>

      <section aria-labelledby="logistics-use-cases-title" className="bg-public-section py-16 sm:py-20 lg:py-24">
        <div className="kp-container">
          <SectionHeading
            eyebrow="Типові ситуації"
            id="logistics-use-cases-title"
            title="Коли потрібен Kairos Logistics"
            copy="Сервіс допомагає оперативно організувати забір товарів, коли власний транспорт має залишатися на основних роботах."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;

              return (
                <article key={useCase.text} className="rounded-xl border border-public-border bg-public-card p-5 shadow-card sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid size-12 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent">
                      <Icon aria-hidden="true" focusable="false" className="size-7 stroke-[1.55]" />
                    </span>
                    <span className="font-display text-2xl font-bold text-public-subtle" aria-hidden="true">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-5 text-base font-semibold leading-7 text-public-primary">{useCase.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="logistics-process-title" className="relative overflow-hidden bg-[#07090c] py-16 text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(200,150,66,0.16),transparent_38%)]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(232,232,232,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.22)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        <div className="kp-container relative">
          <SectionHeading
            dark
            eyebrow="Чотири кроки"
            id="logistics-process-title"
            title="Як працює сервіс"
            copy="Зрозумілий процес від заявки до доставки товарів на базу Kairos Parts або в господарство."
          />

          <ol className="mt-12 space-y-8 md:grid md:grid-cols-4 md:gap-0 md:space-y-0">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === processSteps.length - 1;

              return (
                <li key={step.title} className="relative min-w-0 pl-14 md:pl-0 md:pr-8 md:pt-14">
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-[-2rem] left-5 top-10 w-px bg-accent/45 md:bottom-auto md:left-10 md:right-0 md:top-5 md:h-px md:w-auto"
                    />
                  ) : null}
                  <span className="absolute left-0 top-0 z-10 grid size-10 place-items-center rounded-full border border-accent bg-[#0b0d10] font-display text-sm font-bold text-accent shadow-[0_0_0_7px_rgba(200,150,66,0.09)]">
                    {index + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-lg border border-white/12 bg-white/[0.04] text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-6 stroke-[1.55]" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="logistics-benefits-title" className="bg-public-page py-16 sm:py-20 lg:py-24">
        <div className="kp-container">
          <SectionHeading
            eyebrow="Переваги"
            id="logistics-benefits-title"
            title="Чому підприємства обирають Kairos Logistics"
            copy="Операційний сервіс із чіткою географією, зрозумілими умовами та фокусом на потребах агропідприємства."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <article key={benefit.title} className="rounded-xl border border-public-border bg-public-card p-5 shadow-card sm:p-6">
                  <span className="grid size-11 place-items-center rounded-full border border-accent/35 bg-accent/10 text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-6 stroke-[1.6]" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-public-primary">{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-public-muted">{benefit.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="logistics-final-cta-title" className="relative overflow-hidden bg-primary py-14 text-white sm:py-16 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(200,150,66,0.18),transparent_32%),linear-gradient(120deg,rgba(5,5,5,1),rgba(15,18,22,1))]" />
        <div className="kp-container relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Kairos Logistics</p>
            <h2 id="logistics-final-cta-title" className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
              Працюємо, щоб ваше підприємство <span className="text-accent">не зупинялося.</span>
            </h2>
          </div>
          <div className="w-full max-w-md shrink-0">
            <LogisticsUnavailableCta helperId="final-logistics-cta-status" />
          </div>
        </div>
      </section>
    </>
  );
}

function LogisticsUnavailableCta({ helperId }: { helperId: string }) {
  const isAvailable = LOGISTICS_REQUEST_FORM_ENABLED;

  return (
    <div>
      <button
        type="button"
        disabled={!isAvailable}
        aria-describedby={helperId}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary shadow-panel transition enabled:hover:bg-accent-hover enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <TbTruckDelivery aria-hidden="true" focusable="false" className="size-5" />
        Створити заявку на перевезення
      </button>
      <p id={helperId} className="mt-3 text-sm leading-6 text-white/70">
        Онлайн-заявка готується до запуску.
      </p>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{children}</p>;
}

function SectionHeading({
  id,
  eyebrow,
  title,
  copy,
  dark = false
}: {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 id={id} className={`mt-3 text-3xl font-bold leading-tight sm:text-4xl ${dark ? 'text-white' : 'text-public-primary'}`}>
        {title}
      </h2>
      <p className={`mt-4 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 ${dark ? 'text-white/70' : 'text-public-muted'}`}>
        {copy}
      </p>
    </div>
  );
}
