import { normalizePhoneDigits } from '@/lib/phone/normalize';
import type { UsedEquipmentInquiryStatus } from '@prisma/client';

export const USED_EQUIPMENT_INQUIRY_SOURCES = ['CATALOG_CARD', 'DETAIL_PAGE'] as const;

export type UsedEquipmentInquirySource = (typeof USED_EQUIPMENT_INQUIRY_SOURCES)[number];

export type UsedEquipmentInquiryField = 'name' | 'phone' | 'usedEquipmentId' | 'source';
export type UsedEquipmentInquiryUpdateField = 'inquiryId' | 'status' | 'assignedManagerId' | 'internalComment';

export type UsedEquipmentInquiryValues = {
  usedEquipmentId: string;
  source: string;
  name: string;
  phone: string;
  website: string;
};

export type ValidUsedEquipmentInquiryInput = {
  usedEquipmentId: string;
  source: UsedEquipmentInquirySource;
  name: string;
  phone: string;
  normalizedPhone: string;
  website: string;
};

export type UsedEquipmentInquiryValidationResult =
  | { ok: true; data: ValidUsedEquipmentInquiryInput }
  | { ok: false; values: UsedEquipmentInquiryValues; fieldErrors: Partial<Record<UsedEquipmentInquiryField, string>> };

export type UsedEquipmentInquiryUpdateValues = {
  inquiryId: string;
  status: string;
  assignedManagerId: string;
  internalComment: string;
};

export type ValidUsedEquipmentInquiryUpdateInput = {
  inquiryId: string;
  status: UsedEquipmentInquiryStatus;
  assignedManagerId: string | null;
  internalComment: string | null;
};

export type UsedEquipmentInquiryUpdateValidationResult =
  | { ok: true; data: ValidUsedEquipmentInquiryUpdateInput }
  | {
      ok: false;
      values: UsedEquipmentInquiryUpdateValues;
      fieldErrors: Partial<Record<UsedEquipmentInquiryUpdateField, string>>;
    };

export const USED_EQUIPMENT_INQUIRY_UPDATE_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const satisfies readonly UsedEquipmentInquiryStatus[];

function readString(formData: FormData, key: string, maxLength = 500) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function isUsedEquipmentInquirySource(value: string): value is UsedEquipmentInquirySource {
  return USED_EQUIPMENT_INQUIRY_SOURCES.includes(value as UsedEquipmentInquirySource);
}

export function parseUsedEquipmentInquiryFormData(formData: FormData): UsedEquipmentInquiryValidationResult {
  const values: UsedEquipmentInquiryValues = {
    usedEquipmentId: readString(formData, 'usedEquipmentId', 120),
    source: readString(formData, 'source', 40),
    name: readString(formData, 'name', 140),
    phone: readString(formData, 'phone', 50),
    website: readString(formData, 'website', 200)
  };
  const fieldErrors: Partial<Record<UsedEquipmentInquiryField, string>> = {};
  const normalizedPhone = normalizePhoneDigits(values.phone);

  if (!values.usedEquipmentId) {
    fieldErrors.usedEquipmentId = 'Не вдалося визначити техніку для запиту.';
  }

  if (!isUsedEquipmentInquirySource(values.source)) {
    fieldErrors.source = 'Не вдалося визначити джерело запиту.';
  }

  if (!values.name) {
    fieldErrors.name = 'Вкажіть ім’я.';
  } else if (values.name.length < 2) {
    fieldErrors.name = 'Ім’я має містити щонайменше 2 символи.';
  } else if (values.name.length > 120) {
    fieldErrors.name = 'Ім’я має бути не довшим за 120 символів.';
  }

  if (!values.phone) {
    fieldErrors.phone = 'Вкажіть телефон.';
  } else if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    fieldErrors.phone = 'Вкажіть коректний номер телефону.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, values, fieldErrors };
  }

  return {
    ok: true,
    data: {
      usedEquipmentId: values.usedEquipmentId,
      source: values.source as UsedEquipmentInquirySource,
      name: values.name,
      phone: values.phone,
      normalizedPhone,
      website: values.website
    }
  };
}

export function isUsedEquipmentInquiryStatus(value: string): value is UsedEquipmentInquiryStatus {
  return USED_EQUIPMENT_INQUIRY_UPDATE_STATUSES.includes(value as UsedEquipmentInquiryStatus);
}

export function parseUsedEquipmentInquiryUpdateFormData(formData: FormData): UsedEquipmentInquiryUpdateValidationResult {
  const values: UsedEquipmentInquiryUpdateValues = {
    inquiryId: readString(formData, 'inquiryId', 120),
    status: readString(formData, 'status', 40),
    assignedManagerId: readString(formData, 'assignedManagerId', 120),
    internalComment: readString(formData, 'internalComment', 10000)
  };
  const fieldErrors: Partial<Record<UsedEquipmentInquiryUpdateField, string>> = {};

  if (!values.inquiryId) {
    fieldErrors.inquiryId = 'Не вдалося визначити заявку на перегляд.';
  }

  if (!isUsedEquipmentInquiryStatus(values.status)) {
    fieldErrors.status = 'Оберіть коректний статус.';
  }

  if (values.internalComment.length > 5000) {
    fieldErrors.internalComment = 'Коментар має бути не довшим за 5000 символів.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, values, fieldErrors };
  }

  return {
    ok: true,
    data: {
      inquiryId: values.inquiryId,
      status: values.status as UsedEquipmentInquiryStatus,
      assignedManagerId: values.assignedManagerId || null,
      internalComment: values.internalComment || null
    }
  };
}
