import Link from 'next/link';
import { LuPencil, LuPlus } from 'react-icons/lu';

import type { AdminVehicleSummary } from '@/lib/vehicles/admin-queries';

type AdminOwnerFleetSectionProps = {
  ownerType: 'company' | 'client';
  vehicles: AdminVehicleSummary[];
  createHref: string;
};

const emptyStateCopy = {
  company: {
    title: 'Парк техніки ще не заповнений',
    description: 'Додайте техніку компанії, щоб вона з’явилася в кабінеті всіх учасників.'
  },
  client: {
    title: 'Парк техніки клієнта ще не заповнений',
    description: 'Додайте техніку клієнта, щоб вона з’явилася в його особистому кабінеті.'
  }
} as const;

export function AdminOwnerFleetSection({
  ownerType,
  vehicles,
  createHref
}: AdminOwnerFleetSectionProps) {
  const emptyCopy = emptyStateCopy[ownerType];

  return (
    <section id="fleet" className="scroll-mt-6 rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Парк техніки</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">Техніка власника</h2>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
              {vehicles.length} од.
            </span>
          </div>
        </div>
        <Link
          href={createHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <LuPlus aria-hidden="true" className="h-4 w-4" />
          Додати техніку
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-border bg-surface-muted p-5">
          <h3 className="font-bold text-foreground">{emptyCopy.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{emptyCopy.description}</p>
          <Link
            href={createHref}
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <LuPlus aria-hidden="true" className="h-4 w-4" />
            Додати техніку
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {vehicles.map((vehicle) => (
            <article
              key={vehicle.id}
              className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.55fr_1.3fr_0.8fr_auto] xl:items-center"
            >
              <VehicleField label="Тип техніки" value={vehicle.type} />
              <VehicleField label="Виробник" value={vehicle.manufacturer} />
              <VehicleField label="Модель" value={vehicle.model} />
              <VehicleField label="Рік" value={vehicle.year ? String(vehicle.year) : '—'} />
              <VehicleField label="VIN / серійний номер" value={vehicle.vinOrSerial ?? '—'} />
              <VehicleField label="Дата додавання" value={vehicle.createdAt.toLocaleDateString('uk-UA')} />
              <Link
                href={`/admin/vehicles/${vehicle.id}/edit`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <LuPencil aria-hidden="true" className="h-4 w-4" />
                Редагувати
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
