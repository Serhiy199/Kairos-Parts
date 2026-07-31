export const INVOICE_BUSINESS_TIME_ZONE = 'Europe/Kyiv';
export const INVOICE_VALIDITY_NOTICE = 'Рахунок є дійсним протягом 2-х банківських днів';

const UKRAINIAN_MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня'
] as const;

export function formatInvoiceSentDate(value: Date | null | undefined) {
  if (!value || !Number.isFinite(value.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INVOICE_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const dateParts = new Map(parts.map((part) => [part.type, part.value]));
  const day = Number(dateParts.get('day'));
  const month = Number(dateParts.get('month'));
  const year = Number(dateParts.get('year'));

  if (!day || !month || !year || !UKRAINIAN_MONTHS_GENITIVE[month - 1]) {
    return null;
  }

  return `${day} ${UKRAINIAN_MONTHS_GENITIVE[month - 1]} ${year} р.`;
}

export function buildInvoiceHeading(invoiceNumber: string, sentAt: Date | null | undefined) {
  const sentDate = formatInvoiceSentDate(sentAt);
  return sentDate
    ? `Рахунок № ${invoiceNumber} від ${sentDate}`
    : `Рахунок № ${invoiceNumber}`;
}
