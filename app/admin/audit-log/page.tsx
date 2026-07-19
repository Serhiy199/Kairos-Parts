import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { listAuditLogsForAdmin } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

const AUDIT_ENTITY_LABELS = {
  REQUEST: 'Заявка',
  REQUEST_ITEM: 'Позиція заявки',
  VEHICLE: 'Техніка',
  REQUEST_DOCUMENT: 'Документ заявки',
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  COMPANY: 'Компанія',
  CHANGE_REQUEST: 'Запит зміни',
  USER: 'Користувач'
} as const;

const AUDIT_ACTION_LABELS = {
  CHANGE_REQUEST_CREATED: 'Запит створено',
  CHANGE_REQUEST_CANCELLED: 'Запит скасовано',
  CHANGE_REQUEST_APPROVED: 'Запит погоджено',
  CHANGE_REQUEST_REJECTED: 'Запит відхилено',
  CHANGE_APPLIED: 'Зміну застосовано',
  VEHICLE_ARCHIVED: 'Техніку архівовано',
  ENTITY_UPDATED: 'Об’єкт оновлено'
} as const;

const AUDIT_EVENT_LABELS: Record<string, string> = {
  VEHICLE_CREATED: 'Техніку створено',
  VEHICLE_UPDATED: 'Дані техніки оновлено',
  VEHICLE_IMAGE_UPLOADED: 'Фото техніки додано',
  VEHICLE_IMAGE_PRIMARY_CHANGED: 'Головне фото змінено',
  VEHICLE_IMAGES_REORDERED: 'Порядок фото змінено',
  VEHICLE_IMAGE_DELETED: 'Фото техніки видалено',
  VEHICLE_DOCUMENT_UPLOADED: 'Документ техніки додано',
  VEHICLE_DOCUMENT_VISIBILITY_CHANGED: 'Видимість документа техніки змінено',
  VEHICLE_DOCUMENT_DELETED: 'Документ техніки видалено',
  COMPANY_DOCUMENT_UPLOADED: 'Документ компанії додано',
  COMPANY_DOCUMENT_VISIBILITY_CHANGED: 'Видимість документа компанії змінено',
  COMPANY_DOCUMENT_DELETED: 'Документ компанії видалено',
  CLIENT_DOCUMENT_UPLOADED: 'Документ клієнта додано',
  CLIENT_DOCUMENT_VISIBILITY_CHANGED: 'Видимість документа клієнта змінено',
  CLIENT_DOCUMENT_DELETED: 'Документ клієнта видалено'
};

const FIELD_LABELS: Record<string, string> = {
  type: 'Тип техніки',
  manufacturer: 'Виробник',
  model: 'Модель',
  year: 'Рік',
  vinOrSerial: 'VIN / серійний номер',
  comment: 'Коментар'
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function auditEventLabel(metadata: unknown) {
  const event = asRecord(metadata)?.event;
  return typeof event === 'string' ? AUDIT_EVENT_LABELS[event] ?? event : null;
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const record = asRecord(value);
  if (record) {
    return Object.entries(record)
      .map(([key, entry]) => `${FIELD_LABELS[key] ?? key}: ${entry === null || entry === '' ? 'Не вказано' : String(entry)}`)
      .join(', ');
  }

  return JSON.stringify(value);
}

export default async function AdminAuditLogPage() {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const auditLogs = await listAuditLogsForAdmin();

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Журнал дій</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">AuditLog критичних змін</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Read-only журнал показує, хто створив, погодив, відхилив або застосував зміну. Записи не редагуються і не видаляються через CRM.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Останні записи</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Дата</th>
                <th className="px-4 py-3 font-bold">Actor</th>
                <th className="px-4 py-3 font-bold">Компанія</th>
                <th className="px-4 py-3 font-bold">Дія</th>
                <th className="px-4 py-3 font-bold">Об’єкт</th>
                <th className="px-4 py-3 font-bold">ChangeRequest</th>
                <th className="px-4 py-3 font-bold">Old value</th>
                <th className="px-4 py-3 font-bold">New value</th>
                <th className="px-4 py-3 font-bold">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((item) => (
                <tr key={item.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 text-muted">
                    <p>{item.createdAt.toLocaleDateString('uk-UA')}</p>
                    <p className="mt-1 text-xs">{item.createdAt.toLocaleTimeString('uk-UA')}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.actor ? (
                      <>
                        <p className="font-semibold text-foreground">{item.actor.name ?? item.actor.email}</p>
                        <p className="mt-1">{item.actor.email}</p>
                        <p className="mt-1 text-xs">{item.actor.role}</p>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.company ? (
                      <>
                        <p className="font-semibold text-foreground">{item.company.name}</p>
                        {item.company.edrpou ? <p className="mt-1 text-xs">ЄДРПОУ: {item.company.edrpou}</p> : null}
                      </>
                    ) : (
                      'Personal'
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <p>{auditEventLabel(item.metadata) ?? AUDIT_ACTION_LABELS[item.action]}</p>
                    {auditEventLabel(item.metadata) ? <p className="mt-1 text-xs font-normal text-muted">{AUDIT_ACTION_LABELS[item.action]}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <p className="font-semibold text-foreground">{AUDIT_ENTITY_LABELS[item.entityType]}</p>
                    <p className="mt-1 font-mono text-xs">{item.entityId}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.changeRequest ? (
                      <>
                        <p className="font-mono text-xs">{item.changeRequest.id}</p>
                        <p className="mt-1">{item.changeRequest.entityType} / {item.changeRequest.action}</p>
                        {item.changeRequest.fieldName ? <p className="mt-1 text-xs">Поле: {item.changeRequest.fieldName}</p> : null}
                        <p className="mt-1 text-xs">Статус: {item.changeRequest.status}</p>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="break-words font-mono text-xs">{formatJsonValue(item.oldValue)}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="break-words font-mono text-xs">{formatJsonValue(item.newValue)}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="break-words font-mono text-xs">{formatJsonValue(item.metadata)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLogs.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Журнал дій ще порожній.</p> : null}
        </div>
      </div>
    </div>
  );
}
