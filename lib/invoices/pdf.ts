import fs from 'node:fs';
import path from 'node:path';

import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type BillingSnapshot = Record<string, unknown>;
type DecimalLike = Prisma.Decimal.Value | { toString: () => string };

const REGULAR_FONT_PATH = path.join(process.cwd(), 'node_modules/prisma/build/public/assets/inter-all-400-normal.4c1f8a0d.woff');
const BOLD_FONT_PATH = path.join(process.cwd(), 'node_modules/prisma/build/public/assets/inter-all-600-normal.d0a7c8a9.woff');

function asBillingSnapshot(snapshot: unknown): BillingSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as BillingSnapshot;
}

function stringField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'string' && value.trim() ? value : '—';
}

function booleanField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'boolean' ? (value ? 'Так' : 'Ні') : '—';
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString('uk-UA') : '—';
}

function decimal(value: DecimalLike) {
  return new Prisma.Decimal(value.toString());
}

export function resolveInvoiceTotalAmount({
  totalAmount,
  items
}: {
  totalAmount: DecimalLike;
  items: Array<{ quantity: number; price: DecimalLike; total: DecimalLike }>;
}) {
  const storedTotal = decimal(totalAmount);

  if (!storedTotal.isZero()) {
    return storedTotal;
  }

  return items.reduce((sum, item) => {
    const itemTotal = decimal(item.total);
    return sum.add(itemTotal.isZero() ? decimal(item.price).mul(item.quantity) : itemTotal);
  }, new Prisma.Decimal(0));
}

