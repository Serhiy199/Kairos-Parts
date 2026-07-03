import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, type RequestStatus } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, groupedStatuses, last7Days, last30Days, recentRequests] = await Promise.all([
    prisma.request.count(),
    prisma.request.groupBy({
      by: ['status'],
      _count: { status: true }
    }),
    prisma.request.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.request.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.request.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { contactName: true, companyName: true } },
        assignedManager: { select: { name: true, email: true } }
      }
    })
  ]);

  const statusCounts = new Map<RequestStatus, number>(
    groupedStatuses.map((item) => [item.status, item._count.status])
  );

  const cards = [
    { label: 'Всього заявок', value: total },
    { label: REQUEST_STATUS_LABELS.NEW, value: statusCounts.get('NEW') ?? 0 },
    { label: REQUEST_STATUS_LABELS.IN_PROGRESS, value: statusCounts.get('IN_PROGRESS') ?? 0 },
    { label: REQUEST_STATUS_LABELS.WAITING_APPROVAL, value: statusCounts.get('WAITING_APPROVAL') ?? 0 },
    { label: REQUEST_STATUS_LABELS.COMPLETED, value: statusCounts.get('COMPLETED') ?? 0 },
    { label: REQUEST_STATUS_LABELS.CANCELLED, value: statusCounts.get('CANCELLED') ?? 0 },
    { label: 'За 7 днів', value: last7Days },
    { label: 'За 30 днів', value: last30Days }
  ];

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold text-muted">{card.label}</p>
            <p className="mt-3 text-3xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Останні заявки</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">CRM потік</h2>
          </div>
          <Link href="/admin/requests" className="rounded-md bg-accent px-4 py-2 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
            Всі заявки
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-border p-5 text-sm text-muted">Заявок ще немає.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-muted">
                  <th className="px-4 py-3 font-bold">№</th>
                  <th className="px-4 py-3 font-bold">Клієнт</th>
                  <th className="px-4 py-3 font-bold">Статус</th>
                  <th className="px-4 py-3 font-bold">Менеджер</th>
                  <th className="px-4 py-3 font-bold">Дата</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((request) => (
                  <tr key={request.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">
                        {request.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{request.client?.companyName ?? request.client?.contactName ?? request.companyName ?? request.guestName ?? 'Гість'}</td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3 text-muted">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</td>
                    <td className="px-4 py-3 text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Статуси</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REQUEST_STATUSES.map((status) => (
            <div key={status} className="flex items-center justify-between rounded-md border border-border p-3">
              <StatusBadge status={status} />
              <span className="font-bold text-foreground">{statusCounts.get(status) ?? 0}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
