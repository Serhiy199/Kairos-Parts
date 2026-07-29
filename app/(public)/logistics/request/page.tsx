import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LogisticsRequestForm } from '@/components/public/logistics/logistics-request-form';
import {
  LOGISTICS_REQUEST_FORM_ENABLED,
  LOGISTICS_REQUEST_SUBMIT_ENABLED
} from '@/lib/features/logistics';
import { getLogisticsRequestContactPrefill } from '@/lib/logistics/access';
import { buildAbsoluteUrl } from '@/lib/site-url';

const canonicalUrl = buildAbsoluteUrl('/logistics/request');

export const metadata: Metadata = {
  title: 'Заявка на перевезення | Kairos Logistics',
  description:
    'Заповніть дані точок відвантаження, оберіть спосіб доставки та перегляньте попередній розрахунок вартості Kairos Logistics.',
  alternates: {
    canonical: canonicalUrl
  },
  robots: {
    index: false,
    follow: false
  }
};

export default async function LogisticsRequestPage() {
  if (!LOGISTICS_REQUEST_FORM_ENABLED) {
    notFound();
  }

  const initialContact = await getLogisticsRequestContactPrefill();

  return (
    <>
      <section className="bg-primary py-12 text-white sm:py-16">
        <div className="kp-container">
          <Link
            href="/logistics"
            className="inline-flex rounded-sm text-sm font-semibold text-accent transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            ← Повернутися до Kairos Logistics
          </Link>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Kairos Logistics
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            Заявка на перевезення
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
            Додайте точки відвантаження, оберіть місце доставки та перегляньте
            актуальний розрахунок. Остаточну суму сервер повторно визначить під
            час створення заявки.
          </p>
        </div>
      </section>

      <section className="bg-public-page py-10 sm:py-14 lg:py-16">
        <div className="kp-container">
          <LogisticsRequestForm
            initialContact={initialContact}
            submitEnabled={LOGISTICS_REQUEST_SUBMIT_ENABLED}
          />
        </div>
      </section>
    </>
  );
}
