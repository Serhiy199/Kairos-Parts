import fs from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';

import {
  calculateInvoiceTotals,
  formatInvoiceMoney,
  resolveInvoiceLineTotal,
  type InvoiceTotals
} from '@/lib/invoices/totals';
import { prisma } from '@/lib/prisma';

type BillingSnapshot = Record<string, unknown>;
type DecimalLike = Prisma.Decimal.Value | { toString: () => string };
type InvoicePdfColumn = {
  title: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
};

const REGULAR_FONT_PATH = path.join(process.cwd(), 'node_modules/prisma/build/public/assets/inter-all-400-normal.4c1f8a0d.woff');
const BOLD_FONT_PATH = path.join(process.cwd(), 'node_modules/prisma/build/public/assets/inter-all-600-normal.d0a7c8a9.woff');
const PAGE_MARGIN = 34;
const SECTION_GAP = 14;
const TABLE_HEADER_HEIGHT = 22;
const TABLE_MIN_ROW_HEIGHT = 34;
const BODY_FONT_SIZE = 8.5;
const TABLE_FONT_SIZE = 7.4;
const TABLE_HEADER_FONT_SIZE = 7.2;

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

export { formatInvoiceMoney };

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

function getContentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - PAGE_MARGIN * 2;
}

function getBottomY(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE_MARGIN;
}

function ensureSpace(doc: PDFKit.PDFDocument, currentY: number, requiredHeight: number) {
  if (currentY + requiredHeight > getBottomY(doc)) {
    doc.addPage();
    return PAGE_MARGIN;
  }

  return currentY;
}

function writeText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: 'left' | 'right' | 'center';
    lineGap?: number;
    characterSpacing?: number;
  } = {}
) {
  doc
    .font(options.bold ? 'InterBold' : 'Inter')
    .fontSize(options.size ?? BODY_FONT_SIZE)
    .fillColor(options.color ?? '#101010')
    .text(text, x, y, {
      width,
      align: options.align ?? 'left',
      lineGap: options.lineGap ?? 2,
      characterSpacing: options.characterSpacing
    });
}

function measureText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  options: { bold?: boolean; size?: number; lineGap?: number } = {}
) {
  doc.font(options.bold ? 'InterBold' : 'Inter').fontSize(options.size ?? BODY_FONT_SIZE);
  return doc.heightOfString(text, {
    width,
    lineGap: options.lineGap ?? 2
  });
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string, currentY: number) {
  const y = ensureSpace(doc, currentY + SECTION_GAP, 28);
  writeText(doc, title.toUpperCase(), PAGE_MARGIN, y, getContentWidth(doc), {
    bold: true,
    size: 10,
    color: '#8A5B24',
    characterSpacing: 1
  });

  return y + 18;
}

function addKeyValueRows(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, currentY: number) {
  const contentWidth = getContentWidth(doc);
  const labelWidth = 105;
  const valueX = PAGE_MARGIN + labelWidth;
  const valueWidth = contentWidth - labelWidth;
  let y = currentY;

  rows.forEach(([label, value]) => {
    const labelHeight = measureText(doc, label, labelWidth - 10, { bold: true });
    const valueHeight = measureText(doc, value, valueWidth);
    const rowHeight = Math.max(labelHeight, valueHeight, 13) + 5;
    y = ensureSpace(doc, y, rowHeight);

    writeText(doc, label, PAGE_MARGIN, y, labelWidth - 10, {
      bold: true,
      color: '#4C4F54'
    });
    writeText(doc, value, valueX, y, valueWidth, {
      color: '#101010'
    });

    y += rowHeight;
  });

  return y;
}

function scaleColumns(columns: InvoicePdfColumn[], targetWidth: number) {
  const baseWidth = columns.reduce((sum, column) => sum + column.width, 0);

  if (baseWidth === targetWidth) {
    return columns;
  }

  const scale = targetWidth / baseWidth;
  const scaled = columns.map((column) => ({
    ...column,
    width: Math.floor(column.width * scale)
  }));
  const scaledWidth = scaled.reduce((sum, column) => sum + column.width, 0);
  const remainingWidth = targetWidth - scaledWidth;

  if (remainingWidth !== 0) {
    scaled[scaled.length - 1] = {
      ...scaled[scaled.length - 1],
      width: scaled[scaled.length - 1].width + remainingWidth
    };
  }

  return scaled;
}

