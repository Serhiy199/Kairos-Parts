import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  TbArrowDown,
  TbArrowRight,
  TbCheck,
  TbDatabaseCog,
  TbFileInvoice,
  TbHeartHandshake,
  TbMinus,
  TbPackages,
  TbSettingsSearch,
  TbTractor
} from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

export const metadata: Metadata = {
  title: 'Переваги Kairos Parts — підбір і постачання запчастин для бізнесу',
  description:
    'Професійний підбір запчастин, робота з перевіреними постачальниками, консолідована доставка та цифрова історія техніки.'
};

const advantages = [
  {
    title: 'Консолідована видача замовлень',
    paragraphs: [
      'Kairos Parts об’єднує позиції від різних постачальників у межах одного погодженого процесу. Клієнту не потрібно окремо координувати кожне відправлення, контролювати різні служби доставки та збирати інформацію з кількох джерел.',
      'Ми організовуємо приймання, перевірку та консолідацію замовлення, щоб підприємство отримало всі погоджені позиції через один центр координації. Це спрощує логістику, зменшує кількість окремих операцій і робить отримання запчастин більш передбачуваним.'
    ],
    icon: TbPackages,
    image: '/images/advantages/benefit-1.png'
  },
  {
    title: 'Професійний підбір запчастин',
    paragraphs: [
      'Команда Kairos Parts перевіряє каталожні номери, технічні характеристики, модифікацію машини та сумісність деталей перед формуванням пропозиції. Підбір виконується з урахуванням конкретної одиниці техніки, а не лише за загальною назвою запчастини.',
      'Клієнт отримує вибір між оригінальними деталями та перевіреними аналогами з поясненням відмінностей. Такий підхід зменшує ризик помилки, повторної закупівлі та простою техніки через невідповідну позицію.'
    ],
    icon: TbSettingsSearch,
    image: '/images/advantages/benefit-2.png'
  },
  {
    title: 'Один договір — один партнер',
    paragraphs: [
      'Замість роботи з десятками окремих продавців клієнт взаємодіє з одним сервісним партнером. Kairos Parts бере на себе комунікацію з постачальниками, уточнення характеристик, узгодження варіантів і супровід замовлення.',
      'Один менеджер зберігає контекст заявки та координує процес від першого запиту до передачі деталей. Це скорочує кількість документів і контактів, спрощує внутрішній облік та робить комунікацію зрозумілою для всіх учасників закупівлі.'
    ],
    icon: TbHeartHandshake,
    image: '/images/advantages/benefit-3.png'
  },
  {
    title: 'Зручні умови для бізнесу',
    paragraphs: [
      'Процес Kairos Parts побудований з урахуванням потреб юридичних осіб, регулярних закупівель і внутрішніх процедур погодження. Ми формуємо необхідні документи, працюємо з ПДВ та підтримуємо різні форми розрахунку відповідно до погоджених умов.',
      'Рахунки, документи та інформація про замовлення зберігаються в єдиному процесі. Це допомагає закупівельникам, бухгалтерії та керівникам швидше погоджувати витрати й контролювати історію взаємодії.'
    ],
    icon: TbFileInvoice,
    image: '/images/advantages/benefit-4.png'
  },
  {
    title: 'Майданчик перевіреної техніки',
    paragraphs: [
      'Kairos Parts працює з аграрною, вантажною та спеціальною технікою в одному B2B-середовищі. Платформа допомагає підприємствам підбирати запчастини для різних типів машин без необхідності шукати окремий сервіс для кожного напряму.',
      'Ми співпрацюємо з перевіреними партнерами та враховуємо специфіку конкретної техніки, її призначення й умови експлуатації. Окремий напрям майданчика також підтримує роботу з купівлею та продажем перевіреної вживаної техніки.'
    ],
    icon: TbTractor,
    image: '/images/advantages/benefit-5.png'
  },
  {
    title: 'Цифровий парк техніки',
    paragraphs: [
      'Для зареєстрованих користувачів кожна машина може мати власну цифрову історію. До неї прив’язуються заявки, підібрані запчастини, каталожні номери, рахунки та документи, які з’являються в процесі обслуговування.',
      'Під час наступного звернення не потрібно повторно шукати старі переписки або відновлювати інформацію вручну. Платформа зберігає попередні рішення та допомагає швидко сформувати повторне замовлення для конкретної одиниці техніки.'
    ],
    icon: TbDatabaseCog,
    image: '/images/advantages/benefit-6.png'
  }
];

const beforeItems = [
  'Дзвінки кільком постачальникам',
  'Окремі таблиці та переписки',
  'Ризик помилки в сумісності',
  'Кілька різних доставок',
  'Документи в різних місцях',
  'Складно повторити попереднє замовлення'
];

const afterItems = [
  'Одна заявка',
  'Один менеджер',
  'Перевірений підбір',
  'Погоджене рішення',
  'Консолідована доставка',
  'Цифрова історія по кожній машині'
];

