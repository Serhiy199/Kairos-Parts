import Link from 'next/link';

import { PrintButton } from '@/components/invoices/print-button';
import { INVOICE_STATUS_LABELS } from '@/lib/invoices/validation';

type MoneyLike = {
  toString: () => string;
};

type InvoicePrintItem = {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
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
  };
  items: InvoicePrintItem[];
};

type BillingSnapshot = Record<string, unknown>;

type InvoicePrintViewProps = {
  invoice: InvoicePrintData;
  backHref: string;
  backLabel: string;
};

function asBillingSnapshot(snapshot: unknown): BillingSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as BillingSnapshot;
}

function stringField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function booleanField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'boolean' ? (value ? 'Так' : 'Ні') : null;
}

function formatMoney(value: MoneyLike | null, currency: string) {
  return value ? `${value.toString()} ${currency}` : '—';
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString('uk-UA') : '—';
}

function SnapshotBlock({ title, snapshot, buyer = false }: { title: string; snapshot: BillingSnapshot | null; buyer?: boolean }) {
  const rows = [
    ['Назва', stringField(snapshot, 'legalName')],
    ['ЄДРПОУ', stringField(snapshot, 'edrpou')],
    ['ІПН', stringField(snapshot, 'ipn')],
    ['IBAN', stringField(snapshot, 'iban')],
    ['Банк', stringField(snapshot, 'bankName')],
    ['МФО', stringField(snapshot, 'mfo')],
    ['Юридична адреса', stringField(snapshot, 'legalAddress')],
    ['Контактна особа', stringField(snapshot, 'contactPerson')],
    ['Телефон', stringField(snapshot, 'phone')],
    ['Email', stringField(snapshot, 'email')],
    ...(buyer ? [['Платник ПДВ', booleanField(snapshot, 'vatPayer')]] : [])
  ].filter(([, value]) => value !== null);

  return (
    <section className="rounded-md border border-[#d7d9dd] p-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">{title}</h2>
      {snapshot ? (
        <dl className="mt-4 grid gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-[150px_1fr]">
              <dt className="font-semibold text-[#4C4F54]">{label}</dt>
              <dd className="text-[#101010]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-[#4C4F54]">Реквізити не збережені у snapshot цього рахунку.</p>
      )}
    </section>
  );
}

export function InvoicePrintView({ invoice, backHref, backLabel }: InvoicePrintViewProps) {
  const sellerSnapshot = asBillingSnapshot(invoice.sellerSnapshot);
  const buyerSnapshot = asBillingSnapshot(invoice.buyerSnapshot);
  const statusLabel = INVOICE_STATUS_LABELS[invoice.status];

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-4 py-6 text-[#101010] print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
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
        <header className="flex flex-col gap-6 border-b border-[#d7d9dd] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C89642]">Kairos Parts</p>
            <h1 className="mt-3 text-3xl font-bold text-[#050505]">Рахунок {invoice.invoiceNumber}</h1>
            <p className="mt-2 text-sm text-[#4C4F54]">Заявка: {invoice.request.requestNumber}</p>
          </div>
          <div className="rounded-md border border-[#d7d9dd] p-4 text-sm">
            <p className="font-bold text-[#050505]">{statusLabel}</p>
            <p className="mt-2 text-[#4C4F54]">Дата: {formatDate(invoice.createdAt)}</p>
            {invoice.sentAt ? <p className="mt-1 text-[#4C4F54]">Надіслано: {formatDate(invoice.sentAt)}</p> : null}
            {invoice.paidAt ? <p className="mt-1 text-[#1E7A3B]">Оплачено: {formatDate(invoice.paidAt)}</p> : null}
            {invoice.cancelledAt ? <p className="mt-1 text-[#B42318]">Скасовано: {formatDate(invoice.cancelledAt)}</p> : null}
          </div>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SnapshotBlock title="Дані продавця" snapshot={sellerSnapshot} />
          <SnapshotBlock title="Дані покупця" snapshot={buyerSnapshot} buyer />
        </div>

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A5B24]">Позиції рахунку</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-[#d7d9dd]">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d7d9dd] bg-[#f6f7f8] text-[#4C4F54]">
                  <th className="px-3 py-3 font-bold">№</th>
                  <th className="px-3 py-3 font-bold">Назва</th>
                  <th className="px-3 py-3 font-bold">Виробник</th>
                  <th className="px-3 py-3 font-bold">Артикул / каталог</th>
                  <th className="px-3 py-3 font-bold">К-сть</th>
                  <th className="px-3 py-3 font-bold">Од.</th>
                  <th className="px-3 py-3 font-bold">Ціна</th>
                  <th className="px-3 py-3 font-bold">Сума</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className="print-break-inside-avoid border-b border-[#e4e6e9] align-top last:border-0">
                    <td className="px-3 py-3 text-[#4C4F54]">{index + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-[#050505]">{item.name}</p>
                      {item.comment ? <p className="mt-1 text-xs leading-5 text-[#4C4F54]">{item.comment}</p> : null}
                    </td>
                    <td className="px-3 py-3">{item.brand ?? '—'}</td>
                    <td className="px-3 py-3 text-[#4C4F54]">
                      <p>Каталог: <span className="font-semibold text-[#101010]">{item.catalogNumber ?? '—'}</span></p>
                      <p className="mt-1">Аналог: <span className="font-semibold text-[#101010]">{item.analogNumber ?? '—'}</span></p>
                    </td>
                    <td className="px-3 py-3 font-semibold">{item.quantity}</td>
                    <td className="px-3 py-3">{item.unit ?? 'шт'}</td>
                    <td className="px-3 py-3">{formatMoney(item.price, invoice.currency)}</td>
                    <td className="px-3 py-3 font-bold">{formatMoney(item.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#C89642] bg-[#fbf7ef]">
                  <td colSpan={7} className="px-3 py-4 text-right font-bold">
                    Разом
                  </td>
                  <td className="px-3 py-4 text-lg font-bold">{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                </tr>
              </tfoot>
            </table>
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

        <footer className="mt-8 border-t border-[#d7d9dd] pt-4 text-xs leading-5 text-[#4C4F54]">
          <p>Цей друкований перегляд сформовано в Kairos Parts на основі погоджених клієнтом позицій.</p>
          <p className="mt-1">Для PDF використайте кнопку “Друк / Зберегти PDF” та системний діалог браузера.</p>
        </footer>
      </article>
    </main>
  );
}
