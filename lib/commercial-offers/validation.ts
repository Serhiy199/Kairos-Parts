import { CommercialOfferStatus } from '@prisma/client';

export const COMMERCIAL_OFFER_STATUS_LABELS: Record<CommercialOfferStatus, string> = {
  DRAFT: 'Чернетка',
  SENT: 'Надіслано клієнту',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено',
  EXPIRED: 'Прострочено',
  CANCELLED: 'Скасовано'
};

export const CLIENT_VISIBLE_OFFER_STATUSES: CommercialOfferStatus[] = ['SENT', 'APPROVED', 'REJECTED', 'EXPIRED'];

export type CommercialOfferMetadataInput = {
  currency: string;
  validUntil: Date | null;
  managerComment: string | null;
};

export type CommercialOfferItemInput = {
  quantity: number;
  price: string;
  availability: string | null;
  comment: string | null;
};

type InputSource = FormData | Record<string, unknown>;

function readValue(source: InputSource, key: string) {
  if (source instanceof FormData) {
    const value = source.get(key);
    return typeof value === 'string' ? value : '';
  }

  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

function optionalText(source: InputSource, key: string) {
  const value = readValue(source, key).trim();
  return value || null;
}

function normalizeDecimal(source: InputSource, key: string) {
  const raw = readValue(source, key).trim().replace(',', '.');

  if (!raw) {
    return { ok: true as const, value: '0' };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false as const, error: 'Ціна має бути числом більше або дорівнювати 0.' };
  }

  return { ok: true as const, value: raw };
}

export function parseCommercialOfferMetadata(source: InputSource) {
  const currency = optionalText(source, 'currency') ?? 'UAH';
  const validUntilRaw = optionalText(source, 'validUntil');
  const validUntil = validUntilRaw ? new Date(`${validUntilRaw}T23:59:59.000Z`) : null;

  if (!currency) {
    return { ok: false as const, error: 'Валюта є обовʼязковою.' };
  }

  if (validUntilRaw && Number.isNaN(validUntil?.getTime())) {
    return { ok: false as const, error: 'Дата дії пропозиції некоректна.' };
  }

  return {
    ok: true as const,
    data: {
      currency,
      validUntil,
      managerComment: optionalText(source, 'managerComment')
    } satisfies CommercialOfferMetadataInput
  };
}

export function parseCommercialOfferItemInput(source: InputSource) {
  const quantityRaw = readValue(source, 'quantity').trim();
  const quantity = quantityRaw ? Number(quantityRaw) : 1;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false as const, error: 'Кількість має бути цілим числом від 1.' };
  }

  const price = normalizeDecimal(source, 'price');

  if (!price.ok) {
    return { ok: false as const, error: price.error };
  }

  return {
    ok: true as const,
    data: {
      quantity,
      price: price.value,
      availability: optionalText(source, 'availability'),
      comment: optionalText(source, 'comment')
    } satisfies CommercialOfferItemInput
  };
}

export function parseClientOfferComment(source: InputSource) {
  return optionalText(source, 'clientComment');
}
