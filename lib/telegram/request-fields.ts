import { EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '@/lib/features/equipment-taxonomy';

export type ManualEquipmentFieldResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'required' | 'too_long' };

export function validateManualEquipmentField(value: string | null | undefined): ManualEquipmentFieldResult {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return { ok: false, reason: 'required' };
  }

  if (normalized.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }

  return { ok: true, value: normalized };
}
