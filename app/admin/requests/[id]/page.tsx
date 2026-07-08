import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  assignAdminRequestManager,
  addAdminRequestComment,
  createAdminRequestItem,
  deleteAdminRequestItem,
  runAdminRequestOcr,
  updateAdminRequestItem,
  updateAdminOcrCorrection,
  updateAdminRequestStatus
} from '@/app/admin/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { ActionIcon } from '@/components/ui/action-icons';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCE_LABELS } from '@/lib/requests/sources';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatMoney(value: { toString: () => string } | null, currency: string) {
  return value ? `${value.toString()} ${currency}` : '—';
}

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    'status-updated': 'Статус оновлено.',
    assigned: 'Відповідального менеджера оновлено.',
    'comment-added': 'Внутрішній коментар додано.',
    'admin-only': 'Призначати менеджера може тільки ADMIN.',
    'status-error': 'Не вдалося оновити статус.',
    'ocr-created': 'OCR виконано. Перевірте результат нижче.',
    'ocr-corrected': 'OCR-текст оновлено.',
    'ocr-error': 'Не вдалося запустити OCR.',
    'ocr-correction-error': 'Не вдалося зберегти OCR-корекцію.',
    'assign-error': 'Не вдалося призначити менеджера.',
    'comment-error': 'Коментар не може бути порожнім.',
    'manager-not-found': 'Менеджера не знайдено.',
    'item-created': 'Позицію додано.',
    'item-updated': 'Позицію оновлено.',
    'item-deleted': 'Позицію видалено.',
    'item-error': 'Перевірте дані позиції.',
    'item-not-found': 'Позицію не знайдено.'
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
        items: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        ocrResults: {
          orderBy: { createdAt: 'desc' },
          include: { file: { select: { id: true, fileName: true, mimeType: true } } }
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 8
        },
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

          <RequestItemsSection requestId={request.id} items={request.items} />

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Файли і документи</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FileList title="Файли заявки" items={request.files.map((file) => ({ id: file.id, fileName: file.fileName, mimeType: file.mimeType, size: file.size, url: file.fileUrl ?? `/api/admin/files/${file.id}` }))} />
              <FileList title="Документи заявки" items={request.documents.map((document) => ({ id: document.id, fileName: document.fileName, mimeType: document.mimeType, size: document.size, url: document.fileUrl }))} />
            </div>
            <p className="mt-4 text-xs text-muted">Private storage paths не показуються. Файли заявки відкриваються через захищений CRM download route.</p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-accent">OCR-підказки</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  OCR допомагає менеджеру побачити текст або номери з фото. Результат є підказкою і потребує перевірки.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-border bg-surface-muted p-4">
              <h3 className="font-bold text-foreground">Запустити OCR для фото</h3>
              <div className="mt-3 grid gap-2">
                {request.files.filter((file) => file.mimeType.startsWith('image/')).length === 0 ? (
                  <p className="text-sm text-muted">Фото для OCR немає.</p>
                ) : (
                  request.files.filter((file) => file.mimeType.startsWith('image/')).map((file) => (
                    <form key={file.id} action={runAdminRequestOcr} className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="fileId" value={file.id} />
                      <div>
                        <p className="text-sm font-bold text-foreground">{file.fileName}</p>
                        <p className="mt-1 text-xs text-muted">{file.mimeType} · {formatSize(file.size)}</p>
                      </div>
                      <button className="inline-flex items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-bold text-[#8A5B24] transition hover:bg-accent/10">
                        <ActionIcon name="search" />
                        Запустити OCR
                      </button>
                    </form>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {request.ocrResults.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">OCR ще не виконано.</p>
              ) : (
                request.ocrResults.map((result) => (
                  <article key={result.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{result.file?.fileName ?? 'Без файлу'}</p>
                        <p className="mt-1 text-xs text-muted">
                          {result.provider} · {result.confidence !== null ? `confidence ${result.confidence.toFixed(1)}` : 'confidence —'} · {result.createdAt.toLocaleString('uk-UA')}
                        </p>
                      </div>
                      {result.correctedText ? <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">Виправлено</span> : null}
                    </div>
                    <div className="mt-4 rounded-md bg-surface-muted p-3">
                      <p className="text-xs font-bold uppercase text-muted">Розпізнаний текст</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{result.rawText}</p>
                    </div>
                    {result.possiblePartNumber || result.possibleSerialNumber ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Info label="Ймовірний артикул" value={result.possiblePartNumber ?? '—'} />
                        <Info label="Ймовірний серійний номер" value={result.possibleSerialNumber ?? '—'} />
                      </div>
                    ) : null}
                    <form action={updateAdminOcrCorrection} className="mt-4 grid gap-3">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="ocrResultId" value={result.id} />
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        Виправлений OCR-текст
                        <textarea
                          name="correctedText"
                          rows={4}
                          defaultValue={result.correctedText ?? result.rawText}
                          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                        />
                      </label>
                      <button className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
                        <ActionIcon name="save" />
                        Зберегти виправлення
                      </button>
                    </form>
                  </article>
                ))
              )}
            </div>
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
              <button className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                <ActionIcon name="comment" />
                Додати коментар
              </button>
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
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                <ActionIcon name="check" />
                Оновити статус
              </button>
              <p className="text-xs leading-5 text-muted">
                Після зміни статусу система створить notification record і спробує повідомити клієнта через доступний канал.
              </p>
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
                <button className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
                  <ActionIcon name="save" />
                  Призначити
                </button>
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

          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Повідомлення</p>
            <div className="mt-4 grid gap-3">
              {request.notifications.length === 0 ? <p className="text-sm text-muted">Повідомлень ще немає.</p> : request.notifications.map((notification) => (
                <div key={notification.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-bold text-foreground">{notification.channel} · {notification.status}</p>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-muted">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted">{notification.createdAt.toLocaleString('uk-UA')}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

type RequestItemView = {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  supplierName: string | null;
  availability: string | null;
  deliveryTime: string | null;
  purchasePrice: { toString: () => string } | null;
  salePrice: { toString: () => string } | null;
  currency: string;
  comment: string | null;
  visibleToClient: boolean;
};

function RequestItemsSection({ requestId, items }: { requestId: string; items: RequestItemView[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Підібрані позиції</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Номенклатура та каталожні номери</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Додавайте структуровані позиції запчастин. Якщо заявка привʼязана до техніки, позиції автоматично зʼявляться в історії цієї одиниці.
          </p>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{items.length} позицій</span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-muted">
              <th className="px-4 py-3 font-bold">Запчастина</th>
              <th className="px-4 py-3 font-bold">Номери</th>
              <th className="px-4 py-3 font-bold">К-сть</th>
              <th className="px-4 py-3 font-bold">Наявність</th>
              <th className="px-4 py-3 font-bold">Ціни</th>
              <th className="px-4 py-3 font-bold">Клієнт</th>
              <th className="px-4 py-3 font-bold">Дії</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{item.brand ?? 'Бренд не вказано'}</p>
                  {item.comment ? <p className="mt-2 max-w-xs text-xs leading-5 text-muted">{item.comment}</p> : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  <p>Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
                  <p className="mt-1">Аналог: <span className="font-semibold text-foreground">{item.analogNumber ?? '—'}</span></p>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{item.quantity} {item.unit}</td>
                <td className="px-4 py-3 text-muted">
                  <p>{item.availability ?? '—'}</p>
                  <p className="mt-1 text-xs">{item.deliveryTime ?? 'Термін не вказано'}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  <p>Закупівля: {formatMoney(item.purchasePrice, item.currency)}</p>
                  <p className="mt-1">Продаж: {formatMoney(item.salePrice, item.currency)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.visibleToClient ? 'bg-[#E7F6EC] text-success' : 'bg-surface-muted text-muted'}`}>
                    {item.visibleToClient ? 'Видимо' : 'Приховано'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-bold text-foreground transition hover:text-accent">Редагувати</summary>
                    <div className="mt-4 w-[720px] max-w-[80vw] rounded-md border border-border bg-card p-4 shadow-card">
                      <RequestItemForm action={updateAdminRequestItem} requestId={requestId} item={item} submitLabel="Зберегти позицію" />
                    </div>
                  </details>
                  <form action={deleteAdminRequestItem} className="mt-3">
                    <input type="hidden" name="requestId" value={requestId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="text-sm font-bold text-danger transition hover:opacity-80">Видалити</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="border-t border-border p-5 text-sm text-muted">
            Позиції ще не додані. Додайте першу позицію, щоб зберегти номенклатуру та каталожні номери по цій заявці.
          </p>
        ) : null}
      </div>

      <details className="mt-5 rounded-md border border-border bg-surface-muted p-4" open={items.length === 0}>
        <summary className="cursor-pointer text-sm font-bold text-foreground">Додати позицію</summary>
        <div className="mt-4">
          <RequestItemForm action={createAdminRequestItem} requestId={requestId} submitLabel="Додати позицію" />
        </div>
      </details>
    </section>
  );
}

function RequestItemForm({
  action,
  requestId,
  item,
  submitLabel
}: {
  action: (formData: FormData) => void | Promise<void>;
  requestId: string;
  item?: RequestItemView;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField name="name" label="Назва запчастини" required defaultValue={item?.name} />
        <TextField name="brand" label="Бренд" defaultValue={item?.brand} />
        <TextField name="catalogNumber" label="Каталожний номер" defaultValue={item?.catalogNumber} />
        <TextField name="analogNumber" label="Аналоговий номер" defaultValue={item?.analogNumber} />
        <TextField name="quantity" label="Кількість" type="number" min="1" defaultValue={String(item?.quantity ?? 1)} />
        <TextField name="unit" label="Одиниця" defaultValue={item?.unit ?? 'шт'} />
        <TextField name="supplierName" label="Постачальник" defaultValue={item?.supplierName} />
        <TextField name="availability" label="Наявність" defaultValue={item?.availability} />
        <TextField name="deliveryTime" label="Термін постачання" defaultValue={item?.deliveryTime} />
        <TextField name="purchasePrice" label="Ціна закупівлі" type="number" min="0" step="0.01" defaultValue={item?.purchasePrice?.toString()} />
        <TextField name="salePrice" label="Ціна продажу" type="number" min="0" step="0.01" defaultValue={item?.salePrice?.toString()} />
        <TextField name="currency" label="Валюта" defaultValue={item?.currency ?? 'UAH'} />
      </div>
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Коментар
        <textarea
          name="comment"
          rows={3}
          defaultValue={item?.comment ?? ''}
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
        <input type="checkbox" name="visibleToClient" defaultChecked={item?.visibleToClient ?? false} className="size-4 accent-[var(--accent)]" />
        Видимо клієнту
      </label>
      <button className="inline-flex w-fit items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
        {submitLabel}
      </button>
    </form>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required,
  type = 'text',
  min,
  step
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        min={min}
        step={step}
        defaultValue={defaultValue ?? ''}
        className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
    </label>
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
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="font-bold text-foreground transition hover:text-accent">
                {item.fileName}
              </a>
            ) : (
              <p className="font-bold text-foreground">{item.fileName}</p>
            )}
            <p className="mt-1">{item.mimeType} · {formatSize(item.size)} · {item.url ? 'Посилання доступне' : 'Приватне сховище'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
