import Link from 'next/link';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ClientVehiclesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await requireClientSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleAccessWhere(access),
    orderBy: { createdAt: 'desc' },
    include: { requests: { select: { id: true } }, company: { select: { name: true } } }
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Мій парк техніки</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Техніка для швидких заявок</h2>
          {access.companyName ? <p className="mt-2 text-sm font-semibold text-foreground">Компанія: {access.companyName}</p> : null}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Додавайте техніку один раз, щоб у заявках автоматично підставлялись тип, виробник, модель і VIN.
          </p>
        </div>
        <Link href="/client/vehicles/new" className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Додати техніку
        </Link>
      </div>

      {params.created ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">Техніку додано.</div> : null}
      {params.error ? <div className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">Не вдалося виконати дію.</div> : null}

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-card">
          <h3 className="text-xl font-bold text-foreground">Техніки ще немає</h3>
          <p className="mt-2 text-sm text-muted">Додайте першу одиницю техніки, щоб пришвидшити наступні заявки.</p>
          <Link href="/client/vehicles/new" className="mt-5 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
            Додати техніку
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <p className="text-sm font-bold text-foreground">{vehicle.type}</p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    {vehicle.manufacturer} {vehicle.model}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    {vehicle.year ? `${vehicle.year} р. · ` : ''}
                    {vehicle.vinOrSerial ?? 'VIN / серійний номер не вказано'}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
                  {vehicle.archivedAt ? 'Архів' : `${vehicle.requests.length} заявок`}
                </span>
              </div>
              {vehicle.comment ? <p className="mt-4 text-sm leading-6 text-muted">{vehicle.comment}</p> : null}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href={`/client/vehicles/${vehicle.id}`} className="rounded-md border border-border px-4 py-2 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted">
                  Детальніше
                </Link>
                <Link href={`/request?source=client&vehicleId=${vehicle.id}`} className="rounded-md bg-accent px-4 py-2 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
                  Створити заявку по цій техніці
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
