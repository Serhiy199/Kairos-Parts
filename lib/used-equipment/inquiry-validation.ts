import { normalizePhoneDigits } from '@/lib/phone/normalize';

export const USED_EQUIPMENT_INQUIRY_SOURCES = ['CATALOG_CARD', 'DETAIL_PAGE'] as const;

export type UsedEquipmentInquirySource = (typeof USED_EQUIPMENT_INQUIRY_SOURCES)[number];

export type UsedEquipmentInquiryField = 'name' | 'phone' | 'usedEquipmentId' | 'source';

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
