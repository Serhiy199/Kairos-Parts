import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { listChangeRequestsForClient } from '@/lib/change-requests/service';
import { CHANGE_ACTION_LABELS, CHANGE_ENTITY_TYPE_LABELS, CHANGE_STATUS_LABELS } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';

import { cancelClientChangeRequestAction, createClientChangeRequestAction } from './actions';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';
const entityTypes = Object.entries(CHANGE_ENTITY_TYPE_LABELS);
const actions = Object.entries(CHANGE_ACTION_LABELS);

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    created: 'Запит на зміну створено й передано менеджеру.',
    cancelled: 'Запит на зміну скасовано.',
    database: 'DATABASE_URL не налаштовано.',
    'invalid-entity-type': 'Оберіть коректний тип об’єкта.',
    'entity-id-required': 'Вкажіть ID об’єкта, для якого потрібна зміна.',
    'invalid-action': 'Оберіть коректну дію.',
    'entity-not-found-or-forbidden': 'Об’єкт не знайдено або він недоступний для вашого кабінету.',
    'change-request-not-found-or-not-pending': 'Запит не знайдено або він уже не очікує розгляду.',
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
  const message = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Запити на зміну</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Зміни в заявках, техніці та документах</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Створіть запит, якщо потрібно оновити дані, видалити або відновити пов’язаний об’єкт. Менеджер перевірить запит і зафіксує рішення.
        </p>
        {access.companyName ? <p className="mt-2 text-sm text-muted">Компанія: {access.companyName}</p> : null}
        {message ? <div className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">{message}</div> : null}
      </div>

      <form action={createClientChangeRequestAction} className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Створити запит</h2>
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
            <input name="entityId" required className={inputClass} placeholder="Наприклад, ID заявки або техніки" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Поле
            <input name="fieldName" className={inputClass} placeholder="Наприклад, phone або description" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Поточне значення
            <input name="oldValue" className={inputClass} placeholder="Необов’язково" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Нове значення
            <input name="newValue" className={inputClass} placeholder="Необов’язково" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            Коментар
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
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Дата</th>
                <th className="px-4 py-3 font-bold">Об’єкт</th>
                <th className="px-4 py-3 font-bold">Дія</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Коментар</th>
                <th className="px-4 py-3 font-bold">Рішення</th>
                <th className="px-4 py-3 font-bold">Дія</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{item.createdAt.toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3 text-muted">
                    <p className="font-semibold text-foreground">{CHANGE_ENTITY_TYPE_LABELS[item.entityType]}</p>
                    <p className="mt-1 font-mono text-xs">{item.entityId}</p>
                    {item.fieldName ? <p className="mt-1">Поле: {item.fieldName}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{CHANGE_ACTION_LABELS[item.action]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{CHANGE_STATUS_LABELS[item.status]}</span>
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
