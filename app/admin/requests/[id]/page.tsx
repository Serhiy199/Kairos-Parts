import Link from 'next/link';
import { notFound } from 'next/navigation';

import { assignAdminRequestManager, addAdminRequestComment, updateAdminRequestStatus } from '@/app/admin/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCE_LABELS } from '@/lib/requests/sources';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    'status-updated': 'Статус оновлено.',
    assigned: 'Відповідального менеджера оновлено.',
    'comment-added': 'Внутрішній коментар додано.',
    'admin-only': 'Призначати менеджера може тільки ADMIN.',
    'status-error': 'Не вдалося оновити статус.',
    'assign-error': 'Не вдалося призначити менеджера.',
    'comment-error': 'Коментар не може бути порожнім.',
    'manager-not-found': 'Менеджера не знайдено.'
  };

  return result ? messages[result] : null;
}

export default async function AdminRequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const session = await requireCrmSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [request, managers] = await Promise.all([
    prisma.request.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            vehicles: { orderBy: { createdAt: 'desc' } },
            documents: { orderBy: { createdAt: 'desc' } }
          }
        },
        category: true,
        subcategory: true,
        manufacturer: true,
        vehicle: true,
        assignedManager: { select: { id: true, name: true, email: true, role: true } },
        files: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        comments: {
          where: { internal: true },
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true, email: true, role: true } } }
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: { changedByUser: { select: { name: true, email: true, role: true } } }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: { in: ['MANAGER', 'ADMIN'] } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, role: true }
    })
  ]);

  if (!request) {
    notFound();
  }

  const message = resultMessage(query.result);
  const publicStatusUrl = `/request/status/${request.publicStatusToken}`;
  const contactName = request.client?.contactName ?? request.guestName ?? 'Гість';
  const companyName = request.client?.companyName ?? request.companyName ?? '—';
  const phone = request.client?.phone ?? request.guestPhone ?? '—';
  const email = request.client?.email ?? request.guestEmail ?? '—';

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card xl:flex-row xl:items-start">
        <div>
          <Link href="/admin/requests" className="text-sm font-semibold text-muted transition hover:text-accent">← До списку заявок</Link>
          <p className="mt-4 text-sm font-bold uppercase text-accent">Картка заявки</p>
          <h2 className="mt-2 text-3xl font-bold text-foreground">{request.requestNumber}</h2>
          <p className="mt-2 text-sm text-muted">
            {REQUEST_SOURCE_LABELS[request.source]} · створено {request.createdAt.toLocaleString('uk-UA')} · оновлено {request.updatedAt.toLocaleString('uk-UA')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <div className="rounded-md border border-border p-4">
            <p className="text-xs font-bold uppercase text-muted">Статус</p>
            <div className="mt-2"><StatusBadge status={request.status} /></div>
          </div>
          <div className="rounded-md border border-border p-4">
            <p className="text-xs font-bold uppercase text-muted">Менеджер</p>
            <p className="mt-2 text-sm font-bold text-foreground">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</p>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <main className="grid gap-6">
          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Контактні дані</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Info label="Контакт" value={contactName} />
              <Info label="Компанія" value={companyName} />
              <Info label="Телефон" value={phone} />
              <Info label="Email" value={email} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Потреба</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Info label="Категорія" value={request.category?.name ?? '—'} />
              <Info label="Підкатегорія" value={request.subcategory?.name ?? '—'} />
              <Info label="Виробник" value={request.manufacturer?.name ?? '—'} />
              <Info label="Тип техніки" value={request.equipmentType ?? '—'} />
              <Info label="Модель" value={request.model ?? '—'} />
              <Info label="VIN / серійний номер" value={request.vinOrSerial ?? '—'} />
            </div>
            <div className="mt-5 rounded-md border border-border bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase text-muted">Опис</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{request.description}</p>
            </div>
          </section>

          {request.vehicle ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-card">
              <p className="text-sm font-bold uppercase text-accent">Привʼязана техніка</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="Тип" value={request.vehicle.type} />
                <Info label="Виробник" value={request.vehicle.manufacturer} />
                <Info label="Модель" value={request.vehicle.model} />
                <Info label="Рік" value={request.vehicle.year ? String(request.vehicle.year) : '—'} />
                <Info label="VIN / серійний номер" value={request.vehicle.vinOrSerial ?? '—'} />
                <Info label="Коментар" value={request.vehicle.comment ?? '—'} />
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Файли і документи</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FileList title="Файли заявки" items={request.files.map((file) => ({ id: file.id, fileName: file.fileName, mimeType: file.mimeType, size: file.size, url: file.fileUrl }))} />
              <FileList title="Документи заявки" items={request.documents.map((document) => ({ id: document.id, fileName: document.fileName, mimeType: document.mimeType, size: document.size, url: document.fileUrl }))} />
            </div>
            <p className="mt-4 text-xs text-muted">Private storage paths не показуються. Якщо безпечне public URL не налаштоване, CRM бачить тільки metadata.</p>
          </section>

          {request.client ? (
            <section className="rounded-lg border border-border bg-card p-6 shadow-card">
              <p className="text-sm font-bold uppercase text-accent">Клієнтська база</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="font-bold text-foreground">Техніка клієнта</h3>
                  <div className="mt-3 grid gap-2">
                    {request.client.vehicles.length === 0 ? <p className="text-sm text-muted">Техніки немає.</p> : request.client.vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="rounded-md border border-border p-3 text-sm text-muted">
                        <span className="font-bold text-foreground">{vehicle.manufacturer} {vehicle.model}</span> · {vehicle.type}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Документи клієнта</h3>
                  <div className="mt-3 grid gap-2">
                    {request.client.documents.length === 0 ? <p className="text-sm text-muted">Документів немає.</p> : request.client.documents.map((document) => (
                      <div key={document.id} className="rounded-md border border-border p-3 text-sm text-muted">
                        <span className="font-bold text-foreground">{document.fileName}</span> · {formatSize(document.size)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Внутрішні коментарі</p>
            <form action={addAdminRequestComment} className="mt-4 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <textarea name="message" required rows={4} placeholder="Додати внутрішній коментар для CRM" className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
              <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">Додати коментар</button>
            </form>
            <div className="mt-6 grid gap-3">
              {request.comments.length === 0 ? <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Внутрішніх коментарів ще немає.</p> : request.comments.map((comment) => (
                <article key={comment.id} className="rounded-md border border-border p-4">
                  <p className="text-sm leading-6 text-foreground">{comment.message}</p>
                  <p className="mt-3 text-xs text-muted">{comment.author?.name ?? comment.author?.email ?? 'Користувач'} · {comment.createdAt.toLocaleString('uk-UA')}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="grid h-fit gap-6">
          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Дії</p>
            <form action={updateAdminRequestStatus} className="mt-4 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Статус
                <select name="status" defaultValue={request.status} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
                  {REQUEST_STATUSES.map((status) => <option key={status} value={status}>{REQUEST_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <button className="rounded-md bg-accent px-4 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">Оновити статус</button>
            </form>

            <form action={assignAdminRequestManager} className="mt-6 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                Відповідальний
                <select name="assignedManagerId" defaultValue={request.assignedManagerId ?? ''} disabled={session.user.role !== 'ADMIN'} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent disabled:bg-surface-muted disabled:text-muted">
                  <option value="">Не призначено</option>
                  {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name ?? manager.email} · {manager.role}</option>)}
                </select>
              </label>
              {session.user.role === 'ADMIN' ? (
                <button className="rounded-md border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">Призначити</button>
              ) : (
                <p className="text-xs leading-5 text-muted">MANAGER бачить відповідального, але призначення на Day 9 доступне тільки ADMIN.</p>
              )}
            </form>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Public status</p>
            <Link href={publicStatusUrl} className="mt-3 block break-all text-sm font-semibold text-foreground transition hover:text-accent">
              {publicStatusUrl}
            </Link>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Історія статусів</p>
            <div className="mt-4 grid gap-3">
              {request.statusHistory.length === 0 ? <p className="text-sm text-muted">Історії ще немає.</p> : request.statusHistory.map((item) => (
                <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                  <StatusBadge status={item.newStatus} />
                  <p className="mt-2 text-xs text-muted">{item.changedByUser?.name ?? item.changedByUser?.email ?? 'Система'} · {item.createdAt.toLocaleString('uk-UA')}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
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

function FileList({ title, items }: { title: string; items: Array<{ id: string; fileName: string; mimeType: string; size: number; url: string | null }> }) {
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-bold text-foreground">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <p className="text-sm text-muted">Немає файлів.</p> : items.map((item) => (
          <div key={item.id} className="rounded-md bg-surface-muted p-3 text-sm text-muted">
            <p className="font-bold text-foreground">{item.fileName}</p>
            <p className="mt-1">{item.mimeType} · {formatSize(item.size)} · {item.url ? 'Посилання доступне' : 'Приватне сховище'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
