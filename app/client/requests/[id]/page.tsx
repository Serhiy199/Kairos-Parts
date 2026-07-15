import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  approveClientRequestItemsAction,
  createClientRequestItemEditAction
} from '@/app/client/actions';
import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { CLIENT_INVOICE_STATUS_LABELS } from '@/lib/invoices/validation';
import { prisma } from '@/lib/prisma';
import { REQUEST_DOCUMENT_TYPE_LABELS } from '@/lib/request-documents/validation';

export const dynamic = 'force-dynamic';

function formatMoney(value: { toString: () => string } | null, currency: string) {
  return value ? `${value.toString()} ${currency}` : null;
}

function formatSize(size: number | null) {
  return size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '—';
}

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    'items-approved': 'Позиції погоджено. Менеджер сформує рахунок на основі вибраних позицій.',
    'item-selection-required': 'Оберіть хоча б одну позицію для включення у рахунок.',
    'items-approval-error': 'Не вдалося погодити позиції. Спробуйте ще раз.',
    'items-approval-forbidden': 'Позиції не знайдено або вони недоступні для вашого кабінету.',
    'item-change-created': 'Уточнення по позиції передано менеджеру.',
    'item-change-required': 'Вкажіть нове значення або причину уточнення.',
    'item-change-field-forbidden': 'Це поле не можна змінювати з кабінету клієнта.',
    'item-change-forbidden': 'Позицію не знайдено або вона недоступна для вашого кабінету.',
    'item-change-error': 'Не вдалося передати уточнення менеджеру.',
    created: 'Уточнення відправлено менеджеру.',
    database: 'DATABASE_URL не налаштовано.',
    'invalid-entity-type': 'Некоректний тип об’єкта для запиту на зміну.',
    'entity-id-required': 'Не вдалося визначити об’єкт для запиту на зміну.',
    'invalid-action': 'Некоректна дія для запиту на зміну.',
    'change-details-required': 'Вкажіть нове значення або причину зміни.',
    'entity-not-found-or-forbidden': 'Об’єкт не знайдено або недоступний для вашого кабінету.'
  };

  return result ? messages[result] : null;
}

function resultMessageTone(result?: string) {
  const errorResults = new Set([
    'item-selection-required',
    'items-approval-error',
    'items-approval-forbidden',
    'item-change-required',
    'item-change-field-forbidden',
    'item-change-forbidden',
    'item-change-error',
    'database',
    'invalid-entity-type',
    'entity-id-required',
    'invalid-action',
    'change-details-required',
    'entity-not-found-or-forbidden'
  ]);

  return result && errorResults.has(result) ? 'error' : 'success';
}

