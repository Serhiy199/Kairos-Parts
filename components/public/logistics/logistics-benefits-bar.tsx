import type { IconType } from 'react-icons';
import { TbClock, TbMapPin, TbPackage, TbShieldCheck } from 'react-icons/tb';

type LogisticsBenefit = {
  title: string;
  description: string;
  icon: IconType;
};

const logisticsBenefits: LogisticsBenefit[] = [
  {
    title: 'Швидко',
    description: 'Організація відвантаження в день звернення',
    icon: TbClock
  },
  {
    title: 'Надійно',
    description: 'Контроль кожного перевезення',
    icon: TbShieldCheck
  },
  {
    title: 'Просто',
    description: 'Фіксована ціна без прихованих умов',
    icon: TbPackage
  },
  {
    title: 'Локально',
    description: 'Працюємо для аграріїв Кагарлицького району',
    icon: TbMapPin
  }
];

const dividerClasses = [
  'border-b border-public-border sm:border-b lg:border-b-0',
  'border-b border-public-border sm:border-l lg:border-b-0',
  'border-b border-public-border sm:border-b-0 lg:border-l',
  'sm:border-l sm:border-public-border'
];

export function LogisticsBenefitsBar() {
  return (
    <section
      aria-labelledby="logistics-benefits-bar-title"
      className="border-y border-white/10 bg-[#080a0d] py-5 text-white sm:py-6"
    >
      <div className="kp-container">
        <h2 id="logistics-benefits-bar-title" className="sr-only">
          Переваги Kairos Logistics
        </h2>

        <div className="overflow-hidden rounded-xl border border-public-border bg-public-card">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {logisticsBenefits.map((benefit, index) => {
              const Icon = benefit.icon;

              return (
                <article
                  key={benefit.title}
                  className={`flex min-w-0 items-start gap-4 px-5 py-5 sm:px-6 sm:py-6 lg:px-7 ${dividerClasses[index]}`}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border border-accent/55 bg-accent/[0.07] text-accent">
                    <Icon aria-hidden="true" focusable="false" className="size-7 stroke-[1.6]" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-base font-bold leading-6 text-accent">{benefit.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-public-secondary">{benefit.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
