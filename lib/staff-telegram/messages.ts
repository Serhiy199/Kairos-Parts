import 'server-only';

import type { LogisticsDestinationType } from '@prisma/client';

import {
  formatDateOnlyShort
} from '@/lib/logistics/date-only';
import {
  formatLogisticsUahCompact,
  LOGISTICS_DESTINATION_DIRECTION_LABELS
} from '@/lib/logistics/presentation';

function plainText(value: string, maxLength: number) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

type NewLogisticsRequestMessageCommon = {
  requestNumber: string;
  contactName: string;
  contactPhone: string;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
  preferredDeliveryDate: string | null;
};

export type NewLogisticsRequestMessageInput =
  NewLogisticsRequestMessageCommon &
    (
      | {
          pricingType: 'FIXED';
          tariffCityName: string;
          totalPrice: string;
        }
      | {
          pricingType: 'INDIVIDUAL';
          customLocality: string;
          totalPrice: null;
        }
    );

export function buildNewLogisticsRequestMessage(
  input: NewLogisticsRequestMessageInput
) {
  const pricingLines =
    input.pricingType === 'FIXED'
      ? [
          `Місто: ${plainText(input.tariffCityName, 120)}`,
          `Кінцева сума: ${formatLogisticsUahCompact(input.totalPrice)}`
        ]
      : [
          'Тип розрахунку: Індивідуальний',
          `Населений пункт: ${plainText(input.customLocality, 200)}`,
          'Вартість: очікує розрахунку'
        ];

  return [
    '🚚 Нова логістична заявка',
    '',
    `Заявка: ${plainText(input.requestNumber, 40)}`,
    `Клієнт: ${plainText(input.contactName, 120)}`,
    `Телефон: ${plainText(input.contactPhone, 32)}`,
    ...pricingLines.slice(0, -1),
    `Точок відвантаження: ${input.pickupPointCount}`,
    `Доставка: ${LOGISTICS_DESTINATION_DIRECTION_LABELS[input.destinationType]}`,
    `Бажана дата: ${
      formatDateOnlyShort(input.preferredDeliveryDate) || 'не вказана'
    }`,
    pricingLines[pricingLines.length - 1]
  ].join('\n');
}

export type NewPartsRequestMessageInput = {
  requestNumber: string;
  companyName: string | null;
  contactName: string;
  contactPhone: string;
  itemCount?: number;
};

export function buildNewPartsRequestMessage(
  input: NewPartsRequestMessageInput
) {
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
    ...itemCountLine
  ].join('\n');
}
