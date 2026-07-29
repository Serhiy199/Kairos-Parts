import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { ClientLogisticsStatusBadge } from '@/components/client/logistics-status-badge';
import {
  getClientAccessContext,
  requireClientSession
} from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getClientLogisticsDetail } from '@/lib/logistics/client-queries';
import {
  formatLogisticsUahCompact,
  LOGISTICS_DESTINATION_SENTENCE_LABELS
} from '@/lib/logistics/presentation';
import { formatDateOnlyLongUk } from '@/lib/logistics/date-only';

export const dynamic = 'force-dynamic';

function dateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export default async function ClientLogisticsDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) return <ClientDbBlocker />;

  const access = await getClientAccessContext(session.user.id);
  if (!access) return <ClientDbBlocker />;

  let request: Awaited<ReturnType<typeof getClientLogisticsDetail>>;
  try {
    request = await getClientLogisticsDetail(id, access);
  } catch (error) {
    console.error('Client logistics detail query failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
    return (
      <div
        role="alert"
        className="rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm font-semibold text-danger"
      >
        Не вдалося завантажити доставку. Спробуйте пізніше.
      </div>
    );
  }

  if (!request) notFound();

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <Link
          href="/client/logistics"
          className="text-sm font-semibold text-muted transition hover:text-accent"
        >
          ← До списку доставок
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-accent">
              Kairos Logistics
            </p>
            <h2 className="mt-2 break-words text-2xl font-bold text-foreground">
              {request.requestNumber}
            </h2>
          </div>
          <ClientLogisticsStatusBadge status={request.status} />
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <DetailField label="Створено" value={dateTime(request.createdAt)} />
          <DetailField label="Оновлено" value={dateTime(request.updatedAt)} />
          <DetailField
            label="Бажана дата перевезення"
            value={
              request.preferredDeliveryDate
                ? formatDateOnlyLongUk(request.preferredDeliveryDate)
                : 'Бажану дату не вказано'
            }
          />
        </dl>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="cabinet-card">
          <h3 className="text-lg font-bold text-foreground">
            Контактні дані
          </h3>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <DetailField label="Ім’я" value={request.contactName} />
            <DetailField label="Телефон" value={request.contactPhone} />
          </dl>
        </section>

        <section className="cabinet-card">
          <h3 className="text-lg font-bold text-foreground">
            Місце доставки
          </h3>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {
              LOGISTICS_DESTINATION_SENTENCE_LABELS[
                request.destinationType
              ]
            }
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-muted">
            {request.destinationAddress ?? 'Адреса недоступна'}
          </p>
        </section>
      </div>

      <section className="cabinet-card">
        <h3 className="text-lg font-bold text-foreground">
          Точки відвантаження
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {request.pickupPoints.map((point, index) => (
            <article
              key={`${index}-${point.formattedAddress}`}
              className="min-w-0 rounded-md border border-border p-4"
            >
              <h4 className="font-bold text-foreground">Точка {index + 1}</h4>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Назва компанії / постачальника
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-foreground">
                {point.supplierName || 'Компанію не вказано'}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Адреса завантаження
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-foreground">
                {point.formattedAddress}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Опис вантажу
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {point.cargoDescription}
              </p>
            </article>
          ))}
        </div>
      </section>

      {request.clientComment ? (
        <section className="cabinet-card">
          <h3 className="text-lg font-bold text-foreground">
            Коментар до заявки
          </h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {request.clientComment}
          </p>
        </section>
      ) : null}

      <section className="cabinet-card">
        <h3 className="text-lg font-bold text-foreground">
          Розрахунок вартості
        </h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailField
            label="Тарифне місто"
            value={request.tariffCityName}
          />
          <DetailField
            label="Базовий тариф"
            value={formatLogisticsUahCompact(request.baseTariff)}
          />
          <DetailField
            label="Кількість точок"
            value={String(request.pickupPointCount)}
          />
          <DetailField
            label="Доплата за додаткові точки"
            value={formatLogisticsUahCompact(
              request.additionalPointsCharge
            )}
          />
          <DetailField
            label="Доплата за господарство"
            value={formatLogisticsUahCompact(request.farmDeliveryCharge)}
          />
          <DetailField
            label="Загальна кінцева сума"
            value={formatLogisticsUahCompact(request.totalPrice)}
          />
        </dl>
        <p className="mt-4 text-sm font-semibold text-muted">
          Усі ціни включають ПДВ. Показані суми зафіксовані під час створення
          заявки.
        </p>
      </section>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-foreground">{value}</dd>
    </div>
  );
}
