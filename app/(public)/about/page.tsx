import Image from 'next/image';
import Link from 'next/link';
import { TbDatabaseCog, TbGauge, TbHeartHandshake, TbSettingsSearch, TbShieldCheck } from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const platformItems = [
  'професійний підбір запчастин',
  'пошук оригіналів і аналогів',
  'роботу з кількома постачальниками одночасно',
  'консолідовану доставку',
  'персональний супровід менеджера',
  'особистий кабінет компанії',
  'цифрову історію парку техніки'
];

const audiences = [
  'аграрні підприємства',
  'фермерські господарства',
  'транспортні компанії',
  'будівельні підприємства',
  'сервісні центри',
  'підприємства з власним парком техніки'
];

const principles = [
  {
    title: 'Швидкість',
    text: 'Мінімізуємо час від заявки до отримання комерційної пропозиції.',
    icon: TbGauge
  },
  {
    title: 'Надійність',
    text: 'Працюємо лише з перевіреними постачальниками.',
    icon: TbShieldCheck
  },
  {
    title: 'Професійність',
    text: 'Підбираємо запчастини з урахуванням каталожних номерів, сумісності та потреб клієнта.',
    icon: TbSettingsSearch
  },
  {
    title: 'Цифровізація',
    text: 'Кожне замовлення автоматично формує цифрову історію техніки та компанії.',
    icon: TbDatabaseCog
  },
  {
    title: 'Довгострокове партнерство',
    text: 'Будуємо відносини, засновані на сервісі, а не лише на разовому продажі.',
    icon: TbHeartHandshake
  }
];

export default function AboutPage() {
  return (
    <>
      <section className="relative isolate min-h-[620px] overflow-hidden bg-primary text-white sm:min-h-[640px] lg:min-h-[680px]">
        <Image
          src="/images/about/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[66%_center] sm:object-[62%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-primary/25" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.95)_0%,rgba(5,7,10,0.88)_62%,rgba(5,7,10,0.68)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,10,0.94)_0%,rgba(5,7,10,0.82)_44%,rgba(5,7,10,0.42)_72%,rgba(5,7,10,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.08)_55%,rgba(5,7,10,0.88)_100%)]" />

        <div className="kp-container relative flex min-h-[620px] items-center py-16 sm:min-h-[640px] sm:py-20 lg:min-h-[680px]">
          <div className="max-w-[760px]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
              Про Kairos Parts
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.06] sm:text-5xl lg:text-[56px]">
              Будуємо новий стандарт
              <span className="mt-1 block">
                підбору запчастин <span className="text-accent">для бізнесу</span>
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-white/90 sm:text-xl">
              Єдиний сервіс для підбору, погодження та постачання запчастин.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Kairos Parts об’єднує професійний підбір, роботу з перевіреними постачальниками та цифрову
              історію техніки в одному B2B-процесі.
            </p>
            <Link
              href="/request"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-center text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            >
              <ActionIcon name="plus" />
              Створити заявку
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-public-page py-16">
        <div className="kp-container grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="public-card p-6">
            <p className="text-sm font-bold uppercase text-accent">Наша місія</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Спростити обслуговування техніки</h2>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Наша мета — зробити процес закупівлі запчастин швидким, прозорим та системним, щоб підприємства
              витрачали менше часу на пошук деталей і більше — на свою основну діяльність.
            </p>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Ми надаємо підприємствам єдину платформу для оперативного підбору, закупівлі та накопичення
              історії запчастин по кожній одиниці техніки.
            </p>
          </article>
          <article className="public-card p-6">
            <p className="text-sm font-bold uppercase text-accent">Що ми робимо</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Не магазин, а центр підбору</h2>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Kairos Parts працює як центр підбору та постачання запчастин, де клієнт створює одну заявку,
              а наша команда знаходить оптимальне рішення серед перевірених постачальників.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-public-section py-16">
        <div className="kp-container">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase text-accent">Платформа обʼєднує</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Один процес замість десятків ручних дій</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {platformItems.map((item) => (
              <div key={item} className="rounded-md border border-public-border bg-public-card px-4 py-3 text-sm font-semibold text-public-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-public-page py-16">
        <div className="kp-container grid gap-6 lg:grid-cols-2">
          <article className="public-card p-6">
            <p className="text-sm font-bold uppercase text-accent">Чому це працює</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Кожне замовлення створює цінність на майбутнє</h2>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Платформа автоматично накопичує історію придбаних запчастин для кожної одиниці техніки,
              зареєстрованої в особистому кабінеті. З кожним новим замовленням підприємство отримує
              структуровану базу даних свого парку без додаткового введення інформації.
            </p>
          </article>
          <article className="public-card p-6">
            <p className="text-sm font-bold uppercase text-accent">Наш підхід</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Сервіс навколо потреб клієнта</h2>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Ми не змушуємо шукати запчастини серед тисяч товарів, самостійно перевіряти сумісність
              або повторно вводити однакові дані. Ми беремо на себе підбір, комунікацію з постачальниками
              та організацію поставки, а платформа систематизує інформацію про кожне замовлення.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-primary py-16 text-white">
        <div className="kp-container">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase text-accent">Для кого створено Kairos Parts</p>
              <h2 className="mt-2 text-3xl font-bold">Для компаній із технікою, яка має працювати щодня</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {audiences.map((item) => (
                <div key={item} className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-sidebar-text">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-page py-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(152,157,166,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(152,157,166,0.45)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="kp-container relative">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-accent">Наші принципи</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">Працюємо як довгостроковий сервісний партнер</h2>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-public-border bg-public-card">
            <div className="grid divide-y divide-public-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
              {principles.map((principle) => {
                const Icon = principle.icon;

                return (
                  <article
                    key={principle.title}
                    className="min-w-0 px-8 py-10 transition-colors duration-200 hover:bg-public-elevated sm:px-10 lg:px-6"
                  >
                    <div className="flex items-start gap-3 lg:flex-col">
                      <div className="shrink-0 text-accent">
                        <Icon aria-hidden="true" focusable="false" className="size-10 stroke-[1.7] sm:size-12" />
                      </div>
                      <h3 className="min-w-0 flex-1 break-normal whitespace-normal hyphens-none text-left text-xl font-bold leading-tight text-public-primary lg:text-base xl:text-xl">
                        {principle.title}
                      </h3>
                    </div>
                    <p className="mt-5 w-full max-w-56 text-base font-medium leading-7 text-public-muted">
                      {principle.text}
                    </p>
                  </article>
                );
              })}
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
