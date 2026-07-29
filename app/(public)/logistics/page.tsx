import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TbTruckDelivery } from 'react-icons/tb';

import { LogisticsFinalCta } from '@/components/public/logistics/logistics-final-cta';
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
        <div className="absolute inset-0 -z-30 hidden md:block">
          <Image
            src="/images/logistics/logistics-hero-wide.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 -z-20 hidden bg-[linear-gradient(90deg,rgba(5,7,10,0.96)_0%,rgba(5,7,10,0.88)_38%,rgba(5,7,10,0.42)_62%,rgba(5,7,10,0.18)_100%)] md:block" />

        <div className="relative mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="relative min-h-[500px] py-14 sm:min-h-[540px] sm:py-16 md:flex md:items-center lg:min-h-[580px] lg:py-20">
            <div className="max-w-[600px] xl:max-w-[640px]">
              <p className="font-brand text-sm font-bold uppercase tracking-[0.2em] text-white sm:text-base">
                KAIROS <span className="text-accent">LOGISTICS</span>
              </p>
              <h1
                id="logistics-page-title"
                className="mt-5 max-w-[720px] font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[56px]"
              >
                Оперативне забезпечення підприємств критично важливими ТМЦ
              </h1>
              <p className="mt-6 max-w-[700px] text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                Спеціалізований сервіс для агропідприємств Кагарлицького району. Забираємо товар у
                будь-якого постачальника в межах Київської області та оперативно доставляємо до
                Kairos Parts або безпосередньо на ваше підприємство.
              </p>

              <div className="mt-8 max-w-md">
                <LogisticsRequestCta />
              </div>
            </div>

            <div className="relative mt-10 min-h-[260px] w-full md:hidden">
              <Image
                src="/images/logistics/logistics-delivery.jpg"
                alt=""
                fill
                sizes="100vw"
                className="object-contain object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <LogisticsRatesSection />

      <LogisticsFinalCta />
    </>
  );
}

function LogisticsRequestCta() {
  const isAvailable = LOGISTICS_REQUEST_FORM_ENABLED;

  return (
    <div>
      {isAvailable ? (
        <Link
          href="/logistics/request"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          <TbTruckDelivery aria-hidden="true" focusable="false" className="size-5" />
          Створити заявку на перевезення
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary opacity-60 shadow-panel sm:w-auto"
        >
          <TbTruckDelivery aria-hidden="true" focusable="false" className="size-5" />
          Створити заявку на перевезення
        </button>
      )}
    </div>
  );
}
