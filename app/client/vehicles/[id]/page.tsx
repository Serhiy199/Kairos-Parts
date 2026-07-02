import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

import { updateVehicle } from '../actions';
import { VehicleForm } from '../vehicle-form';

export const dynamic = 'force-dynamic';

export default async function ClientVehicleDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    return <ClientDbBlocker />;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, clientId: profile.id },
    include: {
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          createdAt: true,
          description: true
        }
      }
    }
  });

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Одиниця техніки</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">
            {vehicle.manufacturer} {vehicle.model}
          </h2>
          <p className="mt-2 text-sm text-muted">{vehicle.type}</p>
        </div>
        <Link href={`/request?source=client&vehicleId=${vehicle.id}`} className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-[#DFA600]">
          Створити заявку по цій техніці
        </Link>
      </div>

      {query.updated ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">Дані техніки оновлено.</div> : null}
      {query.error ? <div className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">Перевірте обовʼязкові поля.</div> : null}

      <VehicleForm action={updateVehicle} submitLabel="Зберегти зміни" vehicle={vehicle} />

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h3 className="text-xl font-bold text-foreground">Повʼязані заявки</h3>
        <div className="mt-5 grid gap-3">
          {vehicle.requests.length > 0 ? (
            vehicle.requests.map((request) => (
              <Link key={request.id} href={`/client/requests/${request.id}`} className="rounded-md border border-border p-4 transition hover:border-accent hover:bg-surface-muted">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-bold text-foreground">{request.requestNumber}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{request.description}</p>
                    <p className="mt-1 text-xs text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">По цій техніці ще немає заявок.</p>
          )}
        </div>
      </div>
    </div>
  );
}
