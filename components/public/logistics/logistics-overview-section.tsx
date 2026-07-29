import type { IconType } from 'react-icons';
import {
  TbBuildingWarehouse,
  TbClock,
  TbDroplet,
  TbMapPin,
  TbPackage,
  TbSettings,
  TbTractor,
  TbTruckDelivery,
  TbUsers
} from 'react-icons/tb';

const audienceDetails = [
  {
    title: 'Клієнти',
    text: 'агропідприємства Кагарлицької громади',
    icon: TbMapPin
  },
  {
    title: 'Відвантаження товару',
    text: 'у постачальників у межах Київської області',
    icon: TbBuildingWarehouse
  },
  {
    title: 'Доставка',
    text: 'до логістичної бази Kairos Parts у Кагарлику',
    icon: TbMapPin
  }
];

const useCases = [
  {
    text: 'Коли техніка вийшла з ладу і терміново потрібні запчастини або матеріали.',
    icon: TbTractor
  },
  {
    text: 'Коли не вистачило ЗЗР, мастильних матеріалів або комплектуючих.',
    icon: TbDroplet
  },
  {
    text: 'Коли власний транспорт зайнятий або недоцільно організовувати окрему поїздку за одним замовленням.',
    icon: TbTruckDelivery
  },
  {
    text: 'Коли потрібно оперативно отримати товар у постачальника.',
    icon: TbPackage
  }
];

const processSteps = [
  'Ви створюєте заявку на перевезення.',
  'Ми уточнюємо деталі, погоджуємо маршрут і вартість.',
  'Організовуємо відвантаження та забираємо підготовлений товар у постачальника.',
  'Доставляємо товар до логістичної бази Kairos Parts у Кагарлику.'
];

export function LogisticsOverviewSection() {
  return (
    <section
      aria-labelledby="logistics-overview-title"
      className="relative overflow-hidden bg-public-section py-16 sm:py-20 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(200,150,66,0.09),transparent_34%)]" />
      <div className="kp-container relative">
        <h2 id="logistics-overview-title" className="sr-only">
          Огляд сервісу Kairos Logistics
        </h2>

        <div className="overflow-hidden rounded-xl border border-public-border bg-public-card shadow-card lg:grid lg:grid-cols-3">
          <div className="p-5 sm:p-7 lg:p-8">
            <OverviewHeading icon={TbUsers}>Для кого створений сервіс</OverviewHeading>
            <p className="mt-5 text-sm leading-6 text-public-muted">
              Kairos Logistics працює для агропідприємств Кагарлицької громади, яким потрібно
              забрати товари у постачальників у межах Київської області та доставити їх до
              логістичної бази Kairos Parts у Кагарлику.
            </p>

            <div className="mt-6 space-y-4">
              {audienceDetails.map((detail) => {
                const Icon = detail.icon;

                return (
                  <div key={detail.title} className="flex items-start gap-3">
                    <Icon
                      aria-hidden="true"
                      focusable="false"
                      className="mt-0.5 size-5 shrink-0 text-accent"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-5 text-public-primary">{detail.title}</p>
                      <p className="mt-1 text-sm leading-5 text-public-muted">{detail.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 border-t border-public-border pt-5 text-sm leading-6 text-public-subtle">
              Такий формат дозволяє замовляти товари без окремої поїздки власного транспорту та
              заздалегідь розуміти вартість перевезення.
            </p>
          </div>

          <div className="border-t border-public-border p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <OverviewHeading icon={TbClock}>Коли потрібен Kairos Logistics</OverviewHeading>

            <ul className="mt-6 space-y-5">
              {useCases.map((useCase) => {
                const Icon = useCase.icon;

                return (
                  <li key={useCase.text} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-public-border-accent bg-accent/[0.08] text-accent">
                      <Icon aria-hidden="true" focusable="false" className="size-5" />
                    </span>
                    <p className="min-w-0 pt-1 text-sm leading-6 text-public-secondary">{useCase.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-public-border p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <OverviewHeading icon={TbSettings}>Як працює сервіс</OverviewHeading>

            <ol className="mt-6 space-y-0">
              {processSteps.map((step, index) => {
                const isLast = index === processSteps.length - 1;

                return (
                  <li key={step} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                    <span aria-hidden="true" className="flex min-h-[4.25rem] flex-col items-center">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      {!isLast ? <span className="my-1 w-px flex-1 bg-accent/40" /> : null}
                    </span>
                    <p className={`min-w-0 pt-1 text-sm leading-6 text-public-secondary ${isLast ? '' : 'pb-5'}`}>
                      {step}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewHeading({ icon: Icon, children }: { icon: IconType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-public-border-accent bg-accent/[0.08] text-accent">
        <Icon aria-hidden="true" focusable="false" className="size-6" />
      </span>
      <h3 className="min-w-0 pt-1 text-xl font-bold leading-7 text-public-primary">{children}</h3>
    </div>
  );
}
