import { normalizeVehicleVin } from '@/lib/vehicles/vin';
import {
  EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED,
  EQUIPMENT_TEXT_FIELD_MAX_LENGTH
} from '@/lib/features/equipment-taxonomy';

export type AdminVehicleFormField =
  | 'equipmentType'
  | 'manufacturerId'
  | 'manufacturer'
  | 'model'
  | 'year'
  | 'vinOrSerial'
  | 'comment';

export type AdminVehicleFormValues = {
  equipmentType: string;
  manufacturerId: string;
  manufacturer: string;
  model: string;
  year: string;
  vinOrSerial: string;
  comment: string;
};

export type AdminVehicleFormState = {
  status: 'idle' | 'error';
  message?: string;
  values?: AdminVehicleFormValues;
  fieldErrors?: Partial<Record<AdminVehicleFormField, string>>;
  duplicateVehicleId?: string;
};

export type ValidAdminVehicleInput = {
  equipmentType: string;
  manufacturerId: string;
  manufacturer: string;
  model: string;
  year: number | null;
  vinOrSerial: string | null;
  comment: string | null;
};

export const EMPTY_ADMIN_VEHICLE_FORM_STATE: AdminVehicleFormState = {
  status: 'idle'
};

export const EMPTY_ADMIN_VEHICLE_FORM_VALUES: AdminVehicleFormValues = {
  equipmentType: '',
  manufacturerId: '',
  manufacturer: '',
  model: '',
  year: '',
  vinOrSerial: '',
  comment: ''
};

export function getAdminVehicleFormValues(formData: FormData): AdminVehicleFormValues {
  return {
    equipmentType: String(formData.get('equipmentType') ?? ''),
    manufacturerId: String(formData.get('manufacturerId') ?? ''),
    manufacturer: String(formData.get('manufacturer') ?? ''),
    model: String(formData.get('model') ?? ''),
    year: String(formData.get('year') ?? ''),
    vinOrSerial: String(formData.get('vinOrSerial') ?? ''),
    comment: String(formData.get('comment') ?? '')
  };
}

export function validateAdminVehicleForm(values: AdminVehicleFormValues) {
  const fieldErrors: Partial<Record<AdminVehicleFormField, string>> = {};
  const equipmentType = values.equipmentType.trim();
  const manufacturerId = values.manufacturerId.trim();
  const manufacturer = values.manufacturer.trim();
  const model = values.model.trim();
  const yearValue = values.year.trim();
  const vinSource = values.vinOrSerial.trim();
  const vinOrSerial = normalizeVehicleVin(vinSource);
  const comment = values.comment.trim();

  if (!equipmentType) {
    fieldErrors.equipmentType = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
      ? 'Оберіть тип техніки зі списку.'
      : 'Вкажіть тип техніки.';
  } else if (equipmentType.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    fieldErrors.equipmentType = `Тип техніки має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`;
  }

  if (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && !manufacturerId) {
    fieldErrors.manufacturerId = 'Оберіть виробника зі списку.';
  } else if (!EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && !manufacturer) {
    fieldErrors.manufacturer = 'Вкажіть виробника або марку.';
  } else if (!EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && manufacturer.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    fieldErrors.manufacturer = `Виробник або марка має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`;
  }

  if (model.length < 2) {
    fieldErrors.model = 'Вкажіть модель щонайменше з 2 символів.';
  } else if (model.length > 120) {
    fieldErrors.model = 'Модель має бути не довшою за 120 символів.';
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

  if (vinSource.length > 120 || (vinOrSerial?.length ?? 0) > 120) {
    fieldErrors.vinOrSerial = 'VIN або серійний номер має бути не довшим за 120 символів.';
  }

  if (comment.length > 5000) {
    fieldErrors.comment = 'Опис має бути не довшим за 5000 символів.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false as const, fieldErrors };
  }

  return {
    ok: true as const,
    data: {
      equipmentType,
      manufacturerId,
      manufacturer,
      model,
      year,
      vinOrSerial,
      comment: comment || null
    } satisfies ValidAdminVehicleInput
  };
}
