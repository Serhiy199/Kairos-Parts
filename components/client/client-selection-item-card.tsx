import type { ReactNode } from 'react';

import {
  formatClientSelectionPrice,
  formatClientSelectionQuantity
} from '@/lib/request-selection/client-presentation';
import type { ClientSelectionItemReadModel } from '@/lib/request-selection/client-read-model';
import {
  REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS
} from '@/lib/request-selection/presentation';

const itemStatusClasses = {
  PENDING: 'bg-[#FFF7E0] text-[#8A5B24]',
  APPROVED: 'bg-[#E7F6EC] text-success',
  REJECTED: 'bg-red-50 text-red-700'
} as const;

export function ClientSelectionItemCard({
  item,
  decisionControl,
  decisionMessage
}: {
  item: ClientSelectionItemReadModel;
  decisionControl?: ReactNode;
  decisionMessage?: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-md border border-border p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-muted">
            Позиція {item.position}
          </p>
          <h4 className="mt-2 break-words font-bold text-foreground">
            {item.itemName}
          </h4>
          <p className="mt-1 break-words text-xs text-muted">
            {item.brand ?? 'Виробник уточнюється'}
            {item.equipmentType ? ` · ${item.equipmentType}` : ''}
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-col items-start gap-2 sm:max-w-[48%] sm:items-end">
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${itemStatusClasses[item.status]}`}
          >
            {REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS[item.status]}
          </span>
          {decisionControl}
        </div>
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
          <p className="text-xs font-bold uppercase text-red-700">
            Коментар клієнта
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-red-700">
            {item.clientComment}
          </p>
        </div>
      ) : null}

      {decisionMessage ? (
        <div className="mt-4 border-t border-border pt-4">{decisionMessage}</div>
      ) : null}
    </article>
  );
}
