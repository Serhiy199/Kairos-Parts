import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TbTruckDelivery } from 'react-icons/tb';

import { LogisticsBenefitsBar } from '@/components/public/logistics/logistics-benefits-bar';
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

      <LogisticsBenefitsBar />

      <LogisticsRatesSection />

      <LogisticsFinalCta />
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