export function formatInvoiceMoney(value: DecimalLike, currency: string) {
  const numericAmount = Number(decimal(value).toString());

  if (!Number.isFinite(numericAmount)) {
    return `${decimal(value).toString()} ${currency}`;
  }

  return `${numericAmount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

function cleanFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
}

function collectPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1);
  doc.font('InterBold').fontSize(10).fillColor('#8A5B24').text(title.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.6);
}

function addKeyValueRows(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, options: { x?: number; width?: number } = {}) {
  const x = options.x ?? doc.x;
  const labelWidth = 118;
  const valueX = x + labelWidth;
  const valueWidth = (options.width ?? 245) - labelWidth;

  rows.forEach(([label, value]) => {
    const y = doc.y;
    doc.font('InterBold').fontSize(8).fillColor('#4C4F54').text(label, x, y, { width: labelWidth });
    doc.font('Inter').fontSize(8).fillColor('#101010').text(value, valueX, y, { width: valueWidth });
    doc.y = Math.max(doc.y, y + 15);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function addCell(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, options: { bold?: boolean; align?: 'left' | 'right' } = {}) {
  doc
    .font(options.bold ? 'InterBold' : 'Inter')
    .fontSize(8)
    .fillColor(options.bold ? '#050505' : '#101010')
    .text(text, x, y, { width, align: options.align ?? 'left', lineGap: 2 });
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      request: { select: { requestNumber: true, createdAt: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!invoice) {
    throw new Error('invoice_not_found');
  }

  if (!fs.existsSync(REGULAR_FONT_PATH) || !fs.existsSync(BOLD_FONT_PATH)) {
    throw new Error('invoice_pdf_font_not_found');
  }

  const totalAmount = resolveInvoiceTotalAmount({
    totalAmount: invoice.totalAmount,
    items: invoice.items
  });
  const sellerSnapshot = asBillingSnapshot(invoice.sellerSnapshot);
  const buyerSnapshot = asBillingSnapshot(invoice.buyerSnapshot);
  const doc = new PDFDocument({ size: 'A4', margin: 38, bufferPages: true, font: REGULAR_FONT_PATH });
  const bufferPromise = collectPdfBuffer(doc);

  doc.registerFont('Inter', REGULAR_FONT_PATH);
  doc.registerFont('InterBold', BOLD_FONT_PATH);
  doc.font('Inter');

  doc.fillColor('#C89642').font('InterBold').fontSize(9).text('KAIROS PARTS', { characterSpacing: 1.6 });
  doc.moveDown(0.5);
  doc.fillColor('#050505').fontSize(21).text(`Рахунок ${invoice.invoiceNumber}`);
  doc.moveDown(0.35);
  doc.fillColor('#4C4F54').font('Inter').fontSize(9).text(`Заявка: ${invoice.request.requestNumber}`);
  doc.moveDown(0.8);

  addKeyValueRows(doc, [
    ['Створення заявки', formatDate(invoice.request.createdAt)],
    ['Надіслано', formatDate(invoice.sentAt)],
    ['Валюта', invoice.currency],
    ['Загальна сума', formatInvoiceMoney(totalAmount, invoice.currency)]
  ]);

  addSectionTitle(doc, 'Дані продавця');
  addKeyValueRows(doc, [
    ['Назва', stringField(sellerSnapshot, 'legalName')],
    ['ЄДРПОУ', stringField(sellerSnapshot, 'edrpou')],
    ['ІПН', stringField(sellerSnapshot, 'ipn')],
    ['IBAN', stringField(sellerSnapshot, 'iban')],
    ['Банк', stringField(sellerSnapshot, 'bankName')],
    ['МФО', stringField(sellerSnapshot, 'mfo')],
    ['Юридична адреса', stringField(sellerSnapshot, 'legalAddress')],
    ['Телефон', stringField(sellerSnapshot, 'phone')],
    ['Email', stringField(sellerSnapshot, 'email')]
  ], { width: 500 });

  addSectionTitle(doc, 'Дані покупця');
  addKeyValueRows(doc, [
    ['Назва', stringField(buyerSnapshot, 'legalName')],
    ['ЄДРПОУ', stringField(buyerSnapshot, 'edrpou')],
    ['ІПН', stringField(buyerSnapshot, 'ipn')],
    ['IBAN', stringField(buyerSnapshot, 'iban')],
    ['Банк', stringField(buyerSnapshot, 'bankName')],
    ['Юридична адреса', stringField(buyerSnapshot, 'legalAddress')],
    ['Контактна особа', stringField(buyerSnapshot, 'contactPerson')],
    ['Телефон', stringField(buyerSnapshot, 'phone')],
    ['Email', stringField(buyerSnapshot, 'email')],
    ['Платник ПДВ', booleanField(buyerSnapshot, 'vatPayer')]
  ], { width: 500 });

  addSectionTitle(doc, 'Позиції');

  const tableX = doc.x;
  const columns = [
    { title: '№', width: 24 },
    { title: 'Назва', width: 118 },
    { title: 'Виробник', width: 66 },
    { title: 'Артикул / каталог', width: 82 },
    { title: 'К-сть', width: 40 },
    { title: 'Од.', width: 34 },
    { title: 'Ціна', width: 62 },
    { title: 'Сума', width: 72 }
  ];

  ensureSpace(doc, 48);
  let y = doc.y;
  doc.rect(tableX, y, 498, 22).fill('#f6f7f8');
  let x = tableX;
  columns.forEach((column) => {
    addCell(doc, column.title, x + 4, y + 7, column.width - 8, { bold: true });
    x += column.width;
  });
  y += 22;

  invoice.items.forEach((item, index) => {
    const itemTotal = decimal(item.total).isZero() ? decimal(item.price).mul(item.quantity) : decimal(item.total);
    const nameText = [item.name, item.comment].filter(Boolean).join('\n');
    const catalogText = [`Каталог: ${item.catalogNumber ?? '—'}`, `Аналог: ${item.analogNumber ?? '—'}`].join('\n');
    const rowHeight = Math.max(
      40,
      doc.heightOfString(nameText, { width: columns[1].width - 8, lineGap: 2 }) + 16,
      doc.heightOfString(catalogText, { width: columns[3].width - 8, lineGap: 2 }) + 16
    );

    ensureSpace(doc, rowHeight + 4);
    y = doc.y;
    doc.rect(tableX, y, 498, rowHeight).strokeColor('#e4e6e9').lineWidth(0.6).stroke();
    x = tableX;
    addCell(doc, String(index + 1), x + 4, y + 8, columns[0].width - 8);
    x += columns[0].width;
    addCell(doc, nameText, x + 4, y + 8, columns[1].width - 8, { bold: true });
    x += columns[1].width;
    addCell(doc, item.brand ?? '—', x + 4, y + 8, columns[2].width - 8);
    x += columns[2].width;
    addCell(doc, catalogText, x + 4, y + 8, columns[3].width - 8);
    x += columns[3].width;
    addCell(doc, String(item.quantity), x + 4, y + 8, columns[4].width - 8);
    x += columns[4].width;
    addCell(doc, item.unit ?? 'шт', x + 4, y + 8, columns[5].width - 8);
    x += columns[5].width;
    addCell(doc, formatInvoiceMoney(item.price, invoice.currency), x + 4, y + 8, columns[6].width - 8);
    x += columns[6].width;
    addCell(doc, formatInvoiceMoney(itemTotal, invoice.currency), x + 4, y + 8, columns[7].width - 8, { bold: true });
    doc.y = y + rowHeight;
  });

  ensureSpace(doc, 42);
  doc.moveDown(0.8);
  doc
    .font('InterBold')
    .fontSize(13)
    .fillColor('#050505')
    .text(`Загальна сума: ${formatInvoiceMoney(totalAmount, invoice.currency)}`, { align: 'right' });

  doc.moveDown(1);
  doc.font('Inter').fontSize(8).fillColor('#4C4F54').text('PDF сформовано Kairos Parts на основі погоджених клієнтом позицій.');

  doc.end();

  return {
    buffer: await bufferPromise,
    filename: `${cleanFilenamePart(invoice.invoiceNumber)}.pdf`
  };
}
