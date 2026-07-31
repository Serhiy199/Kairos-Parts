import Link from 'next/link';

import { LogisticsStatusBadge } from '@/components/admin/logistics/logistics-status-badge';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { ActionIcon } from '@/components/ui/action-icons';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import {
  LOGISTICS_CRM_SOURCES,
  LOGISTICS_CRM_STATUSES,
  LOGISTICS_DESTINATIONS,
  LOGISTICS_DESTINATION_LABELS,
  LOGISTICS_SOURCE_LABELS,
  LOGISTICS_STATUS_LABELS,
  formatNullableLogisticsUah
} from '@/lib/logistics/crm-presentation';
import {
  getLogisticsCrmPage,
  logisticsCrmQuery,
  parseLogisticsCrmFilters,
  type LogisticsCrmSearchParams
} from '@/lib/logistics/crm-queries';
import { LOGISTICS_TARIFF_CITIES } from '@/lib/logistics/tariff-cities';
import { formatDateOnlyShort } from '@/lib/logistics/date-only';

export const dynamic = 'force-dynamic';

function dateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export default async function AdminLogisticsPage({
  searchParams
}: {
  searchParams: Promise<LogisticsCrmSearchParams>;
}) {
  const session = await requireCrmSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) return <AdminDbBlocker />;

  const filters = parseLogisticsCrmFilters(params);
  const page = await getLogisticsCrmPage(filters);
  const hasFilters = Boolean(
    filters.q ||
      filters.status ||
      filters.tariffCity ||
      filters.destination ||
      filters.source ||
      filters.dateFrom ||
      filters.dateTo
  );
  const filterKey = JSON.stringify(filters);

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-accent">
              Kairos Logistics
            </p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">
              Логістичні заявки
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Окремий CRM-потік перевезень. Сума кожної заявки є остаточним
              snapshot і не редагується.
            </p>
          </div>
          {session.user.role === 'ADMIN' ? (
            <Link
              href="/admin/logistics/tariffs"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent"
            >
              Тарифи міст
            </Link>
          ) : null}
        </div>

        <form
          key={filterKey}
          action="/admin/logistics"
          method="get"
          className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7"
        >
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={80}
            placeholder="№, ім’я або телефон"
            aria-label="Пошук логістичних заявок"
            className="h-11 min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 sm:col-span-2 2xl:col-span-2"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            aria-label="Статус"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">Всі статуси</option>
            {LOGISTICS_CRM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LOGISTICS_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            name="tariffCity"
            defaultValue={filters.tariffCity ?? ''}
            aria-label="Тарифне місто"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">Всі міста</option>
            {LOGISTICS_TARIFF_CITIES.map((city) => (
              <option key={city.code} value={city.code}>
                {city.displayName}
              </option>
            ))}
          </select>
          <select
            name="destination"
            defaultValue={filters.destination ?? ''}
            aria-label="Тип доставки"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">Всі доставки</option>
            {LOGISTICS_DESTINATIONS.map((destination) => (
              <option key={destination} value={destination}>
                {LOGISTICS_DESTINATION_LABELS[destination]}
              </option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={filters.source ?? ''}
            aria-label="Джерело"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">Всі джерела</option>
            {LOGISTICS_CRM_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source === 'GUEST' ? 'Guest' : 'CLIENT / Company CLIENT'}
              </option>
            ))}
          </select>
          <input
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom}
            aria-label="Дата від"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <input
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo}
            aria-label="Дата до"
            className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent-hover">
            <ActionIcon name="filter" />
            Фільтрувати
          </button>
          <Link
            href="/admin/logistics"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-accent"
          >
            <ActionIcon name="reset" />
            Скинути
          </Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        {page.records.length > 0 ? (
          <div className="grid gap-3 p-4 sm:p-5 xl:hidden">
            {page.records.map((request) => (
              <article
                key={request.id}
                className="rounded-md border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    href={`/admin/logistics/${request.id}`}
                    className="font-bold text-foreground transition hover:text-accent"
                  >
                    {request.requestNumber}
                  </Link>
                  <LogisticsStatusBadge status={request.status} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <CardField label="Створено" value={dateTime(request.createdAt)} />
                  <CardField
                    label="Бажана дата"
                    value={
                      request.preferredDeliveryDate
                        ? formatDateOnlyShort(request.preferredDeliveryDate)
                        : 'Не вказано'
                    }
                  />
                  <CardField label="Контакт" value={request.contactName} />
                  <CardField label="Телефон" value={request.contactPhone} />
                  <CardField
                    label="Місто"
                    value={logisticsLocality(request)}
                  />
                  <CardField
                    label="Точки"
                    value={String(request.pickupPointCount)}
                  />
                  <CardField
                    label="Доставка"
                    value={
                      LOGISTICS_DESTINATION_LABELS[request.destinationType]
                    }
                  />
                  <CardField
                    label="Джерело"
                    value={LOGISTICS_SOURCE_LABELS[request.source]}
                  />
                  <CardField
                    label="Сума"
                    value={formatNullableLogisticsUah(request.totalPrice)}
                  />
                </dl>
                <Link
                  href={`/admin/logistics/${request.id}`}
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent"
                >
                  Відкрити заявку
                </Link>
              </article>
            ))}
          </div>
        ) : null}

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">№</th>
                <th className="px-4 py-3 font-bold">Дати</th>
                <th className="px-4 py-3 font-bold">Контакт</th>
                <th className="px-4 py-3 font-bold">Телефон</th>
                <th className="px-4 py-3 font-bold">Місто</th>
                <th className="px-4 py-3 font-bold">Точки</th>
                <th className="px-4 py-3 font-bold">Доставка</th>
                <th className="px-4 py-3 font-bold">Сума</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Джерело</th>
              </tr>
            </thead>
            <tbody>
              {page.records.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/logistics/${request.id}`}
                      className="font-bold text-foreground transition hover:text-accent"
                    >
                      {request.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <span className="block">
                      Створено: {dateTime(request.createdAt)}
                    </span>
                    <span className="mt-1 block">
                      Бажана:{' '}
                      {request.preferredDeliveryDate
                        ? formatDateOnlyShort(request.preferredDeliveryDate)
                        : 'не вказано'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {request.contactName}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {request.contactPhone}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <span className="whitespace-pre-line">
                      {logisticsLocality(request)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {request.pickupPointCount}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {LOGISTICS_DESTINATION_LABELS[request.destinationType]}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatNullableLogisticsUah(request.totalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <LogisticsStatusBadge status={request.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {LOGISTICS_SOURCE_LABELS[request.source]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {page.records.length === 0 ? (
          <p className="m-4 rounded-md border border-dashed border-border p-5 text-sm text-muted sm:m-5">
            {hasFilters
              ? 'За вибраними параметрами заявок не знайдено.'
              : 'Логістичних заявок поки немає.'}
          </p>
        ) : null}

        <Pagination
          filters={filters}
          page={page.page}
          totalPages={page.totalPages}
          totalCount={page.totalCount}
        />
      </section>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words text-foreground">
        {value}
      </dd>
    </div>
  );
}

function logisticsLocality(request: {
  pricingType: 'FIXED' | 'INDIVIDUAL';
  tariffCityName: string | null;
  customLocality: string | null;
}) {
  return request.pricingType === 'INDIVIDUAL'
    ? `Інший населений пункт\n${request.customLocality ?? 'Не вказано'}`
    : (request.tariffCityName ?? 'Не вказано');
}

function Pagination({
  filters,
  page,
  totalPages,
  totalCount
}: {
  filters: ReturnType<typeof parseLogisticsCrmFilters>;
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  if (totalCount === 0 || totalPages <= 1) return null;
  const linkClass =
    'inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold transition hover:border-accent';

  return (
    <nav
      aria-label="Пагінація логістичних заявок"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-5"
    >
      <p className="text-sm text-muted">
        Сторінка {page} із {totalPages} · усього {totalCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`/admin/logistics${logisticsCrmQuery(filters, { page: page - 1 })}`}
            rel="prev"
            className={linkClass}
          >
            Попередня
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${linkClass} cursor-not-allowed opacity-50`}
          >
            Попередня
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={`/admin/logistics${logisticsCrmQuery(filters, { page: page + 1 })}`}
            rel="next"
            className={linkClass}
          >
            Наступна
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${linkClass} cursor-not-allowed opacity-50`}
          >
            Наступна
          </span>
        )}
      </div>
    </nav>
  );
}
