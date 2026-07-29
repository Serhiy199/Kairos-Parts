import Image from 'next/image';
import Link from 'next/link';
import { TbArrowRight } from 'react-icons/tb';

import { LOGISTICS_REQUEST_FORM_ENABLED } from '@/lib/features/logistics';

export function LogisticsFinalCta() {
  const isAvailable = LOGISTICS_REQUEST_FORM_ENABLED;

  return (
    <section
      aria-labelledby="logistics-final-cta-title"
      className="relative isolate overflow-hidden border-y border-public-border bg-[#07090c] py-4 text-white sm:py-5 lg:py-6"
    >
      <Image
        src="/images/kairos-hero-industrial.png"
        alt=""
        fill
        sizes="100vw"
        className="-z-30 object-cover object-[43%_center] opacity-70 saturate-[0.8]"
      />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-black/25" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(7,9,12,0.96)_0%,rgba(7,9,12,0.72)_34%,rgba(7,9,12,0.38)_56%,rgba(7,9,12,0.88)_78%,rgba(7,9,12,0.97)_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_50%,rgba(200,150,66,0.14),transparent_34%)]" />

      <div className="kp-container relative">
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.75fr)_minmax(300px,1fr)] lg:items-stretch">
          <div className="relative z-10 flex items-center px-6 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            <h2
              id="logistics-final-cta-title"
              className="font-display text-2xl font-bold uppercase leading-[1.12] sm:text-3xl xl:text-[34px]"
            >
              <span className="block text-white">Працюємо, щоб ваше підприємство</span>
              <span className="mt-2 block text-accent">не зупинялося</span>
            </h2>
          </div>

          <div aria-hidden="true" className="hidden lg:block" />

          <div className="relative z-10 flex items-center px-6 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            <div className="w-full">
              {isAvailable ? (
                <Link
                  href="/logistics/request"
                  className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-md bg-accent px-6 py-5 text-center text-base font-bold text-primary shadow-panel transition hover:-translate-y-0.5 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:whitespace-nowrap"
                >
                  <span>Створити заявку на перевезення</span>
                  <TbArrowRight
                    aria-hidden="true"
                    focusable="false"
                    className="size-5 shrink-0 stroke-[2]"
                  />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-16 w-full cursor-not-allowed items-center justify-center gap-3 rounded-md bg-accent px-6 py-5 text-center text-base font-bold text-primary opacity-60 shadow-panel lg:whitespace-nowrap"
                >
                  <span>Створити заявку на перевезення</span>
                  <TbArrowRight
                    aria-hidden="true"
                    focusable="false"
                    className="size-5 shrink-0 stroke-[2]"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
