import { ChangeAction, ChangeEntityType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export const CHANGE_ENTITY_TYPE_LABELS: Record<ChangeEntityType, string> = {
  REQUEST: 'Заявка',
  REQUEST_ITEM: 'Позиція заявки',
  VEHICLE: 'Техніка',
  REQUEST_DOCUMENT: 'Документ заявки',
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  COMPANY: 'Компанія',
  COMPANY_PROFILE: 'Профіль компанії'
};

export const CHANGE_ACTION_LABELS: Record<ChangeAction, string> = {
  UPDATE: 'Оновлення',
  DELETE: 'Видалення',
  ARCHIVE: 'Архівація',
  RESTORE: 'Відновлення'
};

export const CHANGE_STATUS_LABELS = {
  PENDING: 'Очікує розгляду',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено',
  CANCELLED: 'Скасовано'
} as const;

type InputSource = FormData | Record<string, unknown>;

function readString(source: InputSource, key: string) {
  if (source instanceof FormData) {
    const value = source.get(key);
    return typeof value === 'string' ? value.trim() : '';
  }

  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function parseOptionalJson(source: InputSource, key: string): Prisma.InputJsonValue | undefined {
  if (!(source instanceof FormData)) {
    const value = source[key];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  const raw = readString(source, key);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return raw;
  }
}

export function parseChangeRequestInput(source: InputSource) {
  const entityType = readString(source, 'entityType');
  const entityId = readString(source, 'entityId');
  const action = readString(source, 'action');
  const reason = readString(source, 'reason');
  const fieldName = readString(source, 'fieldName');

  if (!Object.values(ChangeEntityType).includes(entityType as ChangeEntityType)) {
    return { ok: false as const, status: 'invalid-entity-type' };
  }

  if (!entityId) {
    return { ok: false as const, status: 'entity-id-required' };
  }

  if (!Object.values(ChangeAction).includes(action as ChangeAction)) {
    return { ok: false as const, status: 'invalid-action' };
  }

  return {
    ok: true as const,
    data: {
      entityType: entityType as ChangeEntityType,
      entityId,
      action: action as ChangeAction,
      fieldName: fieldName || null,
      oldValue: parseOptionalJson(source, 'oldValue'),
      newValue: parseOptionalJson(source, 'newValue'),
      reason: reason || null
    }
  };
}

export function parseAdminReviewInput(source: InputSource) {
  const adminComment = readString(source, 'adminComment');
  return { adminComment: adminComment || null };
}
