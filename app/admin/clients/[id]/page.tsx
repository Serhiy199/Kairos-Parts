import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      vehicles: {
        orderBy: { createdAt: 'desc' },
        include: {
          requestItems: {
            orderBy: { createdAt: 'desc' },
            include: {
              request: {
                select: {
                  id: true,
                  requestNumber: true,
                  status: true,
                  createdAt: true
                }
              }
            }
          }
        }
      },
      documents: { orderBy: { createdAt: 'desc' } },
      requests: {
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          assignedManager: { select: { name: true, email: true } }
        }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const contactName = client.contactName ?? ([client.firstName, client.lastName].filter(Boolean).join(' ') || client.user.name || 'Клієнт');

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href="/admin/clients" className="text-sm font-semibold text-muted transition hover:text-accent">← До клієнтів</Link>
        <p className="mt-4 text-sm font-bold uppercase text-accent">Клієнт</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground">{contactName}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Компанія" value={client.companyName ?? '—'} />
          <Info label="Телефон" value={client.phone ?? client.user.phone ?? '—'} />
          <Info label="Email" value={client.email ?? client.user.email ?? '—'} />
          <Info label="Тип" value={client.clientType === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Техніка клієнта</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {client.vehicles.length === 0 ? <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">Техніки немає.</p> : client.vehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-md border border-border p-4">
              <h3 className="font-bold text-foreground">{vehicle.manufacturer} {vehicle.model}</h3>
              <p className="mt-2 text-sm text-muted">{vehicle.type}{vehicle.year ? ` · ${vehicle.year} р.` : ''}</p>
              <p className="mt-2 text-sm text-muted">{vehicle.vinOrSerial ?? 'VIN / серійний номер не вказано'}</p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase text-accent">Історія підібраних запчастин</p>
                <div className="mt-3 grid gap-2">
                  {vehicle.requestItems.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted">Для цієї техніки ще немає підібраних позицій.</p>
                  ) : (
                    vehicle.requestItems.map((item) => (
                      <div key={item.id} className="rounded-md bg-surface-muted p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Link href={`/admin/requests/${item.request.id}`} className="font-bold text-foreground transition hover:text-accent">
                            {item.request.requestNumber} · {item.name}
                          </Link>
                          <StatusBadge status={item.request.status} />
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {item.request.createdAt.toLocaleDateString('uk-UA')} · {item.brand ?? 'Бренд —'} · {item.catalogNumber ?? 'Каталог —'} · {item.quantity} {item.unit}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {item.availability ?? 'Наявність —'}{item.deliveryTime ? ` · ${item.deliveryTime}` : ''}{item.supplierName ? ` · ${item.supplierName}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Заявки клієнта</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">№</th>
                <th className="px-4 py-3 font-bold">Категорія</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Менеджер</th>
                <th className="px-4 py-3 font-bold">Дата</th>
              </tr>
            </thead>
            <tbody>
              {client.requests.map((request) => (
                <tr key={request.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><Link href={`/admin/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">{request.requestNumber}</Link></td>
                  <td className="px-4 py-3 text-muted">{request.category?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-4 py-3 text-muted">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</td>
                  <td className="px-4 py-3 text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {client.requests.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Заявок немає.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Документи клієнта</p>
        <div className="mt-4 grid gap-3">
          {client.documents.length === 0 ? <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">Документів немає.</p> : client.documents.map((document) => (
            <div key={document.id} className="rounded-md border border-border p-4 text-sm text-muted">
              <span className="font-bold text-foreground">{document.fileName}</span> · {document.mimeType} · {formatSize(document.size)} · {document.fileUrl ? 'Посилання доступне' : 'Приватне сховище'}
            </div>
          ))}
        </div>
      </section>
    </div>
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
