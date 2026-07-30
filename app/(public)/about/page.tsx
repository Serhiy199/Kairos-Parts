import Image from 'next/image';
import Link from 'next/link';
import {
  TbAlertTriangle,
  TbArrowsDiff,
  TbDatabaseCog,
  TbDeviceDesktop,
  TbFileSpreadsheet,
  TbHeartHandshake,
  TbHistory,
  TbReplace,
  TbSettings,
  TbSettingsSearch,
  TbTargetArrow,
  TbTractor,
  TbTruckDelivery,
  TbZoomQuestion
} from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';
const showCompanySection = false;
const showContactScenarios = false;

const contactScenarios = [
  {
    title: 'Техніка простоює',
    text: 'Потрібна деталь для термінового ремонту, а кожен день простою впливає на роботу підприємства.',
    icon: TbAlertTriangle
  },
  {
    title: 'Оригінал недоступний',
    text: 'Шукаємо сумісний і перевірений аналог, коли оригінальна запчастина відсутня або має неприйнятний строк постачання.',
    icon: TbReplace
  },
  {
    title: 'Невідомий точний номер деталі',
    text: 'Допомагаємо визначити потрібну позицію за моделлю техніки, серійним номером, фото, шильдиком або описом вузла.',
    icon: TbZoomQuestion
  },
  {
    title: 'Потрібно зібрати великий список',
    text: 'Опрацьовуємо Excel, PDF, DOC або перелік позицій і формуємо одне структуроване рішення для закупівлі.',
    icon: TbFileSpreadsheet
  },
  {
    title: 'Постачальники пропонують різні варіанти',
    text: 'Перевіряємо характеристики, сумісність і відмінності між пропозиціями, щоб обрати обґрунтоване рішення.',
    icon: TbArrowsDiff
  },
  {
    title: 'Потрібна закупівля для кількох машин',
    text: 'Допомагаємо сформувати комплексний запит для різних одиниць техніки та не змішати запчастини між машинами.',
    icon: TbTractor
  },
  {
    title: 'Потрібно повторити старе замовлення',
    text: 'Знаходимо попередньо підібрані позиції, каталожні номери й документи та використовуємо їх для нового запиту.',
    icon: TbHistory
  },
  {
    title: 'Потрібно впорядкувати історію техніки',
    text: 'Зберігаємо заявки, запчастини, рахунки та документи в історії конкретних машин для подальшого обслуговування.',
    icon: TbDatabaseCog
  }
];

