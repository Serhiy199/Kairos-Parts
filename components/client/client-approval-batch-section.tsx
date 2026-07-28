import type { ClientRequestApprovalReadModel } from '@/lib/request-selection/client-read-model';
import { ClientSelectionDecisionControls } from '@/components/client/client-selection-decision-controls';
import {
  formatClientSelectionPrice,
  formatClientSelectionQuantity
} from '@/lib/request-selection/client-presentation';
import {
  REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS,
  REQUEST_SELECTION_BATCH_STATUS_LABELS
} from '@/lib/request-selection/presentation';

type BatchReadModel = Extract<ClientRequestApprovalReadModel, { mode: 'BATCH' }>;

const itemStatusClasses = {
  PENDING: 'bg-[#FFF7E0] text-[#8A5B24]',
  APPROVED: 'bg-[#E7F6EC] text-success',
  REJECTED: 'bg-red-50 text-red-700'
} as const;

function formatSentAt(value: string | null) {
  if (!value) return 'Дата надсилання не зафіксована';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Дата надсилання не зафіксована'
    : date.toLocaleString('uk-UA');
}

export function ClientApprovalBatchSection({
  model
}: {
  model: BatchReadModel;
}) {
  const { activeBatch } = model;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-accent">
            Версія підбору №{activeBatch.revision}
          </p>
          <h3 className="mt-2 break-words text-lg font-bold text-foreground">
            Зафіксована добірка позицій
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Ви переглядаєте незмінну версію підбору, яку менеджер надіслав на погодження.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Надіслано: {formatSentAt(activeBatch.sentAt)}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <span className="rounded-full bg-[#E8F1FF] px-3 py-1 text-xs font-bold text-info">
            {REQUEST_SELECTION_BATCH_STATUS_LABELS[activeBatch.status]}
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
            {activeBatch.itemCount} позицій
          </span>
        </div>
      </div>

      {activeBatch.status === 'SENT' ? (
        <div className="mt-5 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm leading-6 text-[#8A5B24]">
          Перевірте кожну позицію та погодьте її або вкажіть причину відхилення.
          Після першого відхилення ця версія добірки буде закрита.
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-3">
        {activeBatch.items.map((item) => (
          <article key={item.id} className="min-w-0 rounded-md border border-border p-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Позиція {item.position}</p>
                <h4 className="mt-2 break-words font-bold text-foreground">{item.itemName}</h4>
                <p className="mt-1 break-words text-xs text-muted">
                  {item.brand ?? 'Виробник уточнюється'}
                  {item.equipmentType ? ` · ${item.equipmentType}` : ''}
                </p>
              </div>
              <span
                className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${itemStatusClasses[item.status]}`}
              >
                {REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS[item.status]}
              </span>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Каталожні номери</p>
                <p className="mt-2 break-words text-sm text-foreground [overflow-wrap:anywhere]">
                  Каталог: {item.catalogNumber ?? '—'}
                </p>
                <p className="mt-1 break-words text-sm text-muted [overflow-wrap:anywhere]">
                  Аналог: {item.analogNumber ?? '—'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Кількість</p>
                <p className="mt-2 break-words text-sm font-semibold text-foreground">
                  {formatClientSelectionQuantity(item.quantity, item.unit)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Наявність і доставка</p>
                <p className="mt-2 break-words text-sm text-foreground">
                  {item.availability ?? 'Уточнюється'}
                </p>
                <p className="mt-1 break-words text-sm text-muted">
                  {item.deliveryTime ?? 'Термін уточнюється'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-muted">Ціна без ПДВ</p>
                <p className="mt-2 break-words text-sm font-semibold text-foreground">
                  {formatClientSelectionPrice(item.unitPrice, item.currency)}
                </p>
              </div>
            </div>

            {item.vehicle ? (
              <div className="mt-4 min-w-0 rounded-md bg-surface-muted p-3 text-sm">
                <p className="text-xs font-bold uppercase text-muted">Техніка</p>
                <p className="mt-2 break-words font-semibold text-foreground">
                  {item.vehicle.displayName
                    ?? ([item.vehicle.brand, item.vehicle.model, item.vehicle.year]
                      .filter(Boolean)
                      .join(' ') || 'Техніка не уточнена')}
                </p>
                {item.vehicle.displayName ? (
                  <p className="mt-1 break-words text-xs text-muted">
                    {[item.vehicle.brand, item.vehicle.model, item.vehicle.year]
                      .filter(Boolean)
                      .join(' ') || 'Додаткові дані не вказані'}
                  </p>
                ) : null}
              </div>
            ) : null}

            {item.managerComment ? (
              <div className="mt-4 min-w-0 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase text-muted">Коментар менеджера</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {item.managerComment}
                </p>
              </div>
            ) : null}

            {item.clientComment ? (
              <div className="mt-4 min-w-0 rounded-md bg-red-50 p-3">
                <p className="text-xs font-bold uppercase text-red-700">Ваш коментар</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-red-700">
                  {item.clientComment}
                </p>
              </div>
            ) : null}

            <div className="mt-4 border-t border-border pt-4">
              {activeBatch.status === 'SENT' && item.status === 'PENDING' ? (
                <ClientSelectionDecisionControls
                  target={{
                    requestId: model.request.id,
                    batchId: activeBatch.id,
                    batchItemId: item.id,
                    revision: activeBatch.revision
                  }}
                />
              ) : item.status === 'APPROVED' ? (
                <p className="text-sm font-semibold text-success">
                  Ви погодили цю позицію.
                </p>
              ) : item.status === 'REJECTED' ? (
                <p className="text-sm font-semibold text-red-700">
                  Позицію відхилено.
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted">
                  Рішення для цієї версії більше не приймаються.
                </p>
              )}
            </div>
          </article>
        ))}

        {activeBatch.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">
            У цій версії підбору немає позицій.
          </p>
        ) : null}
      </div>
    </section>
  );
}
