import Link from 'next/link';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientAccessContext, requestAccessWhere, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ClientDashboardPage() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const requestWhere = requestAccessWhere(access);
  const [totalRequests, activeRequests, completedRequests, totalVehicles, recentRequests] = await Promise.all([
    prisma.request.count({ where: requestWhere }),
    prisma.request.count({ where: { AND: [requestWhere, { status: { notIn: ['COMPLETED', 'CANCELLED'] } }] } }),
    prisma.request.count({ where: { AND: [requestWhere, { status: 'COMPLETED' }] } }),
    prisma.vehicle.count({ where: vehicleAccessWhere(access) }),
    prisma.request.findMany({
      where: requestWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { category: true, company: { select: { name: true } } }
    })
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Вітаємо</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">{access.companyName ?? session.user.name ?? 'Клієнт Kairos Parts'}</h2>
          <p className="mt-2 text-sm text-muted">{access.mode === 'COMPANY' ? 'Спільний кабінет компанії' : 'Персональний кабінет клієнта'}</p>
        </div>
        <Link href="/request?source=client" className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Створити нову заявку
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Всього заявок', totalRequests],
          ['Активні заявки', activeRequests],
          ['Завершено', completedRequests],
          ['Техніка в парку', totalVehicles]
        ].map(([label, value], index) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
            {index === 3 ? (
              <Link href="/client/vehicles" className="mt-3 inline-flex text-sm font-bold text-foreground transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Переглянути парк
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-foreground">Останні заявки</h2>
          <Link href="/client/requests" className="text-sm font-bold text-foreground transition hover:text-accent">
            Всі заявки
          </Link>
        </div>
        <div className="mt-5 grid gap-3">
          {recentRequests.length > 0 ? (
            recentRequests.map((request) => (
              <Link key={request.id} href={`/client/requests/${request.id}`} className="rounded-md border border-border p-4 transition hover:border-accent hover:bg-surface-muted">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-bold text-foreground">{request.requestNumber}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{request.category?.name ?? request.equipmentType ?? request.description}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">Заявок ще немає.</p>
          )}
        </div>
      </div>
    </div>
  );
}
