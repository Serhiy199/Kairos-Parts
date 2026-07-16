import Link from 'next/link';

import { PrintButton } from '@/components/invoices/print-button';
import { buildInvoicePartyDetails } from '@/lib/invoices/party-details';
import { calculateInvoiceTotals, formatInvoiceMoney } from '@/lib/invoices/totals';
import { INVOICE_STATUS_LABELS } from '@/lib/invoices/validation';

type MoneyLike = {
  toString: () => string;
};

type InvoicePrintItem = {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number;
  unit: string | null;
  price: MoneyLike;
  total: MoneyLike;
  comment: string | null;
};

type InvoicePrintData = {
  id: string;
  invoiceNumber: string;
  status: keyof typeof INVOICE_STATUS_LABELS;
  currency: string;
  subtotal: MoneyLike;
  totalAmount: MoneyLike;
  managerComment: string | null;
  clientComment: string | null;
  sellerSnapshot: unknown;
  buyerSnapshot: unknown;
  sentAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  request: {
    id: string;
    requestNumber: string;
    createdAt: Date;
  };
  items: InvoicePrintItem[];
};

type InvoicePrintViewProps = {
  invoice: InvoicePrintData;
  backHref: string;
  backLabel: string;
};

function formatMoney(value: MoneyLike | null, currency: string) {
  return value ? formatInvoiceMoney(value, currency) : '—';
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString('uk-UA') : '—';
}

function SnapshotBlock({ title, snapshot, buyer = false }: { title: string; snapshot: unknown; buyer?: boolean }) {
  const details = buildInvoicePartyDetails(snapshot, { includeVatPayer: buyer });

  return (
    <section className="print-compact-party rounded-md border border-[#d7d9dd] p-4 print-break-inside-avoid">
      <h2 className="print-compact-title text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">{title}</h2>
      {details ? (
        <p className="mt-3 text-sm leading-6 text-[#101010] [overflow-wrap:anywhere] print:mt-2">{details}</p>
      ) : (
        <p className="mt-3 text-sm text-[#4C4F54]">Реквізити не збережені у snapshot цього рахунку.</p>
      )}
    </section>
  );
}

