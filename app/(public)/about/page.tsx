import Image from 'next/image';
import Link from 'next/link';
import {
  TbBuildingFactory2,
  TbBuildingWarehouse,
  TbDatabaseCog,
  TbDeviceDesktopAnalytics,
  TbGauge,
  TbHeartHandshake,
  TbHistory,
  TbLayoutDashboard,
  TbSearch,
  TbSettingsSearch,
  TbShieldCheck,
  TbTargetArrow,
  TbTools,
  TbTractor,
  TbTruck,
  TbTruckDelivery,
  TbUserCheck,
  TbWheat
} from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const platformItems = [
  {
    title: 'Професійний підбір запчастин',
    text: 'Перевіряємо каталожні номери, сумісність і технічні параметри.',
    icon: TbSettingsSearch
  },
  {
    title: 'Пошук оригіналів і аналогів',
    text: 'Порівнюємо доступні оригінальні деталі та перевірені альтернативи.',
    icon: TbSearch
  },
  {
    title: 'Робота з кількома постачальниками',
    text: 'Одночасно опрацьовуємо пропозиції від різних партнерів.',
    icon: TbBuildingWarehouse
  },
  {
    title: 'Консолідована доставка',
    text: 'Об’єднуємо позиції в одне погоджене відправлення.',
    icon: TbTruckDelivery
  },
  {
    title: 'Персональний супровід менеджера',
    text: 'Один менеджер веде заявку від уточнення до передачі замовлення.',
    icon: TbUserCheck
  },
  {
    title: 'Особистий кабінет компанії',
    text: 'Заявки, документи та техніка зібрані в одному робочому просторі.',
    icon: TbLayoutDashboard
  },
  {
    title: 'Цифрова історія парку техніки',
    text: 'Замовлення, запчастини та документи зберігаються по кожній машині.',
    icon: TbDatabaseCog
  },
  {
    title: 'Повторне замовлення за історією',
    text: 'Попередні запчастини та каталожні номери доступні для швидкого повторного запиту.',
    icon: TbHistory
  }
];

