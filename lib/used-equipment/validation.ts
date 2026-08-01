import type { UsedEquipmentStatus } from '@prisma/client';

import { validateAndSanitizeUsedEquipmentDescription } from '@/lib/used-equipment/description';
import { buildUsedEquipmentTitle } from '@/lib/used-equipment/title';

export const USED_EQUIPMENT_ALLOWED_FORM_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const satisfies UsedEquipmentStatus[];
export const USED_EQUIPMENT_NO_IMAGE_STATUSES = ['DRAFT', 'ARCHIVED'] as const satisfies UsedEquipmentStatus[];
export const USED_EQUIPMENT_IDENTITY_FIELD_MAX_LENGTH = 120;
export const USED_EQUIPMENT_TITLE_MAX_LENGTH = 180;

export type UsedEquipmentFormField =
  | 'type'
  | 'manufacturer'
  | 'model'
  | 'year'
  | 'description'
  | 'internalComment'
  | 'status'
  | 'images';

export type UsedEquipmentFormValues = {
  type: string;
  manufacturer: string;
  model: string;
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
  type: string;
  manufacturer: string;
  model: string;
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
    type: String(formData.get('type') ?? ''),
    manufacturer: String(formData.get('manufacturer') ?? ''),
    model: String(formData.get('model') ?? ''),
    year: String(formData.get('year') ?? ''),
    description: String(formData.get('description') ?? ''),
    internalComment: String(formData.get('internalComment') ?? ''),
    status: isUsedEquipmentStatus(statusValue) ? statusValue : fallbackStatus
  };
}

export function isUsedEquipmentStatus(value: string): value is UsedEquipmentStatus {
  return USED_EQUIPMENT_ALLOWED_FORM_STATUSES.includes(value as UsedEquipmentStatus);
}

function validateRequiredIdentityField(
  value: string,
  field: 'type' | 'manufacturer' | 'model',
  fieldErrors: Partial<Record<UsedEquipmentFormField, string>>
) {
  const labels = {
    type: 'тип техніки',
    manufacturer: 'виробника',
    model: 'модель'
  };
  if (!value) {
    fieldErrors[field] = `Вкажіть ${labels[field]}.`;
  } else if (value.length > USED_EQUIPMENT_IDENTITY_FIELD_MAX_LENGTH) {
    fieldErrors[field] = `Значення не може перевищувати ${USED_EQUIPMENT_IDENTITY_FIELD_MAX_LENGTH} символів.`;
  }
}

export function validateUsedEquipmentForm(values: UsedEquipmentFormValues, options: { allowStatusEdit: boolean }) {
  const fieldErrors: Partial<Record<UsedEquipmentFormField, string>> = {};
  const type = values.type.trim();
  const manufacturer = values.manufacturer.trim();
  const model = values.model.trim();
  const yearValue = values.year.trim();
  const description = values.description.trim();
  const internalComment = values.internalComment.trim();

  validateRequiredIdentityField(type, 'type', fieldErrors);
  validateRequiredIdentityField(manufacturer, 'manufacturer', fieldErrors);
  validateRequiredIdentityField(model, 'model', fieldErrors);

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

  const title = buildUsedEquipmentTitle({ type, manufacturer, model, year });
  if (title.length > USED_EQUIPMENT_TITLE_MAX_LENGTH) {
    fieldErrors.type = `Сформована назва не може перевищувати ${USED_EQUIPMENT_TITLE_MAX_LENGTH} символів.`;
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
      type,
      manufacturer,
      model,
      year,
      description: descriptionValidation.ok ? descriptionValidation.html : '',
      internalComment: internalComment || null,
      status: options.allowStatusEdit ? values.status : 'DRAFT'
    } satisfies ValidUsedEquipmentInput
  };
}