export function InvoicePrintView({ invoice, backHref, backLabel }: InvoicePrintViewProps) {
  const statusLabel = INVOICE_STATUS_LABELS[invoice.status];
  const totals = calculateInvoiceTotals(invoice.items);

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-4 py-6 text-[#101010] print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 9mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            box-shadow: none !important;
            border: 0 !important;
            max-width: none !important;
            padding: 0 !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid;
          }

          .print-compact-party {
            padding: 9pt !important;
          }

          .print-compact-party p {
            font-size: 8.5pt !important;
            line-height: 1.28 !important;
          }

          .print-compact-title {
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .print-compact-footer {
            font-size: 7.5pt !important;
            line-height: 1.35 !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-md border border-[#d7d9dd] bg-white px-4 py-2 text-sm font-bold text-[#101010] transition hover:border-[#C89642]"
        >
          {backLabel}
        </Link>
        <PrintButton />
      </div>

      <article className="print-page mx-auto w-full max-w-5xl rounded-lg border border-[#d7d9dd] bg-white p-8 shadow-sm">
        <header className="flex flex-col gap-5 border-b border-[#d7d9dd] pb-5 sm:flex-row sm:items-start sm:justify-between print:gap-3 print:pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C89642] print:text-[8pt]">Kairos Parts</p>
            <h1 className="mt-3 text-3xl font-bold text-[#050505] print:mt-2 print:text-[19pt] print:leading-tight">Рахунок {invoice.invoiceNumber}</h1>
            <p className="mt-2 text-sm text-[#4C4F54] print:mt-1 print:text-[8.5pt]">Заявка: {invoice.request.requestNumber}</p>
          </div>
          <div className="rounded-md border border-[#d7d9dd] p-4 text-sm print:p-3 print:text-[8.5pt] print:leading-snug">
            <p className="font-bold text-[#050505]">{statusLabel}</p>
            <p className="mt-2 text-[#4C4F54] print:mt-1">Створення заявки: {formatDate(invoice.request.createdAt)}</p>
            {invoice.sentAt ? <p className="mt-1 text-[#4C4F54]">Надіслано: {formatDate(invoice.sentAt)}</p> : null}
            {invoice.paidAt ? <p className="mt-1 text-[#1E7A3B]">Оплачено: {formatDate(invoice.paidAt)}</p> : null}
            {invoice.cancelledAt ? <p className="mt-1 text-[#B42318]">Скасовано: {formatDate(invoice.cancelledAt)}</p> : null}
          </div>
        </header>

        <div className="mt-5 grid gap-3 print:mt-3 print:gap-2">
          <SnapshotBlock title="Дані продавця" snapshot={invoice.sellerSnapshot} />
          <SnapshotBlock title="Дані покупця" snapshot={invoice.buyerSnapshot} buyer />
        </div>

        <section className="mt-6 print:mt-4">
          <h2 className="print-compact-title text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">Позиції рахунку</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-[#d7d9dd] print:mt-2">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm print:min-w-0 print:text-[8pt] print:leading-snug">
              <thead>
                <tr className="border-b border-[#d7d9dd] bg-[#f6f7f8] text-[#4C4F54]">
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">№</th>
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">Назва</th>
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">Виробник</th>
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">Артикул / каталог</th>
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">К-сть</th>
                  <th className="px-3 py-3 font-bold print:px-2 print:py-[5pt]">Од.</th>
                  <th className="px-3 py-3 text-right font-bold print:px-2 print:py-[5pt]">Ціна без ПДВ</th>
                  <th className="px-3 py-3 text-right font-bold print:px-2 print:py-[5pt]">Сума без ПДВ</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className="print-break-inside-avoid border-b border-[#e4e6e9] align-top last:border-0">
                    <td className="px-3 py-3 text-[#4C4F54] print:px-2 print:py-[5pt]">{index + 1}</td>
                    <td className="px-3 py-3 print:px-2 print:py-[5pt]">
                      <p className="font-bold text-[#050505]">{item.name}</p>
                      {item.comment ? <p className="mt-1 text-xs leading-5 text-[#4C4F54] print:text-[7.5pt] print:leading-snug">{item.comment}</p> : null}
                    </td>
                    <td className="px-3 py-3 print:px-2 print:py-[5pt]">{item.brand ?? '—'}</td>
                    <td className="px-3 py-3 text-[#4C4F54] print:px-2 print:py-[5pt]">
                      <p>Каталог: <span className="font-semibold text-[#101010]">{item.catalogNumber ?? '—'}</span></p>
                    </td>
                    <td className="px-3 py-3 font-semibold print:px-2 print:py-[5pt]">{item.quantity}</td>
                    <td className="px-3 py-3 print:px-2 print:py-[5pt]">{item.unit ?? 'шт'}</td>
                    <td className="px-3 py-3 text-right print:px-2 print:py-[5pt]">{formatMoney(item.price, invoice.currency)}</td>
                    <td className="px-3 py-3 text-right font-bold print:px-2 print:py-[5pt]">{formatMoney(item.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-4 w-full max-w-sm rounded-md border border-[#d7d9dd] bg-[#fbf7ef] p-3 text-sm print:mt-3 print:max-w-xs print:p-3 print:text-[8.5pt]">
            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 print:gap-y-1">
              <span className="text-right font-semibold text-[#4C4F54]">Разом:</span>
              <span className="text-right font-bold text-[#050505]">{formatMoney(totals.subtotalWithoutVat, invoice.currency)}</span>
              <span className="text-right font-semibold text-[#4C4F54]">Сума ПДВ:</span>
              <span className="text-right font-bold text-[#050505]">{formatMoney(totals.vatAmount, invoice.currency)}</span>
              <span className="border-t border-[#C89642] pt-2 text-right text-base font-bold text-[#050505] print:pt-1.5 print:text-[10pt]">Усього з ПДВ:</span>
              <span className="border-t border-[#C89642] pt-2 text-right text-base font-bold text-[#050505] print:pt-1.5 print:text-[10pt]">{formatMoney(totals.totalWithVat, invoice.currency)}</span>
            </div>
          </div>
        </section>

        {invoice.managerComment || invoice.clientComment ? (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {invoice.managerComment ? (
              <div className="rounded-md border border-[#d7d9dd] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">Коментар менеджера</p>
                <p className="mt-3 text-sm leading-6 text-[#101010]">{invoice.managerComment}</p>
              </div>
            ) : null}
            {invoice.clientComment ? (
              <div className="rounded-md border border-[#d7d9dd] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">Коментар клієнта</p>
                <p className="mt-3 text-sm leading-6 text-[#101010]">{invoice.clientComment}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 grid gap-10 border-t border-[#d7d9dd] pt-5 sm:grid-cols-2 print:mt-4 print:pt-3">
          <div>
            <p className="text-sm font-bold text-[#050505] print:text-[8.5pt]">Виконавець</p>
            <div className="mt-6 border-b border-[#101010] print:mt-[14pt]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#050505] print:text-[8.5pt]">Замовник</p>
            <div className="mt-6 border-b border-[#101010] print:mt-[14pt]" />
          </div>
        </section>

        <footer className="print-compact-footer mt-6 border-t border-[#d7d9dd] pt-3 text-xs leading-5 text-[#4C4F54] print:mt-4 print:pt-2">
          <p>Цей друкований перегляд сформовано в Kairos Parts на основі погоджених клієнтом позицій.</p>
          <p className="mt-1">Для PDF використайте кнопку “Друк / Зберегти PDF” та системний діалог браузера.</p>
        </footer>
      </article>
    </main>
  );
}
