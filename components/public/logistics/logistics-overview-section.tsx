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
        <div className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Kairos Logistics для агробізнесу
          </p>
          <h2
            id="logistics-overview-title"
            className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl"
          >
            Кому підходить сервіс і як він працює
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-public-muted sm:text-lg sm:leading-8">
            Коротко про клієнтів Kairos Logistics, ситуації, у яких потрібне перевезення, та шлях
            товару від заявки до логістичної бази в Кагарлику.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-public-border bg-public-card shadow-card lg:grid lg:grid-cols-3">
          <div className="p-5 sm:p-7 lg:p-8">
            <OverviewHeading icon={TbUsers}>Для кого створений сервіс</OverviewHeading>
            <p className="mt-5 text-base leading-7 text-public-muted">
              Kairos Logistics працює виключно для агропідприємств Кагарлицького району, щоб
              забезпечити максимальну швидкість організації відвантаження та доставки.
            </p>

            <div className="mt-6 space-y-4">
              {audienceDetails.map((detail) => {
                const Icon = detail.icon;

                return (
                  <div key={detail.title} className="flex items-start gap-3">
                    <Icon
                      aria-hidden="true"
                      focusable="false"
                      className="mt-1 size-5 shrink-0 text-accent"
                    />
                    <p className="min-w-0 text-base leading-6 text-public-muted">
                      <strong className="font-bold text-public-primary">{detail.title}</strong>
                      {' — '}
                      {detail.text}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 border-t border-public-border pt-5 text-base leading-7 text-public-subtle">
              Такий формат дозволяє нам забезпечувати швидкий сервіс без утримання великого
              автопарку та пропонувати прозорі тарифи.
            </p>
          </div>

          <div className="border-t border-public-border p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <OverviewHeading icon={TbClock}>Коли потрібен Kairos Logistics</OverviewHeading>

            <ul className="mt-6 space-y-5">
              {useCases.map((useCase) => {
                const Icon = useCase.icon;

                return (
                  <li key={useCase.text} className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-public-border-accent bg-accent/[0.08] text-accent">
                      <Icon aria-hidden="true" focusable="false" className="size-[22px]" />
                    </span>
                    <p className="min-w-0 pt-1 text-base leading-7 text-public-secondary">{useCase.text}</p>
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
                  <li key={step} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                    <span aria-hidden="true" className="flex min-h-[4.75rem] flex-col items-center">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-display text-base font-bold text-primary">
                        {index + 1}
                      </span>
                      {!isLast ? <span className="my-1 w-px flex-1 bg-accent/40" /> : null}
                    </span>
                    <p className={`min-w-0 pt-1 text-base leading-7 text-public-secondary ${isLast ? '' : 'pb-5'}`}>
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
      <h3 className="min-w-0 pt-0.5 text-2xl font-bold leading-8 text-public-primary">{children}</h3>
    </div>
  );
}