export default async function ClientRequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const request = await prisma.request.findFirst({
    where: { id, AND: [requestAccessWhere(access)] },
    include: {
      manufacturer: true,
      company: { select: { name: true } },
      items: {
        where: { visibleToClient: true },
        orderBy: { createdAt: 'desc' }
      },
      requestDocuments: {
        where: { visibleToClient: true },
        orderBy: { createdAt: 'desc' }
      },
      invoices: {
        where: {
          OR: [
            { status: { in: ['SENT', 'PAID'] } },
            { status: 'CANCELLED', sentAt: { not: null } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: { items: { orderBy: { createdAt: 'asc' } } }
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
    ['Виробник / марка', request.manufacturer?.name ?? '—'],
    ['Модель', request.model ?? '—'],
    ['Рік випуску', request.vehicleYear ? String(request.vehicleYear) : '—'],
    ['VIN / серійний номер', request.vinOrSerial ?? '—']
  ];
  const message = resultMessage(query.result);
  const messageTone = resultMessageTone(query.result);
  const pendingApprovalItems = request.items.filter((item) => !item.approvedByClient);

  return (
    <div className="grid gap-6">
      {message ? (
        <div
          className={
            messageTone === 'error'
              ? 'rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700'
              : 'rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success'
          }
        >
          {message}
        </div>
      ) : null}
      {pendingApprovalItems.length > 0 ? (
        <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">
          У цій заявці є {pendingApprovalItems.length} {pendingApprovalItems.length === 1 ? 'позиція' : 'позиції'} на погодження. Оберіть потрібні позиції та натисніть “Погодити вибрані позиції”.
        </div>
      ) : null}

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
        <div className="min-w-0 rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">Підібрані позиції</h3>
              <p className="mt-2 text-sm text-muted">
                Оберіть позиції, які потрібно включити у рахунок. Якщо щось треба уточнити, натисніть “Редагувати” біля позиції.
              </p>
            </div>
            {pendingApprovalItems.length > 0 ? (
              <span className="w-fit rounded-full bg-[#E7F6EC] px-3 py-1 text-xs font-bold text-success">
                {pendingApprovalItems.length} на погодження
              </span>
            ) : null}
            <form id="approve-request-items" action={approveClientRequestItemsAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <button className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                Погодити вибрані позиції
              </button>
            </form>
          </div>
          <div className="mt-4 grid min-w-0 gap-3">
            {request.items.map((item) => (
              <details key={item.id} className="group min-w-0 rounded-md border border-border p-4">
                <summary className="cursor-pointer list-none">
                  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,auto)] lg:items-start">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-muted">Запчастина</p>
                      <p className="mt-2 font-bold text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-muted">{item.brand ?? 'Виробник уточнюється'}</p>
                      {item.comment ? <p className="mt-2 text-xs leading-5 text-muted">{item.comment}</p> : null}
                    </div>
                    <div className="text-sm text-muted">
                      <p className="text-xs font-bold uppercase text-muted">Номери</p>
                      <p className="mt-2">Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
                      <p className="mt-1">Аналог: <span className="font-semibold text-foreground">{item.analogNumber ?? '—'}</span></p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted">К-сть</p>
                      <p className="mt-2 font-semibold text-foreground">{item.quantity} {item.unit}</p>
                    </div>
                    <div className="text-sm text-muted">
                      <p className="text-xs font-bold uppercase text-muted">Наявність</p>
                      <p className="mt-2">{item.availability ?? 'Уточнюється'}</p>
                      <p className="mt-1 text-xs">{item.deliveryTime ?? 'Орієнтовний термін уточнюється'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted">Ціна</p>
                      <p className="mt-2 font-semibold text-foreground">{formatMoney(item.salePrice, item.currency) ?? 'Уточнюється'}</p>
                    </div>
                    <div className="grid gap-2">
                      <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
                        <input
                          form="approve-request-items"
                          type="checkbox"
                          name="itemIds"
                          value={item.id}
                          defaultChecked={item.includeInInvoice}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        Включити у рахунок
                      </label>
                      <span className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition group-hover:border-accent group-hover:bg-surface-muted">
                        Редагувати
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {item.approvedByClient ? (
                          <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">Погоджено</span>
                        ) : (
                          <span className="rounded-full bg-[#FFF7E0] px-2.5 py-1 text-xs font-bold text-[#8A5B24]">Очікує погодження</span>
                        )}
                        {item.includeInInvoice ? (
                          <span className="rounded-full bg-[#E8F1FF] px-2.5 py-1 text-xs font-bold text-info">Включено у рахунок</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 border-t border-border pt-4">
                  <form action={createClientRequestItemEditAction} className="grid gap-4 rounded-md border border-border bg-surface-muted p-4">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <div>
                      <p className="text-sm font-bold uppercase text-accent">Редагування позиції</p>
                      <h4 className="mt-1 font-bold text-foreground">Надіслати уточнення менеджеру</h4>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Ваше уточнення буде передано менеджеру. Після перевірки менеджер оновить позицію.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        Що потрібно змінити?
                        <select name="fieldName" className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25">
                          <option value="name">Назва запчастини</option>
                          <option value="catalogNumber">Каталожний номер</option>
                          <option value="analogNumber">Аналоговий номер</option>
                          <option value="quantity">Кількість</option>
                          <option value="comment">Коментар</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        Нове значення
                        <input
                          name="newValue"
                          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                          placeholder="Вкажіть нове значення"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold text-foreground">
                      Причина / коментар
                      <textarea
                        name="reason"
                        rows={3}
                        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                        placeholder="Коротко поясніть, що потрібно уточнити"
                      />
                    </label>
                    <button className="inline-flex w-fit items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                      Надіслати
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        </div>
      ) : null}

      {request.invoices.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-foreground">Рахунки</h3>
          <p className="mt-2 text-sm text-muted">Тут показані рахунки, які менеджер виставив за погодженими позиціями.</p>
          <div className="mt-4 grid gap-4">
            {request.invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-foreground">{invoice.invoiceNumber}</p>
                      <ClientInvoiceStatusBadge status={invoice.status as keyof typeof CLIENT_INVOICE_STATUS_LABELS} />
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      Створено {invoice.createdAt.toLocaleDateString('uk-UA')}
                      {invoice.sentAt ? ` · надіслано ${invoice.sentAt.toLocaleDateString('uk-UA')}` : ''}
                    </p>
                    {invoice.paidAt ? <p className="mt-2 text-sm font-semibold text-success">Оплачено {invoice.paidAt.toLocaleDateString('uk-UA')}</p> : null}
                    {invoice.cancelledAt ? <p className="mt-2 text-sm font-semibold text-danger">Скасовано {invoice.cancelledAt.toLocaleDateString('uk-UA')}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <p className="text-lg font-bold text-foreground">{formatMoney(invoice.totalAmount, invoice.currency)}</p>
                    <Link
                      href={`/client/invoices/${invoice.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted"
                    >
                      Друк / PDF
                    </Link>
                  </div>
                </div>

                <div className="mt-4 max-w-full overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted text-muted">
                        <th className="px-4 py-3 font-bold">Позиція</th>
                        <th className="px-4 py-3 font-bold">Номери</th>
                        <th className="px-4 py-3 font-bold">К-сть</th>
                        <th className="px-4 py-3 font-bold">Ціна</th>
                        <th className="px-4 py-3 font-bold">Сума</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-bold text-foreground">{item.name}</p>
                            <p className="mt-1 text-xs text-muted">{item.brand ?? 'Виробник уточнюється'}</p>
                            {item.comment ? <p className="mt-2 text-xs leading-5 text-muted">{item.comment}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            <p>Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span></p>
                            <p className="mt-1">Аналог: <span className="font-semibold text-foreground">{item.analogNumber ?? '—'}</span></p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{item.quantity} {item.unit ?? 'шт'}</td>
                          <td className="px-4 py-3 text-foreground">{formatMoney(item.price, invoice.currency)}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{formatMoney(item.total, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {request.requestDocuments.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-foreground">Документи по заявці</h3>
          <p className="mt-2 text-sm text-muted">Тут показані документи, які менеджер відкрив для клієнта.</p>
          <div className="mt-4 grid gap-3">
            {request.requestDocuments.map((document) => (
              <div key={document.id} className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-foreground">{document.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {REQUEST_DOCUMENT_TYPE_LABELS[document.type]} · {document.fileName} · {formatSize(document.size)} · {document.createdAt.toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <a
                  href={`/api/client/request-documents/${document.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted"
                >
                  Завантажити
                </a>
              </div>
            ))}
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

function ClientInvoiceStatusBadge({ status }: { status: keyof typeof CLIENT_INVOICE_STATUS_LABELS }) {
  const classNameByStatus: Record<keyof typeof CLIENT_INVOICE_STATUS_LABELS, string> = {
    SENT: 'bg-[#E8F1FF] text-info',
    PAID: 'bg-[#E7F6EC] text-success',
    CANCELLED: 'bg-surface-muted text-muted'
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classNameByStatus[status]}`}>
      {CLIENT_INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
