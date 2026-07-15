import Image from 'next/image';
import Link from 'next/link';
import { TbGauge, TbReportMoney, TbShieldCheck, TbTruckDelivery } from 'react-icons/tb';

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
    title: 'Створіть особистий кабінет',
    text: 'Додайте реквізити компанії та сформуйте парк своєї техніки. Це дозволить автоматично накопичувати історію замовлень, запчастин і документів для кожної машини.'
  },
  {
    title: 'Створіть заявку',
    text: 'Оберіть техніку зі свого парку або оформіть разову заявку без привʼязки до техніки. Додайте артикул, список, фото або опис потреби.'
  },
  {
    title: 'Менеджер опрацьовує заявку',
    text: 'Уточнюємо деталі, перевіряємо сумісність та аналізуємо доступні варіанти.'
  },
  {
    title: 'Підбираємо рішення',
    text: 'Підбираємо оригінальні запчастини та аналоги серед перевірених постачальників і формуємо комерційну пропозицію.'
  },
  {
    title: 'Узгодження та оплата',
    text: 'Погоджуємо склад замовлення, терміни, спосіб доставки та формуємо рахунок.'
  },
  {
    title: 'Комплектація та доставка',
    text: 'Консолідуємо замовлення та організовуємо відправку у погоджений термін.'
  },
  {
    title: 'Історія оновлюється автоматично',
    text: 'Якщо замовлення оформлено для техніки з вашого парку, платформа автоматично збереже історію запчастин, каталожні номери, рахунки та документи.'
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

      <section className="bg-public-page py-16">
        <div className="kp-container">
          <div className="grid gap-4 lg:grid-cols-2">
            {steps.map((step, index) => (
            <article key={step.title} className="public-card p-6">
                <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md border border-public-border-accent bg-public-page font-display text-sm font-bold text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Крок {index + 1}</p>
                <h2 className="mt-2 text-xl font-bold text-public-primary">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-public-muted">{step.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        <div className="public-card mt-10 p-6 text-center">
          <h2 className="text-2xl font-bold text-public-primary">Почніть із одного запиту</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-public-muted">
              Опишіть потребу у зручному форматі. Менеджер Kairos Parts звʼяжеться для уточнення деталей.
            </p>
            <Link
              href="/request"
            className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Створити заявку
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
