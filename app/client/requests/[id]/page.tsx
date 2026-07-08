import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatMoney(value: { toString: () => string } | null, currency: string) {
  return value ? `${value.toString()} ${currency}` : null;
}

export default async function ClientRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    return <ClientDbBlocker />;
  }

  const request = await prisma.request.findFirst({
    where: { id, clientId: profile.id },
    include: {
      category: true,
      manufacturer: true,
      items: {
        where: { visibleToClient: true },
        orderBy: { createdAt: 'desc' }
      },
      files: true
    }
  });

  if (!request) {
    notFound();
  }

  const details = [
    ['Дата створення', request.createdAt.toLocaleString('uk-UA')],
    ['Оновлено', request.updatedAt.toLocaleString('uk-UA')],
    ['Категорія', request.category?.name ?? '—'],
    ['Виробник', request.manufacturer?.name ?? '—'],
    ['Модель', request.model ?? '—'],
    ['VIN / серійний номер', request.vinOrSerial ?? '—']
  ];

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Заявка</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">{request.requestNumber}</h2>
          </div>
          <StatusBadge status={request.status} />
        </div>
        <p className="mt-5 whitespace-pre-line text-sm leading-6 text-muted">{request.description}</p>
        <div className="mt-5">
          <Link href={`/request/status/${request.publicStatusToken}`} className="text-sm font-bold text-foreground transition hover:text-accent">
            Public status URL
          </Link>
        </div>
        <div className="mt-5">
          <Link href={`/request?source=client&repeatRequestId=${request.id}`} className="inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
            Повторити заявку
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {request.items.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-foreground">Підібрані позиції</h3>
          <p className="mt-2 text-sm text-muted">Менеджер показує тут тільки позиції, які готові для перегляду клієнтом.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-muted">
                  <th className="px-4 py-3 font-bold">Запчастина</th>
                  <th className="px-4 py-3 font-bold">Номери</th>
                  <th className="px-4 py-3 font-bold">К-сть</th>
                  <th className="px-4 py-3 font-bold">Наявність</th>
                  <th className="px-4 py-3 font-bold">Ціна</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-muted">{item.brand ?? 'Бренд уточнюється'}</p>
                      {item.comment ? <p className="mt-2 text-xs leading-5 text-muted">{item.comment}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <p>Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
                      <p className="mt-1">Аналог: <span className="font-semibold text-foreground">{item.analogNumber ?? '—'}</span></p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-muted">
                      <p>{item.availability ?? 'Уточнюється'}</p>
                      <p className="mt-1 text-xs">{item.deliveryTime ?? 'Термін уточнюється'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(item.salePrice, item.currency) ?? 'Уточнюється'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h3 className="text-lg font-bold text-foreground">Прикріплені файли</h3>
        <div className="mt-4 grid gap-2">
          {request.files.length > 0 ? (
            request.files.map((file) => (
              <div key={file.id} className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
                {file.fileName} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Файлів немає.</p>
          )}
        </div>
      </div>
    </div>
  );
}
