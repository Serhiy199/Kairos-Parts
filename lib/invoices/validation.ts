import { InvoiceStatus } from '@prisma/client';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Чернетка',
  SENT: 'Надіслано клієнту',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано'
};

export const CLIENT_INVOICE_STATUS_LABELS: Record<Exclude<InvoiceStatus, 'DRAFT'>, string> = {
  SENT: 'Очікує оплати',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано'
};

export const CLIENT_VISIBLE_INVOICE_STATUSES: InvoiceStatus[] = ['SENT', 'PAID'];
