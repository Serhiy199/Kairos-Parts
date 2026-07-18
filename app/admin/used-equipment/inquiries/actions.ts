'use server';

import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { revalidateUsedEquipmentInquiryAdminPaths } from '@/lib/used-equipment/revalidation';
import {
  parseUsedEquipmentInquiryUpdateFormData,
  type UsedEquipmentInquiryUpdateField,
  type UsedEquipmentInquiryUpdateValues
} from '@/lib/used-equipment/inquiry-validation';

export type UsedEquipmentInquiryUpdateState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  values?: Partial<UsedEquipmentInquiryUpdateValues>;
  fieldErrors?: Partial<Record<UsedEquipmentInquiryUpdateField, string>>;
};

const GENERIC_ERROR = 'Не вдалося зберегти зміни. Спробуйте ще раз.';

function errorState(
  message = GENERIC_ERROR,
  values?: Partial<UsedEquipmentInquiryUpdateValues>,
  fieldErrors?: Partial<Record<UsedEquipmentInquiryUpdateField, string>>
): UsedEquipmentInquiryUpdateState {
  return {
    status: 'error',
    message,
    values,
    fieldErrors
  };
}

export async function updateUsedEquipmentInquiry(
  _state: UsedEquipmentInquiryUpdateState,
  formData: FormData
): Promise<UsedEquipmentInquiryUpdateState> {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return errorState('База даних тимчасово недоступна.');
  }

  const validation = parseUsedEquipmentInquiryUpdateFormData(formData);

  if (!validation.ok) {
    return errorState('Перевірте поля форми.', validation.values, validation.fieldErrors);
  }

  try {
    const inquiry = await prisma.usedEquipmentInquiry.findUnique({
      where: {
        id: validation.data.inquiryId
      },
      select: {
        id: true,
        status: true,
        processedAt: true
      }
    });

    if (!inquiry) {
      return errorState('Заявку на перегляд не знайдено.');
    }

    const assignee = validation.data.assignedManagerId
      ? await prisma.user.findFirst({
          where: {
            id: validation.data.assignedManagerId,
            role: {
              in: ['MANAGER', 'ADMIN']
            }
          },
          select: {
            id: true
          }
        })
      : null;

    if (validation.data.assignedManagerId && !assignee) {
      return errorState(
        'Відповідальний має бути менеджером або адміністратором.',
        {
          inquiryId: validation.data.inquiryId,
          status: validation.data.status,
          assignedManagerId: validation.data.assignedManagerId,
          internalComment: validation.data.internalComment ?? ''
        },
        { assignedManagerId: 'Оберіть менеджера або адміністратора.' }
      );
    }

    const processedAt =
      validation.data.status === 'COMPLETED'
        ? inquiry.status === 'COMPLETED' && inquiry.processedAt
          ? inquiry.processedAt
          : new Date()
        : null;

    await prisma.usedEquipmentInquiry.update({
      where: {
        id: inquiry.id
      },
      data: {
        status: validation.data.status,
        assignedManagerId: assignee?.id ?? null,
        internalComment: validation.data.internalComment,
        processedAt
      }
    });

    revalidateUsedEquipmentInquiryAdminPaths(inquiry.id);

    return {
      status: 'success',
      message: 'Зміни збережено'
    };
  } catch {
    return errorState(GENERIC_ERROR);
  }
}
