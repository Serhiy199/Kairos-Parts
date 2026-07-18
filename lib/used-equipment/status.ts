import type { UsedEquipmentInquiryStatus, UsedEquipmentStatus } from '@prisma/client';

export const USED_EQUIPMENT_STATUS_LABELS: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'Чернетка',
  PUBLISHED: 'Опубліковано',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано',
  ARCHIVED: 'Архівовано'
};

export const USED_EQUIPMENT_INQUIRY_STATUS_LABELS: Record<UsedEquipmentInquiryStatus, string> = {
  NEW: 'Нова',
  IN_PROGRESS: 'В роботі',
  COMPLETED: 'Оброблена',
  CANCELLED: 'Скасована'
};

export function getUsedEquipmentStatusLabel(status: UsedEquipmentStatus) {
  return USED_EQUIPMENT_STATUS_LABELS[status];
}

export function getUsedEquipmentInquiryStatusLabel(status: UsedEquipmentInquiryStatus) {
  return USED_EQUIPMENT_INQUIRY_STATUS_LABELS[status];
}

export function isUsedEquipmentPublic(status: UsedEquipmentStatus) {
  return status === 'PUBLISHED' || status === 'RESERVED' || status === 'SOLD';
}

export function canSubmitUsedEquipmentInquiry(status: UsedEquipmentStatus) {
  return status === 'PUBLISHED';
}
