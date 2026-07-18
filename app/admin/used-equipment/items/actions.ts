'use server';

import type { UsedEquipmentStatus } from '@prisma/client';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { generateUniqueUsedEquipmentSlug } from '@/lib/used-equipment/slug';
import { resolveUsedEquipmentStatusDates } from '@/lib/used-equipment/status-dates';
import {
  getUsedEquipmentFormValues,
  type UsedEquipmentFormState,
  USED_EQUIPMENT_NO_IMAGE_STATUSES,
  validateUsedEquipmentForm
} from '@/lib/used-equipment/validation';
import { getManufacturersForEquipmentType } from '@/lib/vehicles/equipment-manufacturers';

function serverError(values: ReturnType<typeof getUsedEquipmentFormValues>, message = 'Не вдалося зберегти техніку. Спробуйте ще раз.') {
  return {
    status: 'error' as const,
    message,
    values
  };
}

async function validateManufacturer(manufacturerId: string, equipmentType: string) {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true, name: true }
  });

  if (!manufacturer) {
    return { ok: false as const, message: 'Оберіть виробника зі списку.' };
  }

  const allowedManufacturerNames = getManufacturersForEquipmentType(equipmentType).map((name) => name.toLocaleLowerCase('uk-UA'));
  if (!allowedManufacturerNames.includes(manufacturer.name.toLocaleLowerCase('uk-UA'))) {
    return { ok: false as const, message: 'Обраний виробник не відповідає типу техніки.' };
  }

  return { ok: true as const, manufacturer };
}

function canUseStatusWithoutImages(status: UsedEquipmentStatus) {
  return (USED_EQUIPMENT_NO_IMAGE_STATUSES as readonly UsedEquipmentStatus[]).includes(status);
}

export async function createUsedEquipment(_state: UsedEquipmentFormState, formData: FormData): Promise<UsedEquipmentFormState> {
  const session = await requireCrmSession();
  const values = getUsedEquipmentFormValues(formData, 'DRAFT');

  if (!hasDatabaseUrl()) {
    return serverError(values, 'База даних не налаштована.');
  }

  const validation = validateUsedEquipmentForm(values, { allowStatusEdit: false });
  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: validation.fieldErrors
    };
  }

  const manufacturerResult = await validateManufacturer(validation.data.manufacturerId, validation.data.equipmentType);
  if (!manufacturerResult.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: {
        manufacturerId: manufacturerResult.message
      }
    };
  }

  const slug = await generateUniqueUsedEquipmentSlug(validation.data.title);

  try {
    await prisma.usedEquipment.create({
      data: {
        title: validation.data.title,
        slug,
        equipmentType: validation.data.equipmentType,
        manufacturerId: manufacturerResult.manufacturer.id,
        manufacturerName: manufacturerResult.manufacturer.name,
        year: validation.data.year,
        description: validation.data.description,
        internalComment: validation.data.internalComment,
        status: 'DRAFT',
        createdById: session.user.id,
        updatedById: session.user.id,
        ...resolveUsedEquipmentStatusDates({ nextStatus: 'DRAFT' })
      }
    });
  } catch {
    return serverError(values);
  }

  redirect('/admin/used-equipment/items');
}

export async function updateUsedEquipment(equipmentId: string, _state: UsedEquipmentFormState, formData: FormData): Promise<UsedEquipmentFormState> {
  const session = await requireCrmSession();
  const values = getUsedEquipmentFormValues(formData, 'DRAFT');

  if (!hasDatabaseUrl()) {
    return serverError(values, 'База даних не налаштована.');
  }

  const existingItem = await prisma.usedEquipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      reservedAt: true,
      soldAt: true,
      archivedAt: true,
      _count: {
        select: {
          images: true
        }
      }
    }
  });

  if (!existingItem) {
    return serverError(values, 'Техніку не знайдено.');
  }

  const validation = validateUsedEquipmentForm(values, { allowStatusEdit: true });
  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: validation.fieldErrors
    };
  }

  if (existingItem._count.images === 0 && !canUseStatusWithoutImages(validation.data.status)) {
    return {
      status: 'error',
      message: 'Для публікації, резерву або продажу потрібно додати фото техніки.',
      values,
      fieldErrors: {
        status: 'Без фото доступні тільки статуси “Чернетка” або “Архівовано”.'
      }
    };
  }

  const manufacturerResult = await validateManufacturer(validation.data.manufacturerId, validation.data.equipmentType);
  if (!manufacturerResult.ok) {
    return {
      status: 'error',
      message: 'Перевірте обов’язкові поля.',
      values,
      fieldErrors: {
        manufacturerId: manufacturerResult.message
      }
    };
  }

  try {
    await prisma.usedEquipment.update({
      where: { id: equipmentId },
      data: {
        title: validation.data.title,
        equipmentType: validation.data.equipmentType,
        manufacturerId: manufacturerResult.manufacturer.id,
        manufacturerName: manufacturerResult.manufacturer.name,
        year: validation.data.year,
        description: validation.data.description,
        internalComment: validation.data.internalComment,
        status: validation.data.status,
        updatedById: session.user.id,
        ...resolveUsedEquipmentStatusDates({
          nextStatus: validation.data.status,
          previous: {
            publishedAt: existingItem.publishedAt,
            reservedAt: existingItem.reservedAt,
            soldAt: existingItem.soldAt,
            archivedAt: existingItem.archivedAt
          }
        })
      }
    });
  } catch {
    return serverError(values);
  }

  redirect('/admin/used-equipment/items');
}
