import { Prisma } from '@prisma/client';

type DecimalLike = Prisma.Decimal.Value | { toString: () => string };

export const INVOICE_VAT_RATE = new Prisma.Decimal('0.20');

export type InvoiceTotals = {
  subtotalWithoutVat: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  totalWithVat: Prisma.Decimal;
};

function decimal(value: DecimalLike) {
  return new Prisma.Decimal(value.toString());
}

export function calculateInvoiceLineTotal(quantity: number, price: DecimalLike) {
  return decimal(price).mul(quantity);
}

export function resolveInvoiceLineTotal(item: { quantity: number; price: DecimalLike; total: DecimalLike }) {
  const storedTotal = decimal(item.total);

  return storedTotal.isZero() ? calculateInvoiceLineTotal(item.quantity, item.price) : storedTotal;
}

export function calculateInvoiceTotals(items: Array<{ quantity: number; price: DecimalLike; total: DecimalLike }>): InvoiceTotals {
  const subtotalWithoutVat = items.reduce((sum, item) => sum.add(resolveInvoiceLineTotal(item)), new Prisma.Decimal(0));
  const vatAmount = subtotalWithoutVat.mul(INVOICE_VAT_RATE);

  return {
    subtotalWithoutVat,
    vatAmount,
    totalWithVat: subtotalWithoutVat.add(vatAmount)
  };
}

export function formatInvoiceMoney(value: DecimalLike, currency: string) {
  const amount = Number(decimal(value).toString());

  if (!Number.isFinite(amount)) {
    return `${decimal(value).toString()} ${currency}`;
  }

  return `${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

export function resolveInvoiceSubtotalWithoutVat({
  totalAmount,
  items
}: {
  totalAmount: DecimalLike;
  items: Array<{ quantity: number; price: DecimalLike; total: DecimalLike }>;
}) {
  const storedTotal = decimal(totalAmount);

  return storedTotal.isZero() ? calculateInvoiceTotals(items).subtotalWithoutVat : storedTotal;
}
