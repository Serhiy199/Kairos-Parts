import Link from 'next/link';
import { TbBuilding, TbPlus, TbUser } from 'react-icons/tb';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { ClientVehicleImage } from '@/components/vehicles/client-vehicle-image';
import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getClientVehicleOverview } from '@/lib/vehicles/client-queries';

export const dynamic = 'force-dynamic';

type VehicleOverview = Awaited<ReturnType<typeof getClientVehicleOverview>>;
type VehicleCardItem = VehicleOverview['personalVehicles'][number];

export default async function ClientVehiclesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await requireClientSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) return <ClientDbBlocker />;

  const access = await getClientAccessContext(session.user.id);
  if (!access) return <ClientDbBlocker />;

  const overview = await getClientVehicleOverview(access);
  const totalVehicles = overview.personalVehicles.length + overview.companyVehicles.length;
  const mixedFleet = overview.personalVehicles.length > 0 && overview.companyVehicles.length > 0;

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Мій парк техніки</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Техніка для швидких заявок</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Дані техніки зберігаються в кабінеті й допомагають швидше створювати наступні заявки на запчастини.
          </p>
        </div>
        <Link
          href="/client/vehicles/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <TbPlus aria-hidden="true" className="size-4" />
          Додати техніку
        </Link>
      </header>

      {params.created ? (
        <div role="status" className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">
          Техніку додано.
        </div>
      ) : null}
      {params.error ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">
          Не вдалося виконати дію.
        </div>
      ) : null}

      {totalVehicles === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-card">
          <h3 className="text-xl font-bold text-foreground">Парк техніки ще не заповнений</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
            Техніка з’явиться тут після додавання менеджером Kairos Parts або після створення у вашому кабінеті.
            {overview.companyName ? ` Парк компанії ${overview.companyName} також поки порожній.` : ''}
          </p>
          <Link
            href="/client/vehicles/new"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <TbPlus aria-hidden="true" className="size-4" />
            Додати техніку
          </Link>
        </section>
      ) : (
        <>
          {overview.personalVehicles.length > 0 ? (
            <VehicleGroup
              title="Моя техніка"
              description="Особисті одиниці техніки, доступні тільки у вашому кабінеті."
              vehicles={overview.personalVehicles}
              ownerLabel="Особиста техніка"
              mixedFleet={mixedFleet}
              icon="personal"
            />
          ) : null}

          {access.companyId ? (
            <VehicleGroup
              title="Техніка компанії"
              description={overview.companyName ?? 'Спільний парк вашої компанії.'}
              vehicles={overview.companyVehicles}
              ownerLabel={overview.companyName ? `Компанія: ${overview.companyName}` : 'Техніка компанії'}
              mixedFleet={mixedFleet}
              icon="company"
              emptyMessage="Парк техніки компанії ще не заповнений."
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function VehicleGroup({
  title,
  description,
  vehicles,
  ownerLabel,
  mixedFleet,
  icon,
  emptyMessage
}: {
  title: string;
  description: string;
  vehicles: VehicleCardItem[];
  ownerLabel: string;
  mixedFleet: boolean;
  icon: 'personal' | 'company';
  emptyMessage?: string;
}) {
  return (
    <section aria-labelledby={`${icon}-fleet-heading`} className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-hover">
          {icon === 'company' ? <TbBuilding aria-hidden="true" className="size-5" /> : <TbUser aria-hidden="true" className="size-5" />}
        </span>
        <div>
          <h2 id={`${icon}-fleet-heading`} className="text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted shadow-card">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} ownerLabel={ownerLabel} showOwner={mixedFleet} />
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleCard({ vehicle, ownerLabel, showOwner }: { vehicle: VehicleCardItem; ownerLabel: string; showOwner: boolean }) {
  const vehicleLabel = [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ');

  return (
    <article className="group min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-card transition hover:border-accent/70 hover:shadow-lg">
      <Link href={`/client/vehicles/${vehicle.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        <div className="relative aspect-[16/10] bg-surface-muted">
          <ClientVehicleImage
            src={vehicle.images[0]?.secureUrl}
            alt={vehicleLabel}
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
          />
        </div>
        <div className="grid gap-4 p-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-accent">{vehicle.type}</p>
              <h3 className="mt-1 break-words text-lg font-bold text-foreground">{vehicleLabel}</h3>
            </div>
            {vehicle.archivedAt ? (
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">Архів</span>
            ) : null}
          </div>

          <dl className="grid gap-2 text-sm">
            {vehicle.year ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Рік</dt>
                <dd className="font-semibold text-foreground">{vehicle.year}</dd>
              </div>
            ) : null}
            <div className="flex min-w-0 justify-between gap-4">
              <dt className="shrink-0 text-muted">VIN / номер</dt>
              <dd className="min-w-0 break-words text-right font-semibold text-foreground">{vehicle.vinOrSerial ?? 'Не вказано'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Заявки</dt>
              <dd className="font-semibold text-foreground">{vehicle._count.requests}</dd>
            </div>
          </dl>

          {showOwner ? (
            <p className="inline-flex w-fit max-w-full rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
              <span className="truncate">{ownerLabel}</span>
            </p>
          ) : null}

          <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition group-hover:border-accent group-hover:bg-accent/10">
            Переглянути техніку
          </span>
        </div>
      </Link>
    </article>
  );
}
