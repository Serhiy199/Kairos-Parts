import Link from 'next/link';
import { notFound } from 'next/navigation';

import { approveClientCommercialOfferAction, rejectClientCommercialOfferAction } from '@/app/client/actions';
import { ContextualChangeRequestForm } from '@/app/client/change-requests/contextual-change-request-form';
import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { CLIENT_VISIBLE_OFFER_STATUSES, COMMERCIAL_OFFER_STATUS_LABELS } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
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
    'offer-approved': 'Комерційну пропозицію погоджено.',
    'offer-rejected': 'Комерційну пропозицію відхилено.',
    'offer-not-found-or-not-sent': 'Пропозицію не знайдено або вона вже не очікує рішення.',
    'offer-error': 'Не вдалося обробити комерційну пропозицію.',
    created: 'Запит на зміну відправлено на погодження.',
    database: 'DATABASE_URL не налаштовано.',
    'invalid-entity-type': 'Некоректний тип об’єкта для запиту на зміну.',
    'entity-id-required': 'Не вдалося визначити об’єкт для запиту на зміну.',
    'invalid-action': 'Некоректна дія для запиту на зміну.',
    'change-details-required': 'Вкажіть нове значення або причину зміни.',
    'entity-not-found-or-forbidden': 'Об’єкт не знайдено або недоступний для вашого кабінету.'
  };

  return result ? messages[result] : null;
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
      category: true,
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
      commercialOffers: {
        where: { status: { in: CLIENT_VISIBLE_OFFER_STATUSES } },
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
    ['Категорія', request.category?.name ?? '—'],
    ['Виробник', request.manufacturer?.name ?? '—'],
    ['Модель', request.model ?? '—'],
    ['VIN / серійний номер', request.vinOrSerial ?? '—']
  ];
  const message = resultMessage(query.result);
  const currentPath = `/client/requests/${request.id}`;

  return (
    <div className="grid gap-6">
      {message ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{message}</div> : null}

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

      <ContextualChangeRequestForm
        title="Запросити зміну по заявці"
        description="Опишіть, що потрібно уточнити або змінити в цій заявці. Після погодження менеджером дозволена зміна буде застосована автоматично."
        entityType="REQUEST"
        entityId={request.id}
        action="UPDATE"
        redirectTo={currentPath}
        fieldOptions={[
          { value: 'description', label: 'Опис потреби', currentValue: request.description },
          { value: 'equipmentType', label: 'Тип техніки', currentValue: request.equipmentType },
          { value: 'model', label: 'Модель', currentValue: request.model },
          { value: 'vinOrSerial', label: 'VIN / серійний номер', currentValue: request.vinOrSerial },
          { value: 'other', label: 'Інше' }
        ]}
      />

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
                  <th className="px-4 py-3 font-bold">Зміни</th>
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
                    <td className="min-w-[300px] px-4 py-3">
                      <ContextualChangeRequestForm
                        title="Запросити зміну позиції"
                        entityType="REQUEST_ITEM"
                        entityId={item.id}
                        action="UPDATE"
                        redirectTo={currentPath}
                        compact
                        fieldOptions={[
                          { value: 'catalogNumber', label: 'Каталожний номер', currentValue: item.catalogNumber },
                          { value: 'analogNumber', label: 'Аналог', currentValue: item.analogNumber },
                          { value: 'name', label: 'Назва запчастини', currentValue: item.name },
                          { value: 'quantity', label: 'Кількість', currentValue: item.quantity },
                          { value: 'comment', label: 'Коментар', currentValue: item.comment },
                          { value: 'other', label: 'Інше' }
                        ]}
                        submitLabel="Запросити зміну позиції"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {request.commercialOffers.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-foreground">Комерційні пропозиції</h3>
          <p className="mt-2 text-sm text-muted">Тут показані пропозиції, які менеджер надіслав для погодження.</p>
          <div className="mt-4 grid gap-4">
            {request.commercialOffers.map((offer) => (
              <article key={offer.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-foreground">{offer.offerNumber}</p>
                      <ClientOfferStatusBadge status={offer.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      Створено {offer.createdAt.toLocaleDateString('uk-UA')}
                      {offer.validUntil ? ` · дійсна до ${offer.validUntil.toLocaleDateString('uk-UA')}` : ''}
                    </p>
                    {offer.managerComment ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{offer.managerComment}</p> : null}
                    {offer.clientComment ? (
                      <div className="mt-3 rounded-md border border-border bg-surface-muted p-3">
                        <p className="text-xs font-bold uppercase text-muted">Ваш коментар</p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{offer.clientComment}</p>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatMoney(offer.totalAmount, offer.currency)}</p>
                </div>

                <div className="mt-4 overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted text-muted">
                        <th className="px-4 py-3 font-bold">Позиція</th>
                        <th className="px-4 py-3 font-bold">К-сть</th>
                        <th className="px-4 py-3 font-bold">Ціна</th>
                        <th className="px-4 py-3 font-bold">Сума</th>
                        <th className="px-4 py-3 font-bold">Строк</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offer.items.map((item) => (
                        <tr key={item.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-bold text-foreground">{item.name}</p>
                            <p className="mt-1 text-xs text-muted">{item.brand ?? 'Бренд уточнюється'} · каталог {item.catalogNumber ?? '—'} · аналог {item.analogNumber ?? '—'}</p>
                            {item.comment ? <p className="mt-2 text-xs leading-5 text-muted">{item.comment}</p> : null}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{item.quantity} {item.unit ?? 'шт'}</td>
                          <td className="px-4 py-3 text-foreground">{formatMoney(item.price, offer.currency)}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{formatMoney(item.total, offer.currency)}</td>
                          <td className="px-4 py-3 text-muted">
                            <p>{item.availability ?? 'Уточнюється'}</p>
                            <p className="mt-1 text-xs">{item.deliveryTime ?? 'Строк уточнюється'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {offer.status === 'SENT' ? (
                  <div className="mt-4 grid gap-3 rounded-md border border-border bg-surface-muted p-4">
                    <form action={approveClientCommercialOfferAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="offerId" value={offer.id} />
                      <button className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
                        Погодити
                      </button>
                    </form>
                    <form action={rejectClientCommercialOfferAction} className="grid gap-3">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="offerId" value={offer.id} />
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        Причина відхилення / коментар
                        <textarea name="clientComment" rows={3} className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
                      </label>
                      <button className="inline-flex w-fit items-center justify-center rounded-md border border-danger/40 px-5 py-3 text-sm font-bold text-danger transition hover:bg-danger/10">
                        Відхилити
                      </button>
                    </form>
                  </div>
                ) : null}
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

function ClientOfferStatusBadge({ status }: { status: keyof typeof COMMERCIAL_OFFER_STATUS_LABELS }) {
  const classNameByStatus: Record<keyof typeof COMMERCIAL_OFFER_STATUS_LABELS, string> = {
    DRAFT: 'bg-surface-muted text-muted',
    SENT: 'bg-[#E8F1FF] text-info',
    APPROVED: 'bg-[#E7F6EC] text-success',
    REJECTED: 'bg-[#FDECEC] text-danger',
    EXPIRED: 'bg-[#FFF7E0] text-[#8A5B24]',
    CANCELLED: 'bg-surface-muted text-muted'
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classNameByStatus[status]}`}>
      {COMMERCIAL_OFFER_STATUS_LABELS[status]}
    </span>
  );
}