export default function AdvantagesPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <Image
          src="/images/advantages/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[64%_center] sm:object-[60%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-primary/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-public-page via-transparent to-primary/20" />

        <div className="kp-container relative flex min-h-[640px] items-center py-16 sm:min-h-[620px] lg:min-h-[680px] lg:py-20">
          <div className="max-w-[760px]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent sm:text-sm">Переваги Kairos Parts</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl">
              <span className="block">Менше простоїв.</span>
              <span className="block"><span className="text-accent">Більше контролю</span> над технікою</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/90">
              Один B2B-процес замість десятків дзвінків, таблиць і окремих домовленостей.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Kairos Parts бере на себе підбір, перевірку сумісності, роботу з постачальниками, погодження та
              збереження історії замовлень.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                <ActionIcon name="plus" />
                Створити заявку
              </Link>
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-primary/45 px-6 py-3.5 text-center text-sm font-semibold text-accent transition hover:border-accent/80 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                <ActionIcon name="telegram" />
                Надіслати заявку в Telegram
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-page py-16 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:32px_32px] text-public-muted" />
        <div className="kp-container relative z-10">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent sm:text-sm">Ключові переваги</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Що отримує ваша компанія
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Kairos Parts спрощує закупівлю запчастин, зменшує ризик помилок і зберігає всю історію роботи з
              технікою в одному цифровому просторі.
            </p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <ol className="mt-10 grid gap-5 sm:mt-12 lg:gap-6">
            {advantages.map((advantage, index) => {
              const Icon = advantage.icon;
              const contentFirst = index % 2 === 0;

              return (
                <li key={advantage.title}>
                  <article className="grid overflow-hidden rounded-2xl border border-public-border bg-public-card shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-colors duration-200 hover:border-public-border-accent-hover lg:min-h-[420px] lg:grid-cols-2">
                    <div
                      className={`relative order-1 h-[250px] min-w-0 overflow-hidden sm:h-[300px] lg:h-auto lg:min-h-[420px] ${
                        contentFirst ? 'lg:order-2' : 'lg:order-1'
                      }`}
                    >
                      <Image
                        src={advantage.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover"
                      />
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-0 hidden lg:block ${
                          contentFirst
                            ? 'bg-gradient-to-r from-public-card/55 via-transparent to-transparent'
                            : 'bg-gradient-to-l from-public-card/55 via-transparent to-transparent'
                        }`}
                      />
                    </div>

                    <div
                      className={`relative order-2 flex min-w-0 flex-col justify-center bg-gradient-to-br from-public-card to-public-section p-6 sm:p-8 lg:p-10 xl:p-12 ${
                        contentFirst ? 'lg:order-1' : 'lg:order-2'
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-10 hidden w-px bg-gradient-to-b from-transparent via-accent/75 to-transparent lg:block ${
                          contentFirst ? 'right-0' : 'left-0'
                        }`}
                      />

                      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <span
                          aria-hidden="true"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-extrabold leading-none text-primary shadow-sm"
                        >
                          {index + 1}
                        </span>
                        <Icon
                          aria-hidden="true"
                          focusable="false"
                          className="size-10 shrink-0 stroke-[1.65] text-accent sm:size-11"
                        />
                        <h3 className="min-w-0 break-normal whitespace-normal hyphens-none text-xl font-bold leading-tight text-public-primary sm:text-2xl lg:text-[28px]">
                          {advantage.title}
                        </h3>
                      </div>

                      <div className="mt-6 max-w-xl space-y-4 text-base leading-relaxed text-public-muted sm:text-lg">
                        {advantage.paragraphs.map((paragraph) => (
                          <p key={paragraph} className="break-normal whitespace-normal hyphens-none">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-page py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:32px_32px] text-public-muted" />
        <div className="kp-container relative">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent sm:text-sm">Різниця в процесі</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl lg:text-5xl">
              Від хаотичної закупівлі до керованого процесу
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-public-muted sm:text-lg sm:leading-8">
              Kairos Parts прибирає зайві ручні дії та об’єднує ключові етапи в одному сервісі.
            </p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-public-border bg-public-card shadow-panel">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] lg:items-stretch">
              <div className="p-6 sm:p-8 lg:p-10">
                <h3 className="text-2xl font-bold text-public-primary">Було</h3>
                <ul className="mt-6 grid gap-4">
                  {beforeItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base leading-7 text-public-muted">
                      <TbMinus aria-hidden="true" className="mt-1 size-5 shrink-0 text-public-subtle" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-center border-y border-public-border bg-public-elevated py-4 lg:border-x lg:border-y-0 lg:py-0">
                <TbArrowRight aria-hidden="true" className="hidden size-8 text-accent lg:block" />
                <TbArrowDown aria-hidden="true" className="size-8 text-accent lg:hidden" />
              </div>

              <div className="border-public-border-accent bg-gradient-to-br from-public-elevated to-public-card p-6 sm:p-8 lg:border-l lg:p-10">
                <h3 className="text-2xl font-bold text-public-primary">З Kairos Parts</h3>
                <ul className="mt-6 grid gap-4">
                  {afterItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base font-semibold leading-7 text-public-secondary">
                      <TbCheck aria-hidden="true" className="mt-1 size-5 shrink-0 stroke-[2.2] text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="relative mt-14 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,rgba(28,28,28,0.98),rgba(8,8,8,0.98))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:px-8 sm:py-10 lg:mt-16 lg:px-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(200,150,66,0.18),transparent_38%)]"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent/30 via-accent to-accent/30" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)] lg:items-center lg:gap-10">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Готові передати нам запит?</h2>
                <p className="mt-4 text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                  Надішліть артикул, список, фото або короткий опис потреби. Менеджер уточнить деталі та
                  запропонує сумісне рішення.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:min-w-[320px] lg:justify-self-end">
                <Link
                  href="/request"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <ActionIcon name="plus" className="h-4 w-4" />
                  Створити заявку
                </Link>
                <a
                  href={telegramBotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-primary/45 px-6 py-3.5 text-sm font-bold text-accent transition hover:border-accent/80 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <ActionIcon name="telegram" className="h-4 w-4" />
                  Надіслати в Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