const audiences = [
  {
    title: 'Аграрні підприємства',
    text: 'Допомагаємо підтримувати трактори, комбайни та іншу сільськогосподарську техніку в робочому стані протягом сезону.',
    icon: TbTractor
  },
  {
    title: 'Фермерські господарства',
    text: 'Швидко підбираємо потрібні запчастини, щоб зменшити простої техніки під час критичних польових робіт.',
    icon: TbWheat
  },
  {
    title: 'Транспортні компанії',
    text: 'Підбираємо деталі для вантажного транспорту, причепів і комерційної техніки з урахуванням сумісності.',
    icon: TbTruck
  },
  {
    title: 'Будівельні підприємства',
    text: 'Допомагаємо знаходити запчастини для спеціальної та будівельної техніки, яка щодня працює на об’єктах.',
    icon: TbBuildingFactory2
  },
  {
    title: 'Сервісні центри',
    text: 'Забезпечуємо СТО та ремонтні майстерні сумісними деталями для швидкого обслуговування техніки клієнтів.',
    icon: TbTools
  },
  {
    title: 'Підприємства з власним парком техніки',
    text: 'Об’єднуємо техніку, заявки, запчастини, документи та історію замовлень в одному цифровому просторі.',
    icon: TbDeviceDesktopAnalytics
  }
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

      <section className="relative overflow-hidden bg-public-page py-16 text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(200,150,66,0.12),transparent_30%),linear-gradient(135deg,rgba(16,18,22,0.98),rgba(7,9,13,1))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(232,232,232,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.55)_1px,transparent_1px)] [background-size:36px_36px]" />

        <div className="kp-container relative">
          <div className="max-w-[760px]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Про компанію</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[42px]">
              Сервіс, створений навколо потреб бізнесу
            </h2>
            <p className="mt-4 max-w-[720px] text-base font-medium leading-7 text-white/72 sm:text-lg sm:leading-8">
              Ми поєднуємо професійний підбір запчастин, роботу з постачальниками та цифрові інструменти для
              управління історією техніки.
            </p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <div className="mt-10 grid overflow-hidden rounded-[22px] border border-accent/25 bg-[linear-gradient(135deg,rgba(24,27,32,0.96),rgba(10,12,16,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.38)] lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:items-stretch">
            <div className="relative min-h-[320px] overflow-hidden border-b border-accent/20 sm:min-h-[400px] lg:col-start-2 lg:row-start-1 lg:min-h-[620px] lg:border-b-0 lg:border-l">
              <Image
                src="/images/about/mission-bg.png"
                alt=""
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover object-[58%_center] sm:object-[62%_center] lg:object-[57%_center]"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.04),rgba(5,7,10,0.28))] lg:bg-[linear-gradient(90deg,rgba(5,7,10,0.34),rgba(5,7,10,0.02)_32%,rgba(5,7,10,0.12))]" />
            </div>

            <div className="px-6 py-9 sm:px-10 sm:py-11 lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-14">
              <article>
                <div className="flex items-start gap-4">
                  <TbTargetArrow
                    aria-hidden="true"
                    focusable="false"
                    className="size-10 shrink-0 stroke-[1.6] text-accent sm:size-12"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Наша місія</p>
                    <h3 className="mt-2 break-normal text-2xl font-bold leading-tight text-white sm:text-[28px]">
                      Спростити обслуговування техніки
                    </h3>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-base leading-7 text-white/72 sm:text-[17px] sm:leading-8">
                  <p>
                    Наша мета — зробити процес закупівлі запчастин швидким, прозорим та системним, щоб
                    підприємства витрачали менше часу на пошук деталей і більше — на свою основну діяльність.
                  </p>
                  <p>
                    Ми надаємо підприємствам єдину платформу для оперативного підбору, закупівлі та накопичення
                    історії запчастин по кожній одиниці техніки.
                  </p>
                </div>
              </article>

              <div className="my-8 h-px bg-gradient-to-r from-accent/70 via-accent/25 to-transparent sm:my-10" />

              <article>
                <div className="flex items-start gap-4">
                  <TbSettingsSearch
                    aria-hidden="true"
                    focusable="false"
                    className="size-10 shrink-0 stroke-[1.6] text-accent sm:size-12"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Що ми робимо</p>
                    <h3 className="mt-2 break-normal text-2xl font-bold leading-tight text-white sm:text-[28px]">
                      Не магазин, а центр підбору
                    </h3>
                  </div>
                </div>
                <p className="mt-5 text-base leading-7 text-white/72 sm:text-[17px] sm:leading-8">
                  Kairos Parts працює як центр підбору та постачання запчастин, де клієнт створює одну заявку, а
                  наша команда знаходить оптимальне рішення серед перевірених постачальників.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-public-page py-16 text-white sm:py-20">
        <div className="kp-container">
          <div className="max-w-[760px]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Платформа обʼєднує</p>
            <h2 className="mt-3 max-w-[740px] text-3xl font-bold leading-tight text-white sm:text-4xl">
              Один процес замість десятків ручних дій
            </h2>
            <p className="mt-4 max-w-[740px] text-base font-medium leading-7 text-white/72 sm:text-lg sm:leading-8">
              Kairos Parts об’єднує підбір, роботу з постачальниками, супровід, доставку та цифрову історію
              техніки в одному процесі.
            </p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <ul className="relative mt-10 grid grid-cols-1 overflow-hidden rounded-2xl border border-public-border bg-public-card md:grid-cols-2 xl:auto-rows-fr xl:grid-cols-4">
            {platformItems.map((item, index) => {
              const Icon = item.icon;
              const dividerClasses = `${index < 7 ? 'border-b border-public-border' : ''} ${
                index % 2 === 0 ? 'md:border-r md:border-public-border' : ''
              } ${index >= 6 ? 'md:border-b-0' : ''} ${index < 4 ? 'xl:border-b xl:border-public-border' : 'xl:border-b-0'} ${
                index % 4 !== 3 ? 'xl:border-r xl:border-public-border' : 'xl:border-r-0'
              }`;

              return (
                <li
                  key={item.title}
                  className={`${dividerClasses} min-w-0 px-5 py-6 transition-colors duration-200 hover:bg-public-elevated sm:px-7 sm:py-8 xl:px-8`}
                >
                  <div className="flex items-start gap-4">
                    <Icon
                      aria-hidden="true"
                      focusable="false"
                      className="size-8 shrink-0 stroke-[1.65] text-accent sm:size-9"
                    />
                    <div className="min-w-0">
                      <h3 className="break-normal whitespace-normal hyphens-none text-lg font-bold leading-snug text-white xl:text-xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-[15px] font-medium leading-6 text-white/65 sm:text-base sm:leading-7">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            {[25, 50, 75].map((position) => (
              <span
                key={position}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 z-10 hidden size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1a1308]/40 bg-accent shadow-[0_1px_4px_rgba(0,0,0,0.35)] xl:block"
                style={{ left: `${position}%` }}
              />
            ))}
          </ul>
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

      <section className="relative isolate w-full overflow-hidden bg-[#050505] py-12 text-white sm:py-14 lg:py-16">
        <Image
          src="/images/about/for-companies-bg.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[64%_center] opacity-80 saturate-[0.88] sm:object-[58%_center] lg:object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-primary/30" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.84)_0%,rgba(5,5,5,0.66)_52%,rgba(5,5,5,0.52)_100%)] sm:bg-[linear-gradient(90deg,rgba(5,5,5,0.78)_0%,rgba(5,5,5,0.58)_58%,rgba(5,5,5,0.4)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.38)_0%,rgba(5,5,5,0.08)_32%,rgba(5,5,5,0.3)_78%,rgba(5,5,5,0.58)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_36%,rgba(200,150,66,0.1),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(232,232,232,0.75)_1px,transparent_1px),linear-gradient(90deg,rgba(232,232,232,0.75)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="kp-container relative z-10">
          <div className="max-w-[900px]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
              Для кого створено Kairos Parts
            </p>
            <h2 className="mt-2 max-w-[820px] text-[28px] font-bold leading-[1.08] text-white sm:text-[34px] lg:text-[38px]">
              Для компаній із технікою, яка має працювати щодня
            </h2>
            <p className="mt-3 max-w-[820px] text-sm font-semibold leading-6 text-technical-white sm:text-base sm:leading-7">
              Kairos Parts допомагає бізнесу швидко знаходити сумісні запчастини, зменшувати простої техніки та
              зберігати історію замовлень в одному цифровому просторі.
            </p>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <div className="mt-6 grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;

              return (
                <article key={audience.title} className="benefit-card">
                  <div className="benefit-card__diagonal" />
                  <div className="benefit-card__icon-wrap">
                    <Icon aria-hidden="true" focusable="false" />
                  </div>
                  <div className="benefit-card__content">
                    <div className="benefit-card__header">
                      <span className="benefit-card__number">{index + 1}</span>
                      <h3 className="benefit-card__title">{audience.title}</h3>
                    </div>
                    <p className="benefit-card__description">{audience.text}</p>
                  </div>
                </article>
              );
            })}
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
