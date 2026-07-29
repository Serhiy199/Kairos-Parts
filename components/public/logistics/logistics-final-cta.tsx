import Image from 'next/image';
import Link from 'next/link';
import { TbArrowRight } from 'react-icons/tb';

import { LOGISTICS_REQUEST_FORM_ENABLED } from '@/lib/features/logistics';

const helperId = 'final-logistics-cta-status';

export function LogisticsFinalCta() {
  const isAvailable = LOGISTICS_REQUEST_FORM_ENABLED;

  return (
    <section
      aria-labelledby="logistics-final-cta-title"
      className="bg-public-page py-10 sm:py-12 lg:py-14"
    >
      <div className="kp-container">
        <div className="relative overflow-hidden rounded-xl border border-public-border bg-[#07090c] text-white shadow-panel">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_50%,rgba(200,150,66,0.14),transparent_34%)]" />

          <div className="relative grid lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.75fr)_minmax(300px,1fr)] lg:items-stretch">
            <div className="relative z-10 flex items-center p-6 sm:p-8 lg:p-10">
              <h2
                id="logistics-final-cta-title"
                className="font-display text-2xl font-bold uppercase leading-[1.12] sm:text-3xl xl:text-[34px]"
              >
                <span className="block text-white">Працюємо, щоб ваше підприємство</span>
                <span className="mt-2 block text-accent">не зупинялося</span>
              </h2>
            </div>

            <div className="relative min-h-[140px] overflow-hidden sm:min-h-[180px] lg:min-h-[170px]">
              <Image
                src="/images/kairos-hero-industrial.png"
                alt=""
                fill
                sizes="(min-width: 1024px) 28vw, 100vw"
                className="object-cover object-[43%_center] opacity-75 saturate-[0.8]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090c_0%,rgba(7,9,12,0.18)_34%,rgba(7,9,12,0.12)_66%,#07090c_100%)]" />
              <div className="absolute inset-0 bg-black/15" />
            </div>

            <div className="relative z-10 flex items-center p-6 pt-4 sm:p-8 sm:pt-6 lg:p-10">
              <div className="w-full">
                {isAvailable ? (
                  <Link
                    href="/logistics/request"
                    aria-describedby={helperId}
                    className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-accent px-6 py-4 text-center text-base font-bold text-primary shadow-panel transition hover:-translate-y-0.5 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:whitespace-nowrap"
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
                    aria-describedby={helperId}
                    className="inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-md bg-accent px-6 py-4 text-center text-base font-bold text-primary opacity-60 shadow-panel lg:whitespace-nowrap"
                  >
                    <span>Створити заявку на перевезення</span>
                    <TbArrowRight
                      aria-hidden="true"
                      focusable="false"
                      className="size-5 shrink-0 stroke-[2]"
                    />
                  </button>
                )}
                <p id={helperId} className="mt-3 text-sm leading-6 text-white/70">
                  {isAvailable
                    ? 'Форма доступна для попереднього заповнення. Надсилання буде додано на наступному етапі.'
                    : 'Онлайн-заявка готується до запуску.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
