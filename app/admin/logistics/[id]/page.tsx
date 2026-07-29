import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LogisticsStatusBadge } from '@/components/admin/logistics/logistics-status-badge';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import {
  ReactiveActionForm,
  ReactiveSubmitButton
} from '@/components/workflow/reactive-action-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import {
  addLogisticsInternalComment,
  updateLogisticsRequestStatus
} from '@/lib/logistics/crm-actions';
import {
  LOGISTICS_DESTINATION_LABELS,
  LOGISTICS_SOURCE_LABELS,
  LOGISTICS_STATUS_LABELS,
  LOGISTICS_STATUS_TRANSITIONS,
  formatLogisticsUah
} from '@/lib/logistics/crm-presentation';
import { getLogisticsRequestDetail } from '@/lib/logistics/crm-queries';

export const dynamic = 'force-dynamic';

function dateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export default async function AdminLogisticsDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) return <AdminDbBlocker />;

  const request = await getLogisticsRequestDetail(id);
  if (!request) notFound();
  const transitions = LOGISTICS_STATUS_TRANSITIONS[request.status];

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <Link
          href="/admin/logistics"
          className="text-sm font-semibold text-muted transition hover:text-accent"
        >
          ← До логістичних заявок
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-accent">
              Kairos Logistics
            </p>
            <h2 className="mt-2 break-words text-2xl font-bold text-foreground">
              {request.requestNumber}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {LOGISTICS_SOURCE_LABELS[request.source]}
              {request.sourceName ? ` · ${request.sourceName}` : ''}
            </p>
          </div>
          <LogisticsStatusBadge status={request.status} />
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Створено" value={dateTime(request.createdAt)} />
          <DetailField label="Оновлено" value={dateTime(request.updatedAt)} />
          <DetailField
            label="Тип доставки"
            value={LOGISTICS_DESTINATION_LABELS[request.destinationType]}
          />
          <DetailField
            label="Кінцева сума"
            value={formatLogisticsUah(request.totalPrice)}
          />
        </dl>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="grid min-w-0 gap-5">
          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">Контакт</h3>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <DetailField label="Ім’я" value={request.contactName} />
              <div className="min-w-0">
                <dt className="font-semibold text-muted">Телефон</dt>
                <dd className="mt-1 break-words">
                  <a
                    href={`tel:${request.contactPhone}`}
                    className="font-semibold text-foreground transition hover:text-accent"
                  >
                    {request.contactPhone}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">
              Тариф і розрахунок
            </h3>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label="Тарифне місто"
                value={`${request.tariffCityName} · ${request.tariffCityCode}`}
              />
              <DetailField
                label="Базовий тариф"
                value={formatLogisticsUah(request.baseTariff)}
              />
              <DetailField
                label="Кількість точок"
                value={String(request.pickupPointCount)}
              />
              <DetailField
                label="Доплата за точки"
                value={formatLogisticsUah(request.additionalPointsCharge)}
              />
              <DetailField
                label="Доплата за господарство"
                value={formatLogisticsUah(request.farmDeliveryCharge)}
              />
              <DetailField
                label="Загальна кінцева сума"
                value={formatLogisticsUah(request.totalPrice)}
              />
            </dl>
            <p className="mt-4 text-sm font-semibold text-muted">
              Усі ціни включають ПДВ. Відображаються snapshots на момент
              створення заявки.
            </p>
          </section>

          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">
              Точки відвантаження
            </h3>
            <div className="mt-4 grid gap-4">
              {request.pickupPoints.map((point, index) => (
                <article
                  key={point.id}
                  className="rounded-md border border-border p-4"
                >
                  <h4 className="font-bold text-foreground">
                    Точка {index + 1}
                  </h4>
                  <p className="mt-2 break-words text-sm text-muted">
                    {point.formattedAddress}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">
                    {point.cargoDescription}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">
              Місце доставки
            </h3>
            <p className="mt-3 break-words text-sm text-foreground">
              {request.destinationAddress ?? 'Адреса недоступна'}
            </p>
          </section>

          {request.clientComment ? (
            <section className="cabinet-card">
              <h3 className="text-lg font-bold text-foreground">
                Коментар клієнта
              </h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {request.clientComment}
              </p>
            </section>
          ) : null}
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">
              Поточний статус
            </h3>
            <div className="mt-3">
              <LogisticsStatusBadge status={request.status} />
            </div>
            {session.user.role === 'ADMIN' && transitions.length > 0 ? (
              <div className="mt-5 grid gap-2">
                <p className="text-sm font-semibold text-muted">
                  Доступні переходи
                </p>
                {transitions.map((targetStatus) => (
                  <ReactiveActionForm
                    key={targetStatus}
                    action={updateLogisticsRequestStatus}
                  >
                    <input type="hidden" name="requestId" value={request.id} />
                    <input
                      type="hidden"
                      name="expectedStatus"
                      value={request.status}
                    />
                    <input
                      type="hidden"
                      name="targetStatus"
                      value={targetStatus}
                    />
                    <ReactiveSubmitButton
                      pendingLabel="Оновлюємо…"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Змінити на «{LOGISTICS_STATUS_LABELS[targetStatus]}»
                    </ReactiveSubmitButton>
                  </ReactiveActionForm>
                ))}
              </div>
            ) : null}
            {session.user.role === 'ADMIN' && transitions.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Статус є кінцевим і не може бути змінений.
              </p>
            ) : null}
          </section>

          <section className="cabinet-card">
            <h3 className="text-lg font-bold text-foreground">
              Внутрішні коментарі
            </h3>
            <div className="mt-4 grid gap-3">
              {request.internalComments.length > 0 ? (
                request.internalComments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                      <span className="font-semibold">{comment.authorName}</span>
                      <time dateTime={comment.createdAt}>
                        {dateTime(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {comment.body}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Внутрішніх коментарів поки немає.
                </p>
              )}
            </div>

            <ReactiveActionForm
              action={addLogisticsInternalComment}
              resetOnSuccess
              className="mt-5"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <label
                htmlFor="logistics-internal-comment"
                className="text-sm font-semibold text-foreground"
              >
                Новий коментар
              </label>
              <textarea
                id="logistics-internal-comment"
                name="body"
                required
                maxLength={2000}
                rows={5}
                className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
              <ReactiveSubmitButton
                pendingLabel="Додаємо…"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Додати коментар
              </ReactiveSubmitButton>
            </ReactiveActionForm>
          </section>
        </div>
      </div>
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
