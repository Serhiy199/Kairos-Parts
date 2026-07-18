'use server';

import { prisma } from '@/lib/prisma';
import { canSubmitUsedEquipmentInquiry } from '@/lib/used-equipment/status';
import {
  parseUsedEquipmentInquiryFormData,
  type UsedEquipmentInquiryField,
  type UsedEquipmentInquiryValues
} from '@/lib/used-equipment/inquiry-validation';

export type UsedEquipmentInquiryFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  values?: Partial<UsedEquipmentInquiryValues>;
  fieldErrors?: Partial<Record<UsedEquipmentInquiryField, string>>;
};

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const GENERIC_ERROR = 'Не вдалося надіслати запит. Спробуйте ще раз.';
const DUPLICATE_SUCCESS = 'Ваш запит уже отримано. Менеджер зв’яжеться з вами.';
const SUCCESS_MESSAGE = 'Дякуємо! Ваш запит отримано. Менеджер зв’яжеться з вами за вказаним номером телефону.';

function safeError(values?: Partial<UsedEquipmentInquiryValues>, message = GENERIC_ERROR): UsedEquipmentInquiryFormState {
  return {
    status: 'error',
    message,
    values
  };
}

export async function createUsedEquipmentInquiry(
  _state: UsedEquipmentInquiryFormState,
  formData: FormData
): Promise<UsedEquipmentInquiryFormState> {
  const honeypot = formData.get('website');

  if (typeof honeypot === 'string' && honeypot.trim()) {
    return {
      status: 'success',
      message: SUCCESS_MESSAGE
    };
  }

  const validation = parseUsedEquipmentInquiryFormData(formData);

  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values: validation.values,
      fieldErrors: validation.fieldErrors
    };
  }

  if (validation.data.website) {
    return {
      status: 'success',
      message: SUCCESS_MESSAGE
    };
  }

  try {
    const equipment = await prisma.usedEquipment.findUnique({
      where: { id: validation.data.usedEquipmentId },
      select: {
        id: true,
        title: true,
        status: true
      }
    });

    if (!equipment) {
      return safeError({ name: validation.data.name, phone: validation.data.phone });
    }

    if (!canSubmitUsedEquipmentInquiry(equipment.status)) {
      return safeError({ name: validation.data.name, phone: validation.data.phone }, 'Ця техніка більше не доступна для перегляду.');
    }

    const duplicateCreatedAfter = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const duplicate = await prisma.usedEquipmentInquiry.findFirst({
      where: {
        usedEquipmentId: equipment.id,
        normalizedPhone: validation.data.normalizedPhone,
        createdAt: {
          gte: duplicateCreatedAfter
        }
      },
      select: {
        id: true
      }
    });

    if (duplicate) {
      return {
        status: 'success',
        message: DUPLICATE_SUCCESS
      };
    }

    await prisma.usedEquipmentInquiry.create({
      data: {
        usedEquipmentId: equipment.id,
        equipmentTitle: equipment.title,
        name: validation.data.name,
        phone: validation.data.normalizedPhone,
        normalizedPhone: validation.data.normalizedPhone,
        status: 'NEW',
        assignedManagerId: null,
        internalComment: null,
        processedAt: null,
        source: validation.data.source
      }
    });

    return {
      status: 'success',
      message: `Запит щодо «${equipment.title}» успішно надіслано. Менеджер зв’яжеться з вами за вказаним номером телефону.`
    };
  } catch {
    return safeError({ name: validation.data.name, phone: validation.data.phone });
  }
}
