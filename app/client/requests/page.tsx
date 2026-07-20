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
    <div className="cabinet-card">
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
      <div className="mt-5 grid gap-3 xl:hidden">
        {requests.map((request) => {
          const needsApproval = request.items.length > 0;

          return (
            <article key={request.id} className={`rounded-md border p-4 ${needsApproval ? 'border-success/35 bg-[#E7F6EC]/45' : 'border-border'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="break-words font-bold text-foreground">{request.requestNumber}</span>
                <StatusBadge status={request.status} />
              </div>
              {needsApproval ? <span className="mt-3 inline-flex rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">Очікує погодження</span> : null}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold text-muted">Техніка</dt><dd className="mt-1 break-words text-foreground">{request.equipmentType ?? '—'}</dd></div>
                <div><dt className="font-semibold text-muted">Дата</dt><dd className="mt-1 text-foreground">{request.createdAt.toLocaleDateString('uk-UA')}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-muted">Опис</dt><dd className="mt-1 break-words text-foreground">{request.description.slice(0, 120)}</dd></div>
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/client/requests/${request.id}`} className="flex min-h-10 items-center justify-center rounded-md bg-accent px-3 text-center text-sm font-bold text-foreground">Деталі</Link>
                <Link href={`/request?source=client&repeatRequestId=${request.id}`} className="flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-center text-sm font-bold text-foreground">Повторити</Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-6 hidden overflow-x-auto xl:block">
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
