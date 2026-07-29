import 'server-only';

import type { LogisticsDestinationType } from '@prisma/client';

import {
  formatDateOnlyShort
} from '@/lib/logistics/date-only';
import {
  formatLogisticsUahCompact,
  LOGISTICS_DESTINATION_DIRECTION_LABELS
} from '@/lib/logistics/presentation';
import { buildAbsoluteUrl } from '@/lib/site-url';

function plainText(value: string, maxLength: number) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildNewLogisticsRequestMessage(input: {
  id: string;
  requestNumber: string;
  contactName: string;
  contactPhone: string;
  tariffCityName: string;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
  preferredDeliveryDate: string | null;
  totalPrice: string;
}) {
  return [
    '🚚 Нова логістична заявка',
    '',
    `Заявка: ${plainText(input.requestNumber, 40)}`,
    `Клієнт: ${plainText(input.contactName, 120)}`,
    `Телефон: ${plainText(input.contactPhone, 32)}`,
    `Місто: ${plainText(input.tariffCityName, 120)}`,
    `Точок відвантаження: ${input.pickupPointCount}`,
    `Доставка: ${LOGISTICS_DESTINATION_DIRECTION_LABELS[input.destinationType]}`,
    `Бажана дата: ${
      formatDateOnlyShort(input.preferredDeliveryDate) || 'не вказана'
    }`,
    `Кінцева сума: ${formatLogisticsUahCompact(input.totalPrice)}`,
    '',
    'Відкрити в CRM:',
    buildAbsoluteUrl(`/admin/logistics/${encodeURIComponent(input.id)}`)
  ].join('\n');
}

export function buildNewPartsRequestMessage(input: {
  id: string;
  requestNumber: string;
  companyName: string | null;
  contactName: string;
  contactPhone: string;
  itemCount?: number;
}) {
  const identityLines = input.companyName
    ? [
        `Компанія: ${plainText(input.companyName, 160)}`,
        `Контакт: ${plainText(input.contactName, 120)}`
      ]
    : [`Клієнт: ${plainText(input.contactName, 120)}`];
  const itemCountLine =
    input.itemCount && input.itemCount > 0
      ? [`Кількість позицій: ${input.itemCount}`]
      : [];

  return [
    '🟡 Нова заявка на підбір позицій',
    '',
    `Заявка: ${plainText(input.requestNumber, 40)}`,
    ...identityLines,
    `Телефон: ${plainText(input.contactPhone, 32)}`,
    ...itemCountLine,
    '',
    'Відкрити в CRM:',
    buildAbsoluteUrl(`/admin/requests/${encodeURIComponent(input.id)}`)
  ].join('\n');
}