const audiences = [
  {
    title: 'Запчастини',
    text: 'Професійний підбір та постачання запасних частин, мастильних матеріалів, технічних рідин і комплектуючих для сільськогосподарської та комерційної техніки.',
    bullets: [
      'Широка мережа постачальників',
      'Оптимальне рішення за ціною, якістю та термінами поставки',
      'Швидкий підбір під конкретну техніку'
    ],
    icon: TbSettings,
    image: '/images/advantages/benefit-2.png',
    href: undefined
  },
  {
    title: 'Логістика',
    text: 'Власний логістичний сервіс доставки товарів від будь-яких постачальників безпосередньо до господарства або до точки видачі Kairos.',
    bullets: [
      'Доставка насіння, ЗЗР, добрив, запчастин та інших вантажів',
      'Економія транспорту та часу підприємства',
      'Пілотний проєкт у Кагарлицькому районі Київської області'
    ],
    icon: TbTruckDelivery,
    image: '/images/logistics/logistics-delivery.jpg',
    href: '/logistics'
  },
  {
    title: 'Електронний парк техніки',
    text: 'Кожен зареєстрований клієнт отримує власний кабінет, у якому може сформувати електронний парк техніки підприємства.',
    bullets: [
      'Історія звернень і замовлень для кожної одиниці техніки',
      'Збереження підібраних запасних частин',
      'Майбутній функціонал для швидкого підбору та регулярних закупівель'
    ],
    icon: TbDeviceDesktop,
    image: '/images/about/service-equipment-fleet.jpg',
    href: undefined
  },
  {
    title: 'Майданчик Б/В техніки',
    text: 'Партнерський майданчик для купівлі та продажу сільськогосподарської і комерційної техніки.',
    bullets: [
      'Розміщуйте власну техніку',
      'Знаходьте перевірені пропозиції',
      'Укладайте угоди в екосистемі Kairos серед клієнтів і партнерів'
    ],
    icon: TbHeartHandshake,
    image: '/images/about/service-used-equipment.jpg',
    href: '/used-equipment'
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
        <div className="absolute inset-0 bg-primary/10" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.96)_0%,rgba(5,7,10,0.9)_68%,rgba(5,7,10,0.62)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,10,0.98)_0%,rgba(5,7,10,0.92)_28%,rgba(5,7,10,0.68)_42%,rgba(5,7,10,0.2)_60%,rgba(5,7,10,0.04)_76%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.04)_48%,rgba(5,7,10,0.52)_100%)]" />

        <div className="kp-container relative flex min-h-[620px] items-center py-16 sm:min-h-[640px] sm:py-20 lg:min-h-[680px]">
          <div className="max-w-[760px]">
            <p className="max-w-[500px] text-sm font-semibold uppercase leading-6 tracking-[0.2em] text-accent sm:text-base sm:leading-7">
              Kairos Parts — сервіс для B2B-клієнтів аграрної та транспортної галузі
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.04] sm:text-[64px] lg:text-[76px]">
              Про Kairos Parts
            </h1>
            <p className="mt-7 max-w-[510px] text-xl font-semibold leading-8 text-white/90 sm:text-[22px] sm:leading-9">
              Ми створюємо цифрову екосистему сервісів, яка допомагає аграрному бізнесу економити час,
              зменшувати витрати та працювати ефективніше.
            </p>
            <p className="mt-5 max-w-[510px] text-lg leading-8 text-white/75 sm:text-xl sm:leading-9">
              Усі рішення — від підбору запчастин до доставки та управління технікою — в одному цифровому
              середовищі.
            </p>
          </div>
        </div>
      </section>

      {showCompanySection ? (
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
      ) : null}

      {showContactScenarios ? (
        <section className="bg-public-page py-16 text-white sm:py-20">
          <div className="kp-container">
            <div className="max-w-[760px]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Коли звертатися</p>
              <h2 className="mt-3 max-w-[740px] text-3xl font-bold leading-tight text-white sm:text-4xl">
                Ситуації, у яких важливо швидко знайти правильне рішення
              </h2>
              <p className="mt-4 max-w-[740px] text-base font-medium leading-7 text-white/72 sm:text-lg sm:leading-8">
                Kairos Parts допомагає, коли техніка не може чекати, даних для підбору недостатньо або закупівля
                потребує координації кількох позицій і постачальників.
              </p>
              <div className="mt-5 h-px w-20 bg-accent" />
            </div>

            <ul className="relative mt-10 grid grid-cols-1 overflow-hidden rounded-2xl border border-public-border bg-public-card md:grid-cols-2 xl:auto-rows-fr xl:grid-cols-4">
              {contactScenarios.map((item, index) => {
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
      ) : null}

      <section className="relative isolate w-full overflow-hidden bg-public-section py-16 text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(200,150,66,0.1),transparent_32%),linear-gradient(135deg,rgba(11,14,20,1),rgba(5,7,10,1))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(152,157,166,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(152,157,166,0.4)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="kp-container relative">
          <div className="max-w-[900px]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
              Наші сервіси
            </p>
            <h2 className="mt-3 max-w-[980px] text-[28px] font-bold leading-[1.12] text-white sm:text-[34px] lg:text-[40px]">
              Комплексні рішення для щоденних задач вашого бізнесу
            </h2>
            <div className="mt-5 h-px w-20 bg-accent" />
          </div>

          <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            {audiences.map((audience) => {
              const Icon = audience.icon;
              const cardContent = (
                <>
                  <div className="relative aspect-[3/2] overflow-hidden border-b border-public-border">
                    <Image
                      src={audience.image}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.02)_45%,rgba(5,7,10,0.72)_100%)]" />
                  </div>

                  <div className="relative -mt-7 px-6">
                    <span className="grid size-14 place-items-center rounded-lg border border-accent/60 bg-accent text-primary shadow-panel">
                      <Icon aria-hidden="true" focusable="false" className="size-8 stroke-[1.65]" />
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col px-5 pb-7 pt-5 sm:px-6 sm:pb-8">
                    <h3 className="text-xl font-bold leading-tight text-public-primary xl:text-[21px]">
                      {audience.title}
                    </h3>
                    <p className="mt-4 text-sm leading-6 text-public-muted xl:text-[15px]">
                      {audience.text}
                    </p>

                    <ul className="mt-6 space-y-3">
                      {audience.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-3 text-sm leading-6 text-public-secondary"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              );

              const cardClassName =
                'group flex min-w-0 flex-col overflow-hidden rounded-xl border border-public-border bg-public-card transition duration-200 hover:-translate-y-1 hover:border-public-border-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';

              return audience.href ? (
                <Link
                  key={audience.title}
                  href={audience.href}
                  aria-label={`Перейти до сервісу «${audience.title}»`}
                  className={`${cardClassName} cursor-pointer`}
                >
                  {cardContent}
                </Link>
              ) : (
                <article key={audience.title} className={cardClassName}>
                  {cardContent}
                </article>
              );
            })}
          </div>

          <div className="relative mt-16 overflow-hidden rounded-2xl border border-public-border bg-[linear-gradient(135deg,rgba(16,21,28,0.99),rgba(7,10,14,0.99))] shadow-[0_24px_70px_rgba(0,0,0,0.3)] lg:min-h-[500px]">
            <div className="pointer-events-none absolute inset-y-0 left-[23%] hidden w-[43%] lg:block">
              <Image
                src="/images/about/vision-mission-platform.png"
                alt=""
                fill
                sizes="43vw"
                className="scale-[1.5] object-contain object-center opacity-95 [mask-image:radial-gradient(ellipse_82%_76%_at_50%_50%,black_62%,transparent_100%)]"
              />
            </div>

            <div className="relative grid lg:min-h-[500px] lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
              <article className="relative z-10 flex flex-col justify-center px-6 py-9 sm:px-9 sm:py-11 md:min-h-[520px] lg:min-h-0 lg:px-10 lg:py-14 xl:px-12">
                <div className="max-w-[390px]">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent sm:text-sm">
                    Наше бачення
                  </p>
                  <h2 className="mt-5 text-2xl font-medium leading-[1.35] text-public-primary sm:text-[28px]">
                    Єдина екосистема сервісів для аграрного бізнесу
                  </h2>
                  <div className="mt-7 h-0.5 w-10 bg-accent" />
                  <p className="mt-7 max-w-[300px] text-base leading-8 text-public-muted lg:max-w-[280px] xl:max-w-[300px]">
                    Ми будуємо платформу, яка допомагає підприємствам швидко знаходити запчастини,
                    організовувати доставку, керувати власним парком техніки та користуватися сучасними
                    цифровими інструментами для щоденної роботи.
                  </p>
                </div>
              </article>

              <div className="relative min-h-[280px] overflow-hidden border-y border-public-border sm:min-h-[380px] md:absolute md:right-[-4%] md:top-0 md:h-[520px] md:min-h-0 md:w-[72%] md:border-0 lg:hidden">
                <Image
                  src="/images/about/vision-mission-platform.png"
                  alt=""
                  fill
                  sizes="100vw"
                  className="scale-[1.18] object-contain object-center [mask-image:linear-gradient(180deg,transparent_0%,black_10%,black_90%,transparent_100%)] md:scale-[1.45]"
                />
              </div>

              <article className="relative z-10 col-span-1 flex flex-col justify-center bg-[#0d1219]/92 px-6 py-9 sm:px-9 sm:py-11 lg:border-l lg:border-public-border lg:px-8 lg:py-14 xl:px-10">
                <div className="max-w-[390px]">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent sm:text-sm">
                    Наша місія
                  </p>
                  <h2 className="mt-5 text-2xl font-medium leading-[1.35] text-public-primary sm:text-[28px]">
                    Спростити операційну діяльність аграрних підприємств
                  </h2>
                  <div className="mt-7 h-0.5 w-10 bg-accent" />
                  <p className="mt-7 text-base leading-8 text-public-muted">
                    Поєднуючи постачання, логістику та цифрові сервіси в одному зручному просторі. Ми
                    допомагаємо аграріям економити час, ресурси та зосереджуватися на розвитку свого
                    бізнесу.
                  </p>
                </div>
              </article>
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
