import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { listChangeRequestsForClient } from '@/lib/change-requests/service';
import { CHANGE_ACTION_LABELS, CHANGE_ENTITY_TYPE_LABELS, CHANGE_STATUS_LABELS } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

import { cancelClientChangeRequestAction, createClientChangeRequestAction } from './actions';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';
const entityTypes = Object.entries(CHANGE_ENTITY_TYPE_LABELS);
const actions = Object.entries(CHANGE_ACTION_LABELS);

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    created: 'Запит на зміну відправлено на погодження.',
    cancelled: 'Запит на зміну скасовано.',
    database: 'DATABASE_URL не налаштовано.',
    'invalid-entity-type': 'Оберіть коректний тип об’єкта.',
    'entity-id-required': 'Вкажіть ID об’єкта, для якого потрібна зміна.',
    'invalid-action': 'Оберіть коректну дію.',
    'change-details-required': 'Вкажіть нове значення або причину зміни.',
    'entity-not-found-or-forbidden': 'Об’єкт не знайдено або він недоступний для вашого кабінету.',
    'change-request-not-found-or-not-pending': 'Запит не знайдено або він уже не очікує погодження.',
    'cancel-error': 'Не вдалося скасувати запит.'
  };

  return result ? messages[result] : null;
}

function statusClass(status: keyof typeof CHANGE_STATUS_LABELS) {
  const classes: Record<keyof typeof CHANGE_STATUS_LABELS, string> = {
    PENDING: 'bg-[#FFF7E0] text-[#8A5B24]',
    APPROVED: 'bg-[#E7F6EC] text-success',
    REJECTED: 'bg-[#FDECEC] text-danger',
    CANCELLED: 'bg-surface-muted text-muted'
  };

  return classes[status];
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

async function buildEntityLabels(changeRequests: Awaited<ReturnType<typeof listChangeRequestsForClient>>) {
  const requestIds = changeRequests.filter((item) => item.entityType === 'REQUEST').map((item) => item.entityId);
  const requestItemIds = changeRequests.filter((item) => item.entityType === 'REQUEST_ITEM').map((item) => item.entityId);
  const vehicleIds = changeRequests.filter((item) => item.entityType === 'VEHICLE').map((item) => item.entityId);
  const documentIds = changeRequests.filter((item) => item.entityType === 'REQUEST_DOCUMENT').map((item) => item.entityId);

  const [requests, requestItems, vehicles, documents] = await Promise.all([
    requestIds.length
      ? prisma.request.findMany({ where: { id: { in: requestIds } }, select: { id: true, requestNumber: true, description: true } })
      : Promise.resolve([]),
    requestItemIds.length
      ? prisma.requestItem.findMany({
          where: { id: { in: requestItemIds } },
          select: { id: true, name: true, catalogNumber: true, request: { select: { requestNumber: true } } }
        })
      : Promise.resolve([]),
    vehicleIds.length
      ? prisma.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, manufacturer: true, model: true, vinOrSerial: true } })
      : Promise.resolve([]),
    documentIds.length
      ? prisma.requestDocument.findMany({ where: { id: { in: documentIds } }, select: { id: true, title: true, fileName: true } })
      : Promise.resolve([])
  ]);

  const labels = new Map<string, string>();

  requests.forEach((request) => labels.set(`REQUEST:${request.id}`, `${request.requestNumber} · ${request.description.slice(0, 70)}`));
  requestItems.forEach((item) => labels.set(`REQUEST_ITEM:${item.id}`, `${item.name}${item.catalogNumber ? ` · ${item.catalogNumber}` : ''} · ${item.request.requestNumber}`));
  vehicles.forEach((vehicle) => labels.set(`VEHICLE:${vehicle.id}`, `${vehicle.manufacturer} ${vehicle.model}${vehicle.vinOrSerial ? ` · ${vehicle.vinOrSerial}` : ''}`));
  documents.forEach((document) => labels.set(`REQUEST_DOCUMENT:${document.id}`, `${document.title} · ${document.fileName}`));

  return labels;
}

export default async function ClientChangeRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const session = await requireClientSession();
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const changeRequests = await listChangeRequestsForClient(access);
  const entityLabels = await buildEntityLabels(changeRequests);
  const message = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Запити на зміну</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Зміни в заявках, техніці та документах</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Тут зібрані всі ваші запити на зміну. Погодження не змінює дані автоматично, а передає менеджеру контрольовану задачу на обробку.
        </p>
        {access.companyName ? <p className="mt-2 text-sm text-muted">Компанія: {access.companyName}</p> : null}
        {message ? <div className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">{message}</div> : null}
      </div>

      <form action={createClientChangeRequestAction} className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Створити запит вручну</h2>
        <p className="text-sm text-muted">Ця форма лишається як fallback для випадків, коли потрібно вказати ID об’єкта вручну.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Об’єкт *
            <select name="entityType" required className={inputClass} defaultValue="REQUEST">
              {entityTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Дія *
            <select name="action" required className={inputClass} defaultValue="UPDATE">
              {actions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ID об’єкта *
            <input name="entityId" required className={inputClass} placeholder="ID заявки, позиції або техніки" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Поле
            <input name="fieldName" className={inputClass} placeholder="description, quantity, model або інше" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Поточне значення
            <input name="oldValue" className={inputClass} placeholder="Необов’язково" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Нове значення
            <input name="newValueText" className={inputClass} placeholder="Вкажіть нове значення" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            Причина зміни
            <textarea name="reason" rows={4} className={inputClass} placeholder="Опишіть, що саме потрібно змінити" />
          </label>
        </div>
        <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Надіслати запит
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Історія запитів</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Дата</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Об’єкт</th>
                <th className="px-4 py-3 font-bold">Дія</th>
                <th className="px-4 py-3 font-bold">Значення</th>
                <th className="px-4 py-3 font-bold">Причина</th>
                <th className="px-4 py-3 font-bold">Коментар менеджера</th>
                <th className="px-4 py-3 font-bold">Дія</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.map((item) => (
                <tr key={item.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 text-muted">{item.createdAt.toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{CHANGE_STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <p className="font-semibold text-foreground">{CHANGE_ENTITY_TYPE_LABELS[item.entityType]}</p>
                    <p className="mt-1 text-sm">{entityLabels.get(`${item.entityType}:${item.entityId}`) ?? 'Об’єкт недоступний або вже змінений'}</p>
                    {item.fieldName ? <p className="mt-1 text-xs">Поле: {item.fieldName}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{CHANGE_ACTION_LABELS[item.action]}</td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="text-xs font-bold uppercase text-muted">Поточне</p>
                    <p className="mt-1 break-words">{formatJsonValue(item.oldValue)}</p>
                    <p className="mt-3 text-xs font-bold uppercase text-muted">Нове</p>
                    <p className="mt-1 break-words">{formatJsonValue(item.newValue)}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">{item.reason ?? '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-muted">{item.adminComment ?? '—'}</td>
                  <td className="px-4 py-3">
                    {item.status === 'PENDING' && item.requestedById === access.userId ? (
                      <form action={cancelClientChangeRequestAction}>
                        <input type="hidden" name="changeRequestId" value={item.id} />
                        <button className="rounded-md border border-border px-3 py-2 text-xs font-bold text-muted transition hover:border-danger hover:text-danger">
                          Скасувати
                        </button>
                      </form>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {changeRequests.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Запитів на зміну ще немає.</p> : null}
        </div>
      </div>
    </div>
  );
}
