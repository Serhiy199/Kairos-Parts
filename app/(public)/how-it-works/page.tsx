import Image from 'next/image';
import Link from 'next/link';
import {
  TbClipboardText,
  TbDatabaseCog,
  TbFileInvoice,
  TbGauge,
  TbPackage,
  TbReportMoney,
  TbSettingsSearch,
  TbShieldCheck,
  TbTruckDelivery,
  TbUserCog,
  TbUserSearch
} from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const processHighlights = [
  {
    title: 'Швидко',
    text: 'Оперативно опрацьовуємо заявку та підбираємо рішення.',
    icon: TbGauge
  },
  {
    title: 'Надійно',
    text: 'Працюємо з перевіреними постачальниками.',
    icon: TbShieldCheck
  },
  {
    title: 'Прозоро',
    text: 'Ціни, строки та умови погоджуємо до замовлення.',
    icon: TbReportMoney
  },
  {
    title: 'Оперативна доставка',
    text: 'Організовуємо доставку запчастин по всій Україні.',
    icon: TbTruckDelivery
  }
];

const steps = [
  {
    label: 'КРОК 1',
    title: 'Створіть особистий кабінет',
    text: 'Додайте реквізити компанії та сформуйте парк своєї техніки. Це дозволить автоматично накопичувати історію замовлень, запчастин і документів для кожної машини.',
    icon: TbUserCog
  },
  {
    label: 'КРОК 2',
    title: 'Створіть заявку',
    text: 'Оберіть техніку зі свого парку або оформіть разову заявку без привʼязки до техніки. Додайте артикул, список, фото або опис потреби.',
    icon: TbClipboardText
  },
  {
    label: 'КРОК 3',
    title: 'Менеджер опрацьовує заявку',
    text: 'Уточнюємо деталі, перевіряємо сумісність та аналізуємо доступні варіанти.',
    icon: TbUserSearch
  },
  {
    label: 'КРОК 4',
    title: 'Підбираємо рішення',
    text: 'Підбираємо оригінальні запчастини та аналоги серед перевірених постачальників і формуємо комерційну пропозицію.',
    icon: TbSettingsSearch
  },
  {
    label: 'КРОК 5',
    title: 'Узгодження та оплата',
    text: 'Погоджуємо склад замовлення, терміни, спосіб доставки та формуємо рахунок.',
    icon: TbFileInvoice
  },
  {
    label: 'КРОК 6',
    title: 'Комплектація та доставка',
    text: 'Консолідуємо замовлення та організовуємо відправку у погоджений термін.',
    icon: TbPackage
  },
  {
    label: 'КРОК 7',
    title: 'Історія оновлюється автоматично',
    text: 'Якщо замовлення оформлено для техніки з вашого парку, платформа автоматично збереже історію запчастин, каталожні номери, рахунки та документи.',
    icon: TbDatabaseCog
  }
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative isolate min-h-[600px] overflow-hidden bg-primary text-white sm:min-h-[640px] lg:min-h-[680px]">
        <Image
          src="/images/how-it-works/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[67%_center] opacity-90 sm:object-[60%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-primary/15" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.94)_0%,rgba(5,7,10,0.86)_48%,rgba(5,7,10,0.62)_78%,rgba(5,7,10,0.46)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,10,0.90)_0%,rgba(5,7,10,0.76)_42%,rgba(5,7,10,0.44)_72%,rgba(5,7,10,0.24)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.08)_60%,rgba(5,7,10,0.52)_100%)]" />

        <div className="kp-container relative flex min-h-[600px] flex-col justify-center py-14 sm:min-h-[640px] sm:py-16 lg:min-h-[680px] lg:py-20">
          <div className="max-w-[760px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent sm:text-sm">Як це працює</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[52px]">
              Від заявки до доставки —
              <span className="mt-1 block text-accent">зрозумілий процес у 7 кроків</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-white/90 sm:text-xl">
              Один менеджер супроводжує запит на кожному етапі.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
              Створіть заявку, погодьте підібране рішення та отримайте запчастини з повною історією по вашій техніці.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="plus" />
                Створити заявку
              </Link>
              <Link
                href={telegramBotUrl}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent/50 bg-primary/45 px-6 py-3.5 text-center text-sm font-semibold text-accent transition hover:border-accent/80 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="telegram" />
                Надіслати заявку в Telegram
              </Link>
            </div>
          </div>

          <div
            role="list"
            aria-label="Переваги процесу"
            className="mt-8 grid grid-cols-1 overflow-hidden rounded-xl border border-white/15 bg-primary/70 shadow-panel backdrop-blur-md sm:mt-10 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4"
          >
            {processHighlights.map((highlight, index) => {
              const Icon = highlight.icon;
              const mobileBorders = index < processHighlights.length - 1 ? 'border-b border-white/10' : '';
              const tabletBorders = `${index === 2 ? 'sm:border-b-0' : ''} ${index % 2 === 0 ? 'sm:border-r sm:border-white/10' : 'sm:border-r-0'}`;
              const desktopBorders = index < processHighlights.length - 1 ? 'lg:border-r lg:border-b-0 lg:border-white/10' : 'lg:border-0';

              return (
                <div
                  key={highlight.title}
                  role="listitem"
                  className={`flex min-w-0 items-center gap-3 px-4 py-3 sm:p-5 lg:px-5 lg:py-4 ${mobileBorders} ${tabletBorders} ${desktopBorders}`}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-7 stroke-[1.5]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-snug text-white">{highlight.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/75">{highlight.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-[#070707] py-16 text-white sm:py-20 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(200,150,66,0.16),transparent_34%),linear-gradient(180deg,rgba(16,16,16,0.96),rgba(5,5,5,1))]" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(232,232,232,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.12)_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="kp-container">
          <div className="relative">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Як це працює</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[42px]">
                7 кроків від заявки до доставки
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                Кожен етап прозорий: від створення заявки до доставки та автоматичного оновлення історії вашої техніки.
              </p>
            </div>

            <div className="relative mt-12 lg:mt-16">
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-accent/20 via-accent/70 to-accent/20 shadow-[0_0_28px_rgba(200,150,66,0.22)] lg:left-1/2 lg:-translate-x-1/2"
              />
              <ol className="relative space-y-8 lg:space-y-0">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isLeft = index % 2 === 0;

                  return (
                    <li
                      key={step.label}
                      className={`relative pl-16 md:pl-20 lg:grid lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] lg:items-center lg:gap-0 lg:pl-0 ${
                        index > 0 ? 'lg:-mt-2' : ''
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className={`absolute left-12 top-11 h-px w-4 bg-gradient-to-r from-accent/70 to-accent/10 md:w-8 lg:left-6 lg:top-9 lg:w-10 ${
                          isLeft ? 'lg:left-[calc(50%-84px)]' : 'lg:left-[calc(50%+44px)]'
                        }`}
                      />
                      <div
                        aria-hidden="true"
                        className="absolute left-6 top-5 z-10 grid size-12 -translate-x-1/2 place-items-center rounded-full border border-accent/80 bg-[#0b0b0b] font-display text-sm font-bold text-accent shadow-[0_0_0_8px_rgba(200,150,66,0.08),0_0_24px_rgba(200,150,66,0.28)] lg:left-1/2"
                      >
                        {index + 1}
                      </div>

                      <article
                        className={`group relative rounded-xl border border-white/12 bg-[linear-gradient(145deg,rgba(30,30,30,0.96),rgba(12,12,12,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.36)] transition duration-200 hover:border-accent/55 sm:p-6 lg:w-[92%] ${
                          isLeft ? 'lg:col-start-1 lg:mr-auto' : 'lg:col-start-3 lg:ml-auto'
                        }`}
                      >
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_18%_0%,rgba(200,150,66,0.12),transparent_32%)] opacity-70"
                        />
                        <div className="relative flex items-start gap-4">
                          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent transition group-hover:border-accent/70 group-hover:bg-accent/15">
                            <Icon aria-hidden="true" focusable="false" className="size-7 stroke-[1.55]" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{step.label}</p>
                            <h3 className="mt-2 text-xl font-bold leading-snug text-white">{step.title}</h3>
                            <p className="mt-3 text-sm leading-6 text-white/72 sm:text-[15px] sm:leading-7">
                              {step.text}
                            </p>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="relative mt-14 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,rgba(28,28,28,0.98),rgba(8,8,8,0.98))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:px-8 sm:py-10 lg:mt-16 lg:px-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(200,150,66,0.18),transparent_38%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent/30 via-accent to-accent/30"
            />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)] lg:items-center lg:gap-10">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
                  Готові передати нам запит?
                </h2>
                <p className="mt-4 text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                  Надішліть артикул, список, фото або короткий опис потреби. Менеджер уточнить деталі та
                  запропонує сумісне рішення.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:min-w-[320px] lg:flex-col lg:justify-self-end xl:flex-row">
                <Link
                  href="/request"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:w-auto"
                >
                  <ActionIcon name="plus" className="h-4 w-4" />
                  Створити заявку
                </Link>
                <a
                  href={telegramBotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-primary/45 px-6 py-3.5 text-sm font-bold text-accent transition hover:border-accent/80 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:w-auto"
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
