import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  TbBuildingWarehouse,
  TbClock,
  TbGauge,
  TbPackage,
  TbReportMoney,
  TbShieldCheck,
  TbTruckDelivery
} from 'react-icons/tb';

import { LogisticsOverviewSection } from '@/components/public/logistics/logistics-overview-section';
import { LogisticsRatesSection } from '@/components/public/logistics/logistics-rates-section';
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
              <LogisticsRequestCta helperId="hero-logistics-cta-status" />
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

      <LogisticsRatesSection />

      <LogisticsOverviewSection />

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
            <LogisticsRequestCta helperId="final-logistics-cta-status" />
          </div>
        </div>
      </section>
    </>
  );
}

function LogisticsRequestCta({ helperId }: { helperId: string }) {
  const isAvailable = LOGISTICS_REQUEST_FORM_ENABLED;

  return (
    <div>
      {isAvailable ? (
        <Link
          href="/logistics/request"
          aria-describedby={helperId}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          <TbTruckDelivery aria-hidden="true" focusable="false" className="size-5" />
          Створити заявку на перевезення
        </Link>
      ) : (
        <button
          type="button"
          disabled
          aria-describedby={helperId}
          className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary opacity-60 shadow-panel sm:w-auto"
        >
          <TbTruckDelivery aria-hidden="true" focusable="false" className="size-5" />
          Створити заявку на перевезення
        </button>
      )}
      <p id={helperId} className="mt-3 text-sm leading-6 text-white/70">
        {isAvailable
          ? 'Форма доступна для попереднього заповнення. Надсилання буде додано на наступному етапі.'
          : 'Онлайн-заявка готується до запуску.'}
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