function addTableHeader(doc: PDFKit.PDFDocument, columns: InvoicePdfColumn[], y: number) {
  const contentWidth = getContentWidth(doc);
  let x = PAGE_MARGIN;

  doc.rect(PAGE_MARGIN, y, contentWidth, TABLE_HEADER_HEIGHT).fill('#f6f7f8');
  columns.forEach((column) => {
    writeText(doc, column.title, x + 3, y + 6, column.width - 6, {
      bold: true,
      size: TABLE_HEADER_FONT_SIZE,
      color: '#050505',
      align: column.align
    });
    x += column.width;
  });

  doc.strokeColor('#d9dee4').lineWidth(0.6).rect(PAGE_MARGIN, y, contentWidth, TABLE_HEADER_HEIGHT).stroke();
  return y + TABLE_HEADER_HEIGHT;
}

function addTableCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { bold?: boolean; align?: 'left' | 'right' | 'center' } = {}
) {
  writeText(doc, text, x + 3, y + 7, width - 6, {
    bold: options.bold,
    align: options.align,
    size: TABLE_FONT_SIZE,
    color: options.bold ? '#050505' : '#101010'
  });
}

function tableCellHeight(doc: PDFKit.PDFDocument, text: string, width: number, bold = false) {
  return measureText(doc, text, width - 6, {
    bold,
    size: TABLE_FONT_SIZE,
    lineGap: 2
  }) + 14;
}

function addInvoiceItemsTable(
  doc: PDFKit.PDFDocument,
  items: Array<{
    name: string;
    brand: string | null;
    catalogNumber: string | null;
    quantity: number;
    unit: string | null;
    price: DecimalLike;
    total: DecimalLike;
    comment: string | null;
  }>,
  currency: string,
  currentY: number
) {
  const columns = scaleColumns([
    { title: '№', width: 22, align: 'center' },
    { title: 'Назва', width: 125 },
    { title: 'Виробник', width: 70 },
    { title: 'Артикул / каталог', width: 110 },
    { title: 'К-сть', width: 45, align: 'right' },
    { title: 'Од.', width: 35 },
    { title: 'Ціна без ПДВ', width: 70, align: 'right' },
    { title: 'Сума без ПДВ', width: 76, align: 'right', bold: true }
  ], getContentWidth(doc));
  const contentWidth = getContentWidth(doc);
  let y = ensureSpace(doc, currentY, TABLE_HEADER_HEIGHT + TABLE_MIN_ROW_HEIGHT);
  y = addTableHeader(doc, columns, y);

  items.forEach((item, index) => {
    const itemTotal = resolveInvoiceLineTotal(item);
    const nameText = [item.name, item.comment].filter(Boolean).join('\n');
    const catalogText = `Каталог: ${item.catalogNumber ?? '—'}`;
    const values = [
      String(index + 1),
      nameText,
      item.brand ?? '—',
      catalogText,
      String(item.quantity),
      item.unit ?? 'шт',
      formatInvoiceMoney(item.price, currency),
      formatInvoiceMoney(itemTotal, currency)
    ];
    const rowHeight = Math.max(
      TABLE_MIN_ROW_HEIGHT,
      ...values.map((value, valueIndex) => tableCellHeight(doc, value, columns[valueIndex].width, columns[valueIndex].bold))
    );

    if (y + rowHeight > getBottomY(doc)) {
      doc.addPage();
      y = addTableHeader(doc, columns, PAGE_MARGIN);
    }

    doc.strokeColor('#e4e6e9').lineWidth(0.6).rect(PAGE_MARGIN, y, contentWidth, rowHeight).stroke();

    let x = PAGE_MARGIN;
    values.forEach((value, valueIndex) => {
      const column = columns[valueIndex];
      addTableCell(doc, value, x, y, column.width, {
        bold: valueIndex === 1 || column.bold,
        align: column.align
      });
      x += column.width;
    });

    y += rowHeight;
  });

  return y;
}

function addInvoiceTotalsBlock(doc: PDFKit.PDFDocument, totals: InvoiceTotals, currency: string, currentY: number) {
  const blockWidth = 230;
  const labelWidth = 115;
  const valueWidth = blockWidth - labelWidth;
  const x = PAGE_MARGIN + getContentWidth(doc) - blockWidth;
  let y = ensureSpace(doc, currentY + 12, 66);
  const rows: Array<[string, DecimalLike, boolean]> = [
    ['Разом:', totals.subtotalWithoutVat, false],
    ['Сума ПДВ:', totals.vatAmount, false],
    ['Усього з ПДВ:', totals.totalWithVat, true]
  ];

  rows.forEach(([label, value, bold], index) => {
    if (index === 2) {
      doc.strokeColor('#C89642').lineWidth(0.8).moveTo(x, y - 3).lineTo(x + blockWidth, y - 3).stroke();
    }
    writeText(doc, label, x, y, labelWidth, {
      bold,
      size: bold ? 9.5 : 8.5,
      color: bold ? '#050505' : '#4C4F54',
      align: 'right'
    });
    writeText(doc, formatInvoiceMoney(value, currency), x + labelWidth, y, valueWidth, {
      bold,
      size: bold ? 10 : 8.5,
      color: '#050505',
      align: 'right'
    });
    y += bold ? 18 : 15;
  });

  return y;
}

