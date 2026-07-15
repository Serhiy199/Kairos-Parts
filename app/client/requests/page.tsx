import Link from 'next/link';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ClientRequestsPage() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const requests = await prisma.request.findMany({
    where: requestAccessWhere(access),
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { name: true } },
      items: {
        where: {
          visibleToClient: true,
          approvedByClient: false
        },
        select: { id: true }
      }
    }
  });

  const pendingApprovalCount = requests.filter((request) => request.items.length > 0).length;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Мої заявки</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Історія заявок</h2>
          {access.companyName ? <p className="mt-2 text-sm text-muted">Компанія: {access.companyName}</p> : null}
          {pendingApprovalCount > 0 ? (
            <p className="mt-2 text-sm font-semibold text-success">
              {pendingApprovalCount} {pendingApprovalCount === 1 ? 'заявка очікує' : 'заявки очікують'} погодження підібраних позицій.
            </p>
          ) : null}
        </div>
        <Link href="/request?source=client" className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Створити заявку
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-muted">
              <th className="px-4 py-3 font-bold">Номер</th>
              <th className="px-4 py-3 font-bold">Дата</th>
              <th className="px-4 py-3 font-bold">Техніка</th>
              <th className="px-4 py-3 font-bold">Опис</th>
              <th className="px-4 py-3 font-bold">Статус</th>
              <th className="px-4 py-3 font-bold">Оновлено</th>
              <th className="px-4 py-3 font-bold">Дія</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const needsApproval = request.items.length > 0;

              return (
              <tr key={request.id} className={`border-b border-border last:border-0 ${needsApproval ? 'bg-[#E7F6EC]/55' : ''}`}>
                <td className="px-4 py-3 font-bold text-foreground">
                  <div className="flex flex-col gap-2">
                    <span>{request.requestNumber}</span>
                    {needsApproval ? (
                      <span className="w-fit rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">
                        Очікує погодження
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</td>
                <td className="px-4 py-3 text-muted">{request.equipmentType ?? '—'}</td>
                <td className="max-w-xs px-4 py-3 text-muted">{request.description.slice(0, 90)}</td>
                <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                <td className="px-4 py-3 text-muted">{request.updatedAt.toLocaleDateString('uk-UA')}</td>
                <td className="px-4 py-3">
                  <Link href={`/client/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">
                    Деталі
                  </Link>
                  <span className="mx-2 text-border">|</span>
                  <Link href={`/request?source=client&repeatRequestId=${request.id}`} className="font-bold text-foreground transition hover:text-accent">
                    Повторити
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Заявок ще немає.</p> : null}
      </div>
    </div>
  );
}
