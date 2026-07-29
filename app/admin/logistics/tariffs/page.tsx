import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import {
  ReactiveActionForm,
  ReactiveSubmitButton
} from '@/components/workflow/reactive-action-form';
import { requireAdminSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { updateLogisticsTariffPrice } from '@/lib/logistics/crm-actions';
import { formatLogisticsUah } from '@/lib/logistics/crm-presentation';
import { getLogisticsTariffs } from '@/lib/logistics/crm-queries';

export const dynamic = 'force-dynamic';

function dateTime(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export default async function AdminLogisticsTariffsPage() {
  await requireAdminSession();

  if (!hasDatabaseUrl()) return <AdminDbBlocker />;

  const tariffs = await getLogisticsTariffs();

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <Link
          href="/admin/logistics"
          className="text-sm font-semibold text-muted transition hover:text-accent"
        >
          ← До логістичних заявок
        </Link>
        <p className="mt-5 text-sm font-bold uppercase text-accent">
          Kairos Logistics
        </p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          Тарифи міст
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Редагується лише поточна ціна міста. Старі заявки зберігають власні
          тарифні snapshots і кінцеву суму.
        </p>
      </section>

      {tariffs.length !== 13 ? (
        <div
          role="alert"
          className="rounded-lg border border-warning/30 bg-[#F7F1E8] p-5 text-sm text-foreground"
        >
          У базі очікується 13 тарифних міст, але отримано {tariffs.length}.
          Значення не створюються автоматично.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        {tariffs.length > 0 ? (
          <>
            <div className="grid gap-3 p-4 lg:hidden">
              {tariffs.map((tariff) => (
                <TariffCard key={tariff.id} tariff={tariff} />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-muted">
                    <th className="px-4 py-3 font-bold">Код</th>
                    <th className="px-4 py-3 font-bold">Місто</th>
                    <th className="px-4 py-3 font-bold">Поточна ціна</th>
                    <th className="px-4 py-3 font-bold">Активний</th>
                    <th className="px-4 py-3 font-bold">Оновлено</th>
                    <th className="px-4 py-3 font-bold">Нова ціна</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((tariff) => (
                    <tr
                      key={tariff.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {tariff.code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {tariff.name}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatLogisticsUah(tariff.price)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {tariff.isActive ? 'Так' : 'Ні'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {dateTime(tariff.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <TariffForm tariff={tariff} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="m-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">
            Тарифні міста відсутні. Перевірте staging DB; records не
            створюються з CRM автоматично.
          </p>
        )}
      </section>
    </div>
  );
}

type Tariff = Awaited<ReturnType<typeof getLogisticsTariffs>>[number];

function TariffCard({ tariff }: { tariff: Tariff }) {
  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">{tariff.name}</h3>
          <p className="mt-1 font-mono text-xs text-muted">{tariff.code}</p>
        </div>
        <span className="text-sm font-bold text-foreground">
          {formatLogisticsUah(tariff.price)}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-muted">Активний</dt>
          <dd className="mt-1">{tariff.isActive ? 'Так' : 'Ні'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted">Оновлено</dt>
          <dd className="mt-1">{dateTime(tariff.updatedAt)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <TariffForm tariff={tariff} />
      </div>
    </article>
  );
}

function TariffForm({ tariff }: { tariff: Tariff }) {
  return (
    <ReactiveActionForm
      action={updateLogisticsTariffPrice}
      className="flex min-w-[250px] gap-2"
    >
      <input type="hidden" name="tariffId" value={tariff.id} />
      <input
        type="hidden"
        name="expectedUpdatedAt"
        value={tariff.updatedAt}
      />
      <input
        name="price"
        type="text"
        inputMode="decimal"
        required
        maxLength={13}
        defaultValue={tariff.price}
        aria-label={`Нова ціна для ${tariff.name}`}
        className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
      <ReactiveSubmitButton
        pendingLabel="…"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-accent px-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        Зберегти
      </ReactiveSubmitButton>
    </ReactiveActionForm>
  );
}
