import { notFound } from 'next/navigation';

import { StatusBadge } from '@/components/client/status-badge';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCE_LABELS } from '@/lib/requests/sources';
import { getRequestStatusMeta, REQUEST_STATUS_LABELS } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

function formatDate(date: Date) {
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function RequestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!hasDatabaseUrl()) {
    return (
      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 shadow-card">
          <p className="text-sm font-bold uppercase text-accent">Статус заявки</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">База даних не налаштована</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Перегляд статусу потребує підключення PostgreSQL. Спробуйте пізніше або зверніться до менеджера Kairos Parts.
          </p>
        </div>
      </section>
    );
  }

  const request = await prisma.request.findUnique({
    where: { publicStatusToken: token },
    select: {
      requestNumber: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      description: true,
      equipmentType: true,
      companyName: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          createdAt: true
        }
      }
    }
  });

  if (!request) {
    notFound();
  }

  const statusMeta = getRequestStatusMeta(request.status);
  const timeline =
    request.statusHistory.length > 0
      ? request.statusHistory
      : [{ id: 'current', oldStatus: null, newStatus: request.status, createdAt: request.createdAt }];

  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
        <main className="rounded-lg border border-border bg-card p-6 shadow-card">
          <p className="text-sm font-bold uppercase text-accent">Статус заявки</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{request.requestNumber}</h1>
              <p className="mt-2 text-sm text-muted">
                Створено {formatDate(request.createdAt)} · оновлено {formatDate(request.updatedAt)}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          <div className="mt-6 rounded-lg border border-accent/25 bg-[#F7F1E8] p-5">
            <h2 className="text-xl font-bold text-foreground">{statusMeta.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{statusMeta.description}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Джерело" value={REQUEST_SOURCE_LABELS[request.source]} />
            <Info label="Тип техніки" value={request.equipmentType ?? '—'} />
            <Info label="Компанія" value={request.companyName ?? '—'} />
            <Info label="Останнє оновлення" value={formatDate(request.updatedAt)} />
          </div>

          <div className="mt-6 rounded-md border border-border bg-surface-muted p-4">
            <p className="text-xs font-bold uppercase text-muted">Короткий опис</p>
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-foreground">{request.description}</p>
          </div>

          <p className="mt-6 rounded-md border border-border bg-card p-4 text-sm leading-6 text-muted">
            Менеджер Kairos Parts звʼяжеться з вами після обробки заявки або наступного оновлення статусу.
          </p>
        </main>

        <aside className="rounded-lg border border-border bg-card p-6 shadow-card">
          <p className="text-sm font-bold uppercase text-accent">Історія статусів</p>
          <div className="mt-5 grid gap-4">
            {timeline.map((item) => (
              <div key={item.id} className="relative border-l-2 border-accent/30 pl-4">
                <div className="absolute -left-[7px] top-1 size-3 rounded-full bg-accent" />
                <p className="text-sm font-bold text-foreground">{REQUEST_STATUS_LABELS[item.newStatus]}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
