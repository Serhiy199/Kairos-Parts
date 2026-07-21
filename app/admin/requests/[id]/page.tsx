import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import {
  assignAdminRequestManager,
  addAdminRequestComment,
  cancelAdminInvoice,
  createAdminInvoice,
  createAdminRequestDocument,
  createAdminRequestItem,
  deleteAdminRequestDocument,
  deleteAdminRequestItem,
  runAdminRequestOcr,
  sendAdminInvoice,
  sendAdminRequestItemsForApproval,
  markAdminInvoicePaid,
  updateAdminRequestDocument,
  updateAdminRequestItem,
  updateAdminOcrCorrection,
  updateAdminRequestStatus
} from '@/app/admin/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { ActionIcon } from '@/components/ui/action-icons';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { calculateInvoiceLineTotal, calculateInvoiceTotals, formatInvoiceMoney } from '@/lib/invoices/totals';
import { INVOICE_STATUS_LABELS } from '@/lib/invoices/validation';
import { PART_MANUFACTURERS } from '@/lib/parts/part-manufacturers';
import { prisma } from '@/lib/prisma';
import { REQUEST_DOCUMENT_TYPE_LABELS, REQUEST_DOCUMENT_TYPES } from '@/lib/request-documents/validation';
import { REQUEST_SOURCE_LABELS } from '@/lib/requests/sources';
import { normalizeRequestStatusForSelection, REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatMoney(value: { toString: () => string } | null, currency: string) {
  return value ? formatInvoiceMoney(value, currency) : '—';
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
    'items-sent-for-approval': 'Позиції відправлено клієнту на погодження.',
    'items-send-empty': 'Немає нових позицій для відправлення на погодження.',
    'items-send-error': 'Не вдалося відправити позиції на погодження.',
    'item-error': 'Перевірте дані позиції.',
    'item-not-found': 'Позицію не знайдено.',
    'document-created': 'Документ додано.',
    'document-updated': 'Документ оновлено.',
    'document-deleted': 'Документ видалено.',
    'document-error': 'Перевірте дані документа.',
    'document-not-found': 'Документ не знайдено.',
    'invoice-created': 'Рахунок створено.',
    'invoice-sent': 'Рахунок надіслано клієнту.',
    'invoice-cancelled': 'Рахунок скасовано.',
    'invoice-paid': 'Рахунок позначено як оплачений.',
    'invoice-no-approved-items': 'Немає погоджених позицій для створення рахунку.',
    'invoice-not-found': 'Рахунок не знайдено.',
    'invoice-invalid-transition': 'Некоректна зміна статусу рахунку.',
    'invoice-empty': 'Не можна надіслати порожній рахунок.',
    'invoice-forbidden': 'Недостатньо прав для роботи з рахунком.',
    'invoice-seller-details-required': 'Спочатку заповніть реквізити продавця.',
    'invoice-error': 'Не вдалося обробити рахунок.'
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
        company: {
          include: {
            members: {
              orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'asc' }],
              include: { user: { include: { clientProfile: true } } }
            }
          }
        },
        manufacturer: true,
        vehicle: true,
        assignedManager: { select: { id: true, name: true, email: true, role: true } },
        files: { orderBy: { createdAt: 'desc' } },
        items: { orderBy: { createdAt: 'desc' } },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { name: true, email: true, role: true } },
            items: { orderBy: { createdAt: 'asc' } }
          }
        },
        requestDocuments: {
          orderBy: { createdAt: 'desc' },
          include: { uploadedBy: { select: { name: true, email: true, role: true } } }
        },
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
  const companyName = request.company?.name ?? request.client?.companyName ?? request.companyName ?? '—';
  const phone = request.client?.phone ?? request.guestPhone ?? '—';
  const email = request.client?.email ?? request.guestEmail ?? '—';
  const selectedRequestStatus = normalizeRequestStatusForSelection(request.status);
  const approvedInvoiceItemCount = request.items.filter((item) => item.visibleToClient && item.approvedByClient && item.includeInInvoice).length;
  const ocrImageFiles = request.files.filter((file) => file.mimeType.startsWith('image/'));

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 sm:gap-5 xl:gap-6">
      <div className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:flex-row xl:items-start xl:p-6">
        <div className="min-w-0">
          <Link href="/admin/requests" className="text-sm font-semibold text-muted transition hover:text-accent">← До списку заявок</Link>
          <p className="mt-4 text-sm font-bold uppercase text-accent">Картка заявки</p>
          <h2 className="mt-2 break-words text-2xl font-bold text-foreground sm:text-3xl">{request.requestNumber}</h2>
          <p className="mt-2 break-words text-sm text-muted">
            {REQUEST_SOURCE_LABELS[request.source]} · створено {request.createdAt.toLocaleString('uk-UA')} · оновлено {request.updatedAt.toLocaleString('uk-UA')}
          </p>
        </div>
        <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:w-[420px] xl:max-w-full xl:shrink-0">
          <div className="min-w-0 rounded-md border border-border p-4">
            <p className="text-xs font-bold uppercase text-muted">Статус</p>
            <div className="mt-2"><StatusBadge status={request.status} /></div>
          </div>
          <div className="min-w-0 rounded-md border border-border p-4">
            <p className="text-xs font-bold uppercase text-muted">Менеджер</p>
            <p className="mt-2 break-words text-sm font-bold text-foreground">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</p>
          </div>
        </div>
      </div>

      {message ? <div className="min-w-0 break-words rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{message}</div> : null}

      <div className="grid w-full min-w-0 max-w-full gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-6">
        <main className="grid min-w-0 gap-4 sm:gap-5 xl:gap-6">
          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Контактні дані</p>
            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <Info label="Контакт" value={contactName} />
              <Info label="Компанія" value={companyName} />
              <Info label="Телефон" value={phone} />
              <Info label="Email" value={email} />
            </div>
            {request.company ? (
              <div className="mt-5 min-w-0 rounded-md border border-accent/30 bg-[#FFF7E0] p-4 text-sm text-[#8A5B24]">
                <p className="break-words font-bold text-foreground">Company account: {request.company.name}</p>
                <p className="mt-1 break-words">ЄДРПОУ: {request.company.edrpou ?? '—'} · {request.company.email ?? 'email —'} · {request.company.phone ?? 'телефон —'}</p>
                <Link href={`/admin/companies/${request.company.id}`} className="mt-3 inline-flex font-bold text-foreground transition hover:text-accent">
                  Відкрити компанію
                </Link>
              </div>
            ) : null}
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Потреба</p>
            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <Info label="Виробник / марка" value={request.manufacturerName ?? request.manufacturer?.name ?? '—'} />
              <Info label="Тип техніки" value={request.equipmentType ?? '—'} />
              <Info label="Модель" value={request.model ?? '—'} />
              <Info label="Рік випуску" value={request.vehicleYear ? String(request.vehicleYear) : '—'} />
              <Info label="VIN / серійний номер" value={request.vinOrSerial ?? '—'} />
            </div>
            <div className="mt-5 min-w-0 rounded-md border border-border bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase text-muted">Опис</p>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-foreground">{request.description}</p>
            </div>
          </section>

          {request.vehicle ? (
            <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
              <p className="text-sm font-bold uppercase text-accent">Привʼязана техніка</p>
              <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
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

          <InvoicesSection requestId={request.id} invoices={request.invoices} approvedInvoiceItemCount={approvedInvoiceItemCount} />

          <RequestDocumentsSection requestId={request.id} documents={request.requestDocuments} />

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Файли, надані клієнтом</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Тут відображаються фото, списки, документи або інші файли, які клієнт додав під час створення заявки, через кабінет або Telegram.
            </p>
            <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
              <FileList title="Файли заявки" description="Матеріали, які клієнт передав для підбору запчастин." items={request.files.map((file) => ({ id: file.id, fileName: file.fileName, mimeType: file.mimeType, size: file.size, url: file.fileUrl ?? `/api/admin/files/${file.id}` }))} />
              <FileList title="Додаткові файли від клієнта" description="Документи або вкладення клієнта, які збережені в його профілі чи заявці." items={request.documents.map((document) => ({ id: document.id, fileName: document.fileName, mimeType: document.mimeType, size: document.size, url: document.fileUrl }))} />
            </div>
            <p className="mt-4 text-xs text-muted">Файли захищені: менеджер відкриває їх через CRM, без доступу до приватних шляхів зберігання.</p>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-accent">OCR-підказки</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {ocrImageFiles.length === 0
                    ? 'Фото або документи для розпізнавання ще не додані.'
                    : 'OCR допомагає менеджеру побачити текст, артикули або каталожні номери з фото чи документа. Результат є підказкою і потребує перевірки.'}
                </p>
              </div>
            </div>

            {ocrImageFiles.length > 0 ? (
              <div className="mt-5 rounded-md border border-border bg-surface-muted p-4">
                <h3 className="font-bold text-foreground">Запустити OCR</h3>
                <div className="mt-3 grid gap-2">
                  {ocrImageFiles.map((file) => (
                    <form key={file.id} action={runAdminRequestOcr} className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="fileId" value={file.id} />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-foreground">{file.fileName}</p>
                        <p className="mt-1 text-xs text-muted">{file.mimeType} · {formatSize(file.size)}</p>
                      </div>
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-bold text-[#8A5B24] transition hover:bg-accent/10 sm:w-auto">
                        <ActionIcon name="search" />
                        Запустити OCR
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {request.ocrResults.length === 0 ? (
                ocrImageFiles.length > 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">OCR ще не виконано.</p>
                ) : null
              ) : (
                request.ocrResults.map((result) => (
                  <article key={result.id} className="min-w-0 rounded-md border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-foreground">{result.file?.fileName ?? 'Без файлу'}</p>
                        <p className="mt-1 text-xs text-muted">
                          {result.provider} · {result.confidence !== null ? `confidence ${result.confidence.toFixed(1)}` : 'confidence —'} · {result.createdAt.toLocaleString('uk-UA')}
                        </p>
                      </div>
                      {result.correctedText ? <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">Виправлено</span> : null}
                    </div>
                    <div className="mt-4 rounded-md bg-surface-muted p-3">
                      <p className="text-xs font-bold uppercase text-muted">Розпізнаний текст</p>
                      <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-foreground">{result.rawText}</p>
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
                          className="min-w-0 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                        />
                      </label>
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted sm:w-fit">
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
            <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
              <p className="text-sm font-bold uppercase text-accent">Клієнтська база</p>
              <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground">Техніка клієнта</h3>
                  <div className="mt-3 grid gap-2">
                    {request.client.vehicles.length === 0 ? <p className="text-sm text-muted">Техніки немає.</p> : request.client.vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="rounded-md border border-border p-3 text-sm text-muted">
                        <span className="font-bold text-foreground">{vehicle.manufacturer} {vehicle.model}</span> · {vehicle.type}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
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

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Внутрішні коментарі</p>
            <form action={addAdminRequestComment} className="mt-4 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <textarea name="message" required rows={4} placeholder="Додати внутрішній коментар для CRM" className="min-w-0 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover sm:w-fit">
                <ActionIcon name="comment" />
                Додати коментар
              </button>
            </form>
            <div className="mt-6 grid gap-3">
              {request.comments.length === 0 ? <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Внутрішніх коментарів ще немає.</p> : request.comments.map((comment) => (
                <article key={comment.id} className="min-w-0 rounded-md border border-border p-4">
                  <p className="break-words text-sm leading-6 text-foreground">{comment.message}</p>
                  <p className="mt-3 break-words text-xs text-muted">{comment.author?.name ?? comment.author?.email ?? 'Користувач'} · {comment.createdAt.toLocaleString('uk-UA')}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="grid h-fit min-w-0 gap-4 sm:gap-5 xl:sticky xl:top-6 xl:gap-6">
          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Дії</p>
            <form action={updateAdminRequestStatus} className="mt-4 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                Статус
                <select name="status" defaultValue={selectedRequestStatus} className="h-11 w-full min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
                  {REQUEST_STATUSES.map((status) => <option key={status} value={status}>{REQUEST_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                <ActionIcon name="check" />
                Оновити статус
              </button>
              <p className="text-xs leading-5 text-muted">
                Після зміни статусу система створить notification record і спробує повідомити клієнта через доступний канал.
              </p>
            </form>

            <form action={assignAdminRequestManager} className="mt-6 grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                Відповідальний
                <select name="assignedManagerId" defaultValue={request.assignedManagerId ?? ''} disabled={session.user.role !== 'ADMIN'} className="h-11 w-full min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent disabled:bg-surface-muted disabled:text-muted">
                  <option value="">Не призначено</option>
                  {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name ?? manager.email} · {manager.role}</option>)}
                </select>
              </label>
              {session.user.role === 'ADMIN' ? (
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
                  <ActionIcon name="save" />
                  Призначити
                </button>
              ) : (
                <p className="text-xs leading-5 text-muted">MANAGER бачить відповідального, але призначення на Day 9 доступне тільки ADMIN.</p>
              )}
            </form>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Public status</p>
            <Link href={publicStatusUrl} className="mt-3 block min-w-0 break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere] transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {publicStatusUrl}
            </Link>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Історія статусів</p>
            <div className="mt-4 grid gap-3">
              {request.statusHistory.length === 0 ? <p className="text-sm text-muted">Історії ще немає.</p> : request.statusHistory.map((item) => (
                <div key={item.id} className="min-w-0 rounded-md border border-border p-3 text-sm">
                  <StatusBadge status={item.newStatus} />
                  <p className="mt-2 break-words text-xs leading-5 text-muted">{item.changedByUser?.name ?? item.changedByUser?.email ?? 'Система'} · {item.createdAt.toLocaleString('uk-UA')}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
            <p className="text-sm font-bold uppercase text-accent">Повідомлення</p>
            <div className="mt-4 grid gap-3">
              {request.notifications.length === 0 ? <p className="text-sm text-muted">Повідомлень ще немає.</p> : request.notifications.map((notification) => (
                <div key={notification.id} className="min-w-0 rounded-md border border-border p-3 text-sm">
                  <p className="break-words font-bold text-foreground">{notification.channel} · {notification.status}</p>
                  <p className="mt-2 break-words whitespace-pre-wrap text-xs leading-5 text-muted">{notification.message}</p>
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
  quantity: number;
  unit: string;
  supplierName: string | null;
  availability: string | null;
  purchasePrice: { toString: () => string } | null;
  salePrice: { toString: () => string } | null;
  currency: string;
  comment: string | null;
  visibleToClient: boolean;
  approvedByClient: boolean;
  includeInInvoice: boolean;
  approvedAt: Date | null;
};

type InvoiceItemView = {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  price: { toString: () => string };
  total: { toString: () => string };
  comment: string | null;
};

type InvoiceView = {
  id: string;
  invoiceNumber: string;
  status: keyof typeof INVOICE_STATUS_LABELS;
  currency: string;
  subtotal: { toString: () => string };
  totalAmount: { toString: () => string };
  managerComment: string | null;
  clientComment: string | null;
  sellerSnapshot: Prisma.JsonValue | null;
  buyerSnapshot: Prisma.JsonValue | null;
  sentAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string | null; role: string } | null;
  items: InvoiceItemView[];
};

type BillingSnapshotView = {
  legalName?: string | null;
  edrpou?: string | null;
  ipn?: string | null;
  iban?: string | null;
  bankName?: string | null;
  mfo?: string | null;
  legalAddress?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  vatPayer?: boolean | null;
};

function asBillingSnapshot(value: Prisma.JsonValue | null): BillingSnapshotView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as BillingSnapshotView;
}

function BillingSnapshotCard({ title, snapshot, buyer = false }: { title: string; snapshot: BillingSnapshotView | null; buyer?: boolean }) {
  if (!snapshot) {
    return (
      <div className="rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
        {title}: реквізити не збережені у snapshot цього рахунку.
      </div>
    );
  }

  const rows = [
    ['Назва', snapshot.legalName],
    ['ЄДРПОУ', snapshot.edrpou],
    ['ІПН', snapshot.ipn],
    ['IBAN', snapshot.iban],
    ['Банк', snapshot.bankName],
    ['МФО', snapshot.mfo],
    ['Юридична адреса', snapshot.legalAddress],
    ['Контактна особа', snapshot.contactPerson],
    ['Телефон', snapshot.phone],
    ['Email', snapshot.email],
    ...(buyer ? [['Платник ПДВ', snapshot.vatPayer ? 'Так' : 'Ні']] : [])
  ].filter(([, value]) => value !== undefined);

  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase text-accent">{title}</p>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
            <span className="font-semibold text-muted">{label}</span>
            <span className="min-w-0 break-words text-foreground">{value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestItemsSection({ requestId, items }: { requestId: string; items: RequestItemView[] }) {
  const hiddenItemCount = items.filter((item) => !item.visibleToClient).length;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-accent">Підібрані позиції</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Номенклатура та каталожні номери</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Додавайте позиції як внутрішню чернетку. Коли список готовий, відправте позиції клієнту на погодження.
          </p>
        </div>
        <div className="grid w-full min-w-0 gap-3 xl:w-auto xl:min-w-[280px] xl:max-w-[320px] xl:shrink-0">
          <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{items.length} позицій</span>
          <p className="text-xs leading-5 text-muted">
            {hiddenItemCount > 0
              ? `${hiddenItemCount} нових позицій ще не відправлено клієнту.`
              : 'Усі додані позиції вже відправлені або позицій ще немає.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 max-w-full gap-3 rounded-md border border-border p-3 sm:p-4">
        {items.map((item) => {
          const itemTotal = item.salePrice ? calculateInvoiceLineTotal(item.quantity, item.salePrice) : null;

          return (
          <article key={item.id} className="min-w-0 rounded-md border border-border bg-card p-3 sm:p-4">
            <div className="grid min-w-0 gap-4 min-[1800px]:grid-cols-[minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(80px,0.5fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,1fr)]">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Запчастина</p>
                <p className="mt-2 break-words font-bold text-foreground">{item.name}</p>
                <p className="mt-1 break-words text-xs text-muted">{item.brand ?? 'Виробник не вказано'}</p>
                {item.comment ? <p className="mt-2 break-words text-xs leading-5 text-muted">{item.comment}</p> : null}
              </div>
              <div className="min-w-0 text-sm text-muted">
                <p className="text-xs font-bold uppercase text-muted">Номери</p>
                <p className="mt-2 break-words">Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">К-сть</p>
                <p className="mt-2 font-semibold text-foreground">{item.quantity} {item.unit}</p>
              </div>
              <div className="min-w-0 text-sm text-muted">
                <p className="text-xs font-bold uppercase text-muted">Наявність</p>
                <p className="mt-2">{item.availability ?? '—'}</p>
              </div>
              <div className="min-w-0 text-sm text-muted">
                <p className="text-xs font-bold uppercase text-muted">Ціна без ПДВ</p>
                <p className="mt-2 font-semibold text-foreground">{formatMoney(item.salePrice, item.currency)}</p>
              </div>
              <div className="min-w-0 text-sm text-muted">
                <p className="text-xs font-bold uppercase text-muted">Сума без ПДВ</p>
                <p className="mt-2 font-semibold text-foreground">{formatMoney(itemTotal, item.currency)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Клієнт</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!item.visibleToClient ? (
                    <span className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-muted">Не відправлено клієнту</span>
                  ) : null}
                  {item.visibleToClient ? (
                    item.approvedByClient ? (
                      <span className="inline-flex rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">Погоджено клієнтом</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-[#FFF7E0] px-2.5 py-1 text-xs font-bold text-[#8A5B24]">Очікує погодження</span>
                    )
                  ) : null}
                  {item.visibleToClient ? (
                    item.includeInInvoice ? (
                      <span className="inline-flex rounded-full bg-[#E8F1FF] px-2.5 py-1 text-xs font-bold text-info">Включено у рахунок</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-muted">Не включено у рахунок</span>
                    )
                  ) : null}
                </div>
                {item.approvedAt ? <p className="mt-2 text-xs text-muted">Погоджено: {item.approvedAt.toLocaleString('uk-UA')}</p> : null}
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <details className="group">
                <summary className="cursor-pointer break-words text-sm font-bold text-foreground transition hover:text-accent">Редагувати позицію</summary>
                <div className="mt-4 min-w-0 rounded-md border border-border bg-surface-muted p-3 sm:p-4">
                  <RequestItemForm action={updateAdminRequestItem} requestId={requestId} item={item} submitLabel="Зберегти позицію" />
                </div>
              </details>
              <form action={deleteAdminRequestItem} className="sm:justify-self-end">
                <input type="hidden" name="requestId" value={requestId} />
                <input type="hidden" name="itemId" value={item.id} />
                <button className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-danger/30 px-4 py-2 text-sm font-bold text-danger transition hover:bg-danger/10 sm:w-auto">Видалити</button>
              </form>
            </div>
          </article>
          );
        })}
        {items.length === 0 ? (
          <p className="p-5 text-sm text-muted">
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

      <div className="mt-5 flex min-w-0 border-t border-border pt-5 sm:justify-end">
        <form action={sendAdminRequestItemsForApproval} className="w-full sm:w-auto">
          <input type="hidden" name="requestId" value={requestId} />
          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-normal rounded-md bg-accent px-4 py-3 text-center text-sm font-bold leading-5 text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto">
            <ActionIcon name="send" />
            Відправити на погодження
          </button>
        </form>
      </div>
    </section>
  );
}

function InvoicesSection({
  requestId,
  invoices,
  approvedInvoiceItemCount
}: {
  requestId: string;
  invoices: InvoiceView[];
  approvedInvoiceItemCount: number;
}) {
  const canCreateInvoice = approvedInvoiceItemCount > 0;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Рахунки</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Рахунки на основі погоджених позицій</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Рахунок формується тільки з позицій, які клієнт погодив і відмітив для включення у рахунок.
          </p>
        </div>
        <form action={createAdminInvoice} className="w-full lg:w-auto">
          <input type="hidden" name="requestId" value={requestId} />
          <button
            disabled={!canCreateInvoice}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-normal rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted lg:w-auto"
          >
            <ActionIcon name="plus" />
            Створити рахунок
          </button>
        </form>
      </div>

      {!canCreateInvoice ? (
        <p className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
          Рахунок можна створити після того, як клієнт погодить позиції та відмітить їх для включення у рахунок.
        </p>
      ) : (
        <p className="mt-4 rounded-md border border-info/20 bg-[#E8F1FF] p-4 text-sm font-semibold text-info">
          До рахунку готово {approvedInvoiceItemCount} позицій.
        </p>
      )}

      <div className="mt-5 grid gap-4">
        {invoices.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">
            Рахунків по цій заявці ще немає.
          </p>
        ) : (
          invoices.map((invoice) => {
            const canSend = invoice.status === 'DRAFT';
            const canCancel = invoice.status === 'DRAFT' || invoice.status === 'SENT';
            const canMarkPaid = invoice.status === 'SENT';
            const invoiceTotals = calculateInvoiceTotals(invoice.items);

            return (
              <article key={invoice.id} className="min-w-0 rounded-md border border-border p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="break-words text-lg font-bold text-foreground">{invoice.invoiceNumber}</h4>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <p className="mt-2 break-words text-sm text-muted">
                    Створено {invoice.createdAt.toLocaleString('uk-UA')} · {invoice.createdBy?.name ?? invoice.createdBy?.email ?? 'CRM'}
                  </p>
                  <p className="mt-1 text-xs text-muted">{invoice.items.length} позицій</p>
                  {invoice.sentAt ? <p className="mt-1 text-xs text-muted">Надіслано: {invoice.sentAt.toLocaleString('uk-UA')}</p> : null}
                  {invoice.paidAt ? <p className="mt-1 text-xs text-success">Оплачено: {invoice.paidAt.toLocaleString('uk-UA')}</p> : null}
                  {invoice.cancelledAt ? <p className="mt-1 text-xs text-danger">Скасовано: {invoice.cancelledAt.toLocaleString('uk-UA')}</p> : null}
                  {!invoice.buyerSnapshot ? (
                    <p className="mt-2 rounded-md border border-warning/30 bg-[#FFF7E0] px-3 py-2 text-xs font-semibold text-[#8A5B24]">
                      Реквізити покупця не заповнені у snapshot.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <BillingSnapshotCard title="Дані продавця" snapshot={asBillingSnapshot(invoice.sellerSnapshot)} />
                  <BillingSnapshotCard title="Дані покупця" snapshot={asBillingSnapshot(invoice.buyerSnapshot)} buyer />
                </div>

                <details className="mt-4 rounded-md border border-border bg-surface-muted p-4" open>
                  <summary className="cursor-pointer text-sm font-bold text-foreground">Переглянути позиції рахунку</summary>
                  <div className="mt-4 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border bg-card">
                    <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface-muted text-muted">
                          <th className="px-4 py-3 font-bold">№</th>
                          <th className="px-4 py-3 font-bold">Назва</th>
                          <th className="px-4 py-3 font-bold">Виробник</th>
                          <th className="px-4 py-3 font-bold">Артикул / каталог</th>
                          <th className="px-4 py-3 font-bold">Кількість</th>
                          <th className="px-4 py-3 font-bold">Од.</th>
                          <th className="px-4 py-3 text-right font-bold">Ціна без ПДВ</th>
                          <th className="px-4 py-3 text-right font-bold">Сума без ПДВ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((item, index) => (
                          <tr key={item.id} className="border-b border-border align-top last:border-0">
                            <td className="px-4 py-3 text-muted">{index + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-foreground">{item.name}</p>
                              {item.comment ? <p className="mt-2 text-xs leading-5 text-muted">{item.comment}</p> : null}
                            </td>
                            <td className="px-4 py-3 text-foreground">{item.brand ?? '—'}</td>
                            <td className="px-4 py-3 text-muted">
                              <p>Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">{item.quantity}</td>
                            <td className="px-4 py-3 text-foreground">{item.unit ?? 'шт'}</td>
                            <td className="px-4 py-3 text-right text-foreground">{formatMoney(item.price, invoice.currency)}</td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(item.total, invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ml-auto mt-4 w-full max-w-sm rounded-md border border-border bg-card p-4 text-sm">
                    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
                      <span className="text-right font-semibold text-muted">Разом:</span>
                      <span className="text-right font-bold text-foreground">{formatMoney(invoiceTotals.subtotalWithoutVat, invoice.currency)}</span>
                      <span className="text-right font-semibold text-muted">Сума ПДВ:</span>
                      <span className="text-right font-bold text-foreground">{formatMoney(invoiceTotals.vatAmount, invoice.currency)}</span>
                      <span className="border-t border-accent pt-2 text-right font-bold text-foreground">Усього з ПДВ:</span>
                      <span className="border-t border-accent pt-2 text-right text-base font-bold text-foreground">{formatMoney(invoiceTotals.totalWithVat, invoice.currency)}</span>
                    </div>
                  </div>
                </details>

                <div className="mt-5 border-t border-border pt-5">
                  <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Link
                      href={`/admin/invoices/${invoice.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted sm:w-auto"
                    >
                      Переглянути рахунок
                    </Link>
                    <Link
                      href={`/admin/invoices/${invoice.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-md border border-accent/60 px-4 py-2 text-sm font-bold text-[#8A5B24] transition hover:bg-[#FFF7E0] sm:w-auto"
                    >
                      Друк / PDF
                    </Link>
                    {canSend ? (
                      <form action={sendAdminInvoice} className="w-full sm:w-auto">
                        <input type="hidden" name="requestId" value={requestId} />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent-hover sm:w-auto">
                          <ActionIcon name="send" />
                          Надіслати клієнту
                        </button>
                      </form>
                    ) : null}
                    {canMarkPaid ? (
                      <form action={markAdminInvoicePaid} className="w-full sm:w-auto">
                        <input type="hidden" name="requestId" value={requestId} />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button className="w-full rounded-md border border-success/40 px-4 py-2 text-sm font-bold text-success transition hover:bg-success/10 sm:w-auto">
                          Позначити як оплачено
                        </button>
                      </form>
                    ) : null}
                    {canCancel ? (
                      <form action={cancelAdminInvoice} className="w-full sm:w-auto">
                        <input type="hidden" name="requestId" value={requestId} />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button className="w-full rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted sm:w-auto">
                          Скасувати
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function InvoiceStatusBadge({ status }: { status: keyof typeof INVOICE_STATUS_LABELS }) {
  const classNameByStatus: Record<keyof typeof INVOICE_STATUS_LABELS, string> = {
    DRAFT: 'bg-surface-muted text-muted',
    SENT: 'bg-[#E8F1FF] text-info',
    PAID: 'bg-[#E7F6EC] text-success',
    CANCELLED: 'bg-surface-muted text-muted'
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classNameByStatus[status]}`}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
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
    <form action={action} className="grid min-w-0 gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="grid min-w-0 gap-3 md:grid-cols-2 min-[1800px]:grid-cols-3">
        <TextField name="name" label="Назва запчастини" required defaultValue={item?.name} />
        <PartManufacturerField defaultValue={item?.brand} listId={`part-manufacturer-${item?.id ?? 'new'}`} />
        <TextField name="catalogNumber" label="Каталожний номер" defaultValue={item?.catalogNumber} />
        <TextField name="quantity" label="Кількість" type="number" min="1" defaultValue={String(item?.quantity ?? 1)} />
        <TextField name="unit" label="Одиниця" defaultValue={item?.unit ?? 'шт'} />
        <TextField name="availability" label="Наявність" defaultValue={item?.availability} />
        <TextField name="salePrice" label="Ціна без ПДВ" type="number" min="0" step="0.01" defaultValue={item?.salePrice?.toString()} />
        <TextField name="currency" label="Валюта" defaultValue={item?.currency ?? 'UAH'} />
      </div>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
        Коментар
        <textarea
          name="comment"
          rows={3}
          defaultValue={item?.comment ?? ''}
          className="min-w-0 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <button className="inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover sm:w-fit">
        {submitLabel}
      </button>
    </form>
  );
}

function PartManufacturerField({ defaultValue, listId }: { defaultValue?: string | null; listId: string }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
      Виробник
      <input
        name="brand"
        list={listId}
        defaultValue={defaultValue ?? ''}
        className="h-11 w-full min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
      <datalist id={listId}>
        {PART_MANUFACTURERS.map((manufacturer) => (
          <option key={manufacturer} value={manufacturer} />
        ))}
      </datalist>
    </label>
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
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        min={min}
        step={step}
        defaultValue={defaultValue ?? ''}
        className="h-11 w-full min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      />
    </label>
  );
}

type RequestDocumentView = {
  id: string;
  type: keyof typeof REQUEST_DOCUMENT_TYPE_LABELS;
  title: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  visibleToClient: boolean;
  createdAt: Date;
  uploadedBy: { name: string | null; email: string | null; role: string } | null;
};

function RequestDocumentsSection({ requestId, documents }: { requestId: string; documents: RequestDocumentView[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 xl:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-accent">Документи та вкладення заявки</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">Додаткові файли, які менеджер додає до заявки</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Завантажуйте додаткові файли до заявки: специфікації, договори, акти, PDF, Word, Excel, зображення або інші вкладення. Клієнт побачить тільки файли з позначкою видимості.
          </p>
        </div>
        <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{documents.length} документів</span>
      </div>

      <div className="mt-5 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-muted">
              <th className="px-4 py-3 font-bold">Документ</th>
              <th className="px-4 py-3 font-bold">Файл</th>
              <th className="px-4 py-3 font-bold">Завантажив</th>
              <th className="px-4 py-3 font-bold">Клієнт</th>
              <th className="px-4 py-3 font-bold">Дії</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold text-foreground">{document.title}</p>
                  <p className="mt-1 text-xs text-muted">{REQUEST_DOCUMENT_TYPE_LABELS[document.type]} · {document.createdAt.toLocaleString('uk-UA')}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  <a href={`/api/admin/request-documents/${document.id}/file`} target="_blank" rel="noreferrer" className="font-bold text-foreground transition hover:text-accent">
                    {document.fileName}
                  </a>
                  <p className="mt-1 text-xs">{document.mimeType ?? 'application/octet-stream'} · {document.size ? formatSize(document.size) : '—'}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {document.uploadedBy?.name ?? document.uploadedBy?.email ?? '—'}
                  {document.uploadedBy?.role ? <p className="mt-1 text-xs">{document.uploadedBy.role}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${document.visibleToClient ? 'bg-[#E7F6EC] text-success' : 'bg-surface-muted text-muted'}`}>
                    {document.visibleToClient ? 'Видимо' : 'Приховано'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-bold text-foreground transition hover:text-accent">Редагувати</summary>
                    <div className="mt-4 w-full min-w-0 max-w-lg rounded-md border border-border bg-card p-4 shadow-card">
                      <RequestDocumentMetadataForm
                        action={updateAdminRequestDocument}
                        requestId={requestId}
                        document={document}
                        submitLabel="Зберегти документ"
                      />
                    </div>
                  </details>
                  <form action={deleteAdminRequestDocument} className="mt-3">
                    <input type="hidden" name="requestId" value={requestId} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button className="text-sm font-bold text-danger transition hover:opacity-80">Видалити</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 ? (
          <p className="border-t border-border p-5 text-sm text-muted">
            Документи ще не додані. Додайте зовнішній файл до заявки, якщо менеджеру потрібно передати клієнту специфікацію, договір, акт або інше вкладення.
          </p>
        ) : null}
      </div>

      <details className="mt-5 rounded-md border border-border bg-surface-muted p-4" open={documents.length === 0}>
        <summary className="cursor-pointer text-sm font-bold text-foreground">Додати документ</summary>
        <form action={createAdminRequestDocument} className="mt-4 grid min-w-0 gap-4" encType="multipart/form-data">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <RequestDocumentTypeSelect />
            <TextField name="title" label="Назва документа" required />
          </div>
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            Файл
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png"
              className="min-w-0 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-bold file:text-foreground focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
            <input type="checkbox" name="visibleToClient" className="size-4 accent-[var(--accent)]" />
            Видимо клієнту
          </label>
          <button className="inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover sm:w-fit">
            Завантажити
          </button>
        </form>
      </details>
    </section>
  );
}

function RequestDocumentMetadataForm({
  action,
  requestId,
  document,
  submitLabel
}: {
  action: (formData: FormData) => void | Promise<void>;
  requestId: string;
  document: RequestDocumentView;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid min-w-0 gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="documentId" value={document.id} />
      <RequestDocumentTypeSelect defaultValue={document.type} />
      <TextField name="title" label="Назва документа" required defaultValue={document.title} />
      <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
        <input type="checkbox" name="visibleToClient" defaultChecked={document.visibleToClient} className="size-4 accent-[var(--accent)]" />
        Видимо клієнту
      </label>
      <button className="inline-flex w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover sm:w-fit">
        {submitLabel}
      </button>
    </form>
  );
}

function RequestDocumentTypeSelect({ defaultValue }: { defaultValue?: keyof typeof REQUEST_DOCUMENT_TYPE_LABELS }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
      Тип документа
      <select
        name="type"
        required
        defaultValue={defaultValue ?? 'COMMERCIAL_OFFER'}
        className="h-11 w-full min-w-0 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      >
        {REQUEST_DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>{REQUEST_DOCUMENT_TYPE_LABELS[type]}</option>
        ))}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function FileList({
  title,
  description,
  items
}: {
  title: string;
  description?: string;
  items: Array<{ id: string; fileName: string; mimeType: string; size: number; url: string | null }>;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border p-4">
      <h3 className="font-bold text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <p className="text-sm text-muted">Немає файлів.</p> : items.map((item) => (
          <div key={item.id} className="min-w-0 rounded-md bg-surface-muted p-3 text-sm text-muted">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="break-words font-bold text-foreground [overflow-wrap:anywhere] transition hover:text-accent">
                {item.fileName}
              </a>
            ) : (
              <p className="break-words font-bold text-foreground [overflow-wrap:anywhere]">{item.fileName}</p>
            )}
            <p className="mt-1 break-words">{item.mimeType} · {formatSize(item.size)} · {item.url ? 'Посилання доступне' : 'Приватне сховище'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
