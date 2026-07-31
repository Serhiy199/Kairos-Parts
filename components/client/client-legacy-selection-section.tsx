import { calculateInvoiceLineTotal, formatInvoiceMoney } from '@/lib/invoices/totals';
import type { ClientLegacyItemReadModel } from '@/lib/request-selection/client-read-model';

function formatMoney(value: { toString: () => string } | string | null, currency: string) {
  return value ? formatInvoiceMoney(value, currency) : null;
}

export function ClientLegacySelectionSection({
  items
}: {
  items: ClientLegacyItemReadModel[];
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase text-accent">Архівна версія</p>
            <h3 className="mt-2 text-lg font-bold text-foreground">Історичні позиції підбору</h3>
            <p className="mt-2 text-sm text-muted">
              Ця заявка використовує попередній формат погодження. Дані збережені
              для перегляду; змінити рішення або склад рахунку тут неможливо.
            </p>
          </div>
          <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
            Лише перегляд
          </span>
        </div>

        <div className="mt-4 grid min-w-0 gap-3">
          {items.map((item) => {
            const itemTotal = item.salePrice
              ? calculateInvoiceLineTotal(item.quantity, item.salePrice)
              : null;

            return (
              <article key={item.id} className="min-w-0 rounded-md border border-border p-4">
                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,auto)] xl:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-muted">Запчастина</p>
                    <p className="mt-2 break-words font-bold text-foreground">{item.name}</p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {item.brand ?? 'Виробник уточнюється'}
                    </p>
                    {item.comment ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted">
                        {item.comment}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 text-sm text-muted">
                    <p className="text-xs font-bold uppercase text-muted">Номери</p>
                    <p className="mt-2 break-words [overflow-wrap:anywhere]">
                      Каталог: <span className="font-semibold text-foreground">{item.catalogNumber ?? '—'}</span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-muted">К-сть</p>
                    <p className="mt-2 break-words font-semibold text-foreground">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <div className="min-w-0 text-sm text-muted">
                    <p className="text-xs font-bold uppercase text-muted">Наявність</p>
                    <p className="mt-2 break-words">{item.availability ?? 'Уточнюється'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-muted">Ціна без ПДВ</p>
                    <p className="mt-2 break-words font-semibold text-foreground">
                      {formatMoney(item.salePrice, item.currency) ?? 'Уточнюється'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-muted">Сума без ПДВ</p>
                    <p className="mt-2 break-words font-semibold text-foreground">
                      {formatMoney(itemTotal, item.currency) ?? 'Уточнюється'}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap gap-2">
                      {item.approvedByClient ? (
                        <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-bold text-success">
                          Погоджено
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#FFF7E0] px-2.5 py-1 text-xs font-bold text-[#8A5B24]">
                          Очікує погодження
                        </span>
                      )}
                      {item.includeInInvoice ? (
                        <span className="rounded-full bg-[#E8F1FF] px-2.5 py-1 text-xs font-bold text-info">
                          Включено у рахунок
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
    </section>
  );
}
