import Link from 'next/link';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { ClientLogisticsStatusBadge } from '@/components/client/logistics-status-badge';
import {
  getClientAccessContext,
  requireClientSession
} from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import {
  getClientLogisticsPage,
  parseClientLogisticsPage
} from '@/lib/logistics/client-queries';
import {
  formatLogisticsUahCompact,
  LOGISTICS_DESTINATION_SENTENCE_LABELS
} from '@/lib/logistics/presentation';
import { formatDateOnlyShort } from '@/lib/logistics/date-only';

export const dynamic = 'force-dynamic';

function date(value: string) {
  return new Date(value).toLocaleDateString('uk-UA');
}

function pointCount(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} точка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${value} точки`;
  }
  return `${value} точок`;
}

export default async function ClientLogisticsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireClientSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) return <ClientDbBlocker />;

  const access = await getClientAccessContext(session.user.id);
  if (!access) return <ClientDbBlocker />;

  let data: Awaited<ReturnType<typeof getClientLogisticsPage>>;
  try {
    data = await getClientLogisticsPage(
      access,
      parseClientLogisticsPage(params.page)
    );
  } catch (error) {
    console.error('Client logistics list query failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
    return (
      <SafeQueryError message="Не вдалося завантажити доставки. Спробуйте пізніше." />
    );
  }

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <p className="text-sm font-bold uppercase text-accent">
          Kairos Logistics
        </p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          Мої доставки
        </h2>
        <p className="mt-2 text-sm text-muted">
          {access.companyName
            ? `Компанія: ${access.companyName}. Також показані ваші персональні заявки.`
            : 'Ваші персональні заявки на доставку.'}
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        {data.items.length > 0 ? (
          <>
            <div className="grid gap-3 p-4 sm:p-5 xl:hidden">
              {data.items.map((request) => (
                <article
                  key={request.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link
                      href={`/client/logistics/${request.id}`}
                      className="break-words font-bold text-foreground transition hover:text-accent"
                    >
                      {request.requestNumber}
                    </Link>
                    <ClientLogisticsStatusBadge status={request.status} />
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <ListField label="Створено" value={date(request.createdAt)} />
                    <ListField
                      label="Бажана дата"
                      value={
                        request.preferredDeliveryDate
                          ? formatDateOnlyShort(request.preferredDeliveryDate)
                          : 'Не вказана'
                      }
                    />
                    <ListField
                      label="Тарифне місто"
                      value={request.tariffCityName}
                    />
                    <ListField
                      label="Точки"
                      value={pointCount(request.pickupPointCount)}
                    />
                    <ListField
                      label="Доставка"
                      value={
                        LOGISTICS_DESTINATION_SENTENCE_LABELS[
                          request.destinationType
                        ]
                      }
                    />
                    <ListField
                      label="Кінцева сума"
                      value={formatLogisticsUahCompact(request.totalPrice)}
                    />
                  </dl>
                  <Link
                    href={`/client/logistics/${request.id}`}
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent-hover"
                  >
                    Деталі доставки
                  </Link>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-muted">
                    <th className="px-4 py-3 font-bold">Номер</th>
                    <th className="px-4 py-3 font-bold">Дати</th>
                    <th className="px-4 py-3 font-bold">Тарифне місто</th>
                    <th className="px-4 py-3 font-bold">Точки</th>
                    <th className="px-4 py-3 font-bold">Доставка</th>
                    <th className="px-4 py-3 font-bold">Сума</th>
                    <th className="px-4 py-3 font-bold">Статус</th>
                    <th className="px-4 py-3 font-bold">Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-bold text-foreground">
                        {request.requestNumber}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <span className="block">
                          Створено: {date(request.createdAt)}
                        </span>
                        <span className="mt-1 block">
                          Бажана:{' '}
                          {request.preferredDeliveryDate
                            ? formatDateOnlyShort(
                                request.preferredDeliveryDate
                              )
                            : 'не вказана'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {request.tariffCityName}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {pointCount(request.pickupPointCount)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {
                          LOGISTICS_DESTINATION_SENTENCE_LABELS[
                            request.destinationType
                          ]
                        }
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {formatLogisticsUahCompact(request.totalPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <ClientLogisticsStatusBadge status={request.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/client/logistics/${request.id}`}
                          className="font-bold text-foreground transition hover:text-accent"
                        >
                          Деталі
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="m-4 rounded-md border border-dashed border-border p-6 sm:m-5">
            <p className="text-sm text-muted">
              У вас поки немає заявок на доставку.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/logistics/request"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-4 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Створити заявку на перевезення
              </Link>
              <Link
                href="/logistics"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-center text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Перейти до сторінки логістики
              </Link>
            </div>
          </div>
        )}

        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
        />
      </section>
    </div>
  );
}

function ListField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-foreground">{value}</dd>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalCount
}: {
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  if (totalCount === 0 || totalPages <= 1) return null;
  const linkClass =
    'inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold transition hover:border-accent';

  return (
    <nav
      aria-label="Пагінація доставок"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-5"
    >
      <p className="text-sm text-muted">
        Сторінка {page} із {totalPages} · усього {totalCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`/client/logistics?page=${page - 1}`}
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
            href={`/client/logistics?page=${page + 1}`}
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

function SafeQueryError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm font-semibold text-danger"
    >
      {message}
    </div>
  );
}