function addSignatureBlock(doc: PDFKit.PDFDocument, currentY: number) {
  const contentWidth = getContentWidth(doc);
  const columnWidth = (contentWidth - 60) / 2;
  let y = ensureSpace(doc, currentY + 18, 58);

  writeText(doc, 'Виконавець', PAGE_MARGIN, y, columnWidth, { bold: true, size: 9, color: '#050505' });
  writeText(doc, 'Замовник', PAGE_MARGIN + columnWidth + 60, y, columnWidth, { bold: true, size: 9, color: '#050505' });
  y += 26;
  doc
    .strokeColor('#101010')
    .lineWidth(0.8)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + columnWidth, y)
    .moveTo(PAGE_MARGIN + columnWidth + 60, y)
    .lineTo(PAGE_MARGIN + columnWidth + 60 + columnWidth, y)
    .stroke();

  return y + 12;
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

  const totals = calculateInvoiceTotals(invoice.items);
  const sellerSnapshot = asBillingSnapshot(invoice.sellerSnapshot);
  const buyerSnapshot = asBillingSnapshot(invoice.buyerSnapshot);
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: PAGE_MARGIN,
    bufferPages: true,
    font: REGULAR_FONT_PATH
  });
  const bufferPromise = collectPdfBuffer(doc);
  const contentWidth = getContentWidth(doc);
  let y = PAGE_MARGIN;

  doc.registerFont('Inter', REGULAR_FONT_PATH);
  doc.registerFont('InterBold', BOLD_FONT_PATH);
  doc.font('Inter');

  writeText(doc, 'KAIROS PARTS', PAGE_MARGIN, y, contentWidth, {
    bold: true,
    size: 9.5,
    color: '#C89642',
    characterSpacing: 1.4
  });
  y += 18;

  writeText(doc, `Рахунок ${invoice.invoiceNumber}`, PAGE_MARGIN, y, contentWidth, {
    bold: true,
    size: 21,
    color: '#050505'
  });
  y += 28;

  writeText(doc, `Заявка: ${invoice.request.requestNumber}`, PAGE_MARGIN, y, contentWidth, {
    size: 9,
    color: '#4C4F54'
  });
  y += 22;

  y = addKeyValueRows(doc, [
    ['Створення заявки', formatDate(invoice.request.createdAt)],
    ['Надіслано', formatDate(invoice.sentAt)],
    ['Валюта', invoice.currency]
  ], y);

  y = addSectionTitle(doc, 'Дані продавця', y);
  y = addKeyValueRows(doc, [
    ['Назва', stringField(sellerSnapshot, 'legalName')],
    ['ЄДРПОУ', stringField(sellerSnapshot, 'edrpou')],
    ['ІПН', stringField(sellerSnapshot, 'ipn')],
    ['IBAN', stringField(sellerSnapshot, 'iban')],
    ['Банк', stringField(sellerSnapshot, 'bankName')],
    ['МФО', stringField(sellerSnapshot, 'mfo')],
    ['Юридична адреса', stringField(sellerSnapshot, 'legalAddress')],
    ['Телефон', stringField(sellerSnapshot, 'phone')],
    ['Email', stringField(sellerSnapshot, 'email')]
  ], y);

  y = addSectionTitle(doc, 'Дані покупця', y);
  y = addKeyValueRows(doc, [
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
  ], y);

  y = addSectionTitle(doc, 'Позиції', y);
  y = addInvoiceItemsTable(doc, invoice.items, invoice.currency, y);

  y = addInvoiceTotalsBlock(doc, totals, invoice.currency, y);
  y = addSignatureBlock(doc, y);

  y = ensureSpace(doc, y, 30);
  writeText(
    doc,
    'PDF сформовано Kairos Parts на основі погоджених клієнтом позицій.',
    PAGE_MARGIN,
    y,
    contentWidth,
    {
      size: 8,
      color: '#4C4F54'
    }
  );

  doc.end();

  return {
    buffer: await bufferPromise,
    filename: `${cleanFilenamePart(invoice.invoiceNumber)}.pdf`
  };
}
