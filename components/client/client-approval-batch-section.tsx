import { submitClientSelectionAction } from '@/app/client/actions';
import type { ClientRequestApprovalReadModel } from '@/lib/request-selection/client-read-model';
import { ClientSelectionCheckboxList } from '@/components/client/client-selection-checkbox-list';
import {
  formatClientSelectionPrice,
  formatClientSelectionQuantity
} from '@/lib/request-selection/client-presentation';
import { REQUEST_SELECTION_BATCH_STATUS_LABELS } from '@/lib/request-selection/presentation';

type BatchReadModel = Extract<ClientRequestApprovalReadModel, { mode: 'BATCH' }>;

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
  const approvedCount = activeBatch.items.filter(
    (item) => item.status === 'APPROVED'
  ).length;
  const rejectedCount = activeBatch.items.filter(
    (item) => item.status === 'REJECTED'
  ).length;
  const previouslyApprovedItems = model.previouslyApprovedItems;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-accent">
            Версія підбору №{activeBatch.revision}
          </p>
          <h3 className="mt-2 break-words text-lg font-bold text-foreground">
            {activeBatch.status === 'SENT' && activeBatch.previouslyApprovedCount > 0
              ? 'Нові й оновлені позиції для погодження'
              : 'Зафіксована добірка позицій'}
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
          <span className="rounded-full bg-[#E7F6EC] px-3 py-1 text-xs font-bold text-success">
            Погоджено: {approvedCount}
          </span>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            Відхилено: {rejectedCount}
          </span>
        </div>
      </div>

      {activeBatch.status === 'SENT' ? (
        <div className="mt-5 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm leading-6 text-[#8A5B24]">
          {activeBatch.previouslyApprovedCount > 0 ? (
            <p className="mb-2 font-semibold text-success">
              Раніше погоджено: {activeBatch.previouslyApprovedCount} позицій.
              Вони збережені для майбутнього рахунку.
            </p>
          ) : null}
          Позначте галочками позиції, які ви погоджуєте. Позиції без галочки
          будуть підготовлені як непогоджені. На цьому етапі вибір зберігається
          лише локально у браузері.
        </div>
      ) : null}
      {activeBatch.status === 'SENT' && previouslyApprovedItems.length > 0 ? (
        <details className="mt-5 min-w-0 rounded-md border border-success/25 bg-[#F5FBF7] p-4">
          <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block break-words text-sm font-bold text-foreground">
                  Раніше погоджені позиції
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Ці позиції вже погоджені та збережені для майбутнього рахунку.
                </span>
              </span>
              <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">
                {previouslyApprovedItems.length} позицій
              </span>
            </span>
          </summary>
          <div className="mt-4 grid min-w-0 gap-3">
            {previouslyApprovedItems.map((item) => (
              <article
                key={item.batchItemId}
                className="min-w-0 rounded-md border border-border bg-card p-3"
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-foreground">
                      {item.itemName}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted [overflow-wrap:anywhere]">
                      Каталог: {item.catalogNumber ?? '—'} · Версія №{item.revision}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">
                      Погоджено
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.invoiceState === 'IN_INVOICE'
                        ? 'bg-[#E8F1FF] text-info'
                        : 'bg-[#FFF7E0] text-[#8A5B24]'
                    }`}>
                      {item.invoiceState === 'IN_INVOICE'
                        ? 'Внесено в рахунок'
                        : 'Очікує на створення рахунку'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid min-w-0 gap-2 text-xs sm:grid-cols-2">
                  <p className="break-words text-muted [overflow-wrap:anywhere]">
                    Аналог: <span className="font-semibold text-foreground">{item.analogNumber ?? '—'}</span>
                  </p>
                  <p className="break-words text-muted">
                    Кількість: <span className="font-semibold text-foreground">
                      {formatClientSelectionQuantity(item.quantity, item.unit)}
                    </span>
                  </p>
                  <p className="break-words text-muted">
                    Ціна: <span className="font-semibold text-foreground">
                      {formatClientSelectionPrice(item.unitPrice, item.currency)}
                    </span>
                  </p>
                  <p className="break-words text-muted">
                    Техніка: <span className="font-semibold text-foreground">
                      {item.vehicle?.displayName
                        ?? ([item.vehicle?.brand, item.vehicle?.model, item.vehicle?.year]
                          .filter(Boolean)
                          .join(' ') || '—')}
                    </span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </details>
      ) : null}
      {activeBatch.status === 'APPROVED' ? (
        <div className="mt-5 rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">
          Усі позиції погоджено. Заявка очікує формування рахунку.
        </div>
      ) : null}
      {activeBatch.status === 'PARTIALLY_APPROVED' ? (
        <div className="mt-5 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm leading-6 text-[#8A5B24]">
          Погодження завершено частково: погоджено {approvedCount}, відхилено{' '}
          {rejectedCount}. Рахунок формуватиметься лише за погодженими позиціями.
        </div>
      ) : null}
      {activeBatch.status === 'REJECTED' ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          Усі позиції відхилено. Рахунок за цією версією сформувати не можна.
        </div>
      ) : null}

      <ClientSelectionCheckboxList
        model={model}
        submitAction={submitClientSelectionAction}
      />
    </section>
  );
}
