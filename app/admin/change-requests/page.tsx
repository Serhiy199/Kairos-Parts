import { approveChangeRequestAction, rejectChangeRequestAction } from '@/app/admin/change-request-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { listChangeRequestsForAdmin } from '@/lib/change-requests/service';
import { CHANGE_ACTION_LABELS, CHANGE_ENTITY_TYPE_LABELS, CHANGE_STATUS_LABELS } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    approved: 'Запит погоджено.',
    rejected: 'Запит відхилено.',
    database: 'DATABASE_URL не налаштовано.',
    'review-error': 'Не вдалося обробити запит.',
    'change-request-not-found-or-not-pending': 'Запит не знайдено або він уже не очікує погодження.',
    'change-request-unsupported-apply': 'Цей тип запиту поки не підтримує автоматичне застосування.',
    'change-request-field-not-allowed': 'Це поле не входить у allowlist і не може бути застосоване автоматично.',
    'change-request-new-value-required': 'Для погодження потрібне нове значення.',
    'change-request-invalid-value': 'Нове значення має некоректний формат.',
    'change-request-target-not-found-or-forbidden': 'Пов’язаний об’єкт не знайдено або scope запиту не збігається.'
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

export default async function AdminChangeRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireCrmSession();
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const changeRequests = await listChangeRequestsForAdmin();
  const message = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Запити змін</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Клієнтські запити на зміну</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Менеджер або адміністратор бачить запити клієнтів на зміну даних і фіксує рішення. Погодження автоматично застосовує тільки allowlisted поля для заявки, позиції заявки або техніки.
        </p>
        <p className="mt-2 max-w-3xl text-xs font-semibold text-muted">
          Архівація техніки не видаляє історію, заявки, документи або підібрані позиції.
        </p>
        {message ? <div className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">{message}</div> : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Список запитів</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Дата</th>
                <th className="px-4 py-3 font-bold">Клієнт / компанія</th>
                <th className="px-4 py-3 font-bold">Об’єкт</th>
                <th className="px-4 py-3 font-bold">Дія</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Значення</th>
                <th className="px-4 py-3 font-bold">Причина</th>
                <th className="px-4 py-3 font-bold">Рішення</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.map((item) => (
                <tr key={item.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 text-muted">{item.createdAt.toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3 text-muted">
                    <p className="font-semibold text-foreground">{item.requestedBy.name ?? item.requestedBy.email}</p>
                    <p className="mt-1">{item.requestedBy.email}</p>
                    {item.company ? <p className="mt-1">Компанія: {item.company.name}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <p className="font-semibold text-foreground">{CHANGE_ENTITY_TYPE_LABELS[item.entityType]}</p>
                    <p className="mt-1 font-mono text-xs">{item.entityId}</p>
                    {item.fieldName ? <p className="mt-1">Поле: {item.fieldName}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{CHANGE_ACTION_LABELS[item.action]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{CHANGE_STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="text-xs font-bold uppercase text-muted">Поточне</p>
                    <p className="mt-1 break-words">{formatJsonValue(item.oldValue)}</p>
                    <p className="mt-3 text-xs font-bold uppercase text-muted">Нове</p>
                    <p className="mt-1 break-words">{formatJsonValue(item.newValue)}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">{item.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    {item.status === 'PENDING' ? (
                      <div className="grid min-w-[260px] gap-3">
                        <form action={approveChangeRequestAction} className="grid gap-2">
                          <input type="hidden" name="changeRequestId" value={item.id} />
                          <input name="adminComment" className={inputClass} placeholder="Коментар до погодження" />
                          <button className="rounded-md bg-accent px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent-hover">
                            Погодити і застосувати
                          </button>
                        </form>
                        <form action={rejectChangeRequestAction} className="grid gap-2">
                          <input type="hidden" name="changeRequestId" value={item.id} />
                          <input name="adminComment" className={inputClass} placeholder="Причина відхилення" />
                          <button className="rounded-md border border-border px-3 py-2 text-xs font-bold text-muted transition hover:border-danger hover:text-danger">
                            Відхилити
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-muted">
                        <p>{item.adminComment ?? '—'}</p>
                        {item.reviewedBy ? <p className="mt-1 text-xs">Розглянув: {item.reviewedBy.name ?? item.reviewedBy.email}</p> : null}
                        {item.reviewedAt ? <p className="mt-1 text-xs">{item.reviewedAt.toLocaleDateString('uk-UA')}</p> : null}
                      </div>
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
