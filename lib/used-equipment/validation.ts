import type { UsedEquipmentStatus } from '@prisma/client';

import { validateAndSanitizeUsedEquipmentDescription } from '@/lib/used-equipment/description';
import { EQUIPMENT_TYPE_OPTIONS } from '@/lib/vehicles/equipment-types';

export const USED_EQUIPMENT_ALLOWED_FORM_STATUSES = ['DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD', 'ARCHIVED'] as const satisfies UsedEquipmentStatus[];
export const USED_EQUIPMENT_NO_IMAGE_STATUSES = ['DRAFT', 'ARCHIVED'] as const satisfies UsedEquipmentStatus[];

export type UsedEquipmentFormField =
  | 'title'
  | 'equipmentType'
  | 'manufacturerId'
  | 'year'
  | 'description'
  | 'internalComment'
  | 'status'
  | 'images';

export type UsedEquipmentFormValues = {
  title: string;
  equipmentType: string;
  manufacturerId: string;
  year: string;
  description: string;
  internalComment: string;
  status: UsedEquipmentStatus;
};

export type UsedEquipmentFormState = {
  status: 'idle' | 'error';
  message?: string;
  values?: UsedEquipmentFormValues;
  fieldErrors?: Partial<Record<UsedEquipmentFormField, string>>;
};

export type ValidUsedEquipmentInput = {
  title: string;
  equipmentType: string;
  manufacturerId: string;
  year: number | null;
  description: string;
  internalComment: string | null;
  status: UsedEquipmentStatus;
};

export const EMPTY_USED_EQUIPMENT_FORM_STATE: UsedEquipmentFormState = {
  status: 'idle'
};

export function getUsedEquipmentFormValues(formData: FormData, fallbackStatus: UsedEquipmentStatus = 'DRAFT'): UsedEquipmentFormValues {
  const statusValue = String(formData.get('status') ?? fallbackStatus);

  return {
    title: String(formData.get('title') ?? ''),
    equipmentType: String(formData.get('equipmentType') ?? ''),
    manufacturerId: String(formData.get('manufacturerId') ?? ''),
    year: String(formData.get('year') ?? ''),
    description: String(formData.get('description') ?? ''),
    internalComment: String(formData.get('internalComment') ?? ''),
    status: isUsedEquipmentStatus(statusValue) ? statusValue : fallbackStatus
  };
}

export function isUsedEquipmentStatus(value: string): value is UsedEquipmentStatus {
  return USED_EQUIPMENT_ALLOWED_FORM_STATUSES.includes(value as UsedEquipmentStatus);
}

export function validateUsedEquipmentForm(values: UsedEquipmentFormValues, options: { allowStatusEdit: boolean }) {
  const fieldErrors: Partial<Record<UsedEquipmentFormField, string>> = {};
  const title = values.title.trim();
  const equipmentType = values.equipmentType.trim();
  const manufacturerId = values.manufacturerId.trim();
  const yearValue = values.year.trim();
  const description = values.description.trim();
  const internalComment = values.internalComment.trim();

  if (title.length < 3) {
    fieldErrors.title = 'Вкажіть назву техніки.';
  } else if (title.length > 180) {
    fieldErrors.title = 'Назва має бути не довшою за 180 символів.';
  }

  if (!EQUIPMENT_TYPE_OPTIONS.includes(equipmentType)) {
    fieldErrors.equipmentType = 'Оберіть тип техніки зі списку.';
  }

  if (!manufacturerId) {
    fieldErrors.manufacturerId = 'Оберіть виробника зі списку.';
  }

  let year: number | null = null;
  if (yearValue) {
    if (!/^\d{4}$/.test(yearValue)) {
      fieldErrors.year = 'Рік має бути у форматі 4 цифри.';
    } else {
      year = Number.parseInt(yearValue, 10);
      if (year < 1950 || year > 2100) {
        fieldErrors.year = 'Вкажіть рік у діапазоні 1950-2100.';
      }
    }
  }

  const descriptionValidation = validateAndSanitizeUsedEquipmentDescription(description);
  if (!descriptionValidation.ok) {
    fieldErrors.description = descriptionValidation.message;
  }

  if (internalComment.length > 5000) {
    fieldErrors.internalComment = 'Внутрішній коментар має бути не довшим за 5000 символів.';
  }

  if (options.allowStatusEdit && !isUsedEquipmentStatus(values.status)) {
    fieldErrors.status = 'Оберіть коректний статус.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false as const, fieldErrors };
  }

  return {
    ok: true as const,
    data: {
      title,
      equipmentType,
      manufacturerId,
      year,
      description: descriptionValidation.ok ? descriptionValidation.html : '',
      internalComment: internalComment || null,
      status: options.allowStatusEdit ? values.status : 'DRAFT'
    } satisfies ValidUsedEquipmentInput
  };
}
