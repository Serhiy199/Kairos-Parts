import type { UsedEquipmentInquiryStatus, UsedEquipmentStatus } from '@prisma/client';

export const USED_EQUIPMENT_PUBLIC_STATUSES = ['PUBLISHED', 'RESERVED', 'SOLD'] as const satisfies readonly UsedEquipmentStatus[];

export type UsedEquipmentPublicStatus = (typeof USED_EQUIPMENT_PUBLIC_STATUSES)[number];

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

export const USED_EQUIPMENT_PUBLIC_STATUS_LABELS: Record<UsedEquipmentPublicStatus, string> = {
  PUBLISHED: 'Доступно',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано'
};

export function getUsedEquipmentStatusLabel(status: UsedEquipmentStatus) {
  return USED_EQUIPMENT_STATUS_LABELS[status];
}

export function getUsedEquipmentPublicStatusLabel(status: UsedEquipmentStatus) {
  return USED_EQUIPMENT_PUBLIC_STATUS_LABELS[status as UsedEquipmentPublicStatus] ?? getUsedEquipmentStatusLabel(status);
}

export function getUsedEquipmentInquiryStatusLabel(status: UsedEquipmentInquiryStatus) {
  return USED_EQUIPMENT_INQUIRY_STATUS_LABELS[status];
}

export function isUsedEquipmentPublic(status: UsedEquipmentStatus) {
  return USED_EQUIPMENT_PUBLIC_STATUSES.includes(status as UsedEquipmentPublicStatus);
}

export function canSubmitUsedEquipmentInquiry(status: UsedEquipmentStatus) {
  return status === 'PUBLISHED';
}
