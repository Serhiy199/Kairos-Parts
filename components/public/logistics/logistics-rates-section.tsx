import {
  TbBuildingWarehouse,
  TbCheck,
  TbMapPin,
  TbPackage,
  TbTruckDelivery
} from 'react-icons/tb';

import {
  formatLogisticsPrice,
  type LogisticsTariffClientItem
} from '@/lib/logistics/pricing-preview';
import { siteContacts } from '@/lib/site-contacts';

import { LogisticsOverviewPanel } from './logistics-overview-section';

const includedServices = [
  'Організація відвантаження у постачальника',
  'Забір підготовленого товару',
  'Перевезення до логістичної бази Kairos Parts у Кагарлику',
  'Вартість із ПДВ'
];

export function LogisticsRatesSection({
  tariffs
}: {
  tariffs: readonly LogisticsTariffClientItem[];
}) {
  return (
    <section
      aria-labelledby="logistics-rates-title"
      className="relative overflow-hidden bg-public-page py-16 sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.82] [background-image:radial-gradient(ellipse_at_16%_10%,rgba(200,150,66,0.24),transparent_48%),radial-gradient(ellipse_at_88%_92%,rgba(27,33,44,0.82),transparent_58%),linear-gradient(112deg,rgba(16,20,28,0.66),transparent_44%,rgba(7,9,13,0.58)),linear-gradient(180deg,rgba(11,14,20,0.24),transparent_24%,transparent_76%,rgba(11,14,20,0.28))] sm:opacity-[0.92] lg:opacity-100"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(152,157,166,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(152,157,166,0.45)_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div className="kp-container relative z-10">
        <div className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Тарифи на забір товарів
          </p>
          <h2
            id="logistics-rates-title"
            className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl"
          >
            Фіксовані тарифи на відвантаження та перевезення
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-public-muted sm:text-lg sm:leading-8">
            Відвантаження у постачальника та перевезення до логістичного хабу Kairos Parts у
            Кагарлику.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-2 xl:gap-8">
          <div className="min-w-0 overflow-hidden rounded-xl border border-public-border-accent bg-public-card shadow-[0_0_38px_rgba(200,150,66,0.16)]">
            <div className="overflow-hidden">
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  Фіксовані тарифи на доставку товарів від постачальника до бази Kairos Parts у
                  Кагарлику
                </caption>
                <colgroup>
                  <col />
                  <col className="w-[43%] sm:w-[38%]" />
                </colgroup>
                <thead className="bg-public-elevated">
                  <tr className="border-b border-public-border">
                    <th
                      scope="col"
                      className="px-4 py-4 text-[13px] font-bold uppercase leading-5 tracking-[0.1em] text-public-secondary sm:px-6 sm:text-sm"
                    >
                      <span className="block">Напрямок</span>
                      <span className="mt-1 block text-xs font-medium normal-case leading-5 tracking-normal text-public-muted sm:text-sm">
                        (пункт відвантаження)
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-4 text-right text-[13px] font-bold uppercase leading-5 tracking-[0.08em] text-accent sm:px-6 sm:text-sm"
                    >
                      <span className="block">Тариф до Kairos Parts</span>
                      <span className="mt-1 block text-xs font-medium normal-case leading-5 tracking-normal text-public-muted sm:text-sm">
                        включає ПДВ
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((tariff) => (
                    <tr
                      key={tariff.code}
                      className="border-b border-public-border"
                    >
                      <th
                        scope="row"
                        className="px-4 py-3 text-[15px] font-semibold leading-6 text-public-primary sm:px-6 sm:text-base"
                      >
                        <span className="flex min-w-0 items-start gap-2">
                          <TbMapPin
                            aria-hidden="true"
                            focusable="false"
                            className="mt-0.5 size-4 shrink-0 text-accent sm:size-[18px]"
                          />
                          <span className="min-w-0 break-words">
                            {tariff.name}
                          </span>
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[15px] font-bold leading-6 text-public-primary sm:px-6 sm:text-base">
                        {formatLogisticsPrice(tariff.priceMinorUnits)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-public-border bg-accent/[0.06] last:border-b-0">
                    <th
                      scope="row"
                      className="px-4 py-3 text-[15px] font-semibold leading-6 text-public-primary sm:px-6 sm:text-base"
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <TbMapPin
                          aria-hidden="true"
                          focusable="false"
                          className="mt-0.5 size-4 shrink-0 text-accent sm:size-[18px]"
                        />
                        <span className="min-w-0 break-words">
                          Інші населені пункти
                        </span>
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right text-[15px] font-bold leading-6 text-accent sm:px-6 sm:text-base">
                      Індивідуальний розрахунок
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-t border-public-border px-4 py-4 sm:px-6 sm:py-5">
              <p className="text-base leading-7 text-public-muted">
                Тариф включає відвантаження у постачальника та перевезення товару до логістичного хабу
                Kairos Parts у м. Кагарлик. Вартість вже включає ПДВ.{' '}
                <span className="text-accent">
                  Кожна додаткова точка завантаження — +600 грн з ПДВ.
                </span>{' '}
                <span className="text-accent">
                  Доставка до господарства (в межах Кагарлицької громади) — +1000 грн з ПДВ.
                </span>
              </p>
            </div>
          </div>

          <aside
            aria-labelledby="logistics-rate-includes-title"
            className="min-w-0 rounded-xl border border-public-border-accent bg-public-card p-5 shadow-[0_0_38px_rgba(200,150,66,0.16)] sm:p-7"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent">
                <TbPackage aria-hidden="true" focusable="false" className="size-6" />
              </span>
              <h3 id="logistics-rate-includes-title" className="text-xl font-bold text-public-primary">
                Що входить у тариф
              </h3>
            </div>

            <ul className="mt-6 space-y-3">
              {includedServices.map((service) => (
                <li key={service} className="flex items-start gap-3 text-base leading-7 text-public-secondary">
                  <TbCheck
                    aria-hidden="true"
                    focusable="false"
                    className="mt-1 size-5 shrink-0 stroke-[2.4] text-accent"
                  />
                  <span>{service}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 border-t border-public-border pt-6">
              <p className="text-base font-bold uppercase tracking-[0.14em] text-public-muted">
                Маршрут товару
              </p>
              <div className="mt-7 flex w-full flex-col items-center gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(6rem,0.8fr)_minmax(0,1fr)] sm:items-start sm:gap-2">
                <RoutePoint
                  icon={TbBuildingWarehouse}
                  title="Постачальник"
                  subtitle="місце відвантаження"
                />

                <div
                  aria-hidden="true"
                  className="flex min-h-24 w-full flex-col items-center justify-center text-accent sm:mt-7"
                >
                  <div className="flex flex-col items-center gap-1 sm:w-full sm:flex-row sm:gap-1">
                    <span className="h-6 border-l-2 border-dashed border-accent/75 sm:h-px sm:flex-1 sm:border-l-0 sm:border-t-2" />
                    <TbTruckDelivery className="size-14 shrink-0" />
                    <span className="relative h-6 border-l-2 border-dashed border-accent/75 sm:h-px sm:flex-1 sm:border-l-0 sm:border-t-2">
                      <span className="absolute -bottom-1 -left-[5px] size-2.5 rotate-45 border-b-2 border-r-2 border-accent sm:-right-1 sm:-top-[5px] sm:left-auto" />
                    </span>
                  </div>
                  <span className="mt-3 max-w-32 text-center text-sm leading-5 text-public-muted">
                    Напрямок руху товару до Kairos Parts
                  </span>
                </div>

                <RoutePoint
                  icon={TbMapPin}
                  title="Kairos Parts"
                  subtitle="м. Кагарлик"
                />
              </div>
              <a
                href={siteContacts.address.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Відкрити адресу ${siteContacts.address.display} у Google Maps`}
                className="mt-6 flex w-full items-center justify-center gap-2 text-center text-sm leading-6 text-public-muted transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-base"
              >
                <TbMapPin aria-hidden="true" className="size-4 shrink-0 text-accent" />
                <span>Кінцева точка: {siteContacts.address.display}</span>
              </a>
            </div>

          </aside>
        </div>

        <div className="mt-8 sm:mt-10">
          <LogisticsOverviewPanel />
        </div>
      </div>
    </section>
  );
}

function RoutePoint({
  icon: Icon,
  title,
  subtitle
}: {
  icon: typeof TbBuildingWarehouse;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col items-center text-center">
      <span className="grid size-28 shrink-0 place-items-center rounded-full border-2 border-accent/70 bg-accent/[0.06] text-accent shadow-[0_0_32px_rgba(200,150,66,0.1)]">
        <Icon aria-hidden="true" focusable="false" className="size-14 stroke-[1.5]" />
      </span>
      <span className="mt-4 min-w-0">
        <span className="block text-lg font-bold uppercase leading-6 text-public-primary">{title}</span>
        <span className="mt-1 block text-base leading-6 text-public-muted">{subtitle}</span>
      </span>
    </div>
  );
}
